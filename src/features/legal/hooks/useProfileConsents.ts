import React from 'react';
import {
  getProfileConsentsSnapshot,
  hydrateProfileConsentsFromCache,
  refreshProfileConsents,
  subscribeProfileConsents,
} from '../storage/profileConsentStore';
import type { ProfileConsentsPayload } from '../../profiles/api/profileApi';

export function useProfileConsents(profileId: number | null): ProfileConsentsPayload | null {
  const [consents, setConsents] = React.useState<ProfileConsentsPayload | null>(() => {
    if (profileId == null) return null;
    return getProfileConsentsSnapshot(profileId);
  });

  React.useEffect(() => {
    if (profileId == null) {
      setConsents(null);
      return;
    }

    let alive = true;

    const unsubscribe = subscribeProfileConsents(profileId, (next) => {
      if (!alive) return;
      setConsents(next);
    });

    // Fast path: hydrate from local cache first.
    hydrateProfileConsentsFromCache(profileId).catch(() => {
      // ignore
    });

    // Then refresh from server.
    refreshProfileConsents(profileId).catch(() => {
      // ignore
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [profileId]);

  return consents;
}
