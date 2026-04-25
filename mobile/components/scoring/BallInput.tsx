import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

interface Props {
  onBallPress: (runs: number) => void;
  onWicket: () => void;
  isSubmitting: boolean;
}

const RUN_CONFIGS = [
  { runs: 0, label: '0',  bg: 'bg-gray-100', text: 'text-gray-700' },
  { runs: 1, label: '1',  bg: 'bg-blue-50',  text: 'text-blue-700' },
  { runs: 2, label: '2',  bg: 'bg-blue-50',  text: 'text-blue-700' },
  { runs: 3, label: '3',  bg: 'bg-green-50', text: 'text-green-700' },
  { runs: 4, label: '4',  bg: 'bg-green-100',text: 'text-green-700', border: 'border-2 border-green-400' },
  { runs: 6, label: '6',  bg: 'bg-accent',   text: 'text-white',    border: 'border-2 border-yellow-500' },
];

export default function BallInput({ onBallPress, onWicket, isSubmitting }: Props) {
  return (
    <View className="gap-3">
      {/* Runs grid */}
      <View className="flex-row gap-3">
        {RUN_CONFIGS.map((config) => (
          <TouchableOpacity
            key={config.runs}
            className={`flex-1 aspect-square rounded-2xl items-center justify-center ${config.bg} ${config.border || ''} ${isSubmitting ? 'opacity-50' : ''}`}
            onPress={() => !isSubmitting && onBallPress(config.runs)}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text className={`text-2xl font-bold ${config.text}`}>{config.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Run 5 (rare) and Wicket */}
      <View className="flex-row gap-3">
        <TouchableOpacity
          className={`flex-1 py-4 rounded-2xl bg-orange-50 border border-orange-200 items-center ${isSubmitting ? 'opacity-50' : ''}`}
          onPress={() => !isSubmitting && onBallPress(5)}
          disabled={isSubmitting}
        >
          <Text className="text-2xl font-bold text-orange-600">5</Text>
          <Text className="text-xs text-orange-400">Rare</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 py-4 rounded-2xl bg-red-500 items-center justify-center ${isSubmitting ? 'opacity-50' : ''}`}
          onPress={!isSubmitting ? onWicket : undefined}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text className="text-3xl">🏏</Text>
              <Text className="text-white font-bold text-sm">WICKET</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
