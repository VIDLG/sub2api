import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export default function NotFoundView() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 dark:from-dark-950 dark:to-dark-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary-200/30 blur-3xl dark:bg-primary-900/20" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-red-200/30 blur-3xl dark:bg-red-900/20" />
      </div>

      <div className="relative text-center">
        <div className="mb-6 flex items-center justify-center gap-4">
          <span className="text-8xl font-black text-gray-200 dark:text-dark-800">4</span>
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg
              className="h-10 w-10 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <span className="text-8xl font-black text-gray-200 dark:text-dark-800">4</span>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
          {t('notFound.title', 'Page Not Found')}
        </h1>
        <p className="mb-8 text-gray-500 dark:text-gray-400">
          {t(
            'notFound.description',
            'The page you are looking for does not exist or has been moved.',
          )}
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="rounded-xl border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-dark-600 dark:bg-dark-800 dark:text-gray-300 dark:hover:bg-dark-700"
          >
            {t('notFound.goBack', 'Go Back')}
          </button>
          <button
            onClick={() => navigate({ to: '/dashboard' })}
            className="btn-primary rounded-xl px-6 py-2.5 text-sm font-medium"
          >
            {t('notFound.goHome', 'Go to Dashboard')}
          </button>
        </div>
      </div>
    </div>
  )
}
