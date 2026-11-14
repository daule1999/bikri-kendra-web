'use client';

import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES = {
  danger: {
    icon: '🗑️',
    iconBg: 'bg-red-100',
    confirmBtn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
  },
  warning: {
    icon: '⚠️',
    iconBg: 'bg-amber-100',
    confirmBtn: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
  },
  info: {
    icon: 'ℹ️',
    iconBg: 'bg-blue-100',
    confirmBtn: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
  },
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: Props) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Auto-focus cancel button (safer default) and handle Escape key
  useEffect(() => {
    if (!open) return;
    cancelBtnRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in-up">

        {/* Icon */}
        <div className={`w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center text-2xl mx-auto mb-4`}>
          {styles.icon}
        </div>

        {/* Text */}
        <h3
          id="confirm-dialog-title"
          className="text-lg font-bold text-gray-900 text-center mb-2"
        >
          {title}
        </h3>
        <p className="text-sm text-gray-500 text-center leading-relaxed mb-6">
          {message}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            ref={cancelBtnRef}
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl text-white font-semibold text-sm transition-colors focus:outline-none focus:ring-2 ${styles.confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
