'use client';

import AppLayout from '@/components/layout/AppLayout';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import InventoryBanner from './components/InventoryBanner';
import InventoryTabs from './components/InventoryTabs';
import SuccessToast from './components/SuccessToast';
import InventoryErrorModal from './components/InventoryErrorModal';

function InventoryShell({ children }: { children: React.ReactNode }) {
  const {
    successMessage,
    showSuccessModal,
    setShowSuccessModal,
    errorMessage,
    showErrorModal,
    setShowErrorModal,
  } = useInventory();

  return (
    <AppLayout>
      <div className="h-full flex flex-col p-3 sm:p-4 animate-fade-in-up">
        <InventoryBanner />

        <div className="bg-white sm:rounded-xl shadow-lg border-y sm:border border-indigo-100 flex-1 flex flex-col min-h-0 overflow-hidden">
          <InventoryTabs />
          <div className="p-0 sm:p-6 overflow-y-auto flex-1">
            {children}
          </div>
        </div>
      </div>

      <SuccessToast
        message={successMessage}
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
      />
      <InventoryErrorModal
        message={errorMessage}
        visible={showErrorModal}
        onClose={() => setShowErrorModal(false)}
      />
    </AppLayout>
  );
}

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <InventoryProvider>
      <InventoryShell>{children}</InventoryShell>
    </InventoryProvider>
  );
}
