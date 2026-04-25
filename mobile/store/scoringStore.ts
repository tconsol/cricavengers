import { create } from 'zustand';
import { api } from '@services/api';
import { enqueueAction, syncQueue } from '@services/offlineSync';
import NetInfo from '@react-native-community/netinfo';

interface BallData {
  innings: 1 | 2;
  batsman: string;
  bowler: string;
  runs: number;
  extras?: { type: string | null; runs: number } | null;
  wicket?: { type: string; batsmanOut: string; fielder?: string | null } | null;
  strikerAfter?: string | null;
  nonStrikerAfter?: string | null;
  newBatsman?: string | null;
}

interface LiveState {
  innings: number;
  over: number;
  ball: number;
  totalRuns: number;
  wickets: number;
  striker: any | null;
  nonStriker: any | null;
  currentBowler: any | null;
  target: number | null;
  requiredRuns: number | null;
  requiredRate: number | null;
  currentRate: number;
}

interface ScoringState {
  summary: any | null;
  liveState: LiveState | null;
  recentBalls: any[];
  allBalls: any[];
  isLoading: boolean;
  pendingOfflineBalls: BallData[];
  lastError: string | null;

  addBall: (matchId: string, data: BallData) => Promise<void>;
  undoBall: (matchId: string, innings: number) => Promise<void>;
  editBall: (matchId: string, ballId: string, data: Partial<BallData>) => Promise<void>;
  deleteBall: (matchId: string, ballId: string) => Promise<void>;
  fetchSummary: (matchId: string) => Promise<void>;
  fetchRecentBalls: (matchId: string, innings: number, count?: number) => Promise<void>;
  fetchAllBalls: (matchId: string, innings: number) => Promise<void>;
  setLiveUpdate: (data: any) => void;
  syncOffline: () => Promise<void>;
  reset: () => void;
}

export const useScoringStore = create<ScoringState>((set, get) => ({
  summary: null,
  liveState: null,
  recentBalls: [],
  allBalls: [],
  isLoading: false,
  pendingOfflineBalls: [],
  lastError: null,

  addBall: async (matchId, data) => {
    set({ lastError: null });

    const netState = await NetInfo.fetch();

    if (!netState.isConnected) {
      // Offline: queue the action and optimistically update local state
      await enqueueAction({
        endpoint: `/scoring/matches/${matchId}/balls`,
        method: 'POST',
        body: data as any,
        matchId,
      });

      // Optimistic local update
      const optimisticBall = { ...data, _id: `temp_${Date.now()}`, isTemp: true };
      set((s) => ({
        recentBalls: [optimisticBall, ...s.recentBalls].slice(0, 12),
        pendingOfflineBalls: [...s.pendingOfflineBalls, data],
        liveState: s.liveState ? {
          ...s.liveState,
          totalRuns: s.liveState.totalRuns + data.runs + (data.extras?.runs || 0),
          wickets: s.liveState.wickets + (data.wicket ? 1 : 0),
        } : null,
      }));
      return;
    }

    try {
      const res = await api.post(`/scoring/matches/${matchId}/balls`, data as any) as any;
      const { ball, summary } = res.data;

      set((s) => ({
        summary,
        liveState: summary?.currentState || null,
        recentBalls: [ball, ...s.recentBalls].slice(0, 12),
      }));
    } catch (err: any) {
      set({ lastError: err.message });
      throw err;
    }
  },

  undoBall: async (matchId, innings) => {
    const res = await api.post(`/scoring/matches/${matchId}/innings/${innings}/undo`, {}) as any;
    set({
      summary: res.data.summary,
      liveState: res.data.summary?.currentState || null,
    });
    await get().fetchRecentBalls(matchId, innings);
  },

  editBall: async (matchId, ballId, data) => {
    const res = await api.put(`/scoring/matches/${matchId}/balls/${ballId}`, data as any) as any;
    set({ summary: res.data.summary, liveState: res.data.summary?.currentState || null });
  },

  deleteBall: async (matchId, ballId) => {
    const res = await api.delete(`/scoring/matches/${matchId}/balls/${ballId}`) as any;
    set({ summary: res.data.summary, liveState: res.data.summary?.currentState || null });
  },

  fetchSummary: async (matchId) => {
    set({ isLoading: true });
    try {
      const res = await api.get(`/scoring/matches/${matchId}/live`) as any;
      const summary = res.data.summary;
      set({ summary, liveState: summary?.currentState || null });
    } catch (err: any) {
      set({ lastError: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRecentBalls: async (matchId, innings, count = 12) => {
    try {
      const res = await api.get(`/scoring/matches/${matchId}/innings/${innings}/balls/recent`, { count }) as any;
      set({ recentBalls: res.data.balls });
    } catch { /* silent */ }
  },

  fetchAllBalls: async (matchId, innings) => {
    set({ isLoading: true });
    try {
      const res = await api.get(`/scoring/matches/${matchId}/innings/${innings}/balls`) as any;
      set({ allBalls: res.data.balls });
    } finally {
      set({ isLoading: false });
    }
  },

  setLiveUpdate: (data) => {
    if (data.summary) {
      set({ summary: data.summary, liveState: data.summary?.currentState || null });
    }
    if (data.ball) {
      set((s) => {
        if (s.recentBalls.some((b) => b._id && b._id === data.ball._id)) return {};
        return { recentBalls: [data.ball, ...s.recentBalls].slice(0, 12) };
      });
    }
  },

  syncOffline: async () => {
    const { synced, failed } = await syncQueue();
    if (synced > 0) set({ pendingOfflineBalls: [] });
  },

  reset: () => set({
    summary: null,
    liveState: null,
    recentBalls: [],
    allBalls: [],
    pendingOfflineBalls: [],
    lastError: null,
  }),
}));
