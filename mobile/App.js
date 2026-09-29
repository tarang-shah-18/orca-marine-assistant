/**
 * ORCA — Android client.
 *
 * Smart India Hackathon 2026 · Problem ID 26176.
 * ISRO / Department of Space · Software · Space Technology.
 *
 * This is the native shell around the TypeScript agent engine. It owns the
 * screen, the language, the base harbour and the conversation; it holds no
 * marine logic of its own, so the phone and the web client can never answer the
 * same question differently.
 *
 *   Home  →  the current marine picture, before anything is asked
 *   Chat  →  the conversation, the live agent trace and the structured results
 *   Map   →  marine GIS: fishing zones, advisories, regulated waters, corridors
 *   Data  →  tide, weather, sea state and the geofence picture
 *   Info  →  the agent roster, the engine status and the safety standard
 */

import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, space } from './src/theme';
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import MapScreen from './src/screens/MapScreen';
import ConditionsScreen from './src/screens/ConditionsScreen';
import InfoScreen from './src/screens/InfoScreen';

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'chat', label: 'Chat' },
  { id: 'map', label: 'Map' },
  { id: 'data', label: 'Data' },
  { id: 'info', label: 'Info' },
];

export default function App() {
  const [screen, setScreen] = useState('home');
  const [language, setLanguage] = useState('en-IN');
  const [harbourId, setHarbourId] = useState('mumbai');
  const [gps, setGps] = useState({ state: 'off' });
  const [messages, setMessages] = useState([]);
  /** A question handed over from another screen, consumed exactly once. */
  const [queued, setQueued] = useState(null);

  /** Jump to the conversation, optionally asking something on the way. */
  const ask = useCallback((question) => {
    setQueued(question);
    setScreen('chat');
  }, []);

  const back = useCallback(() => setScreen('home'), []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.void} />

      <View style={styles.body}>
        {screen === 'home' ? (
          <HomeScreen
            language={language}
            onLanguage={setLanguage}
            harbourId={harbourId}
            onHarbour={setHarbourId}
            gps={gps}
            onGps={setGps}
            onAsk={ask}
            onOpenMap={() => setScreen('map')}
            onOpenInfo={() => setScreen('info')}
          />
        ) : null}

        {screen === 'chat' ? (
          <ChatScreen
            language={language}
            harbourId={harbourId}
            gps={gps}
            messages={messages}
            onMessages={setMessages}
            onBack={back}
            onOpenMap={() => setScreen('map')}
            queued={queued}
            onQueuedConsumed={() => setQueued(null)}
          />
        ) : null}

        {screen === 'map' ? (
          <MapScreen
            harbourId={harbourId}
            language={language}
            gps={gps}
            onBack={back}
            onAsk={ask}
          />
        ) : null}

        {screen === 'data' ? (
          <ConditionsScreen
            harbourId={harbourId}
            language={language}
            gps={gps}
            onBack={back}
            onAsk={ask}
          />
        ) : null}

        {screen === 'info' ? <InfoScreen onBack={back} /> : null}
      </View>

      {/* Tab bar. Hidden on Home, which is a landing page rather than a peer. */}
      {screen === 'home' ? null : (
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const active = screen === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setScreen(tab.id)}
                style={styles.tab}
              >
                <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>
                  {tab.label}
                </Text>
                <View style={[styles.tabUnderline, active ? styles.tabUnderlineActive : null]} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={styles.disclaimer}>
        Decision support only. Always defer to IMD, INCOIS and port authority warnings.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.void },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: 'center', paddingBottom: 6 },
  tabLabel: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  tabLabelActive: { color: colors.cyan },
  tabUnderline: { height: 2, width: 22, borderRadius: 1, marginTop: 3, backgroundColor: 'transparent' },
  tabUnderlineActive: { backgroundColor: colors.cyan },
  disclaimer: {
    color: colors.textFaint,
    fontSize: 8,
    textAlign: 'center',
    paddingVertical: 3,
    paddingHorizontal: space.md,
    backgroundColor: colors.void,
  },
});
