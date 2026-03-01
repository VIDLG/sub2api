import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import announcementsAPI from '@/api/announcements'
import { useAppStore } from '@/stores/app'
import type { UserAnnouncement } from '@/types'
import { BellIcon, CheckIcon } from '@/components/icons'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(content: string): string {
  if (!content) return ''
  return DOMPurify.sanitize(marked.parse(content) as string)
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function AnnouncementBell() {
  const { t } = useTranslation()
  const showError = useAppStore((s) => s.showError)
  const showSuccess = useAppStore((s) => s.showSuccess)

  const [announcements, setAnnouncements] = useState<UserAnnouncement[]>([])
  const [isListOpen, setIsListOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<UserAnnouncement | null>(null)
  const [loading, setLoading] = useState(false)

  const unreadCount = announcements.filter((a) => !a.read_at).length

  const loadAnnouncements = async () => {
    setLoading(true)
    try {
      const data = await announcementsAPI.list(false)
      setAnnouncements(data.slice(0, 20))
    } catch (err: unknown) {
      showError((err as { message?: string })?.message || t('common.unknownError', 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnnouncements()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function markAsRead(id: number) {
    try {
      await announcementsAPI.markRead(id)
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, read_at: new Date().toISOString() } : a)),
      )
      setSelectedItem((prev) =>
        prev?.id === id ? { ...prev, read_at: new Date().toISOString() } : prev,
      )
    } catch (err: unknown) {
      showError((err as { message?: string })?.message || t('common.unknownError', 'Unknown error'))
    }
  }

  async function markAllAsRead() {
    setLoading(true)
    try {
      await Promise.all(
        announcements.filter((a) => !a.read_at).map((a) => announcementsAPI.markRead(a.id)),
      )
      const now = new Date().toISOString()
      setAnnouncements((prev) => prev.map((a) => (a.read_at ? a : { ...a, read_at: now })))
      showSuccess(t('announcements.allMarkedAsRead', 'All marked as read'))
    } catch (err: unknown) {
      showError((err as { message?: string })?.message || t('common.unknownError', 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  function openDetail(item: UserAnnouncement) {
    setSelectedItem(item)
    if (!item.read_at) markAsRead(item.id)
  }

  return (
    <>
      {/* Bell button */}
      <button
        onClick={() => setIsListOpen(true)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-all hover:bg-gray-100 hover:scale-105 dark:hover:bg-dark-800 ${unreadCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}
        aria-label={t('announcements.title', 'Announcements')}
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
        )}
      </button>

      {/* List dialog */}
      <Dialog open={isListOpen} onOpenChange={setIsListOpen}>
        <DialogContent className="max-w-[620px] gap-0 p-0 overflow-hidden">
          <DialogHeader className="border-b border-gray-100/80 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 px-6 py-5 dark:border-dark-700/50 dark:from-blue-900/10 dark:to-indigo-900/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
                    <BellIcon className="h-4 w-4" />
                  </div>
                  <DialogTitle className="text-lg font-semibold">
                    {t('announcements.title', 'Announcements')}
                  </DialogTitle>
                </div>
                {unreadCount > 0 && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      {unreadCount}
                    </span>{' '}
                    {t('announcements.unread', 'unread')}
                  </p>
                )}
              </div>
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  onClick={markAllAsRead}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
                >
                  {t('announcements.markAllRead', 'Mark all read')}
                </Button>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[65vh]">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="spinner h-10 w-10" />
              </div>
            ) : announcements.length > 0 ? (
              announcements.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openDetail(item)}
                  className={`group relative flex cursor-pointer items-center gap-4 border-b border-gray-100 px-6 py-4 transition-all hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-700/30 ${!item.read_at ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}`}
                >
                  {!item.read_at && (
                    <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-blue-500 to-indigo-600" />
                  )}
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
                    {!item.read_at ? (
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-xl bg-blue-400 opacity-75" />
                        <BellIcon className="relative z-10 h-5 w-5" />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-dark-700 dark:text-gray-600">
                        <CheckIcon className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {item.title}
                      </h3>
                      <div className="mt-1 flex items-center gap-2">
                        <time className="text-xs text-gray-500">
                          {formatRelativeTime(item.created_at)}
                        </time>
                        {!item.read_at && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-600" />
                            </span>
                            {t('announcements.unread', 'Unread')}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg
                      className="h-5 w-5 flex-shrink-0 text-gray-400 transition-transform group-hover:translate-x-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-700 dark:to-dark-600">
                  <BellIcon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {t('announcements.empty', 'No announcements')}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {t('announcements.emptyDescription', "You're all caught up!")}
                </p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog
        open={!!selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null)
        }}
      >
        <DialogContent className="max-w-[780px] gap-0 p-0 overflow-hidden">
          <DialogHeader className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-purple-50/30 px-8 py-6 dark:border-dark-700 dark:from-blue-900/20 dark:via-indigo-900/10 dark:to-purple-900/5">
            <div className="absolute right-0 top-0 h-full w-64 bg-gradient-to-l from-indigo-100/30 to-transparent dark:from-indigo-900/20" />
            <div className="relative z-10">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
                  <BellIcon className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {t('announcements.title', 'Announcement')}
                  </span>
                  {selectedItem && !selectedItem.read_at && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-2.5 py-1 text-xs font-medium text-white">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                      </span>
                      {t('announcements.unread', 'Unread')}
                    </span>
                  )}
                </div>
              </div>
              <DialogTitle className="mb-2 text-2xl font-bold leading-tight">
                {selectedItem?.title}
              </DialogTitle>
              <p className="text-sm text-gray-500">
                {selectedItem ? formatRelativeTime(selectedItem.created_at) : ''}
              </p>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] px-8 py-8">
            <div className="relative">
              <div className="absolute bottom-0 left-0 top-0 w-1 rounded-full bg-gradient-to-b from-blue-500 via-indigo-500 to-purple-500" />
              <div
                className="announcement-markdown prose prose-sm max-w-none pl-6 dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: selectedItem ? renderMarkdown(selectedItem.content) : '',
                }}
              />
            </div>
          </ScrollArea>

          <DialogFooter className="border-t border-gray-100 bg-gray-50/50 px-8 py-4 dark:border-dark-700 dark:bg-dark-900/30">
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              {t('common.close', 'Close')}
            </Button>
            {selectedItem && !selectedItem.read_at && (
              <Button
                onClick={async () => {
                  await markAsRead(selectedItem.id)
                  showSuccess(t('announcements.markedAsRead', 'Marked as read'))
                  setSelectedItem(null)
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
              >
                <CheckIcon className="mr-2 h-4 w-4" />
                {t('announcements.markRead', 'Mark as read')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
