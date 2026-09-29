/**
 * Conversation memory store.
 *
 * The blackboard in `agents/base.ts` only lives for one turn; memory is what
 * makes "is it safe *there* tomorrow" resolve to the fishing ground found in
 * the previous turn. It has to outlive a single request, so the server keeps a
 * small in-process store keyed by an opaque session id.
 *
 * A real deployment would swap this for Redis or a table without touching any
 * agent, because nothing outside this file knows where memory lives.
 *
 * Set `ORCA_SESSIONS_FILE` to a writable path to persist sessions to JSON so a
 * server restart (deploy, crash, demo machine reboot) doesn't drop active
 * conversations. Persistence is best-effort: any read/write failure only
 * degrades to the in-memory store, never crashes a turn.
 */

import * as fs from 'fs';
import { ConversationMemory } from '../types';
import { freshMemory } from '../agents/orchestrator';

/** Bound on retained sessions; oldest entries are evicted first. */
const MAX_SESSIONS = 200;
const IDLE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

const SESSIONS_FILE =
  typeof process !== 'undefined' && process.env?.ORCA_SESSIONS_FILE
    ? process.env.ORCA_SESSIONS_FILE
    : '';

interface Entry {
  memory: ConversationMemory;
  touchedAt: number;
}

const store = new Map<string, Entry>();

function evictIfNeeded(): void {
  const now = Date.now();

  for (const [id, entry] of store) {
    if (now - entry.touchedAt > IDLE_TTL_MS) store.delete(id);
  }

  if (store.size <= MAX_SESSIONS) return;
  const ordered = [...store.entries()].sort((a, b) => a[1].touchedAt - b[1].touchedAt);
  for (const [id] of ordered.slice(0, store.size - MAX_SESSIONS)) store.delete(id);
}

export function readMemory(sessionId?: string | null): ConversationMemory {
  if (!sessionId) return freshMemory();
  const entry = store.get(sessionId);
  if (!entry) return freshMemory();
  entry.touchedAt = Date.now();
  // Hand back a copy: agents mutate `memory.activeZone` in place, and a
  // corrupted store would poison every later turn.
  return { ...entry.memory, mentionedLocations: [...entry.memory.mentionedLocations] };
}

export function writeMemory(
  sessionId: string | null | undefined,
  memory: ConversationMemory,
): void {
  if (!sessionId) return;
  store.set(sessionId, { memory, touchedAt: Date.now() });
  evictIfNeeded();
  scheduleSave();
}

export function resetMemory(sessionId?: string | null): void {
  if (!sessionId) return;
  store.delete(sessionId);
  scheduleSave();
}

export function sessionCount(): number {
  return store.size;
}

/* ------------------------------------------------------------------ *
 * Optional JSON persistence
 * ------------------------------------------------------------------ */

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(): void {
  if (!SESSIONS_FILE) return;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistSessions();
  }, 1000);
}

function persistSessions(): void {
  if (!SESSIONS_FILE) return;
  try {
    const data = [...store.entries()].map(([id, entry]) => ({
      id,
      memory: entry.memory,
      touchedAt: entry.touchedAt,
    }));
    const tmp = `${SESSIONS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, SESSIONS_FILE);
  } catch (error) {
    console.warn('[session] persist failed:', error instanceof Error ? error.message : error);
  }
}

function hydrateSessions(): void {
  if (!SESSIONS_FILE) return;
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return;
    const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')) as Array<{
      id: string;
      memory: ConversationMemory;
      touchedAt: number;
    }>;
    for (const { id, memory, touchedAt } of data) {
      if (
        typeof id === 'string' &&
        memory &&
        typeof touchedAt === 'number' &&
        Date.now() - touchedAt <= IDLE_TTL_MS
      ) {
        store.set(id, { memory, touchedAt });
      }
    }
  } catch (error) {
    console.warn('[session] hydrate failed:', error instanceof Error ? error.message : error);
  }
}

hydrateSessions();

/** Flush pending writes synchronously (called on graceful shutdown). */
export function flushSessions(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  persistSessions();
}