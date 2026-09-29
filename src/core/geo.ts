/**
 * Geodesy & computational geometry utilities for ORCA.
 *
 * Shared by the Express server and the browser bundle, so this module must stay
 * dependency-free and side-effect free.
 *
 * Reference ellipsoid values follow WGS-84 mean sphere approximation, which is
 * accurate to ~0.3% over the distances ORCA reasons about (<= 500 km), which is
 * well inside the tolerance demanded by the INCOIS PFZ advisory product.
 */

export const EARTH_RADIUS_KM = 6371.0088;
export const KM_PER_NAUTICAL_MILE = 1.852;
export const KNOTS_TO_KMPH = 1.852;

export interface LatLon {
  latitude: number;
  longitude: number;
}

export interface LatLonBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
export const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const;

export const COMPASS_POINTS_16 = COMPASS_POINTS;
export const COMPASS_POINTS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Great-circle distance in kilometres between two coordinates. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial great-circle bearing in degrees (0-360, clockwise from true north). */
export function initialBearingDeg(a: LatLon, b: LatLon): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** Map a bearing in degrees onto one of the 16-point compass rose labels. */
export function compassPoint(degrees: number, points: readonly string[] = COMPASS_POINTS): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const step = 360 / points.length;
  const index = Math.round(normalized / step) % points.length;
  return points[index];
}

/** Human readable bearing, e.g. `WSW (248°)`. */
export function formatBearing(degrees: number): string {
  return `${compassPoint(degrees)} (${Math.round(((degrees % 360) + 360) % 360)}°)`;
}

/** Point reached by travelling `distanceKm` from `origin` on `bearingDeg`. */
export function destinationPoint(origin: LatLon, bearingDeg: number, distanceKm: number): LatLon {
  const angular = distanceKm / EARTH_RADIUS_KM;
  const bearing = toRadians(bearingDeg);
  const lat1 = toRadians(origin.latitude);
  const lon1 = toRadians(origin.longitude);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    latitude: toDegrees(lat2),
    longitude: ((toDegrees(lon2) + 540) % 360) - 180,
  };
}

/** Point at `fraction` (0-1) along the great circle joining `a` to `b`. */
export function interpolateGreatCircle(a: LatLon, b: LatLon, fraction: number): LatLon {
  const clamped = Math.max(0, Math.min(1, fraction));
  const lat1 = toRadians(a.latitude);
  const lon1 = toRadians(a.longitude);
  const lat2 = toRadians(b.latitude);
  const lon2 = toRadians(b.longitude);

  const d =
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin((lat2 - lat1) / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
        ),
      ),
    );

  if (d === 0) return { ...a };

  const sinD = Math.sin(d);
  const A = Math.sin((1 - clamped) * d) / sinD;
  const B = Math.sin(clamped * d) / sinD;

  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);

  return {
    latitude: toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y))),
    longitude: toDegrees(Math.atan2(y, x)),
  };
}

/**
 * Densify a great circle into `steps + 1` evenly spaced waypoints.
 * Used by the route agent so hazard cells can be tested along the whole track
 * rather than only at the midpoint.
 */
export function greatCirclePath(a: LatLon, b: LatLon, steps = 12): LatLon[] {
  const points: LatLon[] = [];
  for (let i = 0; i <= steps; i++) {
    points.push(interpolateGreatCircle(a, b, i / steps));
  }
  return points;
}

/** Cumulative length of a polyline in kilometres. */
export function pathLengthKm(points: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return total;
}

/** Perpendicular distance (km) from `p` to the geodesic segment `a`-`b`. */
export function distanceToSegmentKm(p: LatLon, a: LatLon, b: LatLon): number {
  // Equirectangular projection is accurate enough for short segments and is
  // numerically stable near the poles compared to naive great-circle maths.
  // One degree of latitude is exactly 60 nautical miles (~111.12 km); the
  // longitude scale shrinks by cos(lat). This is the step that keeps the
  // returned distance in real kilometres — dropping the 60 would make every
  // distance come out ~60x too small, which once turned a boundary 1000 km
  // away into a "0 km" violation.
  const KM_PER_DEGREE = 60 * KM_PER_NAUTICAL_MILE;
  const latRef = toRadians((a.latitude + b.latitude) / 2);
  const kx = Math.cos(latRef) * KM_PER_DEGREE;

  const ax = a.longitude * kx;
  const ay = a.latitude * KM_PER_DEGREE;
  const bx = b.longitude * kx;
  const by = b.latitude * KM_PER_DEGREE;
  const px = p.longitude * kx;
  const py = p.latitude * KM_PER_DEGREE;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) return haversineKm(p, a);

  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Ray-casting point-in-polygon test. Polygon is `[lat, lon][ ]` or `LatLon[]`. */
export function pointInPolygon(
  point: LatLon,
  polygon: Array<[number, number]> | LatLon[],
): boolean {
  const ring = normaliseRing(polygon);
  if (ring.length < 3) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    const intersects =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Shortest distance (km) from a point to a polygon's boundary. */
export function distanceToPolygonKm(
  point: LatLon,
  polygon: Array<[number, number]> | LatLon[],
): number {
  const ring = normaliseRing(polygon);
  if (ring.length < 2) return Number.POSITIVE_INFINITY;

  let min = Number.POSITIVE_INFINITY;
  for (let i = 1; i < ring.length; i++) {
    const a = { latitude: ring[i - 1][0], longitude: ring[i - 1][1] };
    const b = { latitude: ring[i][0], longitude: ring[i][1] };
    min = Math.min(min, distanceToSegmentKm(point, a, b));
  }
  return min;
}

/** Spherical centroid of a polygon, used to label zones on the map. */
export function polygonCentroid(
  polygon: Array<[number, number]> | LatLon[],
): LatLon {
  const ring = normaliseRing(polygon);
  if (ring.length === 0) return { latitude: 0, longitude: 0 };
  const sum = ring.reduce(
    (acc, [lat, lon]) => ({ lat: acc.lat + lat, lon: acc.lon + lon }),
    { lat: 0, lon: 0 },
  );
  return {
    latitude: sum.lat / ring.length,
    longitude: sum.lon / ring.length,
  };
}

export function boundsOf(points: LatLon[]): LatLonBounds {
  if (points.length === 0) {
    return { north: 0, south: 0, east: 0, west: 0 };
  }
  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lons),
    west: Math.min(...lons),
  };
}

/**
 * Shift a point perpendicular to a bearing. `side` is +1 for starboard
 * (right of the direction of travel) and -1 for port.
 */
export function offsetPerpendicular(origin: LatLon, bearingDeg: number, offsetKm: number): LatLon {
  return destinationPoint(origin, (bearingDeg + 90) % 360, offsetKm);
}

export const kmToNauticalMiles = (km: number): number => km / KM_PER_NAUTICAL_MILE;
export const nauticalMilesToKm = (nm: number): number => nm * KM_PER_NAUTICAL_MILE;
export const knotsToKmph = (knots: number): number => knots * KNOTS_TO_KMPH;
export const roundTo = (value: number, decimals = 1): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

function normaliseRing(polygon: Array<[number, number]> | LatLon[]): Array<[number, number]> {
  const first = polygon[0] as unknown;
  if (Array.isArray(first)) {
    return polygon as Array<[number, number]>;
  }
  return (polygon as LatLon[]).map((p) => [p.latitude, p.longitude] as [number, number]);
}
