import { View, Text, Modal, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: string | null) => void;
  current: string | null;
}

const EXTRAS = [
  { key: null,      label: 'None',    desc: 'Normal delivery' },
  { key: 'wide',    label: 'Wide',    desc: '+1 run, no ball faced' },
  { key: 'no_ball', label: 'No Ball', desc: '+1 penalty run' },
  { key: 'bye',     label: 'Bye',     desc: "Missed by keeper, batsman's runs" },
  { key: 'leg_bye', label: 'Leg Bye', desc: 'Off the body, not bat' },
];

export default function ExtrasModal({ visible, onClose, onSelect, current }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl px-4 pb-8 pt-4">
          <Text className="text-xl font-bold text-gray-800 mb-4">Extra Type</Text>
          {EXTRAS.map((e) => (
            <TouchableOpacity
              key={String(e.key)}
              className={`flex-row items-center px-4 py-3 rounded-xl mb-2 border-2 ${
                current === e.key ? 'border-primary bg-primary/10' : 'border-gray-100'
              }`}
              onPress={() => { onSelect(e.key); onClose(); }}
            >
              <View className="flex-1">
                <Text className={`font-semibold ${current === e.key ? 'text-primary' : 'text-gray-800'}`}>
                  {e.label}
                </Text>
                <Text className="text-xs text-gray-400">{e.desc}</Text>
              </View>
              {current === e.key && <Text className="text-primary">✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}
