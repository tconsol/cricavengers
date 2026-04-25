import { Stack } from 'expo-router';

export default function MatchLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="score" />
      <Stack.Screen name="live" />
    </Stack>
  );
}
