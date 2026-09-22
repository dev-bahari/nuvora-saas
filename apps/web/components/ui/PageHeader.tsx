import type { ReactNode } from 'react';

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{description && <p className="ui-muted mt-2 max-w-prose text-sm leading-relaxed">{description}</p>}</div>
    {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
  </header>;
}
