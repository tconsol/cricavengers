import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  team: any;
  onPress: () => void;
}

export default function TeamCard({ team, onPress }: Props) {
  const captain = team.players?.find((p: any) => p.isCaptain);
  const wins = team.stats?.wins ?? 0;
  const losses = team.stats?.losses ?? 0;
  const matches = team.stats?.matches ?? 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: '#fff', borderRadius: 16,
        padding: 14, marginBottom: 10,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
        flexDirection: 'row', alignItems: 'center',
      }}
    >
      <View style={{
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: (team.color || '#1E3A5F') + '20',
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: team.color || '#1E3A5F',
        marginRight: 12,
      }}>
        <Text style={{ fontWeight: '900', fontSize: 13, color: team.color || '#1E3A5F' }}>
          {team.shortName || team.name?.slice(0, 2).toUpperCase()}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }} numberOfLines={1}>
          {team.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="people-outline" size={11} color="#9CA3AF" />
            <Text style={{ fontSize: 11, color: '#6B7280' }}>
              {team.playerCount ?? team.players?.length ?? 0}
            </Text>
          </View>
          {matches > 0 && (
            <>
              <Text style={{ color: '#16A34A', fontSize: 11, fontWeight: '600' }}>W{wins}</Text>
              <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: '600' }}>L{losses}</Text>
            </>
          )}
        </View>
        {captain && (
          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }} numberOfLines={1}>
            C: {captain.name}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
    </TouchableOpacity>
  );
}
