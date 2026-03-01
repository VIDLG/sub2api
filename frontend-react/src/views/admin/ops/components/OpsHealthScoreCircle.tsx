/**
 * OpsHealthScoreCircle
 * Animated SVG health-score ring with a hover diagnosis popover.
 */

import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { QuestionIcon } from '@/components/icons'
import {
  getHealthScoreColor,
  getHealthScoreClass,
  type DiagnosisItem,
} from '../utils/opsFormatters'

interface Props {
  healthScore: number | null | undefined
  isSystemIdle: boolean
  diagnosisReport: DiagnosisItem[]
  size?: number
  strokeWidth?: number
}

function DiagnosisIcon({ type }: { type: DiagnosisItem['type'] }) {
  if (type === 'critical') {
    return (
      <svg
        className="size-4 shrink-0 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    )
  }
  if (type === 'warning') {
    return (
      <svg
        className="size-4 shrink-0 text-yellow-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
        />
      </svg>
    )
  }
  return (
    <svg
      className="size-4 shrink-0 text-blue-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
    </svg>
  )
}

export function OpsHealthScoreCircle({
  healthScore,
  isSystemIdle,
  diagnosisReport,
  size = 100,
  strokeWidth = 8,
}: Props) {
  const { t } = useTranslation()

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const score = isSystemIdle ? 0 : (healthScore ?? 0)
  const dashOffset = circumference - (score / 100) * circumference
  const strokeColor = getHealthScoreColor(healthScore, isSystemIdle)
  const scoreClass = getHealthScoreClass(healthScore, isSystemIdle)

  const conditionLabel = isSystemIdle
    ? t('admin.ops.health.idleStatus', 'Idle')
    : typeof healthScore === 'number' && healthScore >= 90
      ? t('admin.ops.health.healthyStatus', 'Healthy')
      : t('admin.ops.health.riskyStatus', 'At Risk')

  return (
    <div className="flex flex-col items-center justify-center py-2">
      {/* Diagnosis hover popover — uses CSS group/group-hover */}
      <div className="group relative flex cursor-pointer flex-col items-center justify-center rounded-xl py-2 transition-all hover:bg-white/60 dark:hover:bg-dark-800/60">
        {/* Popover */}
        <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
          <div className="rounded-xl bg-white p-4 shadow-xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10">
            <h4 className="mb-3 flex items-center gap-2 border-b border-gray-100 pb-2 text-sm font-bold text-gray-900 dark:border-gray-700 dark:text-white">
              <svg
                className="size-4 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                />
              </svg>
              {t('admin.ops.diagnosis.title', 'Diagnosis Report')}
            </h4>

            <div className="space-y-3">
              {diagnosisReport.map((item, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="mt-0.5">
                    <DiagnosisIcon type={item.type} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">
                      {item.message}
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      {item.impact}
                    </div>
                    {item.action && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400">
                        <svg
                          className="size-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
                          />
                        </svg>
                        {item.action}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 border-t border-gray-100 pt-2 text-[10px] text-gray-400 dark:border-gray-700">
              {t(
                'admin.ops.diagnosis.footer',
                'Automated diagnostic suggestions based on current metrics',
              )}
            </div>
          </div>
        </div>

        {/* SVG Circle */}
        <div className="relative flex items-center justify-center">
          <svg width={size} height={size} className="-rotate-90 transform">
            {/* Background track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
              fill="transparent"
              className="text-gray-200 dark:text-dark-700"
              stroke="currentColor"
            />
            {/* Foreground progress */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
              fill="transparent"
              stroke={strokeColor}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Center text */}
          <div className="absolute flex flex-col items-center">
            <span className={`text-3xl font-black ${scoreClass}`}>
              {isSystemIdle ? t('admin.ops.health.idleStatus', 'Idle') : (healthScore ?? '—')}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {t('admin.ops.health.health', 'Health')}
            </span>
          </div>
        </div>
      </div>

      {/* Condition label */}
      <div className="mt-2 text-center">
        <div className="flex items-center justify-center gap-1 text-xs font-medium text-gray-500">
          {t('admin.ops.health.healthCondition', 'Health Condition')}
          <Tooltip>
            <TooltipTrigger asChild>
              <QuestionIcon className="size-3 text-gray-400" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {t(
                'admin.ops.health.healthHelp',
                'Composite score based on SLA, error rates, latency, and system resources',
              )}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className={`mt-1 text-xs font-bold ${scoreClass}`}>{conditionLabel}</div>
      </div>
    </div>
  )
}
