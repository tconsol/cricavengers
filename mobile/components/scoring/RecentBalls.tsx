import { View, Text, ScrollView } from 'react-native';
import { useScoringStore } from '@store/scoringStore';

interface Props {
  matchId: string;
  compact?: boolean;
}

const getBallStyle = (ball: any) => {
  if (ball.wicket) return { bg: '#EF4444', color: '#fff', label: 'W' };
  if (ball.extras?.type === 'wide') return { bg: '#FEF3C7', color: '#D97706', label: 'Wd' };
  if (ball.extras?.type === 'no_ball') return { bg: '#FED7AA', color: '#EA580C', label: 'Nb' };
  if (ball.runs === 6) return { bg: '#16A34A', color: '#fff', label: '6' };
  if (ball.runs === 4) return { bg: '#2563EB', color: '#fff', label: '4' };
  return { bg: '#E5E7EB', color: '#374151', label: String(ball.runs ?? 0) };
};

export default function RecentBalls({ compact = false }: Props) {
  const { recentBalls } = useScoringStore();
  const raw = compact ? recentBalls.slice(0, 6) : recentBalls.slice(0, 12);

  // Deduplicate by _id, then sort oldest → newest so latest is on the right
  const seen = new Set<string>();
  const unique = raw.filter((b) => {
    if (!b._id) return true;
    if (seen.has(b._id)) return false;
    seen.add(b._id);
    return true;
  });
  const sorted = [...unique].sort((a, b) => {
    if (a.over !== b.over) return a.over - b.over;
    return a.ball - b.ball;
  });

  if (sorted.length === 0) return null;

  return (
    <View style={{ marginTop: compact ? 10 : 12, marginHorizontal: compact ? 0 : 16 }}>
      {!compact && (
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.4, marginBottom: 8 }}>
          THIS OVER
        </Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: 6 }}>
        {sorted.map((ball) => {
          const s = getBallStyle(ball);
          return (
            <View
              key={ball._id || `${ball.over}-${ball.ball}`}
              style={{
                width: compact ? 34 : 38,
                height: compact ? 34 : 38,
                borderRadius: compact ? 17 : 19,
                backgroundColor: s.bg,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.06)',
              }}
            >
              <Text style={{ fontSize: compact ? 11 : 12, fontWeight: '800', color: s.color }}>{s.label}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
