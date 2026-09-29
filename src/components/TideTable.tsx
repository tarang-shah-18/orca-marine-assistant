import React from 'react';
import { ArrowDown, ArrowUp, Clock, Waves } from 'lucide-react';
import { TideReport, TidalData } from '../types';
import { Phrasebook } from '../core/i18n';
import { localizeTideReason } from '../core/localize';

/**
 * Tide table.
 *
 * Tide is the number one reason a fisher leaves harbour at a particular hour,
 * so it is rendered as a plain table a screen-reader and a wet finger can both
 * follow: time, height, and whether the water is still making or falling.
 */
interface TideTableProps {
  report?: TideReport;
  compact?: boolean;
  book?: Phrasebook;
}

export const TideTable: React.FC<TideTableProps> = ({ report, compact = false, book }) => {
  if (!report) return null;

  const events = report.events.slice(0, compact ? 6 : 12);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-300">
          <Waves className="w-3.5 h-3.5" />
          <span>{book ? `${book.labels.tide} — ${report.station.name}` : `Tide — ${report.station.name}`}</span>
        </span>
        <span className="text-[10px] text-slate-500">
          {book ? book.ui.tideRangeWord : 'range'} {report.maxRangeMeters.toFixed(2)} m
        </span>
      </div>

      <div className="flex items-center gap-3 text-[11px]">
        <span className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
          <span className="text-slate-400">{book ? book.ui.nowWord : 'Now'} </span>
          <span className="font-bold text-slate-50">{report.currentLevel.toFixed(2)} m</span>
          <span className={`ml-1.5 ${report.isRising ? 'text-emerald-400' : 'text-amber-400'}`}>
            {report.isRising ? `▲ ${book ? book.ui.risingWord : 'rising'}` : `▼ ${book ? book.ui.fallingWord : 'falling'}`}
          </span>
        </span>
        {report.recommendedWindow && (
          <span className="bg-emerald-950/40 border border-emerald-800/60 rounded-lg px-2 py-1 text-emerald-300">
            {book ? book.ui.bestSlackWord : 'Best slack water'} {report.recommendedWindow.startLabel}–{report.recommendedWindow.endLabel}
          </span>
        )}
      </div>

      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-slate-500 text-left">
            <th className="font-medium pb-1">{book ? book.ui.tideEventWord : 'Event'}</th>
            <th className="font-medium pb-1">{book ? book.ui.tideTimeWord : 'Time'}</th>
            <th className="font-medium pb-1 text-right">{book ? book.ui.tideHeightWord : 'Height'}</th>
            <th className="font-medium pb-1 text-right">{book ? book.ui.tideCurrentWord : 'Current'}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <TideRow key={`${event.time}-${event.label}`} event={event} book={book} />
          ))}
        </tbody>
      </table>

      {report.recommendedWindow && !compact && (
        <p className="text-[10px] text-slate-400 flex items-start gap-1.5 pt-1 border-t border-slate-800">
          <Clock className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400" />
          <span>{book ? localizeTideReason(report.recommendedWindow.reason, book) : report.recommendedWindow.reason}</span>
        </p>
      )}

      <p className="text-[10px] text-slate-500">{report.source}</p>
    </div>
  );
};

const TideRow: React.FC<{ event: TidalData; book?: Phrasebook }> = ({ event, book }) => {
  const high = event.type === 'HIGH';
  return (
    <tr className="border-t border-slate-800/60">
      <td className={`py-1 font-semibold ${high ? 'text-rose-300' : 'text-sky-300'}`}>
        {high ? (book ? book.ui.tideHighWord : 'High') : book ? book.ui.tideLowWord : 'Low'}
      </td>
      <td className="py-1 text-slate-300 font-mono">{event.time}</td>
      <td className="py-1 text-right text-slate-50 font-mono">{event.heightMeters.toFixed(2)} m</td>
      <td className="py-1 text-right text-slate-400 font-mono">
        <span className="inline-flex items-center gap-0.5">
          {event.isRising ? <ArrowUp className="w-2.5 h-2.5 text-emerald-400" /> : <ArrowDown className="w-2.5 h-2.5 text-amber-400" />}
          {event.currentKnots.toFixed(1)} kt
        </span>
      </td>
    </tr>
  );
};

export default TideTable;
