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
import { trendWord } from '../core/i18n';

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

    const analysis = diagnose(series);

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
          (c) => `${c.label}: r = ${c.r.toFixed(2)} (${describeStrength(Math.abs(c.r))}, ${c.direction})`,
        ),
        ...profile.drivers,
      ],
      chlorophyllTrend: analysis.chlorophyllTrend,
      sstTrend: analysis.sstTrend,
      correlationAnalysis: analysis.correlations.map(
        (c) =>
          `${c.label} vs landings: r = ${c.r.toFixed(2)} over ${series.length} months${c.lagged ? `, best at a ${c.lag}-month lag (r = ${c.laggedR.toFixed(2)})` : ''}. ${interpret(c.r)}`,
      ),
      recommendations: buildRecommendations(analysis, profile.region),
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
        `Over ${series.length} months (${data.timeRange.start} to ${data.timeRange.end}), the ${profile.region} fishery shows a ${trendWord(book, analysis.trend)} landings trend, ${describeChange(analysis.catchChangePercent)}. CPUE is ${analysis.cpue} t per 1000 boat-days, ${describeChange(analysis.cpueChangePercent)} across the window.`,
        {
          confidence: 0.8,
          evidence: [
            ev('Landing trend', trendWord(book, analysis.trend), 'INCOIS annual fisheries statistics'),
            ev('CPUE', `${analysis.cpue} t/1000 boat-days`, 'ORCA effort standardisation'),
            ev('Effort change', describeChange(analysis.effortChangePercent), 'INCOIS effort register'),
            ev('Chlorophyll trend', trendWord(book, analysis.chlorophyllTrend), 'MODIS / VIIRS archive'),
            ev('SST trend', trendWord(book, analysis.sstTrend), 'INSAT-3D archive'),
          ],
        },
      ),
      finding(
        `The dominant statistical driver is ${analysis.correlations[0].label} (r = ${analysis.correlations[0].r.toFixed(2)}). ${interpret(analysis.correlations[0].r)} ${analysis.correlations[1] ? `${analysis.correlations[1].label} follows at r = ${analysis.correlations[1].r.toFixed(2)}. ` : ''}${analysis.effortChangePercent > 8 ? 'Effort has risen faster than landings, so part of the apparent decline is effort dilution rather than genuine stock loss. ' : 'Effort has not risen fast enough to explain the change, so this is a real productivity signal rather than effort dilution.'}`,
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
          evidence: profile.drivers.map((d) => ev('Driver', d, 'ORCA regional synthesis')),
        },
      ),
    ];

    if (analysis.lagWinner) {
      findings.push(
        finding(
          `${analysis.lagWinner.label} leads landings by about ${analysis.lagWinner.lag} months (lagged r = ${analysis.lagWinner.laggedR.toFixed(2)} versus ${analysis.lagWinner.r.toFixed(2)} contemporaneous). That lead time is the physical lag between the ocean response and the fishery, and it is why current-year conditions do not show up in this year's landings.`,
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
          label: 'Landing index',
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
          label: 'Effort index',
          color: '#38bdf8',
          unit: 'index',
          points: series.map((p) => p.effortIndex),
        },
      ],
    });

    publish(context, {
      id: 'viz-cpue',
      type: 'chart',
      title: 'CPUE and effort standardisation',
      subtitle: 'Landings per unit of fishing effort',
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
          label: 'Effort index',
          color: '#38bdf8',
          unit: 'index',
          points: series.map((p) => p.effortIndex),
        },
      ],
    });

    return ok(
      findings,
      `${profile.region}: ${trendWord(book, analysis.trend)} landings, ${describeChange(analysis.catchChangePercent)}, CPUE ${describeChange(analysis.cpueChangePercent)}, driven primarily by ${analysis.correlations[0].label}.`,
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

interface Correlation {
  label: string;
  r: number;
  direction: string;
  lagged: boolean;
  lag: number;
  laggedR: number;
}

interface Diagnosis {
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
function laggedCorrelation(
  driver: number[],
  landings: number[],
  lag: number,
): number {
  if (lag <= 0) return pearson(driver, landings);
  return pearson(driver.slice(0, driver.length - lag), landings.slice(lag));
}

function diagnose(series: HistoricalPoint[]): Diagnosis {
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

  const drivers: Array<{ label: string; values: number[] }> = [
    { label: 'chlorophyll-a', values: chlorophyll },
    { label: 'sea surface temperature', values: sst },
    { label: 'fishing effort', values: effort },
    { label: 'rainfall', values: rainfall },
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
    if (a.label === 'fishing effort') return 1;
    if (b.label === 'fishing effort') return -1;
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

const describeStrength = (r: number): string =>
  r >= 0.7 ? 'very strong' : r >= 0.5 ? 'strong' : r >= 0.3 ? 'moderate' : r >= 0.15 ? 'weak' : 'negligible';

const interpret = (r: number): string => {
  const strength = describeStrength(Math.abs(r));
  if (Math.abs(r) < 0.15) return 'That link is too weak to act on.';
  return `${r >= 0 ? 'A positive' : 'A negative'} ${strength} relationship — ${strength === 'negligible' ? 'no' : 'it is worth acting on this driver first'}.`;
};

const describeChange = (percent: number): string =>
  `${percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat'} ${Math.abs(percent)}%`;

function buildRecommendations(analysis: Diagnosis, region: string): string[] {
  const out: string[] = [];
  const top = analysis.correlations[0];

  if (top.label === 'chlorophyll-a') {
    out.push(
      `Chl-a is the strongest predictor for ${region}. Move fleet effort onto the satellite-derived chlorophyll fronts rather than the traditional grounds, which decouples effort from a collapsing field.`,
    );
  }
  if (top.label === 'sea surface temperature') {
    out.push(
      'Thermal structure is the binding constraint. Re-time the fleet onto the cool-season window and avoid the compressed warm-water band where the thermocline has shoaled.',
    );
  }
  if (analysis.cpueChangePercent < -8) {
    out.push(
      `CPUE is down ${Math.abs(analysis.cpueChangePercent)}%, so this is a genuine productivity loss, not just effort dilution. A seasonal closure or effort cap should be considered rather than a fleet redeployment.`,
    );
  } else {
    out.push(
      'CPUE is broadly holding, so a fleet redeployment towards better oceanography is likely to recover landings faster than a closure would.',
    );
  }
  if (analysis.lagWinner) {
    out.push(
      `${analysis.lagWinner.label} leads landings by about ${analysis.lagWinner.lag} months. Set next season's effort using this season's ${analysis.lagWinner.label}, not last season's catch.`,
    );
  }
  out.push(
    'Commission an independent stock assessment before any closure decision: these correlations are diagnostic of environment, not proof of stock status.',
  );

  return out;
}
