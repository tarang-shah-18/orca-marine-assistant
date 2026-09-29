/**
 * ORCA data-access seam.
 *
 * The agents and the data endpoints import their products from here instead of
 * `core/dataset.ts` directly. Every accessor is live-first: it returns the
 * real-time product from the warmed snapshot in `core/live.ts` when one exists,
 * and transparently falls back to the reference snapshot in `core/dataset.ts`
 * (flagged in the product's `source`/`observedAt`) when the live feed is
 * unreachable. Because the module re-exports every static product untouched,
 * switching an agent's import from `dataset` to `dataAccess` is a one-line
 * change that never alters the domain shapes.
 */

import * as base from './dataset';
import { roundTo, haversineKm, initialBearingDeg, compassPoint } from './geo';
import { LatLon } from './geo';
import {
  getLiveAlerts,
  getLiveHistorical,
  getLiveOcean,
  getLivePfzZones,
  getLiveWeather,
  liveHotspotsNear,
} from './live';
import {
  HistoricalPoint,
  MarineAlert,
  OceanData,
  PFZZone,
  ProductivityHotspot,
  WeatherData,
} from '../types';

/* Re-export every static product untouched (constants, stations, profiles,
 * the tide station and the shared arithmetic). Any getter overridden below
 * shadows its `base` twin. */
export * from './dataset';

/* ------------------------------------------------------------------ *
 * Weather
 * ------------------------------------------------------------------ */

export function getWeather(harborId: string): WeatherData {
  return getLiveWeather(harborId) ?? base.getWeather(harborId);
}

export function getWeatherNear(latitude: number, longitude: number): WeatherData {
  const live = getLiveWeather(base.findNearestHarbor(latitude, longitude).id);
  return live ?? base.getWeatherNear(latitude, longitude);
}

/* ------------------------------------------------------------------ *
 * Ocean state
 * ------------------------------------------------------------------ */

export function getOceanState(harborId: string): OceanData {
  return getLiveOcean(harborId) ?? base.getOceanState(harborId);
}

export function getOceanNear(latitude: number, longitude: number): OceanData {
  const live = getLiveOcean(base.findNearestHarbor(latitude, longitude).id);
  return live ?? base.getOceanNear(latitude, longitude);
}

/**
 * Sea state at an arbitrary offshore point. With a live snapshot the harbour
 * observation is still anchored to the model fetch point, and the same
 * fetch/sweep amplification ORCA always applied offshore is applied on top.
 */
export function getOceanAt(
  latitude: number,
  longitude: number,
  harborId?: string,
): OceanData {
  const harbor = base.HARBOR_BY_ID[harborId ?? base.findNearestHarbor(latitude, longitude).id];
  const live = getLiveOcean(harbor.id);
  const anchor = live ?? base.getOceanState(harbor.id);
  const offshoreKm = haversineKm(harbor, { latitude, longitude });
  const amplification = Math.min(1.9, Math.max(1, 1 + (offshoreKm / 100) * 0.35));
  const wave = Math.min(8, Math.max(0.1, anchor.waveHeightMeters * amplification));
  const sea = base.describeSeaState(wave);
  return {
    ...anchor,
    waveHeightMeters: roundTo(wave, 1),
    seaStateCode: sea.code,
    seaCondition: sea.text,
  };
}

/* ------------------------------------------------------------------ *
 * Fishing grounds
 * ------------------------------------------------------------------ */

export function getPfzZonesNear(latitude: number, longitude: number): PFZZone[] {
  const live = getLivePfzZones();
  const origin: LatLon = { latitude, longitude };
  const zones =
    live ??
    (base.getPfzZonesNear(latitude, longitude).map((z) => {
      const { distanceKm, bearing, ...rest } = z;
      return rest;
    }) as unknown as Array<Omit<PFZZone, 'distanceKm' | 'bearing'>>);

  return zones
    .map((zone) => {
      const distanceKm = roundTo(haversineKm(origin, zone), 1);
      const bearingDeg = initialBearingDeg(origin, zone);
      return {
        ...zone,
        distanceKm,
        bearing: `${compassPoint(bearingDeg)} (${Math.round(bearingDeg)}°)`,
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function getNearestPfz(latitude: number, longitude: number): PFZZone {
  return getPfzZonesNear(latitude, longitude)[0];
}

/** Live-hotspot grid scan result, reduced to the productivity-grid contract. */
export function getProductivityGrid(
  center: { latitude: number; longitude: number },
  _spanKm = 200,
  _step = 4,
): Array<{ latitude: number; longitude: number; chlorophyllMgM3: number; sstCelsius: number; sstAnomalyC: number }> {
  // Live hotspot cells are grown around the harbour that refreshed them; only
  // the ones within scanning reach of the queried centre belong in this grid.
  const live = getLiveHotspotsNear(center);
  if (live.length > 0) {
    return live.map((h) => ({
      latitude: h.latitude,
      longitude: h.longitude,
      chlorophyllMgM3: h.chlorophyllMgM3,
      sstCelsius: h.sstCelsius,
      sstAnomalyC: h.sstAnomalyC,
    }));
  }
  return base.getProductivityGrid(center, _spanKm, _step);
}

export function getLiveHotspotsNear(center: { latitude: number; longitude: number }): ProductivityHotspot[] {
  return liveHotspotsNear(center);
}

/* ------------------------------------------------------------------ *
 * Alerts
 * ------------------------------------------------------------------ */

export function getMarineAlertsNear(latitude: number, longitude: number): MarineAlert[] {
  const baseAlerts = base.getMarineAlertsNear(latitude, longitude);
  const live = getLiveAlerts(latitude, longitude);
  if (!live) return baseAlerts;

  const origin: LatLon = { latitude, longitude };
  const liveComputed = live.map((alert) => {
    const center = alert.geometry?.center ?? {
      latitude: alert.geometry?.polygon?.[0]?.[0] ?? latitude,
      longitude: alert.geometry?.polygon?.[0]?.[1] ?? longitude,
    };
    const distanceKm = roundTo(haversineKm(origin, center), 1);
    const bearingDeg = initialBearingDeg(origin, center);
    const radiusKm = alert.geometry?.radiusKm ?? 150;
    return {
      ...alert,
      distanceKm,
      bearing: `${compassPoint(bearingDeg)} (${Math.round(bearingDeg)}°)`,
      withinInfluence: distanceKm <= radiusKm,
    };
  });

  // The reference bulletins are region-scoped (Kerala high waves, Konkan
  // lightning, Saurashtra storm surge, …): each region must keep its local
  // warnings even while the live scan is running. Live events are layered on
  // top of the reference set instead of replacing it, with the live id winning
  // on a collision; both lists are already anchored to the query position.
  const merged = new Map<string, MarineAlert>();
  for (const alert of baseAlerts) merged.set(alert.id, alert);
  for (const alert of liveComputed) merged.set(alert.id, alert);

  return [...merged.values()].sort((a, b) => a.distanceKm - b.distanceKm);
}

/* ------------------------------------------------------------------ *
 * Historical productivity series
 * ------------------------------------------------------------------ */

export function getHistoricalSeries(region: string, months = 36): HistoricalPoint[] {
  const live = getLiveHistorical(region);
  if (live) {
    const series = live.slice(-months);
    return series.length === months
      ? series
      : series.length >= Math.min(12, months)
        ? series
        : base.getHistoricalSeries(region, months);
  }
  return base.getHistoricalSeries(region, months);
}