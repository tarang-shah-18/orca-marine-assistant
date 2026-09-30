/**
 * Marine Alert Agent — IMD / INCOIS advisory surveillance.
 *
 * The single most safety-critical agent: it is the only place that may raise a
 * go/no-go signal, and it only ever *escalates*. Distances are computed from the
 * user's actual position, and every advisory carries the statutory action text
 * verbatim so the answer can never be weaker than the official bulletin.
 */

import { AdvisoryLevel, MarineAlert, RiskLevel } from '../types';
import {
  AgentContext,
  AgentDefinition,
  defineAgent,
  ev,
  finding,
  ok,
  partial,
  publish,
  worst,
} from './base';
import { getMarineAlertsNear } from '../core/dataAccess';
import { currentBulletins, lapsedBulletins } from '../core/alerts';
import { liveDataCycle } from '../core/live';
import { DATA_CYCLE } from '../core/dataset';
import { renderHeadline } from '../core/i18n';
import { applyAlertLocalization } from '../core/localize';
import { ADVISORY_WEIGHT } from '../types';

const ADVISORY_RISK: Record<AdvisoryLevel, RiskLevel> = {
  GREEN: 'LOW',
  YELLOW: 'MODERATE',
  ORANGE: 'HIGH',
  RED: 'SEVERE',
};

export const alertAgent: AgentDefinition = defineAgent(
  'MARINE_ALERT_AGENT',
  (context: AgentContext) => {
    const { book } = context;
    const all = getMarineAlertsNear(context.position.latitude, context.position.longitude);
    // "In force" means inside the influence radius AND still within its validity
    // window — an advisory whose bulletin has lapsed stops governing decisions
    // (it is reported below, never silently dropped).
    const active = currentBulletins(all);
    const nearby = all.filter((a) => !a.withinInfluence && a.distanceKm <= 250);
    const lapsed = lapsedBulletins(all);

    context.artifacts.alerts = all;

    const askedForSpecificType =
      context.parsed.facets.alerts &&
      ['cyclone', 'lightning', 'warning', 'alert', 'squall', 'storm'].some((t) =>
        context.parsed.normalised.includes(t),
      );

    const headline = askedForSpecificType
      ? [...active, ...nearby]
      : active.length > 0
        ? active
        : nearby.slice(0, 3);

    const cycle = liveDataCycle();
    const liveCycle = cycle.label.includes('Live');

    if (headline.length === 0) {
      return ok(
        [
          finding(
            book.ui.noWarningInForceWord.replace('{harbor}', context.anchor.label),
            {
              confidence: 0.8,
              evidence: [
                ev(
                  'Cycle',
                  liveCycle ? cycle.label : DATA_CYCLE.label,
                  liveCycle ? 'ORCA live marine alert scan (GDACS + Open-Meteo derived)' : 'IMD Marine Weather Warning bulletin',
                ),
              ],
            },
          ),
        ],
        renderHeadline(book, 'noAlerts', { harbor: context.anchor.label }),
        liveCycle
          ? ['Live marine alert scan', 'GDACS (UN/EC)', 'Open-Meteo derived rules']
          : ['IMD Marine Weather Warning', 'INCOIS Early Warning Centre'],
      );
    }

    const highest = headline.reduce((a, b) =>
      ADVISORY_WEIGHT[b.advisoryLevel] > ADVISORY_WEIGHT[a.advisoryLevel] ? b : a,
    );
    const riskLevel = worst(ADVISORY_RISK[highest.advisoryLevel]);

    const findings: ReturnType<typeof finding>[] = [
      finding(
        book.ui.advisoriesInForceWord
          .replace('{n}', String(headline.length))
          .replace('{harbor}', context.anchor.label)
          .replace(
            '{count}',
            headline.length === 1 ? book.ui.advisoryIsWord : book.ui.advisoriesAreWord,
          ) +
          ' ' +
          book.ui.highestIsWord
            .replace('{level}', highest.advisoryLevel)
            .replace('{type}', labelFor(highest.type))
            .replace('{title}', applyAlertLocalization(highest, book).title),
        {
          confidence: 0.92,
          riskLevel,
          evidence: headline.slice(0, 4).map((a) =>
            ev(`${a.advisoryLevel} · ${a.type.replace(/_/g, ' ').toLowerCase()}`, `${a.affectedCoast} · ${a.distanceKm} km ${a.bearing}`, a.source),
          ),
        },
      ),
    ];

    for (const alert of headline.slice(0, 3)) {
      const localized = applyAlertLocalization(alert, book);
      // `validUntilWord` is a template, not a phrase: it carries a `{date}`
      // slot. It used to be interpolated as `${book.ui.validUntilWord} ${...}`,
      // which printed the literal text "{date} வரை செல்லுபடியாகும்" into the
      // answer. Every other call site replaces the slot; this one did not.
      const validUntil = book.ui.validUntilWord.replace('{date}', localized.validUntil);
      findings.push(
        finding(
          `${localized.title} (${alert.advisoryLevel}, ${alert.severity}) — ${localized.description} ${validUntil}. ${localized.action}`,
          {
            confidence: 0.9,
            riskLevel: ADVISORY_RISK[alert.advisoryLevel],
            evidence: [
              ev('Affected coast', alert.affectedCoast, alert.source),
              ev('Distance', `${alert.distanceKm} km ${alert.bearing}`, 'ORCA geodesic engine'),
              ev(book.ui.validUntilWord, localized.validUntil, alert.source),
            ],
          },
        ),
      );
    }

    if (active.length > 0) {
      findings.push(
        finding(
          book.ui.alertInsideWord
            .replace('{n}', String(active.length))
            .replace('{zone}', applyAlertLocalization(active[0], book).title)
            .replace('{km}', String(active[0].distanceKm)),
          {
            confidence: 0.88,
            riskLevel,
            evidence: [ev('Within influence', `${active.length} zone(s)`, 'ORCA alert geometry join')],
          },
        ),
      );
    } else if (nearby.length > 0) {
      findings.push(
        finding(
          book.ui.alertNearbyWord
            .replace('{place}', context.anchor.label)
            .replace('{zone}', applyAlertLocalization(nearby[0], book).title)
            .replace('{km}', String(nearby[0].distanceKm))
            .replace('{bearing}', nearby[0].bearing),
          {
            confidence: 0.75,
            riskLevel: 'MODERATE',
            evidence: [ev('Nearest developing advisory', `${nearby[0].distanceKm} km`, nearby[0].source)],
          },
        ),
      );
    }

    context.artifacts.riskNotes = [
      ...(context.artifacts.riskNotes ?? []),
      {
        agent: 'MARINE_ALERT_AGENT',
        level: riskLevel,
        reason: `${highest.advisoryLevel} ${labelFor(highest.type)} in force${active.length > 0 ? ' over the user position' : ' nearby'}.`,
      },
    ];

    // Expired bulletins are reported, never silently dropped: a lapsed watch
    // must not keep steering this harbour's verdict.
    for (const alert of lapsed.slice(0, 2)) {
      const localized = applyAlertLocalization(alert, book);
      findings.push(
        finding(
          book.ui.lapsedWord
            .replace('{title}', localized.title)
            .replace('{level}', alert.advisoryLevel)
            .replace('{type}', labelFor(alert.type))
            .replace('{harbor}', context.anchor.label)
            .replace('{date}', localized.validUntil),
          {
            confidence: 0.98,
            evidence: [ev('Expired', alert.validUntil, alert.source)],
          },
        ),
      );
    }

    publish(context, {
      id: 'viz-alerts',
      type: 'map',
      title: book.labels.alerts,
      subtitle: book.ui.advisoryGeometryWord,
      geo: {
        points: [],
        circles: all.slice(0, 6).map((a) => ({
          id: a.id,
          label: a.title,
          latitude: a.geometry?.center?.latitude ?? context.position.latitude,
          longitude: a.geometry?.center?.longitude ?? context.position.longitude,
          radiusKm: a.geometry?.radiusKm ?? 100,
          color: advisoryColor(a.advisoryLevel),
          level: 'hazard' as const,
        })),
        polygons: [],
      },
    });

    return partial(
      findings,
      `${book.labels.alerts}: ${highest.advisoryLevel} ${labelFor(highest.type)} affecting ${highest.affectedCoast}. ${headline.length} advisory zone(s) reported.`,
      [...new Set(all.map((a) => a.source))],
      ['RISK_VALIDATION_AGENT'],
    );
  },
);

const advisoryColor = (level: AdvisoryLevel): string =>
  level === 'RED' ? '#dc2626' : level === 'ORANGE' ? '#f97316' : level === 'YELLOW' ? '#eab308' : '#22c55e';

const TYPE_LABELS: Record<MarineAlert['type'], string> = {
  CYCLONE: 'cyclone watch',
  HIGH_WAVE: 'high-wave warning',
  STRONG_WIND: 'strong-wind advisory',
  SQUALL: 'squall warning',
  LIGHTNING: 'lightning advisory',
  TSUNAMI: 'tsunami advisory',
  STORM_SURGE: 'storm-surge watch',
  ROUGH_SEA: 'rough-sea warning',
};

export const labelFor = (type: MarineAlert['type']): string => TYPE_LABELS[type] ?? type;

export { ADVISORY_RISK };
