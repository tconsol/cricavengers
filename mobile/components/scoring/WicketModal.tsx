import { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { WICKET_TYPES } from '@constants/index';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (runs: number, wicket: any) => void;
  batsmen: Array<{ _id: string; name: string }>;
  match: any;
  innings: number;
}

export default function WicketModal({ visible, onClose, onSubmit, batsmen, match, innings }: Props) {
  const [wicketType, setWicketType]   = useState('');
  const [batsmanOut, setBatsmanOut]   = useState('');
  const [runs, setRuns]               = useState(0);

  const handleSubmit = () => {
    if (!wicketType || !batsmanOut) return;
    onSubmit(runs, { type: wicketType, batsmanOut, fielder: null });
    setWicketType(''); setBatsmanOut(''); setRuns(0);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl px-4 pb-8 pt-4 max-h-[80%]">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold text-red-600">🏏 Wicket!</Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-gray-400 text-xl">✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Runs before wicket */}
            <Text className="text-sm font-semibold text-gray-600 mb-2">Runs off this ball</Text>
            <View className="flex-row gap-2 mb-4">
              {[0, 1, 2, 3, 4].map((r) => (
                <TouchableOpacity
                  key={r}
                  className={`w-12 h-12 rounded-xl items-center justify-center ${runs === r ? 'bg-primary' : 'bg-gray-100'}`}
                  onPress={() => setRuns(r)}
                >
                  <Text className={`font-bold text-lg ${runs === r ? 'text-white' : 'text-gray-700'}`}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Batsman out */}
            <Text className="text-sm font-semibold text-gray-600 mb-2">Batsman Out</Text>
            <View className="flex-row gap-2 mb-4">
              {batsmen.filter((b) => b._id).map((b) => (
                <TouchableOpacity
                  key={b._id}
                  className={`flex-1 py-3 rounded-xl items-center border-2 ${
                    batsmanOut === b._id ? 'border-red-500 bg-red-50' : 'border-gray-200'
                  }`}
                  onPress={() => setBatsmanOut(b._id)}
                >
                  <Text className={`font-semibold ${batsmanOut === b._id ? 'text-red-600' : 'text-gray-700'}`}>
                    {b.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Wicket type */}
            <Text className="text-sm font-semibold text-gray-600 mb-2">How Out</Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {WICKET_TYPES.map((w) => (
                <TouchableOpacity
                  key={w.value}
                  className={`px-4 py-2 rounded-xl border-2 ${
                    wicketType === w.value ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-gray-50'
                  }`}
                  onPress={() => setWicketType(w.value)}
                >
                  <Text className={`font-semibold text-sm ${wicketType === w.value ? 'text-red-600' : 'text-gray-600'}`}>
                    {w.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              className={`rounded-2xl py-4 items-center ${
                !wicketType || !batsmanOut ? 'bg-gray-200' : 'bg-red-500'
              }`}
              onPress={handleSubmit}
              disabled={!wicketType || !batsmanOut}
            >
              <Text className={`font-bold text-lg ${!wicketType || !batsmanOut ? 'text-gray-400' : 'text-white'}`}>
                Confirm Wicket
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
