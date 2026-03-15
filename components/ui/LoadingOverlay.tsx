'use client';

import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function LoadingOverlay({ message = 'Loading...' }: Readonly<{ message?: string }>) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 flex flex-col items-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-700 font-medium">{message}</p>
      </div>
    </div>
  );
}
