import React from 'react';

export function DianShowcase() {
  const benefits = [
    {
      badge: 'Rapidez',
      title: 'Emisión en 1 Clic',
      description:
        'Crea y envía facturas electrónicas en menos de un minuto sin formularios confusos ni pasos innecesarios.',
      icon: (
        <svg className="w-5 h-5 text-leaf-600 dark:text-leaf-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      highlight: 'Envío inmediato al cliente',
    },
    {
      badge: 'Legalidad',
      title: 'Aprobación DIAN en Tiempo Real',
      description:
        'Cada factura se valida automáticamente ante la DIAN con su código QR y número oficial de autorización.',
      icon: (
        <svg className="w-5 h-5 text-sapphire-600 dark:text-sapphire-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      ),
      highlight: 'Sin riesgo de multas ni sanciones',
    },
    {
      badge: 'Cobranza',
      title: 'Control Total de tus Cobros',
      description:
        'Monitorea qué clientes te deben, envía recordatorios amables y mantén el flujo de caja de tu negocio al día.',
      icon: (
        <svg className="w-5 h-5 text-leaf-600 dark:text-leaf-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
      highlight: 'Cobra más rápido a tus clientes',
    },
    {
      badge: 'Organización',
      title: 'Cuentas Claras para tu Contador',
      description:
        'Genera reportes de ventas, compras e impuestos en un solo clic para que tu contador trabaje feliz y sin demoras.',
      icon: (
        <svg className="w-5 h-5 text-sapphire-600 dark:text-sapphire-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      highlight: 'Exporta a Excel en segundos',
    },
    {
      badge: 'Disponibilidad',
      title: 'Acceso Seguro desde Cualquier Lugar',
      description:
        'Factura desde tu oficina, tu casa o tu celular. Tu información está resguardada con seguridad de grado bancario.',
      icon: (
        <svg className="w-5 h-5 text-leaf-600 dark:text-leaf-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      highlight: 'Copias de seguridad diarias',
    },
    {
      badge: 'Tranquilidad',
      title: 'Tus Documentos Siempre a Salvo',
      description:
        'Custodiamos tus facturas y archivos durante 5 años conforme a la ley colombiana, listas para consultar cuando quieras.',
      icon: (
        <svg className="w-5 h-5 text-sapphire-600 dark:text-sapphire-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      highlight: 'Descarga masiva de PDFs y XML',
    },
  ];

  return (
    <section id="beneficios" className="py-20 relative overflow-hidden bg-white dark:bg-slate-900/40 transition-colors duration-200 border-t border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-leaf-50 dark:bg-leaf-950/60 border border-leaf-200 dark:border-leaf-800/80 text-xs font-bold text-leaf-800 dark:text-leaf-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-leaf-500" />
            Ventajas que Hacen Crecer tu Negocio
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Todo lo que tu empresa necesita para facturar sin enredos
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed">
            Empyra se encarga de las normas tributarias y los cálculos complejos. Tú dedícate a lo que mejor sabes hacer: vender y atender a tus clientes.
          </p>
        </div>

        {/* 6 Benefit Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="card-hover-lift rounded-2xl bg-slate-50/70 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 p-7 flex flex-col justify-between shadow-sm hover:shadow-xl hover:border-leaf-500/50 dark:hover:border-leaf-500/50 transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 shadow-sm">
                    {b.icon}
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-leaf-100/70 dark:bg-leaf-950 text-leaf-800 dark:text-leaf-300 border border-leaf-200 dark:border-leaf-800">
                    {b.badge}
                  </span>
                </div>

                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {b.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {b.description}
                </p>
              </div>

              <div className="pt-4 mt-5 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold text-leaf-700 dark:text-leaf-400">
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{b.highlight}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
