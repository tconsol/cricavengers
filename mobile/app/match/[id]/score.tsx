import { useEffect, useState, useCallback } from 'react';
import { View, Text, Alert, TouchableOpacity } from 'react-native';
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
import NewBatsmanModal from '@components/scoring/NewBatsmanModal';
import NewBowlerModal from '@components/scoring/NewBowlerModal';

// ── Extra runs picker shown inline when an extra type is tapped ──
const EXTRA_META: Record<string, { title: string; subtitle: string; color: string }> = {
  wide:    { title: 'Wide',     subtitle: 'Runs from the wide? (1 penalty auto-added)', color: '#B45309' },
  no_ball: { title: 'No Ball',  subtitle: 'Runs scored off the bat?',                  color: '#C2410C' },
  bye:     { title: 'Bye',      subtitle: 'Bye runs (credited to extras)',              color: '#6D28D9' },
  leg_bye: { title: 'Leg Bye',  subtitle: 'Leg bye runs (credited to extras)',          color: '#1D4ED8' },
};

function ExtraRunsPicker({
  type, onConfirm, onCancel,
}: {
  type: string;
  onConfirm: (runs: number) => void;
  onCancel: () => void;
}) {
  const meta = EXTRA_META[type] || { title: type, subtitle: 'Runs?', color: '#374151' };
  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: meta.color }}>{meta.title}</Text>
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{meta.subtitle}</Text>
        </View>
        <TouchableOpacity
          onPress={onCancel}
          style={{ backgroundColor: '#F3F4F6', borderRadius: 20, padding: 8 }}
        >
          <Ionicons name="close" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Run buttons 0-6 grid */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        {[0, 1, 2, 3, 4, 6].map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => onConfirm(r)}
            style={{
              flex: 1, aspectRatio: 1, borderRadius: 18,
              backgroundColor: r === 4 ? '#DCFCE7' : r === 6 ? '#FEF9C3' : '#EFF6FF',
              borderWidth: 2,
              borderColor: r === 4 ? '#4ADE80' : r === 6 ? '#FCD34D' : '#BFDBFE',
              alignItems: 'center', justifyContent: 'center',
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 24, fontWeight: '900', color: r === 4 ? '#16A34A' : r === 6 ? '#B45309' : '#1D4ED8' }}>
              {r}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Dotted 5 */}
      <TouchableOpacity
        onPress={() => onConfirm(5)}
        style={{
          paddingVertical: 12, borderRadius: 14,
          backgroundColor: '#FFF7ED', borderWidth: 1.5, borderColor: '#FDBA74',
          alignItems: 'center',
        }}
        activeOpacity={0.7}
      >
        <Text style={{ fontWeight: '800', color: '#C2410C' }}>5  <Text style={{ fontWeight: '400', fontSize: 12, color: '#9CA3AF' }}>(rare)</Text></Text>
      </TouchableOpacity>

      {type === 'wide' && (
        <Text style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 10 }}>
          Total extras = 1 (wide penalty) + selected runs
        </Text>
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────────────
export default function ScoringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentMatch, fetchMatch } = useMatchStore();
  const { summary, addBall, undoBall, fetchSummary, fetchRecentBalls, liveState, isLoading } = useScoringStore();

  const [showWicket, setShowWicket]       = useState(false);
  const [showNewBatter, setShowNewBatter] = useState(false);
  const [showNewBowler, setShowNewBowler] = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);

  // Extra flow state
  const [pendingExtraType, setPendingExtraType] = useState<string | null>(null);

  const innings    = liveState?.innings || 1;
  const striker    = liveState?.striker;
  const nonStriker = liveState?.nonStriker;
  const bowler     = liveState?.currentBowler;

  useEffect(() => {
    fetchMatch(id!);
    fetchSummary(id!);
    fetchRecentBalls(id!, innings);
  }, [id]);

  const submitBall = async (ball: any) => {
    if (!striker || !bowler) {
      Alert.alert('Setup Required', 'Please set batsmen and bowler first');
      return;
    }
    setIsSubmitting(true);
    try {
      await addBall(id!, ball);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await fetchRecentBalls(id!, innings);

      // Prompt for new bowler when over is complete
      const ballsAfter = liveState?.ball ?? 0;
      if (ballsAfter === 0 && (liveState?.over ?? 0) > 0) {
        setShowNewBowler(true);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record ball');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Normal run (no extra)
  const handleBallPress = useCallback(async (runs: number) => {
    if (!striker || !bowler) {
      Alert.alert('Setup Required', 'Please set batsmen and bowler first');
      return;
    }
    const sId  = striker?._id  || striker;
    const nsId = nonStriker?._id || nonStriker;
    const bId  = bowler?._id   || bowler;

    const ball = {
      innings: innings as 1 | 2,
      batsman: sId,
      bowler:  bId,
      runs,
      extras: null,
      strikerAfter:    runs % 2 !== 0 ? nsId : sId,
      nonStrikerAfter: runs % 2 !== 0 ? sId  : nsId,
    };
    await submitBall(ball);
  }, [striker, nonStriker, bowler, innings]);

  // Extra type button pressed → show picker
  const handleExtraPress = useCallback((type: string) => {
    if (!striker || !bowler) {
      Alert.alert('Setup Required', 'Please set batsmen and bowler first');
      return;
    }
    setPendingExtraType(type);
  }, [striker, bowler]);

  // Extra runs selected from picker
  const handleExtraRunsConfirm = useCallback(async (extraRuns: number) => {
    const type = pendingExtraType!;
    setPendingExtraType(null);

    const sId  = striker?._id  || striker;
    const nsId = nonStriker?._id || nonStriker;
    const bId  = bowler?._id   || bowler;

    let runs   = 0;
    let extras: any;
    let strikerAfter: any;
    let nonStrikerAfter: any;

    if (type === 'wide') {
      // Wide: always 0 bat runs; penalty 1 + boundary runs go to extras
      // Strike does NOT rotate on a wide
      runs   = 0;
      extras = { type: 'wide', runs: 1 + extraRuns };
      strikerAfter    = sId;
      nonStrikerAfter = nsId;
    } else if (type === 'no_ball') {
      // No Ball: off-bat runs credited to batsman; 1 penalty always to extras
      // Strike rotates based on off-bat runs
      runs   = extraRuns;
      extras = { type: 'no_ball', runs: 1 };
      strikerAfter    = extraRuns % 2 !== 0 ? nsId : sId;
      nonStrikerAfter = extraRuns % 2 !== 0 ? sId  : nsId;
    } else {
      // Bye / Leg Bye: 0 bat runs; runs go to extras
      // Strike rotates based on bye runs
      runs   = 0;
      extras = { type, runs: extraRuns };
      strikerAfter    = extraRuns % 2 !== 0 ? nsId : sId;
      nonStrikerAfter = extraRuns % 2 !== 0 ? sId  : nsId;
    }

    const ball = {
      innings: innings as 1 | 2,
      batsman: sId,
      bowler:  bId,
      runs,
      extras,
      strikerAfter,
      nonStrikerAfter,
    };
    await submitBall(ball);
  }, [pendingExtraType, striker, nonStriker, bowler, innings]);

  // Wicket
  const handleWicketBall = async (runs: number, wicketData: any) => {
    if (!striker || !bowler) {
      Alert.alert('Setup Required', 'Please set batsmen and bowler first');
      return;
    }
    const sId  = striker?._id  || striker;
    const nsId = nonStriker?._id || nonStriker;
    const bId  = bowler?._id   || bowler;

    const ball = {
      innings: innings as 1 | 2,
      batsman: sId,
      bowler:  bId,
      runs,
      wicket: wicketData,
      strikerAfter:    null,
      nonStrikerAfter: nsId,
    };
    setShowWicket(false);
    setIsSubmitting(true);
    try {
      await addBall(id!, ball);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await fetchRecentBalls(id!, innings);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record wicket');
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
    setShowNewBatter(true);
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
      {summary && <ScoreBoard match={currentMatch} summary={summary} compact />}

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
        {pendingExtraType ? (
          <ExtraRunsPicker
            type={pendingExtraType}
            onConfirm={handleExtraRunsConfirm}
            onCancel={() => setPendingExtraType(null)}
          />
        ) : (
          <BallInput
            onBallPress={handleBallPress}
            onWicket={() => setShowWicket(true)}
            onExtra={handleExtraPress}
            isSubmitting={isSubmitting}
          />
        )}

        {/* Recent Balls always visible */}
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
