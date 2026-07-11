import AsyncStorage from '@react-native-async-storage/async-storage';
import Line from '@xmartlabs/react-native-line';

import { LINE_CHANNEL_ID } from '../../../shared/config/line';
import { apiUrl } from '../../../shared/config/api';

export type LineProfile = {
  accessToken: string;
  userId?: string | null;
  displayName?: string | null;
};

export type LineBackendAuthResult = {
  token: string;
  isNewAccount?: boolean;
  hasProfile?: boolean;
};

function createStatusError(message: string, status?: number) {
  const err = new Error(message) as Error & { status?: number };
  if (typeof status === 'number') err.status = status;
  return err;
}

let lineSetupDone = false;

export async function ensureLineConfigured() {
  if (!LINE_CHANNEL_ID) {
    throw new Error('LINE Sign-In is not configured. Set LINE_CHANNEL_ID in src/shared/config/line.ts');
  }
  if (!lineSetupDone) {
    // Don't await — the native setup() never resolves its promise (library bug),
    // but the work (storing channelId, creating API client) runs synchronously
    // on the native side before the promise would resolve.
    Line.setup({ channelId: LINE_CHANNEL_ID } as any);
    lineSetupDone = true;
  }
}

function readAccessToken(rawToken: any): string | null {
  if (!rawToken) return null;
  if (typeof rawToken === 'string') return rawToken;
  return (
    rawToken.accessToken ||
    rawToken.access_token ||
    rawToken.token ||
    rawToken.value ||
    rawToken.access_token_value ||
    null
  );
}

export async function lineSignInGetProfile(): Promise<LineProfile> {
  await ensureLineConfigured();

  // Starts the LINE SDK login flow (app if installed, browser otherwise).
  // Use web login to avoid app-switch callback edge cases on some Android setups.
  const loginResult = await Line.login({ scopes: ['profile'], onlyWebLogin: true } as any);

  // Prefer the token from the login result; fall back to getCurrentAccessToken
  let accessToken = readAccessToken(loginResult?.accessToken);
  if (!accessToken) {
    const tokenData = await Line.getCurrentAccessToken();
    accessToken = readAccessToken(tokenData);
  }
  if (!accessToken) {
    throw new Error('LINE Sign-In did not return an access token');
  }

  // Try to get profile from login result first, then from API
  let displayName: string | null = (loginResult as any)?.userProfile?.displayName ?? null;
  let userId: string | null = (loginResult as any)?.userProfile?.userId ?? null;

  if (!displayName) {
    try {
      const profile = await Line.getProfile();
      displayName = (profile as any)?.displayName ?? null;
      userId = (profile as any)?.userId ?? null;
    } catch {
      // ignore
    }
  }

  return {
    accessToken,
    userId,
    displayName,
  };
}

export async function lineBackendAuthenticate(params: {
  accessToken: string;
  userLabel?: string;
  mode?: 'login' | 'signup';
}): Promise<LineBackendAuthResult> {
  const mode = params.mode || 'signup';
  const resp = await fetch(apiUrl('/auth/line'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: params.accessToken, user_label: params.userLabel, mode }),
  });

  const text = await resp.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!resp.ok) {
    const msg = (data && (data.error || data.message)) || `LINE auth failed (status ${resp.status})`;
    throw createStatusError(msg, resp.status);
  }

  const token = (data && (data.token || data.access_token)) || null;
  if (!token) {
    throw new Error('LINE auth succeeded but no token was returned');
  }

  await AsyncStorage.setItem('authToken', token);
  const isNewAccount = !!(data && data.isNewAccount);
  const hasProfile = !!(data && data.hasProfile);
  return { token, isNewAccount, hasProfile };
}

export async function lineSignOutIfPossible() {
  try {
    await Line.logout();
  } catch {
    // ignore
  }
}
