import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell, ViewId } from './components/AppShell';
import { ChatScreen } from './components/ChatScreen';
import { MapScreen } from './components/MapScreen';
import { InfoScreen } from './components/InfoScreen';
import { FleetWatchScreen } from './components/FleetWatchScreen';
import { LanguageModal } from './components/LanguageModal';
import { ApkExportModal } from './components/ApkExportModal';
import { PersonaDashboard } from './components/dashboards';
import type { DashboardProps } from './components/dashboards/common';
import {
  ChatMessage,
  HarborLocation,
  LanguageOption,
  PFZZone,
  SUPPORTED_LANGUAGES,
} from './types';
import type { LatLon } from './core/geo';
import { getPhrasebook } from './core/i18n';
import { useAutoRefresh } from './hooks/useNow';
import { HARBORS, HARBOR_BY_ID, findNearestHarbor } from './core/dataset';
import {
  engineStatus,
  mapBundle,
  resetConversation,
  situation,
  type EngineStatus,
  type MapBundle,
  type SituationBrief,
} from './services/orcaApi';
import { PERSONA_BY_ID, PersonaId } from './personas';

const PERSONA_KEY = 'orca.persona';
const THEME_KEY = 'orca-theme';

/**
 * How often the client re-asks the engine for the situation report.
 *
 * Matches the engine's `TTL_MS` (12 minutes). Below that the server answers from
 * an in-memory snapshot, so a faster poll returns an identical payload while
 * consuming the free tier's request budget and, on Render's shared egress IP,
 * pushing the live weather source further into its 429 back-off. Above it, the
 * screen can sit stale for no reason.
 */
const AUTO_REFRESH_MS = 12 * 60 * 1000;

type ThemeMode = 'dark' | 'light';

function loadPersona(): PersonaId {
  try {
    const stored = localStorage.getItem(PERSONA_KEY);
    if (stored && stored in PERSONA_BY_ID) return stored as PersonaId;
  } catch {
    // Private mode / no storage: default to the fisher.
  }
  return 'fisher';
}

function loadTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Private mode / no storage: fall through to the default below.
  }
  // Light by default. Most fishers check this on a phone in bright sun, where
  // a dark console is harder to read than the HUD look suggests, and the light
  // palette is a full theme rather than an inverted afterthought — it redefines
  // the same slate ramp, so every component flips without a single class change.
  // The toggle still offers dark for night work.
  return 'light';
}

/**
 * ORCA application shell.
 *
 * The shell owns the things every role depends on — harbour, language, the
 * live GPS fix, the proactive brief, the map bundle and the engine roster —
 * and the five persona dashboards compose them. Screens remain thin: they
 * render and dispatch, they never fetch.
 */
export default function App() {
  const [persona, setPersona] = useState<PersonaId>(loadPersona);
  const [theme, setTheme] = useState<ThemeMode>(loadTheme);
  const [view, setView] = useState<ViewId>('dashboard');
  const [currentLanguage, setCurrentLanguage] = useState<LanguageOption>(SUPPORTED_LANGUAGES[0]);
  // One phrasebook per render pass. Screens take it as a required prop rather
  // than looking it up themselves, so a screen cannot silently disagree with
  // the shell about which language it is rendering.
  const book = useMemo(() => getPhrasebook(currentLanguage.code), [currentLanguage.code]);
  const [harbor, setHarbor] = useState<HarborLocation>(HARBOR_BY_ID.mumbai ?? HARBORS[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [brief, setBrief] = useState<SituationBrief | null>(null);
  const [briefOffline, setBriefOffline] = useState(false);
  const [briefLoading, setBriefLoading] = useState(true);
  const [bundle, setBundle] = useState<MapBundle | null>(null);
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [focusZone, setFocusZone] = useState<PFZZone | undefined>(undefined);
  const [gpsFix, setGpsFix] = useState<LatLon | null>(null);
  const [gpsState, setGpsState] = useState<'idle' | 'locating' | 'ok' | 'denied'>('idle');
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  /**
   * When the situation report on screen actually arrived. Tracked separately
   * from the data itself because the age is a fact about *this screen*, not
   * about the payload: the same response cached for an hour is an hour old.
   */
  const [briefReceivedAt, setBriefReceivedAt] = useState<number | null>(null);
  /** Which harbour the engine anchored the report to, and how far from the fix. */
  const [briefAnchor, setBriefAnchor] = useState<{
    harborId: string;
    harborName: string;
    distanceKm: number | null;
  } | null>(null);

  // Guards against a slow brief for a previous harbour overwriting the current
  // one when a user switches port twice in quick succession.
  const briefRequest = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(PERSONA_KEY, persona);
    } catch {
      // Non-fatal.
    }
  }, [persona]);

  // The active light/dark theme lives on <html data-theme="..."> so the CSS
  // variable overrides in index.css can flip the entire palette. Persisted so
  // the choice survives a reload.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // Keep the mobile browser chrome (status bar, address bar) the same colour
    // as the page. This is a phone-first app, and a dark status bar above a
    // light page reads as a rendering fault. index.html ships the light value so
    // the first paint is already correct.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#032b43' : '#f6f9fc');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Non-fatal.
    }
  }, [theme]);

  /**
   * Which harbour the request should be about.
   *
   * A GPS fix outranks the manual selection, so this collapses to one value:
   * the nearest port to the fix when location is on, the selected port
   * otherwise. That collapse matters for more than tidiness — it is what keeps
   * `refreshBrief`'s identity stable while a boat drifts. Reading the raw fix
   * would rebuild the callback on every `watchPosition` callback, and each
   * rebuild would fire the mount effect, so a user with location on would pull
   * a full situation report every thirty seconds and blow the engine's cache
   * window for no gain.
   */
  const gpsAnchorId = gpsFix ? findNearestHarbor(gpsFix.latitude, gpsFix.longitude).id : null;
  const requestHarborId = gpsAnchorId ?? harbor.id;

  // The fix itself is read through a ref so the callback above can stay stable.
  const gpsFixRef = useRef<LatLon | null>(null);
  gpsFixRef.current = gpsFix;

  const refreshBrief = useCallback(async () => {
    const ticket = ++briefRequest.current;
    setBriefLoading(true);
    try {
      // The fix is forwarded, not just displayed. The prototype resolved a GPS
      // fix to a coordinate and then asked the engine about `harbor` anyway, so
      // turning location on changed the badge and nothing else — which is
      // indistinguishable, to the person using it, from a button that does not
      // work.
      const outcome = await situation(requestHarborId, currentLanguage.code, gpsFixRef.current);
      if (ticket !== briefRequest.current) return;
      setBrief(outcome.brief);
      setBriefOffline(outcome.offline);
      setBriefReceivedAt(outcome.receivedAt);
      setBriefAnchor(outcome.anchor);

      // Reconcile the selection to what the engine actually used. A fix out at
      // sea usually resolves to a different port than the one on screen, and
      // leaving the old harbour selected is how the two halves of the app end
      // up describing different places.
      if (outcome.anchor && outcome.anchor.harborId !== harbor.id) {
        const resolved = HARBOR_BY_ID[outcome.anchor.harborId];
        if (resolved) setHarbor(resolved);
      }
    } catch {
      if (ticket === briefRequest.current) {
        setBrief(null);
        setBriefReceivedAt(Date.now());
      }
    } finally {
      if (ticket === briefRequest.current) setBriefLoading(false);
    }
  }, [requestHarborId, currentLanguage.code, harbor.id]);

  useEffect(() => {
    void refreshBrief();
  }, [refreshBrief]);

  /**
   * Keep the screen current without being asked.
   *
   * Aligned to the engine's own cache TTL rather than to a round number: at
   * twelve minutes the engine's live snapshot has just expired, so a poll now
   * can actually return something new. Polling every sixty seconds would burn
   * the free-tier request budget for the same answer repeated sixty times, and
   * on Render's shared egress IP it would also push the live weather source
   * further into its 429 back-off.
   *
   * The hook also refreshes on tab-visible and on connectivity-restored, which
   * is the case that matters most: a phone coming out of a pocket after an hour
   * must not sit on an hour-old report for another twelve minutes.
   */
  useAutoRefresh(refreshBrief, AUTO_REFRESH_MS);

  // The map bundle powers four of the five dashboards (zones, alerts,
  // geofences, route). Refresh it with the brief and the engine roster.
  useEffect(() => {
    let alive = true;
    setBundle(null);
    void mapBundle(harbor.id, currentLanguage.code).then((data) => {
      if (alive) setBundle(data);
    });
    void engineStatus().then(setStatus);
    return () => {
      alive = false;
    };
  }, [harbor.id, currentLanguage.code]);

  const stopWatching = useRef<(() => void) | null>(null);

  const acquireGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsState('denied');
      return;
    }
    setGpsState('locating');

    // `watchPosition`, not `getCurrentPosition`. A one-shot fix is a photo of
    // where the boat was when the button was pressed; a boat is moving, and the
    // whole point of asking for location is to keep asking. Watching also means
    // the app recovers on its own after a GPS outage indoors and then out again,
    // instead of staying wrong until the user toggles the button off and on.
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsState('ok');
        setGpsFix({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      () => {
        setGpsState('denied');
        setGpsFix(null);
      },
      // maximumAge 30s lets the device reuse a recent fix rather than spinning a
      // cold acquisition on every callback; timeout only bounds the *first*
      // fix, not later ones, which is the correct reading of the spec.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
    stopWatching.current = () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Stop the watcher if the app unmounts — a geolocation subscription outliving
  // its component keeps the GPS radio on, which is the one thing a fisher on a
  // battery will notice and blame on the app.
  useEffect(() => () => stopWatching.current?.(), []);

  const toggleGps = useCallback(() => {
    if (gpsFix) {
      stopWatching.current?.();
      stopWatching.current = null;
      setGpsFix(null);
      setGpsState('idle');
      void refreshBrief();
      return;
    }
    acquireGps();
  }, [acquireGps, gpsFix, refreshBrief]);

  const handleSelectHarbor = useCallback((next: HarborLocation) => {
    setHarbor(next);
    // A hand-set port and a live GPS fix are different sources of truth; the
    // explicit choice wins until the user re-requests location. Choosing a port
    // by hand stops the watcher, because otherwise the next fix would silently
    // override the choice a second later.
    stopWatching.current?.();
    stopWatching.current = null;
    setGpsFix(null);
    setGpsState('idle');
    setBriefAnchor(null);
    setFocusZone(undefined);
  }, []);

  const openMap = useCallback((zone?: PFZZone) => {
    if (zone) setFocusZone(zone);
    setView('map');
  }, []);

  /** Seed a question straight into the decision chat, switching view. */
  const askQuestion = useCallback((question: string, questionHarborId?: string) => {
    if (questionHarborId) {
      const target = HARBOR_BY_ID[questionHarborId];
      if (target) {
        setHarbor(target);
        // A question seeded against a named port is an explicit choice, so it
        // cancels location rather than being silently overridden by the next
        // watchPosition callback a second later.
        stopWatching.current?.();
        stopWatching.current = null;
        setGpsFix(null);
        setGpsState('idle');
      }
    }
    setView('chat');
    setMessages((prev) => [
      ...prev,
      {
        id: `user-seed-${Date.now()}`,
        sender: 'user',
        text: question,
        // IST, not the device zone, to match the freshness strip and every
        // bulletin the answer will be read alongside. `toLocaleTimeString` with
        // no explicit zone would print whatever timezone the phone happens to be
        // in, which on this product is frequently not the one the data is in.
        timestamp: new Date().toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      },
    ]);
  }, []);

  const handleNewConversation = useCallback(() => {
    resetConversation();
    setMessages([]);
    setView('chat');
  }, []);

  const dashboardProps: DashboardProps = {
    persona: PERSONA_BY_ID[persona],
    harbor,
    language: currentLanguage,
    brief,
    briefOffline,
    briefLoading,
    bundle,
    bundleOffline: status?.offline ?? false,
    status,
    onAsk: askQuestion,
    onOpenMap: openMap,
  };

  return (
    <AppShell
      persona={persona}
      onPersonaChange={setPersona}
      theme={theme}
      onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      view={view}
      onViewChange={setView}
      harbor={harbor}
      onSelectHarbor={handleSelectHarbor}
      language={currentLanguage}
      onOpenLanguage={() => setIsLanguageModalOpen(true)}
      status={status}
      onRefreshBrief={() => void refreshBrief()}
      briefLoading={briefLoading}
      gpsFix={gpsFix}
      gpsState={gpsState}
      onToggleGps={toggleGps}
      briefReceivedAt={briefReceivedAt}
      briefAnchor={briefAnchor}
    >
      {view === 'dashboard' && <PersonaDashboard personaId={persona} {...dashboardProps} />}

      {view === 'chat' && (
        <ChatScreen
          onBack={() => setView('dashboard')}
          onOpenMap={openMap}
          onOpenLanguage={() => setIsLanguageModalOpen(true)}
          onOpenInfo={() => setView('info')}
          currentLanguage={currentLanguage}
          harbor={harbor}
          messages={messages}
          onMessagesChange={setMessages}
          onNewConversation={handleNewConversation}
          gpsFix={gpsFix}
        />
      )}

      {view === 'map' && (
        <MapScreen
          onBack={() => setView('dashboard')}
          harbor={harbor}
          onSelectHarbor={handleSelectHarbor}
          focusZone={focusZone}
          onClearFocus={() => setFocusZone(undefined)}
          currentLanguage={currentLanguage}
          gpsFix={gpsFix}
          onAskAbout={askQuestion}
        />
      )}

      {view === 'fleet' && (
        <FleetWatchScreen
          onBack={() => setView('dashboard')}
          harbor={harbor}
          language={currentLanguage}
          onSelectHarbor={handleSelectHarbor}
          onAsk={askQuestion}
          onOpenMap={openMap}
        />
      )}

      {view === 'info' && (
        <InfoScreen
          onBack={() => setView('dashboard')}
          onOpenApkModal={() => setIsApkModalOpen(true)}
          onOpenChat={handleNewConversation}
          harbor={harbor}
          onSelectHarbor={handleSelectHarbor}
          currentLanguage={currentLanguage}
        />
      )}

      {isLanguageModalOpen && (
        <LanguageModal
          currentLanguage={currentLanguage}
          onSelectLanguage={setCurrentLanguage}
          onClose={() => setIsLanguageModalOpen(false)}
        />
      )}

      {isApkModalOpen && (
        <ApkExportModal onClose={() => setIsApkModalOpen(false)} book={book} />
      )}
    </AppShell>
  );
}