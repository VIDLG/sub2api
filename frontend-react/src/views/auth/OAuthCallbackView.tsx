/**
 * OAuth Callback View
 * Shows authorization code and state from OAuth callbacks.
 * Used for admin OAuth flows (e.g., Gemini).
 * Mirrors Vue auth/OAuthCallbackView.vue
 */

import { useRouterState } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ClipboardIcon, CheckIcon } from '@/components/icons'

export default function OAuthCallbackView() {
  const { t } = useTranslation()
  const searchParams = useRouterState({ select: (s) => new URLSearchParams(s.location.search) })

  const code = searchParams.get('code') || ''
  const state = searchParams.get('state') || ''
  const errorParam = searchParams.get('error') || ''
  const errorDescription = searchParams.get('error_description') || ''
  const fullUrl = window.location.href

  const [copied, setCopied] = useState<string | null>(null)

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-dark-950">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>{t('oauth.title', 'OAuth Callback')}</CardTitle>
          </CardHeader>
          <CardContent>
            {errorParam ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800/50 dark:bg-red-900/20">
                <p className="font-medium text-red-600 dark:text-red-400">{errorParam}</p>
                {errorDescription && (
                  <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errorDescription}</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('oauth.authorizationCode', 'Authorization Code')}</Label>
                  <div className="flex items-center gap-2">
                    <Input value={code} readOnly className="flex-1 font-mono text-sm" />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(code, 'code')}
                      title="Copy"
                    >
                      {copied === 'code' ? (
                        <CheckIcon className="h-4 w-4 text-green-500" />
                      ) : (
                        <ClipboardIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {state && (
                  <div className="space-y-2">
                    <Label>{t('oauth.state', 'State')}</Label>
                    <div className="flex items-center gap-2">
                      <Input value={state} readOnly className="flex-1 font-mono text-sm" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(state, 'state')}
                        title="Copy"
                      >
                        {copied === 'state' ? (
                          <CheckIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          <ClipboardIcon className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{t('oauth.callbackUrl', 'Callback URL')}</Label>
                  <div className="flex items-center gap-2">
                    <Input value={fullUrl} readOnly className="flex-1 font-mono text-xs" />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(fullUrl, 'url')}
                      title="Copy"
                    >
                      {copied === 'url' ? (
                        <CheckIcon className="h-4 w-4 text-green-500" />
                      ) : (
                        <ClipboardIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
