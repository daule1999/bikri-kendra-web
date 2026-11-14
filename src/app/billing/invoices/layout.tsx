import AuthOnlyLayout from '@/components/layout/AuthOnlyLayout';
import { PERMISSIONS } from '@/core/auth';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthOnlyLayout permission={PERMISSIONS.billingView}>{children}</AuthOnlyLayout>;
}
