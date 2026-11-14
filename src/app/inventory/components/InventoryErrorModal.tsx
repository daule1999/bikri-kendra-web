'use client';

interface InventoryErrorModalProps {
  message: string;
  visible: boolean;
  onClose: () => void;
}

export default function InventoryErrorModal({ message, visible, onClose }: InventoryErrorModalProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-sm">
        <div className="text-center">
          <div className="text-red-600 text-4xl mb-4">✗</div>
          <h3 className="text-lg font-semibold mb-2">Error!</h3>
          <p className="text-gray-600 mb-4">{message}</p>
          <button
            onClick={onClose}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
