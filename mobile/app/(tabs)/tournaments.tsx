import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTournamentStore } from '@store/tournamentStore';

const STATE_COLORS: Record<string, string> = {
  draft: '#6B7280',
  registration_open: '#059669',
  registration_closed: '#D97706',
  in_progress: '#2563EB',
  completed: '#7C3AED',
  cancelled: '#DC2626',
};

const STATE_LABELS: Record<string, string> = {
  draft: 'Draft',
  registration_open: 'Open',
  registration_closed: 'Closed',
  in_progress: 'Live',
  completed: 'Done',
  cancelled: 'Cancelled',
};

const FORMAT_ICONS: Record<string, string> = {
  round_robin: '🔄',
  single_elimination: '🏆',
  double_elimination: '⚔️',
  group_knockout: '🎯',
  league: '📋',
};

function TournamentCard({ item, onPress }: { item: any; onPress: () => void }) {
  const color = STATE_COLORS[item.state] || '#6B7280';
  const label = STATE_LABELS[item.state] || item.state;

  return (
    <TouchableOpacity
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-base font-bold text-gray-800" numberOfLines={1}>
            {FORMAT_ICONS[item.format] || '🏏'} {item.name}
          </Text>
          {item.venue ? (
            <Text className="text-xs text-gray-400 mt-0.5">{item.venue}</Text>
          ) : null}
        </View>
        <View
          className="px-2 py-1 rounded-full"
          style={{ backgroundColor: color + '20' }}
        >
          <Text className="text-xs font-bold" style={{ color }}>{label}</Text>
        </View>
      </View>

      <View className="flex-row gap-4">
        <View className="flex-row items-center gap-1">
          <Ionicons name="people" size={13} color="#9CA3AF" />
          <Text className="text-xs text-gray-500">{item.teamCount || item.teams?.length || 0}/{item.maxTeams} teams</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="baseball" size={13} color="#9CA3AF" />
          <Text className="text-xs text-gray-500">{item.matchFormat} · {item.totalOvers} ov</Text>
        </View>
        {item.startDate && (
          <View className="flex-row items-center gap-1">
            <Ionicons name="calendar" size={13} color="#9CA3AF" />
            <Text className="text-xs text-gray-500">
              {new Date(item.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const FILTERS = ['All', 'Open', 'Live', 'Completed'];
const STATE_MAP: Record<string, string> = {
  Open: 'registration_open',
  Live: 'in_progress',
  Completed: 'completed',
};

export default function TournamentsScreen() {
  const { tournaments, fetchTournaments, isLoading } = useTournamentStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [mine, setMine]     = useState(false);

  const load = () => {
    const params: Record<string, string> = {};
    if (mine) params.mine = 'true';
    if (STATE_MAP[filter]) params.state = STATE_MAP[filter];
    fetchTournaments(params);
  };

  useEffect(() => { load(); }, [filter, mine]);

  const filtered = search
    ? tournaments.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : tournaments;

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      <View className="px-4 py-4">
        <Text className="text-white text-2xl font-bold mb-3">Tournaments</Text>
        <View className="flex-row bg-white/10 rounded-xl px-3 py-2 items-center gap-2">
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            className="flex-1 text-white text-base"
            placeholder="Search tournaments..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <View className="flex-1 bg-surface rounded-t-3xl">
        {/* Mine / All toggle */}
        <View className="flex-row px-4 pt-4 gap-2">
          {['All', 'Mine'].map((label, i) => (
            <TouchableOpacity
              key={label}
              className={`px-4 py-2 rounded-full ${(mine ? i === 1 : i === 0) ? 'bg-primary' : 'bg-gray-100'}`}
              onPress={() => setMine(i === 1)}
            >
              <Text className={`text-sm font-semibold ${(mine ? i === 1 : i === 0) ? 'text-white' : 'text-gray-600'}`}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Status filters */}
        <View className="flex-row px-4 pt-2 gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              className={`px-3 py-1.5 rounded-full border ${filter === f ? 'bg-primary border-primary' : 'border-gray-200 bg-white'}`}
              onPress={() => setFilter(f)}
            >
              <Text className={`text-xs font-semibold ${filter === f ? 'text-white' : 'text-gray-500'}`}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(t) => t._id}
          renderItem={({ item }) => (
            <TournamentCard
              item={item}
              onPress={() => router.push(`/tournament/${item._id}` as any)}
            />
          )}
          contentContainerStyle={{ padding: 16, paddingTop: 12 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-5xl mb-3">🏆</Text>
              <Text className="text-gray-500 text-base font-medium">No tournaments found</Text>
              <Text className="text-gray-400 text-sm mt-1">Create one to get started</Text>
            </View>
          }
        />
      </View>

      <TouchableOpacity
        className="absolute bottom-6 right-6 bg-accent rounded-full w-14 h-14 items-center justify-center shadow-lg"
        onPress={() => router.push('/tournament/create' as any)}
      >
        <Ionicons name="add" size={28} color="#000" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
