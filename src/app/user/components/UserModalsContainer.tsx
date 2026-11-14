import { CancelIcon, CheckIcon, TrashIcon } from '@/components/ui/Icons';

import { MuiSelect } from '@/components/ui/MuiSelect';

interface UserModalsContainerProps {
    modalsState: {
        showCreate: boolean; setShowCreate: (v: boolean) => void;
        showEdit: boolean; setShowEdit: (v: boolean) => void;
        showSuccess: boolean; setShowSuccess: (v: boolean) => void;
        showError: boolean; setShowError: (v: boolean) => void;
        showDelete: boolean; setShowDelete: (v: boolean) => void;
    };
    formsData: {
        createData: any; setCreateData: (d: any) => void;
        editData: any; setEditData: (d: any) => void;
    };
    messages: { success: string; error: string; userToDelete: string | null; };
    roles: any[];
    allEvents: any[];
    allShops: any[];
    handlers: {
        onCreateSubmit: (e: React.FormEvent) => void;
        onEditSubmit: (e: React.FormEvent) => void;
        onDeleteExecute: () => void;
        onDeleteCancel: () => void;
    };
}

export default function UserModalsContainer({
    modalsState, formsData, messages, roles, allEvents, allShops, handlers
}: UserModalsContainerProps) {
    return (
        <>
            {/* Create Modal */}
            {modalsState.showCreate && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-100 overflow-visible my-8">
                        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex justify-between items-center rounded-t-2xl z-10">
                            <h3 className="text-base font-bold text-slate-900">Add New User</h3>
                            <button onClick={() => modalsState.setShowCreate(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <form onSubmit={handlers.onCreateSubmit} className="p-5 space-y-4">
                            <input type="text" placeholder="Username *" className="w-full p-2.5 border border-slate-200 rounded-xl text-sm" value={formsData.createData.username} onChange={e => formsData.setCreateData({ ...formsData.createData, username: e.target.value })} required />
                            <input type="text" placeholder="Full Name *" className="w-full p-2.5 border border-slate-200 rounded-xl text-sm" value={formsData.createData.fullName} onChange={e => formsData.setCreateData({ ...formsData.createData, fullName: e.target.value })} required />
                            <input type="email" placeholder="Email Address *" className="w-full p-2.5 border border-slate-200 rounded-xl text-sm" value={formsData.createData.email} onChange={e => formsData.setCreateData({ ...formsData.createData, email: e.target.value })} required />
                            <input type="text" placeholder="Mobile Contact *" className="w-full p-2.5 border border-slate-200 rounded-xl text-sm" value={formsData.createData.mobile} onChange={e => formsData.setCreateData({ ...formsData.createData, mobile: e.target.value })} required />
                            <input type="password" placeholder="Password (Min 8 chars) *" className="w-full p-2.5 border border-slate-200 rounded-xl text-sm" value={formsData.createData.password} onChange={e => formsData.setCreateData({ ...formsData.createData, password: e.target.value })} minLength={8} required />
                            <div className="grid grid-cols-2 gap-3">
                                <MuiSelect id="modal-create-role" label="Role" value={formsData.createData.role} onChange={val => formsData.setCreateData({ ...formsData.createData, role: val })} options={[{ value: '', label: 'Select Role' }, ...roles.map(r => ({ value: r.name, label: r.description }))]} required />
                                <MuiSelect id="modal-create-event" label="Event (Opt)" value={formsData.createData.eventId} onChange={val => formsData.setCreateData({ ...formsData.createData, eventId: val })} options={[{ value: '', label: 'Select Event' }, ...allEvents.filter(e => e.isActive).map(e => ({ value: e.id, label: e.eventName }))]} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-sm cursor-pointer"
                                >
                                    Register
                                </button>
                                <button type="button" onClick={() => modalsState.setShowCreate(false)} className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl font-bold text-sm">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal (Unified configurations: Profile details, Event & Role alignment, Assigned Shop) */}
            {modalsState.showEdit && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-100 overflow-visible my-8">
                        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex justify-between items-center rounded-t-2xl z-10">
                            <div>
                                <h3 className="text-base font-bold text-slate-900">Update System Account</h3>
                                <p className="text-[10px] text-slate-400 mt-0.5">Modify profile details, assign shop, and event/role alignments.</p>
                            </div>
                            <button onClick={() => modalsState.setShowEdit(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <form onSubmit={handlers.onEditSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Full Name</label>
                                <input type="text" placeholder="Enter Full Name" className="w-full p-2.5 border border-slate-200 rounded-xl text-sm" value={formsData.editData.fullName} onChange={e => formsData.setEditData({ ...formsData.editData, fullName: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
                                <input type="email" placeholder="organization@domain.com" className="w-full p-2.5 border border-slate-200 rounded-xl text-sm" value={formsData.editData.email} onChange={e => formsData.setEditData({ ...formsData.editData, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Mobile Contact</label>
                                <input type="text" placeholder="Contact number" className="w-full p-2.5 border border-slate-200 rounded-xl text-sm" value={formsData.editData.mobile} onChange={e => formsData.setEditData({ ...formsData.editData, mobile: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">New Password (Optional)</label>
                                <input type="password" minLength={8} placeholder="Leave blank to keep current" className="w-full p-2.5 border border-slate-200 rounded-xl text-sm" value={formsData.editData.password} onChange={e => formsData.setEditData({ ...formsData.editData, password: e.target.value })} />
                            </div>

                            {/* Dropdown selectors for Event, Role, and Shop */}
                            <div className="border-t border-slate-100 pt-4 space-y-4">
                                <span className="block text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Account Configuration</span>
                                <div className="grid grid-cols-2 gap-3">
                                    <MuiSelect
                                        id="modal-edit-role"
                                        label="System Role"
                                        value={formsData.editData.role}
                                        onChange={val => formsData.setEditData({ ...formsData.editData, role: val })}
                                        options={[{ value: '', label: 'Select Role' }, ...roles.map(r => ({ value: r.name, label: r.description }))]}
                                    />
                                    <MuiSelect
                                        id="modal-edit-event"
                                        label="Scope Event"
                                        value={formsData.editData.eventId}
                                        onChange={val => formsData.setEditData({ ...formsData.editData, eventId: val })}
                                        options={[{ value: '', label: 'Select Event' }, ...allEvents.map(e => ({ value: e.id, label: e.eventName }))]}
                                    />
                                </div>
                                <div>
                                    <MuiSelect
                                        id="modal-edit-shop"
                                        label="Assigned Shop Space"
                                        value={formsData.editData.shopId}
                                        onChange={val => formsData.setEditData({ ...formsData.editData, shopId: val })}
                                        options={[{ value: '', label: 'No Shop Assigned' }, ...allShops.map(s => ({ value: s.id, label: s.shopName }))]}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-3">
                                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-sm cursor-pointer shadow-md shadow-indigo-100 hover:shadow-lg transition-all">Save Changes</button>
                                <button type="button" onClick={() => modalsState.setShowEdit(false)} className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl font-bold text-sm">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {modalsState.showDelete && (
                <div className="fixed inset-0 bg-black/55 backdrop-blur-xs z-55 flex items-center justify-center p-4">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center shadow-xl flex flex-col items-center">
                        <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mb-3">
                            <TrashIcon className="text-rose-600 hover:text-rose-700 w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mb-2">Delete Account</h3>
                        <p className="text-xs text-slate-500 mb-5">Confirm permanent wipe for user "{messages.userToDelete}"?</p>
                        <div className="flex gap-3 w-full">
                            <button onClick={handlers.onDeleteExecute} className="flex-1 bg-rose-600 text-white py-2.5 rounded-xl font-bold text-xs cursor-pointer">Delete</button>
                            <button onClick={handlers.onDeleteCancel} className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl font-bold text-xs">Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {modalsState.showSuccess && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-55 p-4">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center shadow-xl flex flex-col items-center">
                        <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                            <CheckIcon className="text-emerald-600 hover:text-emerald-700 w-6 h-6" />
                        </div>
                        <p className="text-xs text-slate-600 mb-4">{messages.success}</p>
                        <button onClick={() => modalsState.setShowSuccess(false)} className="w-full bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold cursor-pointer">Accept</button>
                    </div>
                </div>
            )}

            {/* Error Modal */}
            {modalsState.showError && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-55 p-4">
                    <div className="bg-white p-6 rounded-2xl w-full max-w-sm text-center shadow-xl flex flex-col items-center">
                        <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mb-3">
                            <CancelIcon className="text-rose-600 hover:text-rose-700 w-6 h-6" />
                        </div>
                        <p className="text-xs text-slate-600 mb-4">{messages.error}</p>
                        <button onClick={() => modalsState.setShowError(false)} className="w-full bg-rose-600 text-white py-2 rounded-xl text-xs font-bold cursor-pointer">Dismiss</button>
                    </div>
                </div>
            )}
        </>
    );
}