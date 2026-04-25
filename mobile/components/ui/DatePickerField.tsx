import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  Platform, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function daysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate();
}

function Col({
  items, selected, onSelect,
}: { items: (string | number)[]; selected: number | string; onSelect: (v: any) => void }) {
  return (
    <FlatList
      data={items}
      keyExtractor={(_, i) => String(i)}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1, maxHeight: 200 }}
      contentContainerStyle={{ paddingVertical: 8 }}
      renderItem={({ item }) => {
        const active = item === selected;
        return (
          <TouchableOpacity
            onPress={() => onSelect(item)}
            style={{
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: active ? '#1E3A5F' : 'transparent',
              borderRadius: 10,
              marginHorizontal: 4,
              marginVertical: 2,
            }}
          >
            <Text style={{
              fontWeight: active ? 'bold' : '400',
              color: active ? '#fff' : '#374151',
              fontSize: 15,
            }}>
              {typeof item === 'number' ? String(item).padStart(2, '0') : item}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

interface Props {
  label: string;
  value: string;         // ISO string or ''
  onChange: (iso: string) => void;
  minYear?: number;
  maxYear?: number;
}

export default function DatePickerField({ label, value, onChange, minYear = 2020, maxYear = 2035 }: Props) {
  const parsed = value ? new Date(value) : null;
  const [open, setOpen] = useState(false);
  const [day,   setDay]   = useState(parsed ? parsed.getDate()         : new Date().getDate());
  const [month, setMonth] = useState(parsed ? parsed.getMonth()        : new Date().getMonth());
  const [year,  setYear]  = useState(parsed ? parsed.getFullYear()     : new Date().getFullYear());

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  const confirm = () => {
    const maxDay = daysInMonth(month, year);
    const d = Math.min(day, maxDay);
    const iso = new Date(year, month, d).toISOString().slice(0, 10);
    onChange(iso);
    setOpen(false);
  };

  const displayDate = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row', alignItems: 'center',
          borderWidth: 1, borderColor: value ? '#1E3A5F' : '#E5E7EB',
          backgroundColor: value ? '#EFF6FF' : '#F9FAFB',
          borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
          marginBottom: 12,
        }}
      >
        <Ionicons name="calendar-outline" size={18} color={value ? '#1E3A5F' : '#9CA3AF'} style={{ marginRight: 10 }} />
        <Text style={{ flex: 1, fontSize: 15, color: value ? '#1E3A5F' : '#9CA3AF', fontWeight: value ? '600' : '400' }}>
          {displayDate || label}
        </Text>
        {value ? (
          <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onChange(''); }}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
        )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={() => setOpen(false)}>
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ flex: 1, fontSize: 17, fontWeight: 'bold', color: '#111827' }}>{label}</Text>
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Ionicons name="close" size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 16, overflow: 'hidden' }}>
                {/* Day */}
                <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#F3F4F6' }}>
                  <Text style={{ textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#9CA3AF', paddingTop: 8 }}>DAY</Text>
                  <Col
                    items={Array.from({ length: daysInMonth(month, year) }, (_, i) => i + 1)}
                    selected={day}
                    onSelect={setDay}
                  />
                </View>
                {/* Month */}
                <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: '#F3F4F6' }}>
                  <Text style={{ textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#9CA3AF', paddingTop: 8 }}>MONTH</Text>
                  <Col items={MONTHS} selected={MONTHS[month]} onSelect={(v) => setMonth(MONTHS.indexOf(v))} />
                </View>
                {/* Year */}
                <View style={{ flex: 1 }}>
                  <Text style={{ textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#9CA3AF', paddingTop: 8 }}>YEAR</Text>
                  <Col items={years} selected={year} onSelect={setYear} />
                </View>
              </View>

              <TouchableOpacity
                onPress={confirm}
                style={{ backgroundColor: '#1E3A5F', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 16 }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Confirm Date</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
