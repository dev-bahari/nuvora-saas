'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';

const navigation = [
  { href: '/app/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/app/invoices', label: 'Facturas', icon: 'invoice' },
  { href: '/app/customers', label: 'Clientes', icon: 'customers' },
  { href: '/app/products', label: 'Productos', icon: 'products' },
  { href: '/app/settings', label: 'Configuración', icon: 'settings' },
] as const;

export function AppShell({ tenantName, fullName, children }: { tenantName: string; fullName: string; children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const active = navigation.find(item => pathname === item.href || pathname.startsWith(`${item.href}/`));

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem('nuvora_theme'); } catch { /* System theme remains available when storage is blocked. */ }
    const next = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (media.matches) setMenuOpen(false); };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('nuvora_theme', next ? 'dark' : 'light'); } catch { /* The current page still respects the choice. */ }
  }

  function nav() {
    return <nav aria-label="Navegación principal" className="space-y-1">{navigation.map(item => <Link key={item.href} href={item.href} aria-current={active?.href === item.href ? 'page' : undefined} className={`shell-nav-link ${active?.href === item.href ? 'shell-nav-active' : ''}`} onClick={() => setMenuOpen(false)}><Icon name={item.icon} /><span>{item.label}</span></Link>)}</nav>;
  }

  function identity() {
    return <div className="shell-identity"><span className="shell-avatar" aria-hidden="true">{tenantName.trim().slice(0, 1).toUpperCase() || 'E'}</span><div className="min-w-0"><p className="truncate text-sm font-semibold" title={tenantName}>{tenantName}</p><p className="ui-muted mt-1 truncate text-xs" title={fullName}>{fullName}</p></div></div>;
  }

  function logoutButton() {
    return <button type="button" className="shell-nav-link w-full" onClick={() => { setMenuOpen(false); setLogoutOpen(true); }}><Icon name="logout" /><span>Cerrar sesión</span></button>;
  }

  return <div className="app-shell">
    <a href="#app-content" className="shell-skip-link">Ir al contenido</a>
    <aside className="shell-sidebar">
      <Link href="/app/dashboard" className="shell-brand" aria-label="Empyra, inicio">Empyra<span className="shell-brand-dot" aria-hidden="true" /></Link>
      {identity()}
      <div className="flex-1 px-4 py-6">{nav()}</div>
      <div className="shell-sidebar-footer">{logoutButton()}</div>
    </aside>
    <div className="shell-workspace">
      <header className="shell-topbar">
        <div className="flex min-w-0 items-center gap-3"><button type="button" className="ui-icon-button lg:hidden" aria-label="Abrir menú" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Icon name="menu" /></button><span className="ui-muted hidden text-sm lg:block">{tenantName}</span><span className="truncate text-sm font-semibold lg:hidden">{active?.label ?? 'Empyra'}</span></div>
        <button type="button" className="ui-icon-button shrink-0" aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} onClick={toggleTheme}><Icon name={dark ? 'sun' : 'moon'} /></button>
      </header>
      <div id="app-content" tabIndex={-1} className="shell-content">{children}</div>
    </div>
    <Dialog open={menuOpen} onOpenChange={setMenuOpen} title="Navegación" variant="drawer"><div className="flex min-h-full flex-col gap-6">{identity()}{nav()}<div className="mt-auto border-t pt-4">{logoutButton()}</div></div></Dialog>
    <ConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} title="Cerrar sesión" description="Saldrás de tu cuenta en este dispositivo. Guarda los cambios pendientes antes de continuar." confirmLabel="Cerrar sesión" onConfirm={async () => {
      const response = await fetch('/api/logout', { method: 'POST' });
      if (!response.ok) throw new Error('No pudimos cerrar la sesión. Inténtalo de nuevo.');
      window.location.assign('/login');
    }} />
  </div>;
}
