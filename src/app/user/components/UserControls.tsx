import { MuiSelect } from '@/components/ui/MuiSelect';
import { RefreshIcon, CancelIcon } from '@/components/ui/Icons';

interface UserControlsProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    roleFilter: string;
    setRoleFilter: (filter: string) => void;
    roles: any[];
    onRefresh: () => void;
    onCreateOpen: () => void;
    shopFilter: string;
    setShopFilter: (filter: string) => void;
    allShops: any[];
    currentEventId: string | null;
}

export default function UserControls({
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    roles,
    onRefresh,
    onCreateOpen,
    shopFilter,
    setShopFilter,
    allShops,
    currentEventId,
}: UserControlsProps) {
    return (
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center bg-slate-50/50 relative z-20">
            <div className="flex flex-col sm:flex-row w-full lg:w-auto lg:flex-1 items-stretch sm:items-center gap-3">
                {/* Search Input */}
                <div className="relative flex-1 w-full lg:max-w-md">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <svg className="h-4.5 w-4.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder="Search users by name, email, credentials..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-9 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-400 shadow-xs"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-100"
                            title="Clear search"
                            aria-label="Clear search"
                        >
                            <CancelIcon />
                        </button>
                    )}
                </div>

                {/* Custom MuiSelect Filter */}
                <MuiSelect
                    id="role-filter-select"
                    label="Role Filter"
                    value={roleFilter}
                    onChange={setRoleFilter}
                    options={[
                        { value: 'ALL', label: 'All Roles' },
                        { value: 'NONE', label: 'No Role Assigned' },
                        ...roles.map(r => ({ value: r.name, label: r.description || r.name }))
                    ]}
                    className="w-full sm:w-48"
                />

                {/* Custom MuiSelect Shop Filter */}
                <MuiSelect
                    id="shop-filter-select"
                    label="Shop Filter"
                    value={shopFilter}
                    onChange={setShopFilter}
                    options={[
                        { value: 'ALL', label: 'All Shops' },
                        { value: 'NONE', label: 'No Shop Assigned' },
                        ...allShops
                            .filter(shop => !currentEventId || String(shop.eventId) === String(currentEventId))
                            .map(shop => ({ value: String(shop.id), label: shop.shopName }))
                    ]}
                    className="w-full sm:w-48"
                />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 w-full lg:w-auto justify-stretch sm:justify-end">
                <button
                    onClick={onRefresh}
                    className="p-2 text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer flex items-center justify-center"
                    title="Reload List"
                >
                    <RefreshIcon className="w-4.5 h-4.5 text-slate-500 hover:text-indigo-600" />
                </button>

                <button
                    onClick={onCreateOpen}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4.5 py-2 text-sm font-semibold rounded-xl shadow-md shadow-indigo-100 hover:shadow-lg transition-all cursor-pointer"
                >
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    Add New User
                </button>
            </div>
        </div>
    );
}