import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTeamStore } from '@store/teamStore';
import { useAuthStore } from '@store/authStore';
import DrawerMenu from '@components/ui/DrawerMenu';

function TeamRow({ team, onPress }: { team: any; onPress: () => void }) {
  const captain = team.players?.find((p: any) => p.isCaptain);
  const wins = team.stats?.wins ?? 0;
  const losses = team.stats?.losses ?? 0;
  const matches = team.stats?.matches ?? 0;
  const winPct = matches > 0 ? Math.round((wins / matches) * 100) : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#fff', borderRadius: 16,
        paddingHorizontal: 14, paddingVertical: 12,
        marginBottom: 10,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
      }}
    >
      {/* Team avatar */}
      <View style={{
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: (team.color || '#1E3A5F') + '20',
        alignItems: 'center', justifyContent: 'center',
        marginRight: 12, borderWidth: 2,
        borderColor: team.color || '#1E3A5F',
      }}>
        <Text style={{ fontWeight: '900', fontSize: 14, color: team.color || '#1E3A5F' }}>
          {team.shortName || team.name?.slice(0, 2).toUpperCase()}
        </Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 15, color: '#111827' }} numberOfLines={1}>
          {team.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="people-outline" size={12} color="#9CA3AF" />
            <Text style={{ fontSize: 12, color: '#6B7280' }}>
              {team.playerCount ?? team.players?.length ?? 0} players
            </Text>
          </View>
          {captain ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="star-outline" size={12} color="#9CA3AF" />
              <Text style={{ fontSize: 12, color: '#6B7280' }} numberOfLines={1}>
                {captain.name}
              </Text>
            </View>
          ) : null}
        </View>
        {matches > 0 && (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '600' }}>W {wins}</Text>
            <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '600' }}>L {losses}</Text>
            {winPct !== null && (
              <Text style={{ fontSize: 11, color: '#6B7280' }}>· {winPct}% win</Text>
            )}
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
    </TouchableOpacity>
  );
}

export default function TeamsScreen() {
  const { teams, fetchTeams, isLoading } = useTeamStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [mine, setMine] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { fetchTeams({ mine: mine ? 'true' : 'false' }); }, [mine]);

  const filtered = search.trim()
    ? teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : teams;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1E3A5F' }} edges={['top']}>
      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setDrawerOpen(true)}
              style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' }}
            >
              <Ionicons name="menu" size={20} color="#fff" />
            </TouchableOpacity>
            <View>
              <Text style={{ color: '#93C5FD', fontSize: 12, fontWeight: '600' }}>TEAMS</Text>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>
                {mine ? 'My Teams' : 'All Teams'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/team/create')}
            style={{
              backgroundColor: '#F59E0B', borderRadius: 20,
              paddingHorizontal: 14, paddingVertical: 8,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}
          >
            <Ionicons name="add" size={16} color="#000" />
            <Text style={{ fontWeight: '700', color: '#000', fontSize: 13 }}>New Team</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12,
          paddingHorizontal: 12, paddingVertical: 10, gap: 8,
        }}>
          <Ionicons name="search" size={16} color="#93C5FD" />
          <TextInput
            style={{ flex: 1, color: '#fff', fontSize: 14 }}
            placeholder="Search teams..."
            placeholderTextColor="#93C5FD"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#93C5FD" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Body */}
      <View style={{ flex: 1, backgroundColor: '#F8FAFC', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
        {/* Filter tabs */}
        <View style={{
          flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 8,
        }}>
          {[['All Teams', false], ['My Teams', true]].map(([label, val]) => {
            const active = mine === val;
            return (
              <TouchableOpacity
                key={String(label)}
                onPress={() => setMine(val as boolean)}
                style={{
                  paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: active ? '#1E3A5F' : '#F3F4F6',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : '#6B7280' }}>
                  {label as string}
                </Text>
              </TouchableOpacity>
            );
          })}

          <View style={{ flex: 1 }} />
          <View style={{
            backgroundColor: '#EFF6FF', borderRadius: 10,
            paddingHorizontal: 10, paddingVertical: 8,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E3A5F' }}>
              {filtered.length}
            </Text>
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(t) => t._id}
          renderItem={({ item }) => (
            <TeamRow team={item} onPress={() => router.push(`/team/${item._id}` as any)} />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => fetchTeams({ mine: mine ? 'true' : 'false' })} tintColor="#1E3A5F" />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 64 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>👥</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
                {mine ? 'No teams yet' : 'No teams found'}
              </Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 20 }}>
                {mine ? 'Create your first team to get started' : 'Be the first to create a team!'}
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/team/create')}
                style={{
                  backgroundColor: '#1E3A5F', borderRadius: 20,
                  paddingHorizontal: 20, paddingVertical: 10,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Create Team</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}
