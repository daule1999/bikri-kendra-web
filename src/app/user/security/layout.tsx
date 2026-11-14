import AuthOnlyLayout from '@/components/layout/AuthOnlyLayout';


export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthOnlyLayout>{children}</AuthOnlyLayout>;
}
