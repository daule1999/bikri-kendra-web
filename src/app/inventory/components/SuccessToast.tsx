'use client';

import { useEffect, useRef } from 'react';

interface SuccessToastProps {
  message: string;
  visible: boolean;
  onClose: () => void;
}

export default function SuccessToast({ message, visible, onClose }: SuccessToastProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      timerRef.current = setTimeout(() => {
        onClose();
      }, 3000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
      <div className="bg-white border border-green-200 shadow-lg p-4 rounded-lg w-72">
        <div className="flex items-center gap-3">
          <div className="text-green-600 text-2xl">✓</div>
          <div>
            <p className="text-sm font-semibold text-green-700">Success!</p>
            <p className="text-xs text-gray-600">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
