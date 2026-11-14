import { EventItem } from "./events";

export interface AuthState {
    accessToken: string | null;
    username: string | null;
    userRole: string | null;
    // Tenant Information
    activeEventId: string | null;
    activeEventName: string | null;
    activeEvent: EventItem | null;
    // Password reset flow — null means unknown (not yet loaded from storage)
    mustResetPassword: boolean | null;
}
