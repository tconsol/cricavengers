import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMatchStore } from '@store/matchStore';
import { useTeamStore } from '@store/teamStore';

const FORMATS = ['T20', 'ODI', 'T10', 'Custom'];
const DEFAULT_OVERS: Record<string, number> = { T20: 20, ODI: 50, T10: 10, Custom: 10 };

export default function CreateMatchScreen() {
  const { createMatch } = useMatchStore();
  const { teams, fetchTeams } = useTeamStore();

  const [form, setForm] = useState({
    title: '',
    venue: '',
    format: 'T20',
    totalOvers: '20',
    teamA: '',
    teamB: '',
    scheduledAt: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchTeams(); }, []);

  const set = (field: string, value: string) => {
    const next: any = { ...form, [field]: value };
    if (field === 'format') next.totalOvers = String(DEFAULT_OVERS[value] ?? 20);
    setForm(next);
  };

  const validate = () => {
    if (!form.title.trim()) { Alert.alert('Error', 'Match title required'); return false; }
    if (!form.teamA)         { Alert.alert('Error', 'Select Team A'); return false; }
    if (!form.teamB)         { Alert.alert('Error', 'Select Team B'); return false; }
    if (form.teamA === form.teamB) { Alert.alert('Error', 'Teams must be different'); return false; }
    if (!parseInt(form.totalOvers)) { Alert.alert('Error', 'Valid overs required'); return false; }
    return true;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const match = await createMatch({
        title: form.title.trim(),
        venue: form.venue.trim(),
        format: form.format,
        totalOvers: parseInt(form.totalOvers),
        teamA: form.teamA,
        teamB: form.teamB,
        scheduledAt: form.scheduledAt,
      });
      Alert.alert('✅ Match Created', 'Your match is ready!', [
        { text: 'Open Match', onPress: () => router.replace(`/match/${match._id}/live`) },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const TeamPicker = ({ label, field }: { label: string; field: 'teamA' | 'teamB' }) => (
    <View className="mb-4">
      <Text className="text-sm font-semibold text-gray-600 mb-2">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {teams.map((team) => (
            <TouchableOpacity
              key={team._id}
              className={`px-4 py-3 rounded-xl border-2 flex-row items-center gap-2 ${
                form[field] === team._id ? 'border-primary bg-primary/10' : 'border-gray-200 bg-white'
              }`}
              onPress={() => set(field, team._id)}
            >
              <View
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: team.color }}
              />
              <Text className={`font-semibold ${form[field] === team._id ? 'text-primary' : 'text-gray-700'}`}>
                {team.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      <View className="flex-row items-center px-4 py-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold ml-3">Create Match</Text>
      </View>

      <ScrollView className="flex-1 bg-surface rounded-t-3xl" keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-6 pb-8">
          {/* Title */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-600 mb-1">Match Title *</Text>
            <TextInput
              className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-base"
              placeholder="e.g. RS vs TK - Summer Cup"
              value={form.title}
              onChangeText={(v) => set('title', v)}
            />
          </View>

          {/* Venue */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-600 mb-1">Venue</Text>
            <TextInput
              className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-base"
              placeholder="e.g. DY Patil Stadium"
              value={form.venue}
              onChangeText={(v) => set('venue', v)}
            />
          </View>

          {/* Format */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-600 mb-2">Format</Text>
            <View className="flex-row gap-2">
              {FORMATS.map((f) => (
                <TouchableOpacity
                  key={f}
                  className={`flex-1 py-2 rounded-xl items-center ${
                    form.format === f ? 'bg-primary' : 'bg-white border border-gray-200'
                  }`}
                  onPress={() => set('format', f)}
                >
                  <Text className={`font-bold text-sm ${form.format === f ? 'text-white' : 'text-gray-600'}`}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Overs */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-600 mb-1">Total Overs *</Text>
            <TextInput
              className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-base"
              placeholder="20"
              value={form.totalOvers}
              onChangeText={(v) => set('totalOvers', v)}
              keyboardType="number-pad"
            />
          </View>

          {/* Teams */}
          {teams.length === 0 ? (
            <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
              <Text className="text-yellow-700 font-semibold">No teams found.</Text>
              <TouchableOpacity onPress={() => router.push('/team/create')}>
                <Text className="text-primary font-bold mt-1">Create a team first →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TeamPicker label="Team A *" field="teamA" />
              <TeamPicker label="Team B *" field="teamB" />
            </>
          )}

          <TouchableOpacity
            className={`rounded-2xl py-4 items-center mt-4 ${loading ? 'bg-primary/50' : 'bg-primary'}`}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">Create Match 🏏</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
