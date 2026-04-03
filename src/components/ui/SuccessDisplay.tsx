'use client'

export function SuccessDisplay({
  message,
}: Readonly<{ message: string | null }>) {
  if (!message) return null

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
      <div className="flex items-start">
        <svg
          className="w-5 h-5 text-green-600 mt-0.5 mr-3"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <h3 className="text-sm font-medium text-green-800">Success</h3>
          <p className="text-sm text-green-700 mt-1">{message}</p>
        </div>
      </div>
    </div>
  )
}
