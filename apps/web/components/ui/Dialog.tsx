'use client';

import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { Icon } from './Icon';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  variant?: 'dialog' | 'drawer';
  role?: 'dialog' | 'alertdialog';
  busy?: boolean;
}

let scrollLocks = 0;
let originalOverflow = '';

export function Dialog({ open, onOpenChange, title, description, children, initialFocusRef, variant = 'dialog', role = 'dialog', busy = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    initialFocusRef?.current?.focus();
    if (scrollLocks++ === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      dialog.close();
      if (--scrollLocks === 0) document.body.style.overflow = originalOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open, initialFocusRef]);

  return <dialog ref={ref} className={`ui-dialog ${variant === 'drawer' ? 'ui-drawer' : ''}`} role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} aria-busy={busy || undefined}
    onCancel={event => { event.preventDefault(); if (!busy) onOpenChange(false); }}
    onClick={event => {
      if (event.target !== event.currentTarget || busy) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onOpenChange(false);
    }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')).filter(element => !element.matches(':disabled, [tabindex="-1"]') && element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
    <header className="ui-dialog-header">
      <div className="min-w-0"><h2 id={titleId} className="text-lg font-semibold tracking-tight">{title}</h2>{description && <p id={descriptionId} className="ui-muted mt-2 text-sm leading-relaxed">{description}</p>}</div>
      <button type="button" className="ui-icon-button shrink-0" aria-label="Cerrar diálogo" disabled={busy} onClick={() => onOpenChange(false)}><Icon name="close" /></button>
    </header>
    <div className="ui-dialog-body">{children}</div>
  </dialog>;
}
