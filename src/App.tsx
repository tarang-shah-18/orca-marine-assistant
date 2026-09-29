import { useCallback, useEffect, useRef, useState } from 'react';
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
import { HARBORS, HARBOR_BY_ID } from './core/dataset';
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
    // Private mode / no storage: default to dark.
  }
  return 'dark';
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
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Non-fatal.
    }
  }, [theme]);

  const refreshBrief = useCallback(async () => {
    const ticket = ++briefRequest.current;
    setBriefLoading(true);
    try {
      const outcome = await situation(harbor.id, currentLanguage.code);
      if (ticket !== briefRequest.current) return;
      setBrief(outcome.brief);
      setBriefOffline(outcome.offline);
    } catch {
      if (ticket === briefRequest.current) setBrief(null);
    } finally {
      if (ticket === briefRequest.current) setBriefLoading(false);
    }
  }, [harbor.id, currentLanguage.code]);

  useEffect(() => {
    void refreshBrief();
  }, [refreshBrief]);

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

  const acquireGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsState('denied');
      return;
    }
    setGpsState('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsState('ok');
        setGpsFix({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        void refreshBrief();
      },
      () => {
        setGpsState('denied');
        setGpsFix(null);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );
  }, [refreshBrief]);

  const toggleGps = useCallback(() => {
    if (gpsFix) {
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
    // explicit choice wins until the user re-requests location.
    setGpsFix(null);
    setGpsState('idle');
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
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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

      {isApkModalOpen && <ApkExportModal onClose={() => setIsApkModalOpen(false)} />}
    </AppShell>
  );
}