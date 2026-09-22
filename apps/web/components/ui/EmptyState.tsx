import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function EmptyState({ title, description, action, icon = 'invoice' }: { title: string; description: string; action?: ReactNode; icon?: 'invoice' | 'customers' | 'products' | 'search' }) {
  return <section className="ui-empty-state">
    <Icon name={icon} width="32" height="32" className="ui-muted" />
    <h2 className="mt-5 text-base font-semibold">{title}</h2>
    <p className="ui-muted mt-2 max-w-md text-sm leading-relaxed">{description}</p>
    {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
  </section>;
}
