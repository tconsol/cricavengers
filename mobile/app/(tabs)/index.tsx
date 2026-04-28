import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { useMatchStore } from '@store/matchStore';
import { useTournamentStore } from '@store/tournamentStore';
import MatchCard from '@components/match/MatchCard';
import DrawerMenu from '@components/ui/DrawerMenu';

function TournamentCard({ item }: { item: any }) {
  const stateColor = item.state === 'in_progress' ? '#2563EB'
    : item.state === 'registration_open' ? '#059669' : '#7C3AED';
  const stateLabel = item.state === 'in_progress' ? 'Live'
    : item.state === 'registration_open' ? 'Open' : 'Done';

  return (
    <TouchableOpacity
      onPress={() => router.push(`/tournament/${item._id}` as any)}
      activeOpacity={0.85}
      style={{
        width: 190,
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 14,
        marginRight: 12,
        shadowColor: '#000',
        shadowOpacity: 0.07,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: stateColor + '18', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trophy" size={18} color={stateColor} />
        </View>
        <View style={{ backgroundColor: stateColor + '18', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: stateColor }}>{stateLabel}</Text>
        </View>
      </View>
      <Text style={{ fontWeight: '700', color: '#111827', fontSize: 13, marginBottom: 4 }} numberOfLines={2}>{item.name}</Text>
      <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
        {item.teams?.length || 0}/{item.maxTeams} teams · {item.matchFormat}
      </Text>
    </TouchableOpacity>
  );
}

const QUICK_ACTIONS = [
  { icon: 'baseball',   label: 'New Match',   color: '#1E3A5F', bg: '#EEF2FF', route: '/match/create' },
  { icon: 'trophy',     label: 'Tournament',  color: '#7C3AED', bg: '#F5F3FF', route: '/tournament/create' },
  { icon: 'people',     label: 'My Teams',    color: '#059669', bg: '#F0FDF4', route: '/(tabs)/teams?mine=true' },
  { icon: 'bar-chart',  label: 'Stats',       color: '#D97706', bg: '#FFFBEB', route: '/(tabs)/leaderboard' },
];

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { liveMatches, matches, fetchLiveMatches, fetchMatches, isLoading } = useMatchStore();
  const { tournaments, fetchTournaments } = useTournamentStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(() => {
    fetchLiveMatches();
    fetchMatches({ limit: '6' });
    fetchTournaments({ limit: '6' });
  }, []);

  useFocusEffect(load);

  const activeTournaments = tournaments.filter((t) =>
    ['in_progress', 'registration_open'].includes(t.state),
  );

  const recentMatches = matches.filter((m) => !liveMatches.some((lm) => lm._id === m._id)).slice(0, 5);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1E3A5F' }} edges={['top']}>
      <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={() => setDrawerOpen(true)}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="menu" size={22} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>Welcome back,</Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 27 }}>
              {user?.name?.split(' ')[0]} 👋
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/match/create')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F59E0B', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, shadowColor: '#F59E0B', shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 }}
        >
          <Ionicons name="add" size={18} color="#000" />
          <Text style={{ fontWeight: '800', color: '#000', fontSize: 13 }}>New Match</Text>
        </TouchableOpacity>
      </View>

      {/* ── Scrollable content ─────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1, backgroundColor: '#F4F6F9', borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} tintColor="#1E3A5F" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── LIVE NOW ─────────────────────────────────────────── */}
        {liveMatches.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingTop: 22 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEE2E2', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444' }} />
                <Text style={{ color: '#DC2626', fontWeight: '800', fontSize: 13 }}>Live Now</Text>
              </View>
              <Text style={{ color: '#9CA3AF', fontSize: 12 }}>{liveMatches.length} match{liveMatches.length > 1 ? 'es' : ''} in progress</Text>
            </View>
            {liveMatches.map((m) => (
              <MatchCard
                key={m._id}
                match={m}
                onPress={() => router.push(`/match/${m._id}/live`)}
                isLive
              />
            ))}
          </View>
        )}

        {/* ── QUICK ACTIONS ────────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingTop: liveMatches.length > 0 ? 8 : 22 }}>
          <Text style={{ fontWeight: '800', color: '#111827', fontSize: 16, marginBottom: 12 }}>Quick Actions</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {QUICK_ACTIONS.map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: 'center',
                  gap: 8,
                  shadowColor: '#000',
                  shadowOpacity: 0.05,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#374151', textAlign: 'center' }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── TOURNAMENTS ──────────────────────────────────────── */}
        {activeTournaments.length > 0 && (
          <View style={{ paddingTop: 22 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}>
              <Text style={{ fontWeight: '800', color: '#111827', fontSize: 16 }}>Tournaments</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/tournaments')}>
                <Text style={{ color: '#1E3A5F', fontSize: 13, fontWeight: '600' }}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            >
              {activeTournaments.map((t) => <TournamentCard key={t._id} item={t} />)}
            </ScrollView>
          </View>
        )}

        {/* ── RECENT MATCHES ───────────────────────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 22 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontWeight: '800', color: '#111827', fontSize: 16 }}>Recent Matches</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/matches')}>
              <Text style={{ color: '#1E3A5F', fontSize: 13, fontWeight: '600' }}>See all</Text>
            </TouchableOpacity>
          </View>

          {recentMatches.map((match) => (
            <MatchCard
              key={match._id}
              match={match}
              onPress={() => router.push(`/match/${match._id}/live`)}
              isOwner={user?._id === (match.createdBy?._id || match.createdBy)}
            />
          ))}

          {recentMatches.length === 0 && !isLoading && (
            <View style={{ backgroundColor: '#fff', borderRadius: 18, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 30 }}>🏏</Text>
              </View>
              <Text style={{ fontWeight: '700', color: '#374151', fontSize: 15, marginBottom: 4 }}>No matches yet</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>Create your first match and start scoring</Text>
              <TouchableOpacity
                onPress={() => router.push('/match/create')}
                style={{ backgroundColor: '#1E3A5F', borderRadius: 24, paddingHorizontal: 24, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Create Match</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
