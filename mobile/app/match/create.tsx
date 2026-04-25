import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMatchStore } from '@store/matchStore';
import { useTeamStore } from '@store/teamStore';
import DatePickerField from '@components/ui/DatePickerField';
import { useAuthStore } from '@store/authStore';
import { api } from '@services/api';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface SquadPlayer { userId: string; name: string; role: string; jerseyNumber?: number | null; }
interface RoleMap { captain: string | null; wk: string | null; sub12: string | null; }

type Step =
  | 'select_teams'
  | 'select_team_a' | 'squad_a' | 'roles_a'
  | 'select_team_b' | 'squad_b' | 'roles_b'
  | 'match_details';

const FORMATS = ['T20', 'ODI', 'T10', 'Custom'];
const DEFAULT_OVERS: Record<string, string> = { T20: '20', ODI: '50', T10: '10', Custom: '10' };

// ─────────────────────────────────────────────
// TeamSelectView — 3 tabs: Your teams / Opponents / Add
// ─────────────────────────────────────────────
function TeamSelectView({
  label, onSelect, onBack,
}: {
  label: string;
  onSelect: (team: any) => void;
  onBack: () => void;
}) {
  const { user } = useAuthStore();
  const { createTeam } = useTeamStore();
  const [tab, setTab] = useState<'mine' | 'opponents' | 'add'>('mine');
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Add team form
  const [addForm, setAddForm] = useState({ name: '', city: '', captainPhone: '', captainName: '' });
  const [addSelf, setAddSelf] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/teams', { limit: '100' })
      .then((res: any) => setAllTeams(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const myTeams = allTeams.filter((t: any) =>
    (typeof t.createdBy === 'object' ? t.createdBy._id : t.createdBy) === user?._id
  );
  const opponentTeams = allTeams.filter((t: any) =>
    (typeof t.createdBy === 'object' ? t.createdBy._id : t.createdBy) !== user?._id
  );

  const filterList = (list: any[]) =>
    search.trim()
      ? list.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
      : list;

  const handleAddTeam = async () => {
    if (!addForm.name.trim()) { Alert.alert('Error', 'Team name is required'); return; }
    setAddLoading(true);
    try {
      const team = await createTeam({
        name: addForm.name.trim(),
        shortName: addForm.name.trim().slice(0, 3).toUpperCase(),
        color: '#1E3A5F',
      });
      setAllTeams((prev) => [team, ...prev]);
      onSelect(team);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const TeamItem = ({ team }: { team: any }) => {
    const captain = team.players?.find((p: any) => p.isCaptain);
    const initial = team.shortName || team.name?.slice(0, 2).toUpperCase();
    return (
      <TouchableOpacity
        className="flex-row items-center px-4 py-3 border-b border-gray-100"
        onPress={() => onSelect(team)}
        activeOpacity={0.7}
      >
        <View
          className="w-12 h-12 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: (team.color || '#1E3A5F') + '25' }}
        >
          <Text className="font-black text-sm" style={{ color: team.color || '#1E3A5F' }}>
            {initial}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-bold text-gray-800">{team.name}</Text>
          {captain && <Text className="text-xs text-gray-400">C: {captain.name}</Text>}
          <Text className="text-xs text-gray-400">{team.players?.length || 0} players</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
        <TouchableOpacity onPress={onBack} className="mr-3">
          <Ionicons name="arrow-back" size={22} color="#1E3A5F" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800 flex-1">Select {label}</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-200">
        {([['mine', 'Your teams'], ['opponents', 'Opponents'], ['add', 'Add']] as const).map(([k, l]) => (
          <TouchableOpacity
            key={k}
            className={`flex-1 py-3 items-center border-b-2 ${tab === k ? 'border-red-500' : 'border-transparent'}`}
            onPress={() => setTab(k)}
          >
            <Text className={`text-sm font-semibold ${tab === k ? 'text-gray-900' : 'text-gray-400'}`}>
              {l}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab !== 'add' && (
        <View className="flex-row items-center bg-gray-100 mx-4 mt-3 rounded-xl px-3 py-2 gap-2 mb-1">
          <Ionicons name="search" size={16} color="#9CA3AF" />
          <TextInput
            className="flex-1 text-gray-800 text-sm"
            placeholder="Quick search"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      )}

      {/* Content */}
      {tab === 'mine' && (
        <FlatList
          data={filterList(myTeams)}
          keyExtractor={(t) => t._id}
          renderItem={({ item }) => <TeamItem team={item} />}
          ListEmptyComponent={
            loading ? <ActivityIndicator className="mt-8" color="#1E3A5F" /> : (
              <View className="items-center py-12">
                <Text className="text-gray-400">No teams yet.</Text>
                <TouchableOpacity className="mt-2" onPress={() => setTab('add')}>
                  <Text className="text-primary font-bold">Create one →</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}

      {tab === 'opponents' && (
        <FlatList
          data={filterList(opponentTeams)}
          keyExtractor={(t) => t._id}
          renderItem={({ item }) => (
            <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
              <View
                className="w-12 h-12 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: (item.color || '#1E3A5F') + '25' }}
              >
                <Text className="font-black text-sm" style={{ color: item.color || '#1E3A5F' }}>
                  {item.shortName || item.name?.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="font-bold text-gray-800">{item.name}</Text>
                {item.players?.find((p: any) => p.isCaptain) && (
                  <Text className="text-xs text-gray-400">C: {item.players.find((p: any) => p.isCaptain).name}</Text>
                )}
                <Text className="text-xs text-gray-400">{item.players?.length || 0} players</Text>
              </View>
              <TouchableOpacity
                className="bg-primary/10 px-3 py-1.5 rounded-full"
                onPress={() => onSelect(item)}
              >
                <Text className="text-primary text-xs font-bold">Members</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            loading ? <ActivityIndicator className="mt-8" color="#1E3A5F" /> : (
              <View className="items-center py-12">
                <Text className="text-gray-400">No opponent teams found</Text>
              </View>
            )
          }
        />
      )}

      {tab === 'add' && (
        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
          {/* Team logo placeholder */}
          <View className="items-center mb-5">
            <View className="w-20 h-20 rounded-full bg-gray-200 items-center justify-center">
              <Ionicons name="add" size={28} color="#9CA3AF" />
            </View>
            <Text className="text-sm text-gray-400 mt-1">Team logo</Text>
          </View>

          <Text className="text-xs font-bold text-primary mb-1">Team name *</Text>
          <TextInput
            className="border-b border-gray-300 py-2 text-base mb-4 text-gray-800"
            placeholder="Enter team name"
            value={addForm.name}
            onChangeText={(v) => setAddForm((f) => ({ ...f, name: v }))}
            autoCapitalize="words"
          />

          <Text className="text-xs font-bold text-gray-400 mb-1">City / town *</Text>
          <TextInput
            className="border-b border-gray-300 py-2 text-base mb-4 text-gray-800"
            placeholder="Hyderabad (Telangana)"
            value={addForm.city}
            onChangeText={(v) => setAddForm((f) => ({ ...f, city: v }))}
          />

          <Text className="text-xs font-bold text-gray-400 mb-1">Team captain/coordinator number (optional)</Text>
          <View className="flex-row items-center border-b border-gray-300 mb-4">
            <Text className="text-gray-500 mr-2">+91</Text>
            <TextInput
              className="flex-1 py-2 text-base text-gray-800"
              placeholder="Phone number"
              value={addForm.captainPhone}
              onChangeText={(v) => setAddForm((f) => ({ ...f, captainPhone: v }))}
              keyboardType="phone-pad"
            />
          </View>

          <Text className="text-xs font-bold text-gray-400 mb-1">Team captain name (optional)</Text>
          <TextInput
            className="border-b border-gray-300 py-2 text-base mb-5 text-gray-800"
            placeholder="Captain name"
            value={addForm.captainName}
            onChangeText={(v) => setAddForm((f) => ({ ...f, captainName: v }))}
          />

          <TouchableOpacity
            className="flex-row items-center gap-2 mb-8"
            onPress={() => setAddSelf(!addSelf)}
          >
            <View
              className={`w-5 h-5 rounded border-2 items-center justify-center ${addSelf ? 'bg-primary border-primary' : 'border-gray-400'}`}
            >
              {addSelf && <Ionicons name="checkmark" size={12} color="white" />}
            </View>
            <Text className="text-gray-700">Add yourself in the team</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`rounded-none py-4 items-center ${addLoading ? 'bg-primary/50' : 'bg-primary'}`}
            style={{ marginHorizontal: -16 }}
            onPress={handleAddTeam}
            disabled={addLoading}
          >
            {addLoading ? <ActivityIndicator color="white" /> : (
              <Text className="text-white font-bold text-base">Add team</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// SquadSelectView
// ─────────────────────────────────────────────
function SquadSelectView({
  team, selectedIds, onToggle, onNext, onBack,
}: {
  team: any;
  selectedIds: Set<string>;
  onToggle: (p: SquadPlayer) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [search, setSearch] = useState('');
  const players: any[] = team?.players || [];
  const filtered = search
    ? players.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : players;

  const selectAll = () => players.forEach((p) => {
    if (!selectedIds.has(p.userId?.toString() || p._id)) onToggle(p);
  });

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
        <TouchableOpacity onPress={onBack} className="mr-3">
          <Ionicons name="arrow-back" size={22} color="#1E3A5F" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800 flex-1">{team?.name}</Text>
        <TouchableOpacity onPress={selectAll}>
          <Text className="text-primary text-sm font-bold">Same squad</Text>
        </TouchableOpacity>
      </View>

      <View className="px-4 py-2 flex-row items-center justify-between border-b border-gray-100">
        <Text className="text-sm font-bold text-gray-700">
          Select squad ({selectedIds.size})
        </Text>
      </View>

      <View className="flex-row items-center bg-gray-100 mx-4 mt-3 rounded-xl px-3 py-2 gap-2 mb-2">
        <Ionicons name="search" size={16} color="#9CA3AF" />
        <TextInput
          className="flex-1 text-gray-800 text-sm"
          placeholder="Quick search"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => p._id || p.userId}
        renderItem={({ item: player }) => {
          const uid = player.userId?.toString() || player._id;
          const selected = selectedIds.has(uid);
          return (
            <TouchableOpacity
              className={`flex-row items-center px-4 py-3 border-b border-gray-100 ${selected ? 'bg-primary/5' : 'bg-white'}`}
              onPress={() => onToggle({
                userId: uid,
                name: player.name,
                role: player.role || 'batsman',
                jerseyNumber: player.jerseyNumber,
              })}
            >
              <View
                className={`w-11 h-11 rounded-full items-center justify-center mr-3 ${selected ? 'bg-primary' : 'bg-gray-200'}`}
              >
                {selected
                  ? <Ionicons name="checkmark" size={20} color="white" />
                  : <Text className="font-bold text-gray-600 text-sm">{player.name?.charAt(0)?.toUpperCase()}</Text>}
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-gray-800">{player.name}</Text>
                <Text className="text-xs text-green-600">Played last match</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View className="items-center py-10">
            <Text className="text-gray-400">No players in this team yet</Text>
            <Text className="text-gray-400 text-xs mt-1">Add players from the Team screen first</Text>
          </View>
        }
      />

      {/* Bottom Next */}
      <TouchableOpacity
        className="bg-primary py-4 items-center"
        onPress={onNext}
      >
        <Text className="text-white font-bold text-base">Next</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────
// RoleAssignView — Captain / WK / 12th Man
// ─────────────────────────────────────────────
function RoleAssignView({
  team, squad, roles, onSetRole, onNext, onBack,
}: {
  team: any;
  squad: SquadPlayer[];
  roles: RoleMap;
  onSetRole: (role: keyof RoleMap, uid: string | null) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [activeRole, setActiveRole] = useState<keyof RoleMap>('captain');
  const [search, setSearch] = useState('');

  const ROLE_TABS: { key: keyof RoleMap; label: string }[] = [
    { key: 'captain', label: 'Captain' },
    { key: 'wk', label: 'Wicket keeper' },
    { key: 'sub12', label: '12th Man' },
  ];

  const filteredSquad = search
    ? squad.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : squad;

  const currentSelected = roles[activeRole];

  const handleNext = () => {
    const idx = ROLE_TABS.findIndex((t) => t.key === activeRole);
    if (idx < ROLE_TABS.length - 1) {
      setActiveRole(ROLE_TABS[idx + 1].key);
      setSearch('');
    } else {
      onNext();
    }
  };

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
        <TouchableOpacity onPress={onBack} className="mr-3">
          <Ionicons name="arrow-back" size={22} color="#1E3A5F" />
        </TouchableOpacity>
        <Text className="text-sm font-bold text-gray-600 flex-1" numberOfLines={1}>
          {team?.name} – captain, keeper, substitute
        </Text>
        <Text className="text-primary text-sm font-bold">{team?.shortName}</Text>
      </View>

      {/* Role tabs */}
      <View className="flex-row gap-2 px-4 py-3">
        {ROLE_TABS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            className={`px-4 py-2 rounded-full border ${activeRole === key ? 'bg-primary border-primary' : 'border-gray-300'}`}
            onPress={() => { setActiveRole(key); setSearch(''); }}
          >
            <Text className={`text-xs font-bold ${activeRole === key ? 'text-white' : 'text-gray-500'}`}>
              {label}
              {roles[key] ? ' ✓' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="flex-row items-center bg-gray-100 mx-4 rounded-xl px-3 py-2 gap-2 mb-1">
        <Ionicons name="search" size={16} color="#9CA3AF" />
        <TextInput
          className="flex-1 text-gray-800 text-sm"
          placeholder="Quick search"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredSquad}
        keyExtractor={(p) => p.userId}
        renderItem={({ item: player }) => {
          const isSelected = currentSelected === player.userId;
          return (
            <TouchableOpacity
              className={`flex-row items-center px-4 py-3 border-b border-gray-100 ${isSelected ? 'bg-primary/5' : ''}`}
              onPress={() => onSetRole(activeRole, isSelected ? null : player.userId)}
            >
              <View
                className={`w-11 h-11 rounded-full items-center justify-center mr-3 ${isSelected ? 'bg-primary' : 'bg-gray-200'}`}
              >
                {isSelected
                  ? <Ionicons name="checkmark" size={20} color="white" />
                  : <Text className="font-bold text-gray-600 text-sm">{player.name?.charAt(0)?.toUpperCase()}</Text>}
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-gray-800">{player.name}</Text>
                <Text className="text-xs text-green-600">Played last match</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        className="bg-primary py-4 items-center"
        onPress={handleNext}
      >
        <Text className="text-white font-bold text-base">
          {ROLE_TABS.findIndex((t) => t.key === activeRole) < ROLE_TABS.length - 1 ? 'Next' : 'Done'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────
// MatchDetailsView
// ─────────────────────────────────────────────
function MatchDetailsView({
  teamA, teamB, details, onChange, onSubmit, onBack, loading,
}: {
  teamA: any; teamB: any;
  details: { format: string; totalOvers: string; venue: string; date: string; time: string; title: string };
  onChange: (k: string, v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const autoTitle = teamA && teamB ? `${teamA.shortName || teamA.name} vs ${teamB.shortName || teamB.name}` : '';

  useEffect(() => {
    if (!details.title && autoTitle) onChange('title', autoTitle);
  }, [autoTitle]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
        <TouchableOpacity onPress={onBack} className="mr-3">
          <Ionicons name="arrow-back" size={22} color="#1E3A5F" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">Match Details</Text>
      </View>

      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
        <View className="py-4">
          {/* Teams preview */}
          <View className="flex-row items-center justify-center gap-4 mb-6 py-4 bg-gray-50 rounded-2xl">
            <View className="items-center flex-1">
              <View className="w-14 h-14 rounded-full items-center justify-center mb-1"
                style={{ backgroundColor: (teamA?.color || '#1E3A5F') + '25' }}>
                <Text className="font-black" style={{ color: teamA?.color || '#1E3A5F' }}>
                  {teamA?.shortName}
                </Text>
              </View>
              <Text className="text-xs font-bold text-gray-700" numberOfLines={1}>{teamA?.name}</Text>
            </View>
            <Text className="text-gray-400 font-bold">vs</Text>
            <View className="items-center flex-1">
              <View className="w-14 h-14 rounded-full items-center justify-center mb-1"
                style={{ backgroundColor: (teamB?.color || '#8B0000') + '25' }}>
                <Text className="font-black" style={{ color: teamB?.color || '#8B0000' }}>
                  {teamB?.shortName}
                </Text>
              </View>
              <Text className="text-xs font-bold text-gray-700" numberOfLines={1}>{teamB?.name}</Text>
            </View>
          </View>

          {/* Match title */}
          <Text className="text-xs font-bold text-gray-500 mb-1">Match Title</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-base mb-4 text-gray-800"
            value={details.title}
            onChangeText={(v) => onChange('title', v)}
            placeholder="Match title"
          />

          {/* Format */}
          <Text className="text-xs font-bold text-gray-500 mb-2">Format</Text>
          <View className="flex-row gap-2 mb-4">
            {FORMATS.map((f) => (
              <TouchableOpacity
                key={f}
                className={`flex-1 py-2.5 rounded-xl items-center border ${
                  details.format === f ? 'bg-primary border-primary' : 'border-gray-200'
                }`}
                onPress={() => {
                  onChange('format', f);
                  onChange('totalOvers', DEFAULT_OVERS[f] ?? '20');
                }}
              >
                <Text className={`font-bold text-sm ${details.format === f ? 'text-white' : 'text-gray-600'}`}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Overs */}
          <Text className="text-xs font-bold text-gray-500 mb-1">Total Overs</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-base mb-4 text-gray-800"
            value={details.totalOvers}
            onChangeText={(v) => onChange('totalOvers', v)}
            keyboardType="number-pad"
          />

          {/* Venue */}
          <Text className="text-xs font-bold text-gray-500 mb-1">Venue</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-base mb-4 text-gray-800"
            value={details.venue}
            onChangeText={(v) => onChange('venue', v)}
            placeholder="e.g. DY Patil Stadium"
          />

          {/* Date */}
          <Text className="text-xs font-bold text-gray-500 mb-1">Match Date</Text>
          <DatePickerField
            label="Select Date"
            value={details.date}
            onChange={(iso) => onChange('date', iso)}
          />

          {/* Time */}
          <Text className="text-xs font-bold text-gray-500 mb-1">Time (HH:MM)</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-base mb-6 text-gray-800"
            value={details.time}
            onChangeText={(v) => onChange('time', v)}
            placeholder="18:00"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </ScrollView>

      <View className="px-4 pb-4 pt-2 border-t border-gray-100">
        <TouchableOpacity
          className={`rounded-2xl py-4 items-center ${loading ? 'bg-primary/50' : 'bg-primary'}`}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="white" />
            : <Text className="text-white font-bold text-lg">Start Match 🏏</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────
export default function CreateMatchScreen() {
  const { createMatch } = useMatchStore();
  const [loading, setLoading] = useState(false);

  // Selected teams
  const [teamA, setTeamA] = useState<any>(null);
  const [teamB, setTeamB] = useState<any>(null);

  // Squads (selected player sets)
  const [squadAIds, setSquadAIds] = useState<Set<string>>(new Set());
  const [squadBIds, setSquadBIds] = useState<Set<string>>(new Set());
  const [squadAPlayers, setSquadAPlayers] = useState<SquadPlayer[]>([]);
  const [squadBPlayers, setSquadBPlayers] = useState<SquadPlayer[]>([]);

  // Roles
  const [rolesA, setRolesA] = useState<RoleMap>({ captain: null, wk: null, sub12: null });
  const [rolesB, setRolesB] = useState<RoleMap>({ captain: null, wk: null, sub12: null });

  // Match details
  const today = new Date().toISOString().slice(0, 10);
  const [details, setDetails] = useState({
    format: 'T20', totalOvers: '20', venue: '', date: today, time: '18:00', title: '',
  });

  const [step, setStep] = useState<Step>('select_teams');

  // Make status bar icons dark since most steps use white/light backgrounds
  useEffect(() => {
    StatusBar.setBarStyle('dark-content', true);
    return () => { StatusBar.setBarStyle('light-content', true); };
  }, []);

  // Squad toggle helpers
  const toggleSquad = (
    ids: Set<string>, _players: SquadPlayer[],
    setIds: React.Dispatch<React.SetStateAction<Set<string>>>,
    setPlayers: React.Dispatch<React.SetStateAction<SquadPlayer[]>>,
    p: SquadPlayer,
  ) => {
    const next = new Set(ids);
    if (next.has(p.userId)) {
      next.delete(p.userId);
      setPlayers((prev) => prev.filter((x) => x.userId !== p.userId));
    } else {
      next.add(p.userId);
      setPlayers((prev) => [...prev, p]);
    }
    setIds(next);
  };

  const setRole = (map: RoleMap, setter: React.Dispatch<React.SetStateAction<RoleMap>>, role: keyof RoleMap, uid: string | null) => {
    setter({ ...map, [role]: uid });
  };

  // Build scheduledAt from date+time
  const buildScheduledAt = () => {
    const rawDate = (details.date || today).trim().replace(/\//g, '-');
    const time = (details.time || '18:00').trim().replace(/[^0-9:]/g, '');
    const iso = `${rawDate}T${time.length >= 4 ? time : '18:00'}:00`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const handleSubmit = async () => {
    if (!teamA || !teamB) { Alert.alert('Select both teams'); return; }
    if (!details.title.trim()) { Alert.alert('Match title required'); return; }
    if (teamA._id === teamB._id) { Alert.alert('Teams must be different'); return; }

    setLoading(true);
    try {
      const match = await createMatch({
        title: details.title.trim(),
        teamA: teamA._id,
        teamB: teamB._id,
        venue: details.venue.trim(),
        format: details.format,
        totalOvers: parseInt(details.totalOvers) || 20,
        scheduledAt: buildScheduledAt().toISOString(),
        squadA: squadAPlayers,
        squadB: squadBPlayers,
        captainA: rolesA.captain,
        wkA: rolesA.wk,
        sub12A: rolesA.sub12,
        captainB: rolesB.captain,
        wkB: rolesB.wk,
        sub12B: rolesB.sub12,
      });
      router.replace(`/match/${match._id}/live`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────
  if (step === 'select_team_a') {
    return (
      <SafeAreaView className="flex-1" edges={['top']}>
        <TeamSelectView
          label="team A"
          onSelect={(team) => {
            setTeamA(team);
            // Auto-populate squad with all players
            const allPlayers: SquadPlayer[] = (team.players || []).map((p: any) => ({
              userId: p.userId?.toString() || p._id,
              name: p.name,
              role: p.role || 'batsman',
              jerseyNumber: p.jerseyNumber,
            }));
            setSquadAIds(new Set(allPlayers.map((p) => p.userId)));
            setSquadAPlayers(allPlayers);
            setStep('squad_a');
          }}
          onBack={() => setStep('select_teams')}
        />
      </SafeAreaView>
    );
  }

  if (step === 'squad_a') {
    return (
      <SafeAreaView className="flex-1" edges={['top']}>
        <SquadSelectView
          team={teamA}
          selectedIds={squadAIds}
          onToggle={(p) => toggleSquad(squadAIds, squadAPlayers, setSquadAIds, setSquadAPlayers, p)}
          onNext={() => setStep('roles_a')}
          onBack={() => setStep('select_team_a')}
        />
      </SafeAreaView>
    );
  }

  if (step === 'roles_a') {
    return (
      <SafeAreaView className="flex-1" edges={['top']}>
        <RoleAssignView
          team={teamA}
          squad={squadAPlayers}
          roles={rolesA}
          onSetRole={(role, uid) => setRole(rolesA, setRolesA, role, uid)}
          onNext={() => setStep('select_team_b')}
          onBack={() => setStep('squad_a')}
        />
      </SafeAreaView>
    );
  }

  if (step === 'select_team_b') {
    return (
      <SafeAreaView className="flex-1" edges={['top']}>
        <TeamSelectView
          label="team B"
          onSelect={(team) => {
            if (team._id === teamA?._id) { Alert.alert('Error', 'Select a different team'); return; }
            setTeamB(team);
            const allPlayers: SquadPlayer[] = (team.players || []).map((p: any) => ({
              userId: p.userId?.toString() || p._id,
              name: p.name,
              role: p.role || 'batsman',
              jerseyNumber: p.jerseyNumber,
            }));
            setSquadBIds(new Set(allPlayers.map((p) => p.userId)));
            setSquadBPlayers(allPlayers);
            setStep('squad_b');
          }}
          onBack={() => setStep('roles_a')}
        />
      </SafeAreaView>
    );
  }

  if (step === 'squad_b') {
    return (
      <SafeAreaView className="flex-1" edges={['top']}>
        <SquadSelectView
          team={teamB}
          selectedIds={squadBIds}
          onToggle={(p) => toggleSquad(squadBIds, squadBPlayers, setSquadBIds, setSquadBPlayers, p)}
          onNext={() => setStep('roles_b')}
          onBack={() => setStep('select_team_b')}
        />
      </SafeAreaView>
    );
  }

  if (step === 'roles_b') {
    return (
      <SafeAreaView className="flex-1" edges={['top']}>
        <RoleAssignView
          team={teamB}
          squad={squadBPlayers}
          roles={rolesB}
          onSetRole={(role, uid) => setRole(rolesB, setRolesB, role, uid)}
          onNext={() => setStep('match_details')}
          onBack={() => setStep('squad_b')}
        />
      </SafeAreaView>
    );
  }

  if (step === 'match_details') {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <MatchDetailsView
          teamA={teamA}
          teamB={teamB}
          details={details}
          onChange={(k, v) => setDetails((d) => ({ ...d, [k]: v }))}
          onSubmit={handleSubmit}
          onBack={() => setStep('roles_b')}
          loading={loading}
        />
      </SafeAreaView>
    );
  }

  // ── Step 0: Select Teams ───────────────────
  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">Select playing teams</Text>
      </View>

      <Text className="text-xs text-gray-400 text-center mt-2 italic px-4">
        *Scoring a match on CricAvengers is free.
      </Text>

      <View className="flex-1 items-center justify-center gap-6">
        {/* Team A */}
        <TouchableOpacity
          className="items-center"
          onPress={() => setStep('select_team_a')}
          activeOpacity={0.8}
        >
          {teamA ? (
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-2"
              style={{ backgroundColor: teamA.color || '#1E3A5F' }}
            >
              <Text className="text-white font-black text-lg">{teamA.shortName}</Text>
            </View>
          ) : (
            <View className="w-20 h-20 rounded-full bg-gray-800 items-center justify-center mb-2">
              <Ionicons name="add" size={32} color="white" />
            </View>
          )}
          <View
            className="px-6 py-2 rounded-sm items-center"
            style={{ backgroundColor: teamA ? '#1E3A5F' : '#059669' }}
          >
            <Text className="text-white font-bold text-sm">
              {teamA ? teamA.name : 'Select team A'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* VS */}
        <View className="w-10 h-10 border-2 border-gray-300 rotate-45 items-center justify-center">
          <Text className="text-gray-500 font-bold text-xs -rotate-45">vs</Text>
        </View>

        {/* Team B */}
        <TouchableOpacity
          className="items-center"
          onPress={() => teamA ? setStep('select_team_b') : Alert.alert('Select Team A first')}
          activeOpacity={0.8}
        >
          {teamB ? (
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-2"
              style={{ backgroundColor: teamB.color || '#8B0000' }}
            >
              <Text className="text-white font-black text-lg">{teamB.shortName}</Text>
            </View>
          ) : (
            <View className="w-20 h-20 rounded-full bg-gray-800 items-center justify-center mb-2">
              <Ionicons name="add" size={32} color="white" />
            </View>
          )}
          <View
            className="px-6 py-2 rounded-sm items-center"
            style={{ backgroundColor: teamB ? '#8B0000' : '#059669' }}
          >
            <Text className="text-white font-bold text-sm">
              {teamB ? teamB.name : 'Select team B'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Done / Next button */}
      {teamA && teamB && (
        <View className="px-4 pb-6">
          <TouchableOpacity
            className="bg-primary rounded-2xl py-4 items-center"
            onPress={() => setStep('match_details')}
          >
            <Text className="text-white font-bold text-base">Continue to Match Details</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
