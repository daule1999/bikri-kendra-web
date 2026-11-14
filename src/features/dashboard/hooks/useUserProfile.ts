'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '@/core/api';
import { profileApi, type UserProfile } from '../api/profile.api';

/** Loads the signed-in user's profile. Fails soft: the dashboard still renders without it. */
export function useUserProfile(username: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!username) return;
    const ctrl = new AbortController();
    profileApi.getByUsername(username, ctrl.signal)
      .then(setProfile)
      .catch((e) => { if (e instanceof ApiError) setError(e); });
    return () => ctrl.abort();
  }, [username]);

  return { profile, error };
}
