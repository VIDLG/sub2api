import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm } from '@tanstack/react-form'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { userAPI } from '@/api/user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EyeIcon, EyeSlashIcon } from '@/components/icons'
import ProfileInfoCard from '@/components/user/profile/ProfileInfoCard'

function formatBalance(b: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(b)
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString()
}

export default function ProfileView() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)
  const user = useAuthStore((s) => s.user)
  const refreshUser = useAuthStore((s) => s.refreshUser)

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const profileForm = useForm({
    defaultValues: { username: user?.username || '' },
    onSubmit: async ({ value }) => {
      if (!value.username.trim()) {
        showError(t('profile.usernameRequired', 'Username is required'))
        return
      }
      try {
        await userAPI.updateProfile({ username: value.username.trim() })
        await refreshUser()
        showSuccess(t('profile.profileUpdated', 'Profile updated successfully'))
      } catch (err) {
        showError(
          (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
            t('profile.updateFailed', 'Failed to update profile'),
        )
      }
    },
  })

  const passwordForm = useForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    onSubmit: async ({ value }) => {
      if (!value.currentPassword) {
        showError(t('profile.currentPasswordRequired', 'Current password is required'))
        return
      }
      if (value.newPassword.length < 6) {
        showError(t('profile.passwordTooShort', 'New password must be at least 6 characters'))
        return
      }
      if (value.newPassword !== value.confirmPassword) {
        showError(t('profile.passwordMismatch', 'Passwords do not match'))
        return
      }
      try {
        await userAPI.changePassword(value.currentPassword, value.newPassword)
        showSuccess(t('profile.passwordChanged', 'Password changed successfully'))
        passwordForm.reset()
      } catch (err) {
        showError(
          (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
            t('profile.passwordChangeFailed', 'Failed to change password'),
        )
      }
    },
  })

  const { Field: ProfileForm_Field } = profileForm
  const { Field: PasswordForm_Field } = passwordForm

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('profile.balance', 'Balance')}
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
            ${formatBalance(user?.balance || 0)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('profile.concurrency', 'Concurrency')}
          </p>
          <p className="mt-1 text-xl font-bold text-blue-600 dark:text-blue-400">
            {user?.concurrency || 0}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('profile.memberSince', 'Member Since')}
          </p>
          <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
            {user?.created_at ? formatDate(user.created_at) : '-'}
          </p>
        </div>
      </div>

      <ProfileInfoCard user={user} />

      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          {t('profile.editProfile', 'Edit Profile')}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            profileForm.handleSubmit()
          }}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label>{t('common.email', 'Email')}</Label>
            <Input
              value={user?.email || ''}
              readOnly
              disabled
              className="cursor-not-allowed bg-gray-50 dark:bg-dark-800"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {t('profile.emailReadonly', 'Email cannot be changed.')}
            </p>
          </div>
          <ProfileForm_Field name="username">
            {(field) => (
              <div className="space-y-2">
                <Label>{t('profile.username', 'Username')}</Label>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('profile.usernamePlaceholder', 'Enter your username')}
                />
              </div>
            )}
          </ProfileForm_Field>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={profileForm.state.isSubmitting}>
              {profileForm.state.isSubmitting ? (
                <>
                  <div className="spinner mr-2 h-4 w-4" />
                  {t('common.saving', 'Saving...')}
                </>
              ) : (
                t('common.save', 'Save')
              )}
            </Button>
          </div>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          {t('profile.changePassword', 'Change Password')}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            passwordForm.handleSubmit()
          }}
          className="space-y-5"
        >
          <PasswordForm_Field name="currentPassword">
            {(field) => (
              <div className="space-y-2">
                <Label>{t('profile.currentPassword', 'Current Password')}</Label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showCurrentPassword ? (
                      <EyeSlashIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </PasswordForm_Field>
          <PasswordForm_Field name="newPassword">
            {(field) => (
              <div className="space-y-2">
                <Label>{t('profile.newPassword', 'New Password')}</Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className="pr-10"
                    placeholder={t('profile.minPassword', 'At least 6 characters')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showNewPassword ? (
                      <EyeSlashIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </PasswordForm_Field>
          <PasswordForm_Field name="confirmPassword">
            {(field) => (
              <div className="space-y-2">
                <Label>{t('profile.confirmPassword', 'Confirm New Password')}</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showConfirmPassword ? (
                      <EyeSlashIcon className="h-4 w-4" />
                    ) : (
                      <EyeIcon className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </PasswordForm_Field>
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={
                passwordForm.state.isSubmitting ||
                !passwordForm.state.values.currentPassword ||
                !passwordForm.state.values.newPassword ||
                !passwordForm.state.values.confirmPassword
              }
            >
              {passwordForm.state.isSubmitting ? (
                <>
                  <div className="spinner mr-2 h-4 w-4" />
                  {t('profile.changing', 'Changing...')}
                </>
              ) : (
                t('profile.changePasswordBtn', 'Change Password')
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
