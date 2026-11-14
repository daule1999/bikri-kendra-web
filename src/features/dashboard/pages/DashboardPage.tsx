'use client';

import { useAuth } from '@/core/auth';
import { useVisibleFeatures } from '@/core/features';
import { AppShell } from '@/layouts/app-shell';
import { FEATURES } from '@/features';
import { AccountDetails } from '../components/AccountDetails';
import { ModuleGrid } from '../components/ModuleGrid';
import { WelcomeBanner } from '../components/WelcomeBanner';
import { useUserProfile } from '../hooks/useUserProfile';

function DashboardContent() {
  const { user } = useAuth();
  const { profile } = useUserProfile(user?.username);
  const modules = useVisibleFeatures(FEATURES).filter((f) => f.showOnDashboard !== false);
  const role = user?.role ?? '';

  return (
    <div className="mx-auto max-w-content space-y-6 animate-fade-in-up sm:space-y-8">
      <WelcomeBanner
        name={profile?.fullName || profile?.username || user?.username || 'Welcome back'}
        role={role}
        email={profile?.email}
        moduleCount={modules.length}
      />
      <ModuleGrid features={modules} />
      {profile && <AccountDetails profile={profile} role={role} />}
    </div>
  );
}

export function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
