'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

export interface DataToolbarProps {
  searchLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  activeFilterCount?: number;
  onClear?: () => void;
  children?: ReactNode;
}

export function DataToolbar({ searchLabel, searchValue, onSearchChange, searchPlaceholder, filters, activeFilterCount = 0, onClear, children }: DataToolbarProps) {
  const id = useId();
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const sync = () => { setMobile(media.matches); if (!media.matches) setOpen(false); };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return <div className="ui-toolbar" role="search" aria-label={searchLabel}>
    <div className="min-w-0 flex-1"><label className="ui-field-label" htmlFor={id}>{searchLabel}</label><div className="relative mt-2"><Icon name="search" className="ui-muted pointer-events-none absolute left-3 top-3" /><input id={id} type="search" className="input ui-search-input" value={searchValue} onChange={event => onSearchChange(event.target.value)} placeholder={searchPlaceholder ?? searchLabel} /></div></div>
    {filters && (mobile ? <><button type="button" className="ui-button-secondary" onClick={() => setOpen(true)}><Icon name="filter" />{activeFilterCount ? `Filtros (${activeFilterCount})` : 'Filtros'}</button><Dialog open={open} onOpenChange={setOpen} title="Filtros"><div className="space-y-4">{filters}</div><div className="ui-dialog-actions"><button type="button" className="ui-button-primary" onClick={() => setOpen(false)}>Ver resultados</button></div></Dialog></> : <div className="flex flex-wrap items-end gap-3">{filters}</div>)}
    {onClear && (searchValue || activeFilterCount > 0) && <button type="button" className="ui-button-quiet" onClick={onClear}>Limpiar filtros</button>}
    {children}
  </div>;
}
