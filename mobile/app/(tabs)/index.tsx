import { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, FlatList } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { useMatchStore } from '@store/matchStore';
import MatchCard from '@components/match/MatchCard';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { liveMatches, matches, fetchLiveMatches, fetchMatches, isLoading } = useMatchStore();

  const load = () => {
    fetchLiveMatches();
    fetchMatches({ limit: '5' });
  };

  useEffect(() => { load(); }, []);

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4">
        <View>
          <Text className="text-white text-base">Hello,</Text>
          <Text className="text-white text-2xl font-bold">{user?.name?.split(' ')[0]} 👋</Text>
        </View>
        <TouchableOpacity
          className="bg-accent rounded-full px-4 py-2 flex-row items-center gap-1"
          onPress={() => router.push('/match/create')}
        >
          <Ionicons name="add" size={18} color="#000" />
          <Text className="font-bold text-black">New Match</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 bg-surface rounded-t-3xl"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor="#1E3A5F" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Live Matches */}
        {liveMatches.length > 0 && (
          <View className="pt-6 px-4">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-2 h-2 rounded-full bg-red-500" />
              <Text className="text-lg font-bold text-gray-800">Live Now</Text>
            </View>
            <FlatList
              data={liveMatches}
              keyExtractor={(m) => m._id}
              renderItem={({ item }) => (
                <MatchCard
                  match={item}
                  onPress={() => router.push(`/match/${item._id}/live`)}
                  isLive
                />
              )}
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-1"
            />
          </View>
        )}

        {/* Quick Actions */}
        <View className="px-4 pt-6 pb-2">
          <Text className="text-lg font-bold text-gray-800 mb-3">Quick Actions</Text>
          <View className="flex-row gap-3">
            {[
              { icon: 'baseball',  label: 'Score Match', color: '#1E3A5F', route: '/match/create' },
              { icon: 'people',    label: 'Create Team', color: '#059669', route: '/team/create' },
              { icon: 'search',    label: 'Search',      color: '#7C3AED', route: '/search' },
              { icon: 'trophy',    label: 'Leaderboard', color: '#D97706', route: '/(tabs)/leaderboard' },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                className="flex-1 rounded-2xl py-4 items-center"
                style={{ backgroundColor: item.color + '15', borderWidth: 1, borderColor: item.color + '30' }}
                onPress={() => router.push(item.route as any)}
              >
                <Ionicons name={item.icon as any} size={24} color={item.color} />
                <Text className="text-xs font-semibold mt-1" style={{ color: item.color }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Matches */}
        <View className="px-4 pt-4 pb-8">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-800">Recent Matches</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/matches')}>
              <Text className="text-primary text-sm font-semibold">See all</Text>
            </TouchableOpacity>
          </View>
          {matches.slice(0, 5).map((match) => (
            <MatchCard
              key={match._id}
              match={match}
              onPress={() => router.push(`/match/${match._id}/live`)}
            />
          ))}
          {matches.length === 0 && !isLoading && (
            <View className="items-center py-8">
              <Text className="text-4xl mb-2">🏏</Text>
              <Text className="text-gray-500">No matches yet</Text>
              <TouchableOpacity
                className="mt-3 bg-primary px-6 py-2 rounded-full"
                onPress={() => router.push('/match/create')}
              >
                <Text className="text-white font-semibold">Create first match</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
