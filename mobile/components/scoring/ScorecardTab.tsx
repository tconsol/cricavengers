import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { api } from '@services/api';

interface Props { matchId: string; }

export default function ScorecardTab({ matchId }: Props) {
  const [tab, setTab]           = useState<'batting' | 'bowling'>('batting');
  const [scorecard, setScorecard] = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [innings, setInnings]   = useState(1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/matches/${matchId}/scorecard`) as any;
        setScorecard(res.data.summary);
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    load();
  }, [matchId]);

  const inningsSummary = scorecard?.innings?.[innings - 1];

  return (
    <View className="mx-4 mb-4 bg-white rounded-2xl overflow-hidden shadow-sm">
      {/* Innings selector */}
      {scorecard?.innings?.length > 1 && (
        <View className="flex-row">
          {[1, 2].map((i) => (
            <TouchableOpacity
              key={i}
              className={`flex-1 py-2 items-center ${innings === i ? 'bg-primary' : 'bg-gray-50'}`}
              onPress={() => setInnings(i)}
            >
              <Text className={`text-sm font-semibold ${innings === i ? 'text-white' : 'text-gray-500'}`}>
                {i === 1 ? '1st' : '2nd'} Innings
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Tab selector */}
      <View className="flex-row border-b border-gray-100">
        {(['batting', 'bowling'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            className={`flex-1 py-3 items-center ${tab === t ? 'border-b-2 border-primary' : ''}`}
            onPress={() => setTab(t)}
          >
            <Text className={`text-sm font-semibold ${tab === t ? 'text-primary' : 'text-gray-400'}`}>
              {t === 'batting' ? '🏏 Batting' : '⚡ Bowling'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator className="py-8" color="#1E3A5F" />
      ) : tab === 'batting' ? (
        <View>
          <View className="flex-row px-3 py-2 bg-gray-50">
            <Text className="flex-1 text-xs font-bold text-gray-500">BATSMAN</Text>
            <Text className="w-8 text-center text-xs font-bold text-gray-500">R</Text>
            <Text className="w-8 text-center text-xs font-bold text-gray-500">B</Text>
            <Text className="w-8 text-center text-xs font-bold text-gray-500">4s</Text>
            <Text className="w-8 text-center text-xs font-bold text-gray-500">6s</Text>
            <Text className="w-12 text-center text-xs font-bold text-gray-500">SR</Text>
          </View>
          {(inningsSummary?.batting || []).map((b: any, i: number) => (
            <View key={i} className="flex-row px-3 py-2 border-b border-gray-50 items-center">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-800">{b.playerName}</Text>
                <Text className="text-xs text-gray-400">{b.isOut ? b.dismissal?.replace(/_/g, ' ') : 'not out'}</Text>
              </View>
              <Text className="w-8 text-center font-bold text-gray-800">{b.runs}</Text>
              <Text className="w-8 text-center text-gray-500">{b.balls}</Text>
              <Text className="w-8 text-center text-gray-500">{b.fours}</Text>
              <Text className="w-8 text-center text-gray-500">{b.sixes}</Text>
              <Text className="w-12 text-center text-gray-500">{(b.strikeRate || 0).toFixed(0)}</Text>
            </View>
          ))}
          {/* Extras + Total */}
          {inningsSummary && (
            <>
              <View className="flex-row px-3 py-2 bg-gray-50">
                <Text className="flex-1 text-xs text-gray-500">
                  Extras: {inningsSummary.extras?.total || 0}
                  {' '}(w {inningsSummary.extras?.wides || 0}, nb {inningsSummary.extras?.noBalls || 0}, b {inningsSummary.extras?.byes || 0}, lb {inningsSummary.extras?.legByes || 0})
                </Text>
              </View>
              <View className="flex-row px-3 py-3">
                <Text className="flex-1 font-bold text-gray-800">Total</Text>
                <Text className="font-bold text-gray-800 text-base">
                  {inningsSummary.totalRuns}/{inningsSummary.wickets} ({inningsSummary.overs}.{inningsSummary.balls} ov)
                </Text>
              </View>
            </>
          )}
        </View>
      ) : (
        <View>
          <View className="flex-row px-3 py-2 bg-gray-50">
            <Text className="flex-1 text-xs font-bold text-gray-500">BOWLER</Text>
            <Text className="w-10 text-center text-xs font-bold text-gray-500">O</Text>
            <Text className="w-8 text-center text-xs font-bold text-gray-500">M</Text>
            <Text className="w-8 text-center text-xs font-bold text-gray-500">R</Text>
            <Text className="w-8 text-center text-xs font-bold text-gray-500">W</Text>
            <Text className="w-12 text-center text-xs font-bold text-gray-500">ECO</Text>
          </View>
          {(inningsSummary?.bowling || []).map((b: any, i: number) => (
            <View key={i} className="flex-row px-3 py-2 border-b border-gray-50 items-center">
              <Text className="flex-1 text-sm font-semibold text-gray-800">{b.playerName}</Text>
              <Text className="w-10 text-center text-gray-500">{b.overs}.{b.balls % 6}</Text>
              <Text className="w-8 text-center text-gray-500">{b.maidens}</Text>
              <Text className="w-8 text-center text-gray-500">{b.runs}</Text>
              <Text className="w-8 text-center font-bold text-gray-800">{b.wickets}</Text>
              <Text className="w-12 text-center text-gray-500">{(b.economy || 0).toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
