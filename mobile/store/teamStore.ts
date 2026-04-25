import { create } from 'zustand';
import { api } from '@services/api';

interface Team {
  _id: string;
  name: string;
  shortName: string;
  logo: string | null;
  color: string;
  players: any[];
  createdBy: any;
  stats: Record<string, number>;
}

interface TeamState {
  teams: Team[];
  currentTeam: Team | null;
  isLoading: boolean;
  error: string | null;

  fetchTeams: (params?: Record<string, string>) => Promise<void>;
  fetchTeam: (id: string) => Promise<void>;
  createTeam: (data: Record<string, unknown>) => Promise<Team>;
  addPlayer: (teamId: string, player: Record<string, unknown>) => Promise<void>;
  removePlayer: (teamId: string, playerId: string) => Promise<void>;
}

export const useTeamStore = create<TeamState>((set) => ({
  teams: [],
  currentTeam: null,
  isLoading: false,
  error: null,

  fetchTeams: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/teams', params) as any;
      set({ teams: res.data });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTeam: async (id) => {
    set({ isLoading: true });
    try {
      const res = await api.get(`/teams/${id}`) as any;
      set({ currentTeam: res.data.team });
    } finally {
      set({ isLoading: false });
    }
  },

  createTeam: async (data) => {
    const res = await api.post('/teams', data) as any;
    const team = res.data.team;
    set((s) => ({ teams: [team, ...s.teams] }));
    return team;
  },

  addPlayer: async (teamId, player) => {
    const res = await api.post(`/teams/${teamId}/players`, player) as any;
    set({ currentTeam: res.data.team });
  },

  removePlayer: async (teamId, playerId) => {
    const res = await api.delete(`/teams/${teamId}/players/${playerId}`) as any;
    set({ currentTeam: res.data.team });
  },
}));
