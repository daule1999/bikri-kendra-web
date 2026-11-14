import { TrashIcon, PencilIcon } from "@/components/ui/Icons";
import { getMatchedEventRole } from "@/app/user/utils";

function UserTableRow({
    user,
    isUserAdmin,
    isLoggedInUserAdmin,
    roles,
    allEvents,
    allShops,
    currentEventId,
    setEditingUser,
    setEditFormData,
    setShowEditDetailsModal,
    handleDeleteUser
}: any) {
    return (
        <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
            {/* Column 1: User Profile Details */}
            <td className="p-4 align-middle">
                <div className="flex items-center gap-4 min-w-0">
                    <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold text-white shadow-xs shrink-0"
                        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
                    >
                        {(user.fullName || user.username || 'U')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 leading-tight truncate" title={user.username}>
                                {user.username}
                            </p>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-extrabold border tracking-wider uppercase shrink-0 ${
                                isUserAdmin ? 'bg-indigo-50 text-indigo-700 border-indigo-100/50' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                                {isUserAdmin ? 'Admin' : 'Staff'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 truncate" title={user.email}>
                            {user.email || 'No email'}
                        </p>
                        <p className="text-[10px] font-semibold text-indigo-500/80 mt-0.5">
                            {user.mobile || 'No mobile'}
                        </p>
                    </div>
                </div>
            </td>

            {/* Column 2: Event & Role Real-Time Management */}
            {/* max-w-0 is intentional — CSS trick to force table cell truncation.
                Any new content added inside this td MUST include the `truncate` class,
                otherwise it will render with zero visible width. */}
            <td className="p-4 align-middle max-w-0">
                <div className="flex flex-col gap-1.5 items-start min-w-0">
                    {/* Event & role badges: a single matched assignment scoped to the currently
                        selected event, so the role shown always belongs to the event shown. */}
                    {(() => {
                        const matched = getMatchedEventRole(user, currentEventId);
                        const matchedEvent = matched
                            ? allEvents.find((e: any) => e.id === matched.eventId)
                            : null;
                        const displayLabel = matchedEvent
                            ? matchedEvent.eventName
                            : currentEventId
                                ? 'N/A'
                                : 'No Event Scope';
                        return (
                            <span
                                className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100 max-w-full truncate shadow-xs"
                                title={displayLabel}
                            >
                                <span className="mr-1.5 shrink-0">📅</span>
                                <span className="truncate">{displayLabel}</span>
                            </span>
                        );
                    })()}

                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 whitespace-nowrap shadow-xs">
                        <span className="mr-1.5 shrink-0">🔑</span>
                        {(() => {
                        const matched = getMatchedEventRole(user, currentEventId);
                        if (!matched) return 'N/A';
                        return matched.roleName || 'USER';
                      })()}
                    </span>
                </div>
            </td>

            {/* Column 3: Shop Assignment */}
            <td className="p-4 align-middle text-slate-500 text-sm font-medium">
                <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100 whitespace-nowrap shadow-xs">
                    🏪 {user.shopName || user.shop?.shopName || allShops.find((shop: any) => shop.id === parseInt(String(user.shopId || '')))?.shopName || 'N/A'}
                </span>
            </td>

            {/* Column 4: Actions */}
            <td className="p-4 align-middle">
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => {
                            const matched = getMatchedEventRole(user, currentEventId);
                            setEditingUser(user);
                            setEditFormData({
                                fullName: user.fullName || '',
                                email: user.email || '',
                                mobile: user.mobile || '',
                                password: '',
                                role: matched?.roleName || '',
                                eventId: matched?.eventId?.toString() || '',
                                shopId: user.shopId?.toString() || ''
                            });
                            setShowEditDetailsModal(true);
                        }}
                        className="p-2 bg-slate-50 hover:bg-indigo-50 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all text-slate-500 hover:text-indigo-600 shadow-3xs shrink-0 cursor-pointer flex items-center justify-center"
                        title="Edit Details & Configurations"
                    >
                        <PencilIcon className="w-4 h-4 text-slate-500 hover:text-indigo-600" />
                    </button>
                    <button
                        disabled={isUserAdmin || !isLoggedInUserAdmin}
                        onClick={() => handleDeleteUser(user.username)}
                        className="p-2 bg-slate-50 hover:bg-rose-50 rounded-xl border border-slate-100 hover:border-rose-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-slate-500 hover:text-rose-600 disabled:hover:bg-slate-50 disabled:hover:border-slate-100 disabled:hover:text-slate-400 shadow-3xs shrink-0 cursor-pointer"
                        title={
                            isUserAdmin 
                                ? "Admin accounts cannot be deleted" 
                                : !isLoggedInUserAdmin 
                                    ? "Only administrators can delete accounts" 
                                    : "Delete Account"
                        }
                    >
                        <TrashIcon />
                    </button>
                </div>
            </td>
        </tr>
    );
}

export default UserTableRow;
