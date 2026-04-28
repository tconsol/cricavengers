import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '@store/authStore';
import { useMatchStore } from '@store/matchStore';
import { useTeamStore } from '@store/teamStore';
import { useTournamentStore } from '@store/tournamentStore';
import { startSyncListener } from '@services/offlineSync';
import { connectSocket } from '@services/socket';

// Keep the native splash visible until our animated splash takes over
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const { restoreSession, isAuthenticated } = useAuthStore();
  const initMatchListeners = useMatchStore((s) => s.initSocketListeners);
  const initTeamListeners = useTeamStore((s) => s.initSocketListeners);
  const initTournamentListeners = useTournamentStore((s) => s.initSocketListeners);

  useEffect(() => {
    restoreSession().finally(() => {
      // Hide native splash — our custom animated splash in index.tsx takes over
      SplashScreen.hideAsync().catch(() => {});
    });
    const unsub = startSyncListener();
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    connectSocket();
    // Small delay to let socket connect before attaching listeners
    const t = setTimeout(() => {
      const u1 = initMatchListeners();
      const u2 = initTeamListeners();
      const u3 = initTournamentListeners();
      return () => { u1(); u2(); u3(); };
    }, 500);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#1E3A5F" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="match" />
          <Stack.Screen name="team" />
          <Stack.Screen name="tournament" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
