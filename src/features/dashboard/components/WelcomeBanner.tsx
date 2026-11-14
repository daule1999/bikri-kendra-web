'use client';

import { useEffect, useState } from 'react';
import { Badge, Icon } from '@/shared/ui';
import { useGreeting } from '@/shared/hooks/useGreeting';
import { formatShortDate } from '@/shared/lib/format';

interface WelcomeBannerProps {
  name: string;
  role: string;
  email?: string;
  moduleCount: number;
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-on-accent">{value}</p>
      <p className="mt-0.5 text-xs text-on-dark-muted">{label}</p>
    </div>
  );
}

export function WelcomeBanner({ name, role, email, moduleCount }: WelcomeBannerProps) {
  const greeting = useGreeting();
  const [today, setToday] = useState('');
  useEffect(() => setToday(formatShortDate(new Date())), []);

  return (
    <section className="relative overflow-hidden rounded-card bg-gradient-hero p-6 sm:p-12">
      <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-64 w-64 translate-x-[30%] -translate-y-[30%] rounded-full bg-accent opacity-20 blur-3xl" />
      <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-sm font-medium text-on-dark-muted">{greeting} 👋</p>
          <h1 className="text-2xl font-bold tracking-tight text-on-accent sm:text-3xl">{name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone="orange"><Icon name="check" size="xs" strokeWidth={2.5} />{role}</Badge>
            {email && <span className="text-xs text-on-dark">{email}</span>}
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <Stat value={moduleCount} label="Modules" />
          <div className="w-px self-stretch bg-on-dark/20" />
          <Stat value={today} label="Today" />
        </div>
      </div>
    </section>
  );
}
