import React from 'react';
import { FileWarning, MapPinned, ShieldAlert, Ship } from 'lucide-react';
import { GeofenceSeverity, GeofenceViolation, GeofencingData } from '../types';
import { Phrasebook, fillTemplate } from '../core/i18n';

/**
 * Geofence panel.
 *
 * Restricted water is a legal matter, not a weather matter, so every row
 * carries the authority that notified the limit and the buffer ORCA asks the
 * vessel to keep. A fisherman who does not know the difference between an
 * "avoid" and a "you will be arrested" area is not properly served.
 *
 * `book` is required, not optional. An optional phrasebook plus an English `? :`
 * fallback once let this panel silently render English in all eleven languages;
 * making it required turns that whole bug class into a compile error.
 */
interface GeofencePanelProps {
  data?: GeofencingData;
  compact?: boolean;
  book: Phrasebook;
}

const SEVERITY_STYLE: Record<GeofenceSeverity, string> = {
  CRITICAL: 'border-red-500/60 bg-red-950/40 text-red-300',
  HIGH: 'border-orange-500/50 bg-orange-950/30 text-orange-300',
  MODERATE: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
  INFO: 'border-slate-700 bg-slate-900/60 text-slate-400',
};

/**
 * ORCA's own vocabulary for each published zone class. Keyed on the stable
 * `boundaryType` id rather than on a display string, so this map can never be
 * consulted with a localised value and miss.
 */
const TYPE_KEY: Record<string, keyof Phrasebook['ui']> = {
  INTERNATIONAL_BOUNDARY: 'geofenceTypeBoundaryWord',
  RESTRICTED_WATERS: 'geofenceTypeRestrictedWord',
  MARINE_PROTECTED_AREA: 'geofenceTypeProtectedWord',
  ECOLOGICALLY_SENSITIVE_ZONE: 'geofenceTypeSensitiveWord',
  OIL_RIG: 'geofenceTypeOilRigWord',
  MILITARY_ZONE: 'geofenceTypeMilitaryWord',
  SUBMARINE_CABLE: 'geofenceTypeCableWord',
  SHIPPING_LANE: 'geofenceTypeLaneWord',
};

/**
 * `boundaryName` and `regulation` are deliberately NOT localised. They restate
 * what a notified authority published — a naval firing box, a Ramsar no-take
 * boundary — and paraphrasing a legal access restriction is worse than showing
 * it in its source language. See the provenance note above GEOFENCES in
 * `core/dataset.ts`. Everything ORCA itself wrote around them is translated.
 */
export const GeofencePanel: React.FC<GeofencePanelProps> = ({ data, compact = false, book }) => {
  if (!data) return null;
  const { violations, nearbyBoundaries, warnings } = data;
  const ui = book.ui;

  if (violations.length === 0 && nearbyBoundaries.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/25 p-3 flex items-center gap-2 text-[11px] text-emerald-300">
        <Ship className="w-4 h-4" />
        <span>{ui.geofenceClearWord}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-bold text-violet-300">
        <MapPinned className="w-3.5 h-3.5" />
        <span>{ui.geofenceStayClearWord}</span>
        <span className="ml-auto text-[10px] font-medium text-slate-500">
          {fillTemplate(ui.geofenceEvaluatedWord, { n: nearbyBoundaries.length })}
        </span>
      </div>

      {violations.length > 0 ? (
        <div className="space-y-1.5">
          {violations.slice(0, compact ? 3 : 8).map((v) => (
            <ViolationRow key={v.boundaryId} violation={v} book={book} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">
          {ui.geofenceNothingToEnterWord}{' '}
          {nearbyBoundaries[0] && (
            <>
              <span className="text-slate-200">{nearbyBoundaries[0].boundaryName}</span>{' '}
              {nearbyBoundaries[0].withinBuffer
                ? fillTemplate(ui.geofenceBufferWord, { km: nearbyBoundaries[0].bufferKm })
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

const ViolationRow: React.FC<{ violation: GeofenceViolation; book: Phrasebook }> = ({
  violation,
  book,
}) => {
  const ui = book.ui;
  const typeKey = TYPE_KEY[violation.boundaryType];

  return (
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
            ? ui.geofenceInsideWord
            : violation.withinBuffer
              ? fillTemplate(ui.geofenceBufferWord, { km: violation.bufferKm })
              : `${violation.distanceKm} km ${violation.bearing}`}
        </span>
      </div>
      <div className="text-[10px] opacity-90 mt-0.5">
        {typeKey ? ui[typeKey] : violation.boundaryType}
      </div>
      <div className="text-[10px] opacity-80 mt-0.5 leading-snug">{violation.regulation}</div>
    </div>
  );
};

export default GeofencePanel;