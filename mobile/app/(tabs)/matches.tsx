import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMatchStore } from '@store/matchStore';
import MatchCard from '@components/match/MatchCard';

const FILTERS = ['All', 'Live', 'Upcoming', 'Completed'];

export default function MatchesScreen() {
  const { matches, fetchMatches, isLoading, pagination } = useMatchStore();
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('All');
  const [page, setPage]       = useState(1);

  const load = (p = 1) => {
    const params: Record<string, string> = { page: String(p), limit: '20' };
    if (filter === 'Live') params.state = 'FIRST_INNINGS,SECOND_INNINGS';
    if (filter === 'Completed') params.state = 'COMPLETED';
    if (filter === 'Upcoming') params.state = 'NOT_STARTED,TOSS_DONE';
    fetchMatches(params);
    setPage(p);
  };

  useEffect(() => { load(); }, [filter]);

  const filtered = search
    ? matches.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))
    : matches;

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      <View className="px-4 py-4">
        <Text className="text-white text-2xl font-bold mb-3">Matches</Text>
        <View className="flex-row bg-white/10 rounded-xl px-3 py-2 items-center gap-2">
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            className="flex-1 text-white text-base"
            placeholder="Search matches..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <View className="flex-1 bg-surface rounded-t-3xl">
        {/* Filter Tabs */}
        <View className="flex-row px-4 pt-4 gap-2">
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              className={`px-4 py-2 rounded-full ${filter === f ? 'bg-primary' : 'bg-gray-100'}`}
              onPress={() => setFilter(f)}
            >
              <Text className={`text-sm font-semibold ${filter === f ? 'text-white' : 'text-gray-600'}`}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(m) => m._id}
          renderItem={({ item }) => (
            <MatchCard
              match={item}
              onPress={() => router.push(`/match/${item._id}/live`)}
              isLive={item.state === 'FIRST_INNINGS' || item.state === 'SECOND_INNINGS'}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => load(1)} />}
          onEndReached={() => {
            if (page < pagination.pages) load(page + 1);
          }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-4xl mb-2">🏏</Text>
              <Text className="text-gray-500 text-base">No matches found</Text>
            </View>
          }
        />
      </View>

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-6 right-6 bg-accent rounded-full w-14 h-14 items-center justify-center shadow-lg"
        onPress={() => router.push('/match/create')}
      >
        <Ionicons name="add" size={28} color="#000" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
