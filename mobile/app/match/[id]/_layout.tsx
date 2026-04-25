import { Stack } from 'expo-router';

export default function MatchDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="toss" />
      <Stack.Screen name="score" />
      <Stack.Screen name="live" />
    </Stack>
  );
}
