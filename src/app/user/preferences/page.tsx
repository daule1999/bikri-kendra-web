'use client';
import AppLayout from '@/components/layout/AppLayout';

export default function PreferencesPage() {
  return (
    <AppLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Preferences</h1>
        <div className="bg-white p-4 rounded-lg shadow">
          <p>App preferences and settings</p>
        </div>
      </div>
    </AppLayout>
  );
}
