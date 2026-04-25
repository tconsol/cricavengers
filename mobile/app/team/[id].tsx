import { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTeamStore } from '@store/teamStore';

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentTeam, fetchTeam, isLoading } = useTeamStore();

  useEffect(() => { fetchTeam(id!); }, [id]);

  if (isLoading || !currentTeam) {
    return (
      <SafeAreaView className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator size="large" color="#F4A200" />
      </SafeAreaView>
    );
  }

  const captain = currentTeam.players.find((p: any) => p.isCaptain);

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold ml-3 flex-1">{currentTeam.name}</Text>
      </View>

      {/* Team banner */}
      <View className="items-center pb-6">
        <View
          className="w-20 h-20 rounded-full items-center justify-center mb-2"
          style={{ backgroundColor: currentTeam.color }}
        >
          <Text className="text-white text-2xl font-black">{currentTeam.shortName}</Text>
        </View>
        <Text className="text-white text-lg font-bold">{currentTeam.name}</Text>
        {captain && (
          <Text className="text-blue-200 text-sm">Captain: {captain.name}</Text>
        )}
        <Text className="text-blue-300 text-xs mt-1">
          {currentTeam.players.length} players
        </Text>
      </View>

      <FlatList
        data={currentTeam.players}
        keyExtractor={(p: any) => p._id}
        className="bg-surface rounded-t-3xl pt-4 px-4"
        renderItem={({ item: player, index }) => (
          <View className="flex-row items-center bg-white rounded-2xl px-4 py-3 mb-2 shadow-sm">
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: currentTeam.color + '20' }}
            >
              <Text className="font-bold" style={{ color: currentTeam.color }}>
                {player.jerseyNumber || index + 1}
              </Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="font-semibold text-gray-800">{player.name}</Text>
                {player.isCaptain && (
                  <View className="bg-accent/20 px-1.5 py-0.5 rounded-full">
                    <Text className="text-accent text-xs font-bold">C</Text>
                  </View>
                )}
                {player.isViceCaptain && (
                  <View className="bg-blue-100 px-1.5 py-0.5 rounded-full">
                    <Text className="text-blue-600 text-xs font-bold">VC</Text>
                  </View>
                )}
              </View>
              <Text className="text-gray-400 text-xs capitalize">{player.role?.replace('-', ' ')}</Text>
            </View>
          </View>
        )}
        ListHeaderComponent={
          <Text className="font-bold text-gray-700 mb-3">Players ({currentTeam.players.length})</Text>
        }
        ListFooterComponent={<View className="h-8" />}
      />
    </SafeAreaView>
  );
}
