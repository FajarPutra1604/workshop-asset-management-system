import { clsx } from 'clsx'

export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-9 w-9' }
  return (
    <svg
      className={clsx('animate-spin text-indigo-600', sizes[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

export function FullPageSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/10 backdrop-blur-sm z-50">
      <div className="p-4 bg-white rounded-2xl shadow-modal border border-slate-200/80 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    </div>
  )
}
