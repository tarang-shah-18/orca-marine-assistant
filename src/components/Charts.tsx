import React, { useId } from 'react';
import { ChartColumn, ChartLine, Table2 } from 'lucide-react';
import { VisualizationData } from '../types';
import { Phrasebook } from '../core/i18n';

/**
 * Minimal, dependency-free chart renderers.
 *
 * A charting library would be several hundred kilobytes on a coastal 3G link
 * for what amounts to two chart types, so ORCA draws its own SVG. The
 * `VisualizationData` the agents publish is deliberately chart-library-agnostic
 * for exactly this reason.
 */

interface ChartsProps {
  visualizations: VisualizationData[];
  /** Only render the first N, for the inline answer view. */
  limit?: number;
  /** Phrasebook for localizing layer-readout chrome. */
  book?: Phrasebook;
}

export const Charts: React.FC<ChartsProps> = ({ visualizations, limit, book }) => {
  const shown = limit ? visualizations.slice(0, limit) : visualizations;
  if (shown.length === 0) return null;

  return (
    <div className="space-y-3">
      {shown.map((viz) => (
        <VizCard key={viz.id} viz={viz} book={book} />
      ))}
    </div>
  );
};

const VizCard: React.FC<{ viz: VisualizationData; book?: Phrasebook }> = ({ viz, book }) => {
  const titleId = useId();

  return (
    <figure className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <figcaption className="flex items-center gap-2 mb-1">
        {viz.type === 'timeseries' ? (
          <ChartLine className="w-3.5 h-3.5 text-cyan-400" />
        ) : viz.type === 'chart' ? (
          <ChartColumn className="w-3.5 h-3.5 text-cyan-400" />
        ) : (
          <Table2 className="w-3.5 h-3.5 text-cyan-400" />
        )}
        <span id={titleId} className="text-[11px] font-bold text-slate-200">
          {viz.title}
        </span>
      </figcaption>
      {viz.subtitle && <p className="text-[10px] text-slate-500 mb-2">{viz.subtitle}</p>}

      {viz.series.length === 0 ? (
        // Map-type layers carry their content in `geo`, not `series` — render
        // the plotted features as a compact readout instead of pretending the
        // layer is empty. "No data" is reserved for layers that truly have
        // neither a series nor any geographic features.
        <LayerReadout viz={viz} book={book} />
      ) : viz.type === 'chart' ? (
        <GroupedBars viz={viz} />
      ) : (
        <TimeSeries viz={viz} />
      )}
    </figure>
  );
};

/* ------------------------------------------------------------------ *
 * Line / area chart
 * ------------------------------------------------------------------ */

const W = 320;
const H = 110;
const PAD = { top: 8, right: 6, bottom: 16, left: 30 };

const TimeSeries: React.FC<{ viz: VisualizationData }> = ({ viz }) => {
  const count = Math.max(...viz.series.map((s) => s.points.length), 1);
  const min = Math.min(...viz.series.flatMap((s) => s.points), 0);
  const max = Math.max(...viz.series.flatMap((s) => s.points), 1);
  const span = max - min || 1;

  const x = (i: number) => PAD.left + (i / Math.max(count - 1, 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * (H - PAD.top - PAD.bottom);

  // Show at most five x labels; more than that and they collide on a phone.
  const labelStride = Math.max(1, Math.ceil(count / 5));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(min + span * f)}
            y2={y(min + span * f)}
            stroke="#1e293b"
            strokeWidth="1"
          />
          <text x={2} y={y(min + span * f) + 3} fill="#64748b" fontSize="8">
            {(min + span * f).toFixed(span < 4 ? 1 : 0)}
          </text>
        </g>
      ))}

      {viz.series.map((s) => (
        <g key={s.id}>
          <polyline
            fill="none"
            stroke={s.color}
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
          />
          {s.points.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r="1.8" fill={s.color} />
          ))}
        </g>
      ))}

      {viz.categories.map((c, i) =>
        i % labelStride === 0 ? (
          <text key={`${c}-${i}`} x={x(i)} y={H - 4} fill="#64748b" fontSize="8" textAnchor="middle">
            {c}
          </text>
        ) : null,
      )}
    </svg>
  );
};

/* ------------------------------------------------------------------ *
 * Grouped bar chart
 * ------------------------------------------------------------------ */

const GroupedBars: React.FC<{ viz: VisualizationData }> = ({ viz }) => {
  const count = Math.max(...viz.series.map((s) => s.points.length), 1);
  const max = Math.max(...viz.series.flatMap((s) => s.points), 1);
  const groupWidth = (W - PAD.left - PAD.right) / count;
  const barWidth = Math.max(2, (groupWidth - 4) / viz.series.length);
  const chartHeight = H - PAD.top - PAD.bottom;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={H - PAD.bottom}
        y2={H - PAD.bottom}
        stroke="#1e293b"
      />
      {Array.from({ length: count }).map((_, i) => {
        const left = PAD.left + i * groupWidth + 2;
        return (
          <g key={i}>
            {viz.series.map((s, j) => {
              const v = s.points[i] ?? 0;
              const barHeight = (v / (max || 1)) * chartHeight;
              return (
                <rect
                  key={s.id}
                  x={left + j * barWidth}
                  y={H - PAD.bottom - barHeight}
                  width={Math.max(1, barWidth - 1)}
                  height={Math.max(1, barHeight)}
                  fill={s.color}
                  rx="1"
                >
                  <title>{`${s.label}: ${v} ${s.unit}`}</title>
                </rect>
              );
            })}
            <text
              x={left + (groupWidth - 4) / 2}
              y={H - 4}
              fill="#64748b"
              fontSize="8"
              textAnchor="middle"
            >
              {viz.categories[i] ?? ''}
            </text>
          </g>
        );
      })}
      <text x={2} y={10} fill="#64748b" fontSize="8">
        {max.toFixed(1)}
      </text>
    </svg>
  );
};

/* ------------------------------------------------------------------ *
 * Map-layer readout (geo-backed visualisations without a series)
 * ------------------------------------------------------------------ */

function geoEntryCount(geo: NonNullable<VisualizationData['geo']>): number {
  return (geo.circles?.length ?? 0) + (geo.polygons?.length ?? 0) + (geo.points?.length ?? 0);
}

const LEVEL_LABEL: Record<string, string> = {
  favorable: 'favorable',
  moderate: 'moderate',
  hazard: 'hazard',
  restricted: 'restricted',
};

const LEVEL_LABELS_EN: Record<string, keyof Phrasebook['ui']> = {
  favorable: 'levelFavorableWord',
  moderate: 'levelModerateWord',
  hazard: 'levelHazardWord',
  restricted: 'levelRestrictedWord',
};

const levelLabel = (level: string, book?: Phrasebook): string => {
  const key = LEVEL_LABELS_EN[level];
  return key && book ? book.ui[key] : LEVEL_LABEL[level] ?? level;
};

/**
 * Compact inventory of the features a map-type layer plots. These layers are
 * geographic, so the chat card shows what is on the layer and points at the
 * GIS map for the spatial view — never a bare "nothing here" sentence.
 */
const LayerReadout: React.FC<{ viz: VisualizationData; book?: Phrasebook }> = ({ viz, book }) => {
  const geo = viz.geo;
  if (!geo || geoEntryCount(geo) === 0) {
    return (
      <p className="text-[11px] text-slate-500 italic">
        {book ? book.ui.noLayerDataWord : 'No data for this layer right now.'}
      </p>
    );
  }

  const rows: Array<{ id: string; label: string; detail: string; color: string }> = [];
  for (const circle of geo.circles ?? []) {
    rows.push({
      id: circle.id,
      label: circle.label,
      detail: `${book ? book.ui.radiusWord : 'Radius'} ${circle.radiusKm} km · ${levelLabel(circle.level, book)}`,
      color: circle.color,
    });
  }
  for (const polygon of geo.polygons ?? []) {
    rows.push({
      id: polygon.id,
      label: polygon.label,
      detail: `${book ? book.ui.boundaryPolygonWord : 'Boundary polygon'} · ${polygon.ring.length} ${book ? book.ui.pointsWord : 'points'}`,
      color: polygon.color,
    });
  }
  if (rows.length === 0 && (geo.points?.length ?? 0) > 0) {
    rows.push({
      id: 'points',
      label: book ? book.ui.scannedSamplePointsWord : 'Scanned sample points',
      detail: `${geo.points.length} ${book ? book.ui.plottedWord : 'plotted'}`,
      color: '#38bdf8',
    });
  }

  const shown = rows.slice(0, 6);
  const hidden = rows.length - shown.length;

  return (
    <div className="space-y-1">
      {shown.map((row) => (
        <div key={row.id} className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-sm shrink-0"
            style={{ background: row.color }}
          />
          <span className="text-[10px] text-slate-300 truncate">{row.label}</span>
          <span className="text-[9px] text-slate-500 shrink-0 ml-auto">
            {row.detail}
          </span>
        </div>
      ))}
      {hidden > 0 && (
        <p className="text-[10px] text-slate-500 italic">
          {book
            ? book.ui.moreFeaturesOverlaidWord.replace('{n}', String(hidden))
            : `…and ${hidden} more feature${hidden === 1 ? '' : 's'} overlaid on the GIS map.`}
        </p>
      )}
      {!hidden && rows.length > 0 && (
        <p className="text-[9px] text-slate-500 pt-0.5">
          {book ? book.ui.overlaidOnMapWord : 'Overlaid on the Marine GIS map (Zones / layers panel).'}
        </p>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Legend
 * ------------------------------------------------------------------ */

export const ChartLegend: React.FC<{ viz: VisualizationData }> = ({ viz }) => (
  <div className="flex flex-wrap gap-2 pt-1">
    {viz.series.map((s) => (
      <span key={s.id} className="flex items-center gap-1 text-[10px] text-slate-400">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
        {s.label}
        {s.unit ? ` (${s.unit})` : ''}
      </span>
    ))}
  </div>
);

export default Charts;
