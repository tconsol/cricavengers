import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, Animated, Dimensions, GestureResponderEvent,
} from 'react-native';

const { width: SW } = Dimensions.get('window');
const FIELD_SIZE = Math.min(SW - 32, 300);
const HALF = FIELD_SIZE / 2;

// Batsman's-eye view: stumps/batsman end at TOP, bowler/straight end at BOTTOM
// LEG SIDE = LEFT, OFF SIDE = RIGHT
const ZONES = [
  // Near batsman — top of field (behind square)
  { id: 'fine_leg',   label: 'Fine Leg',  short: 'FL',  xp: 17, yp: 17, leg: true  },
  { id: 'third_man',  label: 'Third Man', short: 'TM',  xp: 68, yp: 11, leg: false },
  { id: 'gully',      label: 'Gully',     short: 'GY',  xp: 78, yp: 26, leg: false },
  { id: 'square_leg', label: 'Sq Leg',    short: 'SqL', xp: 9,  yp: 44, leg: true  },
  { id: 'point',      label: 'Point',     short: 'PT',  xp: 87, yp: 44, leg: false },
  // Mid field
  { id: 'mid_wicket', label: 'Mid Wkt',   short: 'MW',  xp: 14, yp: 64, leg: true  },
  { id: 'cover',      label: 'Cover',     short: 'CV',  xp: 83, yp: 62, leg: false },
  { id: 'mid_on',     label: 'Mid On',    short: 'MO',  xp: 28, yp: 81, leg: true  },
  { id: 'mid_off',    label: 'Mid Off',   short: 'MOF', xp: 72, yp: 81, leg: false },
  // Boundary — bottom of field (straight / bowler end)
  { id: 'long_on',    label: 'Long On',   short: 'LON', xp: 35, yp: 91, leg: true  },
  { id: 'straight',   label: 'Straight',  short: 'ST',  xp: 50, yp: 93, leg: false },
  { id: 'long_off',   label: 'Long Off',  short: 'LOF', xp: 65, yp: 91, leg: false },
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
  const slideAnim = useRef(new Animated.Value(80)).current;
  const ballAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelected(null);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 160, friction: 18, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(80);
      ballAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    if (selected) {
      ballAnim.setValue(0);
      Animated.timing(ballAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [selected]);

  const autoConfirmRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (selected) {
      if (autoConfirmRef.current) clearTimeout(autoConfirmRef.current);
      autoConfirmRef.current = setTimeout(() => onConfirm(selected), 500);
    }
    return () => { if (autoConfirmRef.current) clearTimeout(autoConfirmRef.current); };
  }, [selected]);

  const handleFieldTap = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const tapXPct = (locationX / FIELD_SIZE) * 100;
    const tapYPct = (locationY / FIELD_SIZE) * 100;
    let nearest = ZONES[0];
    let minDist = Infinity;
    for (const z of ZONES) {
      const d = Math.sqrt((z.xp - tapXPct) ** 2 + (z.yp - tapYPct) ** 2);
      if (d < minDist) { minDist = d; nearest = z; }
    }
    setSelected(nearest.id === selected ? null : nearest.id);
  };

  const badgeColor = isWicket ? '#EF4444' : runs === 6 ? '#16A34A' : runs === 4 ? '#2563EB' : '#475569';
  const badgeText  = isWicket ? 'W' : isExtra ? 'E' : String(runs);

  const selectedZone = ZONES.find(z => z.id === selected);
  const ballX = selectedZone ? (selectedZone.xp / 100) * FIELD_SIZE - HALF : 0;
  const ballY = selectedZone ? (selectedZone.yp / 100) * FIELD_SIZE - HALF : 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => onConfirm(null)}>
      <Animated.View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end', opacity: fadeAnim,
      }}>
        <Animated.View style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingBottom: 28,
          transform: [{ translateY: slideAnim }],
        }}>
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' }} />
          </View>

          {/* Header: run badge + commentary */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 12,
            paddingHorizontal: 20, paddingVertical: 10,
            borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
          }}>
            <View style={{
              width: 46, height: 46, borderRadius: 23,
              backgroundColor: badgeColor, alignItems: 'center', justifyContent: 'center',
              shadowColor: badgeColor, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
              elevation: 5,
            }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 22 }}>{badgeText}</Text>
            </View>
            <Text style={{ flex: 1, fontWeight: '700', color: '#111827', fontSize: 13, lineHeight: 19 }} numberOfLines={3}>
              {commentary}
            </Text>
          </View>

          {/* Field */}
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            {/* Top labels row: LEG | BATSMAN ↑ | OFF */}
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              width: FIELD_SIZE, paddingHorizontal: 6, marginBottom: 3,
            }}>
              <Text style={{ fontSize: 8, color: '#A78BFA', fontWeight: '800', letterSpacing: 0.5 }}>◄ LEG</Text>
              <Text style={{ fontSize: 8, color: '#6B7280', fontWeight: '700', letterSpacing: 0.8 }}>▲ BATSMAN END</Text>
              <Text style={{ fontSize: 8, color: '#60A5FA', fontWeight: '800', letterSpacing: 0.5 }}>OFF ►</Text>
            </View>

            <TouchableOpacity
              activeOpacity={1}
              onPress={handleFieldTap}
              style={{ width: FIELD_SIZE, height: FIELD_SIZE, position: 'relative' }}
            >
              {/* Oval field */}
              <View style={{
                position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
                borderRadius: HALF, backgroundColor: '#D1FAE5',
                borderWidth: 2.5, borderColor: '#34D399',
              }} />

              {/* 30-yard inner circle (properly centered) */}
              <View style={{
                position: 'absolute',
                left: FIELD_SIZE * 0.25, top: FIELD_SIZE * 0.25,
                width: FIELD_SIZE * 0.5, height: FIELD_SIZE * 0.5,
                borderRadius: FIELD_SIZE * 0.25,
                borderWidth: 1.5, borderColor: '#6EE7B7', borderStyle: 'dashed',
                backgroundColor: 'transparent',
              }} />

              {/* Pitch — vertical strip, batsman-end at top */}
              <View style={{
                position: 'absolute',
                left: HALF - 10, top: HALF - 26,
                width: 20, height: 50,
                backgroundColor: '#D4B896', borderRadius: 3,
                borderWidth: 1, borderColor: '#B5956A',
              }} />

              {/* Batsman stumps at top of pitch */}
              <View style={{
                position: 'absolute', left: HALF - 8, top: HALF - 36,
                flexDirection: 'row', gap: 4,
              }}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={{ width: 2.5, height: 12, backgroundColor: '#1E3A5F', borderRadius: 1.5 }} />
                ))}
              </View>

              {/* Ball trail from center to zone */}
              {selected && selectedZone && (
                <Animated.View style={{
                  position: 'absolute',
                  left: HALF - 5, top: HALF - 5,
                  width: 10, height: 10, borderRadius: 5,
                  backgroundColor: badgeColor,
                  opacity: ballAnim,
                  transform: [
                    { translateX: ballAnim.interpolate({ inputRange: [0, 1], outputRange: [0, ballX] }) },
                    { translateY: ballAnim.interpolate({ inputRange: [0, 1], outputRange: [0, ballY] }) },
                  ],
                }} />
              )}

              {/* Zone labels */}
              {ZONES.map((zone) => {
                const isSelected = selected === zone.id;
                const zoneColor = zone.leg ? '#7C3AED' : '#1D4ED8';
                return (
                  <View
                    key={zone.id}
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: (zone.xp / 100) * FIELD_SIZE - 18,
                      top:  (zone.yp / 100) * FIELD_SIZE - 12,
                      minWidth: 34,
                      backgroundColor: isSelected ? zoneColor : 'rgba(255,255,255,0.92)',
                      borderRadius: 7,
                      paddingHorizontal: 4, paddingVertical: 3,
                      borderWidth: isSelected ? 0 : 1,
                      borderColor: 'rgba(0,0,0,0.09)',
                      alignItems: 'center',
                      shadowColor: isSelected ? zoneColor : '#000',
                      shadowOpacity: isSelected ? 0.28 : 0.07,
                      shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
                      elevation: isSelected ? 4 : 1,
                    }}
                  >
                    <Text style={{
                      fontSize: 7.5, fontWeight: '800',
                      color: isSelected ? '#fff' : '#374151',
                      textAlign: 'center',
                    }}>
                      {zone.short}
                    </Text>
                  </View>
                );
              })}
            </TouchableOpacity>

            {/* Bottom label */}
            <Text style={{ fontSize: 8, color: '#9CA3AF', fontWeight: '700', letterSpacing: 0.8, marginTop: 3 }}>
              ▼ BOWLER END
            </Text>

            {/* Selected zone hint */}
            <Text style={{
              marginTop: 4, fontSize: 12, fontWeight: '700', height: 18,
              color: selected ? '#1E40AF' : '#9CA3AF',
            }}>
              {selected ? `📍 ${ZONES.find(z => z.id === selected)?.label}` : 'Tap the field to mark the shot'}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 10 }}>
            <TouchableOpacity
              onPress={() => onConfirm(null)}
              style={{
                flex: 1, paddingVertical: 13, borderRadius: 14,
                backgroundColor: '#F3F4F6', alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: '#6B7280', fontSize: 14 }}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onConfirm(selected)}
              style={{
                flex: 2, paddingVertical: 13, borderRadius: 14,
                backgroundColor: selected ? badgeColor : '#E5E7EB', alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '800', fontSize: 14, color: selected ? '#fff' : '#9CA3AF' }}>
                {selected ? `Confirm · ${ZONES.find(z => z.id === selected)?.label}` : 'Select a zone'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
