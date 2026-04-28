import { View, Text, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

function TeamAvatar({ team, size = 44, light = false }: { team: any; size?: number; light?: boolean }) {
  if (team?.logo) {
    return (
      <Image
        source={{ uri: team.logo }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: light ? 'rgba(255,255,255,0.2)' : '#E5E7EB' }}
        resizeMode="cover"
      />
    );
  }
  const color = team?.color || '#1E3A5F';
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: light ? color + '40' : color + '18',
      borderWidth: 2, borderColor: light ? color + '60' : color + '30',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.28, fontWeight: '900', color: light ? '#fff' : color }}>
        {team?.shortName?.slice(0, 3) || team?.name?.slice(0, 2)?.toUpperCase()}
      </Text>
    </View>
  );
}

interface Props {
  match: any;
  onPress: () => void;
  isLive?: boolean;
  isOwner?: boolean;
}

const STATE_LABELS: Record<string, string> = {
  NOT_STARTED:    'Upcoming',
  TOSS_DONE:      'Toss Done',
  FIRST_INNINGS:  '1st Inn',
  INNINGS_BREAK:  'Break',
  SECOND_INNINGS: '2nd Inn',
  COMPLETED:      'Completed',
  ABANDONED:      'Abandoned',
};

export default function MatchCard({ match, onPress, isLive = false, isOwner = false }: Props) {
  const teamA = match.teamA;
  const teamB = match.teamB;
  const isActive = isLive || ['FIRST_INNINGS', 'SECOND_INNINGS', 'INNINGS_BREAK'].includes(match.state);
  const isCompleted = match.state === 'COMPLETED';
  const isUpcoming = ['NOT_STARTED', 'TOSS_DONE'].includes(match.state);
  const canStart = isOwner && isUpcoming;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  // ── LIVE / ACTIVE CARD ───────────────────────────────────────
  if (isActive) {
    const inn1 = match.innings?.first;
    const inn2 = match.innings?.second;
    const isSecond = match.state === 'SECOND_INNINGS';
    const batting  = isSecond ? inn2 : inn1;
    const totalBalls = batting?.balls ?? 0;
    const overs = `${Math.floor(totalBalls / 6)}.${totalBalls % 6}`;
    const maxBalls = (match.totalOvers || 20) * 6;
    const progress = maxBalls > 0 ? Math.min((totalBalls / maxBalls) * 100, 100) : 0;
    const battingTeamId = batting?.battingTeam?._id?.toString?.() || batting?.battingTeam?.toString?.() || '';
    const isBattingTeam = (t: any) => (t?._id?.toString() || '') === battingTeamId;

    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{ marginBottom: 14 }}>
        <View style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: '#142E52' }}>
          {/* Header row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }} numberOfLines={1}>
                {teamA?.shortName} vs {teamB?.shortName}
              </Text>
              <Text style={{ color: '#93C5FD', fontSize: 11, marginTop: 2 }}>
                {match.format} · {match.totalOvers} ov{match.venue ? ` · ${match.venue}` : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EF444422', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />
              <Text style={{ color: '#EF4444', fontWeight: '900', fontSize: 11, letterSpacing: 0.5 }}>LIVE</Text>
            </View>
          </View>

          {/* Teams + Score */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12 }}>
            {/* Team A */}
            <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <TeamAvatar team={teamA} size={52} light />
              <Text style={{ color: isBattingTeam(teamA) ? '#fff' : '#6B9FD4', fontWeight: '700', fontSize: 12, textAlign: 'center' }} numberOfLines={1}>
                {teamA?.shortName || teamA?.name}
              </Text>
              {isBattingTeam(teamA) && (
                <View style={{ backgroundColor: '#F59E0B', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: '#000', fontSize: 8, fontWeight: '900' }}>BATTING</Text>
                </View>
              )}
            </View>

            {/* Score centre */}
            <View style={{ flex: 2.2, alignItems: 'center' }}>
              <Text style={{ color: '#F59E0B', fontSize: 40, fontWeight: '900', lineHeight: 46 }}>
                {batting?.totalRuns ?? 0}/{batting?.wickets ?? 0}
              </Text>
              <Text style={{ color: '#93C5FD', fontSize: 13 }}>({overs} ov)</Text>
              {inn2?.target && isSecond && (
                <View style={{ marginTop: 4, backgroundColor: '#EF444420', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#F87171', fontWeight: '700', fontSize: 11 }}>
                    Need {inn2.target - (inn2.totalRuns ?? 0)} off {maxBalls - totalBalls} balls
                  </Text>
                </View>
              )}
              {!isSecond && inn1 && inn2 === undefined && (
                <Text style={{ color: '#6B9FD4', fontSize: 11, marginTop: 2 }}>1st Innings</Text>
              )}
            </View>

            {/* Team B */}
            <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <TeamAvatar team={teamB} size={52} light />
              <Text style={{ color: isBattingTeam(teamB) ? '#fff' : '#6B9FD4', fontWeight: '700', fontSize: 12, textAlign: 'center' }} numberOfLines={1}>
                {teamB?.shortName || teamB?.name}
              </Text>
              {isBattingTeam(teamB) && (
                <View style={{ backgroundColor: '#F59E0B', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: '#000', fontSize: 8, fontWeight: '900' }}>BATTING</Text>
                </View>
              )}
            </View>
          </View>

          {/* Overs progress bar */}
          <View style={{ marginHorizontal: 16, marginBottom: 12, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <View style={{ width: `${progress}%`, height: '100%', backgroundColor: '#F59E0B', borderRadius: 2, minWidth: progress > 0 ? 6 : 0 }} />
          </View>

          {/* CTA footer */}
          <View style={{ backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 10, alignItems: 'center' }}>
            <Text style={{ color: '#93C5FD', fontWeight: '700', fontSize: 13 }}>Tap to view live score →</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // ── REGULAR CARD (upcoming / completed / break) ───────────────
  const inn1Score = match.innings?.first;
  const inn2Score = match.innings?.second;
  const balls1 = inn1Score?.balls ?? 0;
  const balls2 = inn2Score?.balls ?? 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={{
        backgroundColor: '#fff',
        borderRadius: 18,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowRadius: 10,
        elevation: 3,
        overflow: 'hidden',
      }}
    >
      {/* Top strip */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="baseball-outline" size={12} color="#9CA3AF" />
          <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600' }}>
            {match.format} · {match.totalOvers} ov{match.venue ? ` · ${match.venue}` : ''}
          </Text>
        </View>
        <View style={{
          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
          backgroundColor: isCompleted ? '#DCFCE7' : isUpcoming ? '#EFF6FF' : '#EDE9FE',
        }}>
          <Text style={{
            fontSize: 10, fontWeight: '700',
            color: isCompleted ? '#16A34A' : isUpcoming ? '#2563EB' : '#7C3AED',
          }}>
            {STATE_LABELS[match.state] || match.state}
          </Text>
        </View>
      </View>

      {/* Teams row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 }}>
        {/* Team A */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: inn1Score ? 4 : 0 }}>
            <TeamAvatar team={teamA} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: '#111827', fontSize: 14 }} numberOfLines={1}>
                {teamA?.shortName || teamA?.name}
              </Text>
              {inn1Score && (
                <Text style={{ fontWeight: '800', color: '#1E3A5F', fontSize: 16, marginTop: 1 }}>
                  {inn1Score.totalRuns}/{inn1Score.wickets}
                  <Text style={{ fontWeight: '400', color: '#9CA3AF', fontSize: 12 }}> ({Math.floor(balls1 / 6)}.{balls1 % 6})</Text>
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* VS divider */}
        <View style={{ width: 40, alignItems: 'center' }}>
          <Text style={{ color: '#D1D5DB', fontWeight: '900', fontSize: 13 }}>VS</Text>
        </View>

        {/* Team B */}
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: inn2Score ? 4 : 0 }}>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={{ fontWeight: '700', color: '#111827', fontSize: 14 }} numberOfLines={1}>
                {teamB?.shortName || teamB?.name}
              </Text>
              {inn2Score && (
                <Text style={{ fontWeight: '800', color: '#1E3A5F', fontSize: 16, marginTop: 1 }}>
                  {inn2Score.totalRuns}/{inn2Score.wickets}
                  <Text style={{ fontWeight: '400', color: '#9CA3AF', fontSize: 12 }}> ({Math.floor(balls2 / 6)}.{balls2 % 6})</Text>
                </Text>
              )}
            </View>
            <TeamAvatar team={teamB} size={40} />
          </View>
        </View>
      </View>

      {/* Footer */}
      {isCompleted && match.result?.description ? (
        <View style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="trophy" size={12} color="#16A34A" />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#16A34A' }}>
            {match.result.description}
          </Text>
        </View>
      ) : isUpcoming ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="time-outline" size={12} color="#9CA3AF" />
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
              {match.scheduledAt ? formatDate(match.scheduledAt) : 'Time TBD'}
            </Text>
          </View>
          {canStart && (
            <TouchableOpacity
              onPress={() => router.push(`/match/${match._id}/toss` as any)}
              style={{ backgroundColor: '#16A34A', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="play" size={11} color="#fff" />
              <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>
                {match.state === 'TOSS_DONE' ? 'Start Innings' : 'Start'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
