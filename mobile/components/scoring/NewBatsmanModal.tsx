import { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, Alert } from 'react-native';
import { useScoringStore } from '@store/scoringStore';
import { api } from '@services/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  match: any;
  innings: number;
  matchId: string;
}

export default function NewBatsmanModal({ visible, onClose, match, innings, matchId }: Props) {
  const { liveState, fetchSummary } = useScoringStore();
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const battingTeamId = innings === 1
    ? match?.innings?.first?.battingTeam?._id || match?.innings?.first?.battingTeam
    : match?.innings?.second?.battingTeam?._id || match?.innings?.second?.battingTeam;

  const team = battingTeamId?.toString() === (match?.teamA?._id || match?.teamA)?.toString()
    ? match?.teamA : match?.teamB;

  // Use string comparison to safely exclude current players at the crease
  const strikerId    = (liveState?.striker?._id    || liveState?.striker)?.toString();
  const nonStrikerId = (liveState?.nonStriker?._id || liveState?.nonStriker)?.toString();

  const availablePlayers = (team?.players || []).filter((p: any) => {
    const pid = (p.userId?._id || p.userId)?.toString();
    return pid !== strikerId && pid !== nonStrikerId;
  });

  const handleSelect = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      // Dedicated mid-innings endpoint — does NOT require a state transition
      await api.put(`/scoring/matches/${matchId}/players`, {
        striker: selected,
        nonStriker: liveState?.nonStriker?._id || liveState?.nonStriker,
        bowler: liveState?.currentBowler?._id || liveState?.currentBowler,
      } as any);
      await fetchSummary(matchId);
      setSelected('');
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to set new batsman');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl px-4 pb-8 pt-4">
          <Text className="text-xl font-bold text-gray-800 mb-4">Select Next Batsman</Text>

          {availablePlayers.length === 0 ? (
            <View className="items-center py-8">
              <Text className="text-4xl mb-2">🏏</Text>
              <Text className="text-gray-500 font-semibold">All players have batted</Text>
              <Text className="text-gray-400 text-sm mt-1">Innings complete or all out</Text>
            </View>
          ) : (
            <FlatList
              data={availablePlayers}
              keyExtractor={(p: any) => (p.userId?._id || p.userId)?.toString()}
              renderItem={({ item }: any) => {
                const pid = (item.userId?._id || item.userId)?.toString();
                return (
                  <TouchableOpacity
                    className={`flex-row items-center px-4 py-3 rounded-xl mb-2 border-2 ${
                      selected === pid ? 'border-primary bg-primary/10' : 'border-gray-100 bg-gray-50'
                    }`}
                    onPress={() => setSelected(pid)}
                  >
                    <View className="w-10 h-10 bg-primary/20 rounded-full items-center justify-center mr-3">
                      <Text className="font-bold text-primary">{item.jerseyNumber || '#'}</Text>
                    </View>
                    <Text className="font-semibold text-gray-800 flex-1">{item.name}</Text>
                    <Text className="text-xs text-gray-400 capitalize">{item.role}</Text>
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 300 }}
            />
          )}

          <View className="flex-row gap-3 mt-4">
            <TouchableOpacity
              className="flex-1 py-3 rounded-xl bg-gray-100 items-center"
              onPress={() => { setSelected(''); onClose(); }}
            >
              <Text className="font-semibold text-gray-600">Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 py-3 rounded-xl items-center ${selected && !submitting ? 'bg-primary' : 'bg-gray-200'}`}
              onPress={handleSelect}
              disabled={!selected || submitting}
            >
              <Text className={`font-bold ${selected && !submitting ? 'text-white' : 'text-gray-400'}`}>
                {submitting ? 'Setting…' : 'Confirm'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
