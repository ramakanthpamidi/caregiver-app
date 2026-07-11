import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';

import { GOOGLE_SIGNIN_CLIENT_IDS, GOOGLE_WEB_CLIENT_ID } from '../../../shared/config/google';
import { apiUrl } from '../../../shared/config/api';

export type GoogleProfile = {
  idToken: string;
  email?: string | null;
  displayName?: string | null;
};

export type GoogleBackendAuthResult = {
  token?: string;
  requiresEmailVerification?: boolean;
  email?: string;
  isNewAccount?: boolean;
  hasProfile?: boolean;
};

function createStatusError(message: string, status?: number) {
  const err = new Error(message) as Error & { status?: number };
  if (typeof status === 'number') err.status = status;
  return err;
}

export function ensureGoogleConfigured() {
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error('Google Sign-In is not configured. Set GOOGLE_WEB_CLIENT_ID in src/shared/config/google.ts');
  }

  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false,
    forceCodeForRefreshToken: false,
  });
}

function configureGoogleClient(webClientId: string) {
  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
    forceCodeForRefreshToken: false,
  });
}

export async function googleSignInGetProfile(): Promise<GoogleProfile> {
  ensureGoogleConfigured();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const candidateClientIds = GOOGLE_SIGNIN_CLIENT_IDS.length > 0 ? GOOGLE_SIGNIN_CLIENT_IDS : [GOOGLE_WEB_CLIENT_ID];
  let lastError: unknown = null;

  for (const clientId of candidateClientIds) {
    configureGoogleClient(clientId);

    // Force account picker each time instead of silently reusing the last Google session.
    // This avoids auto-login after app relaunch when user expects to choose an account.
    try {
      await GoogleSignin.signOut();
    } catch {
      // ignore if there is no existing Google session
    }

    try {
      const signInResponse = await GoogleSignin.signIn();
      if (!isSuccessResponse(signInResponse)) {
        throw new Error('Google sign-in was cancelled');
      }

      const tokens = await GoogleSignin.getTokens();
      if (!tokens.idToken) {
        throw new Error('Google Sign-In did not return an idToken');
      }

      return {
        idToken: tokens.idToken,
        email: signInResponse.data.user.email ?? null,
        displayName: signInResponse.data.user.name ?? null,
      };
    } catch (error) {
      const code = String((error as { code?: unknown })?.code || '');
      const isDeveloperError =
        code === String(statusCodes.DEVELOPER_ERROR)
        || code === '10'
        || /DEVELOPER_ERROR/i.test(String((error as { message?: unknown })?.message || ''));

      if (!isDeveloperError) {
        throw error;
      }

      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Google sign-in failed due to configuration mismatch');
}

export async function googleBackendAuthenticate(params: {
  idToken: string;
  userLabel?: string;
  mode?: 'login' | 'signup';
}): Promise<GoogleBackendAuthResult> {
  const mode = params.mode || 'signup';
  const resp = await fetch(apiUrl('/auth/google'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: params.idToken, user_label: params.userLabel, mode }),
  });

  const text = await resp.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!resp.ok) {
    const msg = (data && (data.error || data.message)) || `Google auth failed (status ${resp.status})`;
    throw createStatusError(msg, resp.status);
  }

  const token = (data && (data.token || data.access_token)) || null;
  const isNewAccount = !!(data && data.isNewAccount);
  const hasProfile = !!(data && data.hasProfile);
  if (token) {
    await AsyncStorage.setItem('authToken', token);
    return { token, isNewAccount, hasProfile };
  }

  const requiresEmailVerification = !!(data && data.requiresEmailVerification);
  const email = (data && data.email) || undefined;

  if (requiresEmailVerification) {
    return { requiresEmailVerification: true, email, isNewAccount, hasProfile };
  }

  throw new Error('Google auth succeeded but no token was returned');
}

export async function googleSignOutIfPossible() {
  try {
    await GoogleSignin.signOut();
  } catch {
    // ignore
  }
}
