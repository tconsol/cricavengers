import { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList } from 'react-native';
import { useScoringStore } from '@store/scoringStore';
import { api } from '@services/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  match: any;
  innings: number;
  matchId: string;
}

export default function NewBowlerModal({ visible, onClose, match, innings, matchId }: Props) {
  const { liveState, fetchSummary } = useScoringStore();
  const [selected, setSelected] = useState('');

  const bowlingTeamId = innings === 1
    ? match?.innings?.first?.bowlingTeam?._id || match?.innings?.first?.bowlingTeam
    : match?.innings?.second?.bowlingTeam?._id || match?.innings?.second?.bowlingTeam;

  const team = bowlingTeamId === (match?.teamA?._id || match?.teamA)
    ? match?.teamA : match?.teamB;

  const handleSelect = async () => {
    if (!selected) return;
    try {
      await api.put(`/matches/${matchId}/innings/start`, {
        innings,
        striker: liveState?.striker?._id || liveState?.striker,
        nonStriker: liveState?.nonStriker?._id || liveState?.nonStriker,
        bowler: selected,
      } as any);
      await fetchSummary(matchId);
      setSelected('');
      onClose();
    } catch { /* silent */ }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl px-4 pb-8 pt-4">
          <Text className="text-xl font-bold text-gray-800 mb-1">Over Complete!</Text>
          <Text className="text-gray-500 text-sm mb-4">Select the next bowler</Text>

          <FlatList
            data={team?.players || []}
            keyExtractor={(p: any) => p.userId}
            renderItem={({ item }: any) => (
              <TouchableOpacity
                className={`flex-row items-center px-4 py-3 rounded-xl mb-2 border-2 ${
                  selected === item.userId ? 'border-primary bg-primary/10' : 'border-gray-100 bg-gray-50'
                }`}
                onPress={() => setSelected(item.userId)}
              >
                <View className="w-10 h-10 bg-primary/20 rounded-full items-center justify-center mr-3">
                  <Text className="font-bold text-primary">{item.jerseyNumber || '#'}</Text>
                </View>
                <Text className="font-semibold text-gray-800 flex-1">{item.name}</Text>
                <Text className="text-xs text-gray-400 capitalize">{item.role}</Text>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 300 }}
          />

          <TouchableOpacity
            className={`py-4 rounded-2xl items-center mt-4 ${selected ? 'bg-primary' : 'bg-gray-200'}`}
            onPress={handleSelect}
            disabled={!selected}
          >
            <Text className={`font-bold text-lg ${selected ? 'text-white' : 'text-gray-400'}`}>
              Start Next Over
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
