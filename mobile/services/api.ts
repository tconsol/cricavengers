import { API_BASE_URL } from '@constants/index';
import { tokenStorage } from './tokenStorage';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions {
  method?: Method;
  body?: Record<string, unknown> | null;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

let isRefreshing = false;
let pendingQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null) => {
  pendingQueue.forEach((p) => error ? p.reject(error) : p.resolve(token!));
  pendingQueue = [];
};

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, headers = {}, skipAuth = false } = options;

  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString();
    url += `?${qs}`;
  }

  const accessToken = tokenStorage.getAccessToken();

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (!skipAuth && accessToken) {
    requestHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (response.status === 401 && data.code === 'TOKEN_EXPIRED' && !skipAuth) {
    return _handleTokenRefresh<T>(endpoint, options);
  }

  if (!response.ok) {
    throw new APIError(response.status, data.code || 'UNKNOWN', data.message || 'Request failed');
  }

  return data;
}

async function _handleTokenRefresh<T>(endpoint: string, options: RequestOptions): Promise<T> {
  if (isRefreshing) {
    return new Promise<T>((resolve, reject) => {
      pendingQueue.push({
        resolve: (token) => resolve(request<T>(endpoint, {
          ...options,
          headers: { ...options.headers, Authorization: `Bearer ${token}` },
        })),
        reject,
      });
    });
  }

  isRefreshing = true;
  const refreshToken = tokenStorage.getRefreshToken();

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json();

    if (!res.ok) throw new APIError(res.status, data.code, data.message);

    const newAccessToken: string = data.data.accessToken;
    const newRefreshToken: string = data.data.refreshToken;
    tokenStorage.setTokens(newAccessToken, newRefreshToken);
    processQueue(null, newAccessToken);

    return request<T>(endpoint, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${newAccessToken}` },
    });
  } catch (err) {
    processQueue(err, null);
    tokenStorage.triggerLogout();
    throw err;
  } finally {
    isRefreshing = false;
  }
}

export const api = {
  get:    <T>(endpoint: string, params?: Record<string, string | number | boolean>) =>
            request<T>(endpoint, { method: 'GET', params }),
  post:   <T>(endpoint: string, body: Record<string, unknown>) =>
            request<T>(endpoint, { method: 'POST', body }),
  put:    <T>(endpoint: string, body: Record<string, unknown>) =>
            request<T>(endpoint, { method: 'PUT', body }),
  delete: <T>(endpoint: string) =>
            request<T>(endpoint, { method: 'DELETE' }),
  patch:  <T>(endpoint: string, body: Record<string, unknown>) =>
            request<T>(endpoint, { method: 'PATCH', body }),
  postNoAuth: <T>(endpoint: string, body: Record<string, unknown>) =>
            request<T>(endpoint, { method: 'POST', body, skipAuth: true }),
};

export { APIError };
