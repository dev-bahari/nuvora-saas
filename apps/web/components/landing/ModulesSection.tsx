import React from 'react';

export function ModulesSection() {
  const modules = [
    {
      category: 'Ventas',
      title: 'Facturación y Cotizaciones',
      description:
        'Crea cotizaciones y conviértelas en facturas electrónicas con un solo clic. Genera notas crédito o débito cuando lo requieras sin complicaciones.',
      badge: 'Esencial',
      icon: (
        <svg className="w-5 h-5 text-leaf-600 dark:text-leaf-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      accentBorder: 'hover:border-leaf-500/50',
      highlights: ['Factura electrónica en 1 clic', 'Notas crédito y débito', 'Representación gráfica PDF con tu logo', 'Envío automático por correo'],
    },
    {
      category: 'Clientes',
      title: 'Directorio Inteligente de Clientes',
      description:
        'Guarda los datos de personas naturales y empresas. El sistema calcula automáticamente el dígito de verificación del NIT para que nunca cometas errores.',
      badge: 'Gestión',
      icon: (
        <svg className="w-5 h-5 text-sapphire-600 dark:text-sapphire-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      accentBorder: 'hover:border-sapphire-500/50',
      highlights: ['Verificación automática de NIT y RUT', 'Historial de compras por cliente', 'Plazos de crédito y cobranza', 'Importación masiva desde Excel'],
    },
    {
      category: 'Catálogo',
      title: 'Productos, Servicios y Precios',
      description:
        'Administra tu lista de productos o servicios con sus tarifas de IVA y precios claros. Encuentra rápidamente lo que vas a facturar.',
      badge: 'Organización',
      icon: (
        <svg className="w-5 h-5 text-leaf-600 dark:text-leaf-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
      accentBorder: 'hover:border-leaf-500/50',
      highlights: ['Búsqueda rápida al facturar', 'Tarifas de IVA configurables', 'Control de stock y referencias', 'Códigos oficiales DIAN guiados'],
    },
    {
      category: 'Finanzas',
      title: 'Reportes y Cuentas Claras',
      description:
        'Visualiza en tiempo real cuánto vendes al mes, qué facturas están pendientes de pago y exporta reportes detallados para tu contador.',
      badge: 'Claridad',
      icon: (
        <svg className="w-5 h-5 text-sapphire-600 dark:text-sapphire-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
      accentBorder: 'hover:border-sapphire-500/50',
      highlights: ['Tablero de ventas en tiempo real', 'Reporte para declaración tributaria', 'Exportación a Excel en un clic', 'Balance mensual automático'],
    },
    {
      category: 'Colaboración',
      title: 'Equipo y Accesos Seguros',
      description:
        'Invita a tu equipo de trabajo o a tu contador externo y define qué información puede ver o editar cada uno según su función.',
      badge: 'Multiusuario',
      icon: (
        <svg className="w-5 h-5 text-leaf-600 dark:text-leaf-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      ),
      accentBorder: 'hover:border-leaf-500/50',
      highlights: ['Roles de administrador, vendedor y contador', 'Historial de cambios por usuario', 'Acceso seguro 24/7 en la nube', 'Sin límites de dispositivos'],
    },
    {
      category: 'Respaldo',
      title: 'Historial y Descargas Inmediatas',
      description:
        'Tus facturas y comprobantes quedan organizados y archivados para siempre. Encuentra cualquier documento del pasado en 2 clics.',
      badge: 'Siempre Seguro',
      icon: (
        <svg className="w-5 h-5 text-sapphire-600 dark:text-sapphire-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
      accentBorder: 'hover:border-sapphire-500/50',
      highlights: ['Custodia legal a 5 años garantizada', 'Descarga masiva de comprobantes', 'Acceso a XML oficial y PDF', 'Búsqueda por fecha, cliente o valor'],
    },
  ];

  return (
    <section id="modulos" className="py-24 relative overflow-hidden bg-slate-50/60 dark:bg-slate-950/80 transition-colors duration-200 border-t border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sapphire-50 dark:bg-sapphire-950/60 border border-sapphire-200 dark:border-sapphire-800/80 text-xs font-bold text-sapphire-800 dark:text-sapphire-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-sapphire-500 animate-pulse" />
            Módulos Fáciles de Usar
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Herramientas prácticas para hacer crecer tu empresa
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed">
            Todo lo que necesitas para tu día a día, sin complicaciones técnicas ni pantallas confusas.
            Comienza con lo básico y activa más funciones cuando tu negocio lo necesite.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {modules.map((m) => (
            <div
              key={m.title}
              className={`card-hover-lift rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 p-8 flex flex-col justify-between shadow-sm hover:shadow-xl transition-all duration-300 ${m.accentBorder}`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60">
                      {m.icon}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-leaf-700 dark:text-leaf-400">
                      {m.category}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {m.badge}
                  </span>
                </div>

                <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white">
                  {m.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {m.description}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/80">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-200 mb-3">
                  Incluye:
                </div>
                <ul className="space-y-2.5">
                  {m.highlights.map((h) => (
                    <li key={h} className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-leaf-100 dark:bg-leaf-950/80 flex items-center justify-center flex-shrink-0 text-leaf-600 dark:text-leaf-400">
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
