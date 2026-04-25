import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api } from './api';

const QUEUE_KEY = 'offline_scoring_queue';

export interface OfflineAction {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body: Record<string, unknown>;
  matchId: string;
  createdAt: string;
  retries: number;
  maxRetries: number;
}

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000];

export const enqueueAction = async (action: Omit<OfflineAction, 'id' | 'createdAt' | 'retries' | 'maxRetries'>): Promise<string> => {
  const queue = await getQueue();
  const id = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const newAction: OfflineAction = {
    ...action,
    id,
    createdAt: new Date().toISOString(),
    retries: 0,
    maxRetries: MAX_RETRIES,
  };
  queue.push(newAction);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return id;
};

export const getQueue = async (): Promise<OfflineAction[]> => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
};

export const removeFromQueue = async (id: string): Promise<void> => {
  const queue = await getQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter((a) => a.id !== id)));
};

export const getPendingCount = async (): Promise<number> => {
  const q = await getQueue();
  return q.length;
};

export const syncQueue = async (): Promise<{ synced: number; failed: number }> => {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return { synced: 0, failed: 0 };

  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const action of [...queue]) {
    try {
      if (action.method === 'POST') {
        await api.post(action.endpoint, action.body);
      } else if (action.method === 'PUT') {
        await api.put(action.endpoint, action.body);
      } else if (action.method === 'DELETE') {
        await api.delete(action.endpoint);
      }
      await removeFromQueue(action.id);
      synced++;
    } catch (err) {
      action.retries++;
      if (action.retries >= action.maxRetries) {
        await removeFromQueue(action.id);
        failed++;
      } else {
        const updated = await getQueue();
        const idx = updated.findIndex((a) => a.id === action.id);
        if (idx >= 0) {
          updated[idx] = action;
          await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
        }
      }
    }
  }

  return { synced, failed };
};

// Subscribe to network changes and auto-sync
export const startSyncListener = (): (() => void) => {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      syncQueue().catch(console.error);
    }
  });
};
