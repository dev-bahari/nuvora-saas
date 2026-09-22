import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: 'blue' | 'green' | 'amber' | 'red' | 'neutral';
  icon?: ReactNode;
}

const ACCENT_CLASS: Record<NonNullable<MetricCardProps['accent']>, string> = {
  blue:    'border-l-blue-500',
  green:   'border-l-green-600',
  amber:   'border-l-amber-400',
  red:     'border-l-red-500',
  neutral: 'border-l-slate-200 dark:border-l-slate-700',
};

export function MetricCard({ label, value, sub, accent = 'neutral', icon }: MetricCardProps) {
  return (
    <article
      className={`rounded-xl border border-l-4 bg-white p-5 dark:bg-slate-900 ${ACCENT_CLASS[accent]}`}
      style={{ borderLeftColor: undefined }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide ui-muted">{label}</p>
        {icon && <span className="ui-muted">{icon}</span>}
      </div>
      <p className="mt-3 text-2xl font-bold leading-none tracking-tight">{value}</p>
      {sub && <p className="mt-1.5 text-xs ui-muted">{sub}</p>}
    </article>
  );
}
