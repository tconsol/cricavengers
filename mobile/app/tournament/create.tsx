import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTournamentStore } from '@store/tournamentStore';

const FORMATS = [
  { key: 'round_robin',        label: 'Round Robin',          icon: '🔄', desc: 'Every team plays each other' },
  { key: 'single_elimination', label: 'Single Elimination',   icon: '🏆', desc: 'Straight knockout bracket' },
  { key: 'double_elimination', label: 'Double Elimination',   icon: '⚔️',  desc: 'Two-loss elimination' },
  { key: 'group_knockout',     label: 'Group + Knockout',     icon: '🎯', desc: 'Group stage then knockout' },
  { key: 'league',             label: 'League',               icon: '📋', desc: 'Points-based league table' },
];

const MATCH_FORMATS = ['T20', 'ODI', 'T10', 'Custom'];
const OVERS_MAP: Record<string, string> = { T20: '20', ODI: '50', T10: '10', Custom: '10' };
const TEAM_COUNTS = [4, 6, 8, 10, 12, 16];

export default function CreateTournamentScreen() {
  const { createTournament } = useTournamentStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    format: 'round_robin',
    matchFormat: 'T20',
    totalOvers: '20',
    venue: '',
    maxTeams: '8',
    startDate: '',
    endDate: '',
    prizePool: '',
    isPublic: true,
  });

  const set = (key: string, value: any) => {
    const next: any = { ...form, [key]: value };
    if (key === 'matchFormat') next.totalOvers = OVERS_MAP[value] ?? '20';
    setForm(next);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { Alert.alert('Error', 'Tournament name is required'); return; }
    if (!parseInt(form.maxTeams) || parseInt(form.maxTeams) < 2) {
      Alert.alert('Error', 'Max teams must be at least 2'); return;
    }

    setLoading(true);
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        description: form.description.trim(),
        format: form.format,
        matchFormat: form.matchFormat,
        totalOvers: parseInt(form.totalOvers) || 20,
        venue: form.venue.trim(),
        maxTeams: parseInt(form.maxTeams),
        prizePool: form.prizePool.trim(),
        isPublic: form.isPublic,
      };
      if (form.startDate) payload.startDate = new Date(form.startDate).toISOString();
      if (form.endDate)   payload.endDate   = new Date(form.endDate).toISOString();

      const t = await createTournament(payload);
      Alert.alert('Tournament Created!', `${t.name} is ready. Add teams to get started.`, [
        { text: 'View Tournament', onPress: () => router.replace(`/tournament/${t._id}` as any) },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const SectionTitle = ({ title }: { title: string }) => (
    <Text className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2 mt-5">{title}</Text>
  );

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      <View className="flex-row items-center px-4 py-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold ml-3">Create Tournament</Text>
      </View>

      <ScrollView className="flex-1 bg-surface rounded-t-3xl" keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-5 pb-10">

          <SectionTitle title="Basic Info" />
          <TextInput
            className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-base mb-3"
            placeholder="Tournament Name *"
            value={form.name}
            onChangeText={(v) => set('name', v)}
            autoCapitalize="words"
          />
          <TextInput
            className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-base mb-3"
            placeholder="Description (optional)"
            value={form.description}
            onChangeText={(v) => set('description', v)}
            multiline
            numberOfLines={2}
            textAlignVertical="top"
          />
          <TextInput
            className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-base mb-3"
            placeholder="Venue"
            value={form.venue}
            onChangeText={(v) => set('venue', v)}
          />
          <TextInput
            className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-base mb-1"
            placeholder="Prize Pool (e.g. ₹10,000)"
            value={form.prizePool}
            onChangeText={(v) => set('prizePool', v)}
          />

          <SectionTitle title="Tournament Format" />
          {FORMATS.map((f) => (
            <TouchableOpacity
              key={f.key}
              className={`border-2 rounded-xl p-3 mb-2 flex-row items-center ${
                form.format === f.key ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'
              }`}
              onPress={() => set('format', f.key)}
            >
              <Text className="text-2xl mr-3">{f.icon}</Text>
              <View className="flex-1">
                <Text className={`font-bold ${form.format === f.key ? 'text-primary' : 'text-gray-800'}`}>
                  {f.label}
                </Text>
                <Text className="text-xs text-gray-400">{f.desc}</Text>
              </View>
              {form.format === f.key && (
                <Ionicons name="checkmark-circle" size={20} color="#1E3A5F" />
              )}
            </TouchableOpacity>
          ))}

          <SectionTitle title="Match Format" />
          <View className="flex-row gap-2 mb-3">
            {MATCH_FORMATS.map((mf) => (
              <TouchableOpacity
                key={mf}
                className={`flex-1 py-2.5 rounded-xl items-center ${
                  form.matchFormat === mf ? 'bg-primary' : 'bg-white border border-gray-200'
                }`}
                onPress={() => set('matchFormat', mf)}
              >
                <Text className={`font-bold text-sm ${form.matchFormat === mf ? 'text-white' : 'text-gray-600'}`}>
                  {mf}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View className="mb-1">
            <Text className="text-sm text-gray-500 mb-1">Overs per match</Text>
            <TextInput
              className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-base"
              placeholder="20"
              value={form.totalOvers}
              onChangeText={(v) => set('totalOvers', v)}
              keyboardType="number-pad"
            />
          </View>

          <SectionTitle title="Team Capacity" />
          <View className="flex-row flex-wrap gap-2 mb-1">
            {TEAM_COUNTS.map((n) => (
              <TouchableOpacity
                key={n}
                className={`px-5 py-2.5 rounded-xl ${form.maxTeams === String(n) ? 'bg-primary' : 'bg-white border border-gray-200'}`}
                onPress={() => set('maxTeams', String(n))}
              >
                <Text className={`font-bold ${form.maxTeams === String(n) ? 'text-white' : 'text-gray-600'}`}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <SectionTitle title="Dates (optional)" />
          <TextInput
            className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-base mb-3"
            placeholder="Start Date (YYYY-MM-DD)"
            value={form.startDate}
            onChangeText={(v) => set('startDate', v)}
            keyboardType="numbers-and-punctuation"
          />
          <TextInput
            className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-base mb-3"
            placeholder="End Date (YYYY-MM-DD)"
            value={form.endDate}
            onChangeText={(v) => set('endDate', v)}
            keyboardType="numbers-and-punctuation"
          />

          <SectionTitle title="Visibility" />
          <View className="flex-row items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3">
            <View>
              <Text className="font-semibold text-gray-800">Public Tournament</Text>
              <Text className="text-xs text-gray-400">Anyone can find and join</Text>
            </View>
            <Switch
              value={form.isPublic}
              onValueChange={(v) => set('isPublic', v)}
              trackColor={{ true: '#1E3A5F' }}
            />
          </View>

          <TouchableOpacity
            className={`rounded-2xl py-4 items-center mt-2 ${loading ? 'bg-primary/50' : 'bg-primary'}`}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="white" />
              : <Text className="text-white font-bold text-lg">Create Tournament 🏆</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
