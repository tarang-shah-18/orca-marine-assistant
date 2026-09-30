/**
 * Weather Agent — IMD coastal marine meteorology.
 *
 * Works strictly to the requested time horizon: a "tomorrow" question is
 * answered from tomorrow's slots, never from the current observation, because
 * mixing the two is the classic way a marine forecast becomes unsafe.
 */

import { RiskLevel, WeatherData } from '../types';
import {
  AgentContext,
  AgentDefinition,
  defineAgent,
  ev,
  finding,
  ok,
  publish,
  riskFromWind,
  slotsForHorizon,
  worst,
} from './base';
import { getWeather } from '../core/dataAccess';
import { knotsToKmph, roundTo } from '../core/geo';
import { vesselName } from '../core/localize';

/** Gust factor applied to the sustained wind for small-craft planning. */
const GUST_FACTOR = 1.45;

export const weatherAgent: AgentDefinition = defineAgent('WEATHER_AGENT', (context: AgentContext) => {
  const weather = getWeather(context.anchor.harborId);
  context.artifacts.weather = weather;

  const slots = slotsForHorizon(weather.forecast, context.horizon);
  const window = slots.length > 0 ? slots : weather.forecast.slice(0, 4);

  const maxWind = window.reduce((m, s) => Math.max(m, s.windSpeedKnots), 0);
  const maxGust = window.reduce((m, s) => Math.max(m, s.gustKnots), 0);
  const maxRain = window.reduce((m, s) => Math.max(m, s.rainProbability), 0);
  const minVisibility = window.reduce((m, s) => Math.min(m, s.visibilityKm), Number.POSITIVE_INFINITY);
  const maxLightning = window.reduce<WeatherData['lightningRisk']>(
    (worstSoFar, s) => severityOfLightning(s.lightningRisk, worstSoFar),
    'LOW',
  );

  const windRisk = worst(riskFromWind(maxWind), riskFromWind(maxGust));
  const vesselExceedance = maxWind > context.vessel.maxWindKnots;
  const lightningRiskLevel: RiskLevel =
    maxLightning === 'HIGH' ? 'HIGH' : maxLightning === 'MODERATE' ? 'MODERATE' : 'LOW';

  const overallRisk = worst(windRisk, lightningRiskLevel, weather.squallWarning ? 'HIGH' : 'LOW');
  const overall = overallRisk === 'LOW' ? 'LOW' : overallRisk;

  const findings = [
    finding(
      `${context.book.labels.weather} for ${weather.locationName}: wind ${window[0].windSpeedKnots} kt (${weather.windSpeedKmph} km/h) from the ${weather.windDirection}, gusting ${maxGust} kt across the window, visibility down to ${minVisibility === Number.POSITIVE_INFINITY ? weather.visibilityKm : minVisibility} km, rain probability peaking at ${maxRain}%.`,
      {
        confidence: 0.85,
        riskLevel: windRisk,
        evidence: [
          ev(context.book.labels.wind, `${maxWind} kt (${roundTo(knotsToKmph(maxWind), 0)} km/h)`, weather.source),
          ev(context.book.evidenceKeys.gusts, `${maxGust} kt (${roundTo(knotsToKmph(maxGust), 0)} km/h)`, weather.source),
          ev('Visibility', `${minVisibility === Number.POSITIVE_INFINITY ? weather.visibilityKm : minVisibility} km`, weather.source),
          ev('Rain probability', `${maxRain}%`, weather.source),
          ev('Window', context.book.horizon[horizonIndex(context.horizon)], 'ORCA forecast window'),
        ],
      },
    ),
    finding(
      `${context.book.ui.lightningRiskWindowWord.replace('{risk}', maxLightning)} ${
        maxLightning === 'HIGH'
          ? context.book.ui.lightningConvectiveWord
          : maxLightning === 'MODERATE'
            ? context.book.ui.lightningIsolatedWord
            : context.book.ui.lightningNoneWord
      }`,
      {
        confidence: 0.75,
        riskLevel: lightningRiskLevel,
        evidence: [ev('Lightning risk', maxLightning, weather.source)],
      },
    ),
  ];

  if (weather.squallWarning) {
    findings.push(
      finding(
        `IMD has a squall in the bulletin for ${weather.locationName}. Squalls arrive with a sharp wind veer and can capsize small craft; treat this as a hard stop until the cell passes.`,
        {
          confidence: 0.9,
          riskLevel: 'HIGH',
          evidence: [ev('Squall', 'In force', weather.source)],
        },
      ),
    );
  }

  if (vesselExceedance) {
    findings.push(
      finding(
        `Peak wind of ${maxWind} kt exceeds the ${context.vessel.maxWindKnots} kt operational limit for a ${vesselName(context.vessel, context.book).label}. ${vesselName(context.vessel, context.book).note}`,
        {
          confidence: 0.85,
          riskLevel: 'HIGH',
          evidence: [ev(context.book.evidenceKeys.vessel, vesselName(context.vessel, context.book).label, 'ORCA vessel profile')],
        },
      ),
    );
    context.artifacts.riskNotes = [
      ...(context.artifacts.riskNotes ?? []),
      {
        agent: 'WEATHER_AGENT',
        level: 'HIGH',
        reason: `Forecast wind ${maxWind} kt exceeds the ${context.vessel.maxWindKnots} kt limit for this vessel.`,
      },
    ];
  }

  context.artifacts.riskNotes = [
    ...(context.artifacts.riskNotes ?? []),
    {
      agent: 'WEATHER_AGENT',
      level: overall,
      reason: `Wind ${maxWind} kt / gust ${maxGust} kt, lightning ${maxLightning}, rain ${maxRain}%.`,
    },
  ];

  publish(context, {
    id: 'viz-weather',
    type: 'timeseries',
    title: context.book.labels.weather,
    subtitle: `IMD coastal marine met · ${weather.locationName}`,
    categories: window.map((s) => s.label),
    series: [
      {
        id: 'wind',
        label: context.book.labels.wind,
        color: '#38bdf8',
        unit: 'kt',
        points: window.map((s) => s.windSpeedKnots),
      },
      {
        id: 'gust',
        label: context.book.evidenceKeys.gusts,
        color: '#f472b6',
        unit: 'kt',
        points: window.map((s) => s.gustKnots),
      },
      {
        id: 'rain',
        label: 'Rain',
        color: '#818cf8',
        unit: '%',
        points: window.map((s) => s.rainProbability),
      },
    ],
  });

  return ok(
    findings,
    context.book.ui.weatherSummaryWord
      .replace('{wind}', String(maxWind))
      .replace('{gust}', String(maxGust))
      .replace('{lightning}', maxLightning)
      .replace('{visibility}', String(minVisibility === Number.POSITIVE_INFINITY ? weather.visibilityKm : minVisibility))
      .replace('{horizon}', horizonWord(context)),
    [weather.source],
    overall === 'LOW' ? [] : ['MARINE_ALERT_AGENT'],
  );
});

const horizonIndex = (horizon: string): number =>
  ['NOW', 'TODAY', 'TOMORROW', 'NEXT_3_DAYS', 'WEEK'].indexOf(horizon) ?? 0;

const horizonWord = (context: AgentContext): string =>
  context.book.horizon[horizonIndex(context.horizon)];

function severityOfLightning(
  value: 'LOW' | 'MODERATE' | 'HIGH',
  incumbent: 'LOW' | 'MODERATE' | 'HIGH',
): 'LOW' | 'MODERATE' | 'HIGH' {
  const rank = { LOW: 0, MODERATE: 1, HIGH: 2 } as const;
  return rank[value] > rank[incumbent] ? value : incumbent;
}

/** Gust estimate for horizons beyond the forecast table. */
export const estimateGust = (sustainedKnots: number): number =>
  roundTo(sustainedKnots * GUST_FACTOR, 1);
