// @deprecated — Use AppLayout (components/layout/AppLayout.tsx) instead. This component is no longer used.
import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="bg-white shadow-sm border-b px-6 py-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Bikri Kendra</h1>
        <div className="flex space-x-4">
          <Link href="/sales" className="hover:text-green-600">Sales</Link>
          <Link href="/billing" className="hover:text-red-600">Billing</Link>
          <Link href="/user" className="hover:text-blue-600">Profile</Link>
        </div>
      </div>
    </nav>
  )
}