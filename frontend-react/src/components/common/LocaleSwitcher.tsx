import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { availableLocales, setLocale } from '@/i18n'
import { ChevronDownIcon, CheckIcon } from '@/components/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function LocaleSwitcher() {
  const { i18n } = useTranslation()
  const [switching, setSwitching] = useState(false)

  const currentCode = i18n.language
  const currentLocale = availableLocales.find((l) => l.code === currentCode)

  async function handleSelect(code: string) {
    if (switching || code === currentCode) return
    setSwitching(true)
    try {
      await setLocale(code)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={switching}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-700"
          title={currentLocale?.name}
        >
          <span className="text-base">{currentLocale?.flag}</span>
          <span className="hidden sm:inline">{currentCode.toUpperCase()}</span>
          <ChevronDownIcon className="h-3 w-3 text-gray-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        {availableLocales.map((locale) => (
          <DropdownMenuItem
            key={locale.code}
            disabled={switching}
            onClick={() => handleSelect(locale.code)}
            className={
              locale.code === currentCode
                ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                : ''
            }
          >
            <span className="text-base">{locale.flag}</span>
            <span>{locale.name}</span>
            {locale.code === currentCode && (
              <CheckIcon className="ml-auto h-4 w-4 text-primary-500" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
