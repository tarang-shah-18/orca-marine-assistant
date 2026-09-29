/**
 * Ocean Agent — INCOIS Ocean State Forecast interpretation.
 *
 * Distinguishes the harbour observation from the offshore condition at the
 * user's actual position, because a boat asking about a fishing ground 40 km
 * out needs the amplified state, not the sheltered harbour reading.
 */

import {
  AgentContext,
  AgentDefinition,
  defineAgent,
  ev,
  finding,
  ok,
  publish,
  riskFromWaveHeight,
  slotsForHorizon,
  worst,
} from './base';
import { getOceanAt, getOceanState } from '../core/dataAccess';
import { haversineKm, roundTo } from '../core/geo';
import { seaStateWord } from '../core/i18n';

export const oceanAgent: AgentDefinition = defineAgent('OCEAN_AGENT', (context: AgentContext) => {
  const { book } = context;
  const offshoreKm = roundTo(haversineKm(context.harbor, context.position), 1);

  // At the harbour the station reading is authoritative; offshore we scale it.
  const ocean = getOceanAt(context.position.latitude, context.position.longitude, context.anchor.harborId);
  const station = getOceanState(context.anchor.harborId);
  context.artifacts.ocean = ocean;

  const window = slotsForHorizon(ocean.forecast, context.horizon);
  const windowSlots = window.length > 0 ? window : ocean.forecast.slice(0, 4);

  const maxWave = windowSlots.reduce((m, s) => Math.max(m, s.waveHeightMeters), ocean.waveHeightMeters);
  const maxCurrent = windowSlots.reduce((m, s) => Math.max(m, s.currentKnots), ocean.currentKnots);
  const sstRange = windowSlots.reduce(
    (acc, s) => ({ min: Math.min(acc.min, s.seaSurfaceTempCelsius), max: Math.max(acc.max, s.seaSurfaceTempCelsius) }),
    { min: Number.POSITIVE_INFINITY, max: -Number.POSITIVE_INFINITY },
  );

  const waveRisk = riskFromWaveHeight(maxWave);
  const vesselExceedance = maxWave > context.vessel.maxWaveHeightMeters;
  const severity = worst(waveRisk, ocean.seaStateCode >= 6 ? 'HIGH' : 'LOW');

  const findings = [
    finding(
      `Sea state at ${context.anchor.label}: significant wave height ${ocean.waveHeightMeters} m, ${seaStateWord(book, ocean.waveHeightMeters)} (Douglas code ${ocean.seaStateCode}), swell from the ${ocean.swellDirection} with a ${ocean.wavePeriodSeconds} s period, current ${ocean.currentKnots} kt towards the ${ocean.currentDirection}.`,
      {
        confidence: 0.85,
        riskLevel: waveRisk,
        evidence: [
          ev(book.labels.waves, `${ocean.waveHeightMeters} m`, ocean.source),
          ev('Sea state', `${seaStateWord(book, ocean.waveHeightMeters)} (code ${ocean.seaStateCode})`, ocean.source),
          ev('Swell', `${ocean.swellDirection} · ${ocean.wavePeriodSeconds} s`, ocean.source),
          ev('Current', `${ocean.currentKnots} kt ${ocean.currentDirection}`, ocean.source),
          ev(book.evidenceKeys.sst, `${ocean.seaSurfaceTempCelsius}° C`, ocean.source),
        ],
      },
    ),
  ];

  if (offshoreKm > 25) {
    findings.push(
      finding(
        `The reference position is ${offshoreKm} km offshore. Fetch amplification raises the effective wave height to about ${maxWave} m versus ${station.waveHeightMeters} m at ${context.anchor.label} itself — plan for the offshore figure, not the harbour one.`,
        {
          confidence: 0.75,
          evidence: [
            ev('Distance offshore', `${offshoreKm} km`, 'ORCA geodesic engine'),
            ev('Harbour reading', `${station.waveHeightMeters} m`, station.source),
          ],
        },
      ),
    );
  }

  findings.push(
    finding(
      `Across the window the worst sea is ${maxWave} m and the strongest current ${maxCurrent} kt, with SST between ${roundTo(sstRange.min === Number.POSITIVE_INFINITY ? ocean.seaSurfaceTempCelsius : sstRange.min, 1)}° C and ${roundTo(sstRange.max === -Number.POSITIVE_INFINITY ? ocean.seaSurfaceTempCelsius : sstRange.max, 1)}° C.`,
      {
        confidence: 0.8,
        riskLevel: waveRisk,
        evidence: [
          ev('Max wave in window', `${maxWave} m`, ocean.source),
          ev('Max current in window', `${maxCurrent} kt`, ocean.source),
        ],
      },
    ),
  );

  if (vesselExceedance) {
    findings.push(
      finding(
        `${maxWave} m exceeds the ${context.vessel.maxWaveHeightMeters} m freeboard limit for a ${context.vessel.label.toLowerCase()}. ${context.vessel.note}`,
        {
          confidence: 0.85,
          riskLevel: 'HIGH',
          evidence: [ev(book.evidenceKeys.vessel, context.vessel.label, 'ORCA vessel profile')],
        },
      ),
    );
  }

  context.artifacts.riskNotes = [
    ...(context.artifacts.riskNotes ?? []),
    {
      agent: 'OCEAN_AGENT',
      level: severity,
      reason: `Significant wave height ${maxWave} m (${seaStateWord(book, maxWave)}), current ${maxCurrent} kt.`,
    },
  ];

  publish(context, {
    id: 'viz-ocean',
    type: 'timeseries',
    title: book.labels.waves,
    subtitle: `Sea state · ${ocean.locationName}`,
    categories: windowSlots.map((s) => s.label),
    series: [
      { id: 'wave', label: book.labels.waves, color: '#0ea5e9', unit: 'm', points: windowSlots.map((s) => s.waveHeightMeters) },
      { id: 'period', label: 'Period (s)', color: '#a78bfa', unit: 's', points: windowSlots.map((s) => s.wavePeriodSeconds) },
      { id: 'current', label: 'Current (kt)', color: '#34d399', unit: 'kt', points: windowSlots.map((s) => s.currentKnots) },
    ],
  });

  return ok(
    findings,
    book.ui.oceanSummaryWord
      .replace('{waves}', book.labels.waves)
      .replace('{wave}', String(maxWave))
      .replace('{state}', seaStateWord(book, maxWave))
      .replace('{current}', String(maxCurrent))
      .replace('{sst}', String(ocean.seaSurfaceTempCelsius))
      .replace('{harbor}', context.anchor.label),
    [ocean.source],
    vesselExceedance ? ['RISK_VALIDATION_AGENT'] : [],
  );
});
