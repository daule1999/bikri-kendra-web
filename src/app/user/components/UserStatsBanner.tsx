interface UserStatsBannerProps {
    fullName?: string;
    username?: string;
    totalUsers: number;
    adminCount: number;
}

export default function UserStatsBanner({ fullName, username, totalUsers, adminCount }: UserStatsBannerProps) {
    const getGreeting = () => {
        const hours = new Date().getHours();
        return hours < 12 ? 'Good morning' : hours < 17 ? 'Good afternoon' : 'Good evening';
    };

    return (
        <section
            className="relative rounded-2xl p-6 sm:p-8 text-white shadow-lg overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 60%, #4338CA 100%)' }}
        >
            <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ background: 'radial-gradient(circle, #F59E0B 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
            />
            <div className="relative flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
                <div>
                    <p className="text-sm font-medium mb-1 text-indigo-300">{getGreeting()} 👋</p>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                        {fullName || username || 'User Management'}
                    </h1>
                    <p className="text-xs sm:text-sm mt-1 text-indigo-200">
                        System-wide accounts directory, role alignments, events scoping, and shop allocations.
                    </p>
                </div>
                <div className="flex w-full lg:w-auto gap-4 sm:gap-6 bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-xl border border-white/10 justify-around sm:justify-start">
                    <div className="text-center flex-1 sm:flex-none">
                        <p className="text-2xl font-bold text-yellow-300">{totalUsers}</p>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-300">Total Users</p>
                    </div>
                    <div className="w-px bg-white/20 self-stretch" />
                    <div className="text-center flex-1 sm:flex-none">
                        <p className="text-2xl font-bold text-emerald-400">{adminCount}</p>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-300">Admins</p>
                    </div>
                </div>
            </div>
        </section>
    );
}