import { Badge, Card } from '@/shared/ui';
import type { UserProfile } from '../api/profile.api';

export function AccountDetails({ profile, role }: { profile: UserProfile; role: string }) {
  const fields = [
    { label: 'Username', value: profile.username },
    { label: 'Full Name', value: profile.fullName || '—' },
    { label: 'Email', value: profile.email || '—', wide: true },
  ];
  return (
    <Card>
      <Card.Header icon="user" title="Account Details" />
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {fields.map((f) => (
          <div key={f.label} className={f.wide ? 'col-span-2 sm:col-span-1' : undefined}>
            <dt className="mb-1 text-xs font-medium text-fg-faint">{f.label}</dt>
            <dd className="truncate text-sm font-medium text-fg">{f.value}</dd>
          </div>
        ))}
        <div>
          <dt className="mb-1 text-xs font-medium text-fg-faint">Role</dt>
          <dd><Badge tone="indigo">{role}</Badge></dd>
        </div>
      </dl>
    </Card>
  );
}
