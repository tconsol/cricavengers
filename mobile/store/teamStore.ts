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
  initSocketListeners: () => () => void;
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

  initSocketListeners: () => {
    const unsubCreated = onEvent('TEAM_CREATED', (data: any) => {
      const team: Team = data.team;
      set((s) => {
        const exists = s.teams.some((t) => t._id === team._id);
        return exists ? {} : { teams: [team, ...s.teams] };
      });
    });

    const unsubUpdated = onEvent('TEAM_UPDATED', (data: any) => {
      const updated: Team = data.team;
      set((s) => ({
        teams: s.teams.map((t) => t._id === updated._id ? { ...t, ...updated } : t),
        currentTeam: s.currentTeam?._id === updated._id ? { ...s.currentTeam, ...updated } : s.currentTeam,
      }));
    });

    const unsubDeleted = onEvent('TEAM_DELETED', (data: any) => {
      set((s) => ({
        teams: s.teams.filter((t) => t._id !== data.teamId),
        currentTeam: s.currentTeam?._id === data.teamId ? null : s.currentTeam,
      }));
    });

    return () => { unsubCreated(); unsubUpdated(); unsubDeleted(); };
  },
}));
