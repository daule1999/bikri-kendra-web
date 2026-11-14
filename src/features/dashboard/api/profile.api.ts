import { CORE_ENDPOINTS, http } from '@/core/api';

/** Subset of users-svc GET /users/{username} the dashboard shows. */
export interface UserProfile {
  username: string;
  fullName?: string;
  email?: string;
  roles?: string[];
}

export const profileApi = {
  getByUsername: (username: string, signal?: AbortSignal) =>
    http.get<UserProfile>(CORE_ENDPOINTS.userByUsername(username), { signal }),
};
