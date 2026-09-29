import React from 'react';
import { FileWarning, MapPinned, ShieldAlert, Ship } from 'lucide-react';
import { GeofenceSeverity, GeofenceViolation, GeofencingData } from '../types';

/**
 * Geofence panel.
 *
 * Restricted water is a legal matter, not a weather matter, so every row
 * carries the authority that notified the limit and the buffer ORCA asks the
 * vessel to keep. A fisherman who does not know the difference between an
 * "avoid" and a "you will be arrested" area is not properly served.
 */
interface GeofencePanelProps {
  data?: GeofencingData;
  compact?: boolean;
}

const SEVERITY_STYLE: Record<GeofenceSeverity, string> = {
  CRITICAL: 'border-red-500/60 bg-red-950/40 text-red-300',
  HIGH: 'border-orange-500/50 bg-orange-950/30 text-orange-300',
  MODERATE: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
  INFO: 'border-slate-700 bg-slate-900/60 text-slate-400',
};

const TYPE_LABEL: Record<string, string> = {
  INTERNATIONAL_BOUNDARY: 'International boundary',
  RESTRICTED_WATERS: 'Restricted waters',
  MARINE_PROTECTED_AREA: 'Marine protected area',
  ECOLOGICALLY_SENSITIVE_ZONE: 'Ecologically sensitive zone',
  OIL_RIG: 'Oil / gas installation',
  MILITARY_ZONE: 'Military zone',
  SUBMARINE_CABLE: 'Submarine cable',
  SHIPPING_LANE: 'Shipping lane',
};

export const GeofencePanel: React.FC<GeofencePanelProps> = ({ data, compact = false }) => {
  if (!data) return null;
  const { violations, nearbyBoundaries, warnings } = data;

  if (violations.length === 0 && nearbyBoundaries.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/25 p-3 flex items-center gap-2 text-[11px] text-emerald-300">
        <Ship className="w-4 h-4" />
        <span>No maritime boundary, protected area or restricted water is close to this track.</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-bold text-violet-300">
        <MapPinned className="w-3.5 h-3.5" />
        <span>Zones to stay clear of</span>
        <span className="ml-auto text-[10px] font-medium text-slate-500">
          {nearbyBoundaries.length} evaluated
        </span>
      </div>

      {violations.length > 0 ? (
        <div className="space-y-1.5">
          {violations.slice(0, compact ? 3 : 8).map((v) => (
            <ViolationRow key={v.boundaryId} violation={v} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">
          Nothing to enter right now. Nearest regulated water:{' '}
          {nearbyBoundaries[0] && (
            <>
              <span className="text-slate-200">{nearbyBoundaries[0].boundaryName}</span>{' '}
              {nearbyBoundaries[0].withinBuffer
                ? `within ${nearbyBoundaries[0].bufferKm} km buffer`
                : `${nearbyBoundaries[0].distanceKm} km ${nearbyBoundaries[0].bearing}`}
            </>
          )}
        </p>
      )}

      {warnings.length > 0 && !compact && (
        <div className="pt-1 border-t border-slate-800 space-y-1">
          {warnings.map((w) => (
            <div key={w} className="flex items-start gap-1.5 text-[10px] text-amber-200/80">
              <FileWarning className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-500">{data.source}</p>
    </div>
  );
};

const ViolationRow: React.FC<{ violation: GeofenceViolation }> = ({ violation }) => (
  <div className={`rounded-lg border px-2.5 py-2 ${SEVERITY_STYLE[violation.severity]}`}>
    <div className="flex items-center gap-1.5">
      {violation.inside ? (
        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <MapPinned className="w-3.5 h-3.5 shrink-0" />
      )}
      <span className="font-bold text-[11px]">{violation.boundaryName}</span>
      <span className="ml-auto text-[10px] font-mono">
        {violation.inside
          ? 'INSIDE'
          : violation.withinBuffer
            ? `within ${violation.bufferKm} km buffer`
            : `${violation.distanceKm} km ${violation.bearing}`}
      </span>
    </div>
    <div className="text-[10px] opacity-90 mt-0.5">
      {TYPE_LABEL[violation.boundaryType] ?? violation.boundaryType}
    </div>
    <div className="text-[10px] opacity-80 mt-0.5 leading-snug">{violation.regulation}</div>
  </div>
);

export default GeofencePanel;
