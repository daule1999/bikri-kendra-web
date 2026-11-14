import UserTableRow from "./UserTableRow";

function UserTable({
    paginatedUsers,
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
        <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
                <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wider font-bold">
                        <th className="text-left p-4 w-2/5">User Detail</th>
                        <th className="text-left p-4 w-2/5">Event & Role Alignment</th>
                        <th className="text-left p-4 w-[150px]">Assigned Shop</th>
                        <th className="text-left p-4 w-[100px]">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedUsers.map((user: any) => {
                        const rolesArray = user.roles || [];
                        const hasAdminRole = rolesArray.some((role: any) =>
                            role.toUpperCase().includes('ADMIN')
                        );
                        const isUserAdmin = !!(hasAdminRole || user.username?.toLowerCase() === 'admin' || user.username?.endsWith('_admin'));

                        return (
                            <UserTableRow
                                key={user.id}
                                user={user}
                                isUserAdmin={isUserAdmin}
                                isLoggedInUserAdmin={isLoggedInUserAdmin}
                                roles={roles}
                                allEvents={allEvents}
                                allShops={allShops}
                                currentEventId={currentEventId}
                                setEditingUser={setEditingUser}
                                setEditFormData={setEditFormData}
                                setShowEditDetailsModal={setShowEditDetailsModal}
                                handleDeleteUser={handleDeleteUser}
                            />
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default UserTable;