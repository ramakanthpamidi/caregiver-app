import { useNavigation, useRoute } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';

/** Legacy React Navigation screen names used in independent overlay stacks. */
export type LegacyScreenName =
  | 'Login'
  | 'Signup'
  | 'VerifyEmail'
  | 'TermScreen'
  | 'PolicyScreen'
  | 'ConsentScreen'
  | 'CreateProfile';

const EXPO_ROUTE_MAP: Record<LegacyScreenName, string> = {
  Login: '/(auth)/login',
  Signup: '/(auth)/signup',
  VerifyEmail: '/(auth)/verify-email',
  TermScreen: '/(auth)/terms',
  PolicyScreen: '/(auth)/policy',
  ConsentScreen: '/(auth)/consent',
  CreateProfile: '/(main)',
};

function stringifyParams(params?: Record<string, unknown>): Record<string, string> {
  if (!params) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'boolean') {
      out[key] = value ? '1' : '0';
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

/**
 * Navigation helper that works in both Expo Router screens and nested
 * React Navigation stacks (e.g. PolicyConsentFlowOverlay / CreateProfileFlowOverlay).
 */
export function useAppNavigation() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const router = useRouter();
  const expoParams = useLocalSearchParams<Record<string, string | string[]>>();

  const routeParams: Record<string, any> = {
    ...(typeof expoParams === 'object' && expoParams ? expoParams : {}),
    ...((route?.params as Record<string, any>) || {}),
  };

  // Normalize array params from expo-router
  for (const key of Object.keys(routeParams)) {
    const value = routeParams[key];
    if (Array.isArray(value)) {
      routeParams[key] = value[0];
    }
  }

  const canUseLegacyNavigate = (name: LegacyScreenName) => {
    try {
      const state = navigation?.getState?.();
      const names: string[] = state?.routeNames || [];
      if (names.includes(name)) return true;
      // Also allow if the current navigator has a parent with that route (rare).
      return typeof navigation?.navigate === 'function' && names.length > 0 && !names.includes('login');
    } catch {
      return false;
    }
  };

  const navigate = (name: LegacyScreenName, params?: Record<string, unknown>) => {
    // Prefer the nested RN stack when this screen is hosted inside an independent overlay navigator.
    try {
      const state = navigation?.getState?.();
      const names: string[] = state?.routeNames || [];
      if (names.includes(name)) {
        navigation.navigate(name, params);
        return;
      }
    } catch {
      // fall through to expo-router
    }

    const pathname = EXPO_ROUTE_MAP[name];
    if (!pathname) return;

    if (name === 'CreateProfile') {
      router.replace(pathname as any);
      return;
    }

    router.push({
      pathname: pathname as any,
      params: stringifyParams(params),
    });
  };

  const replace = (name: LegacyScreenName, params?: Record<string, unknown>) => {
    try {
      const state = navigation?.getState?.();
      const names: string[] = state?.routeNames || [];
      if (names.includes(name) && typeof navigation?.replace === 'function') {
        navigation.replace(name, params);
        return;
      }
      if (names.includes(name) && typeof navigation?.reset === 'function') {
        navigation.reset({ index: 0, routes: [{ name, params }] });
        return;
      }
    } catch {
      // fall through
    }

    const pathname = EXPO_ROUTE_MAP[name];
    if (!pathname) return;
    router.replace({
      pathname: pathname as any,
      params: stringifyParams(params),
    } as any);
  };

  const goBack = () => {
    try {
      if (typeof navigation?.canGoBack === 'function' && navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
    } catch {
      // fall through
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(auth)/login');
  };

  const resetTo = (name: LegacyScreenName, params?: Record<string, unknown>) => {
    try {
      const state = navigation?.getState?.();
      const names: string[] = state?.routeNames || [];
      if (names.includes(name) && typeof navigation?.reset === 'function') {
        navigation.reset({
          index: 0,
          routes: [{ name, params }],
        });
        return;
      }
    } catch {
      // fall through
    }

    const pathname = EXPO_ROUTE_MAP[name];
    if (!pathname) return;
    router.replace({
      pathname: pathname as any,
      params: stringifyParams(params),
    } as any);
  };

  return {
    navigation,
    router,
    params: routeParams,
    navigate,
    replace,
    goBack,
    resetTo,
    canUseLegacyNavigate,
  };
}
