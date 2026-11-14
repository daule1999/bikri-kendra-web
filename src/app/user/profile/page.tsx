'use client';
import AppLayout from '@/components/layout/AppLayout';

export default function ProfilePage() {
  return (
    <AppLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Profile Settings</h1>
        <div className="bg-white p-4 rounded-lg shadow">
          <p>Edit profile information</p>
        </div>
      </div>
    </AppLayout>
  );
}
