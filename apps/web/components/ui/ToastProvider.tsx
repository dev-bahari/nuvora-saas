'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface Toast { id: number; message: string; kind: 'success' | 'error' }
interface ToastContext { success: (message: string) => void; error: (message: string) => void }
const Context = createContext<ToastContext | null>(null);

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || toast.kind === 'error') return;
    const timer = window.setTimeout(() => dismiss(toast.id), 6000);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.kind, paused, dismiss]);
  return <li className={`ui-toast ui-toast-${toast.kind}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
    <Icon name={toast.kind === 'success' ? 'check' : 'warning'} className="mt-3 shrink-0" />
    <p className="min-w-0 flex-1 break-words py-3 text-sm leading-relaxed" role={toast.kind === 'success' ? 'status' : 'alert'} aria-atomic="true">{toast.message}</p>
    <button type="button" className="ui-icon-button shrink-0" aria-label="Cerrar notificación" onClick={() => dismiss(toast.id)}><Icon name="close" /></button>
  </li>;
}

export function ToastViewport({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  const [host, setHost] = useState<HTMLDialogElement | null>(null);
  useEffect(() => {
    // A native modal makes outside content inert. Keep its feedback in the same
    // top layer so both assistive technology and pointer users can reach it.
    const sync = () => setHost(Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).at(-1) ?? null);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'], childList: true });
    sync();
    return () => observer.disconnect();
  }, []);
  const viewport = <section className="ui-toast-viewport" aria-label="Notificaciones"><ul className="space-y-3">{toasts.map(toast => <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />)}</ul></section>;
  return host ? createPortal(viewport, host) : viewport;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback((id: number) => setToasts(current => current.filter(toast => toast.id !== id)), []);
  const add = useCallback((kind: Toast['kind'], message: string) => setToasts(current => [...current, { id: nextId.current++, kind, message }]), []);
  const value = useMemo(() => ({ success: (message: string) => add('success', message), error: (message: string) => add('error', message) }), [add]);
  return <Context.Provider value={value}>{children}<ToastViewport toasts={toasts} dismiss={dismiss} /></Context.Provider>;
}

export function useToast(): ToastContext {
  const value = useContext(Context);
  if (!value) throw new Error('useToast must be used within ToastProvider');
  return value;
}
