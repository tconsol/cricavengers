import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';

interface Props {
  onBallPress: (runs: number) => void;
  onWicket: () => void;
  onExtra: (type: string) => void;
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

const EXTRA_CONFIGS = [
  { key: 'wide',    label: 'Wd',  bg: '#FEFCE8', text: '#B45309', border: '#FCD34D' },
  { key: 'no_ball', label: 'NB',  bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74' },
  { key: 'bye',     label: 'Bye', bg: '#F5F3FF', text: '#6D28D9', border: '#C4B5FD' },
  { key: 'leg_bye', label: 'LB',  bg: '#EFF6FF', text: '#1D4ED8', border: '#93C5FD' },
];

export default function BallInput({ onBallPress, onWicket, onExtra, isSubmitting }: Props) {
  return (
    <View style={{ gap: 10 }}>
      {/* Runs grid */}
      <View className="flex-row gap-2">
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
      <View className="flex-row gap-2">
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

      {/* Extras row */}
      <View className="flex-row gap-2">
        {EXTRA_CONFIGS.map((e) => (
          <TouchableOpacity
            key={e.key}
            style={{
              flex: 1, paddingVertical: 10, borderRadius: 14,
              backgroundColor: e.bg,
              borderWidth: 1.5, borderColor: e.border,
              alignItems: 'center',
              opacity: isSubmitting ? 0.5 : 1,
            }}
            onPress={() => !isSubmitting && onExtra(e.key)}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text style={{ fontWeight: '800', fontSize: 13, color: e.text }}>{e.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
