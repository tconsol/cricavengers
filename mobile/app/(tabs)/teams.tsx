import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTeamStore } from '@store/teamStore';
import TeamCard from '@components/team/TeamCard';

export default function TeamsScreen() {
  const { teams, fetchTeams, isLoading } = useTeamStore();
  const [search, setSearch] = useState('');
  const [mine, setMine]     = useState(false);

  useEffect(() => { fetchTeams({ mine: mine ? 'true' : 'false' }); }, [mine]);

  const filtered = search
    ? teams.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : teams;

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      <View className="px-4 py-4">
        <Text className="text-white text-2xl font-bold mb-3">Teams</Text>
        <View className="flex-row bg-white/10 rounded-xl px-3 py-2 items-center gap-2">
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            className="flex-1 text-white text-base"
            placeholder="Search teams..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <View className="flex-1 bg-surface rounded-t-3xl">
        {/* Toggle */}
        <View className="flex-row px-4 pt-4 gap-2">
          {['All Teams', 'My Teams'].map((label, i) => (
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

        <FlatList
          data={filtered}
          keyExtractor={(t) => t._id}
          numColumns={2}
          renderItem={({ item }) => (
            <TeamCard team={item} onPress={() => router.push(`/team/${item._id}`)} />
          )}
          contentContainerStyle={{ padding: 12, paddingTop: 8 }}
          columnWrapperStyle={{ gap: 8 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => fetchTeams()} />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-4xl mb-2">👥</Text>
              <Text className="text-gray-500">No teams found</Text>
            </View>
          }
        />
      </View>

      <TouchableOpacity
        className="absolute bottom-6 right-6 bg-accent rounded-full w-14 h-14 items-center justify-center shadow-lg"
        onPress={() => router.push('/team/create')}
      >
        <Ionicons name="add" size={28} color="#000" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}
