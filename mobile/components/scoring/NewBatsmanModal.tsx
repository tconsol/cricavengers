import { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useScoringStore } from '@store/scoringStore';
import { api } from '@services/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  match: any;
  innings: number;
  matchId: string;
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  bowler:      { bg: '#FEE2E2', text: '#DC2626' },
  'all-rounder': { bg: '#DCFCE7', text: '#16A34A' },
  batsman:     { bg: '#EFF6FF', text: '#2563EB' },
  'wicket-keeper': { bg: '#F5F3FF', text: '#7C3AED' },
};

export default function NewBatsmanModal({ visible, onClose, match, innings, matchId }: Props) {
  const { liveState, summary } = useScoringStore();
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const battingTeamId = innings === 1
    ? match?.innings?.first?.battingTeam?._id?.toString() || match?.innings?.first?.battingTeam?.toString()
    : match?.innings?.second?.battingTeam?._id?.toString() || match?.innings?.second?.battingTeam?.toString();

  // Prefer match squad (has cricket roles) over full team player list
  const squadKey = battingTeamId === (match?.teamA?._id?.toString() || match?.teamA?.toString()) ? 'squadA' : 'squadB';
  const squad: any[] = match?.[squadKey] || [];

  const nonStrikerId = (liveState?.nonStriker?._id || liveState?.nonStriker)?.toString();

  // Collect dismissed player IDs from the current innings batting stats
  const inningsSummary = summary?.innings?.[innings - 1];
  const dismissedIds = new Set<string>(
    (inningsSummary?.batting || [])
      .filter((b: any) => b.isOut)
      .map((b: any) => b.playerId?.toString())
  );

  // Full player pool: prefer squad, fall back to team.players
  const allPlayers = squad.length > 0 ? squad : (
    battingTeamId === (match?.teamA?._id?.toString() || match?.teamA?.toString())
      ? match?.teamA?.players : match?.teamB?.players
  ) || [];

  const availablePlayers = allPlayers.filter((p: any) => {
    const pid = (p.userId?._id || p.userId)?.toString();
    return pid !== nonStrikerId && !dismissedIds.has(pid);
  });

  const handleSelect = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await api.put(`/scoring/matches/${matchId}/players`, {
        striker:    selected,
        nonStriker: liveState?.nonStriker?._id || liveState?.nonStriker,
        bowler:     liveState?.currentBowler?._id || liveState?.currentBowler,
      } as any) as any;

      // Use the populated API response directly — avoids a second round-trip
      // and guarantees striker.name is available immediately in score.tsx
      const newSummary = res.data?.summary;
      if (newSummary) {
        useScoringStore.setState({ summary: newSummary, liveState: newSummary.currentState || null });
      }
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
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 32, paddingTop: 16 }}>
          {/* Drag handle */}
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' }} />
          </View>

          <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 2 }}>Wicket!</Text>
          <Text style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 16 }}>Select the next batsman</Text>

          {availablePlayers.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🏏</Text>
              <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 15 }}>All players have batted</Text>
              <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>Innings complete or all out</Text>
            </View>
          ) : (
            <FlatList
              data={availablePlayers}
              keyExtractor={(p: any) => (p.userId?._id || p.userId)?.toString() || p.name}
              renderItem={({ item }: any) => {
                const pid = (item.userId?._id || item.userId)?.toString();
                const roleStyle = ROLE_COLORS[item.role?.toLowerCase()] || { bg: '#F3F4F6', text: '#6B7280' };
                const isSelected = selected === pid;
                return (
                  <TouchableOpacity
                    onPress={() => setSelected(pid)}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingHorizontal: 14, paddingVertical: 12,
                      borderRadius: 14, marginBottom: 8,
                      backgroundColor: isSelected ? '#FFF7ED' : '#F9FAFB',
                      borderWidth: 2, borderColor: isSelected ? '#F59E0B' : '#F3F4F6',
                    }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ fontWeight: '900', color: '#D97706', fontSize: 13 }}>
                        {item.jerseyNumber ?? item.name?.slice(0, 2)?.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={{ flex: 1, fontWeight: '700', color: '#111827', fontSize: 14 }} numberOfLines={1}>{item.name}</Text>
                    {item.role ? (
                      <View style={{ backgroundColor: roleStyle.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: roleStyle.text, textTransform: 'capitalize' }}>{item.role}</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
            />
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity
              onPress={() => { setSelected(''); onClose(); }}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '700', color: '#6B7280' }}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSelect}
              disabled={!selected || submitting}
              style={{
                flex: 2, paddingVertical: 14, borderRadius: 18, alignItems: 'center',
                backgroundColor: selected && !submitting ? '#1E3A5F' : '#E5E7EB',
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontWeight: '800', fontSize: 15, color: selected ? '#fff' : '#9CA3AF' }}>
                  Confirm
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
