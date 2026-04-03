import type { ReactNode } from 'react'
import AdminBreadcrumbs, {
  type BreadcrumbItem,
} from '@/features/admin/components/AdminBreadcrumbs'

type AdminTone = 'slate' | 'sky' | 'emerald' | 'amber' | 'rose'

const METRIC_TONE_STYLES: Record<AdminTone, string> = {
  slate: 'from-slate-950 to-slate-800 text-white',
  sky: 'from-sky-500 to-cyan-500 text-white',
  emerald: 'from-emerald-500 to-teal-500 text-white',
  amber: 'from-amber-400 to-orange-500 text-slate-950',
  rose: 'from-rose-500 to-pink-500 text-white',
}

export interface AdminMetric {
  readonly label: string
  readonly value: string
  readonly hint?: string
  readonly tone?: AdminTone
}

interface AdminPageShellProps {
  readonly breadcrumbs: readonly BreadcrumbItem[]
  readonly eyebrow?: string
  readonly title: string
  readonly description: string
  readonly actions?: ReactNode
  readonly metrics?: readonly AdminMetric[]
  readonly children: ReactNode
}

interface AdminPanelProps {
  readonly title?: string
  readonly description?: string
  readonly actions?: ReactNode
  readonly children: ReactNode
  readonly className?: string
}

export function AdminMetricGrid({
  metrics,
}: Readonly<{ metrics: readonly AdminMetric[] }>) {
  if (metrics.length === 0) {
    return null
  }

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const tone = METRIC_TONE_STYLES[metric.tone ?? 'slate']

        return (
          <article
            key={metric.label}
            className={`overflow-hidden rounded-[1.5rem] bg-gradient-to-br p-[1px] shadow-[0_20px_50px_-36px_rgba(15,23,42,0.55)] ${tone}`}
          >
            <div className="h-full rounded-[calc(1.5rem-1px)] bg-white/12 p-5 backdrop-blur-sm">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-current/70">
                {metric.label}
              </p>
              <p className="mt-3 text-3xl font-black tracking-tight">
                {metric.value}
              </p>
              {metric.hint ? (
                <p className="mt-2 text-sm text-current/80">{metric.hint}</p>
              ) : null}
            </div>
          </article>
        )
      })}
    </section>
  )
}

export function AdminPanel({
  title,
  description,
  actions,
  children,
  className,
}: AdminPanelProps) {
  return (
    <section
      className={[
        'rounded-[1.75rem] border border-slate-200/80 bg-white/92 p-6 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)] backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/88 dark:shadow-[0_24px_60px_-42px_rgba(2,6,23,0.92)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {title || description || actions ? (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            {title ? (
              <h2 className="text-xl font-bold tracking-tight text-slate-950 dark:text-slate-50 sm:text-2xl">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function AdminPageShell({
  breadcrumbs,
  eyebrow,
  title,
  description,
  actions,
  metrics,
  children,
}: AdminPageShellProps) {
  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <AdminBreadcrumbs items={[...breadcrumbs]} />

      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.96))] p-6 shadow-[0_28px_70px_-48px_rgba(15,23,42,0.55)] sm:p-8 dark:border-slate-700/70 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.22),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_20%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(15,23,42,0.94),_rgba(17,24,39,0.92))] dark:shadow-[0_28px_70px_-48px_rgba(2,6,23,0.95)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300 to-transparent dark:via-sky-400/70" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            {eyebrow ? (
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-sky-700 dark:text-sky-300">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              {description}
            </p>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>
          ) : null}
        </div>
      </section>

      {metrics ? <AdminMetricGrid metrics={metrics} /> : null}

      <div className="space-y-6">{children}</div>
    </main>
  )
}
