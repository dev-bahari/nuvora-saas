import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Dialog } from '../../apps/web/components/ui/Dialog';
import { ConfirmDialog } from '../../apps/web/components/ui/ConfirmDialog';
import { ToastProvider, useToast } from '../../apps/web/components/ui/ToastProvider';
import { AppShell } from '../../apps/web/components/app-shell/AppShell';
import { EmptyState } from '../../apps/web/components/ui/EmptyState';
import { DataToolbar } from '../../apps/web/components/ui/DataToolbar';
import { PageHeader } from '../../apps/web/components/ui/PageHeader';
import '../../apps/web/app/globals.css';

function Fixture() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shouldFail, setShouldFail] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const toast = useToast();
  return <AppShell tenantName="Empresa de prueba" fullName="Ana García">
    <main className="page-content">
      <PageHeader title="Clientes" description="Administra los datos de tus clientes para facturar." action={<button className="ui-button-primary" onClick={() => setOpen(true)}>Nuevo cliente</button>} />
      <DataToolbar searchLabel="Buscar clientes" searchValue={query} onSearchChange={setQuery} activeFilterCount={status ? 1 : 0} onClear={() => { setQuery(''); setStatus(''); }} filters={<label className="ui-field-label">Estado<select className="input" value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos</option><option value="active">Activos</option></select></label>} />
      <EmptyState title="Agrega tu primer cliente" description="Guarda sus datos una vez y tenlos listos para tu próxima factura." action={<button className="ui-button-secondary" onClick={() => setOpen(true)}>Crear cliente</button>} />
      <div className="flex flex-wrap gap-3"><button className="ui-button-secondary" onClick={() => { setShouldFail(false); setConfirm(true); }}>Eliminar prueba</button><button className="ui-button-secondary" onClick={() => { setShouldFail(true); setConfirm(true); }}>Eliminar con error</button><button className="ui-button-secondary" onClick={() => toast.success('Cliente guardado')}>Aviso de éxito</button><button className="ui-button-secondary" onClick={() => toast.error('No pudimos guardar. Inténtalo de nuevo.')}>Aviso de error</button></div>
      <output aria-label="Resultado">{saved ? 'Eliminado' : 'Sin cambios'}</output>
      <Dialog open={open} onOpenChange={setOpen} title="Nuevo cliente" description="Completa los datos del cliente.">
        <label className="ui-field-label">Nombre<input className="input" name="name" /></label>
        <button className="ui-button-primary" onClick={() => { setOpen(false); toast.success('Cliente guardado'); }}>Guardar cliente</button>
      </Dialog>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Eliminar cliente" description="Este cliente se eliminará." confirmLabel="Eliminar cliente" destructive onConfirm={async () => { await new Promise(resolve => setTimeout(resolve, 200)); if (shouldFail) throw new Error('No pudimos eliminar. Inténtalo de nuevo.'); setSaved(true); }} />
    </main>
  </AppShell>;
}

createRoot(document.getElementById('root')!).render(<ToastProvider><Fixture /></ToastProvider>);
