import { useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useScoringStore } from '@store/scoringStore';
import { useMatchStore } from '@store/matchStore';
import { useAuthStore } from '@store/authStore';
import { joinMatch, leaveMatch, onMatchEvent } from '@services/socket';
import ScoreBoard from '@components/scoring/ScoreBoard';
import RecentBalls from '@components/scoring/RecentBalls';
import ScorecardTab from '@components/scoring/ScorecardTab';

export default function LiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { currentMatch, fetchMatch } = useMatchStore();
  const { summary, fetchSummary, fetchRecentBalls, setLiveUpdate, isLoading } = useScoringStore();

  const load = useCallback(async () => {
    await fetchMatch(id!);
    await fetchSummary(id!);
    const innings = summary?.currentState?.innings || 1;
    await fetchRecentBalls(id!, innings);
  }, [id]);

  useEffect(() => {
    load();
    joinMatch(id!);

    const unsubBall = onMatchEvent('BALL_ADDED', (data) => {
      setLiveUpdate(data as any);
    });
    const unsubUpdate = onMatchEvent('MATCH_UPDATED', (data) => {
      setLiveUpdate(data as any);
    });

    return () => {
      unsubBall();
      unsubUpdate();
      leaveMatch(id!);
    };
  }, [id]);

  const canScore = currentMatch?.roles?.some(
    (r: any) => r.userId?._id === user?._id && ['scorer', 'umpire', 'organizer'].includes(r.role)
  ) || currentMatch?.createdBy?._id === user?._id;

  const isLive = ['FIRST_INNINGS', 'SECOND_INNINGS'].includes(currentMatch?.state || '');

  if (isLoading && !currentMatch) {
    return (
      <SafeAreaView className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator size="large" color="#F4A200" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View className="flex-1 mx-3">
          <Text className="text-white font-bold" numberOfLines={1}>{currentMatch?.title}</Text>
          <Text className="text-blue-200 text-xs">{currentMatch?.venue}</Text>
        </View>
        {isLive && (
          <View className="flex-row items-center bg-red-500 rounded-full px-2 py-1 gap-1">
            <View className="w-1.5 h-1.5 rounded-full bg-white" />
            <Text className="text-white text-xs font-bold">LIVE</Text>
          </View>
        )}
      </View>

      <ScrollView className="flex-1 bg-surface rounded-t-3xl" showsVerticalScrollIndicator={false}>
        {/* ScoreBoard */}
        {summary && <ScoreBoard match={currentMatch} summary={summary} />}

        {/* Recent Balls */}
        <RecentBalls matchId={id!} />

        {/* Scorecard */}
        <ScorecardTab matchId={id!} />

        {/* Match Info */}
        <View className="mx-4 mb-8 bg-white rounded-2xl p-4">
          <Text className="font-bold text-gray-700 mb-2">Match Info</Text>
          <View className="flex-row gap-2 flex-wrap">
            {[
              { label: 'Format', value: currentMatch?.format },
              { label: 'Overs', value: currentMatch?.totalOvers },
              { label: 'Status', value: currentMatch?.state?.replace(/_/g, ' ') },
            ].map((i) => (
              <View key={i.label} className="bg-gray-50 rounded-xl px-3 py-2">
                <Text className="text-xs text-gray-400">{i.label}</Text>
                <Text className="font-semibold text-gray-700">{i.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Score Button */}
      {canScore && isLive && (
        <View className="px-4 pb-4 pt-2 bg-surface">
          <TouchableOpacity
            className="bg-primary rounded-2xl py-4 items-center flex-row justify-center gap-2"
            onPress={() => router.push(`/match/${id}/score`)}
          >
            <Ionicons name="baseball" size={22} color="white" />
            <Text className="text-white font-bold text-lg">Score This Match</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
