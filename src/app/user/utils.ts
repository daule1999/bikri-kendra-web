export interface EventRoleAssignment {
    eventId: number;
    roleName: string;
}

/**
 * Picks the single event-role assignment relevant to the currently active event.
 *
 * - If the user is assigned to `currentEventId`, returns that assignment (correct role
 *   paired with that event — not an arbitrary one).
 * - If `currentEventId` isn't set (no event scope selected app-wide), falls back to the
 *   user's first assignment, if any.
 * - If the user has assignments but none match `currentEventId`, returns undefined —
 *   callers should render this as "N/A" rather than silently showing a different event's role.
 *
 * Falls back to the legacy flat `assignedEvents` + `roles[0]` shape for users whose data
 * hasn't been refreshed with `eventRoleAssignments` yet (e.g. a still-warm cache entry).
 */
export function getMatchedEventRole(user: any, currentEventId?: string | null): EventRoleAssignment | undefined {
    const assignments: EventRoleAssignment[] = Array.isArray(user?.eventRoleAssignments)
        ? user.eventRoleAssignments
        : [];

    if (assignments.length > 0) {
        if (currentEventId) {
            return assignments.find(a => String(a.eventId) === String(currentEventId));
        }
        return assignments[0];
    }

    // Legacy fallback — role/event pairing is not guaranteed to be correct here.
    const assignedIds: number[] = Array.isArray(user?.assignedEvents) ? user.assignedEvents : [];
    const matchedId = currentEventId
        ? assignedIds.find((id: number) => String(id) === String(currentEventId))
        : assignedIds[0];
    if (matchedId === undefined) return undefined;
    return { eventId: matchedId, roleName: user?.roles?.[0] || 'USER' };
}
