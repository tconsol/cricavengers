import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, FlatList } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { useMatchStore } from '@store/matchStore';
import { useTournamentStore } from '@store/tournamentStore';
import MatchCard from '@components/match/MatchCard';
import DrawerMenu from '@components/ui/DrawerMenu';

function TournamentBadge({ item }: { item: any }) {
  const stateColors: Record<string, string> = {
    in_progress: '#2563EB',
    registration_open: '#059669',
    completed: '#7C3AED',
  };
  const color = stateColors[item.state] || '#6B7280';
  const label = item.state === 'in_progress' ? 'Live'
    : item.state === 'registration_open' ? 'Open' : 'Done';

  return (
    <TouchableOpacity
      className="bg-white rounded-2xl p-4 mr-3 shadow-sm"
      style={{ width: 200 }}
      onPress={() => router.push(`/tournament/${item._id}` as any)}
      activeOpacity={0.8}
    >
      <View className="flex-row items-start justify-between mb-2">
        <Text className="font-bold text-gray-800 flex-1 mr-2 text-sm" numberOfLines={2}>{item.name}</Text>
        <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: color + '20' }}>
          <Text className="text-xs font-bold" style={{ color }}>{label}</Text>
        </View>
      </View>
      <Text className="text-xs text-gray-400">
        {item.teams?.length || 0}/{item.maxTeams} teams · {item.matchFormat}
      </Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { liveMatches, matches, fetchLiveMatches, fetchMatches, isLoading } = useMatchStore();
  const { tournaments, fetchTournaments } = useTournamentStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = () => {
    fetchLiveMatches();
    fetchMatches({ limit: '5' });
    fetchTournaments({ limit: '6' });
  };

  useEffect(() => { load(); }, []);

  const activeTournaments = tournaments.filter((t) =>
    ['in_progress', 'registration_open'].includes(t.state),
  );

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-4">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            style={{ width: 38, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' }}
          >
            <Ionicons name="menu" size={22} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text className="text-white text-base">Hello,</Text>
            <Text className="text-white text-2xl font-bold">{user?.name?.split(' ')[0]} 👋</Text>
          </View>
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

        {/* Active Tournaments */}
        {activeTournaments.length > 0 && (
          <View className="pt-5 px-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-800">🏆 Tournaments</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/tournaments')}>
                <Text className="text-primary text-sm font-semibold">See all</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={activeTournaments}
              keyExtractor={(t) => t._id}
              renderItem={({ item }) => <TournamentBadge item={item} />}
              horizontal
              showsHorizontalScrollIndicator={false}
            />
          </View>
        )}

        {/* Quick Actions */}
        <View className="px-4 pt-5 pb-2">
          <Text className="text-lg font-bold text-gray-800 mb-3">Quick Actions</Text>
          <View className="flex-row flex-wrap gap-3">
            {[
              { icon: 'baseball',  label: 'Score Match',  color: '#1E3A5F', route: '/match/create' },
              { icon: 'trophy',    label: 'Tournament',   color: '#7C3AED', route: '/tournament/create' },
              { icon: 'people',    label: 'Create Team',  color: '#059669', route: '/team/create' },
              { icon: 'bar-chart', label: 'Stats',        color: '#D97706', route: '/(tabs)/leaderboard' },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                className="rounded-2xl py-4 items-center"
                style={{
                  width: '47%',
                  backgroundColor: item.color + '15',
                  borderWidth: 1,
                  borderColor: item.color + '30',
                }}
                onPress={() => router.push(item.route as any)}
              >
                <Ionicons name={item.icon as any} size={26} color={item.color} />
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
              isOwner={user?._id === (match.createdBy?._id || match.createdBy)}
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
