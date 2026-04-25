import { View, Text, TouchableOpacity } from 'react-native';

interface Props {
  match: any;
  onPress: () => void;
  isLive?: boolean;
}

const STATE_LABELS: Record<string, string> = {
  NOT_STARTED:    'Upcoming',
  TOSS_DONE:      'Toss Done',
  FIRST_INNINGS:  '1st Innings',
  INNINGS_BREAK:  'Innings Break',
  SECOND_INNINGS: '2nd Innings',
  COMPLETED:      'Completed',
  ABANDONED:      'Abandoned',
};

export default function MatchCard({ match, onPress, isLive = false }: Props) {
  const teamA = match.teamA;
  const teamB = match.teamB;

  return (
    <TouchableOpacity
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm active:opacity-90"
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-gray-400 text-xs">{match.format} · {match.totalOvers} overs</Text>
          {match.venue && <Text className="text-gray-300">·</Text>}
          {match.venue && (
            <Text className="text-gray-400 text-xs" numberOfLines={1}>{match.venue}</Text>
          )}
        </View>
        <View className={`px-2 py-0.5 rounded-full ${isLive ? 'bg-red-500' : 'bg-gray-100'}`}>
          {isLive && (
            <View className="flex-row items-center gap-1">
              <View className="w-1.5 h-1.5 rounded-full bg-white" />
              <Text className="text-white text-xs font-bold">LIVE</Text>
            </View>
          )}
          {!isLive && (
            <Text className="text-gray-500 text-xs">{STATE_LABELS[match.state] || match.state}</Text>
          )}
        </View>
      </View>

      {/* Teams */}
      <View className="flex-row items-center justify-between">
        {/* Team A */}
        <View className="flex-1 items-start">
          <View className="flex-row items-center gap-2">
            <View className="w-6 h-6 rounded-full" style={{ backgroundColor: teamA?.color || '#1E3A5F' }} />
            <Text className="font-bold text-gray-800 text-base">{teamA?.shortName || teamA?.name}</Text>
          </View>
          <Text className="text-gray-500 text-xs mt-0.5">{teamA?.name}</Text>
        </View>

        {/* VS */}
        <View className="items-center px-4">
          <Text className="text-gray-300 font-bold text-lg">VS</Text>
        </View>

        {/* Team B */}
        <View className="flex-1 items-end">
          <View className="flex-row items-center gap-2">
            <Text className="font-bold text-gray-800 text-base">{teamB?.shortName || teamB?.name}</Text>
            <View className="w-6 h-6 rounded-full" style={{ backgroundColor: teamB?.color || '#8B0000' }} />
          </View>
          <Text className="text-gray-500 text-xs mt-0.5">{teamB?.name}</Text>
        </View>
      </View>

      {/* Result if completed */}
      {match.state === 'COMPLETED' && match.result?.description && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <Text className="text-center text-sm font-semibold text-primary">
            {match.result.description}
          </Text>
        </View>
      )}

      {/* Scheduled time if upcoming */}
      {match.state === 'NOT_STARTED' && (
        <View className="mt-2">
          <Text className="text-xs text-gray-400 text-center">
            {new Date(match.scheduledAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
