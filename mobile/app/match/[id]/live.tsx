import { useEffect, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Modal, Pressable,
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

const { width: SW, height: SH } = Dimensions.get('window');

type Tab = 'Info' | 'Live' | 'Scorecard' | 'Summary' | 'Graphs' | 'Squads';
const TABS: Tab[] = ['Info', 'Live', 'Scorecard', 'Summary', 'Graphs', 'Squads'];

// ─── helpers ──────────────────────────────────────────────────

const getBallStyle = (ball: any) => {
  if (ball.wicket) return { bg: '#EF4444', color: '#fff', label: 'W' };
  if (ball.extras?.type === 'wide') return { bg: '#FEF3C7', color: '#D97706', label: 'Wd' };
  if (ball.extras?.type === 'no_ball') return { bg: '#FED7AA', color: '#EA580C', label: 'Nb' };
  if (ball.runs === 6) return { bg: '#16A34A', color: '#fff', label: '6' };
  if (ball.runs === 4) return { bg: '#2563EB', color: '#fff', label: '4' };
  return { bg: '#E5E7EB', color: '#374151', label: String(ball.runs ?? 0) };
};

const getBallLabelStyle = (label: string) => {
  if (label === 'W') return { bg: '#EF4444', color: '#fff' };
  if (label === 'Wd') return { bg: '#FEF3C7', color: '#D97706' };
  if (label === 'Nb') return { bg: '#FED7AA', color: '#EA580C' };
  if (label === '6') return { bg: '#16A34A', color: '#fff' };
  if (label === '4') return { bg: '#2563EB', color: '#fff' };
  return { bg: '#E5E7EB', color: '#374151' };
};

const runsColor = (runs: number) => {
  if (runs >= 100) return '#F59E0B';
  if (runs >= 50) return '#8B5CF6';
  if (runs >= 30) return '#2563EB';
  return '#111827';
};

const initials = (name: string) =>
  (name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

const fmtOvers = (o: number, b: number) => `${o}.${b}`;

const STATE_LABEL: Record<string, string> = {
  NOT_STARTED: 'Upcoming', TOSS_DONE: 'Ready to Start',
  FIRST_INNINGS: 'Live', INNINGS_BREAK: 'Innings Break',
  SECOND_INNINGS: 'Live', COMPLETED: 'Completed',
};

const ORDINALS = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH', '9TH', '10TH'];

// ─── WagonWheel ───────────────────────────────────────────────

const ZONE_CONFIG = [
  { key: 'straight',   angle: -90 },
  { key: 'long_off',   angle: -65 },
  { key: 'mid_off',    angle: -38 },
  { key: 'cover',      angle: -8  },
  { key: 'point',      angle: 28  },
  { key: 'gully',      angle: 58  },
  { key: 'third_man',  angle: 82  },
  { key: 'fine_leg',   angle: 100 },
  { key: 'square_leg', angle: 148 },
  { key: 'mid_wicket', angle: 188 },
  { key: 'mid_on',     angle: 218 },
  { key: 'long_on',    angle: 248 },
];

function WagonWheel({ runsByRegion }: { runsByRegion: Record<string, number> }) {
  const SIZE = 220;
  const R = SIZE / 2;
  const LABEL_R = R * 0.66;
  const toRad = (d: number) => (d * Math.PI) / 180;

  return (
    <View style={{ width: SIZE, height: SIZE, borderRadius: R, backgroundColor: '#2A6324', alignSelf: 'center', overflow: 'hidden', position: 'relative' }}>
      {/* Outer ring */}
      <View style={{ position: 'absolute', inset: 0, borderRadius: R, borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)' }} />
      {/* 6 dividing diameters */}
      {[0, 30, 60, 90, 120, 150].map((a) => (
        <View key={a} style={{ position: 'absolute', left: 0, top: R - 0.5, width: SIZE, height: 1, backgroundColor: 'rgba(255,255,255,0.12)', transform: [{ rotate: `${a}deg` }] }} />
      ))}
      {/* Inner circle boundary */}
      <View style={{ position: 'absolute', left: R * 0.28, top: R * 0.28, width: R * 1.44, height: R * 1.44, borderRadius: R * 0.72, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
      {/* Zone run values */}
      {ZONE_CONFIG.map((z) => {
        const rad = toRad(z.angle);
        const x = R + LABEL_R * Math.cos(rad) - 13;
        const y = R + LABEL_R * Math.sin(rad) - 10;
        const runs = runsByRegion?.[z.key] || 0;
        return (
          <Text key={z.key} style={{ position: 'absolute', left: x, top: y, color: runs > 0 ? '#fff' : 'rgba(255,255,255,0.25)', fontWeight: '800', fontSize: 12, textAlign: 'center', width: 26 }}>
            {runs}
          </Text>
        );
      })}
      {/* Pitch */}
      <View style={{ position: 'absolute', left: R - 10, top: R - 28, width: 20, height: 56, backgroundColor: '#C4A349', borderRadius: 4 }} />
      {/* Batsman dot */}
      <View style={{ position: 'absolute', left: R - 4, top: R - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' }} />
      {/* LEG / OFF labels */}
      <Text style={{ position: 'absolute', left: 6, top: R - 7, fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '700', transform: [{ rotate: '-90deg' }] }}>LEG</Text>
      <Text style={{ position: 'absolute', right: 6, top: R - 7, fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: '700', transform: [{ rotate: '90deg' }] }}>OFF</Text>
    </View>
  );
}

// ─── PlayerCardModal ──────────────────────────────────────────

function PlayerCardModal({ player, inn, onClose }: { player: any; inn: any; onClose: () => void }) {
  const myBalls: string[] = inn?.ballsByPlayer?.[player.playerId] || [];
  const runsByRegion: Record<string, number> = inn?.runsByRegion?.[player.playerId] || {};
  const hasWagonWheel = Object.values(runsByRegion).some((v) => v > 0);
  const partnerships = (inn?.partnerships || []).filter(
    (p: any) => p.batter1 === player.playerId || p.batter2 === player.playerId,
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: SH * 0.88 }}>
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 2, borderColor: '#BFDBFE' }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#2563EB' }}>{initials(player.playerName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827' }}>{player.playerName}</Text>
              <TouchableOpacity onPress={() => { onClose(); router.push(`/player/${player.playerId}` as any); }}>
                <Text style={{ color: '#2563EB', fontSize: 12, fontWeight: '600', marginTop: 2 }}>Open Profile</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Wagon wheel */}
            {hasWagonWheel && (
              <View style={{ paddingVertical: 20, backgroundColor: '#fff' }}>
                <WagonWheel runsByRegion={runsByRegion} />
              </View>
            )}

            {/* Total score bar */}
            <View style={{ backgroundColor: '#F0FDF4', paddingVertical: 12, alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#D1FAE5' }}>
              <Text style={{ color: '#16A34A', fontWeight: '800', fontSize: 15 }}>
                Total Score: {player.runs} ({player.balls})
              </Text>
            </View>

            {/* Stat grid */}
            <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 14, marginBottom: 10, backgroundColor: '#F9FAFB', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' }}>
              {[
                { label: 'Runs', value: player.runs },
                { label: 'Balls', value: player.balls },
                { label: '4s', value: player.fours },
                { label: '6s', value: player.sixes },
                { label: 'SR', value: (player.strikeRate ?? 0).toFixed(0) },
              ].map((stat, i, arr) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: '#E5E7EB' }}>
                  <Text style={{ fontWeight: '900', fontSize: 18, color: i === 0 ? runsColor(player.runs) : '#111827' }}>{stat.value}</Text>
                  <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* Ball timeline */}
            {myBalls.length > 0 && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 14 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 10 }}>TIMELINE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {myBalls.map((label, i) => {
                      const s = getBallLabelStyle(label);
                      return (
                        <View key={i} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: s.color }}>{label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Partnerships */}
            {partnerships.length > 0 && (
              <View style={{ marginHorizontal: 16, marginBottom: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 14 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 10 }}>PARTNERSHIPS</Text>
                {partnerships.map((p: any, i: number) => {
                  const isB1 = p.batter1 === player.playerId;
                  const partnerName = isB1 ? (p.batter2Name || '—') : (p.batter1Name || '—');
                  const myRuns = isB1 ? p.runs1 : p.runs2;
                  return (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                      <View>
                        <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '600' }}>P'ship with</Text>
                        <Text style={{ color: '#374151', fontSize: 14, fontWeight: '700' }}>{partnerName}</Text>
                      </View>
                      <Text style={{ color: '#111827', fontWeight: '800', fontSize: 14 }}>
                        {myRuns} runs in {p.balls} b
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Open Profile button */}
            <TouchableOpacity
              onPress={() => { onClose(); router.push(`/player/${player.playerId}` as any); }}
              style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: '#F3F4F6', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#2563EB', fontWeight: '700', fontSize: 15 }}>Open Profile</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── BowlerCardModal ─────────────────────────────────────────

function BowlerCardModal({ bowler, onClose }: { bowler: any; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#EA580C' }}>{initials(bowler.playerName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', fontSize: 16, color: '#111827' }}>{bowler.playerName}</Text>
                <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 1 }}>Bowler</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: 6, borderRadius: 20, backgroundColor: '#F3F4F6' }}>
                <Ionicons name="close" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', margin: 16, backgroundColor: '#F9FAFB', borderRadius: 16, overflow: 'hidden' }}>
              {[
                { label: 'Overs', value: `${bowler.overs}.${bowler.balls % 6}` },
                { label: 'Runs', value: bowler.runs },
                { label: 'Wickets', value: bowler.wickets },
                { label: 'Eco', value: (bowler.economy ?? 0).toFixed(2) },
                { label: 'Maidens', value: bowler.maidens },
              ].map((stat, i, arr) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 16, borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: '#E5E7EB' }}>
                  <Text style={{ fontWeight: '900', fontSize: 18, color: i === 2 && bowler.wickets > 0 ? '#EF4444' : '#111827' }}>{stat.value}</Text>
                  <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{stat.label}</Text>
                </View>
              ))}
            </View>
            <View style={{ height: 24 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── LiveTab ──────────────────────────────────────────────────

function LiveTab({ match, summary, recentBalls }: { match: any; summary: any; recentBalls: any[] }) {
  const cs = summary?.currentState;
  const inningsNum = cs?.innings ?? 1;
  const inningsSummary = summary?.innings?.[inningsNum - 1];
  const isCompleted = match?.state === 'COMPLETED';

  if (!cs || (!cs.totalRuns && !isCompleted)) {
    const isNotStarted = ['NOT_STARTED', 'TOSS_DONE'].includes(match?.state);
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ backgroundColor: '#1E3A5F', borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 16 }}>
          <View style={{ backgroundColor: 'rgba(93,194,253,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 16 }}>
            <Text style={{ color: '#93C5FD', fontSize: 11, fontWeight: '700' }}>{STATE_LABEL[match?.state] || match?.state}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16, width: '100%' }}>
            {[match?.teamA, match?.teamB].map((team: any, ti: number) => (
              ti === 1 ? (
                <View key="vs" style={{ alignItems: 'center' }}>
                  <Text style={{ color: '#F59E0B', fontWeight: '900', fontSize: 20 }}>VS</Text>
                  {match?.totalOvers && <Text style={{ color: '#93C5FD', fontSize: 11, marginTop: 4 }}>{match.totalOvers} ov</Text>}
                </View>
              ) : null
            ))}
            {[match?.teamA, match?.teamB].map((team: any, ti: number) => (
              <View key={ti} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: (team?.color || '#1E3A5F') + '30', borderWidth: 2, borderColor: (team?.color || '#93C5FD') + '60', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <Text style={{ fontWeight: '900', fontSize: 14, color: team?.color || '#fff' }}>{team?.shortName}</Text>
                </View>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' }} numberOfLines={2}>{team?.name}</Text>
              </View>
            ))}
          </View>
          {match?.toss?.winner && (
            <View style={{ backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: '#F59E0B', fontSize: 12, textAlign: 'center' }}>
                🪙 {match.toss.winner?.toString() === match.teamA?._id?.toString() ? match.teamA?.name : match.teamB?.name} won toss · chose to {match.toss.decision}
              </Text>
            </View>
          )}
        </View>
        {isNotStarted && (
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>⏳</Text>
            <Text style={{ fontWeight: '700', color: '#374151', fontSize: 16, marginBottom: 4 }}>
              {match?.state === 'TOSS_DONE' ? 'Toss Done – Ready to Start' : 'Match Not Started Yet'}
            </Text>
            {match?.venue && <Text style={{ color: '#9CA3AF', textAlign: 'center', fontSize: 13 }}>📍 {match.venue}</Text>}
          </View>
        )}
      </ScrollView>
    );
  }

  const battingTeamName = inningsNum === 1
    ? match?.innings?.first?.battingTeam?.name
    : match?.innings?.second?.battingTeam?.name;

  const thisOverBalls = recentBalls.filter((b) => b.over === cs.over);
  const displayBalls = thisOverBalls.length > 0 ? thisOverBalls : recentBalls.slice(0, 6);

  const strikerId = (cs.striker?._id || cs.striker)?.toString();
  const nonStrikerId = (cs.nonStriker?._id || cs.nonStriker)?.toString();
  const bowlerId = (cs.currentBowler?._id || cs.currentBowler)?.toString();

  const currentBatters = (inningsSummary?.batting || []).filter((b: any) => {
    const pid = b.playerId?.toString?.() || b.playerId;
    return pid === strikerId || pid === nonStrikerId;
  });
  const currentBowler = (inningsSummary?.bowling || []).find((b: any) => {
    const pid = b.playerId?.toString?.() || b.playerId;
    return pid === bowlerId;
  });

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Score hero */}
      <View style={{ backgroundColor: '#1E3A5F', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 }}>
        <Text style={{ color: '#93C5FD', fontSize: 11, fontWeight: '700', marginBottom: 4 }}>
          {battingTeamName || `Innings ${inningsNum}`}
          {isCompleted ? ' · FULL TIME' : ' · IN PROGRESS'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: '#F59E0B', fontSize: 56, fontWeight: '900', lineHeight: 60 }}>
              {cs.totalRuns}/{cs.wickets}
            </Text>
            <Text style={{ color: '#93C5FD', fontSize: 15 }}>({fmtOvers(cs.over, cs.ball)} ov)</Text>
          </View>
          <View style={{ alignItems: 'flex-end', paddingBottom: 4 }}>
            {cs.target ? (
              <>
                <Text style={{ color: '#93C5FD', fontSize: 10, fontWeight: '600' }}>TARGET</Text>
                <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{cs.target}</Text>
                {cs.requiredRuns != null && (
                  <Text style={{ color: '#F59E0B', fontSize: 12, marginTop: 2 }}>
                    Need {cs.requiredRuns} @ {cs.requiredRate?.toFixed(2)} rpo
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={{ color: '#93C5FD', fontSize: 10, fontWeight: '600' }}>CRR</Text>
                <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{(cs.currentRate ?? 0).toFixed(2)}</Text>
                {match?.totalOvers && !isCompleted && (
                  <Text style={{ color: '#93C5FD', fontSize: 11, marginTop: 2 }}>
                    Proj: {Math.round((cs.currentRate ?? 0) * match.totalOvers)}
                  </Text>
                )}
              </>
            )}
          </View>
        </View>
        {isCompleted && match?.result?.description && (
          <View style={{ marginTop: 10, backgroundColor: 'rgba(22,163,74,0.18)', borderRadius: 10, padding: 10 }}>
            <Text style={{ color: '#4ADE80', fontWeight: '700', fontSize: 13 }}>🏆 {match.result.description}</Text>
          </View>
        )}
      </View>

      {/* This over */}
      {displayBalls.length > 0 && !isCompleted && (
        <View style={{ backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 12, marginTop: 6 }}>
          <Text style={{ fontWeight: '700', color: '#9CA3AF', fontSize: 10, letterSpacing: 0.5, marginBottom: 10 }}>THIS OVER</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {displayBalls.map((ball, i) => {
              const s = getBallStyle(ball);
              return (
                <View key={ball._id || i} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: s.color }}>{s.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Current batters */}
      {currentBatters.length > 0 && (
        <View style={{ backgroundColor: '#fff', marginTop: 6, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 }}>
          <Text style={{ fontWeight: '700', color: '#9CA3AF', fontSize: 10, letterSpacing: 0.5, marginBottom: 10 }}>BATTING</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {currentBatters.map((b: any, i: number) => {
              const isStriker = b.playerId?.toString() === strikerId;
              return (
                <View key={i} style={{ flex: 1, backgroundColor: isStriker ? '#EFF6FF' : '#F9FAFB', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: isStriker ? '#2563EB' : '#E5E7EB' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontWeight: '800', color: isStriker ? '#1D4ED8' : '#374151', fontSize: 13, flex: 1 }} numberOfLines={1}>{b.playerName}</Text>
                    {isStriker && (
                      <View style={{ backgroundColor: '#2563EB', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>ON</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: '#111827' }}>
                    {b.runs}<Text style={{ fontSize: 14, color: '#9CA3AF', fontWeight: '400' }}>({b.balls})</Text>
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>4s: {b.fours}</Text>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>6s: {b.sixes}</Text>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>SR: {(b.strikeRate ?? 0).toFixed(0)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Current bowler */}
      {currentBowler && !isCompleted && (
        <View style={{ backgroundColor: '#fff', marginTop: 6, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14 }}>
          <Text style={{ fontWeight: '700', color: '#9CA3AF', fontSize: 10, letterSpacing: 0.5, marginBottom: 10 }}>BOWLING</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#FED7AA' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: '#92400E', fontSize: 14 }}>{currentBowler.playerName}</Text>
              <Text style={{ fontSize: 11, color: '#D97706', marginTop: 2 }}>
                {currentBowler.overs}.{currentBowler.balls % 6} ov · {currentBowler.runs} runs · {currentBowler.wickets}W
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Eco</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: '#111827' }}>{(currentBowler.economy ?? 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Commentary */}
      {recentBalls.length > 0 && (
        <View style={{ backgroundColor: '#fff', marginTop: 6, paddingBottom: 8 }}>
          <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <Text style={{ fontWeight: '700', color: '#9CA3AF', fontSize: 10, letterSpacing: 0.5 }}>COMMENTARY</Text>
          </View>
          {[...recentBalls].slice(0, 20).map((ball, i) => {
            const s = getBallStyle(ball);
            let cText = '';
            try { cText = generateCommentary(ball, ball.batsman?.name || 'Batsman', ball.bowler?.name || 'Bowler'); }
            catch { cText = `${ball.bowler?.name || 'Bowler'} to ${ball.batsman?.name || 'Batsman'}, ${ball.runs ?? 0}`; }
            return (
              <View key={ball._id || i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F9FAFB' }}>
                <Text style={{ color: '#9CA3AF', fontSize: 11, width: 38, paddingTop: 2 }}>
                  {ball.over != null ? `${ball.over}.${ball.ball}` : ''}
                </Text>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: s.color }}>{s.label}</Text>
                </View>
                <Text style={{ color: '#374151', fontSize: 13, lineHeight: 19, flex: 1 }} numberOfLines={3}>{cText}</Text>
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
  const [loading, setLoading] = useState(true);
  const [activeInnings, setActiveInnings] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [selectedBowler, setSelectedBowler] = useState<any>(null);

  useEffect(() => {
    api.get(`/matches/${matchId}/scorecard`)
      .then((res: any) => setScorecard(res.data.scorecard?.summary))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) return <ActivityIndicator style={{ marginTop: 48 }} color="#1E3A5F" />;

  const allInnings: any[] = scorecard?.innings || [];

  const getBattingTeamId = (idx: number) =>
    idx === 0
      ? match?.innings?.first?.battingTeam?._id || match?.innings?.first?.battingTeam
      : match?.innings?.second?.battingTeam?._id || match?.innings?.second?.battingTeam;

  const getTeamName = (idx: number) => {
    const id = getBattingTeamId(idx)?.toString();
    if (id === match?.teamA?._id?.toString()) return match?.teamA?.name;
    return match?.teamB?.name;
  };

  const getTeamShort = (idx: number) => {
    const id = getBattingTeamId(idx)?.toString();
    if (id === match?.teamA?._id?.toString()) return match?.teamA?.shortName || match?.teamA?.name?.slice(0, 3)?.toUpperCase();
    return match?.teamB?.shortName || match?.teamB?.name?.slice(0, 3)?.toUpperCase();
  };

  const teamColor = (idx: number) => {
    const id = getBattingTeamId(idx)?.toString();
    if (id === match?.teamA?._id?.toString()) return match?.teamA?.color || '#1E3A5F';
    return match?.teamB?.color || '#7C3AED';
  };

  const getSquad = (idx: number) => {
    const id = getBattingTeamId(idx)?.toString();
    if (id === match?.teamA?._id?.toString()) return match?.teamA?.players || [];
    return match?.teamB?.players || [];
  };

  const inn = allInnings[activeInnings];

  if (allInnings.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 64 }}>
        <Text style={{ fontSize: 36, marginBottom: 8 }}>📋</Text>
        <Text style={{ color: '#9CA3AF', fontSize: 14 }}>No scorecard yet</Text>
      </View>
    );
  }

  const crr = inn && (inn.overs > 0 || inn.balls > 0)
    ? inn.totalRuns / (inn.overs + inn.balls / 6)
    : 0;

  const didNotBat = (() => {
    if (!inn) return [];
    const squad = getSquad(activeInnings);
    const battedIds = new Set((inn.batting || []).map((b: any) => b.playerId?.toString()));
    return squad.filter((p: any) => {
      const pid = (p.userId?._id || p.userId)?.toString();
      return pid && !battedIds.has(pid);
    });
  })();

  // FOW name lookup
  const fowNameMap = Object.fromEntries(
    (inn?.batting || []).map((b: any) => [b.playerId?.toString(), b.playerName])
  );

  const color = teamColor(activeInnings);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Innings toggle */}
      <View style={{ flexDirection: 'row', padding: 10, gap: 8 }}>
        {[0, 1].map((idx) => {
          const exists = !!allInnings[idx];
          const isActive = activeInnings === idx;
          const c = teamColor(idx);
          const inactiveC = idx === 0 ? teamColor(1) : teamColor(0);
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => exists && setActiveInnings(idx)}
              disabled={!exists}
              activeOpacity={0.75}
              style={{
                flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
                borderWidth: 2,
                borderColor: isActive ? c : (exists ? inactiveC + '40' : '#E5E7EB'),
                backgroundColor: isActive ? c : '#fff',
                opacity: exists ? 1 : 0.35,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, fontWeight: '800', letterSpacing: 0.4, color: isActive ? 'rgba(255,255,255,0.75)' : '#9CA3AF', marginBottom: 1 }}>
                  {idx === 0 ? '1ST' : '2ND'} INNINGS
                </Text>
                <Text style={{ fontWeight: '800', fontSize: 14, color: isActive ? '#fff' : '#374151' }} numberOfLines={1}>
                  {getTeamShort(idx) || '—'}
                </Text>
              </View>
              {exists ? (
                <Text style={{ fontSize: 20, fontWeight: '900', color: isActive ? '#fff' : c, marginLeft: 6 }}>
                  {allInnings[idx]?.totalRuns}/{allInnings[idx]?.wickets}
                </Text>
              ) : (
                <Text style={{ fontSize: 10, color: '#9CA3AF' }}>TBB</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {inn && (
        <>
          {/* Innings header */}
          <View style={{ backgroundColor: '#1E3A5F', paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: '#93C5FD', fontSize: 10, fontWeight: '700', marginBottom: 2, letterSpacing: 0.5 }}>
                {activeInnings === 0 ? '1ST' : '2ND'} INNINGS · {getTeamName(activeInnings)?.toUpperCase()}
              </Text>
              <Text style={{ color: '#F59E0B', fontWeight: '900', fontSize: 24 }}>
                {inn.totalRuns}/{inn.wickets}
                <Text style={{ fontSize: 14, color: '#93C5FD', fontWeight: '400' }}> ({inn.overs}.{inn.balls} ov)</Text>
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View>
                <Text style={{ color: '#9CA3AF', fontSize: 9, fontWeight: '600' }}>RUN RATE</Text>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 20, textAlign: 'right' }}>{crr.toFixed(2)}</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(93,194,253,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: '#93C5FD', fontSize: 10 }}>
                  Extras: {inn.extras?.total ?? 0}
                </Text>
              </View>
            </View>
          </View>

          {/* Batting table */}
          <View style={{ backgroundColor: '#fff' }}>
            <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F0F4FF' }}>
              <Text style={{ width: 22, fontSize: 9, fontWeight: '700', color: '#9CA3AF' }}>#</Text>
              <Text style={{ flex: 1, fontSize: 10, fontWeight: '800', color: '#4338CA' }}>BATTING</Text>
              {['R', 'B', '4s', '6s', 'SR'].map((h) => (
                <Text key={h} style={{ width: 34, textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#6B7280' }}>{h}</Text>
              ))}
            </View>
            {(inn.batting || []).map((b: any, bi: number) => (
              <TouchableOpacity
                key={bi}
                onPress={() => setSelectedPlayer(b)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', alignItems: 'center' }}
              >
                <Text style={{ width: 22, fontSize: 11, color: '#D1D5DB', fontWeight: '700' }}>{bi + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: b.isOut ? '#111827' : '#16A34A', fontSize: 13 }}>{b.playerName}</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 10, marginTop: 1 }}>
                    {b.isOut ? b.dismissal?.replace(/_/g, ' ') : 'not out'}
                  </Text>
                </View>
                <Text style={{ width: 34, textAlign: 'center', fontWeight: '900', color: runsColor(b.runs), fontSize: 16 }}>{b.runs}</Text>
                <Text style={{ width: 34, textAlign: 'center', color: '#6B7280' }}>{b.balls}</Text>
                <Text style={{ width: 34, textAlign: 'center', color: '#6B7280' }}>{b.fours}</Text>
                <Text style={{ width: 34, textAlign: 'center', color: '#6B7280' }}>{b.sixes}</Text>
                <Text style={{ width: 34, textAlign: 'center', color: '#6B7280', fontSize: 12 }}>{(b.strikeRate ?? 0).toFixed(0)}</Text>
              </TouchableOpacity>
            ))}

            {/* Extras + Total */}
            <View style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#FAFAFA', borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
              <Text style={{ color: '#6B7280', fontSize: 12 }}>
                Extras {inn.extras?.total ?? 0}  (wd {inn.extras?.wides ?? 0}, nb {inn.extras?.noBalls ?? 0}, b {inn.extras?.byes ?? 0}, lb {inn.extras?.legByes ?? 0})
              </Text>
            </View>
            <View style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#EEF2FF', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '800', color: '#4338CA', fontSize: 13 }}>TOTAL</Text>
              <Text style={{ fontWeight: '900', color: '#1E3A5F', fontSize: 18 }}>
                {inn.totalRuns}/{inn.wickets}  ({inn.overs}.{inn.balls} Ov)
              </Text>
            </View>

            {/* Did not bat */}
            {didNotBat.length > 0 && (
              <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <Text style={{ fontWeight: '700', color: '#9CA3AF', fontSize: 10, marginBottom: 8, letterSpacing: 0.5 }}>DID NOT BAT</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {didNotBat.map((p: any, i: number) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => { const pid = (p.userId?._id || p.userId)?.toString(); if (pid) router.push(`/player/${pid}` as any); }}
                      style={{ backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#E5E7EB' }}
                    >
                      <Text style={{ color: '#374151', fontSize: 12, fontWeight: '600' }}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Fall of wickets */}
            {(inn.fallOfWickets || []).length > 0 && (
              <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <Text style={{ fontWeight: '700', color: '#9CA3AF', fontSize: 10, marginBottom: 10, letterSpacing: 0.5 }}>FALL OF WICKETS</Text>
                <View style={{ gap: 6 }}>
                  {inn.fallOfWickets.map((fow: any, fi: number) => {
                    const name = fowNameMap[fow.batsmanOut?.toString()] || `W${fi + 1}`;
                    return (
                      <View key={fi} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#92400E', fontSize: 10, fontWeight: '800' }}>{fi + 1}</Text>
                        </View>
                        <Text style={{ fontWeight: '700', color: '#374151', fontSize: 13, flex: 1 }}>{name}</Text>
                        <Text style={{ color: '#6B7280', fontSize: 12 }}>{fow.runs ?? fow.score}</Text>
                        <Text style={{ color: '#9CA3AF', fontSize: 11 }}>({fow.over}.{fow.ball} ov)</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Partnerships */}
            {(inn.partnerships || []).length > 0 && (
              <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
                <Text style={{ fontWeight: '700', color: '#9CA3AF', fontSize: 10, marginBottom: 12, letterSpacing: 0.5 }}>PARTNERSHIPS</Text>
                {inn.partnerships.map((p: any, pi: number) => {
                  const total = (p.runs1 || 0) + (p.runs2 || 0);
                  const pct1 = total > 0 ? p.runs1 / total : 0.5;
                  return (
                    <View key={pi} style={{ marginBottom: 14 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 6 }}>
                        {ORDINALS[pi] || `${pi + 1}TH`} WICKET{p.isActive ? ' (ongoing)' : ''}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: '#111827', fontSize: 13 }}>{p.batter1Name}</Text>
                          <Text style={{ color: '#6B7280', fontSize: 11 }}>{p.runs1} runs</Text>
                        </View>
                        <View style={{ paddingHorizontal: 10, alignItems: 'center' }}>
                          <Text style={{ fontWeight: '900', color: '#1E3A5F', fontSize: 18 }}>{p.totalRuns}</Text>
                          <Text style={{ color: '#9CA3AF', fontSize: 10 }}>({p.balls} b)</Text>
                        </View>
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                          <Text style={{ fontWeight: '700', color: '#111827', fontSize: 13 }}>{p.batter2Name || '—'}</Text>
                          <Text style={{ color: '#6B7280', fontSize: 11 }}>{p.runs2} runs</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#E5E7EB' }}>
                        <View style={{ flex: Math.max(pct1 * 100, 2), backgroundColor: '#16A34A' }} />
                        <View style={{ flex: Math.max((1 - pct1) * 100, 2), backgroundColor: '#EF4444' }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Bowling table */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F0F4FF' }}>
              <Text style={{ flex: 1, fontSize: 10, fontWeight: '800', color: '#4338CA' }}>BOWLING</Text>
              {['O', 'M', 'R', 'W', 'Eco'].map((h) => (
                <Text key={h} style={{ width: 36, textAlign: 'center', fontSize: 10, fontWeight: '700', color: '#6B7280' }}>{h}</Text>
              ))}
            </View>
            {(inn.bowling || []).map((b: any, bi: number) => (
              <TouchableOpacity
                key={bi}
                onPress={() => setSelectedBowler(b)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5', alignItems: 'center' }}
              >
                <Text style={{ flex: 1, fontWeight: '700', color: '#111827', fontSize: 13 }}>{b.playerName}</Text>
                <Text style={{ width: 36, textAlign: 'center', color: '#6B7280', fontSize: 12 }}>{b.overs}.{b.balls % 6}</Text>
                <Text style={{ width: 36, textAlign: 'center', color: '#6B7280' }}>{b.maidens}</Text>
                <Text style={{ width: 36, textAlign: 'center', color: '#6B7280' }}>{b.runs}</Text>
                <Text style={{ width: 36, textAlign: 'center', fontWeight: '900', color: b.wickets > 0 ? '#EF4444' : '#111827', fontSize: 15 }}>{b.wickets}</Text>
                <Text style={{ width: 36, textAlign: 'center', color: '#6B7280', fontSize: 12 }}>{(b.economy ?? 0).toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <View style={{ height: 100 }} />

      {selectedPlayer && inn && (
        <PlayerCardModal player={selectedPlayer} inn={inn} onClose={() => setSelectedPlayer(null)} />
      )}
      {selectedBowler && (
        <BowlerCardModal bowler={selectedBowler} onClose={() => setSelectedBowler(null)} />
      )}
    </ScrollView>
  );
}

// ─── OverScroller ─────────────────────────────────────────────

function OverScroller({ perOverData }: { perOverData: any[] }) {
  if (!perOverData || perOverData.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', gap: 0 }}
    >
      {perOverData.map((ov, idx) => (
        <View key={ov.over} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Pipe separator between overs */}
          {idx > 0 && (
            <View style={{ width: 1, height: 32, backgroundColor: '#E5E7EB', marginHorizontal: 8 }} />
          )}
          {/* Over label */}
          <Text style={{ fontSize: 9, fontWeight: '800', color: '#9CA3AF', marginRight: 6 }}>Ov {ov.over}</Text>
          {/* Ball circles */}
          {(ov.balls || []).map((b: string, bi: number) => {
            const s = getBallLabelStyle(b);
            return (
              <View key={bi} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center', marginRight: 3 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: s.color }}>{b}</Text>
              </View>
            );
          })}
          {/* Over total */}
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#374151', marginLeft: 5 }}>={ov.runs}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── InningsProgressionBar ────────────────────────────────────

function InningsProgressionBar({ overs, totalOvers, color }: { overs: any[]; totalOvers: number; color: string }) {
  const phases = [
    { label: '1–6', start: 1, end: 6 },
    { label: '7–14', start: 7, end: 14 },
    { label: `15–${totalOvers}`, start: 15, end: totalOvers },
  ];
  const phaseData = phases.map((ph) => {
    const phOvers = overs.filter((o) => o.over >= ph.start && o.over <= ph.end);
    return {
      label: ph.label,
      runs: phOvers.reduce((s: number, o: any) => s + o.runs, 0),
      wickets: phOvers.reduce((s: number, o: any) => s + o.wickets, 0),
    };
  });
  const maxRuns = Math.max(...phaseData.map((p) => p.runs), 1);

  return (
    <View style={{ gap: 10 }}>
      {phaseData.map((ph, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ width: 40, fontSize: 11, color: '#9CA3AF', fontWeight: '600' }}>{ph.label}</Text>
          <View style={{ flex: 1, height: 14, backgroundColor: '#F3F4F6', borderRadius: 7, overflow: 'hidden' }}>
            <View style={{ width: `${(ph.runs / maxRuns) * 100}%`, height: '100%', backgroundColor: color, borderRadius: 7 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 2, minWidth: 30 }}>
            {Array.from({ length: Math.min(ph.wickets, 5) }).map((_, wi) => (
              <View key={wi} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 7, fontWeight: '900' }}>W</Text>
              </View>
            ))}
          </View>
          <Text style={{ width: 52, textAlign: 'right', fontSize: 11, fontWeight: '700', color: '#374151' }}>{ph.runs} runs</Text>
        </View>
      ))}
    </View>
  );
}

// ─── SummaryTab ───────────────────────────────────────────────

function SummaryTab({ matchId, match }: { matchId: string; match: any }) {
  const [scorecard, setScorecard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeInn, setActiveInn] = useState(0);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [selectedInnForModal, setSelectedInnForModal] = useState<any>(null);
  const [selectedBowlerForSummary, setSelectedBowlerForSummary] = useState<any>(null);

  useEffect(() => {
    api.get(`/matches/${matchId}/scorecard`)
      .then((res: any) => setScorecard(res.data.scorecard?.summary))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) return <ActivityIndicator style={{ marginTop: 48 }} color="#1E3A5F" />;

  if (match?.state !== 'COMPLETED') {
    return (
      <View style={{ alignItems: 'center', paddingTop: 64, paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>⏳</Text>
        <Text style={{ fontWeight: '800', color: '#374151', fontSize: 16, marginBottom: 6 }}>Match in Progress</Text>
        <Text style={{ color: '#9CA3AF', textAlign: 'center', fontSize: 13 }}>
          Summary available once the match is completed
        </Text>
      </View>
    );
  }

  const innings: any[] = scorecard?.innings || [];
  const totalOvers = match?.totalOvers || 20;

  const getBattingTeamId = (idx: number) =>
    idx === 0
      ? match?.innings?.first?.battingTeam?._id || match?.innings?.first?.battingTeam
      : match?.innings?.second?.battingTeam?._id || match?.innings?.second?.battingTeam;

  const getTeamName = (idx: number) => {
    const id = getBattingTeamId(idx)?.toString();
    if (id === match?.teamA?._id?.toString()) return match?.teamA?.name;
    return match?.teamB?.name;
  };

  const getTeamShort = (idx: number) => {
    const id = getBattingTeamId(idx)?.toString();
    if (id === match?.teamA?._id?.toString()) return match?.teamA?.shortName || match?.teamA?.name?.slice(0, 3)?.toUpperCase();
    return match?.teamB?.shortName || match?.teamB?.name?.slice(0, 3)?.toUpperCase();
  };

  const winnerId = match?.result?.winner?.toString();
  const isWinner = (idx: number) => getBattingTeamId(idx)?.toString() === winnerId;

  // Top performers
  const getTopPerformers = (inn: any) => {
    const topBat = [...(inn.batting || [])].sort((a: any, b: any) => b.runs - a.runs).slice(0, 2);
    const topBowl = [...(inn.bowling || [])].sort((a: any, b: any) => b.wickets - a.wickets || (a.economy ?? 99) - (b.economy ?? 99)).slice(0, 1);
    return { topBat, topBowl };
  };

  // MVP: best player across both innings
  const allBatters = innings.flatMap((inn: any, idx: number) =>
    (inn.batting || []).map((b: any) => ({ ...b, inningsIdx: idx }))
  );
  const allBowlers = innings.flatMap((inn: any, idx: number) =>
    (inn.bowling || []).map((b: any) => ({ ...b, inningsIdx: idx }))
  );
  const mvpBatter = [...allBatters].sort((a, b) => b.runs - a.runs)[0];
  const mvpBowler = [...allBowlers].sort((a, b) => b.wickets - a.wickets || (a.economy ?? 99) - (b.economy ?? 99))[0];
  const mvp = (mvpBatter?.runs ?? 0) >= (mvpBowler?.wickets ?? 0) * 25 ? mvpBatter : mvpBowler;
  const mvpIsBatter = mvp && 'balls' in mvp;

  const tossLabel = match?.toss
    ? `${match.toss.winner?.toString() === match?.teamA?._id?.toString() ? match?.teamA?.name : match?.teamB?.name} opt to ${match.toss.decision}`
    : '';

  const openPlayer = (player: any, inn: any) => {
    setSelectedPlayer(player);
    setSelectedInnForModal(inn);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Score banner */}
      <View style={{ backgroundColor: '#1E3A5F', paddingHorizontal: 16, paddingVertical: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          {/* Team 1 score — left */}
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            {innings[0] && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  {isWinner(0) && <Text style={{ fontSize: 14 }}>🏆</Text>}
                  <Text style={{ color: isWinner(0) ? '#F59E0B' : '#93C5FD', fontWeight: '800', fontSize: 12, letterSpacing: 0.3 }}>
                    {getTeamShort(0)}
                  </Text>
                </View>
                <Text style={{ color: isWinner(0) ? '#fff' : '#93C5FD', fontWeight: '900', fontSize: 26 }}>
                  {innings[0].totalRuns}-{innings[0].wickets}
                </Text>
                <Text style={{ color: '#6B9FD4', fontSize: 11 }}>({innings[0].overs}.{innings[0].balls})</Text>
              </>
            )}
          </View>

          {/* VS — center */}
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }}>
            <Text style={{ color: '#F59E0B', fontWeight: '900', fontSize: 20 }}>VS</Text>
          </View>

          {/* Team 2 score — right */}
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            {innings[1] ? (
              <>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  {isWinner(1) && <Text style={{ fontSize: 14 }}>🏆</Text>}
                  <Text style={{ color: isWinner(1) ? '#F59E0B' : '#93C5FD', fontWeight: '800', fontSize: 12, letterSpacing: 0.3 }}>
                    {getTeamShort(1)}
                  </Text>
                </View>
                <Text style={{ color: isWinner(1) ? '#fff' : '#93C5FD', fontWeight: '900', fontSize: 26 }}>
                  {innings[1].totalRuns}-{innings[1].wickets}
                </Text>
                <Text style={{ color: '#6B9FD4', fontSize: 11 }}>({innings[1].overs}.{innings[1].balls})</Text>
              </>
            ) : null}
          </View>
        </View>
        {match?.result?.description && (
          <View style={{ backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7, alignSelf: 'center' }}>
            <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 13 }}>{match.result.description}</Text>
          </View>
        )}
      </View>

      {/* Over-by-over scroller */}
      {innings.length > 0 && (
        <View style={{ backgroundColor: '#fff', marginTop: 6 }}>
          {innings.length > 1 && (
            <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, gap: 8 }}>
              {innings.map((_: any, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setActiveInn(idx)}
                  style={{ paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, backgroundColor: activeInn === idx ? '#1E3A5F' : '#F3F4F6' }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: activeInn === idx ? '#fff' : '#6B7280' }}>
                    {getTeamShort(idx)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <OverScroller perOverData={innings[activeInn]?.perOverData || []} />
        </View>
      )}

      {/* MVP Card */}
      {mvp && (
        <View style={{ backgroundColor: '#fff', marginTop: 6, marginHorizontal: 0 }}>
          <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 16 }}>⭐</Text>
            <Text style={{ fontWeight: '800', color: '#111827', fontSize: 15 }}>MVP</Text>
          </View>
          <TouchableOpacity
            onPress={() => openPlayer(mvp, innings[mvp.inningsIdx])}
            activeOpacity={0.7}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, marginBottom: 4, backgroundColor: '#FFFBEB', marginHorizontal: 12, borderRadius: 16, borderWidth: 1.5, borderColor: '#FDE68A' }}
          >
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: '#D97706' }}>{initials(mvp.playerName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', fontSize: 15, color: '#111827', marginBottom: 2 }}>{mvp.playerName}</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{getTeamName(mvp.inningsIdx)} · {mvp.inningsIdx === 0 ? '1st' : '2nd'} Innings</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {mvpIsBatter ? (
                <>
                  <Text style={{ fontWeight: '900', fontSize: 22, color: '#D97706' }}>{mvp.runs}</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 12 }}>({mvp.balls}) SR {(mvp.strikeRate ?? 0).toFixed(0)}</Text>
                </>
              ) : (
                <>
                  <Text style={{ fontWeight: '900', fontSize: 22, color: '#D97706' }}>{mvp.wickets}W</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{mvp.runs} runs, {(mvp.economy ?? 0).toFixed(2)} ER</Text>
                </>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#D97706" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      )}

      {/* Top Performers */}
      {innings.length > 0 && (
        <View style={{ backgroundColor: '#fff', marginTop: 6, paddingBottom: 8 }}>
          <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 }}>
            <Text style={{ fontWeight: '800', color: '#111827', fontSize: 15 }}>Top Performers</Text>
          </View>

          {innings.map((inn: any, idx: number) => {
            const { topBat, topBowl } = getTopPerformers(inn);
            return (
              <View key={idx}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#F9FAFB' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#374151' }}>
                    {getTeamName(idx)} · {idx === 0 ? '1st' : '2nd'} Innings
                  </Text>
                  {idx === 0 && tossLabel ? (
                    <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '600' }}>{tossLabel}</Text>
                  ) : null}
                </View>
                {topBat.map((b: any, i: number) => (
                  <TouchableOpacity
                    key={`bat-${i}`}
                    onPress={() => openPlayer(b, inn)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#2563EB' }}>{initials(b.playerName)}</Text>
                      </View>
                      <View>
                        <Text style={{ fontWeight: '700', color: '#111827', fontSize: 13 }}>{b.playerName}</Text>
                        <Text style={{ color: '#9CA3AF', fontSize: 11 }}>SR: {(b.strikeRate ?? 0).toFixed(0)}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontWeight: '800', color: runsColor(b.runs), fontSize: 16 }}>
                        {b.runs}({b.balls}){!b.isOut ? '*' : ''}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>
                ))}
                {topBowl.map((b: any, i: number) => (
                  <TouchableOpacity
                    key={`bowl-${i}`}
                    onPress={() => setSelectedBowlerForSummary(b)}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#EA580C' }}>{initials(b.playerName)}</Text>
                      </View>
                      <View>
                        <Text style={{ fontWeight: '700', color: '#111827', fontSize: 13 }}>{b.playerName}</Text>
                        <Text style={{ color: '#9CA3AF', fontSize: 11 }}>ER: {(b.economy ?? 0).toFixed(2)}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontWeight: '800', color: '#EF4444', fontSize: 14 }}>
                        {b.wickets}-{b.runs} ({b.overs}.{b.balls % 6})
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </View>
      )}

      {/* Innings Progression */}
      {innings.length > 0 && (
        <View style={{ backgroundColor: '#fff', marginTop: 6, paddingHorizontal: 14, paddingVertical: 14 }}>
          <Text style={{ fontWeight: '800', color: '#111827', fontSize: 15, marginBottom: 16 }}>Innings Progression</Text>
          {innings.map((inn: any, idx: number) => (
            <View key={idx} style={{ marginBottom: idx < innings.length - 1 ? 20 : 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontWeight: '700', color: idx === 0 ? '#2563EB' : '#0891B2', fontSize: 13 }}>
                  {getTeamShort(idx)} · {idx === 0 ? '1st' : '2nd'} Innings
                </Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{inn.totalRuns}/{inn.wickets}</Text>
              </View>
              <InningsProgressionBar overs={inn.perOverData || []} totalOvers={totalOvers} color={idx === 0 ? '#3B82F6' : '#06B6D4'} />
            </View>
          ))}
        </View>
      )}

      {selectedPlayer && selectedInnForModal && (
        <PlayerCardModal player={selectedPlayer} inn={selectedInnForModal} onClose={() => { setSelectedPlayer(null); setSelectedInnForModal(null); }} />
      )}
      {selectedBowlerForSummary && (
        <BowlerCardModal bowler={selectedBowlerForSummary} onClose={() => setSelectedBowlerForSummary(null)} />
      )}
    </ScrollView>
  );
}

// ─── GraphsTab ────────────────────────────────────────────────

const GRAPH_COLORS = { inn1: '#6B7280', inn2: '#EF4444' };

function ManhattanChartFull({
  overs1, overs2, color1, color2, showBoth, label1, label2,
}: {
  overs1: any[]; overs2?: any[]; color1: string; color2: string;
  showBoth: boolean; label1: string; label2: string;
}) {
  const BAR_H = 160;
  const BAR_W = showBoth ? 14 : 20;
  const GAP = showBoth ? 2 : 4;

  const overs1Map = Object.fromEntries((overs1 || []).map((o) => [o.over, o]));
  const overs2Map = Object.fromEntries((overs2 || []).map((o) => [o.over, o]));

  const allOverNums = showBoth
    ? [...new Set([...(overs1 || []).map((o) => o.over), ...(overs2 || []).map((o) => o.over)])].sort((a, b) => a - b)
    : (overs1 || []).map((o) => o.over);

  const maxRuns = Math.max(
    ...(overs1 || []).map((o: any) => o.runs),
    ...(showBoth ? (overs2 || []).map((o: any) => o.runs) : [0]),
    1,
  );

  // Y axis labels
  const step = Math.ceil(maxRuns / 4);
  const yVals = [0, step, step * 2, step * 3, maxRuns];

  return (
    <View style={{ flexDirection: 'row' }}>
      {/* Fixed Y-axis */}
      <View style={{ width: 34, height: BAR_H + 36, justifyContent: 'space-between', paddingBottom: 22, paddingTop: 4 }}>
        {[...yVals].reverse().map((v, i) => (
          <Text key={i} style={{ fontSize: 9, color: '#9CA3AF', textAlign: 'right', paddingRight: 4 }}>{v}</Text>
        ))}
      </View>

      {/* Scrollable bars */}
      <View style={{ flex: 1 }}>
        {/* Horizontal grid lines */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: 4, height: BAR_H }}>
          {yVals.map((v, i) => (
            <View key={i} style={{
              position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#F3F4F6',
              top: BAR_H - (v / maxRuns) * BAR_H,
            }} />
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_H + 36, paddingBottom: 20 }}>
            {allOverNums.map((overNum) => {
              const o1 = overs1Map[overNum];
              const o2 = overs2Map[overNum];
              return (
                <View key={overNum} style={{ alignItems: 'center', marginHorizontal: GAP / 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: GAP }}>
                    {/* Innings 1 bar */}
                    {(o1 || !showBoth) && (
                      <View style={{ alignItems: 'center' }}>
                        {(o1?.wickets ?? 0) > 0 && (
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#6B7280', marginBottom: 2 }} />
                        )}
                        <View style={{ width: BAR_W, height: Math.max(2, ((o1?.runs || 0) / maxRuns) * BAR_H), backgroundColor: color1, borderRadius: 2, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
                      </View>
                    )}
                    {/* Innings 2 bar */}
                    {showBoth && o2 && (
                      <View style={{ alignItems: 'center' }}>
                        {(o2?.wickets ?? 0) > 0 && (
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444', marginBottom: 2 }} />
                        )}
                        <View style={{ width: BAR_W, height: Math.max(2, ((o2?.runs || 0) / maxRuns) * BAR_H), backgroundColor: color2, borderRadius: 2, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 8, color: '#9CA3AF', marginTop: 4 }}>{overNum}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function WormChart({ innings, chartWidth }: { innings: any[]; chartWidth?: number }) {
  const W = chartWidth ?? (SW - 48);
  const H = 200;
  const pad = { top: 10, bottom: 24, left: 34, right: 10 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const maxOvers = Math.max(...innings.flatMap((inn: any) => (inn.worm || []).map((w: any) => w.over)), 1);
  const maxRuns = Math.max(...innings.flatMap((inn: any) => (inn.worm || []).map((w: any) => w.totalRuns)), 1);

  const toX = (over: number) => pad.left + ((over - 1) / Math.max(maxOvers - 1, 1)) * plotW;
  const toY = (runs: number) => pad.top + plotH - (runs / maxRuns) * plotH;

  const yVals = [0, Math.round(maxRuns / 4), Math.round(maxRuns / 2), Math.round((maxRuns * 3) / 4), maxRuns];
  const COLORS = [GRAPH_COLORS.inn1, GRAPH_COLORS.inn2];

  const renderLine = (points: any[], color: string) =>
    points.slice(0, -1).map((pt, i) => {
      const x1 = toX(pt.over), y1 = toY(pt.totalRuns);
      const x2 = toX(points[i + 1].over), y2 = toY(points[i + 1].totalRuns);
      const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      return (
        <View key={i} style={{
          position: 'absolute',
          left: (x1 + x2) / 2 - length / 2,
          top: (y1 + y2) / 2 - 1,
          width: length, height: 2,
          backgroundColor: color,
          transform: [{ rotate: `${angle}deg` }],
        }} />
      );
    });

  return (
    <View style={{ width: W, height: H }}>
      {/* Y-axis labels */}
      {yVals.map((v, i) => (
        <Text key={i} style={{ position: 'absolute', left: 0, top: toY(v) - 6, width: pad.left - 4, fontSize: 9, color: '#9CA3AF', textAlign: 'right' }}>{v}</Text>
      ))}
      {/* Y-axis "Runs" label */}
      <Text style={{ position: 'absolute', left: 0, top: H / 2 - 16, fontSize: 9, color: '#9CA3AF', transform: [{ rotate: '-90deg' }], width: 40, textAlign: 'center' }}>Runs</Text>
      {/* Grid lines */}
      {yVals.map((v, i) => (
        <View key={i} style={{ position: 'absolute', left: pad.left, top: toY(v), width: plotW, height: 1, backgroundColor: '#F3F4F6' }} />
      ))}
      {/* Lines */}
      {innings.map((inn: any, i: number) => renderLine(inn.worm || [], COLORS[i] || '#ccc'))}
      {/* Dots every 3 overs */}
      {innings.map((inn: any, i: number) =>
        (inn.worm || []).filter((_: any, wi: number) => wi % 3 === 0 || wi === (inn.worm || []).length - 1).map((pt: any, pi: number) => (
          <View key={`${i}-${pi}`} style={{ position: 'absolute', left: toX(pt.over) - 4, top: toY(pt.totalRuns) - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS[i] || '#ccc', borderWidth: 1.5, borderColor: '#fff' }} />
        ))
      )}
      {/* X-axis "Ov" label */}
      <Text style={{ position: 'absolute', left: pad.left + plotW - 10, top: H - 12, fontSize: 9, color: '#9CA3AF' }}>Ov</Text>
    </View>
  );
}

function GraphsTab({ matchId, match }: { matchId: string; match: any }) {
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeInn, setActiveInn] = useState<number | 'both'>(0);
  const [fsChart, setFsChart] = useState<'manhattan' | 'worm' | null>(null);

  useEffect(() => {
    api.get(`/matches/${matchId}/graphs`)
      .then((res: any) => setGraphData(res.data.graphData))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [matchId]);

  if (loading) return <ActivityIndicator style={{ marginTop: 48 }} color="#1E3A5F" />;
  if (!graphData?.innings?.length) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 64 }}>
        <Text style={{ fontSize: 36, marginBottom: 8 }}>📊</Text>
        <Text style={{ color: '#9CA3AF', fontSize: 14 }}>No graph data yet</Text>
      </View>
    );
  }

  const innings: any[] = graphData.innings;
  const totalOvers = match?.totalOvers || 20;
  const hasBothInnings = innings.length > 1;

  const getBattingTeamId = (inningsNum: number) => {
    const idx = inningsNum - 1;
    return idx === 0
      ? match?.innings?.first?.battingTeam?._id || match?.innings?.first?.battingTeam
      : match?.innings?.second?.battingTeam?._id || match?.innings?.second?.battingTeam;
  };

  const getTeamShort = (inningsNum: number) => {
    const id = getBattingTeamId(inningsNum)?.toString();
    if (id === match?.teamA?._id?.toString()) return match?.teamA?.shortName || 'Inn1';
    return match?.teamB?.shortName || 'Inn2';
  };

  const inn1 = innings.find((i: any) => i.inningsNum === 1);
  const inn2 = innings.find((i: any) => i.inningsNum === 2);
  const label1 = getTeamShort(1);
  const label2 = getTeamShort(2);

  const selectedInnData = activeInn === 'both' ? inn1 : innings[activeInn as number];
  const overs1 = inn1?.overs || [];
  const overs2 = inn2?.overs || [];
  const showBoth = activeInn === 'both' && hasBothInnings;

  // Selected innings for single mode
  const singleColor = activeInn === 'both' ? GRAPH_COLORS.inn1 : activeInn === 0 ? GRAPH_COLORS.inn1 : GRAPH_COLORS.inn2;

  // Innings toggle options
  const toggleOptions: { label: string; value: number | 'both' }[] = [
    { label: label1, value: 0 },
    ...(hasBothInnings ? [{ label: label2, value: 1 }, { label: 'Both', value: 'both' as const }] : []),
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Innings toggle */}
      <View style={{ flexDirection: 'row', margin: 16, backgroundColor: '#F3F4F6', borderRadius: 12, padding: 3 }}>
        {toggleOptions.map(({ label, value }) => (
          <TouchableOpacity
            key={String(value)}
            onPress={() => setActiveInn(value)}
            style={{
              flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
              backgroundColor: activeInn === value ? '#fff' : 'transparent',
              shadowColor: activeInn === value ? '#000' : 'transparent',
              shadowOpacity: 0.08, shadowRadius: 4, elevation: activeInn === value ? 2 : 0,
            }}
          >
            <Text style={{ fontWeight: '700', fontSize: 12, color: activeInn === value ? '#1E3A5F' : '#9CA3AF' }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Manhattan */}
      <View style={{ backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 12, borderRadius: 16, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 4 }}>
          <Text style={{ fontWeight: '800', color: '#111827', fontSize: 15 }}>Manhattan</Text>
          <TouchableOpacity onPress={() => setFsChart('manhattan')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="expand-outline" size={16} color="#2563EB" />
            <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '600' }}>Full Screen</Text>
          </TouchableOpacity>
        </View>
        <View style={{ paddingHorizontal: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: '600', color: '#9CA3AF' }}>Runs per over</Text>
          {showBoth && (
            <View style={{ flexDirection: 'row', gap: 10, marginLeft: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: GRAPH_COLORS.inn1 }} />
                <Text style={{ fontSize: 10, color: '#6B7280' }}>{label1}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: GRAPH_COLORS.inn2 }} />
                <Text style={{ fontSize: 10, color: '#6B7280' }}>{label2}</Text>
              </View>
            </View>
          )}
        </View>
        <ManhattanChartFull
          overs1={showBoth ? overs1 : (selectedInnData?.overs || [])}
          overs2={overs2}
          color1={showBoth ? GRAPH_COLORS.inn1 : singleColor}
          color2={GRAPH_COLORS.inn2}
          showBoth={showBoth}
          label1={label1}
          label2={label2}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6B7280' }} />
          <Text style={{ fontSize: 10, color: '#6B7280' }}>Wicket dot</Text>
        </View>
      </View>

      {/* Worm */}
      {hasBothInnings && (
        <View style={{ backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 12, borderRadius: 16, paddingTop: 16, paddingBottom: 16, paddingHorizontal: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontWeight: '800', color: '#111827', fontSize: 15 }}>Worm</Text>
            <TouchableOpacity onPress={() => setFsChart('worm')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="expand-outline" size={16} color="#2563EB" />
              <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '600' }}>Full Screen</Text>
            </TouchableOpacity>
          </View>
          <WormChart innings={innings} />
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
            {innings.map((inn: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 18, height: 3, backgroundColor: i === 0 ? GRAPH_COLORS.inn1 : GRAPH_COLORS.inn2, borderRadius: 2 }} />
                <Text style={{ fontSize: 11, color: '#6B7280' }}>{getTeamShort(inn.inningsNum)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Innings Progression */}
      <View style={{ backgroundColor: '#fff', marginHorizontal: 12, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 16 }}>
        <Text style={{ fontWeight: '800', color: '#111827', fontSize: 15, marginBottom: 16 }}>Innings Progression</Text>
        {innings.map((inn: any, idx: number) => (
          <View key={idx} style={{ marginBottom: idx < innings.length - 1 ? 20 : 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontWeight: '700', color: idx === 0 ? '#2563EB' : '#0891B2', fontSize: 13 }}>
                {getTeamShort(inn.inningsNum)} · {idx === 0 ? '1st' : '2nd'} Innings
              </Text>
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                {inn.worm?.[inn.worm.length - 1]?.totalRuns ?? 0} runs
              </Text>
            </View>
            <InningsProgressionBar overs={inn.overs || []} totalOvers={totalOvers} color={idx === 0 ? '#3B82F6' : '#06B6D4'} />
          </View>
        ))}
      </View>

      {/* Full Screen Modal — true landscape via rotation */}
      <Modal visible={!!fsChart} animationType="fade" statusBarTranslucent onRequestClose={() => setFsChart(null)}>
        <View style={{ flex: 1, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' }}>
          {/* Landscape container: width=SH (portrait height), height=SW (portrait width), rotated 90° */}
          <View style={{ width: SH, height: SW, transform: [{ rotate: '90deg' }], backgroundColor: '#fff' }}>
            {/* Header row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ flex: 1, fontWeight: '800', fontSize: 16, color: '#111827' }}>
                {fsChart === 'manhattan' ? 'Manhattan' : 'Worm'}
              </Text>
              {/* Toggle for Manhattan */}
              {fsChart === 'manhattan' && (
                <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 2, marginRight: 12 }}>
                  {toggleOptions.map(({ label, value }) => (
                    <TouchableOpacity
                      key={String(value)}
                      onPress={() => setActiveInn(value)}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: activeInn === value ? '#fff' : 'transparent', elevation: activeInn === value ? 2 : 0 }}
                    >
                      <Text style={{ fontWeight: '700', fontSize: 12, color: activeInn === value ? '#1E3A5F' : '#9CA3AF' }}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity onPress={() => setFsChart(null)} style={{ padding: 6, borderRadius: 16, backgroundColor: '#F3F4F6' }}>
                <Ionicons name="close" size={18} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Chart content */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
              {fsChart === 'manhattan' ? (
                <>
                  <ManhattanChartFull
                    overs1={showBoth ? overs1 : (selectedInnData?.overs || [])}
                    overs2={overs2}
                    color1={showBoth ? GRAPH_COLORS.inn1 : singleColor}
                    color2={GRAPH_COLORS.inn2}
                    showBoth={showBoth}
                    label1={label1}
                    label2={label2}
                  />
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 10, paddingLeft: 34 }}>
                    {showBoth
                      ? [{ label: label1, color: GRAPH_COLORS.inn1 }, { label: label2, color: GRAPH_COLORS.inn2 }].map((item, i) => (
                          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: item.color }} />
                            <Text style={{ fontSize: 11, color: '#6B7280' }}>{item.label}</Text>
                          </View>
                        ))
                      : null}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6B7280' }} />
                      <Text style={{ fontSize: 11, color: '#6B7280' }}>Wicket</Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <WormChart innings={innings} chartWidth={SH - 48} />
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                    {innings.map((inn: any, i: number) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <View style={{ width: 18, height: 3, backgroundColor: i === 0 ? GRAPH_COLORS.inn1 : GRAPH_COLORS.inn2, borderRadius: 2 }} />
                        <Text style={{ fontSize: 11, color: '#6B7280' }}>{getTeamShort(inn.inningsNum)}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
      <View style={{ backgroundColor: '#1E3A5F', paddingHorizontal: 16, paddingVertical: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: (match?.teamA?.color || '#1E3A5F') + '30', borderWidth: 2, borderColor: (match?.teamA?.color || '#93C5FD') + '60', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Text style={{ fontWeight: '900', fontSize: 14, color: match?.teamA?.color || '#fff' }}>{match?.teamA?.shortName}</Text>
            </View>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' }} numberOfLines={2}>{match?.teamA?.name}</Text>
          </View>
          <View style={{ alignItems: 'center', paddingHorizontal: 12 }}>
            <Text style={{ color: '#F59E0B', fontWeight: '900', fontSize: 20 }}>VS</Text>
            {match?.totalOvers ? <Text style={{ color: '#93C5FD', fontSize: 11, marginTop: 4 }}>{match.totalOvers} ov</Text> : null}
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: (match?.teamB?.color || '#7C3AED') + '30', borderWidth: 2, borderColor: (match?.teamB?.color || '#7C3AED') + '60', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Text style={{ fontWeight: '900', fontSize: 14, color: match?.teamB?.color || '#fff' }}>{match?.teamB?.shortName}</Text>
            </View>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' }} numberOfLines={2}>{match?.teamB?.name}</Text>
          </View>
        </View>
      </View>
      {match?.result?.description && (
        <View style={{ backgroundColor: '#F0FDF4', marginHorizontal: 12, marginTop: 12, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 24 }}>🏆</Text>
          <Text style={{ flex: 1, color: '#15803D', fontWeight: '700', fontSize: 14 }}>{match.result.description}</Text>
        </View>
      )}
      <View style={{ backgroundColor: '#fff', marginTop: 12 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
          <Text style={{ fontWeight: '800', color: '#111827', fontSize: 14 }}>Match Info</Text>
        </View>
        {rows.map((row) => (
          <View key={row.label} style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#F9FAFB' }}>
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
      <View style={{ flexDirection: 'row', backgroundColor: '#1E3A5F' }}>
        {[teamA, teamB].map((team: any, i: number) => (
          <View key={i} style={{ flex: 1, flexDirection: i === 0 ? 'row' : 'row-reverse', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, gap: 8 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: (team?.color || '#1E3A5F') + '40', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontWeight: '900', fontSize: 11, color: team?.color || '#fff' }}>{team?.shortName || team?.name?.slice(0, 2)?.toUpperCase()}</Text>
            </View>
            <Text style={{ fontWeight: '700', color: '#fff', fontSize: 12, flex: 1, textAlign: i === 0 ? 'left' : 'right' }} numberOfLines={1}>{team?.name}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
      {Array.from({ length: maxLen }).map((_, i) => {
        const pa = aPlayers[i];
        const pb = bPlayers[i];
        const paId = pa?.userId?._id || pa?.userId;
        const pbId = pb?.userId?._id || pb?.userId;
        return (
          <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F9FAFB' }}>
            <TouchableOpacity style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12 }} onPress={() => paId && router.push(`/player/${paId}` as any)} disabled={!paId} activeOpacity={paId ? 0.6 : 1}>
              {pa && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ fontWeight: '600', color: '#111827', fontSize: 13 }}>{pa.name}</Text>
                    {pa.isCaptain && <View style={{ backgroundColor: '#FEF3C7', borderRadius: 4, paddingHorizontal: 4 }}><Text style={{ color: '#92400E', fontSize: 9, fontWeight: '800' }}>C</Text></View>}
                    {pa.isViceCaptain && <View style={{ backgroundColor: '#EFF6FF', borderRadius: 4, paddingHorizontal: 4 }}><Text style={{ color: '#1D4ED8', fontSize: 9, fontWeight: '800' }}>VC</Text></View>}
                  </View>
                  <Text style={{ color: '#9CA3AF', fontSize: 11 }}>{pa.role?.replace(/-/g, ' ')}</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={{ width: 1, backgroundColor: '#F3F4F6' }} />
            <TouchableOpacity style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'flex-end' }} onPress={() => pbId && router.push(`/player/${pbId}` as any)} disabled={!pbId} activeOpacity={pbId ? 0.6 : 1}>
              {pb && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    {pb.isCaptain && <View style={{ backgroundColor: '#FEF3C7', borderRadius: 4, paddingHorizontal: 4 }}><Text style={{ color: '#92400E', fontSize: 9, fontWeight: '800' }}>C</Text></View>}
                    {pb.isViceCaptain && <View style={{ backgroundColor: '#EFF6FF', borderRadius: 4, paddingHorizontal: 4 }}><Text style={{ color: '#1D4ED8', fontSize: 9, fontWeight: '800' }}>VC</Text></View>}
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

  useEffect(() => {
    if (!currentMatch) return;
    const state = currentMatch.state;
    if (state === 'COMPLETED') setTab('Summary');
    else if (state === 'NOT_STARTED' || state === 'TOSS_DONE') setTab('Info');
    else setTab('Live');
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
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }} numberOfLines={1}>{match?.title || 'Match'}</Text>
          {match?.venue ? <Text style={{ color: '#93C5FD', fontSize: 11 }}>📍 {match.venue}</Text> : null}
        </View>
        {isLive && (
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EF4444', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 4 }}>
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

      {/* Scrollable tab bar */}
      <View style={{ backgroundColor: '#1E3A5F' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row' }}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2.5, borderBottomColor: tab === t ? '#EF4444' : 'transparent' }}
            >
              <Text style={{ color: tab === t ? '#fff' : 'rgba(147,197,253,0.6)', fontWeight: tab === t ? '700' : '500', fontSize: 13 }}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab content */}
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        {tab === 'Live'      && <LiveTab match={match} summary={summary} recentBalls={recentBalls} />}
        {tab === 'Info'      && <InfoTab match={match} />}
        {tab === 'Scorecard' && <ScorecardTabContent matchId={id!} match={match} />}
        {tab === 'Summary'   && <SummaryTab matchId={id!} match={match} />}
        {tab === 'Graphs'    && <GraphsTab matchId={id!} match={match} />}
        {tab === 'Squads'    && <SquadsTab match={match} />}
      </View>

      {/* Bottom action bar */}
      {canScore && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
          <TouchableOpacity
            onPress={() => router.push(`/match/${id}/score` as any)}
            style={{ backgroundColor: '#1E3A5F', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
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
            style={{ backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
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
