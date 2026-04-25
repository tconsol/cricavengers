import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@services/api';

export default function LeaderboardScreen() {
  const [type, setType]   = useState<'batting' | 'bowling'>('batting');
  const [data, setData]   = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/stats/leaderboard', { type }) as any;
      setData(res.data.leaderboard);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [type]);

  const renderItem = ({ item, index }: any) => (
    <View className="flex-row items-center bg-white rounded-2xl px-4 py-3 mb-2 shadow-sm">
      <Text className={`text-lg font-bold w-8 ${
        index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-600' : 'text-gray-500'
      }`}>
        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
      </Text>
      <View className="flex-1 ml-3">
        <Text className="font-bold text-gray-800">{item.player?.name || 'Unknown'}</Text>
        <Text className="text-gray-400 text-xs">{item.matches} matches</Text>
      </View>
      <View className="items-end">
        <Text className="text-2xl font-bold text-primary">
          {type === 'batting' ? item.totalRuns : item.totalWickets}
        </Text>
        <Text className="text-xs text-gray-400">{type === 'batting' ? 'Runs' : 'Wickets'}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      <View className="px-4 py-4">
        <Text className="text-white text-2xl font-bold">Leaderboard 🏆</Text>
      </View>

      <View className="flex-1 bg-surface rounded-t-3xl pt-4">
        {/* Toggle */}
        <View className="flex-row mx-4 bg-gray-100 rounded-xl p-1 mb-4">
          {(['batting', 'bowling'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              className={`flex-1 py-2 rounded-lg items-center ${type === t ? 'bg-primary' : ''}`}
              onPress={() => setType(t)}
            >
              <Text className={`font-bold ${type === t ? 'text-white' : 'text-gray-500'}`}>
                {t === 'batting' ? '🏏 Batting' : '⚡ Bowling'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1E3A5F" className="mt-10" />
        ) : (
          <FlatList
            data={data}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            ListEmptyComponent={
              <View className="items-center py-16">
                <Text className="text-4xl mb-2">🏆</Text>
                <Text className="text-gray-400">No data yet</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
