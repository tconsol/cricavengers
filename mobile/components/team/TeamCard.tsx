import { View, Text, TouchableOpacity } from 'react-native';

interface Props {
  team: any;
  onPress: () => void;
}

export default function TeamCard({ team, onPress }: Props) {
  return (
    <TouchableOpacity
      className="flex-1 bg-white rounded-2xl p-4 shadow-sm active:opacity-90"
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Team logo/color */}
      <View
        className="w-14 h-14 rounded-full items-center justify-center mb-3"
        style={{ backgroundColor: team.color || '#1E3A5F' }}
      >
        <Text className="text-white text-xl font-black">
          {team.shortName || team.name.slice(0, 2).toUpperCase()}
        </Text>
      </View>

      <Text className="font-bold text-gray-800" numberOfLines={2}>{team.name}</Text>
      <Text className="text-xs text-gray-400 mt-1">{team.playerCount ?? team.players?.length ?? 0} players</Text>

      {/* Win/Loss */}
      {(team.stats?.matches ?? 0) > 0 && (
        <View className="flex-row gap-2 mt-2">
          <Text className="text-xs text-green-600 font-semibold">W {team.stats?.wins ?? 0}</Text>
          <Text className="text-xs text-gray-300">|</Text>
          <Text className="text-xs text-red-500 font-semibold">L {team.stats?.losses ?? 0}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
