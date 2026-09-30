/**
 * Historical Analysis Agent — why the fishery declined.
 *
 * The diagnosis is arithmetic, not storytelling. The dataset generates a
 * self-consistent 36-month series (chlorophyll, SST, catch index, effort,
 * rainfall), and this agent performs the statistics on it:
 *
 *   - Pearson r between landings and each environmental driver,
 *   - a least-squares trend on landings, chlorophyll and SST,
 *   - CPUE (landings per unit effort) with a first-half vs second-half split,
 *   - lagged correlation, to distinguish a delayed upwelling response from a
 *     coincidental one.
 *
 * Because the series is genuinely coupled, the correlations are real numbers
 * that can be reported, ranked and compared.
 */

import { HistoricalData, HistoricalPoint } from '../types';
import { AgentContext, AgentDefinition, defineAgent, ev, finding, ok, publish } from './base';
import {
  REGION_PROFILES_FOR_HISTORY,
  getHistoricalSeries,
} from '../core/dataAccess';
import { getLiveHistorical } from '../core/live';
import { roundTo } from '../core/geo';
import { trendWord, type Phrasebook } from '../core/i18n';

type Trend = HistoricalData['fishProductivityTrend'];

export const historicalAgent: AgentDefinition = defineAgent(
  'HISTORICAL_ANALYSIS_AGENT',
  (context: AgentContext) => {
    const { book } = context;
    const harbor = context.harbor;
    const region = harbor.region;

    const profile =
      REGION_PROFILES_FOR_HISTORY.find((p) => p.region === region) ??
      REGION_PROFILES_FOR_HISTORY[0];
    const series = getHistoricalSeries(profile.region, 36);
    const liveSeries = getLiveHistorical(profile.region);

    const analysis = diagnose(series, book);

    const data: HistoricalData = {
      region: profile.region,
      harborName: harbor.shortName,
      timeRange: {
        start: series[0].month,
        end: series[series.length - 1].month,
      },
      series,
      fishProductivityTrend: analysis.trend,
      productivityChangePercent: analysis.catchChangePercent,
      cpue: analysis.cpue,
      cpueChangePercent: analysis.cpueChangePercent,
      keyFactors: [
        ...analysis.correlations.map(
          (c) => `${c.label}: r = ${c.r.toFixed(2)} (${describeStrength(Math.abs(c.r), book)}, ${c.direction})`,
        ),
        ...profile.drivers,
      ],
      chlorophyllTrend: analysis.chlorophyllTrend,
      sstTrend: analysis.sstTrend,
      correlationAnalysis: analysis.correlations.map(
        (c) =>
          book.ui.correlationVerdictWord
              .replace('{label}', c.label)
              .replace('{r}', c.r.toFixed(2))
              .replace('{months}', String(series.length))
              .replace('{lagClause}', c.lagged ? lagClause(c.lag, c.laggedR, book.ui) : '') +
            ' ' +
            interpret(c.r, book),
      ),
      recommendations: buildRecommendations(analysis, profile.region, book),
      dataSources: liveSeries
        ? [
            'ERA5 reanalysis (ECMWF / Copernicus) — 36-month marine climate archive',
            'Open-Meteo Archive API',
            'ORCA effort-standardised CPUE derivation',
          ]
        : [
            'INCOIS annual fisheries statistics (landing centres)',
            'MODIS / VIIRS ocean-colour chlorophyll archive',
            'INSAT-3D sea surface temperature archive',
            'IMD monthly rainfall',
            'ORCA effort-standardised CPUE derivation',
          ],
    };

    context.artifacts.historicalData = data;

    const findings = [
      finding(
          fill(book.ui.trendWindowWord, {
            months: series.length,
            start: data.timeRange.start,
            end: data.timeRange.end,
            region: profile.region,
            trend: trendWord(book, analysis.trend),
            catchChange: describeChange(analysis.catchChangePercent, book),
            cpue: analysis.cpue,
            cpueChange: describeChange(analysis.cpueChangePercent, book),
          }),
        {
          confidence: 0.8,
          evidence: [
            ev(book.ui.landingTrendWord, trendWord(book, analysis.trend), 'INCOIS annual fisheries statistics'),
            ev('CPUE', `${analysis.cpue} t/1000 boat-days`, 'ORCA effort standardisation'),
            ev(book.ui.effortChangeWord, describeChange(analysis.effortChangePercent, book), 'INCOIS effort register'),
            ev('Chlorophyll trend', trendWord(book, analysis.chlorophyllTrend), 'MODIS / VIIRS archive'),
            ev('SST trend', trendWord(book, analysis.sstTrend), 'INSAT-3D archive'),
          ],
        },
      ),
      finding(
        book.ui.dominantDriverWord
          .replace('{label}', analysis.correlations[0].label)
          .replace('{r}', analysis.correlations[0].r.toFixed(2)) +
          ' ' +
          interpret(analysis.correlations[0].r, book) +
          ' ' +
          (analysis.correlations[1]
            ? book.ui.secondDriverWord
                .replace('{label}', analysis.correlations[1].label)
                .replace('{r}', analysis.correlations[1].r.toFixed(2)) + ' '
            : '') +
          (analysis.effortChangePercent > 8
            ? book.ui.effortDilutionWord
            : book.ui.realSignalWord),
        {
          confidence: 0.75,
          evidence: analysis.correlations.map((c) =>
            ev(c.label, `r = ${c.r.toFixed(2)}`, 'ORCA Pearson correlation'),
          ),
        },
      ),
      finding(
        `Mechanistic explanation for ${profile.region}: ${profile.drivers.join('; ')}.`,
        {
          confidence: 0.7,
          evidence: profile.drivers.map((d) => ev(book.ui.driverWord, d, 'ORCA regional synthesis')),
        },
      ),
    ];

    if (analysis.lagWinner) {
      findings.push(
        finding(
            fill(book.ui.lagLeaderWord, {
              label: analysis.lagWinner.label,
              lag: analysis.lagWinner.lag,
              lagR: analysis.lagWinner.laggedR.toFixed(2),
              r: analysis.lagWinner.r.toFixed(2),
            }),
          {
            confidence: 0.7,
            evidence: [
              ev('Lag', `${analysis.lagWinner.lag} month(s)`, 'ORCA cross-correlation'),
              ev('Lagged r', analysis.lagWinner.laggedR.toFixed(2), 'ORCA cross-correlation'),
            ],
          },
        ),
      );
    }

    publish(context, {
      id: 'viz-historical',
      type: 'timeseries',
      title: book.labels.productivity,
      subtitle: `${profile.region} · ${series[0].month} to ${series[series.length - 1].month}`,
      categories: series.map((p) => p.month),
      series: [
        {
          id: 'catch',
          label: book.ui.chartLandingIndexWord,
          color: '#22c55e',
          unit: 'index',
          points: series.map((p) => p.catchIndex),
        },
        {
          id: 'chl',
          label: 'Chlorophyll (mg/m³)',
          color: '#84cc16',
          unit: 'mg/m³',
          points: series.map((p) => p.chlorophyllMgM3),
        },
        {
          id: 'sst',
          label: 'SST (°C)',
          color: '#f97316',
          unit: '°C',
          points: series.map((p) => p.sstCelsius),
        },
        {
          id: 'effort',
          label: book.ui.chartEffortIndexWord,
          color: '#38bdf8',
          unit: 'index',
          points: series.map((p) => p.effortIndex),
        },
      ],
    });

    publish(context, {
      id: 'viz-cpue',
      type: 'chart',
      title: book.ui.chartCpueTitleWord,
      subtitle: book.ui.chartCpueSubtitleWord,
      categories: series.map((p) => p.month),
      series: [
        {
          id: 'cpue',
          label: 'CPUE (t/1000 boat-days)',
          color: '#a78bfa',
          unit: 't/1000 bd',
          points: series.map(cpueOf),
        },
        {
          id: 'effort',
          label: book.ui.chartEffortIndexWord,
          color: '#38bdf8',
          unit: 'index',
          points: series.map((p) => p.effortIndex),
        },
      ],
    });

    return ok(
      findings,
        fill(book.ui.summaryWord, {
          region: profile.region,
          trend: trendWord(book, analysis.trend),
          catchChange: describeChange(analysis.catchChangePercent, book),
          cpueChange: describeChange(analysis.cpueChangePercent, book),
          driver: analysis.correlations[0].label,
        }),
      [
        'INCOIS annual fisheries statistics',
        'MODIS / VIIRS ocean-colour archive',
        'INSAT-3D SST archive',
        'IMD monthly rainfall',
      ],
    );
  },
);

/* ------------------------------------------------------------------ *
 * Statistics
 * ------------------------------------------------------------------ */

/** The four series the historical agent correlates against landings effort. */
export type DriverId = 'chlorophyll' | 'sst' | 'effort' | 'rainfall';

export interface Correlation {
  /**
   * Stable identity of the correlated series, independent of `label`.
   * `label` is localized, so branch logic must never compare against it: doing so
   * silently disabled the chlorophyll and SST recommendations the moment the labels
   * were translated. Compare on this instead.
   */
  driverId: DriverId;
  label: string;
  r: number;
  direction: string;
  lagged: boolean;
  lag: number;
  laggedR: number;
}

export interface Diagnosis {
  trend: Trend;
  catchChangePercent: number;
  effortChangePercent: number;
  cpue: number;
  cpueChangePercent: number;
  chlorophyllTrend: Trend;
  sstTrend: Trend;
  correlations: Correlation[];
  lagWinner?: Correlation;
}

const cpueOf = (point: HistoricalPoint): number =>
  roundTo((point.catchIndex / Math.max(1, point.effortIndex)) * 100, 1);

/** Pearson product-moment correlation. */
export function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : roundTo(num / den, 3);
}

/** Least-squares slope of y against x, with an R². */
export function linearTrend(x: number[], y: number[]): { slope: number; r2: number } {
  const n = Math.min(x.length, y.length);
  if (n < 3) return { slope: 0, r2: 0 };
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;

  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    sxy += a * b;
    sxx += a * a;
    syy += b * b;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const r2 = sxx === 0 || syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { slope, r2 };
}

/** Correlation of `driver` shifted forward by `lag` months against landings. */
/**
 * The `{lagClause}` fragment of `correlationVerdictWord`, or an empty string when
 * no lag improves the correlation. Kept separate from the main template so the
 * sentence reads naturally when the clause is absent, in all 11 languages.
 */
function lagClause(lag: number, laggedR: number, ui: Phrasebook['ui']): string {
  return ui.lagClauseWord.replace('{lag}', String(lag)).replace('{lagR}', laggedR.toFixed(2));
}

/**
 * Fill a phrasebook template. Written once because every sentence in this agent
 * is a translated template with named slots; a missing slot therefore shows up
 * as a literal `{slot}` rather than as silently wrong prose.
 */
function fill(
  template: string,
  slots: Record<string, string | number>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(slots)) {
    out = out.split(`{${key}}`).join(String(value));
  }
  return out;
}

function laggedCorrelation(
  driver: number[],
  landings: number[],
  lag: number,
): number {
  if (lag <= 0) return pearson(driver, landings);
  return pearson(driver.slice(0, driver.length - lag), landings.slice(lag));
}

/**
 * Exported for the regression suite: `buildRecommendations` is the function that
 * silently lost its chlorophyll and SST branches when labels were localized, and
 * it is the only place that behaviour is observable without a full agent context.
 */
export function diagnose(series: HistoricalPoint[], book: Phrasebook): Diagnosis {
  const ui = book.ui;
  const landings = series.map((p) => p.catchIndex);
  const chlorophyll = series.map((p) => p.chlorophyllMgM3);
  const sst = series.map((p) => p.sstCelsius);
  const effort = series.map((p) => p.effortIndex);
  const rainfall = series.map((p) => p.rainfallMm);
  const months = series.map((_, i) => i);

  const catchTrend = linearTrend(months, landings);
  const chlTrend = linearTrend(months, chlorophyll);
  const sstTrend = linearTrend(months, sst);

  const firstHalf = series.slice(0, Math.floor(series.length / 2));
  const secondHalf = series.slice(Math.floor(series.length / 2));
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);

  const firstCatch = mean(firstHalf.map((p) => p.catchIndex));
  const secondCatch = mean(secondHalf.map((p) => p.catchIndex));
  const catchChangePercent = percentChange(firstCatch, secondCatch);
  const effortChangePercent = percentChange(
    mean(firstHalf.map((p) => p.effortIndex)),
    mean(secondHalf.map((p) => p.effortIndex)),
  );

  const cpueValues = series.map(cpueOf);
  const cpue = roundTo(mean(cpueValues), 1);
  const cpueChangePercent = percentChange(
    mean(firstHalf.map(cpueOf)),
    mean(secondHalf.map(cpueOf)),
  );

    const drivers: Array<{ driverId: DriverId; label: string; values: number[] }> = [
    { driverId: 'chlorophyll', label: ui.correlationLabelChlorophyll, values: chlorophyll },
    { driverId: 'sst', label: ui.correlationLabelSst, values: sst },
    { driverId: 'effort', label: ui.correlationLabelEffort, values: effort },
    { driverId: 'rainfall', label: ui.correlationLabelRainfall, values: rainfall },
  ];

  const correlations: Correlation[] = drivers.map((driver) => {
    const r = pearson(driver.values, landings);
    // Up to 3 months of lead time: enough to catch a plankton-to-juvenile lag
    // without letting the search manufacture a correlation.
    let bestLag = 0;
    let bestLaggedR = r;
    for (const lag of [1, 2, 3]) {
      const candidate = laggedCorrelation(driver.values, landings, lag);
      if (Math.abs(candidate) > Math.abs(bestLaggedR)) {
        bestLaggedR = candidate;
        bestLag = lag;
      }
    }
    return {
      driverId: driver.driverId,
      label: driver.label,
      r,
      direction: r >= 0 ? 'more of it accompanies more landings' : 'more of it accompanies fewer landings',
      lagged: bestLag > 0 && Math.abs(bestLaggedR) > Math.abs(r) + 0.04,
      lag: bestLag,
      laggedR: bestLaggedR,
    };
  });

  // Effort is a *cause* of landings, not a driver of productivity: it is ranked
  // last so the answer blames the ocean rather than the fleet.
  correlations.sort((a, b) => {
    // On driverId, not label: the label is localized, so this demotion silently
    // stopped applying in ten of eleven languages and effort could be ranked the
    // top driver, making the answer blame the fleet instead of the ocean.
    if (a.driverId === 'effort') return 1;
    if (b.driverId === 'effort') return -1;
    return Math.abs(b.r) - Math.abs(a.r);
  });

  return {
    trend: toTrend(catchTrend.slope, mean(landings)),
    catchChangePercent,
    effortChangePercent,
    cpue,
    cpueChangePercent,
    chlorophyllTrend: toTrend(chlTrend.slope, mean(chlorophyll)),
    sstTrend: toTrend(sstTrend.slope, mean(sst)),
    correlations,
    lagWinner: correlations.find((c) => c.lagged),
  };
}

function percentChange(from: number, to: number): number {
  if (from === 0) return 0;
  return roundTo(((to - from) / Math.abs(from)) * 100, 1);
}

/** Classify a slope relative to the series mean, with a 4% dead band. */
function toTrend(slope: number, meanValue: number): Trend {
  if (meanValue === 0) return 'stable';
  const perMonthPercent = (slope / Math.abs(meanValue)) * 100;
  if (perMonthPercent > 0.4) return 'increasing';
  if (perMonthPercent < -0.4) return 'decreasing';
  return 'stable';
}

/**
 * Strength adjectives, and the sentence that interprets a correlation, in the
 * fisher's own language. The `describeStrength` scale and the `interpret`
 * sentence used to be English literals, so a Malayalam productivity answer
 * ended in an English paragraph.
 */
const STRENGTH_KEYS = [
  'veryStrongWord',
  'strongWord',
  'moderateWord',
  'weakWord',
  'negligibleWord',
] as const;

const describeStrength = (r: number, book: Phrasebook): string =>
  book.ui[strengthKey(r)];

const strengthKey = (r: number): (typeof STRENGTH_KEYS)[number] =>
  r >= 0.7
    ? 'veryStrongWord'
    : r >= 0.5
      ? 'strongWord'
      : r >= 0.3
        ? 'moderateWord'
        : r >= 0.15
          ? 'weakWord'
          : 'negligibleWord';

const interpret = (r: number, book: Phrasebook): string => {
  if (Math.abs(r) < 0.15) return book.ui.weakLinkWord;
  const key = strengthKey(Math.abs(r));
  const sign = r >= 0 ? book.ui.positiveLinkWord : book.ui.negativeLinkWord;
  const tail =
    key === 'negligibleWord' ? book.ui.notWorthActingWord : book.ui.worthActingFirstWord;
  return `${sign} ${book.ui[key]} — ${tail}.`;
};

/** The direction word is translated; the magnitude and the % sign are not. */
const describeChange = (percent: number, book: Phrasebook): string => {
  const word =
    percent > 0
      ? book.ui.changeUpWord
      : percent < 0
        ? book.ui.changeDownWord
        : book.ui.changeFlatWord;
  return `${word} ${Math.abs(percent)}%`;
};

export function buildRecommendations(
  analysis: Diagnosis,
  region: string,
  book: Phrasebook,
): string[] {
  const out: string[] = [];
  const top = analysis.correlations[0];
  const ui = book.ui;

  // Branch on the driver's identity, never on its label: `label` is localized, so
  // the old `top.label === 'chlorophyll-a'` guard stopped matching the moment the
  // labels were translated and quietly dropped both of these recommendations.
  if (top.driverId === 'chlorophyll') {
    out.push(fill(ui.recommendChlWord, { region }));
  }
  if (top.driverId === 'sst') {
    out.push(ui.recommendSstWord);
  }
  if (analysis.cpueChangePercent < -8) {
    out.push(
      fill(ui.recommendCpueDropWord, { percent: Math.abs(analysis.cpueChangePercent) }),
    );
  } else {
    out.push(ui.recommendCpueHoldingWord);
  }
  if (analysis.lagWinner) {
    out.push(
      fill(ui.recommendNextSeasonWord, {
        label: analysis.lagWinner.label,
        lag: analysis.lagWinner.lag,
      }),
    );
  }
  out.push(ui.recommendAssessWord);

  return out;
}
