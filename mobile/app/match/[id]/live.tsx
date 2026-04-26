import { useEffect, useCallback, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useScoringStore } from '@store/scoringStore';
import { useMatchStore } from '@store/matchStore';
import { useAuthStore } from '@store/authStore';
import { joinMatch, leaveMatch, onMatchEvent } from '@services/socket';
import { api } from '@services/api';
import { generateCommentary, SHOT_REGIONS } from '@utils/commentary';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Tab = 'Info' | 'Live' | 'Scorecard' | 'Summary' | 'Squads';
const TABS: Tab[] = ['Info', 'Live', 'Scorecard', 'Summary', 'Squads'];

// ─── helpers ─────────────────────────────────────────────────

const getBallStyle = (ball: any) => {
  if (ball.wicket) return { bg: '#EF4444', color: '#fff', label: 'W' };
  if (ball.extras?.type === 'wide') return { bg: '#FEF3C7', color: '#D97706', label: 'Wd' };
  if (ball.extras?.type === 'no_ball') return { bg: '#FED7AA', color: '#EA580C', label: 'Nb' };
  if (ball.runs === 6) return { bg: '#16A34A', color: '#fff', label: '6' };
  if (ball.runs === 4) return { bg: '#2563EB', color: '#fff', label: '4' };
  return { bg: '#F3F4F6', color: '#374151', label: String(ball.runs ?? 0) };
};

const fmtCommentary = (ball: any) => {
  const bwl = ball.bowler?.name || 'Bowler';
  const bat = ball.batsman?.name || 'Batsman';
  // Use rich generated commentary if available; fall back to simple
  try {
    return generateCommentary(ball, bat, bwl);
  } catch {
    return `${bwl} to ${bat}, ${ball.runs ?? 0}`;
  }
};

const fmtShotRegion = (region: string | null | undefined) =>
  region && SHOT_REGIONS[region] ? `📍 ${SHOT_REGIONS[region].label}` : '';

const fmtOvers = (overs: number, balls: number) => `${overs}.${balls}`;

const STATE_LABEL: Record<string, string> = {
  NOT_STARTED: 'Upcoming',
  TOSS_DONE: 'Ready to Start',
  FIRST_INNINGS: 'Live',
  INNINGS_BREAK: 'Innings Break',
  SECOND_INNINGS: 'Live',
  COMPLETED: 'Completed',
};

// ─── LiveTab ──────────────────────────────────────────────────

function LiveTab({ match, summary, recentBalls }: { match: any; summary: any; recentBalls: any[] }) {
  const [activePanel, setActivePanel] = useState<'batting' | 'bowling'>('batting');
  const cs = summary?.currentState;
  const inningsNum = cs?.innings ?? 1;
  const inningsSummary = summary?.innings?.[inningsNum - 1];
  const isCompleted = match?.state === 'COMPLETED';

  if (!cs || (!cs.totalRuns && !isCompleted)) {
    const isNotStarted = ['NOT_STARTED', 'TOSS_DONE'].includes(match?.state);
    return (
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Match header */}
        <View style={{ backgroundColor: '#1E3A5F', borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ color: '#93C5FD', fontSize: 12, fontWeight: '700', marginBottom: 16 }}>
            {STATE_LABEL[match?.state] || match?.state}
          </Text>
          {/* Teams */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: (match?.teamA?.color || '#1E3A5F') + '40',
                alignItems: 'center', justifyContent: 'center', marginBottom: 8,
              }}>
                <Text style={{ fontWeight: '900', fontSize: 14, color: match?.teamA?.color || '#fff' }}>
                  {match?.teamA?.shortName}
                </Text>
              </View>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' }} numberOfLines={2}>
                {match?.teamA?.name}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: '#F59E0B', fontWeight: '900', fontSize: 18 }}>VS</Text>
              {match?.totalOvers && (
                <Text style={{ color: '#93C5FD', fontSize: 11, marginTop: 4 }}>{match.totalOvers} overs</Text>
              )}
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{
                width: 56, height: 56, borderRadius: 28,
                backgroundColor: (match?.teamB?.color || '#7C3AED') + '40',
                alignItems: 'center', justifyContent: 'center', marginBottom: 8,
              }}>
                <Text style={{ fontWeight: '900', fontSize: 14, color: match?.teamB?.color || '#fff' }}>
                  {match?.teamB?.shortName}
                </Text>
              </View>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' }} numberOfLines={2}>
                {match?.teamB?.name}
              </Text>
            </View>
          </View>

          {match?.toss?.winner && (
            <View style={{ backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: '#F59E0B', fontSize: 12, textAlign: 'center' }}>
                🪙{' '}
                {match.toss.winner?.toString() === match.teamA?._id?.toString()
                  ? match.teamA?.name : match.teamB?.name}
                {' '}won toss · chose to {match.toss.decision}
              </Text>
            </View>
          )}
        </View>

        {isNotStarted && (
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>⏳</Text>
            <Text style={{ fontWeight: '700', color: '#374151', fontSize: 16, marginBottom: 4 }}>
              {match?.state === 'TOSS_DONE' ? 'Toss Done – Ready to Start' : 'Match Not Started Yet'}
            </Text>
            <Text style={{ color: '#9CA3AF', textAlign: 'center', fontSize: 13 }}>
              {match?.venue ? `📍 ${match.venue}` : ''}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }

  const battingTeamName = inningsNum === 1
    ? match?.innings?.first?.battingTeam?.name
    : match?.innings?.second?.battingTeam?.name;

  const thisOverBalls = recentBalls.filter((b) => b.over === cs.over);

  const currentBatters = (inningsSummary?.batting || []).filter((b: any) => {
    const pid = b.playerId?.toString?.() || b.playerId;
    const striker = (cs.striker?._id || cs.striker)?.toString?.();
    const nonStriker = (cs.nonStriker?._id || cs.nonStriker)?.toString?.();
    return pid === striker || pid === nonStriker;
  });

  const currentBowlers = (inningsSummary?.bowling || []).filter((b: any) => {
    const pid = b.playerId?.toString?.() || b.playerId;
    const bowler = (cs.currentBowler?._id || cs.currentBowler)?.toString?.();
    return pid === bowler;
  });

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Score Hero */}
      <View style={{ backgroundColor: '#1E3A5F', paddingHorizontal: 16, paddingVertical: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <Text style={{ color: '#93C5FD', fontSize: 12, fontWeight: '700' }}>
            {battingTeamName || `Innings ${inningsNum}`}
          </Text>
          {isCompleted && match?.result?.description && (
            <View style={{ backgroundColor: '#16A34A20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ color: '#4ADE80', fontSize: 11, fontWeight: '700' }}>RESULT</Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: '#F59E0B', fontSize: 52, fontWeight: '900', lineHeight: 56 }}>
              {cs.totalRuns}/{cs.wickets}
            </Text>
            <Text style={{ color: '#93C5FD', fontSize: 16 }}>
              ({fmtOvers(cs.over, cs.ball)} ov)
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {cs.target ? (
              <>
                <Text style={{ color: '#93C5FD', fontSize: 11 }}>Target</Text>
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>{cs.target}</Text>
                {cs.requiredRuns != null && (
                  <Text style={{ color: '#F59E0B', fontSize: 12, marginTop: 2 }}>
                    Need {cs.requiredRuns} off {cs.requiredRate?.toFixed(2)} rpo
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={{ color: '#93C5FD', fontSize: 11 }}>CRR</Text>
                <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>
                  {(cs.currentRate ?? 0).toFixed(2)}
                </Text>
                {match?.totalOvers && !isCompleted && (
                  <Text style={{ color: '#93C5FD', fontSize: 11 }}>
                    Proj: {Math.round((cs.currentRate ?? 0) * match.totalOvers)}
                  </Text>
                )}
              </>
            )}
          </View>
        </View>

        {match?.toss?.winner && (
          <Text style={{ color: 'rgba(147,197,253,0.7)', fontSize: 11, marginTop: 8 }}>
            🪙{' '}
            {match.toss.winner?.toString() === match.teamA?._id?.toString()
              ? match.teamA?.name : match.teamB?.name
            } opted to {match.toss.decision}
          </Text>
        )}

        {isCompleted && match?.result?.description && (
          <View style={{ marginTop: 10, backgroundColor: 'rgba(22,163,74,0.15)', borderRadius: 10, padding: 10 }}>
            <Text style={{ color: '#4ADE80', fontWeight: '700', fontSize: 13 }}>
              🏆 {match.result.description}
            </Text>
          </View>
        )}
      </View>

      {/* This Over */}
      {recentBalls.length > 0 && !isCompleted && (
        <View style={{ backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 12, marginTop: 6 }}>
          <Text style={{ fontWeight: '700', color: '#374151', marginBottom: 10, fontSize: 12 }}>THIS OVER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(thisOverBalls.length > 0 ? thisOverBalls : recentBalls.slice(0, 6)).map((ball, i) => {
                const s = getBallStyle(ball);
                return (
                  <View key={ball._id || i} style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: s.color }}>{s.label}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Batting / Bowling panels */}
      {(currentBatters.length > 0 || currentBowlers.length > 0) && (
        <View style={{ backgroundColor: '#fff', marginTop: 6 }}>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            {(['batting', 'bowling'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setActivePanel(p)}
                style={{
                  flex: 1, paddingVertical: 12, alignItems: 'center',
                  borderBottomWidth: 2.5,
                  borderBottomColor: activePanel === p ? '#1E3A5F' : 'transparent',
                }}
              >
                <Text style={{
                  fontWeight: '700', fontSize: 13,
                  color: activePanel === p ? '#1E3A5F' : '#9CA3AF',
                }}>
                  {p === 'batting' ? '🏏 Batting' : '⚡ Bowling'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activePanel === 'batting' ? (
            <View>
              <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F9FAFB' }}>
                <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#9CA3AF' }}>BATTERS</Text>
                {['R', 'B', '4s', '6s', 'SR'].map((h) => (
                  <Text key={h} style={{ width: 36, textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#9CA3AF' }}>{h}</Text>
                ))}
              </View>
              {currentBatters.map((b: any, i: number) => (
                <View key={i} style={{
                  flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12,
                  borderBottomWidth: 1, borderBottomColor: '#F9FAFB', alignItems: 'center',
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: '#16A34A', fontSize: 13 }}>
                      {b.playerName}
                      {b.playerId?.toString() === (cs.striker?._id || cs.striker)?.toString() ? ' *' : ''}
                    </Text>
                    {b.isOut && <Text style={{ color: '#EF4444', fontSize: 11 }}>{b.dismissal?.replace(/_/g, ' ')}</Text>}
                  </View>
                  <Text style={{ width: 36, textAlign: 'center', fontWeight: '800', color: '#111827' }}>{b.runs}</Text>
                  <Text style={{ width: 36, textAlign: 'center', color: '#6B7280' }}>{b.balls}</Text>
                  <Text style={{ width: 36, textAlign: 'center', color: '#6B7280' }}>{b.fours}</Text>
                  <Text style={{ width: 36, textAlign: 'center', color: '#6B7280' }}>{b.sixes}</Text>
                  <Text style={{ width: 36, textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
                    {(b.strikeRate ?? 0).toFixed(1)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View>
              <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F9FAFB' }}>
                <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#9CA3AF' }}>BOWLERS</Text>
                {['O', 'M', 'R', 'W', 'Eco'].map((h) => (
                  <Text key={h} style={{ width: 36, textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#9CA3AF' }}>{h}</Text>
                ))}
              </View>
              {currentBowlers.map((b: any, i: number) => (
                <View key={i} style={{
                  flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12,
                  borderBottomWidth: 1, borderBottomColor: '#F9FAFB', alignItems: 'center',
                }}>
                  <Text style={{ flex: 1, fontWeight: '700', color: '#16A34A', fontSize: 13 }}>{b.playerName}</Text>
                  <Text style={{ width: 36, textAlign: 'center', color: '#6B7280', fontSize: 12 }}>{b.overs}.{b.balls % 6}</Text>
                  <Text style={{ width: 36, textAlign: 'center', color: '#6B7280' }}>{b.maidens}</Text>
                  <Text style={{ width: 36, textAlign: 'center', color: '#6B7280' }}>{b.runs}</Text>
                  <Text style={{ width: 36, textAlign: 'center', fontWeight: '800', color: '#111827' }}>{b.wickets}</Text>
                  <Text style={{ width: 36, textAlign: 'center', color: '#6B7280', fontSize: 12 }}>{(b.economy ?? 0).toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Commentary */}
      {recentBalls.length > 0 && (
        <View style={{ backgroundColor: '#fff', marginTop: 6, paddingBottom: 8 }}>
          <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <Text style={{ fontWeight: '700', color: '#374151', fontSize: 12 }}>COMMENTARY</Text>
          </View>
          {[...recentBalls].slice(0, 20).map((ball, i) => {
            const s = getBallStyle(ball);
            return (
              <View key={ball._id || i} style={{
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 14, paddingVertical: 10,
                borderTopWidth: 1, borderTopColor: '#F9FAFB',
              }}>
                <Text style={{ color: '#9CA3AF', fontSize: 11, width: 38 }}>
                  {ball.over != null ? `${ball.over}.${ball.ball}` : ''}
                </Text>
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center',
                  marginHorizontal: 10,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: s.color }}>{s.label}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#374151', fontSize: 13, lineHeight: 18 }} numberOfLines={3}>
                    {fmtCommentary(ball)}
                  </Text>
                  {ball.shotRegion && (
                    <Text style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2 }}>
                      {fmtShotRegion(ball.shotRegion)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ─── ScorecardTab ─────────────────────────────────────────────

function ScorecardTabContent({ matchId, match }: { matchId: string; match: any }) {
  const [scorecard, setScorecard] = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [activeInnings, setActiveInnings] = useState(0); // 0 = 1st, 1 = 2nd

  useEffect(() => {
    api.get(`/matches/${matchId}/scorecard`)
      .then((res: any) => setScorecard(res.data.scorecard?.summary))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) return <ActivityIndicator style={{ marginTop: 48 }} color="#1E3A5F" />;

  const allInnings: any[] = scorecard?.innings || [];

  const getTeamName = (inningsIdx: number) => {
    const battingTeamId = inningsIdx === 0
      ? match?.innings?.first?.battingTeam?._id || match?.innings?.first?.battingTeam
      : match?.innings?.second?.battingTeam?._id || match?.innings?.second?.battingTeam;
    if (battingTeamId?.toString() === match?.teamA?._id?.toString()) return match?.teamA?.name;
    return match?.teamB?.name;
  };

  const teamColor = (inningsIdx: number) => {
    const battingTeamId = inningsIdx === 0
      ? match?.innings?.first?.battingTeam?._id || match?.innings?.first?.battingTeam
      : match?.innings?.second?.battingTeam?._id || match?.innings?.second?.battingTeam;
    if (battingTeamId?.toString() === match?.teamA?._id?.toString()) return match?.teamA?.color || '#1E3A5F';
    return match?.teamB?.color || '#7C3AED';
  };

  // Selected innings data
  const inn = allInnings[activeInnings];

  if (allInnings.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 64 }}>
        <Text style={{ fontSize: 36, marginBottom: 8 }}>📋</Text>
        <Text style={{ color: '#9CA3AF', fontSize: 14 }}>No scorecard yet</Text>
      </View>
    );
  }

  const crr = inn ? ((inn.overs > 0 || inn.balls > 0) ? inn.totalRuns / (inn.overs + inn.balls / 6) : 0) : 0;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* ── Team / Innings Selector ── */}
      <View style={{ flexDirection: 'row', margin: 12, gap: 8 }}>
        {[0, 1].map((idx) => {
          const exists = allInnings[idx];
          const name   = getTeamName(idx);
          const color  = teamColor(idx);
          const runs   = allInnings[idx]?.totalRuns;
          const wkts   = allInnings[idx]?.wickets;
          const isActive = activeInnings === idx;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => exists && setActiveInnings(idx)}
              style={{
                flex: 1, borderRadius: 14, padding: 12, borderWidth: 2,
                borderColor: isActive ? color : '#E5E7EB',
                backgroundColor: isActive ? color + '15' : '#fff',
                opacity: exists ? 1 : 0.45,
              }}
              disabled={!exists}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 9, fontWeight: '800', color: isActive ? color : '#9CA3AF', marginBottom: 2, letterSpacing: 0.5 }}>
                {idx + 1}{idx === 0 ? 'ST' : 'ND'} INNINGS
              </Text>
              <Text style={{ fontWeight: '800', color: isActive ? color : '#374151', fontSize: 13 }} numberOfLines={1}>{name || '—'}</Text>
              {exists ? (
                <Text style={{ fontSize: 16, fontWeight: '900', color: isActive ? color : '#6B7280', marginTop: 2 }}>
                  {runs}/{wkts}
                </Text>
              ) : (
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Yet to bat</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Innings Header Bar ── */}
      {inn && (
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: '#1E3A5F', paddingHorizontal: 14, paddingVertical: 12,
        }}>
          <View>
            <Text style={{ color: '#93C5FD', fontSize: 10, fontWeight: '700', marginBottom: 2 }}>
              {activeInnings + 1}{activeInnings === 0 ? 'ST' : 'ND'} INNINGS — {getTeamName(activeInnings)?.toUpperCase()}
            </Text>
            <Text style={{ color: '#F59E0B', fontWeight: '900', fontSize: 20 }}>
              {inn.totalRuns}/{inn.wickets}
              <Text style={{ fontSize: 13, color: '#93C5FD', fontWeight: '400' }}> ({inn.overs}.{inn.balls} ov)</Text>
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#9CA3AF', fontSize: 10 }}>CRR</Text>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{crr.toFixed(2)}</Text>
          </View>
        </View>
      )}

      {inn && (
        <View style={{ backgroundColor: '#fff' }}>
          {/* Batting header */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F0F4FF' }}>
            <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#6B7280' }}>BATTERS</Text>
            {['R', 'B', '4s', '6s', 'SR'].map((h) => (
              <Text key={h} style={{ width: 36, textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#6B7280' }}>{h}</Text>
            ))}
          </View>
          {(inn.batting || []).map((b: any, bi: number) => (
            <View key={bi} style={{
              flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10,
              borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: '#111827', fontSize: 13 }}>{b.playerName}</Text>
                <Text style={{ color: '#9CA3AF', fontSize: 11 }}>
                  {b.isOut ? b.dismissal?.replace(/_/g, ' ') : 'not out'}
                </Text>
              </View>
              <Text style={{ width: 36, textAlign: 'center', fontWeight: '800', color: '#111827' }}>{b.runs}</Text>
              <Text style={{ width: 36, textAlign: 'center', color: '#6B7280' }}>{b.balls}</Text>
              <Text style={{ width: 36, textAlign: 'center', color: '#6B7280' }}>{b.fours}</Text>
              <Text style={{ width: 36, textAlign: 'center', color: '#6B7280' }}>{b.sixes}</Text>
              <Text style={{ width: 36, textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
                {(b.strikeRate ?? 0).toFixed(0)}
              </Text>
            </View>
          ))}

          {/* Extras + Total */}
          <View style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FAFAFA' }}>
            <Text style={{ color: '#6B7280', fontSize: 12 }}>
              Extras {inn.extras?.total ?? 0}  (wd {inn.extras?.wides ?? 0}, nb {inn.extras?.noBalls ?? 0}, b {inn.extras?.byes ?? 0}, lb {inn.extras?.legByes ?? 0})
            </Text>
          </View>

          {/* Fall of wickets */}
          {(inn.fallOfWickets || []).length > 0 && (
            <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontWeight: '700', color: '#374151', marginBottom: 6, fontSize: 11 }}>FALL OF WICKETS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {inn.fallOfWickets.map((fow: any, fi: number) => (
                  <View key={fi} style={{ backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: '#92400E', fontSize: 11, fontWeight: '600' }}>
                      {fi + 1}-{fow.runs ?? fow.score} ({fow.overs ?? '—'})
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Bowling header */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F0F4FF' }}>
            <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: '#6B7280' }}>BOWLERS</Text>
            {['O', 'M', 'R', 'W', 'Eco'].map((h) => (
              <Text key={h} style={{ width: 36, textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#6B7280' }}>{h}</Text>
            ))}
          </View>
          {(inn.bowling || []).map((b: any, bi: number) => (
            <View key={bi} style={{
              flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10,
              borderBottomWidth: 1, borderBottomColor: '#F9FAFB', alignItems: 'center',
            }}>
              <Text style={{ flex: 1, fontWeight: '700', color: '#111827', fontSize: 13 }}>{b.playerName}</Text>
              <Text style={{ width: 36, textAlign: 'center', color: '#6B7280', fontSize: 12 }}>{b.overs}.{b.balls % 6}</Text>
              <Text style={{ width: 36, textAlign: 'center', color: '#6B7280' }}>{b.maidens}</Text>
              <Text style={{ width: 36, textAlign: 'center', color: '#6B7280' }}>{b.runs}</Text>
              <Text style={{ width: 36, textAlign: 'center', fontWeight: '800', color: '#111827' }}>{b.wickets}</Text>
              <Text style={{ width: 36, textAlign: 'center', color: '#6B7280', fontSize: 12 }}>{(b.economy ?? 0).toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ─── SummaryTab ───────────────────────────────────────────────

function SummaryTab({ matchId, match }: { matchId: string; match: any }) {
  const [scorecard, setScorecard] = useState<any>(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    api.get(`/matches/${matchId}/scorecard`)
      .then((res: any) => setScorecard(res.data.scorecard?.summary))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) return <ActivityIndicator style={{ marginTop: 48 }} color="#1E3A5F" />;

  const isCompleted = match?.state === 'COMPLETED';

  if (!isCompleted) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 64, paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>⏳</Text>
        <Text style={{ fontWeight: '800', color: '#374151', fontSize: 16, marginBottom: 6 }}>Match in Progress</Text>
        <Text style={{ color: '#9CA3AF', textAlign: 'center', fontSize: 13 }}>
          Summary will be available once the match is completed
        </Text>
      </View>
    );
  }

  // Build player stat pool from all innings
  const allBatting: any[] = [];
  const allBowling: any[] = [];
  (scorecard?.innings || []).forEach((inn: any) => {
    (inn.batting || []).forEach((b: any) => {
      const existing = allBatting.find((x) => x.playerName === b.playerName);
      if (existing) {
        existing.runs += b.runs; existing.balls += b.balls;
        existing.fours += b.fours; existing.sixes += b.sixes;
      } else {
        allBatting.push({ ...b });
      }
    });
    (inn.bowling || []).forEach((b: any) => {
      const existing = allBowling.find((x) => x.playerName === b.playerName);
      if (existing) {
        existing.wickets += b.wickets; existing.runs += b.runs;
        existing.overs += b.overs; existing.balls = (existing.balls || 0) + (b.balls || 0);
      } else {
        allBowling.push({ ...b });
      }
    });
  });

  const bestBatsman = [...allBatting].sort((a, b) => b.runs - a.runs)[0];
  const bestBowler  = [...allBowling]
    .filter((b) => b.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets || (a.economy ?? 99) - (b.economy ?? 99))[0]
    || [...allBowling].sort((a, b) => (a.economy ?? 99) - (b.economy ?? 99))[0];

  // MVP: batting impact + bowling impact
  const mvp = [...allBatting].map((b) => {
    const bowlStats = allBowling.find((bw) => bw.playerName === b.playerName);
    const batImpact  = b.runs + b.fours * 0.5 + b.sixes * 1.5 + (b.strikeRate > 150 ? 5 : 0);
    const bowlImpact = bowlStats ? bowlStats.wickets * 20 - (bowlStats.economy ?? 0) * 2 : 0;
    return { ...b, mvpScore: batImpact + bowlImpact };
  }).sort((a, b) => b.mvpScore - a.mvpScore)[0];

  const winnerName = (() => {
    const winnerId = match?.result?.winner?.toString();
    if (!winnerId) return null;
    if (winnerId === match?.teamA?._id?.toString()) return match?.teamA?.name;
    return match?.teamB?.name;
  })();

  const StatCard = ({ emoji, label, name, line1, line2 }: any) => (
    <View style={{
      backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12,
      shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
        <Text style={{ fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.8 }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 17, fontWeight: '900', color: '#111827', marginBottom: 4 }}>{name || '—'}</Text>
      <Text style={{ fontSize: 13, color: '#374151', fontWeight: '600' }}>{line1}</Text>
      {line2 ? <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{line2}</Text> : null}
    </View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      {/* Result banner */}
      <View style={{
        backgroundColor: '#1E3A5F', borderRadius: 20, padding: 20,
        alignItems: 'center', marginBottom: 20,
      }}>
        <Text style={{ fontSize: 40, marginBottom: 8 }}>🏆</Text>
        {winnerName ? (
          <>
            <Text style={{ color: '#93C5FD', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>WINNER</Text>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 22, marginBottom: 6 }}>{winnerName}</Text>
            <View style={{ backgroundColor: '#F59E0B20', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 14 }}>{match?.result?.description}</Text>
            </View>
          </>
        ) : (
          <Text style={{ color: '#F59E0B', fontWeight: '900', fontSize: 20 }}>Match Tied</Text>
        )}
      </View>

      {/* Awards */}
      {mvp && (
        <StatCard
          emoji="⭐"
          label="MAN OF THE MATCH"
          name={mvp.playerName}
          line1={`${mvp.runs} runs (${mvp.balls} balls)`}
          line2={(() => {
            const bw = allBowling.find((b) => b.playerName === mvp.playerName);
            return bw ? `${bw.wickets}/${bw.runs} — ${(bw.economy ?? 0).toFixed(2)} eco` : null;
          })()}
        />
      )}
      {bestBatsman && (
        <StatCard
          emoji="🏏"
          label="TOP SCORER"
          name={bestBatsman.playerName}
          line1={`${bestBatsman.runs} runs off ${bestBatsman.balls} balls`}
          line2={`SR ${(bestBatsman.strikeRate ?? 0).toFixed(0)}  •  ${bestBatsman.fours}×4  •  ${bestBatsman.sixes}×6`}
        />
      )}
      {bestBowler && (
        <StatCard
          emoji="🎯"
          label="BEST BOWLER"
          name={bestBowler.playerName}
          line1={`${bestBowler.wickets} wickets / ${bestBowler.runs} runs`}
          line2={`Economy: ${(bestBowler.economy ?? 0).toFixed(2)}`}
        />
      )}

      {/* Quick innings comparison */}
      {(scorecard?.innings || []).length === 2 && (
        <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 12 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 12 }}>
            INNINGS SUMMARY
          </Text>
          {scorecard.innings.map((inn: any, idx: number) => (
            <View key={idx} style={{
              flexDirection: 'row', alignItems: 'center',
              paddingVertical: 10, borderBottomWidth: idx === 0 ? 1 : 0, borderBottomColor: '#F3F4F6',
            }}>
              <Text style={{ flex: 1, fontWeight: '700', color: '#374151', fontSize: 13 }}>
                {inn.battingTeam?.name || `Innings ${idx + 1}`}
              </Text>
              <Text style={{ fontWeight: '900', color: '#1E3A5F', fontSize: 15 }}>
                {inn.totalRuns}/{inn.wickets}
              </Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12, marginLeft: 6 }}>
                ({inn.overs}.{inn.balls})
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── InfoTab ──────────────────────────────────────────────────

function InfoTab({ match }: { match: any }) {
  const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const tossWinner = match?.toss?.winner?.toString() === match?.teamA?._id?.toString()
    ? match?.teamA?.name : match?.teamB?.name;

  const rows = [
    { label: 'Format', value: match?.format },
    { label: 'Overs', value: match?.totalOvers },
    { label: 'Date', value: fmtDate(match?.scheduledAt) },
    { label: 'Venue', value: match?.venue || '—' },
    { label: 'Toss', value: match?.toss ? `${tossWinner} opt to ${match.toss.decision}` : 'Not done' },
    { label: 'Status', value: STATE_LABEL[match?.state] || match?.state },
    { label: 'Result', value: match?.result?.description || '—' },
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Teams header */}
      <View style={{ backgroundColor: '#1E3A5F', paddingHorizontal: 16, paddingVertical: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{
              width: 52, height: 52, borderRadius: 26,
              backgroundColor: (match?.teamA?.color || '#1E3A5F') + '40',
              alignItems: 'center', justifyContent: 'center', marginBottom: 6,
            }}>
              <Text style={{ fontWeight: '900', fontSize: 13, color: match?.teamA?.color || '#fff' }}>
                {match?.teamA?.shortName}
              </Text>
            </View>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' }} numberOfLines={2}>
              {match?.teamA?.name}
            </Text>
          </View>
          <View style={{ alignItems: 'center', paddingHorizontal: 16 }}>
            <Text style={{ color: '#F59E0B', fontWeight: '900', fontSize: 16 }}>VS</Text>
            <Text style={{ color: '#93C5FD', fontSize: 11, marginTop: 2 }}>{match?.format}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{
              width: 52, height: 52, borderRadius: 26,
              backgroundColor: (match?.teamB?.color || '#7C3AED') + '40',
              alignItems: 'center', justifyContent: 'center', marginBottom: 6,
            }}>
              <Text style={{ fontWeight: '900', fontSize: 13, color: match?.teamB?.color || '#fff' }}>
                {match?.teamB?.shortName}
              </Text>
            </View>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' }} numberOfLines={2}>
              {match?.teamB?.name}
            </Text>
          </View>
        </View>
      </View>

      {/* Result banner */}
      {match?.result?.description && (
        <View style={{ backgroundColor: '#F0FDF4', marginHorizontal: 12, marginTop: 12, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 24 }}>🏆</Text>
          <Text style={{ flex: 1, color: '#15803D', fontWeight: '700', fontSize: 14 }}>{match.result.description}</Text>
        </View>
      )}

      {/* Info table */}
      <View style={{ backgroundColor: '#fff', marginTop: 12, marginHorizontal: 0 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
          <Text style={{ fontWeight: '800', color: '#111827', fontSize: 14 }}>Match Info</Text>
        </View>
        {rows.map((row) => (
          <View key={row.label} style={{
            flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12,
            borderTopWidth: 1, borderTopColor: '#F9FAFB',
          }}>
            <Text style={{ width: 80, color: '#9CA3AF', fontSize: 13 }}>{row.label}</Text>
            <Text style={{ flex: 1, color: '#111827', fontSize: 13, fontWeight: '600' }}>{row.value ?? '—'}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── SquadsTab ────────────────────────────────────────────────

function SquadsTab({ match }: { match: any }) {
  const teamA = match?.teamA;
  const teamB = match?.teamB;
  const aPlayers: any[] = teamA?.players || [];
  const bPlayers: any[] = teamB?.players || [];
  const maxLen = Math.max(aPlayers.length, bPlayers.length);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Team headers */}
      <View style={{ flexDirection: 'row', backgroundColor: '#1E3A5F' }}>
        {[teamA, teamB].map((team: any, i: number) => (
          <View key={i} style={{
            flex: 1, flexDirection: i === 0 ? 'row' : 'row-reverse',
            alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 8,
          }}>
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: (team?.color || '#1E3A5F') + '40',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontWeight: '900', fontSize: 11, color: team?.color || '#fff' }}>
                {team?.shortName || team?.name?.slice(0, 2)?.toUpperCase()}
              </Text>
            </View>
            <Text style={{
              fontWeight: '700', color: '#fff', fontSize: 12, flex: 1,
              textAlign: i === 0 ? 'left' : 'right',
            }} numberOfLines={1}>
              {team?.name}
            </Text>
          </View>
        ))}
      </View>

      {/* Divider line */}
      <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />

      {/* Players grid */}
      {Array.from({ length: maxLen }).map((_, i) => {
        const pa = aPlayers[i];
        const pb = bPlayers[i];
        const paId = pa?.userId?._id || pa?.userId;
        const pbId = pb?.userId?._id || pb?.userId;
        return (
          <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F9FAFB' }}>
            <TouchableOpacity
              style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 11 }}
              onPress={() => paId && router.push(`/player/${paId}` as any)}
              disabled={!paId}
              activeOpacity={paId ? 0.6 : 1}
            >
              {pa && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontWeight: '600', color: '#111827', fontSize: 13 }}>
                      {pa.name}
                    </Text>
                    {pa.isCaptain && (
                      <View style={{ backgroundColor: '#FEF3C7', borderRadius: 4, paddingHorizontal: 4 }}>
                        <Text style={{ color: '#92400E', fontSize: 9, fontWeight: '800' }}>C</Text>
                      </View>
                    )}
                    {pa.isViceCaptain && (
                      <View style={{ backgroundColor: '#EFF6FF', borderRadius: 4, paddingHorizontal: 4 }}>
                        <Text style={{ color: '#1D4ED8', fontSize: 9, fontWeight: '800' }}>VC</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: '#9CA3AF', fontSize: 11 }}>{pa.role?.replace(/-/g, ' ')}</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={{ width: 1, backgroundColor: '#F3F4F6' }} />
            <TouchableOpacity
              style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 11, alignItems: 'flex-end' }}
              onPress={() => pbId && router.push(`/player/${pbId}` as any)}
              disabled={!pbId}
              activeOpacity={pbId ? 0.6 : 1}
            >
              {pb && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    {pb.isCaptain && (
                      <View style={{ backgroundColor: '#FEF3C7', borderRadius: 4, paddingHorizontal: 4 }}>
                        <Text style={{ color: '#92400E', fontSize: 9, fontWeight: '800' }}>C</Text>
                      </View>
                    )}
                    {pb.isViceCaptain && (
                      <View style={{ backgroundColor: '#EFF6FF', borderRadius: 4, paddingHorizontal: 4 }}>
                        <Text style={{ color: '#1D4ED8', fontSize: 9, fontWeight: '800' }}>VC</Text>
                      </View>
                    )}
                    <Text style={{ fontWeight: '600', color: '#111827', fontSize: 13 }}>{pb.name}</Text>
                  </View>
                  <Text style={{ color: '#9CA3AF', fontSize: 11 }}>{pb.role?.replace(/-/g, ' ')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────

export default function LiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { currentMatch, fetchMatch } = useMatchStore();
  const { summary, fetchSummary, fetchRecentBalls, setLiveUpdate, recentBalls, isLoading, reset } = useScoringStore();

  const [tab, setTab] = useState<Tab>('Live');
  const tabUnderline = useRef(new Animated.Value(0)).current;
  const TAB_W = Math.floor(SCREEN_WIDTH / TABS.length);

  // Smart default tab based on match state
  useEffect(() => {
    if (!currentMatch) return;
    const state = currentMatch.state;
    if (state === 'COMPLETED') {
      switchTab('Summary', TABS.indexOf('Summary'));
    } else if (state === 'NOT_STARTED' || state === 'TOSS_DONE') {
      switchTab('Info', TABS.indexOf('Info'));
    } else {
      switchTab('Live', TABS.indexOf('Live'));
    }
  }, [currentMatch?.state]);

  const load = useCallback(async () => {
    reset();
    await fetchMatch(id!);
    await fetchSummary(id!);
    const inningsNum = summary?.currentState?.innings || 1;
    await fetchRecentBalls(id!, inningsNum);
  }, [id]);

  useEffect(() => {
    load();
    joinMatch(id!);
    const unsubBall = onMatchEvent('BALL_ADDED', (data) => setLiveUpdate(data as any));
    const unsubUpdate = onMatchEvent('MATCH_UPDATED', (data) => setLiveUpdate(data as any));
    return () => { unsubBall(); unsubUpdate(); leaveMatch(id!); };
  }, [id]);

  const switchTab = (t: Tab, idx: number) => {
    setTab(t);
    Animated.spring(tabUnderline, {
      toValue: idx * TAB_W,
      useNativeDriver: true,
      tension: 160, friction: 18,
    }).start();
  };

  const match = currentMatch;
  const isLive = ['FIRST_INNINGS', 'SECOND_INNINGS', 'INNINGS_BREAK'].includes(match?.state || '');
  const isNotStarted = match?.state === 'NOT_STARTED' || match?.state === 'TOSS_DONE';
  const isCompleted = match?.state === 'COMPLETED';

  const canScore = isLive && (
    match?.createdBy?._id === user?._id ||
    match?.roles?.some((r: any) => r.userId?._id === user?._id && ['scorer', 'umpire', 'organizer'].includes(r.role))
  );
  const isOwner = match?.createdBy?._id === user?._id || match?.createdBy === user?._id;

  if (isLoading && !match) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1E3A5F' }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 10 }}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }} numberOfLines={1}>
            {match?.title || 'Match'}
          </Text>
          {match?.venue ? (
            <Text style={{ color: '#93C5FD', fontSize: 11 }}>📍 {match.venue}</Text>
          ) : null}
        </View>
        {isLive && (
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#EF4444', borderRadius: 20,
            paddingHorizontal: 10, paddingVertical: 4, gap: 4,
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>LIVE</Text>
          </View>
        )}
        {isCompleted && (
          <View style={{ backgroundColor: '#7C3AED20', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: '#A78BFA', fontWeight: '700', fontSize: 11 }}>COMPLETED</Text>
          </View>
        )}
      </View>

      {/* Tab bar */}
      <View style={{ backgroundColor: '#1E3A5F' }}>
        <View style={{ flexDirection: 'row' }}>
          {TABS.map((t, i) => (
            <TouchableOpacity
              key={t}
              onPress={() => switchTab(t, i)}
              style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{
                color: tab === t ? '#fff' : 'rgba(147,197,253,0.6)',
                fontWeight: tab === t ? '700' : '500',
                fontSize: 13,
              }}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 2.5, backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <Animated.View style={{
            height: 2.5, backgroundColor: '#EF4444', width: TAB_W,
            transform: [{ translateX: tabUnderline }],
          }} />
        </View>
      </View>

      {/* Tab content */}
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        {tab === 'Live'      && <LiveTab match={match} summary={summary} recentBalls={recentBalls} />}
        {tab === 'Info'      && <InfoTab match={match} />}
        {tab === 'Scorecard' && <ScorecardTabContent matchId={id!} match={match} />}
        {tab === 'Summary'   && <SummaryTab matchId={id!} match={match} />}
        {tab === 'Squads'    && <SquadsTab match={match} />}
      </View>

      {/* Bottom action bar */}
      {canScore && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
          <TouchableOpacity
            onPress={() => router.push(`/match/${id}/score` as any)}
            style={{
              backgroundColor: '#1E3A5F', borderRadius: 14, paddingVertical: 14,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Ionicons name="baseball" size={20} color="#F59E0B" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Score Ball by Ball</Text>
          </TouchableOpacity>
        </View>
      )}

      {isNotStarted && isOwner && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
          <TouchableOpacity
            onPress={() => router.push(`/match/${id}/toss` as any)}
            style={{
              backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 14,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Text style={{ fontSize: 18 }}>🪙</Text>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
              {match?.state === 'TOSS_DONE' ? 'Setup Players & Start' : 'Setup Toss & Start'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
