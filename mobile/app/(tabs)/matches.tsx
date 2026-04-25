import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMatchStore } from '@store/matchStore';
import { useAuthStore } from '@store/authStore';
import MatchCard from '@components/match/MatchCard';
import DrawerMenu from '@components/ui/DrawerMenu';

type Filter = 'All' | 'Live' | 'Upcoming' | 'Completed' | 'Mine';

const STATE_MAP: Record<Filter, string | undefined> = {
  All:       undefined,
  Live:      'FIRST_INNINGS,SECOND_INNINGS',
  Upcoming:  'NOT_STARTED,TOSS_DONE,INNINGS_BREAK',
  Completed: 'COMPLETED,ABANDONED',
  Mine:      undefined,
};

const FILTERS: Filter[] = ['All', 'Live', 'Upcoming', 'Completed', 'Mine'];

export default function MatchesScreen() {
  const { matches, fetchMatches, isLoading, pagination } = useMatchStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = (p = 1) => {
    const params: Record<string, string> = { page: String(p), limit: '20' };
    const state = STATE_MAP[filter];
    if (state) params.state = state;
    if (filter === 'Mine') params.mine = 'true';
    fetchMatches(params);
    setPage(p);
  };

  useEffect(() => { load(1); }, [filter]);

  const filtered = search.trim()
    ? matches.filter((m) =>
        m.title?.toLowerCase().includes(search.toLowerCase()) ||
        (m.teamA as any)?.name?.toLowerCase().includes(search.toLowerCase()) ||
        (m.teamB as any)?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : matches;

  const navigateToMatch = (match: any) => {
    router.push(`/match/${match._id}/live` as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Header */}
      <View className="px-4 pb-3 pt-4">
        <View className="flex-row items-center justify-between mb-3">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setDrawerOpen(true)}
              style={{ width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' }}
            >
              <Ionicons name="menu" size={20} color="#fff" />
            </TouchableOpacity>
            <Text className="text-white text-2xl font-bold">Matches</Text>
          </View>
          <TouchableOpacity
            className="bg-accent rounded-full px-4 py-2 flex-row items-center gap-1"
            onPress={() => router.push('/match/create')}
          >
            <Ionicons name="add" size={16} color="#000" />
            <Text className="font-bold text-black text-sm">New Match</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row bg-white/10 rounded-xl px-3 py-2.5 items-center gap-2">
          <Ionicons name="search" size={16} color="#9CA3AF" />
          <TextInput
            className="flex-1 text-white text-sm"
            placeholder="Search by team or title..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View className="flex-1 bg-surface rounded-t-3xl">
        {/* Filter Tabs */}
        <View className="pt-4 pb-1">
          <FlatList
            data={FILTERS}
            keyExtractor={(f) => f}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            renderItem={({ item: f }) => {
              const active = filter === f;
              const isLive = f === 'Live';
              return (
                <TouchableOpacity
                  onPress={() => setFilter(f)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: active ? (isLive ? '#EF4444' : '#1E3A5F') : '#F3F4F6',
                    flexDirection: 'row', alignItems: 'center', gap: 4,
                  }}
                >
                  {isLive && active && (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
                  )}
                  <Text style={{
                    fontSize: 13, fontWeight: '600',
                    color: active ? '#fff' : '#6B7280',
                  }}>
                    {f}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(m) => m._id}
          renderItem={({ item }) => (
            <MatchCard
              match={item}
              onPress={() => navigateToMatch(item)}
              isLive={item.state === 'FIRST_INNINGS' || item.state === 'SECOND_INNINGS'}
              isOwner={user?._id === (item.createdBy?._id || item.createdBy)}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => load(1)} tintColor="#1E3A5F" />
          }
          onEndReached={() => {
            if (page < pagination.pages) load(page + 1);
          }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View className="items-center py-20">
              <Text className="text-5xl mb-3">🏏</Text>
              <Text className="text-gray-600 font-semibold text-base">
                {filter === 'Live' ? 'No live matches right now'
                  : filter === 'Mine' ? 'You have no matches yet'
                  : filter === 'Upcoming' ? 'No upcoming matches'
                  : 'No matches found'}
              </Text>
              <Text className="text-gray-400 text-sm mt-1">
                {filter === 'Mine' || filter === 'All' ? 'Tap + New Match to create one' : ''}
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}
