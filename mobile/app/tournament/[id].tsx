import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, FlatList, RefreshControl, TextInput,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTournamentStore, type Tournament, type Fixture, type StandingsEntry } from '@store/tournamentStore';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';

const TABS = ['Overview', 'Standings', 'Fixtures', 'Teams'];

const STATE_COLORS: Record<string, string> = {
  draft: '#6B7280',
  registration_open: '#059669',
  registration_closed: '#D97706',
  in_progress: '#2563EB',
  completed: '#7C3AED',
  cancelled: '#DC2626',
};

const STATE_LABELS: Record<string, string> = {
  draft: 'Draft',
  registration_open: 'Registration Open',
  registration_closed: 'Registration Closed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const LIFECYCLE_STATES = ['draft', 'registration_open', 'registration_closed', 'in_progress', 'completed'];
const LIFECYCLE_LABELS = ['Draft', 'Reg. Open', 'Reg. Closed', 'In Progress', 'Completed'];

// ── Sub-components ──────────────────────────────────────────

function StandingsTab({ standings }: { standings: StandingsEntry[] }) {
  if (!standings.length) {
    return (
      <View className="items-center py-12">
        <Text className="text-3xl mb-2">📊</Text>
        <Text className="text-gray-400">No standings yet. Generate fixtures first.</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Header */}
      <View className="flex-row bg-gray-100 rounded-xl px-3 py-2 mb-2">
        <Text className="flex-1 text-xs font-bold text-gray-500">Team</Text>
        {['P', 'W', 'L', 'T', 'Pts', 'NRR'].map((h) => (
          <Text key={h} className="w-9 text-xs font-bold text-gray-500 text-center">{h}</Text>
        ))}
      </View>
      {standings.map((row, idx) => {
        const team = row.teamId as any;
        const name = typeof team === 'object' ? team.name : row.teamName;
        return (
          <View
            key={String(typeof team === 'object' ? team._id : team)}
            className={`flex-row items-center px-3 py-3 rounded-xl mb-1 ${idx < 3 ? 'bg-white shadow-sm' : 'bg-white/60'}`}
          >
            <Text className={`w-6 text-sm font-bold mr-2 ${
              idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-600' : 'text-gray-500'
            }`}>
              {idx + 1}
            </Text>
            <Text className="flex-1 text-sm font-semibold text-gray-800" numberOfLines={1}>{name}</Text>
            {[row.played, row.won, row.lost, row.tied, row.points].map((v, vi) => (
              <Text key={vi} className={`w-9 text-sm text-center ${vi === 4 ? 'font-bold text-primary' : 'text-gray-600'}`}>
                {v}
              </Text>
            ))}
            <Text className={`w-9 text-xs text-center font-semibold ${row.nrr >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {row.nrr >= 0 ? '+' : ''}{row.nrr.toFixed(2)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function FixturesTab({ fixtures, isOrganizer, onUpdateFixture }: {
  fixtures: Fixture[];
  isOrganizer: boolean;
  onUpdateFixture?: () => void;
}) {
  if (!fixtures.length) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 52 }}>
        <Text style={{ fontSize: 52, marginBottom: 12 }}>📅</Text>
        <Text style={{ fontWeight: '700', color: '#374151', fontSize: 16, marginBottom: 6 }}>No Fixtures Yet</Text>
        <Text style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center' }}>
          Go to Overview tab and tap "Generate Fixtures" to create the schedule.
        </Text>
      </View>
    );
  }

  const grouped: Record<number, Fixture[]> = {};
  fixtures.forEach((f) => {
    if (!grouped[f.round]) grouped[f.round] = [];
    grouped[f.round].push(f);
  });

  const getStageLabel = (f: Fixture) => {
    if (f.stage === 'final') return '🏆 Final';
    if (f.stage === 'semi_final') return '⚔️ Semi Finals';
    if (f.stage === 'quarter_final') return '🎯 Quarter Finals';
    if (f.stage === 'third_place') return '🥉 Third Place';
    if (f.group) return `Group ${f.group}`;
    return `Round ${f.round}`;
  };

  const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
    scheduled:   { bg: '#F3F4F6', color: '#6B7280',  label: 'Scheduled' },
    in_progress: { bg: '#DBEAFE', color: '#2563EB',  label: 'Live' },
    completed:   { bg: '#DCFCE7', color: '#16A34A',  label: 'Completed' },
    cancelled:   { bg: '#FEE2E2', color: '#DC2626',  label: 'Cancelled' },
  };

  return (
    <View>
      {Object.keys(grouped).sort((a, b) => +a - +b).map((round) => {
        const roundFixtures = grouped[+round];
        const stageLabel = getStageLabel(roundFixtures[0]);

        return (
          <View key={round} style={{ marginBottom: 24 }}>
            {/* Round header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 0.8 }}>
                {stageLabel.toUpperCase()}
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: '#E5E7EB' }} />
            </View>

            {roundFixtures.map((f) => {
              const match = f.matchId as any;
              const ss = statusStyles[f.status] || statusStyles.scheduled;
              const isLive = f.status === 'in_progress';
              const isCompleted = f.status === 'completed';
              const teamA = f.teamA as any;
              const teamB = f.teamB as any;

              return (
                <TouchableOpacity
                  key={f._id}
                  onPress={() => match?._id ? router.push(`/match/${match._id}/live` as any) : null}
                  activeOpacity={match?._id ? 0.75 : 1}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 18,
                    marginBottom: 12,
                    shadowColor: '#000',
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    elevation: 3,
                    borderWidth: isLive ? 1.5 : 0,
                    borderColor: isLive ? '#2563EB' : 'transparent',
                  }}
                >
                  {/* Status bar */}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 14, paddingVertical: 9,
                    backgroundColor: isLive ? '#EFF6FF' : '#FAFAFA',
                    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
                    borderTopLeftRadius: 18, borderTopRightRadius: 18,
                  }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {isLive && (
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#2563EB' }} />
                      )}
                      <View style={{ backgroundColor: ss.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                        <Text style={{ color: ss.color, fontSize: 11, fontWeight: '700' }}>{ss.label}</Text>
                      </View>
                    </View>
                    {f.scheduledAt ? (
                      <Text style={{ color: '#9CA3AF', fontSize: 11 }}>
                        {new Date(f.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' · '}
                        {new Date(f.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    ) : (
                      <Text style={{ color: '#D1D5DB', fontSize: 11 }}>Date TBD</Text>
                    )}
                  </View>

                  {/* Teams + scores */}
                  <View style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
                    {/* Team A */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                      <View style={{
                        width: 38, height: 38, borderRadius: 19,
                        backgroundColor: (teamA?.color || '#1E3A5F') + '20',
                        alignItems: 'center', justifyContent: 'center', marginRight: 10,
                      }}>
                        <Text style={{ fontWeight: '900', fontSize: 11, color: teamA?.color || '#1E3A5F' }}>
                          {teamA?.shortName || teamA?.name?.slice(0, 2)?.toUpperCase() || 'A'}
                        </Text>
                      </View>
                      <Text style={{ flex: 1, fontWeight: '700', color: '#111827', fontSize: 14 }} numberOfLines={1}>
                        {teamA?.name || 'Team A'}
                      </Text>
                      {f.result?.scoreA ? (
                        <Text style={{ fontWeight: '900', color: '#111827', fontSize: 16 }}>{f.result.scoreA}</Text>
                      ) : (
                        <Text style={{ color: '#D1D5DB', fontSize: 16 }}>—</Text>
                      )}
                    </View>

                    {/* VS divider */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                      <View style={{ flex: 1, height: 1, backgroundColor: '#F3F4F6' }} />
                      <View style={{
                        marginHorizontal: 10, backgroundColor: '#F9FAFB',
                        borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3,
                      }}>
                        <Text style={{ color: '#9CA3AF', fontSize: 11, fontWeight: '700' }}>VS</Text>
                      </View>
                      <View style={{ flex: 1, height: 1, backgroundColor: '#F3F4F6' }} />
                    </View>

                    {/* Team B */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{
                        width: 38, height: 38, borderRadius: 19,
                        backgroundColor: (teamB?.color || '#7C3AED') + '20',
                        alignItems: 'center', justifyContent: 'center', marginRight: 10,
                      }}>
                        <Text style={{ fontWeight: '900', fontSize: 11, color: teamB?.color || '#7C3AED' }}>
                          {teamB?.shortName || teamB?.name?.slice(0, 2)?.toUpperCase() || 'B'}
                        </Text>
                      </View>
                      <Text style={{ flex: 1, fontWeight: '700', color: '#111827', fontSize: 14 }} numberOfLines={1}>
                        {teamB?.name || 'Team B'}
                      </Text>
                      {f.result?.scoreB ? (
                        <Text style={{ fontWeight: '900', color: '#111827', fontSize: 16 }}>{f.result.scoreB}</Text>
                      ) : (
                        <Text style={{ color: '#D1D5DB', fontSize: 16 }}>—</Text>
                      )}
                    </View>
                  </View>

                  {/* Footer: winner or tap CTA */}
                  <View style={{
                    paddingHorizontal: 14, paddingVertical: 10,
                    backgroundColor: '#F9FAFB',
                    borderTopWidth: 1, borderTopColor: '#F3F4F6',
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
                  }}>
                    {isCompleted && (f.result?.winner as any)?.name ? (
                      <Text style={{ color: '#16A34A', fontSize: 12, fontWeight: '700' }}>
                        🏆 {(f.result!.winner as any).name} won
                      </Text>
                    ) : isCompleted ? (
                      <Text style={{ color: '#16A34A', fontSize: 12, fontWeight: '600' }}>Match completed</Text>
                    ) : match?._id ? (
                      <Text style={{ color: '#9CA3AF', fontSize: 12 }}>Tap to view match</Text>
                    ) : (
                      <Text style={{ color: '#D1D5DB', fontSize: 12 }}>Match not created yet</Text>
                    )}
                    {match?._id && (
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function TeamsTab({
  tournament, isOrganizer, onAddTeam, onRemoveTeam, onApprove, onReject,
}: {
  tournament: Tournament;
  isOrganizer: boolean;
  onAddTeam: () => void;
  onRemoveTeam: (teamId: string, name: string) => void;
  onApprove: (reqId: string) => void;
  onReject: (reqId: string) => void;
}) {
  const pendingRequests = tournament.teamRequests?.filter((r) => r.status === 'pending') || [];

  return (
    <View>
      {/* Pending requests (organizer only) */}
      {isOrganizer && pendingRequests.length > 0 && (
        <View className="mb-4">
          <Text className="text-sm font-bold text-orange-600 mb-2">Pending Requests ({pendingRequests.length})</Text>
          {pendingRequests.map((req) => (
            <View key={req._id} className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-2">
              <Text className="font-semibold text-gray-800">{typeof req.teamId === 'object' ? req.teamId.name : req.teamName}</Text>
              <Text className="text-xs text-gray-400">Requested by {req.requestedBy?.name}</Text>
              <View className="flex-row gap-2 mt-2">
                <TouchableOpacity
                  className="flex-1 bg-green-600 rounded-lg py-2 items-center"
                  onPress={() => onApprove(req._id)}
                >
                  <Text className="text-white text-xs font-bold">Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-red-100 rounded-lg py-2 items-center"
                  onPress={() => onReject(req._id)}
                >
                  <Text className="text-red-600 text-xs font-bold">Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Registered teams */}
      <Text className="text-sm font-bold text-gray-500 uppercase mb-2">
        Registered Teams ({tournament.teams.length}/{tournament.maxTeams})
      </Text>
      {tournament.teams.map((team: any) => (
        <View key={team._id} className="flex-row items-center bg-white rounded-xl px-4 py-3 mb-2 shadow-sm">
          <View
            className="w-10 h-10 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: (team.color || '#1E3A5F') + '20' }}
          >
            <Text className="font-bold text-xs" style={{ color: team.color || '#1E3A5F' }}>
              {team.shortName}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-gray-800">{team.name}</Text>
            <Text className="text-xs text-gray-400">{team.players?.length || 0} players</Text>
          </View>
          {isOrganizer && (
            <TouchableOpacity
              className="p-2"
              onPress={() => onRemoveTeam(team._id, team.name)}
            >
              <Ionicons name="close-circle" size={20} color="#DC2626" />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {tournament.teams.length === 0 && (
        <View className="items-center py-8">
          <Text className="text-3xl mb-2">👥</Text>
          <Text className="text-gray-400">No teams yet</Text>
        </View>
      )}

      {isOrganizer && tournament.teams.length < tournament.maxTeams && (
        <TouchableOpacity
          className="border-2 border-dashed border-gray-300 rounded-xl py-4 items-center mt-2"
          onPress={onAddTeam}
        >
          <Ionicons name="add-circle-outline" size={24} color="#9CA3AF" />
          <Text className="text-gray-400 font-semibold mt-1">Add Team</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Add Team Modal ──────────────────────────────────────────
function AddTeamModal({
  visible, teams, onClose, onAdd,
}: {
  visible: boolean;
  teams: any[];
  onClose: () => void;
  onAdd: (teamId: string) => void;
}) {
  const [search, setSearch] = useState('');

  if (!visible) return null;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? teams.filter((t) => {
        const ownerName  = typeof t.createdBy === 'object' ? (t.createdBy?.name  || '') : '';
        const ownerEmail = typeof t.createdBy === 'object' ? (t.createdBy?.email || '') : '';
        const ownerPhone = typeof t.createdBy === 'object' ? (t.createdBy?.phone || '') : '';
        return (
          (t.name || '').toLowerCase().includes(q)
          || ownerName.toLowerCase().includes(q)
          || ownerEmail.toLowerCase().includes(q)
          || ownerPhone.toLowerCase().includes(q)
        );
      })
    : teams;

  return (
    <View className="absolute inset-0 bg-black/50 z-50 justify-end">
      <View className="bg-white rounded-t-3xl p-5" style={{ maxHeight: '72%' }}>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-bold text-gray-800">Select Team</Text>
          <TouchableOpacity onPress={() => { setSearch(''); onClose(); }}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Search field */}
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5 mb-3 gap-2">
          <Ionicons name="search" size={16} color="#9CA3AF" />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: '#111827' }}
            placeholder="Search by name, owner, email or phone..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView keyboardShouldPersistTaps="handled">
          {filtered.map((team) => {
            const ownerName = typeof team.createdBy === 'object' ? team.createdBy?.name : '';
            return (
              <TouchableOpacity
                key={team._id}
                className="flex-row items-center py-3 border-b border-gray-100"
                onPress={() => { setSearch(''); onAdd(team._id); }}
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: (team.color || '#1E3A5F') + '20' }}
                >
                  <Text className="font-bold text-xs" style={{ color: team.color || '#1E3A5F' }}>
                    {team.shortName}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-gray-800">{team.name}</Text>
                  <Text className="text-xs text-gray-400">
                    {ownerName ? `${ownerName} · ` : ''}{team.players?.length || 0} players
                  </Text>
                </View>
                <Ionicons name="add-circle" size={22} color="#1E3A5F" />
              </TouchableOpacity>
            );
          })}

          {filtered.length === 0 && (
            <View className="items-center py-8">
              {q ? (
                <>
                  <Text className="text-3xl mb-2">🔍</Text>
                  <Text className="text-gray-400">No teams match "{search}"</Text>
                </>
              ) : (
                <>
                  <Text className="text-gray-400">No teams available. Create a team first.</Text>
                  <TouchableOpacity className="mt-3" onPress={() => { setSearch(''); onClose(); router.push('/team/create' as any); }}>
                    <Text className="text-primary font-bold">Create Team →</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────
export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const {
    currentTournament: tournament, fetchTournament, standings, fetchStandings,
    generateFixtures, deleteFixtures, registerTeam, removeTeam,
    approveRequest, rejectRequest, updateTournament, isLoading,
  } = useTournamentStore();
  const { teams, fetchTeams } = useTeamStore();

  const [activeTab, setActiveTab] = useState('Overview');
  const [addTeamVisible, setAddTeamVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(() => {
    fetchTournament(id!);
    fetchStandings(id!);
  }, [id]);

  useEffect(() => {
    load();
    fetchTeams();
  }, [id]);

  const isOrganizer = tournament?.createdBy?._id === user?._id || tournament?.createdBy === user?._id;

  const handleGenerateFixtures = async () => {
    if (tournament!.fixtures.length) {
      Alert.alert('Fixtures exist', 'Delete existing fixtures and regenerate?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete & Regenerate', style: 'destructive', onPress: async () => {
            setActionLoading(true);
            try {
              await deleteFixtures(id!);
              await generateFixtures(id!);
              Alert.alert('Done', 'Fixtures regenerated!');
            } catch (err: any) { Alert.alert('Error', err.message); }
            finally { setActionLoading(false); }
          },
        },
      ]);
      return;
    }
    setActionLoading(true);
    try {
      await generateFixtures(id!);
      Alert.alert('Done', 'Fixtures generated!');
      setActiveTab('Fixtures');
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setActionLoading(false); }
  };

  const handleStateChange = async (newState: string) => {
    setActionLoading(true);
    try {
      await updateTournament(id!, { state: newState });
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setActionLoading(false); }
  };

  const handleAddTeam = async (teamId: string) => {
    setAddTeamVisible(false);
    setActionLoading(true);
    try {
      await registerTeam(id!, teamId);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setActionLoading(false); }
  };

  const handleRemoveTeam = (teamId: string, name: string) => {
    Alert.alert('Remove Team', `Remove ${name} from this tournament?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          setActionLoading(true);
          try { await removeTeam(id!, teamId); }
          catch (err: any) { Alert.alert('Error', err.message); }
          finally { setActionLoading(false); }
        },
      },
    ]);
  };

  const handleApprove = async (reqId: string) => {
    setActionLoading(true);
    try { await approveRequest(id!, reqId); }
    catch (err: any) { Alert.alert('Error', err.message); }
    finally { setActionLoading(false); }
  };

  const handleReject = async (reqId: string) => {
    setActionLoading(true);
    try { await rejectRequest(id!, reqId); }
    catch (err: any) { Alert.alert('Error', err.message); }
    finally { setActionLoading(false); }
  };

  if (isLoading && !tournament) {
    return (
      <SafeAreaView className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator size="large" color="#F4A200" />
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView className="flex-1 bg-primary items-center justify-center">
        <Text className="text-white">Tournament not found</Text>
      </SafeAreaView>
    );
  }

  const stateColor = STATE_COLORS[tournament.state] || '#6B7280';
  const stateLabel = STATE_LABELS[tournament.state] || tournament.state;

  // Filter out teams already in tournament for add modal
  const availableTeams = teams.filter(
    (t) => !tournament.teams.some((tt: any) => (typeof tt === 'object' ? tt._id : tt) === t._id),
  );

  const currentStateIdx = LIFECYCLE_STATES.indexOf(tournament.state);

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-3 pb-4">
        <View className="flex-row items-center mb-2">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold ml-3 flex-1" numberOfLines={1}>
            {tournament.name}
          </Text>
          <View className="px-2 py-1 rounded-full" style={{ backgroundColor: stateColor + '30' }}>
            <Text className="text-xs font-bold" style={{ color: 'white' }}>{stateLabel}</Text>
          </View>
        </View>

        {/* Quick stats */}
        <View className="flex-row gap-3">
          <View className="flex-row items-center gap-1">
            <Ionicons name="people" size={13} color="#93C5FD" />
            <Text className="text-blue-200 text-xs">{tournament.teams.length}/{tournament.maxTeams} teams</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="calendar" size={13} color="#93C5FD" />
            <Text className="text-blue-200 text-xs">{tournament.matchFormat} · {tournament.totalOvers}ov</Text>
          </View>
          {tournament.venue ? (
            <View className="flex-row items-center gap-1">
              <Ionicons name="location" size={13} color="#93C5FD" />
              <Text className="text-blue-200 text-xs" numberOfLines={1}>{tournament.venue}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-white/10 mx-4 rounded-xl p-1 mb-1">
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? 'bg-white' : ''}`}
            onPress={() => setActiveTab(tab)}
          >
            <Text className={`text-xs font-bold ${activeTab === tab ? 'text-primary' : 'text-white/70'}`}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1 bg-surface rounded-t-2xl"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
      >
        {/* Overview Tab */}
        {activeTab === 'Overview' && (
          <View>
            {/* Info card */}
            <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
              <Text className="font-bold text-gray-700 mb-3">Tournament Info</Text>
              {[
                { label: 'Format', value: tournament.format?.replace('_', ' ') },
                { label: 'Match Format', value: tournament.matchFormat },
                { label: 'Overs', value: String(tournament.totalOvers) },
                { label: 'Max Teams', value: String(tournament.maxTeams) },
                tournament.prizePool ? { label: 'Prize Pool', value: tournament.prizePool } : null,
                tournament.startDate ? { label: 'Start', value: new Date(tournament.startDate).toDateString() } : null,
                tournament.endDate ? { label: 'End', value: new Date(tournament.endDate).toDateString() } : null,
              ].filter(Boolean).map((item: any) => (
                <View key={item.label} className="flex-row justify-between py-1.5 border-b border-gray-50">
                  <Text className="text-gray-500 text-sm capitalize">{item.label}</Text>
                  <Text className="text-gray-800 text-sm font-semibold capitalize">{item.value}</Text>
                </View>
              ))}
            </View>

            {/* Description */}
            {tournament.description ? (
              <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
                <Text className="font-bold text-gray-700 mb-1">About</Text>
                <Text className="text-gray-600 text-sm leading-5">{tournament.description}</Text>
              </View>
            ) : null}

            {/* Organizer actions */}
            {isOrganizer && (
              <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
                <Text className="font-bold text-gray-700 mb-3">Manage</Text>

                {/* State progression */}
                <Text className="text-xs text-gray-400 mb-2">Tournament Status</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                  <View className="flex-row gap-2">
                    {LIFECYCLE_STATES.map((s, idx) => {
                      const isCurrent = tournament.state === s;
                      const isNext = idx === currentStateIdx + 1;
                      const isPast = idx < currentStateIdx;
                      return (
                        <TouchableOpacity
                          key={s}
                          disabled={!isNext || actionLoading}
                          className={`px-3 py-2 rounded-lg border ${
                            isCurrent ? 'bg-primary border-primary' :
                            isPast ? 'bg-green-50 border-green-200' :
                            isNext ? 'bg-white border-gray-300' : 'bg-gray-50 border-gray-100'
                          }`}
                          onPress={() => isNext && handleStateChange(s)}
                        >
                          <Text className={`text-xs font-bold ${
                            isCurrent ? 'text-white' : isPast ? 'text-green-700' : isNext ? 'text-gray-700' : 'text-gray-400'
                          }`}>
                            {isPast ? '✓ ' : ''}{LIFECYCLE_LABELS[idx]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Generate fixtures */}
                <TouchableOpacity
                  className={`flex-row items-center justify-center gap-2 rounded-xl py-3 ${
                    actionLoading ? 'bg-primary/50' : 'bg-primary'
                  }`}
                  onPress={handleGenerateFixtures}
                  disabled={actionLoading}
                >
                  {actionLoading
                    ? <ActivityIndicator color="white" size="small" />
                    : <Ionicons name="calendar" size={18} color="white" />}
                  <Text className="text-white font-bold">
                    {tournament.fixtures.length ? 'Regenerate Fixtures' : 'Generate Fixtures'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Rules */}
            {tournament.rules ? (
              <View className="bg-white rounded-2xl p-4 shadow-sm">
                <Text className="font-bold text-gray-700 mb-1">Rules</Text>
                <Text className="text-gray-600 text-sm leading-5">{tournament.rules}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Standings Tab */}
        {activeTab === 'Standings' && <StandingsTab standings={standings} />}

        {/* Fixtures Tab */}
        {activeTab === 'Fixtures' && (
          <FixturesTab fixtures={tournament.fixtures} isOrganizer={isOrganizer} />
        )}

        {/* Teams Tab */}
        {activeTab === 'Teams' && (
          <TeamsTab
            tournament={tournament}
            isOrganizer={isOrganizer}
            onAddTeam={() => setAddTeamVisible(true)}
            onRemoveTeam={handleRemoveTeam}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </ScrollView>

      {/* Add Team Modal */}
      <AddTeamModal
        visible={addTeamVisible}
        teams={availableTeams}
        onClose={() => setAddTeamVisible(false)}
        onAdd={handleAddTeam}
      />
    </SafeAreaView>
  );
}
