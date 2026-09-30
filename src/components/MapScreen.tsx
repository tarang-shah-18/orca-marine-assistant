import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  TriangleAlert,
  ArrowLeft,
  Droplets,
  Fish,
  Layers,
  Loader2,
  Route as RouteIcon,
  ShieldAlert,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import {
  GeofenceZone,
  HarborLocation,
  LanguageOption,
  MarineAlert,
  PFZZone,
  ProductivityHotspot,
  RiskLevel,
} from '../types';
import type { LatLon } from '../core/geo';
import { HARBORS } from '../core/dataset';
import { getPhrasebook, seaStateWord } from '../core/i18n';
import { mapBundle } from '../services/orcaApi';
import type { MapBundle } from '../services/orcaApi';

interface MapScreenProps {
  onBack: () => void;
  harbor: HarborLocation;
  onSelectHarbor: (harbor: HarborLocation) => void;
  focusZone?: PFZZone;
  onClearFocus: () => void;
  currentLanguage: LanguageOption;
  gpsFix: LatLon | null;
  onAskAbout: (question: string) => void;
}

type LayerId = 'fishing' | 'hazard' | 'restricted' | 'route' | 'ports';

const LAYERS: Array<{ id: LayerId; label: string; dot: string }> = [
  { id: 'fishing', label: 'Fishing', dot: 'bg-emerald-500' },
  { id: 'hazard', label: 'Hazards', dot: 'bg-red-500' },
  { id: 'restricted', label: 'Restricted', dot: 'bg-violet-500' },
  { id: 'route', label: 'Route', dot: 'bg-cyan-500' },
  { id: 'ports', label: 'Ports', dot: 'bg-slate-400' },
];

const RISK_COLOUR: Record<RiskLevel, string> = {
  LOW: '#22c55e',
  MODERATE: '#f59e0b',
  HIGH: '#f97316',
  SEVERE: '#ef4444',
};

const ADVISORY_COLOUR: Record<string, string> = {
  GREEN: '#22c55e',
  YELLOW: '#f59e0b',
  ORANGE: '#f97316',
  RED: '#ef4444',
};

const SEVERITY_COLOUR: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MODERATE: '#f59e0b',
  INFO: '#64748b',
};

/* --- Base maps ------------------------------------------------------ */

type BaseId = 'osm' | 'satellite';

const BASE_LAYERS: Record<
  BaseId,
  { url: string; attribution: string; maxZoom: number; label: string; swatch: string }
> = {
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    label: 'OSM',
    swatch: '#eef0e8',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri — Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
    label: 'Satellite',
    swatch: '#12303a',
  },
};

const BASE_ORDER: BaseId[] = ['osm', 'satellite'];

/** 16-point compass values in degrees (direction a vector points TOWARD). */
const COMPASS: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

/** Parse a compass label — `SW (235°)` or plain `ENE` — into degrees. */
function compassToDeg(label: string): number | null {
  const bracketed = /\((\d+(?:\.\d+)?)\s*°\)/.exec(label);
  if (bracketed) return Number(bracketed[1]);
  const point = label.trim().split(/\s+/)[0].toUpperCase();
  return COMPASS[point] ?? null;
}

const HOTSPOT_COLOUR: Record<ProductivityHotspot['productivityClass'], string> = {
  EXCELLENT: '#34d399',
  GOOD: '#22d3ee',
  FAIR: '#fbbf24',
  POOR: '#94a3b8',
};

export const MapScreen: React.FC<MapScreenProps> = ({
  onBack,
  harbor,
  onSelectHarbor,
  focusZone,
  onClearFocus,
  currentLanguage,
  gpsFix,
  onAskAbout,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);

  const [bundle, setBundle] = useState<MapBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<Record<LayerId, boolean>>({
    fishing: true,
    hazard: true,
    restricted: true,
    route: true,
    ports: true,
  });
  const [selectedZone, setSelectedZone] = useState<PFZZone | null>(focusZone ?? null);
  const [selectedZoneRef, setSelectedZoneRef] = useState<GeofenceZone | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<MarineAlert | null>(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const [tilesMode, setTilesMode] = useState<'tiles' | 'reference'>('tiles');
  const [baseId, setBaseId] = useState<BaseId>('osm');
  const [cursorPos, setCursorPos] = useState<{ lat: number; lon: number } | null>(null);
  const startTilesRef = useRef<(base: BaseId) => void>(() => {});
  const activeBaseRef = useRef<BaseId>('osm');
  const gridRef = useRef<L.LayerGroup | null>(null);

  const language = currentLanguage.code;
  const book = getPhrasebook(language);
  const ui = book.ui;

  const layerLabels: Record<LayerId, string> = {
    fishing: ui.fishingGroundWord,
    hazard: ui.hazardAdvisoryWord,
    restricted: ui.restrictedWaterWord,
    route: book.labels.route,
    ports: ui.portsLegendWord,
  };

  /* --- Data -------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    mapBundle(harbor.id, language)
      .then((data) => {
        if (!cancelled) setBundle(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : ui.mapLoadFailedWord);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [harbor.id, language]);

  useEffect(() => {
    setSelectedZone(focusZone ?? null);
  }, [focusZone]);

  // One-time stylesheet for animated corridors and pulsing alert/hotspot rings.
  useEffect(() => {
    if (document.getElementById('orca-map-anim')) return;
    const style = document.createElement('style');
    style.id = 'orca-map-anim';
    style.textContent = `
      @keyframes orcaRouteDash { to { stroke-dashoffset: -40; } }
      .orca-route-line { animation: orcaRouteDash 1.4s linear infinite; }
      @keyframes orcaRingPulse { 0% { stroke-width: 2; stroke-opacity: .9; } 100% { stroke-width: 7; stroke-opacity: 0; } }
      .orca-alert-ring { animation: orcaRingPulse 1.9s ease-out infinite; }
      .orca-hotspot-ring { animation: orcaRingPulse 2.6s ease-out infinite; }
    `;
    document.head.appendChild(style);
  }, []);

  /* --- Map lifecycle ------------------------------------------------ */

  /** Simplified India coastline (reference geometry for the offline grid view). */
  const INDIA_OUTLINE: Array<[number, number]> = [
    [8.08, 77.55], [8.4, 78.1], [9.3, 79.3], [10.3, 79.9], [12.0, 80.3], [13.1, 80.3],
    [14.4, 80.3], [15.5, 80.0], [16.4, 81.6], [17.2, 83.3], [18.4, 83.9], [19.4, 85.1],
    [20.3, 86.9], [21.5, 87.9], [21.8, 88.1], [22.3, 88.9], [21.7, 89.2], [21.4, 88.1],
    [20.7, 87.2], [19.7, 86.2], [18.6, 84.2], [17.3, 83.2], [15.8, 80.5], [14.0, 80.2],
    [12.9, 80.2], [12.0, 80.3], [10.3, 79.9], [9.1, 78.2], [8.08, 77.55],
    [8.1, 77.0], [8.9, 76.9], [9.5, 76.2], [10.0, 76.1], [10.8, 75.7], [11.7, 75.5],
    [12.6, 74.9], [13.1, 74.8], [13.8, 74.4], [14.8, 74.1], [15.4, 73.8], [16.0, 73.5],
    [16.6, 73.2], [17.1, 73.1], [17.7, 73.1], [18.2, 72.9], [18.9, 72.8], [20.7, 70.4],
    [21.5, 69.2], [21.9, 69.1], [22.5, 69.7], [22.9, 69.8], [23.2, 68.8], [23.6, 68.5],
    [24.2, 67.6], [24.4, 67.4], [25.3, 66.9], [26.4, 66.6], [27.7, 66.1], [28.2, 66.2],
    [29.1, 66.4], [29.9, 66.5], [30.7, 66.4], [31.6, 65.4], [32.1, 65.1], [33.0, 65.1],
    [33.7, 66.4], [34.0, 66.2], [34.5, 66.1], [35.1, 67.1], [35.5, 68.0], [36.0, 68.1],
    [36.5, 67.7], [37.1, 68.1], [38.5, 68.7], [39.0, 70.6], [40.0, 71.5], [41.2, 73.5],
    [42.0, 74.0], [45.0, 76.0], [50.8, 76.4], [52.3, 78.0], [54.4, 78.2], [55.0, 79.5],
    [56.5, 80.0], [58.0, 79.0], [59.0, 78.0], [59.8, 76.5], [61.0, 75.5], [62.0, 75.0],
  ];

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [harbor.latitude, harbor.longitude],
      zoom: 7,
      zoomControl: false,
    });

    let tileLayer: L.TileLayer | null = null;
    let tileFailures = 0;

    const drawReferenceGrid = (): void => {
      if (gridRef.current) return;
      // Georeferenced graticule + coastline so the map stays meaningful with no
      // tile server reachable (harmless to stack on top of working tiles too).
      const grid = L.layerGroup();
      const gridLine = (bounds: Array<[number, number]>, dash: string): void => {
        L.polyline(bounds, {
          color: '#1e3d5c',
          weight: 1,
          opacity: 0.55,
          dashArray: dash,
        }).addTo(grid);
      };
      for (let lon = 55; lon <= 105; lon += 2) {
        gridLine(
          [
            [4, lon],
            [40, lon],
          ],
          '2 6',
        );
      }
      for (let lat = 4; lat <= 40; lat += 2) {
        gridLine(
          [
            [lat, 50],
            [lat, 110],
          ],
          '2 6',
        );
      }
      L.polygon(INDIA_OUTLINE, {
        color: '#0e7490',
        weight: 1.5,
        fillColor: '#0f3a4e',
        fillOpacity: 0.35,
      }).addTo(grid);
      // Neighbouring land masses for context.
      L.polygon(
        [
          [5.9, 79.8], [6.4, 80.0], [6.9, 80.1], [7.5, 80.3], [8.6, 81.2],
          [8.9, 81.5], [8.7, 82.0], [8.0, 81.4], [6.8, 80.6], [5.9, 80.0],
        ],
        { color: '#0e7490', weight: 1, fillColor: '#0f3a4e', fillOpacity: 0.3 },
      ).addTo(grid);
      grid.addTo(map);
      gridRef.current = grid;
      setTilesMode('reference');
    };

    const startTiles = (base: BaseId): void => {
      tileFailures = 0;
      if (tileLayer) {
        tileLayer.remove();
        tileLayer = null;
      }
      // Fallback order: the chosen base first, then every other provider, then
      // the georeferenced grid as the last stop.
      const chain = [base, ...BASE_ORDER.filter((b) => b !== base)];
      const addProvider = (index: number): void => {
        const provider = BASE_LAYERS[chain[index]];
        if (!provider) {
          drawReferenceGrid();
          return;
        }
        tileLayer = L.tileLayer(provider.url, {
          attribution: provider.attribution,
          maxZoom: provider.maxZoom,
        });
        tileLayer.on('tileerror', () => {
          tileFailures += 1;
          // Three failing tiles means the provider is unreachable from here.
          if (tileFailures >= 3 && tileLayer) {
            tileFailures = 0;
            tileLayer.remove();
            tileLayer = null;
            addProvider(index + 1);
          }
        });
        tileLayer.on('load', () => {
          // Tiles came back — retire any reference grid left on screen.
          if (gridRef.current) {
            gridRef.current.remove();
            gridRef.current = null;
          }
          setTilesMode('tiles');
        });
        tileLayer.addTo(map);
      };
      addProvider(0);
      activeBaseRef.current = base;
    };

    startTilesRef.current = startTiles;
    startTiles(baseId);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ imperial: false, maxWidth: 90, position: 'bottomright' }).addTo(map);
    map.on('mousemove', (event: L.LeafletMouseEvent) => {
      setCursorPos({ lat: event.latlng.lat, lon: event.latlng.lng });
    });
    map.on('mouseout', () => setCursorPos(null));

    overlayRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
      gridRef.current = null;
      setTilesMode('tiles');
    };
  }, [harbor.latitude, harbor.longitude]);

  /* --- Base-map switching ------------------------------------------- */

  useEffect(() => {
    if (activeBaseRef.current === baseId) return;
    startTilesRef.current(baseId);
  }, [baseId]);

  /* --- Layers ------------------------------------------------------- */

  const zones = useMemo(() => bundle?.fishingZones ?? [], [bundle]);
  const alerts = useMemo(
    () => (bundle?.alerts ?? []).filter((a) => a.advisoryLevel !== 'GREEN'),
    [bundle],
  );
  const geofences = useMemo(
    () =>
      (bundle?.geofences ?? []).filter((zone) => {
        if (!bundle?.geofencing) return true;
        // Only draw what is actually relevant to the queried track, otherwise
        // the whole EEZ turns into a wall of violet.
        const nearby = new Set(
          [...bundle.geofencing.violations, ...bundle.geofencing.nearbyBoundaries].map(
            (v) => v.boundaryId,
          ),
        );
        return nearby.has(zone.id);
      }),
    [bundle],
  );

  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) return;

    overlay.clearLayers();

    // 1. Reference position: the harbour, or the live GPS fix.
    const focusLat = gpsFix?.latitude ?? harbor.latitude;
    const focusLon = gpsFix?.longitude ?? harbor.longitude;
    const fixIcon = L.divIcon({
      className: '',
      html: `<div style="display:flex;align-items:center;justify-content:center">
               <span style="position:absolute;width:34px;height:34px;border-radius:50%;background:${gpsFix ? '#34d399' : '#38bdf8'};opacity:.25;animation:ping 1.6s ease-out infinite"></span>
               <span style="width:14px;height:14px;border-radius:50%;background:${gpsFix ? '#10b981' : '#0284c7'};border:2px solid #fff;box-shadow:0 0 0 3px rgba(15,23,42,.6)"></span>
             </div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    L.marker([focusLat, focusLon], { icon: fixIcon, zIndexOffset: 1000 })
      .addTo(overlay)
      .bindTooltip(
        gpsFix
          ? `<b>${ui.yourGpsPositionWord}</b><br>${focusLat.toFixed(3)}°N, ${focusLon.toFixed(3)}°E`
          : `<b>${harbor.shortName}</b><br>${harbor.name}`,
        { direction: 'top' },
      );

    // 2. Fishing grounds.
    if (enabled.fishing) {
      for (const zone of zones) {
        const active = selectedZone?.id === zone.id;
        const colour = zone.status === 'favorable' ? '#10b981' : zone.status === 'moderate' ? '#f59e0b' : '#f97316';
        const circle = L.circle([zone.latitude, zone.longitude], {
          radius: zone.radiusKm * 1000,
          color: active ? '#ffffff' : colour,
          fillColor: colour,
          fillOpacity: active ? 0.4 : 0.18,
          weight: active ? 2.5 : 1.2,
          dashArray: active ? undefined : '4,4',
        }).addTo(overlay);

        circle.bindTooltip(
          `<b>${zone.name}</b><br>${zone.distanceKm} km ${zone.bearing}<br>` +
            `${book.labels.productivity} ${zone.productivityIndex}/100 · ${zone.productivityClass}<br>` +
            `Chl-a ${zone.chlorophyllMgM3} mg/m³ · SST ${zone.sstCelsius}°C`,
          { direction: 'top' },
        );
        circle.on('click', () => setSelectedZone(zone));
      }
    }

    // 3. Hazard advisories.
    if (enabled.hazard) {
      for (const alert of alerts) {
        const geometry = alert.geometry;
        if (!geometry) continue;
        const colour = ADVISORY_COLOUR[alert.advisoryLevel] ?? '#f59e0b';

        if (geometry.kind === 'circle' && geometry.center) {
          const circle = L.circle([geometry.center.latitude, geometry.center.longitude], {
            radius: Math.max(10, (geometry.radiusKm ?? 60)) * 1000,
            color: colour,
            fillColor: colour,
            fillOpacity: alert.withinInfluence ? 0.22 : 0.1,
            weight: alert.withinInfluence ? 2 : 1,
            dashArray: alert.withinInfluence ? undefined : '6,6',
          }).addTo(overlay);
          // Critical advisories get a pulsing ring so they read immediately.
          if (alert.advisoryLevel === 'ORANGE' || alert.advisoryLevel === 'RED') {
            L.circle([geometry.center.latitude, geometry.center.longitude], {
              radius: Math.max(10, (geometry.radiusKm ?? 60)) * 1000,
              color: colour,
              weight: 2,
              fill: false,
              className: 'orca-alert-ring',
              interactive: false,
            }).addTo(overlay);
          }
          circle.bindTooltip(
            `<b>${alert.title}</b><br>${alert.advisoryLevel} · ${alert.distanceKm} km ${alert.bearing}<br>${alert.source}`,
            { direction: 'top' },
          );
          circle.on('click', () => setSelectedAlert(alert));
        } else if (geometry.kind === 'polygon' && geometry.polygon) {
          const shape = L.polygon(geometry.polygon, {
            color: colour,
            fillColor: colour,
            fillOpacity: 0.18,
            weight: 2,
          }).addTo(overlay);
          shape.bindTooltip(`<b>${alert.title}</b><br>${alert.action}`, { direction: 'top' });
          shape.on('click', () => setSelectedAlert(alert));
        }
      }
    }

    // 4. Restricted / regulated water.
    if (enabled.restricted) {
      for (const zone of geofences) {
        const colour = SEVERITY_COLOUR[zone.severity] ?? '#a855f7';
        const style = {
          color: colour,
          fillColor: colour,
          fillOpacity: zone.shape === 'line' ? 0 : 0.14,
          weight: zone.shape === 'line' ? 3 : 1.6,
          dashArray: '6,4',
        };
        const shape: L.Layer =
          zone.shape === 'polygon' && zone.coordinates.length > 2
            ? L.polygon(zone.coordinates, style)
            : zone.shape === 'line' && zone.coordinates.length > 1
              ? L.polyline(zone.coordinates, style)
              : L.circle(
                  [zone.center?.latitude ?? harbor.latitude, zone.center?.longitude ?? harbor.longitude],
                  { ...style, radius: Math.max(1, (zone.radiusKm ?? 5)) * 1000 },
                );
        shape.addTo(overlay);
        shape.bindTooltip(
          `<b>${zone.name}</b><br>${zone.severity} · keep ${zone.bufferKm} km clear<br>${zone.authority}`,
          { direction: 'top' },
        );
        shape.on('click', () => setSelectedZoneRef(zone));
      }
    }

    // 5. The corridor the routing engine chose — animated direction of travel.
    if (
      enabled.route &&
      bundle?.route &&
      bundle.route.track.length > 1 &&
      bundle.route.waypoints.length > 0
    ) {
      L.polyline(bundle.route.track, {
        color: '#22d3ee',
        weight: 3,
        opacity: 0.92,
        dashArray: '12,8',
        className: 'orca-route-line',
      })
        .addTo(overlay)
        .bindTooltip(
          `<b>${bundle.route.waypoints[0].name} → ${
            bundle.route.waypoints[bundle.route.waypoints.length - 1].name
          }</b><br>${bundle.route.totalDistanceKm} km · ${bundle.route.estimatedTimeHours} · safety ${bundle.route.safetyScore}/100`,
          { direction: 'top', sticky: true },
        );

      const navIcon = (colour: string): L.DivIcon =>
        L.divIcon({
          className: '',
          html: `<div style="position:relative;transform:translate(-50%,-50%)">
            <span style="position:absolute;inset:-5px;border-radius:50%;background:${colour};opacity:.22"></span>
            <span style="display:block;width:14px;height:14px;border-radius:50%;background:${colour};border:2px solid #fff;box-shadow:0 0 0 2px rgba(2,6,23,.6)"></span>
          </div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

      const first = bundle.route.track[0];
      const last = bundle.route.track[bundle.route.track.length - 1];
      L.marker(first, { icon: navIcon('#34d399'), zIndexOffset: 800 })
        .addTo(overlay)
        .bindTooltip(`<b>Depart ${bundle.route.waypoints[0].name}</b>`, { direction: 'top' });
      L.marker(last, { icon: navIcon('#0ea5e9'), zIndexOffset: 800 })
        .addTo(overlay)
        .bindTooltip(
          `<b>Arrive ${bundle.route.waypoints[bundle.route.waypoints.length - 1].name}</b>`,
          { direction: 'top' },
        );

      for (const waypoint of bundle.route.waypoints) {
        L.circleMarker([waypoint.latitude, waypoint.longitude], {
          radius: 5,
          color: '#0e7490',
          weight: 2,
          fillColor: RISK_COLOUR[waypoint.riskLevel],
          fillOpacity: 1,
        })
          .addTo(overlay)
          .bindTooltip(
            `<b>${waypoint.name}</b><br>ETA ${waypoint.etaHours.toFixed(1)} h · ${waypoint.riskLevel}<br>${waypoint.notes}`,
            { direction: 'top' },
          );
      }
    }

    // 6. Live ocean & wind vectors streaming off the harbour.
    if (bundle?.ocean && bundle?.weather) {
      const windDeg = bundle.weather.windDirectionDeg;
      const swellDeg = bundle.ocean.swellDirectionDeg;
      const currentDeg = compassToDeg(bundle.ocean.currentDirection);
      const vectorIcon = (headingDeg: number, colour: string, size: number, tag: string): L.DivIcon =>
        L.divIcon({
          className: '',
          html: `
            <div style="display:flex;flex-direction:column;align-items:center;gap:1px;filter:drop-shadow(0 1px 2px rgba(2,6,23,.85))">
              <svg width="${size}" height="${size}" style="transform:rotate(${headingDeg}deg)">
                <line x1="${size / 2}" y1="${size}" x2="${size / 2}" y2="${size * 0.16}" stroke="${colour}" stroke-width="2"/>
                <polygon points="${size / 2},${size * 0.06} ${size * 0.26},${size * 0.38} ${size * 0.74},${size * 0.38}" fill="${colour}"/>
              </svg>
              <span style="font-size:8px;font-weight:800;color:${colour};background:rgba(2,6,23,.6);border-radius:4px;padding:0 3px;line-height:12px">${tag}</span>
            </div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      // Meteorology reports direction *from* which the parcel moves; swing the
      // arrow 180° so it points the way the water is actually being pushed.
      //
      // The three-glyph badges (WND / SWL / CRT) stay language-neutral on
      // purpose: they are drawn at 8px inside a fixed-width SVG chip, so a
      // localised word cannot fit without clipping. The human-readable name for
      // each badge is in the tooltip immediately beside it.
      if (windDeg != null) {
        L.marker([focusLat + 0.05, focusLon + 0.05], {
          icon: vectorIcon(windDeg + 180, '#fbbf24', 32, 'WND'),
          zIndexOffset: 700,
          interactive: false,
        })
          .addTo(overlay)
          .bindTooltip(`<b>${book.labels.wind}</b> ${bundle.weather.windSpeedKnots} kt ${bundle.weather.windDirection}`, {
            direction: 'right',
          });
      }
      if (swellDeg != null) {
        L.marker([focusLat + 0.13, focusLon + 0.13], {
          icon: vectorIcon(swellDeg + 180, '#22d3ee', 38, 'SWL'),
          zIndexOffset: 700,
          interactive: false,
        })
          .addTo(overlay)
          .bindTooltip(
            `<b>${book.ui.swellWord}</b> ${bundle.ocean.waveHeightMeters} m ${bundle.ocean.swellDirection} · ${seaStateWord(book, bundle.ocean.waveHeightMeters)}`,
            { direction: 'right' },
          );
      }
      if (currentDeg != null) {
        L.marker([focusLat + 0.21, focusLon + 0.21], {
          icon: vectorIcon(currentDeg, '#f472b6', 28, 'CRT'),
          zIndexOffset: 700,
          interactive: false,
        })
          .addTo(overlay)
          .bindTooltip(
            `<b>${ui.currentWord}</b> ${bundle.ocean.currentKnots} kt ${bundle.ocean.currentDirection}`,
            { direction: 'right' },
          );
      }
    }

    // 7. Reach rings and the PFZ thermal-scan footprint around the anchor.
    {
      for (const km of [50, 100, 200]) {
        L.circle([focusLat, focusLon], {
          radius: km * 1000,
          color: '#38bdf8',
          weight: 1,
          opacity: 0.28,
          dashArray: '1 8',
          fill: false,
          interactive: false,
        }).addTo(overlay);
      }
      // 180 km half-extent scan box, matching the agent's hotspot grid.
      const halfLat = 180 / 111.32;
      const halfLon = halfLat / Math.max(0.3, Math.cos((focusLat * Math.PI) / 180));
      L.rectangle(
        [
          [focusLat - halfLat, focusLon - halfLon],
          [focusLat + halfLat, focusLon + halfLon],
        ],
        {
          color: '#38bdf8',
          weight: 1,
          opacity: 0.22,
          dashArray: '4 6',
          fill: false,
          interactive: false,
        },
      ).addTo(overlay);
    }

    // 8. Productivity hotspots — the live satellite-proxy grid.
    if (enabled.fishing) {
      for (const h of bundle?.hotspots ?? []) {
        const colour = HOTSPOT_COLOUR[h.productivityClass] ?? '#94a3b8';
        L.circle([h.latitude, h.longitude], {
          radius: Math.max(9_000, 14_000 - h.distanceKm * 60),
          color: colour,
          weight: 2,
          fillColor: colour,
          fillOpacity: 0.16,
          className: 'orca-hotspot-ring',
          interactive: false,
        }).addTo(overlay);
        L.circleMarker([h.latitude, h.longitude], {
          radius: 5,
          color: '#0f172a',
          weight: 1.5,
          fillColor: colour,
          fillOpacity: 1,
        })
          .addTo(overlay)
          .bindTooltip(
            `<b>${h.name}</b><br>${h.distanceKm} km ${h.bearing}<br>` +
              `${book.labels.productivity} ${h.productivityIndex}/100 · ${h.productivityClass}<br>` +
              `Chl-a ${h.chlorophyllMgM3} mg/m³ · SST ${h.sstCelsius}°C`,
            { direction: 'top' },
          );
      }
    }

    // 9. Port markers — click a port to re-anchor the whole marine picture.
    if (enabled.ports) {
      for (const h of bundle?.harbours ?? []) {
        const full = HARBORS.find((c) => c.id === h.id);
        if (!full) continue;
        const isActive = h.id === harbor.id;
        const icon = L.divIcon({
          className: '',
          html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:18px;height:18px;transform:translate(-50%,-50%)">
            ${
              isActive
                ? '<span style="position:absolute;inset:-3px;border-radius:50%;background:#34d399;opacity:.25;animation:ping 1.6s ease-out infinite"></span>'
                : ''
            }
            <span style="position:absolute;inset:0;border-radius:50%;background:${isActive ? '#059669' : '#334155'};border:2px solid ${isActive ? '#a7f3d0' : '#64748b'};box-shadow:0 0 0 2px rgba(2,6,23,.65)"></span>
            <span style="position:relative;width:4px;height:4px;border-radius:50%;background:${isActive ? '#ecfdf5' : '#cbd5e1'}"></span>
          </div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([h.latitude, h.longitude], { icon, zIndexOffset: isActive ? 950 : 500 })
          .addTo(overlay)
          .bindTooltip(`<b>${h.shortName}</b><br>${h.name} · ${h.state}`, { direction: 'top' })
          .on('click', () => {
            if (!isActive) {
              onSelectHarbor(full);
              setSelectedZone(null);
              onClearFocus();
            }
          });
      }
    }

    // 10. Permanent labels on the favourable grounds so the picture reads at a glance.
    if (enabled.fishing) {
      for (const zone of zones) {
        if (zone.status !== 'favorable') continue;
        L.marker([zone.latitude, zone.longitude], {
          icon: L.divIcon({
            className: '',
            html: `<div style="transform:translate(-50%,-50%);text-align:center;font-size:9px;font-weight:800;color:#a7f3d0;text-shadow:0 1px 2px rgba(2,6,23,.95);white-space:nowrap;background:rgba(2,6,23,.5);border:1px solid rgba(52,211,153,.55);border-radius:4px;padding:1px 4px">${zone.name}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
          interactive: false,
          zIndexOffset: 600,
        }).addTo(overlay);
      }
    }
  }, [
    bundle,
    enabled,
    geofences,
    gpsFix,
    harbor.id,
    harbor.latitude,
    harbor.longitude,
    harbor.name,
    harbor.shortName,
    selectedZone,
    zones,
    alerts,
  ]);

  // Keep the viewport on whatever the fisher most recently asked about.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const target: LatLon | null =
      gpsFix ??
      (selectedZone
        ? { latitude: selectedZone.latitude, longitude: selectedZone.longitude }
        : focusZone
          ? { latitude: focusZone.latitude, longitude: focusZone.longitude }
          : null);
    if (target) map.panTo([target.latitude, target.longitude]);
  }, [gpsFix, selectedZone, focusZone]);

  /* --- Render ------------------------------------------------------ */

  const route = bundle?.route;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 relative overflow-hidden">
      <div className="px-3 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <button
            id="map-back-btn"
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-50"
            title={ui.backToOrcaWord}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="font-bold text-sm text-slate-50 flex items-center gap-1.5">
              <Waves className="w-4 h-4 text-cyan-400" />
              <span>{ui.marineGisWord}</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {harbor.shortName} · {harbor.basin} ·{' '}
              {bundle
                ? `${bundle.fishingZones.length} ${book.labels.ground} · ${bundle.hotspots?.length ?? 0} ${book.labels.hotspots} · ${alerts.length} ${book.labels.alerts}`
                : ui.loading}
            </div>
          </div>
        </div>

        <select
          id="map-harbor-select"
          value={harbor.id}
          onChange={(event) => {
            const found = HARBORS.find((h) => h.id === event.target.value);
            if (found) {
              onSelectHarbor(found);
              setSelectedZone(null);
            }
          }}
          className="bg-slate-800 text-[11px] text-slate-200 border border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-cyan-500 font-medium max-w-[130px]"
        >
          {HARBORS.map((h) => (
            <option key={h.id} value={h.id}>
              {h.shortName}
            </option>
          ))}
        </select>
      </div>

      {/* Layer switches + basemap picker */}
      <div className="absolute top-16 left-2 z-20 bg-slate-900/95 border border-slate-700 rounded-xl p-1 shadow-lg w-[118px]">
        <div className="flex flex-col gap-0.5">
          {LAYERS.map((layer) => (
            <button
              key={layer.id}
              onClick={() => setEnabled((prev) => ({ ...prev, [layer.id]: !prev[layer.id] }))}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                enabled[layer.id] ? 'bg-slate-800 text-slate-50' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${enabled[layer.id] ? layer.dot : 'bg-slate-700'}`} />
              {layerLabels[layer.id]}
            </button>
          ))}
        </div>
        <div className="mt-1 pt-1 border-t border-slate-700/70">
          <div className="px-2 pb-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500">
            {ui.basemapWord}
          </div>
          <div className="grid grid-cols-2 gap-0.5">
            {BASE_ORDER.map((b) => (
              <button
                key={b}
                onClick={() => setBaseId(b)}
                title={BASE_LAYERS[b].label}
                className={`flex items-center gap-1 px-1.5 py-1 rounded-lg text-[9px] font-bold transition-colors ${
                  baseId === b
                    ? 'bg-cyan-600/25 text-cyan-200 ring-1 ring-cyan-400/60'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ background: BASE_LAYERS[b].swatch, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.25)' }}
                />
                {BASE_LAYERS[b].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 w-full h-full z-10" />

      {/* Live conditions + cursor readout */}
      {(bundle?.weather || bundle?.ocean) && (
        <div className="absolute top-14 right-2 z-20 flex flex-col items-end gap-1">
          <div className="px-2.5 py-1.5 rounded-xl bg-slate-900/95 border border-slate-700 text-[10px] shadow-lg max-w-[220px]">
            <div className="flex items-center gap-1 font-bold text-cyan-300 mb-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  bundle?.dataCycle ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              {bundle?.dataCycle
                ? ui.liveWord.replace('{label}', bundle.dataCycle.label)
                : ui.referenceDataWord}
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-slate-300 font-medium">
              {bundle?.weather && (
                <span className="flex items-center gap-1">
                  <Wind className="w-3 h-3 text-amber-300" />
                  {bundle.weather.windSpeedKnots} kt {bundle.weather.windDirection}
                </span>
              )}
              {bundle?.ocean && (
                <>
                  <span className="flex items-center gap-1">
                    <Waves className="w-3 h-3 text-cyan-300" />
                    {bundle.ocean.waveHeightMeters} m · {seaStateWord(book, bundle.ocean.waveHeightMeters)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-sky-300" />
                    SST {bundle.ocean.seaSurfaceTempCelsius}°C
                  </span>
                </>
              )}
            </div>
          </div>
          {cursorPos && (
            <div className="px-2 py-0.5 rounded-md bg-slate-900/90 border border-slate-700 text-[9px] font-mono text-slate-400">
              {Math.abs(cursorPos.lat).toFixed(2)}°{cursorPos.lat >= 0 ? 'N' : 'S'} ·{' '}
              {Math.abs(cursorPos.lon).toFixed(2)}°{cursorPos.lon >= 0 ? 'E' : 'W'}
            </div>
          )}
        </div>
      )}

      {tilesMode === 'reference' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-2.5 py-1 rounded-lg bg-slate-900/95 border border-amber-600/50 text-[9px] font-semibold text-amber-300 shadow-lg">
          {ui.tileServerUnreachableWord}
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-cyan-300">
            <Loader2 className="w-4 h-4 animate-spin" />
            {ui.loadingLayersWord}
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-x-3 top-20 z-30 rounded-xl bg-red-950/90 border border-red-800 px-3 py-2 text-[11px] text-red-200">
          {error}
        </div>
      )}

      {/* Legend + route summary */}
      <div className="absolute bottom-3 left-2 z-20 w-[190px] bg-slate-900/95 border border-slate-700/90 rounded-2xl p-2.5 text-[10px] shadow-xl">
        <div className="flex items-center justify-between font-bold text-slate-200 mb-1.5">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400" />
            {ui.legendWord}
          </span>
          <button onClick={() => setLegendOpen((v) => !v)} className="text-cyan-400 hover:underline">
            {legendOpen ? ui.hideWord : ui.showWord}
          </button>
        </div>

        {legendOpen && (
          <div className="space-y-1">
            <LegendRow colour="#38bdf8" label={gpsFix ? ui.yourGpsPositionWord : ui.baseHarbourWord} />
            <LegendRow colour="#10b981" label={ui.favourableGroundWord} />
            <LegendRow colour="#f59e0b" label={ui.moderateProductivityWord} />
            <LegendRow colour="#34d399" label={ui.liveHotspotWord} />
            <LegendRow colour="#ef4444" label={ui.hazardAdvisoryWord} />
            <LegendRow colour="#a855f7" label={ui.restrictedWaterWord} />
            <LegendRow colour="#22d3ee" label={ui.plannedCorridorWord} />
            <LegendRow colour="#334155" label={ui.portsLegendWord} />
          </div>
        )}

        {route && (
          <div className="mt-2 pt-2 border-t border-slate-700/70 space-y-1">
            <div className="flex items-center gap-1 font-bold text-cyan-300">
              <RouteIcon className="w-3 h-3" />
              {route.totalDistanceKm} km · {route.estimatedTimeHours}
            </div>
            <div className="text-slate-400">
              {ui.safetyIndexWord} {route.safetyScore}/100 ·{' '}
              <span style={{ color: RISK_COLOUR[route.riskLevel] }}>{route.riskLevel}</span>
            </div>
            <button
              onClick={() => onAskAbout('What is the safest route from my port to the fishing zone?')}
              className="w-full mt-1 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
            >
              {ui.askAboutRouteWord}
            </button>
          </div>
        )}
      </div>

      {/* Detail card */}
      {selectedZone && (
        <ZoneCard
          zone={selectedZone}
          onClose={() => {
            setSelectedZone(null);
            onClearFocus();
          }}
          onAsk={onAskAbout}
          book={book}
        />
      )}

      {selectedZoneRef && (
        <GeofenceCard
          zone={selectedZoneRef}
          onClose={() => setSelectedZoneRef(null)}
          onAsk={onAskAbout}
          book={book}
        />
      )}

      {selectedAlert && (
        <AlertCard alert={selectedAlert} onClose={() => setSelectedAlert(null)} onAsk={onAskAbout} book={book} />
      )}
    </div>
  );
};

const LegendRow: React.FC<{ colour: string; label: string }> = ({ colour, label }) => (
  <div className="flex items-center gap-1.5">
    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colour }} />
    <span className="text-slate-300">{label}</span>
  </div>
);

const CardShell: React.FC<{ title: string; icon: React.ReactNode; tone: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  icon,
  tone,
  onClose,
  children,
}) => (
  <div className="absolute bottom-3 right-2 left-[202px] z-30 bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl text-[11px] space-y-2">
    <div className="flex items-start justify-between gap-2">
      <div className={`flex items-center gap-1.5 font-bold text-xs ${tone}`}>
        {icon}
        <span className="truncate">{title}</span>
      </div>
      <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
    {children}
  </div>
);

const Stat: React.FC<{ label: string; value: string; tone?: string }> = ({ label, value, tone }) => (
  <div className="bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1.5">
    <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-[12px] font-bold font-mono ${tone ?? 'text-slate-50'}`}>{value}</div>
  </div>
);

const ZoneCard: React.FC<{
  zone: PFZZone;
  onClose: () => void;
  onAsk: (question: string) => void;
  book: ReturnType<typeof getPhrasebook>;
}> = ({ zone, onClose, onAsk, book }) => (
  <CardShell title={zone.name} icon={<Fish className="w-4 h-4" />} tone="text-emerald-400" onClose={onClose}>
    <div className="grid grid-cols-2 gap-1.5">
      <Stat label={book.labels.distance} value={`${zone.distanceKm} km`} />
      <Stat label={book.evidenceKeys.bearing} value={zone.bearing} />
      <Stat label="Chl-a" value={`${zone.chlorophyllMgM3} mg/m³`} tone="text-emerald-400" />
      <Stat label="SST" value={`${zone.sstCelsius}°C`} tone="text-sky-400" />
      <Stat label={book.evidenceKeys.depth} value={`${zone.depthMeters} m`} />
      <Stat label="Index" value={`${zone.productivityIndex}/100`} />
    </div>
    <div>
      <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
        {book.evidenceKeys.species}
      </div>
      <div className="flex flex-wrap gap-1">
        {zone.targetFishSpecies.map((species) => (
          <span key={species} className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px]">
            {species}
          </span>
        ))}
      </div>
    </div>
    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
      <span className="text-[9px] text-slate-500">
        {book.ui.validUntilWord.replace('{date}', zone.validTill)}
      </span>
      <button
        onClick={() => onAsk(`Is it safe to go to ${zone.name}?`)}
        className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
      >
        Is it safe here?
      </button>
    </div>
  </CardShell>
);

const GeofenceCard: React.FC<{
  zone: GeofenceZone;
  onClose: () => void;
  onAsk: (question: string) => void;
  book: ReturnType<typeof getPhrasebook>;
}> = ({ zone, onClose, onAsk, book }) => (
  <CardShell
    title={zone.name}
    icon={<ShieldAlert className="w-4 h-4" />}
    tone="text-violet-300"
    onClose={onClose}
  >
    <div className="flex items-center gap-2">
      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 border border-slate-700">
        {zone.severity}
      </span>
      <span className="text-slate-400">
        {book.ui.statutoryBufferWord.replace('{n}', String(zone.bufferKm))}
      </span>
    </div>
    <p className="text-slate-300 leading-snug">{zone.description}</p>
    <p className="text-slate-400 leading-snug">{zone.regulation}</p>
    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
      <span className="text-[9px] text-slate-500">{zone.authority}</span>
      <button
        onClick={() => onAsk('Which zones should I avoid while fishing?')}
        className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
      >
        Avoidance advice
      </button>
    </div>
  </CardShell>
);

const AlertCard: React.FC<{
  alert: MarineAlert;
  onClose: () => void;
  onAsk: (question: string) => void;
  book: ReturnType<typeof getPhrasebook>;
}> = ({ alert, onClose, onAsk, book }) => (
  <CardShell
    title={alert.title}
    icon={<TriangleAlert className="w-4 h-4" />}
    tone="text-amber-300"
    onClose={onClose}
  >
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className="px-1.5 py-0.5 rounded text-[9px] font-bold text-slate-950"
        style={{ background: ADVISORY_COLOUR[alert.advisoryLevel] }}
      >
        {alert.advisoryLevel}
      </span>
      <span className="text-slate-400 font-mono">
        {alert.distanceKm} km {alert.bearing}
      </span>
      <span className="text-slate-500">{alert.affectedCoast}</span>
    </div>
    <p className="text-slate-300 leading-snug">{alert.description}</p>
    <p className="text-slate-50 leading-snug font-semibold">{alert.action}</p>
    <div className="flex items-center justify-between pt-1 border-t border-slate-800">
      <span className="text-[9px] text-slate-500">
        {alert.source} · {book.ui.validUntilWord.replace('{date}', alert.validUntil)}
      </span>
      <button
        onClick={() => onAsk('Is there any warning for my coast right now?')}
        className="px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
      >
        Full briefing
      </button>
    </div>
  </CardShell>
);

export default MapScreen;
