import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessToken, LoginManager, Profile } from 'react-native-fbsdk-next';

import { FACEBOOK_APP_ID } from '../../../shared/config/facebook';
import { apiUrl } from '../../../shared/config/api';

export type FacebookProfile = {
  accessToken: string;
  userId?: string | null;
  displayName?: string | null;
};

export type FacebookBackendAuthResult = {
  token: string;
  isNewAccount?: boolean;
  hasProfile?: boolean;
};

function createStatusError(message: string, status?: number) {
  const err = new Error(message) as Error & { status?: number };
  if (typeof status === 'number') err.status = status;
  return err;
}

export function ensureFacebookConfigured() {
  if (!FACEBOOK_APP_ID) {
    throw new Error('Facebook Sign-In is not configured. Set FACEBOOK_APP_ID in src/shared/config/facebook.ts');
  }
}

export async function facebookSignInGetProfile(): Promise<FacebookProfile> {
  ensureFacebookConfigured();

  const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
  if (result.isCancelled) {
    throw new Error('Facebook sign-in was cancelled');
  }

  const tokenData = await AccessToken.getCurrentAccessToken();
  const accessToken = tokenData?.accessToken?.toString?.() || null;
  if (!accessToken) {
    throw new Error('Facebook Sign-In did not return an access token');
  }

  let displayName: string | null = null;
  try {
    const profile = await Profile.getCurrentProfile();
    displayName = (profile as any)?.name ?? null;
  } catch {
    // ignore
  }

  return {
    accessToken,
    userId: (tokenData as any)?.userID ?? null,
    displayName,
  };
}

export async function facebookBackendAuthenticate(params: {
  accessToken: string;
  userLabel?: string;
}): Promise<FacebookBackendAuthResult> {
  const resp = await fetch(apiUrl('/auth/facebook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: params.accessToken, user_label: params.userLabel }),
  });

  const text = await resp.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!resp.ok) {
    const msg = (data && (data.error || data.message)) || `Facebook auth failed (status ${resp.status})`;
    throw createStatusError(msg, resp.status);
  }

  const token = (data && (data.token || data.access_token)) || null;
  if (!token) {
    throw new Error('Facebook auth succeeded but no token was returned');
  }

  await AsyncStorage.setItem('authToken', token);
  const isNewAccount = !!(data && data.isNewAccount);
  const hasProfile = !!(data && data.hasProfile);
  return { token, isNewAccount, hasProfile };
}

export async function facebookSignOutIfPossible() {
  try {
    LoginManager.logOut();
  } catch {
    // ignore
  }
}
