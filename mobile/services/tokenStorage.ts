/**
 * Shared token state — imported by both api.ts and authStore.ts.
 * Breaking the circular dep: authStore → api → authStore.
 * Neither api.ts nor authStore.ts imports the other; both import this module.
 */
let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _logoutHandler: (() => void) | null = null;

export const tokenStorage = {
  getAccessToken:       () => _accessToken,
  getRefreshToken:      () => _refreshToken,
  setAccessToken:       (t: string | null) => { _accessToken = t; },
  setRefreshToken:      (t: string | null) => { _refreshToken = t; },
  setTokens:            (at: string, rt: string) => { _accessToken = at; _refreshToken = rt; },
  clearTokens:          () => { _accessToken = null; _refreshToken = null; },
  registerLogout:       (fn: () => void) => { _logoutHandler = fn; },
  triggerLogout:        () => _logoutHandler?.(),
};
