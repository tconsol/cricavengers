import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTeamStore } from '@store/teamStore';

const COLORS_LIST = ['#1E3A5F', '#8B0000', '#064E3B', '#7C2D12', '#4C1D95', '#1e40af', '#065F46', '#92400E'];

export default function CreateTeamScreen() {
  const { createTeam } = useTeamStore();
  const [form, setForm] = useState({ name: '', shortName: '', color: '#1E3A5F' });
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleCreate = async () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      Alert.alert('Error', 'Team name must be at least 2 characters');
      return;
    }
    setLoading(true);
    try {
      const team = await createTeam({
        name: form.name.trim(),
        shortName: form.shortName.trim().toUpperCase() || form.name.slice(0, 3).toUpperCase(),
        color: form.color,
      });
      Alert.alert('✅ Team Created!', `${team.name} is ready.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      <View className="flex-row items-center px-4 py-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold ml-3">Create Team</Text>
      </View>

      <ScrollView className="flex-1 bg-surface rounded-t-3xl" keyboardShouldPersistTaps="handled">
        {/* Preview */}
        <View className="items-center pt-8 pb-4">
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-2"
            style={{ backgroundColor: form.color }}
          >
            <Text className="text-white text-2xl font-bold">
              {form.shortName || form.name.slice(0, 2).toUpperCase() || '??'}
            </Text>
          </View>
          <Text className="text-xl font-bold text-gray-800">{form.name || 'Team Name'}</Text>
        </View>

        <View className="px-4 pb-8">
          {/* Name */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-600 mb-1">Team Name *</Text>
            <TextInput
              className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-base"
              placeholder="e.g. Royal Strikers"
              value={form.name}
              onChangeText={(v) => set('name', v)}
              autoCapitalize="words"
            />
          </View>

          {/* Short Name */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-600 mb-1">Short Name (max 5)</Text>
            <TextInput
              className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-base"
              placeholder="e.g. RS"
              value={form.shortName}
              onChangeText={(v) => set('shortName', v.toUpperCase().slice(0, 5))}
              autoCapitalize="characters"
              maxLength={5}
            />
          </View>

          {/* Color */}
          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-600 mb-2">Team Color</Text>
            <View className="flex-row flex-wrap gap-3">
              {COLORS_LIST.map((c) => (
                <TouchableOpacity
                  key={c}
                  className={`w-12 h-12 rounded-full ${form.color === c ? 'border-4 border-gray-300' : ''}`}
                  style={{ backgroundColor: c }}
                  onPress={() => set('color', c)}
                />
              ))}
            </View>
          </View>

          <TouchableOpacity
            className={`rounded-2xl py-4 items-center ${loading ? 'bg-primary/50' : 'bg-primary'}`}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Create Team 👥</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
