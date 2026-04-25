import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  match: any;
  onPress: () => void;
  isLive?: boolean;
  isOwner?: boolean;
}

const STATE_LABELS: Record<string, string> = {
  NOT_STARTED:    'Upcoming',
  TOSS_DONE:      'Toss Done',
  FIRST_INNINGS:  '1st Innings',
  INNINGS_BREAK:  'Break',
  SECOND_INNINGS: '2nd Innings',
  COMPLETED:      'Completed',
  ABANDONED:      'Abandoned',
};

const STATE_COLORS: Record<string, { bg: string; text: string }> = {
  NOT_STARTED:    { bg: '#F3F4F6', text: '#6B7280' },
  TOSS_DONE:      { bg: '#FEF3C7', text: '#D97706' },
  FIRST_INNINGS:  { bg: '#FEE2E2', text: '#DC2626' },
  INNINGS_BREAK:  { bg: '#EDE9FE', text: '#7C3AED' },
  SECOND_INNINGS: { bg: '#FEE2E2', text: '#DC2626' },
  COMPLETED:      { bg: '#DCFCE7', text: '#16A34A' },
  ABANDONED:      { bg: '#F3F4F6', text: '#6B7280' },
};

export default function MatchCard({ match, onPress, isLive = false, isOwner = false }: Props) {
  const teamA = match.teamA;
  const teamB = match.teamB;
  const colors = STATE_COLORS[match.state] || STATE_COLORS.NOT_STARTED;
  const isUpcoming = match.state === 'NOT_STARTED' || match.state === 'TOSS_DONE';
  const isActive = isLive || match.state === 'INNINGS_BREAK';

  const canStart = isOwner && (match.state === 'NOT_STARTED' || match.state === 'TOSS_DONE');

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8,
        borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600' }}>
            {match.format} · {match.totalOvers} ov
          </Text>
          {match.venue ? (
            <>
              <Text style={{ color: '#D1D5DB' }}>·</Text>
              <Text style={{ fontSize: 11, color: '#9CA3AF' }} numberOfLines={1}>{match.venue}</Text>
            </>
          ) : null}
        </View>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          backgroundColor: isActive ? '#FEE2E2' : colors.bg,
          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
        }}>
          {isActive && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#DC2626' }} />}
          <Text style={{ fontSize: 10, fontWeight: '700', color: isActive ? '#DC2626' : colors.text }}>
            {isActive ? 'LIVE' : STATE_LABELS[match.state] || match.state}
          </Text>
        </View>
      </View>

      {/* Teams Row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 }}>
        {/* Team A */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <View style={{
              width: 30, height: 30, borderRadius: 15,
              backgroundColor: (teamA?.color || '#1E3A5F') + '25',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: teamA?.color || '#1E3A5F' }}>
                {teamA?.shortName?.slice(0, 3) || teamA?.name?.slice(0, 2)?.toUpperCase()}
              </Text>
            </View>
            <Text style={{ fontWeight: '700', color: '#111827', fontSize: 14 }} numberOfLines={1}>
              {teamA?.shortName || teamA?.name}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: '#6B7280', marginLeft: 38 }} numberOfLines={1}>
            {teamA?.name}
          </Text>
        </View>

        {/* VS */}
        <View style={{ paddingHorizontal: 10 }}>
          <Text style={{ color: '#D1D5DB', fontWeight: '800', fontSize: 12 }}>VS</Text>
        </View>

        {/* Team B */}
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Text style={{ fontWeight: '700', color: '#111827', fontSize: 14 }} numberOfLines={1}>
              {teamB?.shortName || teamB?.name}
            </Text>
            <View style={{
              width: 30, height: 30, borderRadius: 15,
              backgroundColor: (teamB?.color || '#8B0000') + '25',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 9, fontWeight: '900', color: teamB?.color || '#8B0000' }}>
                {teamB?.shortName?.slice(0, 3) || teamB?.name?.slice(0, 2)?.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 11, color: '#6B7280', marginRight: 38 }} numberOfLines={1}>
            {teamB?.name}
          </Text>
        </View>
      </View>

      {/* Footer */}
      {match.state === 'COMPLETED' && match.result?.description ? (
        <View style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#16A34A' }}>
            {match.result.description}
          </Text>
        </View>
      ) : isUpcoming ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 14, paddingBottom: 10,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="time-outline" size={12} color="#9CA3AF" />
            <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
              {match.scheduledAt ? formatDate(match.scheduledAt) : 'Time TBD'}
            </Text>
          </View>
          {canStart && (
            <TouchableOpacity
              onPress={() => router.push(`/match/${match._id}/toss` as any)}
              style={{
                backgroundColor: '#16A34A', borderRadius: 20,
                paddingHorizontal: 14, paddingVertical: 5,
                flexDirection: 'row', alignItems: 'center', gap: 4,
              }}
            >
              <Ionicons name="play" size={11} color="#fff" />
              <Text style={{ fontSize: 12, color: '#fff', fontWeight: '700' }}>
                {match.state === 'TOSS_DONE' ? 'Start Innings' : 'Start'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : isActive ? (
        <View style={{ backgroundColor: '#FFF1F2', paddingHorizontal: 14, paddingVertical: 6 }}>
          <Text style={{ textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#DC2626' }}>
            Tap to view live →
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
