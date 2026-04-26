import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@services/api';

type Tab = 'Batting' | 'Bowling' | 'Fielding';

interface BattingStats {
  matches: number; innings: number; notOuts: number; totalRuns: number;
  highScore: number; highScoreNotOut: boolean; average: number; strikeRate: number;
  thirties: number; fifties: number; hundreds: number; fours: number; sixes: number;
  ducks: number; won: number; loss: number;
}
interface BowlingStats {
  matches: number; innings: number; overs: string; totalRuns: number; totalWickets: number;
  bestBowling: string; threeWicketHauls: number; fiveWicketHauls: number;
  economy: number; strikeRate: number | null; average: number | null;
  wides: number; noBalls: number; dots: number; foursConceded: number; sixesConceded: number;
  maidens: number;
}
interface FieldingStats {
  matches: number; catches: number; caughtAndBowled: number; runOuts: number;
  stumpings: number; totalDismissals: number;
}

interface PlayerData {
  name: string;
  role?: string;
  batting: BattingStats;
  bowling: BowlingStats;
  fielding: FieldingStats;
}

const fmt = (n: number | null | undefined, dec = 2): string => {
  if (n === null || n === undefined) return '-';
  return Number.isInteger(n) ? String(n) : n.toFixed(dec);
};

function StatCell({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#1E3A5F' }}>{value}</Text>
      <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function StatRow({ cells }: { cells: { value: string | number; label: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
      {cells.map((c, i) => (
        <StatCell key={i} value={c.value} label={c.label} />
      ))}
    </View>
  );
}

function BattingTab({ s }: { s: BattingStats }) {
  const hs = s.highScoreNotOut ? `${s.highScore}*` : String(s.highScore);
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginHorizontal: 16 }}>
      <View style={{ backgroundColor: '#F9FAFB', paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', letterSpacing: 0.5 }}>OVERALL</Text>
      </View>
      <StatRow cells={[
        { value: s.matches, label: 'Mat' },
        { value: s.innings, label: 'Inns' },
        { value: s.notOuts, label: 'NO' },
      ]} />
      <StatRow cells={[
        { value: s.totalRuns, label: 'Runs' },
        { value: hs, label: 'HS' },
        { value: fmt(s.average), label: 'Avg' },
      ]} />
      <StatRow cells={[
        { value: fmt(s.strikeRate, 1), label: 'SR' },
        { value: s.thirties, label: '30s' },
        { value: s.fifties, label: '50s' },
      ]} />
      <StatRow cells={[
        { value: s.hundreds, label: '100s' },
        { value: s.fours, label: '4s' },
        { value: s.sixes, label: '6s' },
      ]} />
      <StatRow cells={[
        { value: s.ducks, label: 'Ducks' },
        { value: s.won, label: 'Won' },
        { value: s.loss, label: 'Loss' },
      ]} />
    </View>
  );
}

function BowlingTab({ s }: { s: BowlingStats }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginHorizontal: 16 }}>
      <View style={{ backgroundColor: '#F9FAFB', paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', letterSpacing: 0.5 }}>OVERALL</Text>
      </View>
      <StatRow cells={[
        { value: s.matches, label: 'Mat' },
        { value: s.innings, label: 'Inns' },
        { value: s.overs, label: 'Overs' },
      ]} />
      <StatRow cells={[
        { value: s.maidens, label: 'Mdns' },
        { value: s.totalRuns, label: 'Runs' },
        { value: s.totalWickets, label: 'Wkts' },
      ]} />
      <StatRow cells={[
        { value: s.bestBowling, label: 'BB' },
        { value: s.threeWicketHauls, label: '3 Wkts' },
        { value: s.fiveWicketHauls, label: '5 Wkts' },
      ]} />
      <StatRow cells={[
        { value: fmt(s.economy), label: 'Eco' },
        { value: s.strikeRate !== null ? fmt(s.strikeRate, 1) : '-', label: 'SR' },
        { value: s.average !== null ? fmt(s.average, 1) : '-', label: 'Avg' },
      ]} />
      <StatRow cells={[
        { value: s.wides, label: 'WD' },
        { value: s.noBalls, label: 'NB' },
        { value: s.dots, label: 'Dots' },
      ]} />
      <StatRow cells={[
        { value: s.foursConceded, label: '4s' },
        { value: s.sixesConceded, label: '6s' },
        { value: '', label: '' },
      ]} />
    </View>
  );
}

function FieldingTab({ s }: { s: FieldingStats }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginHorizontal: 16 }}>
      <View style={{ backgroundColor: '#F9FAFB', paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280', letterSpacing: 0.5 }}>OVERALL</Text>
      </View>
      <StatRow cells={[
        { value: s.matches, label: 'Mat' },
        { value: s.catches, label: 'Catches' },
        { value: s.caughtAndBowled, label: 'C&B' },
      ]} />
      <StatRow cells={[
        { value: s.runOuts, label: 'R/O' },
        { value: s.stumpings, label: 'St' },
        { value: s.totalDismissals, label: 'Total' },
      ]} />
    </View>
  );
}

export default function PlayerStatsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('Batting');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/stats/players/${id}`)
      .then((res: any) => {
        setData(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const tabs: Tab[] = ['Batting', 'Bowling', 'Fielding'];
  const initials = (data?.name || '?').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1E3A5F' }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
          <Text style={{ color: '#fff', marginLeft: 8, fontSize: 15 }}>Back</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center',
            borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)', marginBottom: 10,
          }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff' }}>{initials}</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>
            {data?.name || '—'}
          </Text>
          {data?.role && (
            <View style={{
              marginTop: 6, backgroundColor: 'rgba(255,255,255,0.15)',
              paddingHorizontal: 12, paddingVertical: 3, borderRadius: 20,
            }}>
              <Text style={{ color: '#E2E8F0', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>
                {data.role}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Tab bar */}
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderRadius: 0 }}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={{
              flex: 1, paddingVertical: 14, alignItems: 'center',
              borderBottomWidth: 3,
              borderBottomColor: tab === t ? '#1E3A5F' : 'transparent',
            }}
          >
            <Text style={{
              fontSize: 14, fontWeight: '700',
              color: tab === t ? '#1E3A5F' : '#9CA3AF',
            }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={{ flex: 1, backgroundColor: '#F3F4F6' }} contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#1E3A5F" style={{ marginTop: 60 }} />
        ) : !data ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ color: '#6B7280', fontSize: 16 }}>No stats available</Text>
          </View>
        ) : (
          <>
            {tab === 'Batting' && <BattingTab s={data.batting} />}
            {tab === 'Bowling' && <BowlingTab s={data.bowling} />}
            {tab === 'Fielding' && <FieldingTab s={data.fielding} />}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
