import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, Animated, Dimensions,
} from 'react-native';

const { width: SW } = Dimensions.get('window');
const FIELD_SIZE = Math.min(SW - 32, 300);
const HALF = FIELD_SIZE / 2;

// Zone definitions: position as % of FIELD_SIZE (0=left/top, 100=right/bottom)
// Field orientation: bowler at TOP, batsman at center, leg side = LEFT, off side = RIGHT
const ZONES = [
  // Leg side deep
  { id: 'fine_leg',   label: 'Fine Leg',  short: 'FL',  xp: 18, yp: 82, leg: true },
  { id: 'square_leg', label: 'Sq Leg',    short: 'SqL', xp: 8,  yp: 55, leg: true },
  // Leg side mid
  { id: 'mid_wicket', label: 'Mid Wkt',   short: 'MW',  xp: 15, yp: 35, leg: true },
  { id: 'mid_on',     label: 'Mid On',    short: 'MO',  xp: 30, yp: 14, leg: true },
  // Straight / boundary
  { id: 'long_on',    label: 'Long On',   short: 'LON', xp: 38, yp: 4,  leg: true },
  { id: 'straight',   label: 'Straight',  short: 'ST',  xp: 50, yp: 2,  leg: false },
  { id: 'long_off',   label: 'Long Off',  short: 'LOF', xp: 62, yp: 4,  leg: false },
  // Off side mid
  { id: 'mid_off',    label: 'Mid Off',   short: 'MOF', xp: 70, yp: 14, leg: false },
  { id: 'cover',      label: 'Cover',     short: 'CV',  xp: 84, yp: 35, leg: false },
  // Off side infield/deep
  { id: 'point',      label: 'Point',     short: 'PT',  xp: 90, yp: 55, leg: false },
  { id: 'gully',      label: 'Gully',     short: 'GY',  xp: 80, yp: 75, leg: false },
  { id: 'third_man',  label: 'Third Man', short: 'TM',  xp: 68, yp: 88, leg: false },
];

interface Props {
  visible: boolean;
  runs: number;
  isWicket: boolean;
  isExtra: boolean;
  batsmanName: string;
  bowlerName: string;
  commentary: string;
  onConfirm: (region: string | null) => void;
}

export default function GroundPicker({
  visible, runs, isWicket, isExtra, batsmanName, bowlerName, commentary, onConfirm,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const ballAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Animate in
  useEffect(() => {
    if (visible) {
      setSelected(null);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 160, friction: 18, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      ballAnim.setValue(0);
    }
  }, [visible]);

  // Animate ball to selected zone
  useEffect(() => {
    if (selected) {
      ballAnim.setValue(0);
      Animated.timing(ballAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [selected]);

  const handleZone = (id: string) => {
    setSelected(id === selected ? null : id);
  };

  const handleConfirm = () => onConfirm(selected);
  const handleSkip    = () => onConfirm(null);

  // Determine badge color by run/event type
  const badgeColor = isWicket ? '#EF4444' : runs === 6 ? '#16A34A' : runs === 4 ? '#2563EB' : '#1E3A5F';
  const badgeText  = isWicket ? 'W' : isExtra ? 'E' : String(runs);
  const isHighlight = isWicket || runs >= 4;

  // Ball position animation from center to selected zone
  const selectedZone = ZONES.find(z => z.id === selected);
  const ballX = selectedZone ? (selectedZone.xp / 100) * FIELD_SIZE - HALF : 0;
  const ballY = selectedZone ? (selectedZone.yp / 100) * FIELD_SIZE - HALF : 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleSkip}>
      <Animated.View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'flex-end', opacity: fadeAnim,
      }}>
        <Animated.View style={{
          backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingBottom: 28, transform: [{ scale: scaleAnim }],
        }}>
          {/* Header */}
          <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginBottom: 14 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20 }}>
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: badgeColor, alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{badgeText}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: '#111827', fontSize: 15 }} numberOfLines={2}>
                  {commentary}
                </Text>
              </View>
            </View>
          </View>

          {/* Field */}
          <View style={{ alignItems: 'center', marginVertical: 8 }}>
            {/* Labels above field */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: FIELD_SIZE, paddingHorizontal: 8, marginBottom: 2 }}>
              <Text style={{ fontSize: 9, color: '#9CA3AF', fontWeight: '600' }}>LEG SIDE</Text>
              <Text style={{ fontSize: 9, color: '#9CA3AF', fontWeight: '600' }}>BOWLER END ↑</Text>
              <Text style={{ fontSize: 9, color: '#9CA3AF', fontWeight: '600' }}>OFF SIDE</Text>
            </View>

            <View style={{ width: FIELD_SIZE, height: FIELD_SIZE, position: 'relative' }}>
              {/* Oval field background */}
              <View style={{
                position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
                borderRadius: HALF, backgroundColor: '#D1FAE5',
                borderWidth: 2, borderColor: '#6EE7B7',
              }} />

              {/* Inner circle (30-yard circle) */}
              <View style={{
                position: 'absolute',
                left: HALF * 0.3, top: HALF * 0.3,
                width: FIELD_SIZE * 0.4, height: FIELD_SIZE * 0.4,
                borderRadius: FIELD_SIZE * 0.2,
                borderWidth: 1.5, borderColor: '#6EE7B7', borderStyle: 'dashed',
                backgroundColor: 'transparent',
              }} />

              {/* Pitch */}
              <View style={{
                position: 'absolute',
                left: HALF - 12, top: HALF - 28,
                width: 24, height: 56,
                backgroundColor: '#D4B896', borderRadius: 4,
                borderWidth: 1, borderColor: '#A0785A',
              }} />

              {/* Stumps (batsman end) */}
              <View style={{
                position: 'absolute', left: HALF - 8, top: HALF + 16,
                flexDirection: 'row', gap: 4,
              }}>
                {[0,1,2].map(i => (
                  <View key={i} style={{ width: 2.5, height: 10, backgroundColor: '#92400E', borderRadius: 1 }} />
                ))}
              </View>

              {/* Ball trail animation */}
              {selected && selectedZone && (
                <Animated.View style={{
                  position: 'absolute',
                  left: HALF - 5,
                  top: HALF - 5,
                  width: 10, height: 10,
                  borderRadius: 5,
                  backgroundColor: badgeColor,
                  opacity: ballAnim,
                  transform: [
                    {
                      translateX: ballAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, ballX],
                      }),
                    },
                    {
                      translateY: ballAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, ballY],
                      }),
                    },
                  ],
                }} />
              )}

              {/* Zone buttons */}
              {ZONES.map((zone) => {
                const isSelected = selected === zone.id;
                const zoneColor = zone.leg ? '#7C3AED' : '#1D4ED8';
                return (
                  <TouchableOpacity
                    key={zone.id}
                    onPress={() => handleZone(zone.id)}
                    style={{
                      position: 'absolute',
                      left: (zone.xp / 100) * FIELD_SIZE - 18,
                      top:  (zone.yp / 100) * FIELD_SIZE - 14,
                      minWidth: 36,
                      backgroundColor: isSelected ? zoneColor : 'rgba(255,255,255,0.88)',
                      borderRadius: 8,
                      paddingHorizontal: 4,
                      paddingVertical: 3,
                      borderWidth: 1.5,
                      borderColor: isSelected ? zoneColor : 'rgba(0,0,0,0.12)',
                      alignItems: 'center',
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{
                      fontSize: 7, fontWeight: '800', color: isSelected ? '#fff' : '#374151',
                      textAlign: 'center',
                    }}>
                      {zone.short}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selected zone label */}
            <Text style={{ marginTop: 6, fontSize: 12, color: '#6B7280', fontWeight: '600', height: 18 }}>
              {selected ? `📍 ${ZONES.find(z => z.id === selected)?.label}` : 'Tap the field to mark the shot'}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 4 }}>
            <TouchableOpacity
              onPress={handleSkip}
              style={{
                flex: 1, paddingVertical: 13, borderRadius: 14,
                backgroundColor: '#F3F4F6', alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: '#6B7280' }}>Skip</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfirm}
              style={{
                flex: 2, paddingVertical: 13, borderRadius: 14,
                backgroundColor: selected ? badgeColor : '#E5E7EB',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '800', color: selected ? '#fff' : '#9CA3AF' }}>
                {selected ? `Confirm  ${ZONES.find(z => z.id === selected)?.label}` : 'Select a zone'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
