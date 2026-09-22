'use client';

import { useRef, useState } from 'react';
import { Dialog } from './Dialog';
import { useToast } from './ToastProvider';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, destructive = false }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const toast = useToast();
  async function confirm() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos completar la acción. Inténtalo de nuevo.');
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }
  return <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} initialFocusRef={cancelRef} role="alertdialog" busy={pending}>
    <div className="ui-dialog-actions">
      <button ref={cancelRef} type="button" className="ui-button-secondary" disabled={pending} onClick={() => onOpenChange(false)}>Cancelar</button>
      <button type="button" className={destructive ? 'ui-button-danger' : 'ui-button-primary'} disabled={pending} onClick={() => void confirm()}>{pending ? 'Procesando…' : confirmLabel}</button>
    </div>
  </Dialog>;
}
