import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated, ScrollView,
  Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMatchStore } from '@store/matchStore';
import { Audio } from 'expo-av';

// ─── Coin face ────────────────────────────────────────────────
function CoinFace({ side, size = 120 }: { side: 'heads' | 'tails'; size?: number }) {
  const isHeads = side === 'heads';
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: isHeads ? '#D97706' : '#B45309',
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#F59E0B', shadowOpacity: 0.6, shadowRadius: 16, elevation: 10,
      borderWidth: size * 0.033, borderColor: '#92400E',
    }}>
      <View style={{
        width: size * 0.82, height: size * 0.82, borderRadius: (size * 0.82) / 2,
        backgroundColor: isHeads ? '#F59E0B' : '#D97706',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: isHeads ? '#FBBF24' : '#B45309',
      }}>
        <Text style={{ fontSize: size * 0.3, fontWeight: '900', color: '#7C2D12' }}>
          {isHeads ? 'H' : 'T'}
        </Text>
        <Text style={{ fontSize: size * 0.08, fontWeight: '900', color: '#92400E', letterSpacing: 2, marginTop: 2 }}>
          {isHeads ? 'HEADS' : 'TAILS'}
        </Text>
      </View>
    </View>
  );
}

// ─── Player card ──────────────────────────────────────────────
function PlayerCard({
  player, isSelected, isDisabled, onPress, accentColor,
}: {
  player: any; isSelected: boolean; isDisabled: boolean;
  onPress: () => void; accentColor: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: isSelected ? accentColor : '#fff',
        borderRadius: 14, padding: 12, marginBottom: 8,
        borderWidth: 1.5,
        borderColor: isSelected ? accentColor : (isDisabled ? '#F3F4F6' : '#E5E7EB'),
        opacity: isDisabled ? 0.35 : 1,
        shadowColor: isSelected ? accentColor : '#000',
        shadowOpacity: isSelected ? 0.25 : 0.04,
        shadowRadius: 6, elevation: isSelected ? 4 : 1,
      }}
    >
      {/* Avatar circle */}
      <View style={{
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: isSelected ? 'rgba(255,255,255,0.22)' : accentColor + '18',
        alignItems: 'center', justifyContent: 'center', marginRight: 12,
      }}>
        <Text style={{ fontWeight: '900', fontSize: 18, color: isSelected ? '#fff' : accentColor }}>
          {player.name?.charAt(0)?.toUpperCase()}
        </Text>
      </View>

      {/* Name + role */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontWeight: '700', fontSize: 14, color: isSelected ? '#fff' : '#111827' }} numberOfLines={1}>
            {player.name}
          </Text>
          {player.isCaptain && (
            <View style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : '#FEF3C7', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ color: isSelected ? '#fff' : '#92400E', fontSize: 9, fontWeight: '900' }}>C</Text>
            </View>
          )}
          {player.isViceCaptain && (
            <View style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : '#EFF6FF', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ color: isSelected ? '#fff' : '#1D4ED8', fontSize: 9, fontWeight: '900' }}>VC</Text>
            </View>
          )}
        </View>
        {player.role && (
          <Text style={{ fontSize: 11, marginTop: 2, color: isSelected ? 'rgba(255,255,255,0.65)' : '#9CA3AF' }}>
            {player.role.replace(/-/g, ' ')}
          </Text>
        )}
      </View>

      {/* Selection indicator */}
      <View style={{
        width: 26, height: 26, borderRadius: 13,
        backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : '#F3F4F6',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {isSelected && <Ionicons name="checkmark" size={15} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
}

// ─── Step header ──────────────────────────────────────────────
function StepHeader({ num, label, sub }: { num: number; label: string; sub?: string }) {
  return (
    <View style={{ marginBottom: sub ? 12 : 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{num}</Text>
        </View>
        <Text style={{ fontWeight: '800', color: '#1E3A5F', fontSize: 16 }}>{label}</Text>
      </View>
      {sub && <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4, marginLeft: 34 }}>{sub}</Text>}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
export default function TossScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentMatch, fetchMatch, setToss, startInnings } = useMatchStore();

  // Toss flow state
  const [callingTeam, setCallingTeam] = useState<string | null>(null);
  const [call, setCall] = useState<'heads' | 'tails' | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [coinSide, setCoinSide] = useState<'heads' | 'tails'>('heads');
  const [coinResult, setCoinResult] = useState<'heads' | 'tails' | null>(null);
  const [tossWinnerId, setTossWinnerId] = useState<string | null>(null);
  const [decision, setDecision] = useState<'bat' | 'bowl' | null>(null);
  const [tossConfirmed, setTossConfirmed] = useState(false);

  // Player selection
  const [striker, setStriker] = useState<string | null>(null);
  const [nonStriker, setNonStriker] = useState<string | null>(null);
  const [bowler, setBowler] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const soundRef = useRef<any>(null);

  useEffect(() => {
    fetchMatch(id!);
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, [id]);

  const match = currentMatch;
  const teamA = match?.teamA as any;
  const teamB = match?.teamB as any;
  const isTossDone = ['TOSS_DONE', 'FIRST_INNINGS', 'SECOND_INNINGS', 'INNINGS_BREAK', 'COMPLETED'].includes(match?.state || '');

  const playSound = async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        require('../../../../assets/freesound_community-coin-flip-88793.mp3'),
        { shouldPlay: true },
      );
      soundRef.current = sound;
    } catch { /* audio is optional */ }
  };

  const handleFlip = () => {
    if (!callingTeam || !call || flipping) return;
    setFlipping(true);
    setCoinResult(null);

    const result: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';

    playSound();

    // Simulate coin flip: scaleX 1→0→1 repeated fast (horizontal flip illusion)
    const makeCycle = (onMid?: () => void) =>
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 90, useNativeDriver: true }),
      ]);

    const cycles: Animated.CompositeAnimation[] = [];
    for (let i = 0; i < 5; i++) cycles.push(makeCycle());

    // Final half-cycle: scale to 0, switch side, then bounce back
    Animated.sequence([
      ...cycles,
      Animated.timing(scaleAnim, { toValue: 0, duration: 90, useNativeDriver: true }),
    ]).start(() => {
      setCoinSide(result);
      setCoinResult(result);

      const callerWon = call === result;
      const winnerId = callerWon
        ? callingTeam
        : (callingTeam === teamA?._id?.toString() ? teamB?._id?.toString() : teamA?._id?.toString());
      setTossWinnerId(winnerId!);

      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start(() => {
        setFlipping(false);
      });
    });
  };

  const handleConfirmToss = async () => {
    if (!tossWinnerId || !decision) return;
    setSubmitting(true);
    try {
      await setToss(id!, { winner: tossWinnerId, decision });
      setTossConfirmed(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to set toss');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartInnings = async () => {
    if (!striker || !nonStriker || !bowler) {
      Alert.alert('Required', 'Select striker, non-striker and opening bowler');
      return;
    }
    if (striker === nonStriker) {
      Alert.alert('Invalid', 'Striker and non-striker must be different players');
      return;
    }
    setSubmitting(true);
    try {
      await startInnings(id!, { innings: 1, striker, nonStriker, bowler });
      router.replace(`/match/${id}/score` as any);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to start innings');
    } finally {
      setSubmitting(false);
    }
  };

  // Derived values
  const tossWinnerObj = isTossDone
    ? (teamA?._id?.toString() === match?.toss?.winner?.toString() ? teamA : teamB)
    : (tossWinnerId ? (teamA?._id?.toString() === tossWinnerId ? teamA : teamB) : null);

  const tossDec = match?.toss?.decision || decision;
  let battingTeam: any = null, bowlingTeam: any = null;
  if (tossWinnerObj && tossDec) {
    battingTeam = tossDec === 'bat' ? tossWinnerObj : (tossWinnerObj._id?.toString() === teamA?._id?.toString() ? teamB : teamA);
    bowlingTeam = battingTeam?._id?.toString() === teamA?._id?.toString() ? teamB : teamA;
  }

  const showPlayerSetup = isTossDone || tossConfirmed;

  const getPid = (p: any) => (p.userId?._id || p.userId || p._id)?.toString();

  if (!match) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0F2444', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#F59E0B" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F2444' }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{match.title}</Text>
          <Text style={{ color: '#93C5FD', fontSize: 12 }}>
            {showPlayerSetup ? 'Set Opening Players' : 'Coin Toss'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#F8FAFC', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════ TOSS PHASE ══════════════════════ */}
        {!showPlayerSetup && (
          <>
            {/* STEP 1 — Calling team */}
            <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
              <StepHeader num={1} label="Who calls the toss?" sub="Select the team captain" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[teamA, teamB].map((team: any) => {
                  const isSel = callingTeam === team?._id?.toString();
                  return (
                    <TouchableOpacity
                      key={team?._id}
                      onPress={() => {
                        setCallingTeam(team?._id?.toString());
                        setCall(null); setCoinResult(null); setTossWinnerId(null);
                      }}
                      disabled={flipping}
                      activeOpacity={0.8}
                      style={{
                        flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center',
                        backgroundColor: isSel ? '#1E3A5F' : '#F8FAFC',
                        borderWidth: 2, borderColor: isSel ? '#1E3A5F' : '#E5E7EB',
                      }}
                    >
                      <View style={{
                        width: 50, height: 50, borderRadius: 25, marginBottom: 8,
                        backgroundColor: (team?.color || '#1E3A5F') + (isSel ? '50' : '20'),
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontWeight: '900', fontSize: 14, color: isSel ? '#fff' : (team?.color || '#1E3A5F') }}>
                          {team?.shortName || team?.name?.slice(0, 2)?.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={{ fontWeight: '700', color: isSel ? '#fff' : '#111827', fontSize: 12, textAlign: 'center' }} numberOfLines={2}>
                        {team?.name}
                      </Text>
                      {isSel && (
                        <View style={{ position: 'absolute', top: 8, right: 8 }}>
                          <Ionicons name="checkmark-circle" size={18} color="#93C5FD" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* STEP 2 — Heads or Tails call */}
            {callingTeam && (
              <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                <StepHeader
                  num={2}
                  label={`${callingTeam === teamA?._id?.toString() ? teamA?.name : teamB?.name} calls...`}
                  sub="What does the captain call?"
                />
                <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }}>
                  {(['heads', 'tails'] as const).map((opt) => {
                    const isSel = call === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        onPress={() => { setCall(opt); setCoinResult(null); setTossWinnerId(null); setCoinSide(opt); }}
                        disabled={flipping}
                        activeOpacity={0.85}
                        style={{ alignItems: 'center', gap: 10 }}
                      >
                        <View style={{
                          borderRadius: 60 + 6,
                          padding: 4,
                          borderWidth: 3,
                          borderColor: isSel ? '#F59E0B' : 'transparent',
                        }}>
                          <CoinFace side={opt} size={100} />
                        </View>
                        <View style={{
                          paddingHorizontal: 20, paddingVertical: 7, borderRadius: 20,
                          backgroundColor: isSel ? '#1E3A5F' : '#F3F4F6',
                        }}>
                          <Text style={{ fontWeight: '800', fontSize: 13, letterSpacing: 1, color: isSel ? '#fff' : '#6B7280' }}>
                            {opt.toUpperCase()}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* STEP 3 — Flip coin + result */}
            {callingTeam && call && (
              <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, alignItems: 'center' }}>
                {/* Animated coin */}
                <View style={{ marginBottom: 20, marginTop: 8 }}>
                  <Animated.View style={{ transform: [{ scaleX: scaleAnim }] }}>
                    <CoinFace side={coinSide} size={140} />
                  </Animated.View>
                </View>

                {/* Result */}
                {coinResult && !flipping && (
                  <View style={{
                    backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, width: '100%',
                    alignItems: 'center', marginBottom: 16,
                  }}>
                    <Text style={{ fontWeight: '900', color: '#15803D', fontSize: 28, marginBottom: 4 }}>
                      {coinResult.toUpperCase()}!
                    </Text>
                    <Text style={{ fontWeight: '700', color: '#166534', fontSize: 16, marginBottom: 2 }}>
                      {tossWinnerId === teamA?._id?.toString() ? teamA?.name : teamB?.name} won the toss!
                    </Text>
                    <Text style={{ color: '#4B5563', fontSize: 13 }}>
                      {callingTeam === tossWinnerId
                        ? `${callingTeam === teamA?._id?.toString() ? teamA?.name : teamB?.name} called ${coinResult} — Correct! 🎯`
                        : `${callingTeam === teamA?._id?.toString() ? teamA?.name : teamB?.name} called ${call}, got ${coinResult} 🍀`}
                    </Text>
                  </View>
                )}

                {/* Flip button */}
                {!coinResult && (
                  <TouchableOpacity
                    onPress={handleFlip}
                    disabled={flipping}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: flipping ? 'rgba(245,158,11,0.5)' : '#F59E0B',
                      borderRadius: 24, paddingHorizontal: 44, paddingVertical: 16,
                      flexDirection: 'row', alignItems: 'center', gap: 10,
                      shadowColor: '#F59E0B', shadowOpacity: 0.45, shadowRadius: 14, elevation: 7,
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>🪙</Text>
                    <Text style={{ fontWeight: '900', color: '#000', fontSize: 18, letterSpacing: 0.5 }}>
                      {flipping ? 'Flipping...' : 'FLIP COIN'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* STEP 4 — Bat or Bowl */}
            {coinResult && tossWinnerId && !flipping && (
              <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
                <StepHeader
                  num={3}
                  label={`${tossWinnerId === teamA?._id?.toString() ? teamA?.name : teamB?.name} elects to...`}
                  sub="What does the toss winner choose?"
                />
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  {[
                    { key: 'bat', icon: '🏏', label: 'Bat First', desc: 'Set a target', color: '#16A34A' },
                    { key: 'bowl', icon: '⚡', label: 'Bowl First', desc: 'Chase a target', color: '#7C3AED' },
                  ].map((opt) => {
                    const isSel = decision === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => setDecision(opt.key as 'bat' | 'bowl')}
                        activeOpacity={0.85}
                        style={{
                          flex: 1, paddingVertical: 20, borderRadius: 18, alignItems: 'center',
                          backgroundColor: isSel ? opt.color : '#F9FAFB',
                          borderWidth: 2, borderColor: isSel ? opt.color : '#E5E7EB',
                          shadowColor: isSel ? opt.color : '#000',
                          shadowOpacity: isSel ? 0.3 : 0.03,
                          shadowRadius: 8, elevation: isSel ? 4 : 1,
                        }}
                      >
                        <Text style={{ fontSize: 34, marginBottom: 8 }}>{opt.icon}</Text>
                        <Text style={{ fontWeight: '800', fontSize: 15, color: isSel ? '#fff' : '#374151', marginBottom: 3 }}>{opt.label}</Text>
                        <Text style={{ fontSize: 11, color: isSel ? 'rgba(255,255,255,0.7)' : '#9CA3AF' }}>{opt.desc}</Text>
                        {isSel && (
                          <View style={{ position: 'absolute', top: 10, right: 10 }}>
                            <Ionicons name="checkmark-circle" size={20} color="rgba(255,255,255,0.8)" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {decision && (
                  <TouchableOpacity
                    onPress={handleConfirmToss}
                    disabled={submitting}
                    activeOpacity={0.85}
                    style={{
                      backgroundColor: submitting ? 'rgba(245,158,11,0.5)' : '#F59E0B',
                      borderRadius: 16, paddingVertical: 16,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {submitting
                      ? <ActivityIndicator color="#000" size="small" />
                      : <Ionicons name="checkmark-circle" size={20} color="#000" />}
                    <Text style={{ color: '#000', fontWeight: '900', fontSize: 16 }}>
                      {submitting ? 'Confirming...' : 'Confirm & Set Players →'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}

        {/* ══════════════════ PLAYER SETUP PHASE ══════════════════ */}
        {showPlayerSetup && battingTeam && (
          <>
            {/* Toss result banner */}
            <View style={{
              backgroundColor: '#1E3A5F', borderRadius: 20, padding: 16, marginBottom: 20,
              flexDirection: 'row', alignItems: 'center', gap: 14,
            }}>
              <View style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: '#F59E0B',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 26 }}>🪙</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#93C5FD', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>TOSS RESULT</Text>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 2 }}>
                  {tossWinnerObj?.name || 'Winner'} won the toss
                </Text>
                <Text style={{ color: '#F59E0B', fontSize: 13, marginTop: 1 }}>
                  Elected to {match?.toss?.decision || tossDec} first
                </Text>
              </View>
            </View>

            {/* Batting section header */}
            <View style={{
              backgroundColor: '#ECFDF5', borderRadius: 14,
              paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14,
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}>
              <Text style={{ fontSize: 22 }}>🏏</Text>
              <View>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#059669', letterSpacing: 0.8 }}>BATTING FIRST</Text>
                <Text style={{ fontWeight: '800', color: '#065F46', fontSize: 15 }}>{battingTeam?.name}</Text>
              </View>
            </View>

            {/* Striker */}
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ backgroundColor: '#16A34A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>STRIKER</Text>
                </View>
                <Text style={{ color: '#6B7280', fontSize: 12 }}>Facing the first ball</Text>
              </View>
              {(battingTeam?.players || []).map((p: any) => {
                const pid = getPid(p);
                return (
                  <PlayerCard
                    key={pid} player={p}
                    isSelected={striker === pid}
                    isDisabled={nonStriker === pid}
                    onPress={() => setStriker(pid)}
                    accentColor="#16A34A"
                  />
                );
              })}
            </View>

            {/* Non-Striker */}
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ backgroundColor: '#0284C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>NON-STRIKER</Text>
                </View>
                <Text style={{ color: '#6B7280', fontSize: 12 }}>At the other end</Text>
              </View>
              {(battingTeam?.players || []).map((p: any) => {
                const pid = getPid(p);
                return (
                  <PlayerCard
                    key={pid} player={p}
                    isSelected={nonStriker === pid}
                    isDisabled={striker === pid}
                    onPress={() => setNonStriker(pid)}
                    accentColor="#0284C7"
                  />
                );
              })}
            </View>

            {/* Bowling section header */}
            <View style={{
              backgroundColor: '#F5F3FF', borderRadius: 14,
              paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14,
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}>
              <Text style={{ fontSize: 22 }}>⚡</Text>
              <View>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#7C3AED', letterSpacing: 0.8 }}>BOWLING FIRST</Text>
                <Text style={{ fontWeight: '800', color: '#4C1D95', fontSize: 15 }}>{bowlingTeam?.name}</Text>
              </View>
            </View>

            {/* Opening Bowler */}
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={{ backgroundColor: '#7C3AED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 }}>OPENING BOWLER</Text>
                </View>
                <Text style={{ color: '#6B7280', fontSize: 12 }}>Bowling the first over</Text>
              </View>
              {(bowlingTeam?.players || []).map((p: any) => {
                const pid = getPid(p);
                return (
                  <PlayerCard
                    key={pid} player={p}
                    isSelected={bowler === pid}
                    isDisabled={false}
                    onPress={() => setBowler(pid)}
                    accentColor="#7C3AED"
                  />
                );
              })}
            </View>

            {/* Selection summary */}
            {(striker || nonStriker || bowler) && (
              <View style={{
                backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 16,
                borderWidth: 1, borderColor: '#E5E7EB',
                shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
              }}>
                <Text style={{ fontWeight: '700', color: '#374151', fontSize: 12, marginBottom: 12, letterSpacing: 0.5 }}>
                  SELECTION SUMMARY
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { label: 'Striker', id: striker, team: battingTeam, color: '#16A34A' },
                    { label: 'Non-Striker', id: nonStriker, team: battingTeam, color: '#0284C7' },
                    { label: 'Bowler', id: bowler, team: bowlingTeam, color: '#7C3AED' },
                  ].map(({ label, id, team, color }) => {
                    const player = (team?.players || []).find((p: any) => getPid(p) === id);
                    return (
                      <View key={label} style={{ flex: 1, alignItems: 'center', padding: 8, backgroundColor: color + '10', borderRadius: 10 }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color, letterSpacing: 0.5, marginBottom: 4 }}>
                          {label.replace('-', '\n').toUpperCase()}
                        </Text>
                        <Text style={{ fontWeight: '700', color: '#111827', fontSize: 11, textAlign: 'center' }} numberOfLines={2}>
                          {player?.name || '—'}
                        </Text>
                        {player && <Ionicons name="checkmark-circle" size={14} color={color} style={{ marginTop: 4 }} />}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Start button */}
            <TouchableOpacity
              onPress={handleStartInnings}
              disabled={submitting || !striker || !nonStriker || !bowler}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#16A34A', borderRadius: 18, paddingVertical: 18,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                opacity: (!striker || !nonStriker || !bowler || submitting) ? 0.4 : 1,
                shadowColor: '#16A34A', shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
              }}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Ionicons name="baseball" size={22} color="#fff" />}
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 17 }}>
                {submitting ? 'Starting Innings...' : 'Start Match!'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
