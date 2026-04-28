import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Alert, TouchableOpacity, Animated, ScrollView, ActivityIndicator, Modal, FlatList } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useScoringStore } from '@store/scoringStore';
import { useMatchStore } from '@store/matchStore';
import { useAuthStore } from '@store/authStore';
import { onEvent } from '@services/socket';
import { api } from '@services/api';
import RecentBalls from '@components/scoring/RecentBalls';
import WicketModal from '@components/scoring/WicketModal';
import NewBatsmanModal from '@components/scoring/NewBatsmanModal';
import NewBowlerModal from '@components/scoring/NewBowlerModal';
import GroundPicker from '@components/scoring/GroundPicker';
import { generateCommentary } from '@utils/commentary';

const getBallDisplayStyle = (ball: any) => {
  if (ball.wicket) return { bg: '#EF4444', color: '#fff', label: 'W' };
  if (ball.extras?.type === 'wide') return { bg: '#FEF3C7', color: '#D97706', label: 'Wd' };
  if (ball.extras?.type === 'no_ball') return { bg: '#FED7AA', color: '#EA580C', label: 'Nb' };
  if (ball.runs === 6) return { bg: '#16A34A', color: '#fff', label: '6' };
  if (ball.runs === 4) return { bg: '#2563EB', color: '#fff', label: '4' };
  return { bg: '#E5E7EB', color: '#374151', label: String(ball.runs ?? 0) };
};

// ── Extra runs picker ─────────────────────────────────────────
const EXTRA_META: Record<string, { title: string; subtitle: string; color: string }> = {
  wide:    { title: 'Wide',     subtitle: 'Runs from the wide? (1 penalty auto-added)', color: '#B45309' },
  no_ball: { title: 'No Ball',  subtitle: 'Runs scored off the bat?',                  color: '#C2410C' },
  bye:     { title: 'Bye',      subtitle: 'Bye runs (credited to extras)',              color: '#6D28D9' },
  leg_bye: { title: 'Leg Bye',  subtitle: 'Leg bye runs (credited to extras)',          color: '#1D4ED8' },
};

function ExtraRunsPicker({
  type, onConfirm, onCancel,
}: { type: string; onConfirm: (runs: number) => void; onCancel: () => void }) {
  const meta = EXTRA_META[type] || { title: type, subtitle: 'Runs?', color: '#374151' };
  return (
    <View style={{ flex: 1 }}>
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

// ── Commentary Toast ──────────────────────────────────────────
function CommentaryToast({ text, visible }: { text: string; visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && text) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2600),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, text]);

  if (!text) return null;
  return (
    <Animated.View style={{
      position: 'absolute', bottom: 110, left: 12, right: 12,
      backgroundColor: '#1E3A5F', borderRadius: 14,
      paddingHorizontal: 16, paddingVertical: 10, opacity, zIndex: 100,
    }}>
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 18 }}>{text}</Text>
    </Animated.View>
  );
}

// ── Transfer Scoring Modal ────────────────────────────────────
function TransferScoringModal({ visible, onClose, match, matchId }: {
  visible: boolean; onClose: () => void; match: any; matchId: string;
}) {
  const { user } = useAuthStore();
  const { fetchMatch } = useMatchStore();
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const currentScorers: any[] = (match?.roles || []).filter((r: any) => r.role === 'scorer');

  const handleRevoke = async (targetId: string, name: string) => {
    Alert.alert('Revoke Access', `Remove scorer access for ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive',
        onPress: async () => {
          setRevoking(targetId);
          try {
            await api.delete(`/matches/${matchId}/roles/${targetId}`);
            await fetchMatch(matchId);
            onClose();
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to revoke access');
          } finally {
            setRevoking(null);
          }
        },
      },
    ]);
  };

  const allPlayers: any[] = [
    ...(match?.squadA || match?.teamA?.players || []),
    ...(match?.squadB || match?.teamB?.players || []),
  ];

  const myId = user?._id?.toString();
  const existingScorerIds = new Set(
    (match?.roles || [])
      .filter((r: any) => r.role === 'scorer')
      .map((r: any) => (r.userId?._id || r.userId)?.toString())
  );

  const available = allPlayers.filter((p: any) => {
    const pid = (p.userId?._id || p.userId)?.toString();
    return pid && pid !== myId && !existingScorerIds.has(pid);
  });

  const handleTransfer = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.post(`/matches/${matchId}/roles`, { userId: selected, role: 'scorer' });
      Alert.alert('Scoring Transferred', 'The selected player now has scoring access.');
      setSelected('');
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to transfer scoring');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 32, paddingTop: 16 }}>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' }} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 2 }}>Transfer Scoring</Text>
          <Text style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 12 }}>Select a player to hand over scoring access</Text>

          {/* Current scorers with revoke */}
          {currentScorers.length > 0 && (
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#9CA3AF', marginBottom: 8, letterSpacing: 0.5 }}>CURRENT SCORERS</Text>
              {currentScorers.map((r: any) => {
                const uid = (r.userId?._id || r.userId)?.toString();
                const name = r.userId?.name || 'Unknown';
                return (
                  <View key={uid} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      <Text style={{ fontWeight: '900', color: '#DC2626', fontSize: 12 }}>{name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <Text style={{ flex: 1, fontWeight: '600', color: '#111827', fontSize: 13 }}>{name}</Text>
                    <TouchableOpacity
                      onPress={() => handleRevoke(uid, name)}
                      disabled={revoking === uid}
                      style={{ backgroundColor: '#DC2626', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                    >
                      {revoking === uid
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Revoke</Text>}
                    </TouchableOpacity>
                  </View>
                );
              })}
              <View style={{ height: 1, backgroundColor: '#E5E7EB', marginBottom: 12 }} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#9CA3AF', marginBottom: 8, letterSpacing: 0.5 }}>ADD NEW SCORER</Text>
            </View>
          )}

          {available.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 15 }}>No players available</Text>
            </View>
          ) : (
            <FlatList
              data={available}
              keyExtractor={(p: any) => (p.userId?._id || p.userId)?.toString() || p.name}
              renderItem={({ item }: any) => {
                const pid = (item.userId?._id || item.userId)?.toString();
                const isSelected = selected === pid;
                return (
                  <TouchableOpacity
                    onPress={() => setSelected(pid)}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, marginBottom: 8,
                      backgroundColor: isSelected ? '#EFF6FF' : '#F9FAFB',
                      borderWidth: 2, borderColor: isSelected ? '#2563EB' : '#F3F4F6',
                    }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ fontWeight: '900', color: '#1D4ED8', fontSize: 13 }}>
                        {item.jerseyNumber ?? item.name?.slice(0, 2)?.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ flex: 1, fontWeight: '700', color: '#111827', fontSize: 14 }} numberOfLines={1}>{item.name}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#2563EB" />}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 300 }}
              showsVerticalScrollIndicator={false}
            />
          )}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity
              onPress={() => { setSelected(''); onClose(); }}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '700', color: '#6B7280' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleTransfer}
              disabled={!selected || submitting}
              style={{ flex: 2, paddingVertical: 14, borderRadius: 18, alignItems: 'center', backgroundColor: selected && !submitting ? '#1E3A5F' : '#E5E7EB' }}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ fontWeight: '800', fontSize: 15, color: selected ? '#fff' : '#9CA3AF' }}>Transfer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Innings Break Modal ───────────────────────────────────────
function InningsBreakModal({ visible, match, matchId }: {
  visible: boolean; match: any; matchId: string;
}) {
  const firstInn = match?.innings?.first;
  const totalBalls = firstInn?.balls ?? 0;
  const oversDisplay = `${Math.floor(totalBalls / 6)}.${totalBalls % 6}`;
  const secBattingId = (match?.innings?.second?.battingTeam?._id || match?.innings?.second?.battingTeam)?.toString();
  const battingTeamName = secBattingId === match?.teamA?._id?.toString()
    ? (match?.teamA?.name || match?.teamA?.shortName)
    : (match?.teamB?.name || match?.teamB?.shortName);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 36 }}>⚡</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#1E3A5F', marginBottom: 4 }}>Innings Over!</Text>
          <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 20 }}>1st innings complete — time to chase</Text>

          <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, width: '100%', marginBottom: 12, alignItems: 'center' }}>
            <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '700', marginBottom: 4 }}>1ST INNINGS</Text>
            <Text style={{ fontSize: 44, fontWeight: '900', color: '#1E3A5F' }}>
              {firstInn?.totalRuns ?? 0}/{firstInn?.wickets ?? 0}
            </Text>
            <Text style={{ color: '#6B7280', fontSize: 14 }}>({oversDisplay} overs)</Text>
          </View>

          <View style={{ backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12, width: '100%', marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>
              {battingTeamName || '2nd innings'} need
            </Text>
            <Text style={{ color: '#DC2626', fontWeight: '900', fontSize: 24 }}>
              {(firstInn?.totalRuns ?? 0) + 1}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.replace(`/match/${matchId}/toss` as any)}
            style={{ backgroundColor: '#1E3A5F', borderRadius: 16, paddingVertical: 16, width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            activeOpacity={0.85}
          >
            <Ionicons name="baseball" size={18} color="#F59E0B" />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Set 2nd Innings Players →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Match Complete Modal ──────────────────────────────────────
function MatchCompleteModal({ visible, match, matchId }: {
  visible: boolean; match: any; matchId: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', alignItems: 'center' }}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>🏆</Text>
          <Text style={{ fontSize: 24, fontWeight: '900', color: '#1E3A5F', marginBottom: 8 }}>Match Complete!</Text>
          {match?.result?.description ? (
            <View style={{ backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, width: '100%', marginBottom: 20 }}>
              <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 16, textAlign: 'center' }}>
                {match.result.description}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity
            onPress={() => router.replace(`/match/${matchId}/live` as any)}
            style={{ backgroundColor: '#1E3A5F', borderRadius: 16, paddingVertical: 16, width: '100%', alignItems: 'center' }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>View Scorecard →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Super Over Break Modal ────────────────────────────────────
function SuperOverBreakModal({ visible, onStartSuperOver, onEndAsTie }: {
  visible: boolean;
  onStartSuperOver: () => void;
  onEndAsTie: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', alignItems: 'center' }}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>🔥</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#1E3A5F', marginBottom: 8 }}>Match Tied!</Text>
          <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 24, textAlign: 'center' }}>
            Scores are level at the end of regulation. Proceed to a Super Over or end the match as a tie.
          </Text>
          <TouchableOpacity
            onPress={onStartSuperOver}
            style={{ backgroundColor: '#F59E0B', borderRadius: 16, paddingVertical: 16, width: '100%', alignItems: 'center', marginBottom: 10 }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Play Super Over</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onEndAsTie}
            style={{ backgroundColor: '#F3F4F6', borderRadius: 16, paddingVertical: 14, width: '100%', alignItems: 'center' }}
            activeOpacity={0.85}
          >
            <Text style={{ color: '#374151', fontWeight: '700', fontSize: 15 }}>End Match as Tie</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Super Over Innings Break Modal ────────────────────────────
function SuperOverInningsBreakModal({ visible, match, matchId }: {
  visible: boolean; match: any; matchId: string;
}) {
  const soFirst = match?.superOver?.first;
  const target = (soFirst?.totalRuns ?? 0) + 1;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 24, width: '100%', alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 36 }}>⚡</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#1E3A5F', marginBottom: 4 }}>Super Over — 1st Innings Done!</Text>
          <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 20 }}>Now the 2nd team bats their over</Text>

          <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, width: '100%', marginBottom: 12, alignItems: 'center' }}>
            <Text style={{ color: '#6B7280', fontSize: 11, fontWeight: '700', marginBottom: 4 }}>SUPER OVER — 1ST INNINGS</Text>
            <Text style={{ fontSize: 44, fontWeight: '900', color: '#1E3A5F' }}>
              {soFirst?.totalRuns ?? 0}/{soFirst?.wickets ?? 0}
            </Text>
          </View>

          <View style={{ backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12, width: '100%', marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>Target</Text>
            <Text style={{ color: '#DC2626', fontWeight: '900', fontSize: 24 }}>{target}</Text>
          </View>

          <TouchableOpacity
            onPress={() => router.replace(`/match/${matchId}/toss` as any)}
            style={{ backgroundColor: '#1E3A5F', borderRadius: 16, paddingVertical: 16, width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            activeOpacity={0.85}
          >
            <Ionicons name="baseball" size={18} color="#F59E0B" />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Set 2nd Super Over Players →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Scoring Screen ───────────────────────────────────────
export default function ScoringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentMatch, fetchMatch } = useMatchStore();
  const { summary, addBall, undoBall, fetchSummary, fetchRecentBalls, liveState, isLoading, recentBalls } = useScoringStore();

  const [showWicket, setShowWicket]           = useState(false);
  const [showNewBatter, setShowNewBatter]     = useState(false);
  const [showNewBowler, setShowNewBowler]     = useState(false);
  const [showTransfer, setShowTransfer]       = useState(false);
  const [showInningsBreak, setShowInningsBreak] = useState(false);
  const [showMatchComplete, setShowMatchComplete] = useState(false);
  const [showSuperOverBreak, setShowSuperOverBreak] = useState(false);
  const [showSuperOverInningsBreak, setShowSuperOverInningsBreak] = useState(false);
  const [isSubmitting, setIsSubmitting]       = useState(false);

  // When wicket falls on last ball of over: show new bowler after new batter is set
  const [pendingNewBowlerAfterBatter, setPendingNewBowlerAfterBatter] = useState(false);

  // Extra flow
  const [pendingExtraType, setPendingExtraType] = useState<string | null>(null);

  // Ground picker flow — holds the ball payload while waiting for shot region
  const [showGroundPicker, setShowGroundPicker] = useState(false);
  const [pendingBall, setPendingBall] = useState<any>(null);
  const [pickerCommentary, setPickerCommentary] = useState('');

  // Commentary toast
  const [lastCommentary, setLastCommentary]       = useState('');
  const [commentaryVisible, setCommentaryVisible] = useState(false);
  const commentaryKey = useRef(0);

  const innings    = liveState?.innings || 1;
  const striker    = liveState?.striker;
  const nonStriker = liveState?.nonStriker;
  const bowler     = liveState?.currentBowler;

  const inningsSummary = summary?.innings?.[innings - 1];

  // Resolve names: populated object has .name; fallback to batting/bowling stats array
  const strikerId       = striker?._id    || (typeof striker    === 'string' ? striker    : null);
  const nonStrikerId    = nonStriker?._id || (typeof nonStriker === 'string' ? nonStriker : null);
  const bowlerId        = bowler?._id     || (typeof bowler     === 'string' ? bowler     : null);
  const strikerStats    = inningsSummary?.batting?.find((b: any) => b.playerId === strikerId);
  const nonStrikerStats = inningsSummary?.batting?.find((b: any) => b.playerId === nonStrikerId);
  const bowlerStats     = inningsSummary?.bowling?.find((b: any) => b.playerId === bowlerId);
  const strikerName     = striker?.name    || strikerStats?.playerName    || 'Set Batsman';
  const nonStrikerName  = nonStriker?.name || nonStrikerStats?.playerName || 'Set Batsman';
  const bowlerName      = bowler?.name     || bowlerStats?.playerName     || 'Set Bowler';

  // Initial load
  useEffect(() => {
    fetchMatch(id!);
    fetchSummary(id!);
  }, [id]);

  // Re-fetch balls whenever innings changes (covers first load + innings transition)
  useEffect(() => {
    if (id) fetchRecentBalls(id, innings);
  }, [id, innings]);

  // Live updates from other devices / viewers via socket
  useEffect(() => {
    const unsubBall = onEvent('BALL_ADDED', (data: any) => {
      if (data?.summary) {
        useScoringStore.setState({
          summary: data.summary,
          liveState: data.summary?.currentState || null,
        });
      }
      if (data?.ball) {
        useScoringStore.setState((s) => {
          if (s.recentBalls.some((b: any) => b._id === data.ball._id)) return {};
          return { recentBalls: [data.ball, ...s.recentBalls].slice(0, 12) };
        });
      }
    });
    const unsubState = onEvent('MATCH_STATE_CHANGED', (data: any) => {
      if (data?.state === 'INNINGS_BREAK') setShowInningsBreak(true);
      if (data?.state === 'COMPLETED') setShowMatchComplete(true);
      if (data?.state === 'SUPER_OVER_BREAK') setShowSuperOverBreak(true);
      if (data?.state === 'SUPER_OVER_INNINGS_BREAK') setShowSuperOverInningsBreak(true);
    });
    const unsubPlayerChange = onEvent('PLAYER_CHANGED', (data: any) => {
      if (data?.summary) {
        useScoringStore.setState({
          summary: data.summary,
          liveState: data.summary?.currentState || null,
        });
      }
    });
    const unsubRemove = onEvent('BALL_REMOVED', (data: any) => {
      if (data?.summary) {
        useScoringStore.setState({
          summary: data.summary,
          liveState: data.summary?.currentState || null,
        });
      }
      if (data?.removedBallId) {
        useScoringStore.setState((s: any) => ({
          recentBalls: s.recentBalls.filter((b: any) => b._id !== data.removedBallId),
        }));
      }
    });
    return () => { unsubBall(); unsubState(); unsubPlayerChange(); unsubRemove(); };
  }, []);

  // Show commentary toast
  const showCommentary = useCallback((text: string) => {
    commentaryKey.current += 1;
    setLastCommentary(text);
    setCommentaryVisible(false);
    requestAnimationFrame(() => setCommentaryVisible(true));
  }, []);

  const _checkInningsEnd = async () => {
    await fetchMatch(id!);
    const updatedState = useMatchStore.getState().currentMatch?.state;
    if (updatedState === 'INNINGS_BREAK')           { setShowInningsBreak(true);           return true; }
    if (updatedState === 'COMPLETED')               { setShowMatchComplete(true);           return true; }
    if (updatedState === 'SUPER_OVER_BREAK')        { setShowSuperOverBreak(true);          return true; }
    if (updatedState === 'SUPER_OVER_INNINGS_BREAK') { setShowSuperOverInningsBreak(true);  return true; }
    return false;
  };

  // Actually send the ball to server (called after ground picker)
  const doSubmitBall = async (ball: any) => {
    setIsSubmitting(true);
    try {
      await addBall(id!, ball);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await fetchRecentBalls(id!, innings);

      // Read fresh state from store — closure snapshot is stale after async addBall
      const freshState = useScoringStore.getState().liveState;
      const currentMatchState = useMatchStore.getState().currentMatch?.state;
      const isSuperOverInnings = currentMatchState === 'SUPER_OVER_1' || currentMatchState === 'SUPER_OVER_2';
      const totalOvers = isSuperOverInnings ? 1 : (useMatchStore.getState().currentMatch?.totalOvers ?? 99);
      const maxWickets = isSuperOverInnings ? 2 : 10;
      const overEnded = (freshState?.ball ?? 0) === 0 && (freshState?.over ?? 0) > 0;
      const allOversUp = overEnded && (freshState?.over ?? 0) >= totalOvers;
      const allOut     = (freshState?.wickets ?? 0) >= maxWickets;

      if (allOversUp || allOut) {
        await _checkInningsEnd();
      } else if (overEnded && !isSuperOverInnings) {
        setShowNewBowler(true);
      } else if (overEnded && isSuperOverInnings) {
        // Super over: 1 over = innings ends, handled by _checkInningsEnd above
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record ball');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ground picker confirmed (region may be null if skipped)
  const handleGroundConfirm = useCallback(async (region: string | null) => {
    setShowGroundPicker(false);
    if (!pendingBall) return;

    const ball = region ? { ...pendingBall, shotRegion: region } : pendingBall;
    setPendingBall(null);

    // Show commentary toast
    const commentary = generateCommentary(ball, strikerName, bowlerName);
    showCommentary(commentary);

    // Haptics for highlights
    if (ball.wicket) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if ((ball.runs ?? 0) >= 4) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    await doSubmitBall(ball);
  }, [pendingBall, striker, bowler]);

  // Stage a ball → open ground picker
  const stageBall = useCallback((ball: any) => {
    if (!striker || !bowler) {
      Alert.alert('Setup Required', 'Please set batsmen and bowler first');
      return;
    }
    const commentary = generateCommentary(ball, strikerName, bowlerName);
    setPendingBall(ball);
    setPickerCommentary(commentary);
    setShowGroundPicker(true);
  }, [striker, bowler]);

  // Normal run button pressed
  const handleBallPress = useCallback((runs: number) => {
    if (!striker || !bowler) {
      Alert.alert('Setup Required', 'Please set batsmen and bowler first');
      return;
    }
    const sId  = striker?._id  || striker;
    const nsId = nonStriker?._id || nonStriker;
    const bId  = bowler?._id   || bowler;

    // At the end of every over batsmen swap ends regardless of runs.
    // XOR: (crossed on runs) XOR (end-of-over swap) → net position of striker.
    const isLastLegalBall = (liveState?.ball ?? 0) === 5;
    const crossedEnds = (runs % 2 !== 0) !== isLastLegalBall;

    stageBall({
      innings: innings as 1 | 2 | 3 | 4,
      batsman: sId,
      bowler:  bId,
      runs,
      extras: null,
      strikerAfter:    crossedEnds ? nsId : sId,
      nonStrikerAfter: crossedEnds ? sId  : nsId,
    });
  }, [striker, nonStriker, bowler, innings, stageBall, liveState?.ball]);

  // Extra type button pressed → show extra picker first
  const handleExtraPress = useCallback((type: string) => {
    if (!striker || !bowler) {
      Alert.alert('Setup Required', 'Please set batsmen and bowler first');
      return;
    }
    setPendingExtraType(type);
  }, [striker, bowler]);

  // Extra runs selected → stage ball → open ground picker
  const handleExtraRunsConfirm = useCallback((extraRuns: number) => {
    const type = pendingExtraType!;
    setPendingExtraType(null);

    const sId  = striker?._id  || striker;
    const nsId = nonStriker?._id || nonStriker;
    const bId  = bowler?._id   || bowler;

    let runs: number;
    let extras: any;
    let strikerAfter: any;
    let nonStrikerAfter: any;

    // Only legal deliveries (bye, leg_bye) trigger end-of-over swap.
    // Wide and no-ball are not legal — over does not advance.
    const isLastLegalBall = (liveState?.ball ?? 0) === 5;

    if (type === 'wide') {
      runs   = 0;
      extras = { type: 'wide', runs: 1 + extraRuns };
      // Wide is not a legal delivery → no end-of-over; wide runs cause normal odd/even swap
      strikerAfter    = extraRuns % 2 !== 0 ? nsId : sId;
      nonStrikerAfter = extraRuns % 2 !== 0 ? sId  : nsId;
    } else if (type === 'no_ball') {
      runs   = extraRuns;
      extras = { type: 'no_ball', runs: 1 };
      // No-ball is not legal → no end-of-over swap
      strikerAfter    = extraRuns % 2 !== 0 ? nsId : sId;
      nonStrikerAfter = extraRuns % 2 !== 0 ? sId  : nsId;
    } else {
      // bye / leg_bye are legal deliveries — apply end-of-over XOR
      runs   = 0;
      extras = { type, runs: extraRuns };
      const crossedEnds = (extraRuns % 2 !== 0) !== isLastLegalBall;
      strikerAfter    = crossedEnds ? nsId : sId;
      nonStrikerAfter = crossedEnds ? sId  : nsId;
    }

    stageBall({
      innings: innings as 1 | 2 | 3 | 4,
      batsman: sId,
      bowler:  bId,
      runs,
      extras,
      strikerAfter,
      nonStrikerAfter,
    });
  }, [pendingExtraType, striker, nonStriker, bowler, innings, stageBall]);

  // Wicket: submit immediately (no ground picker before — show picker after)
  const handleWicketBall = async (runs: number, wicketData: any) => {
    if (!striker || !bowler) {
      Alert.alert('Setup Required', 'Please set batsmen and bowler first');
      return;
    }
    const sId  = striker?._id  || striker;
    const nsId = nonStriker?._id || nonStriker;
    const bId  = bowler?._id   || bowler;

    const ball = {
      innings: innings as 1 | 2 | 3 | 4,
      batsman: sId,
      bowler:  bId,
      runs,
      wicket: wicketData,
      strikerAfter:    null,
      nonStrikerAfter: nsId,
    };

    setShowWicket(false);

    // Stage ball for ground picker (prominent for wicket)
    const commentary = generateCommentary(ball, strikerName, bowlerName);
    setPendingBall(ball);
    setPickerCommentary(commentary);
    setShowGroundPicker(true);
  };

  // After ground picker for wicket, need to show new batter
  const handleGroundConfirmWithWicket = useCallback(async (region: string | null) => {
    setShowGroundPicker(false);
    if (!pendingBall) return;

    const ball = region ? { ...pendingBall, shotRegion: region } : pendingBall;
    const isWicket = !!ball.wicket;
    setPendingBall(null);

    const commentary = generateCommentary(ball, strikerName, bowlerName);
    showCommentary(commentary);

    setIsSubmitting(true);
    try {
      await addBall(id!, ball);
      if (isWicket) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if ((ball.runs ?? 0) >= 4) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      await fetchRecentBalls(id!, innings);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record ball');
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);

    // Read fresh state from store — closure snapshot is stale after async addBall
    const freshState = useScoringStore.getState().liveState;
    const totalOvers = useMatchStore.getState().currentMatch?.totalOvers ?? 99;
    const overEnded = (freshState?.ball ?? 0) === 0 && (freshState?.over ?? 0) > 0;
    const allOversUp = overEnded && (freshState?.over ?? 0) >= totalOvers;
    const allOut     = (freshState?.wickets ?? 0) >= 10;

    if (allOversUp || allOut) {
      await _checkInningsEnd();
    } else if (isWicket) {
      setShowNewBatter(true);
      if (overEnded) setPendingNewBowlerAfterBatter(true);
    } else if (overEnded) {
      setShowNewBowler(true);
    }
  }, [pendingBall, striker, bowler, innings, id]);

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

  const isWicketPending = pendingBall?.wicket != null;

  // Deduplicate + sort current-over balls for "This Over" strip
  const seenBalls = new Set<string>();
  const thisOverSorted = recentBalls
    .filter((b) => {
      if (b.over !== (liveState?.over ?? 0)) return false;
      if (!b._id) return true;
      if (seenBalls.has(b._id)) return false;
      seenBalls.add(b._id); return true;
    })
    .sort((a, b) => a.ball - b.ball);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1E3A5F' }} edges={['top']}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={{ flex: 1, color: '#fff', fontWeight: '800', fontSize: 15 }} numberOfLines={1}>
          {currentMatch?.title || 'Scoring'}
        </Text>
        <TouchableOpacity onPress={() => setShowTransfer(true)} style={{ marginRight: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Ionicons name="swap-horizontal" size={13} color="#93C5FD" />
            <Text style={{ color: '#93C5FD', fontSize: 12, fontWeight: '700' }}>Transfer</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push(`/match/${id}/live` as any)}
          style={{ marginRight: 6, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="eye-outline" size={16} color="#93C5FD" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleUndo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Ionicons name="arrow-undo" size={13} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Undo</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Score Hero ──────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: '#93C5FD', fontSize: 10, fontWeight: '700', marginBottom: 1 }}>
              {innings === 1 ? '1ST INNINGS' : '2ND INNINGS'}
            </Text>
            <Text style={{ color: '#F59E0B', fontSize: 50, fontWeight: '900', lineHeight: 54 }}>
              {liveState?.totalRuns ?? 0}/{liveState?.wickets ?? 0}
            </Text>
            <Text style={{ color: '#93C5FD', fontSize: 13 }}>
              ({liveState?.over ?? 0}.{liveState?.ball ?? 0} ov)
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', paddingBottom: 4 }}>
            {liveState?.target ? (
              <>
                <Text style={{ color: '#93C5FD', fontSize: 10, fontWeight: '600' }}>TARGET</Text>
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>{liveState.target}</Text>
                {liveState.requiredRuns != null && (
                  <Text style={{ color: '#F59E0B', fontSize: 11 }}>
                    Need {liveState.requiredRuns} @ {liveState.requiredRate?.toFixed(2)}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={{ color: '#93C5FD', fontSize: 10, fontWeight: '600' }}>CRR</Text>
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900' }}>
                  {(liveState?.currentRate ?? 0).toFixed(2)}
                </Text>
                {currentMatch?.totalOvers && (
                  <Text style={{ color: '#93C5FD', fontSize: 11 }}>
                    Proj: {Math.round((liveState?.currentRate ?? 0) * currentMatch.totalOvers)}
                  </Text>
                )}
              </>
            )}
          </View>
        </View>
      </View>

      {/* ── This Over Strip ─────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#93C5FD', fontSize: 9, fontWeight: '800', minWidth: 38 }}>
            OV {(liveState?.over ?? 0) + 1}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 5 }}>
            {thisOverSorted.map((ball) => {
              const s = getBallDisplayStyle(ball);
              return (
                <View key={ball._id || `${ball.over}-${ball.ball}`} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: s.color }}>{s.label}</Text>
                </View>
              );
            })}
            {Array.from({ length: Math.max(0, 6 - thisOverSorted.filter((b: any) => { const et = b.extras?.type; return et !== 'wide' && et !== 'no_ball'; }).length) }).map((_, i) => (
              <View key={`e${i}`} style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.2)' }}>·</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* ── Players Row ─────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, gap: 6, paddingBottom: 12 }}>
        {/* Striker */}
        <View style={{ flex: 2.2, backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.28)' }}>
          <Text style={{ color: '#F59E0B', fontSize: 9, fontWeight: '800', marginBottom: 2 }}>STRIKER ★</Text>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }} numberOfLines={1}>{strikerName}</Text>
          {strikerStats ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 2 }}>
                <Text style={{ color: '#F59E0B', fontSize: 20, fontWeight: '900' }}>{strikerStats.runs}</Text>
                <Text style={{ color: '#93C5FD', fontSize: 12 }}>({strikerStats.balls})</Text>
              </View>
              <Text style={{ color: '#93C5FD', fontSize: 9, marginTop: 1 }}>4s:{strikerStats.fours}  6s:{strikerStats.sixes}</Text>
            </>
          ) : (
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>not batting</Text>
          )}
        </View>

        {/* Non-Striker */}
        <View style={{ flex: 1.6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 10 }}>
          <Text style={{ color: '#93C5FD', fontSize: 9, fontWeight: '800', marginBottom: 2 }}>NON-STRIKER</Text>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }} numberOfLines={1}>{nonStrikerName}</Text>
          {nonStrikerStats ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 2 }}>
              <Text style={{ color: '#E5E7EB', fontSize: 16, fontWeight: '800' }}>{nonStrikerStats.runs}</Text>
              <Text style={{ color: '#93C5FD', fontSize: 10 }}>({nonStrikerStats.balls})</Text>
            </View>
          ) : (
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>—</Text>
          )}
        </View>

        {/* Bowler */}
        <View style={{ flex: 1.6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 10 }}>
          <Text style={{ color: '#93C5FD', fontSize: 9, fontWeight: '800', marginBottom: 2 }}>BOWLER</Text>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }} numberOfLines={1}>{bowlerName}</Text>
          {bowlerStats ? (
            <>
              <Text style={{ color: '#F87171', fontSize: 14, fontWeight: '800', marginTop: 2 }}>
                {bowlerStats.wickets}/{bowlerStats.runs}
              </Text>
              <Text style={{ color: '#93C5FD', fontSize: 9 }}>Eco {(bowlerStats.economy ?? 0).toFixed(1)}</Text>
            </>
          ) : (
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>—</Text>
          )}
        </View>
      </View>

      {/* ══ Scoring Pad ═══════════════════════════════════════════ */}
      <View style={{ flex: 1, backgroundColor: '#F8FAFC', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 14, paddingHorizontal: 12, paddingBottom: 4 }}>
        {pendingExtraType ? (
          <ExtraRunsPicker
            type={pendingExtraType}
            onConfirm={handleExtraRunsConfirm}
            onCancel={() => setPendingExtraType(null)}
          />
        ) : (
          <>
            {/* Row 1: 0 1 2 3 */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {[0, 1, 2, 3].map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => !isSubmitting && handleBallPress(r)}
                  disabled={isSubmitting}
                  activeOpacity={0.7}
                  style={{
                    flex: 1, aspectRatio: 1.05, borderRadius: 16,
                    backgroundColor: r === 0 ? '#E5E7EB' : '#EFF6FF',
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5,
                    borderColor: r === 0 ? '#D1D5DB' : '#BFDBFE',
                    opacity: isSubmitting ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: 32, fontWeight: '900', color: r === 0 ? '#6B7280' : '#1D4ED8' }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Row 2: 4 · 6 · WICKET */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => !isSubmitting && handleBallPress(4)}
                disabled={isSubmitting}
                activeOpacity={0.7}
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 16,
                  backgroundColor: '#DCFCE7', borderWidth: 2, borderColor: '#4ADE80',
                  alignItems: 'center', justifyContent: 'center',
                  opacity: isSubmitting ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 34, fontWeight: '900', color: '#16A34A' }}>4</Text>
                <Text style={{ fontSize: 10, color: '#22C55E', fontWeight: '700' }}>FOUR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => !isSubmitting && handleBallPress(6)}
                disabled={isSubmitting}
                activeOpacity={0.7}
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 16,
                  backgroundColor: '#FEF9C3', borderWidth: 2, borderColor: '#FCD34D',
                  alignItems: 'center', justifyContent: 'center',
                  opacity: isSubmitting ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 34, fontWeight: '900', color: '#B45309' }}>6</Text>
                <Text style={{ fontSize: 10, color: '#D97706', fontWeight: '700' }}>SIX</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => !isSubmitting && setShowWicket(true)}
                disabled={isSubmitting}
                activeOpacity={0.8}
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 16,
                  backgroundColor: '#EF4444',
                  alignItems: 'center', justifyContent: 'center',
                  opacity: isSubmitting ? 0.5 : 1,
                }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={{ fontSize: 22 }}>🏏</Text>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>WICKET</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Row 3: Extras + 5 */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { key: 'wide',    label: 'Wd',  bg: '#FEFCE8', text: '#B45309', border: '#FCD34D' },
                { key: 'no_ball', label: 'NB',  bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' },
                { key: 'bye',     label: 'Bye', bg: '#F5F3FF', text: '#6D28D9', border: '#C4B5FD' },
                { key: 'leg_bye', label: 'LB',  bg: '#EFF6FF', text: '#1D4ED8', border: '#93C5FD' },
              ].map((e) => (
                <TouchableOpacity
                  key={e.key}
                  onPress={() => !isSubmitting && handleExtraPress(e.key)}
                  disabled={isSubmitting}
                  activeOpacity={0.7}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 12,
                    backgroundColor: e.bg, borderWidth: 1.5, borderColor: e.border,
                    alignItems: 'center', opacity: isSubmitting ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontWeight: '800', fontSize: 13, color: e.text }}>{e.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => !isSubmitting && handleBallPress(5)}
                disabled={isSubmitting}
                activeOpacity={0.7}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 12,
                  backgroundColor: '#FFF7ED', borderWidth: 1.5, borderColor: '#FDBA74',
                  alignItems: 'center', opacity: isSubmitting ? 0.5 : 1,
                }}
              >
                <Text style={{ fontWeight: '800', fontSize: 13, color: '#C2410C' }}>5</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <RecentBalls matchId={id!} compact />
      </View>

      {/* Commentary Toast */}
      <CommentaryToast text={lastCommentary} visible={commentaryVisible} />

      {/* Ground Picker */}
      <GroundPicker
        visible={showGroundPicker}
        runs={pendingBall?.runs ?? 0}
        isWicket={isWicketPending}
        isExtra={!!pendingBall?.extras?.type}
        batsmanName={strikerName}
        bowlerName={bowlerName}
        commentary={pickerCommentary}
        onConfirm={isWicketPending ? handleGroundConfirmWithWicket : handleGroundConfirm}
      />

      {/* Modals */}
      <WicketModal
        visible={showWicket}
        onClose={() => setShowWicket(false)}
        onSubmit={handleWicketBall}
        batsmen={[
          { _id: strikerId, name: strikerName },
          { _id: nonStrikerId, name: nonStrikerName },
        ]}
        match={currentMatch}
        innings={innings}
      />

      <NewBatsmanModal
        visible={showNewBatter}
        onClose={() => {
          setShowNewBatter(false);
          if (pendingNewBowlerAfterBatter) {
            setPendingNewBowlerAfterBatter(false);
            setShowNewBowler(true);
          }
        }}
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

      <TransferScoringModal
        visible={showTransfer}
        onClose={() => setShowTransfer(false)}
        match={currentMatch}
        matchId={id!}
      />

      <InningsBreakModal
        visible={showInningsBreak}
        match={currentMatch}
        matchId={id!}
      />

      <MatchCompleteModal
        visible={showMatchComplete}
        match={currentMatch}
        matchId={id!}
      />

      <SuperOverBreakModal
        visible={showSuperOverBreak}
        onStartSuperOver={() => {
          setShowSuperOverBreak(false);
          // The toss screen handles player selection for super over innings
          router.replace(`/match/${id}/toss` as any);
        }}
        onEndAsTie={async () => {
          try {
            const { endMatchAsTie } = useMatchStore.getState();
            await endMatchAsTie(id!);
            setShowSuperOverBreak(false);
          } catch (e: any) { Alert.alert('Error', e.message); }
        }}
      />

      <SuperOverInningsBreakModal
        visible={showSuperOverInningsBreak}
        match={currentMatch}
        matchId={id!}
      />
    </SafeAreaView>
  );
}
