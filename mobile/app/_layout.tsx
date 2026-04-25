import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@store/authStore';
import { startSyncListener } from '@services/offlineSync';
import { connectSocket } from '@services/socket';

export default function RootLayout() {
  const { restoreSession, isAuthenticated } = useAuthStore();

  useEffect(() => {
    restoreSession();
    const unsub = startSyncListener();
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      connectSocket();
    }
  }, [isAuthenticated]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#1E3A5F" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="match" />
          <Stack.Screen name="team" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
