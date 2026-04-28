import { create } from 'zustand';
import { api } from '@services/api';
import { onEvent } from '@services/socket';

export interface TournamentTeam {
  _id: string;
  name: string;
  shortName: string;
  color: string;
  logo: string | null;
}

export interface StandingsEntry {
  teamId: string | TournamentTeam;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  nrr: number;
}

export interface Fixture {
  _id: string;
  matchId: any;
  teamA: TournamentTeam;
  teamB: TournamentTeam;
  round: number;
  group: string | null;
  stage: string;
  status: string;
  scheduledAt: string | null;
  result: { winner: string | null; scoreA: string | null; scoreB: string | null };
}

export interface TeamRequest {
  _id: string;
  teamId: TournamentTeam;
  teamName: string;
  requestedBy: { name: string };
  status: string;
  requestedAt: string;
}

export interface Tournament {
  _id: string;
  name: string;
  description: string;
  format: string;
  matchFormat: string;
  totalOvers: number;
  venue: string;
  startDate: string | null;
  endDate: string | null;
  maxTeams: number;
  state: string;
  createdBy: any;
  teams: TournamentTeam[];
  teamRequests: TeamRequest[];
  fixtures: Fixture[];
  standings: StandingsEntry[];
  prizePool: string;
  rules: string;
  logo: string | null;
  teamCount: number;
  fixtureCount: number;
}

interface TournamentState {
  tournaments: Tournament[];
  currentTournament: Tournament | null;
  standings: StandingsEntry[];
  isLoading: boolean;
  error: string | null;
  pagination: { total: number; page: number; pages: number };

  fetchTournaments: (params?: Record<string, string>) => Promise<void>;
  fetchTournament: (id: string) => Promise<void>;
  createTournament: (data: Record<string, unknown>) => Promise<Tournament>;
  updateTournament: (id: string, data: Record<string, unknown>) => Promise<Tournament>;
  deleteTournament: (id: string) => Promise<void>;

  registerTeam: (tournamentId: string, teamId: string) => Promise<void>;
  approveRequest: (tournamentId: string, requestId: string) => Promise<void>;
  rejectRequest: (tournamentId: string, requestId: string) => Promise<void>;
  removeTeam: (tournamentId: string, teamId: string) => Promise<void>;

  generateFixtures: (tournamentId: string) => Promise<void>;
  deleteFixtures: (tournamentId: string) => Promise<void>;

  fetchStandings: (tournamentId: string) => Promise<void>;

  clearCurrent: () => void;
  initSocketListeners: () => () => void;
}

export const useTournamentStore = create<TournamentState>((set, get) => ({
  tournaments: [],
  currentTournament: null,
  standings: [],
  isLoading: false,
  error: null,
  pagination: { total: 0, page: 1, pages: 1 },

  fetchTournaments: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/tournaments', params) as any;
      set({ tournaments: res.data, pagination: res.pagination });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTournament: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get(`/tournaments/${id}`) as any;
      set({ currentTournament: res.data.tournament });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createTournament: async (data) => {
    const res = await api.post('/tournaments', data) as any;
    const t = res.data.tournament;
    set((s) => ({ tournaments: [t, ...s.tournaments] }));
    return t;
  },

  updateTournament: async (id, data) => {
    const res = await api.put(`/tournaments/${id}`, data) as any;
    const t = res.data.tournament;
    set((s) => ({
      tournaments: s.tournaments.map((x) => (x._id === id ? t : x)),
      currentTournament: s.currentTournament?._id === id ? t : s.currentTournament,
    }));
    return t;
  },

  deleteTournament: async (id) => {
    await api.delete(`/tournaments/${id}`);
    set((s) => ({ tournaments: s.tournaments.filter((x) => x._id !== id) }));
  },

  registerTeam: async (tournamentId, teamId) => {
    const res = await api.post(`/tournaments/${tournamentId}/register`, { teamId }) as any;
    set({ currentTournament: res.data.tournament });
  },

  approveRequest: async (tournamentId, requestId) => {
    const res = await api.post(`/tournaments/${tournamentId}/requests/${requestId}/approve`, {}) as any;
    set({ currentTournament: res.data.tournament });
  },

  rejectRequest: async (tournamentId, requestId) => {
    const res = await api.post(`/tournaments/${tournamentId}/requests/${requestId}/reject`, {}) as any;
    set({ currentTournament: res.data.tournament });
  },

  removeTeam: async (tournamentId, teamId) => {
    const res = await api.delete(`/tournaments/${tournamentId}/teams/${teamId}`) as any;
    set({ currentTournament: res.data.tournament });
  },

  generateFixtures: async (tournamentId) => {
    const res = await api.post(`/tournaments/${tournamentId}/fixtures`, {}) as any;
    set({ currentTournament: res.data.tournament });
  },

  deleteFixtures: async (tournamentId) => {
    const res = await api.delete(`/tournaments/${tournamentId}/fixtures`) as any;
    set({ currentTournament: res.data.tournament });
  },

  fetchStandings: async (tournamentId) => {
    const res = await api.get(`/tournaments/${tournamentId}/standings`) as any;
    set({ standings: res.data.standings });
  },

  clearCurrent: () => set({ currentTournament: null, standings: [] }),

  initSocketListeners: () => {
    const unsubCreated = onEvent('TOURNAMENT_CREATED', (data: any) => {
      const t: Tournament = data.tournament;
      set((s) => {
        const exists = s.tournaments.some((x) => x._id === t._id);
        return exists ? {} : { tournaments: [t, ...s.tournaments] };
      });
    });

    const unsubUpdated = onEvent('TOURNAMENT_UPDATED', (data: any) => {
      const updated: Tournament = data.tournament;
      set((s) => ({
        tournaments: s.tournaments.map((x) => x._id === updated._id ? { ...x, ...updated } : x),
        currentTournament: s.currentTournament?._id === updated._id
          ? { ...s.currentTournament, ...updated }
          : s.currentTournament,
      }));
    });

    const unsubDeleted = onEvent('TOURNAMENT_DELETED', (data: any) => {
      set((s) => ({
        tournaments: s.tournaments.filter((x) => x._id !== data.tournamentId),
        currentTournament: s.currentTournament?._id === data.tournamentId ? null : s.currentTournament,
      }));
    });

    const unsubStandings = onEvent('TOURNAMENT_STANDINGS_UPDATED', (data: any) => {
      set((s) => ({
        standings: s.currentTournament?._id === data.tournamentId ? data.standings : s.standings,
        currentTournament: s.currentTournament?._id === data.tournamentId
          ? { ...s.currentTournament, standings: data.standings }
          : s.currentTournament,
      }));
    });

    return () => { unsubCreated(); unsubUpdated(); unsubDeleted(); unsubStandings(); };
  },
}));
