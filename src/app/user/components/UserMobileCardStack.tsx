'use client';

import { TrashIcon, PencilIcon } from '@/components/ui/Icons';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { getMatchedEventRole } from '@/app/user/utils';

interface UserMobileCardStackProps {
    paginatedUsers: any[];
    isLoggedInUserAdmin: boolean;
    roles: any[];
    allEvents: any[];
    allShops: any[];
    currentEventId?: string | null;
    onEditDetailsOpen: (user: any) => void;
    onDeleteTrigger: (username: string) => void;
}

export default function UserMobileCardStack({
    paginatedUsers,
    isLoggedInUserAdmin,
    roles,
    allEvents,
    allShops,
    onEditDetailsOpen,
    onDeleteTrigger
}: UserMobileCardStackProps) {
    const { eventId: currentEventId } = useActiveEvent();
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50/30">
            {paginatedUsers.map((user, index) => {
                const rolesArray: string[] = user.roles || [];
                const hasAdminRole = rolesArray.some(role => role.toUpperCase().includes('ADMIN'));
                const isUserAdmin = !!(hasAdminRole || user.username?.toLowerCase() === 'admin' || user.username?.endsWith('_admin'));

                return (
                    <div key={index} className="bg-white rounded-xl border border-slate-100 shadow-xs flex flex-col hover:border-indigo-100/50 hover:shadow-xs transition-all duration-200">
                        {/* Card Header: Initials + Names & Contact */}
                        <div className="p-4 flex items-start gap-3 bg-slate-50/40 border-b border-slate-100/50">
                            <div
                                className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-sm font-bold text-white shadow-3xs"
                                style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
                            >
                                {(user.fullName || user.username || 'U')[0].toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <h4 className="font-bold text-slate-900 truncate leading-tight">{user.username}</h4>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
                                        isUserAdmin ? 'bg-indigo-50 text-indigo-700 border-indigo-100/50' : 'bg-slate-100 text-slate-600 border-slate-200/50'
                                    }`}>
                                        {isUserAdmin ? 'ADMIN' : 'NON-ADMIN'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">{user.email || 'No email'}</p>
                                <p className="text-[10px] font-semibold text-indigo-500/90 mt-0.5">{user.mobile || 'No mobile'}</p>
                            </div>
                        </div>

                        {/* Card Body: User Assignments & Properties */}
                        <div className="p-4 space-y-3 flex-1 text-xs">
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Full Name</span>
                                <span className="font-semibold text-slate-700">{user.fullName || '—'}</span>
                            </div>

                            {/* Event & Role alignment */}
                            <div className="flex flex-col gap-2 py-2.5 border-t border-b border-slate-100/50">
                                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Event & Role Alignment</span>
                                <div className="flex flex-wrap gap-1.5 items-center justify-start mt-0.5">
                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-3xs">
                                        🔑 {(() => {
                                             const matched = getMatchedEventRole(user, currentEventId);
                                             if (!matched) return 'N/A';
                                             return matched.roleName || 'USER';
                                           })()}
                                    </span>
                                    <span className="text-slate-400 font-extrabold text-[10px]">@</span>
                                    {(() => {
                                        const matched = getMatchedEventRole(user, currentEventId);
                                        const matchedEvent = matched
                                            ? allEvents.find((e: any) => e.id === matched.eventId)
                                            : null;
                                        const displayLabel = matchedEvent
                                            ? matchedEvent.eventName
                                            : currentEventId ? 'N/A' : 'No Event Scope';
                                        return (
                                            <span
                                                className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100 max-w-[180px] truncate shadow-3xs"
                                                title={displayLabel}
                                            >
                                                📅 {displayLabel}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Shop Assignment */}
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Assigned Shop</span>
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 max-w-[180px] truncate shadow-3xs">
                                    🏪 {user.shopName || user.shop?.shopName || allShops.find(s => s.id === parseInt(String(user.shopId || '')))?.shopName || 'N/A'}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100 flex gap-2">
                            <button
                                onClick={() => onEditDetailsOpen(user)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-100 rounded-lg hover:bg-indigo-50 text-xs font-semibold cursor-pointer transition-all shadow-3xs"
                            >
                                <PencilIcon className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-600" />
                                Edit Info
                            </button>
                            <button
                                disabled={isUserAdmin || !isLoggedInUserAdmin}
                                onClick={() => onDeleteTrigger(user.username)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-rose-50 disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-400 text-xs font-semibold cursor-pointer transition-all shadow-3xs"
                                title={
                                    isUserAdmin 
                                        ? "Admin accounts cannot be deleted" 
                                        : !isLoggedInUserAdmin 
                                            ? "Only administrators can delete accounts" 
                                            : "Delete Account"
                                }
                            >
                                <TrashIcon className="w-3.5 h-3.5" />
                                Delete
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}