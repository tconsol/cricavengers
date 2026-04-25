import { View, Text, ScrollView } from 'react-native';
import { useScoringStore } from '@store/scoringStore';

interface Props {
  matchId: string;
  compact?: boolean;
}

const getBallStyle = (ball: any) => {
  if (ball.wicket) return { bg: 'bg-red-500', text: 'text-white', label: 'W' };
  if (ball.extras?.type === 'wide') return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Wd' };
  if (ball.extras?.type === 'no_ball') return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Nb' };
  if (ball.runs === 6) return { bg: 'bg-accent', text: 'text-white', label: '6' };
  if (ball.runs === 4) return { bg: 'bg-green-500', text: 'text-white', label: '4' };
  return { bg: 'bg-gray-100', text: 'text-gray-700', label: String(ball.runs || 0) };
};

export default function RecentBalls({ matchId, compact = false }: Props) {
  const { recentBalls } = useScoringStore();
  const display = compact ? recentBalls.slice(0, 6) : recentBalls.slice(0, 12);

  if (display.length === 0) return null;

  return (
    <View className={compact ? 'mt-3' : 'mx-4 my-3'}>
      {!compact && <Text className="text-sm font-bold text-gray-600 mb-2">This Over</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {[...display].reverse().map((ball, i) => {
            const style = getBallStyle(ball);
            return (
              <View
                key={ball._id || i}
                className={`w-10 h-10 rounded-full items-center justify-center ${style.bg}`}
              >
                <Text className={`text-xs font-bold ${style.text}`}>{style.label}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
