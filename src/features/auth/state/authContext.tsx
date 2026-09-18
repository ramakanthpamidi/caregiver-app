import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyProfiles } from '../../profiles/api/profileApi';
import { clearUserSession } from '../services/session';
import { initializeSecureStorageForFreshInstall } from '../../../shared/storage/secureLocalStorage';

export type AuthActions = {
  setIsLoggedIn?: (v: boolean) => void;
};

const AuthActionsContext = React.createContext<AuthActions>({});

export const AuthActionsProvider: React.FC<React.PropsWithChildren<AuthActions>> = ({
  children,
  setIsLoggedIn,
}) => {
  return <AuthActionsContext.Provider value={{ setIsLoggedIn }}>{children}</AuthActionsContext.Provider>;
};

export function useAuthActions(): AuthActions {
  return React.useContext(AuthActionsContext);
}

type AuthSessionContextValue = {
  /** null while bootstrapping session from storage */
  isLoggedIn: boolean | null;
  setIsLoggedIn: (value: boolean) => void;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthSessionContext = React.createContext<AuthSessionContextValue | null>(null);

function isNetworkishError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('aborted') ||
    lower.includes('timeout')
  );
}

function isAuthError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('invalid token') ||
    lower.includes('token expired') ||
    lower.includes('jwt') ||
    lower.includes('auth token') ||
    lower.includes('not authenticated') ||
    lower.includes('session expired')
  );
}

async function renewToken(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    await getMyProfiles(token);
    return true;
  } catch (error: any) {
    const msg = error?.message ? String(error.message) : 'Unknown auth error';
    if (isNetworkishError(msg)) {
      return true;
    }
    return !isAuthError(msg);
  }
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedInState] = useState<boolean | null>(null);

  const setIsLoggedIn = useCallback((value: boolean) => {
    setIsLoggedInState(value);
  }, []);

  const signOut = useCallback(async () => {
    await clearUserSession();
    setIsLoggedInState(false);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setIsLoggedInState(false);
        return;
      }

      // If an OAuth flow was interrupted mid-stream, clean up and return to login.
      const [pendingDialog, pendingPostLegal, pendingSocial] = await Promise.all([
        AsyncStorage.getItem('pendingOAuthNameDialog.v1'),
        AsyncStorage.getItem('pendingPostLegalAction.v1'),
        AsyncStorage.getItem('pendingSocialSignup.v1'),
      ]);
      if (pendingDialog || pendingPostLegal || pendingSocial) {
        await AsyncStorage.multiRemove([
          'authToken',
          'pendingOAuthNameDialog.v1',
          'pendingPostLegalAction.v1',
          'pendingSocialSignup.v1',
        ]);
        setIsLoggedInState(false);
        return;
      }

      // Hard cap the renewal so a stalled network call can never hang launch.
      const isValid = await Promise.race([
        renewToken(token),
        new Promise<boolean>((resolve) => setTimeout(() => {
          // Renewal timed out — treat token as valid offline so launch proceeds.
          resolve(true);
        }, 3000)),
      ]);
      if (isValid) {
        setIsLoggedInState(true);
      } else {
        await clearUserSession();
        setIsLoggedInState(false);
      }
    } catch (error) {
      console.error('Error checking login status:', error);
      setIsLoggedInState(false);
    }
  }, []);

  useEffect(() => {
    let settled = false;
    // A launch-time session check must never be able to hang the splash screen.
    // If storage or the token-renewal network call stalls, fall back to logged-out
    // so the login screen still shows.
    const timer = setTimeout(() => {
      if (!settled) {
        // Bootstrap timed out — default to logged out so the login screen shows.
        setIsLoggedInState(false);
      }
    }, 6000);
    (async () => {
      try {
        await initializeSecureStorageForFreshInstall();
        await refreshSession();
      } catch {
        setIsLoggedInState(false);
      } finally {
        settled = true;
        clearTimeout(timer);
      }
    })();
    return () => clearTimeout(timer);
  }, [refreshSession]);

  const value = useMemo(
    () => ({
      isLoggedIn,
      setIsLoggedIn,
      signOut,
      refreshSession,
    }),
    [isLoggedIn, setIsLoggedIn, signOut, refreshSession],
  );

  return (
    <AuthSessionContext.Provider value={value}>
      <AuthActionsProvider setIsLoggedIn={setIsLoggedIn}>{children}</AuthActionsProvider>
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionContextValue {
  const ctx = React.useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }
  return ctx;
}
