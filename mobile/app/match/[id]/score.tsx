import { useEffect, useState, useCallback } from 'react';
import { View, Text, Alert, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useScoringStore } from '@store/scoringStore';
import { useMatchStore } from '@store/matchStore';
import BallInput from '@components/scoring/BallInput';
import ScoreBoard from '@components/scoring/ScoreBoard';
import RecentBalls from '@components/scoring/RecentBalls';
import WicketModal from '@components/scoring/WicketModal';
import ExtrasModal from '@components/scoring/ExtrasModal';
import NewBatsmanModal from '@components/scoring/NewBatsmanModal';
import NewBowlerModal from '@components/scoring/NewBowlerModal';

export default function ScoringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentMatch, fetchMatch } = useMatchStore();
  const { summary, addBall, undoBall, fetchSummary, fetchRecentBalls, liveState, isLoading } = useScoringStore();

  const [extraType, setExtraType]         = useState<string | null>(null);
  const [showWicket, setShowWicket]       = useState(false);
  const [showExtras, setShowExtras]       = useState(false);
  const [showNewBatter, setShowNewBatter] = useState(false);
  const [showNewBowler, setShowNewBowler] = useState(false);
  const [pendingBall, setPendingBall]     = useState<any>(null);
  const [isSubmitting, setIsSubmitting]   = useState(false);

  const innings = liveState?.innings || 1;
  const striker    = liveState?.striker;
  const nonStriker = liveState?.nonStriker;
  const bowler     = liveState?.currentBowler;

  useEffect(() => {
    fetchMatch(id!);
    fetchSummary(id!);
    fetchRecentBalls(id!, innings);
  }, [id]);

  const handleBallPress = useCallback(async (runs: number) => {
    if (!striker || !bowler) {
      Alert.alert('Setup Required', 'Please set batsmen and bowler first');
      return;
    }

    const ball = {
      innings: innings as 1 | 2,
      batsman: striker?._id || striker,
      bowler:  bowler?._id  || bowler,
      runs,
      extras: extraType ? { type: extraType, runs: extraType === 'wide' || extraType === 'no_ball' ? 1 : 0 } : null,
      strikerAfter: runs % 2 !== 0 ? (nonStriker?._id || nonStriker) : (striker?._id || striker),
      nonStrikerAfter: runs % 2 !== 0 ? (striker?._id || striker) : (nonStriker?._id || nonStriker),
    };

    setPendingBall(ball);
    setExtraType(null);

    await submitBall(ball);
  }, [striker, nonStriker, bowler, innings, extraType]);

  const submitBall = async (ball: any) => {
    setIsSubmitting(true);
    try {
      await addBall(id!, ball);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await fetchRecentBalls(id!, innings);

      // Check if over is complete (6 legal balls)
      const balls = (liveState?.ball || 0);
      if (balls === 0 && (liveState?.over || 0) > 0) {
        setShowNewBowler(true);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record ball');
    } finally {
      setIsSubmitting(false);
      setPendingBall(null);
    }
  };

  const handleWicketBall = async (runs: number, wicketData: any) => {
    const ball = {
      innings: innings as 1 | 2,
      batsman: striker?._id || striker,
      bowler:  bowler?._id  || bowler,
      runs,
      wicket: wicketData,
      strikerAfter: null,
      nonStrikerAfter: nonStriker?._id || nonStriker,
    };
    setShowWicket(false);
    await submitBall(ball);
    setShowNewBatter(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const handleUndo = () => {
    Alert.alert('Undo Last Ball', 'This will remove the last ball and recompute scores.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Undo', style: 'destructive',
        onPress: async () => {
          try {
            await undoBall(id!, innings);
            await fetchRecentBalls(id!, innings);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch (err: any) {
            Alert.alert('Error', err.message);
          }
        },
      },
    ]);
  };

  const inningsSummary = summary?.innings?.[innings - 1];

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white font-bold text-lg ml-3 flex-1" numberOfLines={1}>
          {currentMatch?.title}
        </Text>
        <TouchableOpacity onPress={handleUndo}>
          <View className="bg-white/20 rounded-full px-3 py-1 flex-row items-center gap-1">
            <Ionicons name="arrow-undo" size={16} color="white" />
            <Text className="text-white text-xs font-semibold">Undo</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ScoreBoard */}
      {summary && (
        <ScoreBoard match={currentMatch} summary={summary} compact />
      )}

      {/* Players on pitch */}
      <View className="flex-row px-4 py-2 gap-2">
        <View className="flex-1 bg-white/10 rounded-xl px-3 py-2">
          <Text className="text-blue-200 text-xs">Striker</Text>
          <Text className="text-white font-bold text-sm" numberOfLines={1}>
            {striker?.name || 'Set Batsman'}
          </Text>
          {inningsSummary?.batting?.find((b: any) => b.playerId === (striker?._id || striker)) && (
            <Text className="text-accent text-xs">
              {inningsSummary.batting.find((b: any) => b.playerId === (striker?._id || striker))?.runs}
              ({inningsSummary.batting.find((b: any) => b.playerId === (striker?._id || striker))?.balls})
            </Text>
          )}
        </View>
        <View className="flex-1 bg-white/10 rounded-xl px-3 py-2">
          <Text className="text-blue-200 text-xs">Non-Striker</Text>
          <Text className="text-white font-bold text-sm" numberOfLines={1}>
            {nonStriker?.name || 'Set Batsman'}
          </Text>
        </View>
        <View className="flex-1 bg-white/10 rounded-xl px-3 py-2">
          <Text className="text-blue-200 text-xs">Bowler</Text>
          <Text className="text-white font-bold text-sm" numberOfLines={1}>
            {bowler?.name || 'Set Bowler'}
          </Text>
          {inningsSummary?.bowling?.find((b: any) => b.playerId === (bowler?._id || bowler)) && (
            <Text className="text-accent text-xs">
              {inningsSummary.bowling.find((b: any) => b.playerId === (bowler?._id || bowler))?.wickets}/
              {inningsSummary.bowling.find((b: any) => b.playerId === (bowler?._id || bowler))?.runs}
            </Text>
          )}
        </View>
      </View>

      {/* Main Scoring Pad */}
      <View className="flex-1 bg-surface rounded-t-3xl px-4 pt-4">
        {/* Extra type selector */}
        <View className="flex-row gap-2 mb-3">
          {[
            { key: null,      label: 'Normal' },
            { key: 'wide',    label: 'Wide' },
            { key: 'no_ball', label: 'No Ball' },
            { key: 'bye',     label: 'Bye' },
            { key: 'leg_bye', label: 'Leg Bye' },
          ].map((e) => (
            <TouchableOpacity
              key={String(e.key)}
              className={`flex-1 py-2 rounded-xl items-center ${
                extraType === e.key ? 'bg-accent' : 'bg-gray-100'
              }`}
              onPress={() => setExtraType(extraType === e.key ? null : e.key)}
            >
              <Text className={`text-xs font-bold ${extraType === e.key ? 'text-white' : 'text-gray-600'}`}>
                {e.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ball Input Grid */}
        <BallInput
          onBallPress={handleBallPress}
          onWicket={() => setShowWicket(true)}
          isSubmitting={isSubmitting}
        />

        {/* Recent Balls */}
        <RecentBalls matchId={id!} compact />
      </View>

      {/* Modals */}
      <WicketModal
        visible={showWicket}
        onClose={() => setShowWicket(false)}
        onSubmit={handleWicketBall}
        batsmen={[
          { _id: striker?._id || striker, name: striker?.name || 'Striker' },
          { _id: nonStriker?._id || nonStriker, name: nonStriker?.name || 'Non-Striker' },
        ]}
        match={currentMatch}
        innings={innings}
      />

      <NewBatsmanModal
        visible={showNewBatter}
        onClose={() => setShowNewBatter(false)}
        match={currentMatch}
        innings={innings}
        matchId={id!}
      />

      <NewBowlerModal
        visible={showNewBowler}
        onClose={() => setShowNewBowler(false)}
        match={currentMatch}
        innings={innings}
        matchId={id!}
      />
    </SafeAreaView>
  );
}
