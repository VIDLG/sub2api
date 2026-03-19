import { useTranslation } from 'react-i18next'
import { MailIcon, UserIcon } from 'lucide-react'
import type { User } from '@/types'

interface ProfileInfoCardProps {
  user: User | null
}

export default function ProfileInfoCard({ user }: ProfileInfoCardProps) {
  const { t } = useTranslation()

  const roleBadgeClass = user?.role === 'admin' ? 'badge-primary' : 'badge-gray'
  const statusBadgeClass = user?.status === 'active' ? 'badge-success' : 'badge-danger'
  const statusLabel =
    user?.status === 'active' ? t('common.active', 'Active') : t('common.disabled', 'Disabled')

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-gray-100 bg-gradient-to-r from-primary-500/10 to-primary-600/5 px-6 py-5 dark:border-dark-700 dark:from-primary-500/20 dark:to-primary-600/10">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-2xl font-bold text-white shadow-lg shadow-primary-500/20">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
              {user?.email || '-'}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`badge ${roleBadgeClass}`}>
                {user?.role === 'admin'
                  ? t('profile.administrator', 'Administrator')
                  : t('profile.user', 'User')}
              </span>
              <span className={`badge ${statusBadgeClass}`}>{statusLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <MailIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            <span className="truncate">{user?.email || '-'}</span>
          </div>
          {user?.username ? (
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <UserIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              <span className="truncate">{user.username}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
