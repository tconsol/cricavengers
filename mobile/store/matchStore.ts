import { create } from 'zustand';
import { api } from '@services/api';
import { onEvent } from '@services/socket';

interface Team {
  _id: string;
  name: string;
  shortName: string;
  logo: string | null;
  color: string;
  players: any[];
}

interface Match {
  _id: string;
  title: string;
  teamA: Team;
  teamB: Team;
  venue: string;
  scheduledAt: string;
  format: string;
  totalOvers: number;
  state: string;
  toss: any;
  innings: any;
  superOver: any;
  result: any;
  createdBy: any;
  roles: any[];
}

interface MatchState {
  matches: Match[];
  liveMatches: Match[];
  currentMatch: Match | null;
  isLoading: boolean;
  error: string | null;
  pagination: { total: number; page: number; pages: number };

  fetchMatches: (params?: Record<string, string>) => Promise<void>;
  fetchLiveMatches: () => Promise<void>;
  fetchMatch: (id: string) => Promise<void>;
  createMatch: (data: Record<string, unknown>) => Promise<Match>;
  setToss: (matchId: string, data: { winner: string; decision: string }) => Promise<void>;
  startInnings: (matchId: string, data: Record<string, unknown>) => Promise<void>;
  endMatchAsTie: (matchId: string) => Promise<void>;
  clearCurrentMatch: () => void;
  setCurrentMatch: (match: Match) => void;
  initSocketListeners: () => () => void;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  matches: [],
  liveMatches: [],
  currentMatch: null,
  isLoading: false,
  error: null,
  pagination: { total: 0, page: 1, pages: 1 },

  fetchMatches: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/matches', params) as any;
      set({
        matches: res.data,
        pagination: res.pagination,
      });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchLiveMatches: async () => {
    try {
      const res = await api.get('/matches/live') as any;
      set({ liveMatches: res.data.matches });
    } catch { /* silent */ }
  },

  fetchMatch: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get(`/matches/${id}`) as any;
      set({ currentMatch: res.data.match });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createMatch: async (data) => {
    const res = await api.post('/matches', data) as any;
    const match = res.data.match;
    // Dedup: socket MATCH_CREATED fires before the HTTP response, so match may already be in store
    set((s) => {
      const exists = s.matches.some((m) => m._id === match._id);
      return exists ? {} : { matches: [match, ...s.matches] };
    });
    return match;
  },

  setToss: async (matchId, data) => {
    const res = await api.post(`/matches/${matchId}/toss`, data as any) as any;
    set({ currentMatch: res.data.match });
  },

  startInnings: async (matchId, data) => {
    const res = await api.post(`/matches/${matchId}/innings/start`, data as any) as any;
    set({ currentMatch: res.data.match });
  },

  endMatchAsTie: async (matchId) => {
    const res = await api.post(`/matches/${matchId}/super-over/end-match`, {}) as any;
    set({ currentMatch: res.data.match });
  },

  clearCurrentMatch: () => set({ currentMatch: null }),
  setCurrentMatch: (match) => set({ currentMatch: match }),

  initSocketListeners: () => {
    // New match created → add populated match to list (teams/logo already populated by backend)
    const unsubCreated = onEvent('MATCH_CREATED', (data: any) => {
      const match: Match = data.match;
      set((s) => {
        const exists = s.matches.some((m) => m._id === match._id);
        return exists ? {} : { matches: [match, ...s.matches] };
      });
    });

    // State change (toss done, innings start, innings break, completed, abandoned)
    // Re-fetch both lists so home screen reflects the correct state without manual refresh
    const unsubState = onEvent('MATCH_STATE_CHANGED', (data: any) => {
      const updated: Match = data.match;
      if (updated) {
        set((s) => ({
          currentMatch: s.currentMatch?._id === updated._id ? { ...s.currentMatch, ...updated } : s.currentMatch,
        }));
      }
      // Re-fetch home data so Live Now / Recent Matches sections update instantly
      get().fetchLiveMatches();
      get().fetchMatches({ limit: '6' });
    });

    // Lightweight global score update — fired by backend after every ball
    const unsubBall = onEvent('LIVE_SCORE_UPDATE', (data: any) => {
      const matchId = (data?.matchId || '').toString();
      if (!matchId) return;
      set((s) => ({
        liveMatches: s.liveMatches.map((m) => {
          if (m._id !== matchId) return m;
          const key = data.innings === 2 ? 'second' : 'first';
          return {
            ...m,
            innings: {
              ...m.innings,
              [key]: {
                ...(m.innings?.[key] || {}),
                totalRuns: data.totalRuns ?? 0,
                wickets: data.wickets ?? 0,
                balls: (data.over ?? 0) * 6 + (data.ball ?? 0),
              },
            },
          };
        }),
      }));
    });

    // Match completed → move out of live, update in matches list
    const unsubCompleted = onEvent('MATCH_COMPLETED', (data: any) => {
      set((s) => ({
        liveMatches: s.liveMatches.filter((m) => m._id !== data.matchId),
        matches: s.matches.map((m) =>
          m._id === data.matchId ? { ...m, state: 'COMPLETED', result: data.result } : m
        ),
      }));
    });

    // BALL_REMOVED score revert is handled by the LIVE_SCORE_UPDATE emitted alongside it
    const unsubRemove = onEvent('BALL_REMOVED', (_data: any) => { /* handled by LIVE_SCORE_UPDATE */ });

    return () => { unsubCreated(); unsubState(); unsubBall(); unsubRemove(); unsubCompleted(); };
  },
}));
