import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
  Alert, TextInput, Modal, ScrollView, RefreshControl, Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTeamStore } from '@store/teamStore';
import { useAuthStore } from '@store/authStore';
import { api } from '@services/api';

const ROLES = ['batsman', 'bowler', 'all-rounder', 'wicket-keeper'] as const;
type Role = typeof ROLES[number];

const ROLE_ICONS: Record<Role, string> = {
  batsman: '🏏',
  bowler: '⚡',
  'all-rounder': '🌟',
  'wicket-keeper': '🧤',
};

// ── Add Player Modal ────────────────────────────────────────
function AddPlayerModal({
  visible,
  teamColor,
  onClose,
  onAdd,
}: {
  visible: boolean;
  teamColor: string;
  onClose: () => void;
  onAdd: (player: Record<string, unknown>) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [role, setRole] = useState<Role>('batsman');
  const [jersey, setJersey] = useState('');
  const [isCaptain, setIsCaptain] = useState(false);
  const [isVC, setIsVC] = useState(false);
  const [adding, setAdding] = useState(false);

  const reset = () => {
    setQuery('');
    setResults([]);
    setSelected(null);
    setRole('batsman');
    setJersey('');
    setIsCaptain(false);
    setIsVC(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get('/teams/search/players', { q: q.trim() }) as any;
      setResults(res.data.players || []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  const handleAdd = async () => {
    if (!selected) { Alert.alert('Select a player first'); return; }
    setAdding(true);
    try {
      await onAdd({
        userId: selected._id,
        name: selected.name,
        role,
        jerseyNumber: jersey ? parseInt(jersey) : undefined,
        isCaptain,
        isViceCaptain: isVC,
      });
      handleClose();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setAdding(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        {/* Header */}
        <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-gray-800 ml-3">Add Player</Text>
        </View>

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="px-4 py-4">
            {/* Search */}
            <Text className="text-sm font-semibold text-gray-600 mb-2">Search by name, email, or phone</Text>
            <View className="flex-row items-center border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 gap-2 mb-3">
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                className="flex-1 text-base text-gray-800"
                placeholder="Search player..."
                value={query}
                onChangeText={handleSearch}
                autoFocus
                autoCapitalize="none"
              />
              {searching && <ActivityIndicator size="small" color="#1E3A5F" />}
            </View>

            {/* Results */}
            {results.length > 0 && !selected && (
              <View className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
                {results.map((player, idx) => (
                  <TouchableOpacity
                    key={player._id}
                    className={`flex-row items-center px-4 py-3 ${idx < results.length - 1 ? 'border-b border-gray-100' : ''}`}
                    onPress={() => { setSelected(player); setResults([]); }}
                  >
                    <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
                      <Text className="font-bold text-primary text-sm">
                        {player.name?.charAt(0)?.toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-gray-800">{player.name}</Text>
                      <Text className="text-xs text-gray-400">{player.email}</Text>
                    </View>
                    <Ionicons name="add-circle" size={22} color="#1E3A5F" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {query.trim().length >= 2 && !searching && results.length === 0 && !selected && (
              <View className="bg-gray-50 rounded-xl p-4 items-center mb-4">
                <Text className="text-gray-400 text-sm">No players found for "{query}"</Text>
                <Text className="text-gray-400 text-xs mt-1">Make sure they have an account</Text>
              </View>
            )}

            {/* Selected Player */}
            {selected && (
              <View className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 mb-4 flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-primary/15 items-center justify-center mr-3">
                  <Text className="font-bold text-primary">
                    {selected.name?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-gray-800">{selected.name}</Text>
                  <Text className="text-xs text-gray-500">{selected.email}</Text>
                </View>
                <TouchableOpacity onPress={() => { setSelected(null); setQuery(''); }}>
                  <Ionicons name="close-circle" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            )}

            {/* Role */}
            <Text className="text-sm font-semibold text-gray-600 mb-2">Role</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  className={`px-4 py-2.5 rounded-xl border flex-row items-center gap-1 ${
                    role === r ? 'bg-primary border-primary' : 'bg-white border-gray-200'
                  }`}
                  onPress={() => setRole(r)}
                >
                  <Text>{ROLE_ICONS[r]}</Text>
                  <Text className={`text-sm font-semibold capitalize ${role === r ? 'text-white' : 'text-gray-600'}`}>
                    {r.replace('-', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Jersey Number */}
            <Text className="text-sm font-semibold text-gray-600 mb-2">Jersey Number (optional)</Text>
            <TextInput
              className="border border-gray-200 bg-white rounded-xl px-4 py-3 text-base mb-4"
              placeholder="e.g. 7"
              value={jersey}
              onChangeText={setJersey}
              keyboardType="number-pad"
            />

            {/* Captain / VC */}
            <View className="flex-row gap-3 mb-6">
              {[
                { label: '© Captain', flag: isCaptain, setter: (v: boolean) => { setIsCaptain(v); if (v) setIsVC(false); } },
                { label: 'VC', flag: isVC, setter: (v: boolean) => { setIsVC(v); if (v) setIsCaptain(false); } },
              ].map(({ label, flag, setter }) => (
                <TouchableOpacity
                  key={label}
                  className={`flex-1 py-3 rounded-xl items-center border-2 ${flag ? 'border-primary bg-primary/10' : 'border-gray-200 bg-white'}`}
                  onPress={() => setter(!flag)}
                >
                  <Text className={`font-bold ${flag ? 'text-primary' : 'text-gray-500'}`}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Add Button */}
            <TouchableOpacity
              className={`rounded-2xl py-4 items-center ${!selected || adding ? 'bg-primary/40' : 'bg-primary'}`}
              onPress={handleAdd}
              disabled={!selected || adding}
            >
              {adding
                ? <ActivityIndicator color="white" />
                : <Text className="text-white font-bold text-base">Add to Team</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Main Screen ─────────────────────────────────────────────
export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const { currentTeam, fetchTeam, isLoading, addPlayer, removePlayer } = useTeamStore();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const load = useCallback(() => { fetchTeam(id!); }, [id]);
  useEffect(() => { load(); }, [id]);

  const isOwner = currentTeam?.createdBy?._id === user?._id
    || currentTeam?.createdBy === user?._id;
  const isCaptain = currentTeam?.players?.some(
    (p: any) => p.userId?.toString() === user?._id && p.isCaptain
  );
  const canEdit = isOwner || isCaptain;

  const handleLogoUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const form = new FormData();
    form.append('logo', {
      uri: asset.uri,
      type: asset.mimeType || 'image/jpeg',
      name: asset.fileName || 'logo.jpg',
    } as any);
    setUploadingLogo(true);
    try {
      await api.upload(`/teams/${id}/logo`, form);
      load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleAdd = async (playerData: Record<string, unknown>) => {
    await addPlayer(id!, playerData);
    load();
  };

  const handleRemove = (playerId: string, name: string) => {
    Alert.alert('Remove Player', `Remove ${name} from the team?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await removePlayer(id!, playerId);
          } catch (err: any) { Alert.alert('Error', err.message); }
        },
      },
    ]);
  };

  if (isLoading && !currentTeam) {
    return (
      <SafeAreaView className="flex-1 bg-primary items-center justify-center">
        <ActivityIndicator size="large" color="#F4A200" />
      </SafeAreaView>
    );
  }

  if (!currentTeam) {
    return (
      <SafeAreaView className="flex-1 bg-primary items-center justify-center">
        <Text className="text-white">Team not found</Text>
      </SafeAreaView>
    );
  }

  const captain = currentTeam.players.find((p: any) => p.isCaptain);
  const vc      = currentTeam.players.find((p: any) => p.isViceCaptain);

  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold ml-3 flex-1" numberOfLines={1}>
          {currentTeam.name}
        </Text>
        {canEdit && (
          <TouchableOpacity
            className="bg-accent rounded-full px-3 py-1.5 flex-row items-center gap-1"
            onPress={() => setAddModalVisible(true)}
          >
            <Ionicons name="person-add" size={15} color="#000" />
            <Text className="text-black text-xs font-bold">Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Team Banner */}
      <View className="items-center pb-6">
        <TouchableOpacity onPress={canEdit ? handleLogoUpload : undefined} activeOpacity={canEdit ? 0.8 : 1} style={{ position: 'relative', marginBottom: 8 }}>
          {currentTeam.logo ? (
            <Image
              source={{ uri: currentTeam.logo }}
              style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#F59E0B' }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: currentTeam.color, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{currentTeam.shortName}</Text>
            </View>
          )}
          {canEdit && (
            <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#1E3A5F', borderRadius: 12, padding: 4, borderWidth: 2, borderColor: '#fff' }}>
              {uploadingLogo
                ? <ActivityIndicator size="small" color="#F59E0B" style={{ width: 14, height: 14 }} />
                : <Ionicons name="camera" size={13} color="#F59E0B" />
              }
            </View>
          )}
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold">{currentTeam.name}</Text>
        <View className="flex-row gap-3 mt-1">
          {captain && (
            <Text className="text-blue-200 text-sm">C: {captain.name?.split(' ')[0]}</Text>
          )}
          {vc && (
            <Text className="text-blue-200 text-sm">VC: {vc.name?.split(' ')[0]}</Text>
          )}
        </View>
        <Text className="text-blue-300 text-xs mt-1">{currentTeam.players.length} players</Text>
      </View>

      <FlatList
        data={currentTeam.players}
        keyExtractor={(p: any) => p._id}
        className="bg-surface rounded-t-3xl pt-4 px-4"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={load} />}
        renderItem={({ item: player, index }) => (
          <View className="flex-row items-center bg-white rounded-2xl px-4 py-3 mb-2 shadow-sm">
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: currentTeam.color + '20' }}
            >
              <Text className="font-bold text-xs" style={{ color: currentTeam.color }}>
                {player.jerseyNumber || index + 1}
              </Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5 flex-wrap">
                <Text className="font-semibold text-gray-800">{player.name}</Text>
                {player.isCaptain && (
                  <View className="bg-accent/20 px-1.5 py-0.5 rounded-full">
                    <Text className="text-accent text-xs font-bold">C</Text>
                  </View>
                )}
                {player.isViceCaptain && (
                  <View className="bg-blue-100 px-1.5 py-0.5 rounded-full">
                    <Text className="text-blue-600 text-xs font-bold">VC</Text>
                  </View>
                )}
              </View>
              <Text className="text-gray-400 text-xs">
                {ROLE_ICONS[player.role as Role] || ''} {player.role?.replace('-', ' ')}
              </Text>
            </View>
            {canEdit && (
              <TouchableOpacity
                className="p-2"
                onPress={() => handleRemove(player._id, player.name)}
              >
                <Ionicons name="remove-circle-outline" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        )}
        ListHeaderComponent={
          <Text className="font-bold text-gray-700 mb-3">
            Players ({currentTeam.players.length})
          </Text>
        }
        ListEmptyComponent={
          <View className="items-center py-10">
            <Text className="text-3xl mb-2">👥</Text>
            <Text className="text-gray-400">No players yet</Text>
            {isOwner && (
              <TouchableOpacity
                className="mt-3 bg-primary px-5 py-2 rounded-full"
                onPress={() => setAddModalVisible(true)}
              >
                <Text className="text-white font-semibold">Add First Player</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListFooterComponent={<View className="h-8" />}
      />

      <AddPlayerModal
        visible={addModalVisible}
        teamColor={currentTeam.color}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleAdd}
      />
    </SafeAreaView>
  );
}
