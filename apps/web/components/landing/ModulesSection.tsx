import React from 'react';

export function ModulesSection() {
  const modules = [
    {
      category: 'Facturación & Ventas',
      title: 'Emisión Fiscal Instantánea',
      description:
        'Crea borradores colaborativos, calcula impuestos con precisión decimal y emite facturas con un clic. Validación DIAN directa con código QR y generación de PDF oficial.',
      badge: 'Core Fiscal',
      icon: (
        <svg className="w-5 h-5 text-leaf-600 dark:text-leaf-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      accentBorder: 'hover:border-leaf-500/50 dark:hover:border-leaf-500/50',
      badgeColor: 'bg-leaf-50 text-leaf-700 border-leaf-200 dark:bg-leaf-950/60 dark:text-leaf-300 dark:border-leaf-800',
      highlights: ['Factura Electrónica UBL 2.1', 'Notas Crédito y Débito', 'Representación Gráfica PDF', 'Envío Certificado por Email'],
    },
    {
      category: 'Directorio Comercial',
      title: 'Clientes y Terceros con RUT',
      description:
        'Administra personas naturales y jurídicas con validación automática del dígito de verificación DIAN. Asigna condiciones comerciales, plazos y exenciones impositivas.',
      badge: 'CRM Ligero',
      icon: (
        <svg className="w-5 h-5 text-sapphire-600 dark:text-sapphire-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      accentBorder: 'hover:border-sapphire-500/50 dark:hover:border-sapphire-500/50',
      badgeColor: 'bg-sapphire-50 text-sapphire-700 border-sapphire-200 dark:bg-sapphire-950/60 dark:text-sapphire-300 dark:border-sapphire-800',
      highlights: ['Validación DV Algorítmica', 'Régimen Simple y Ordinario', 'Historial Fiscal por Cliente', 'Exportación a Excel / CSV'],
    },
    {
      category: 'Inventario & Precios',
      title: 'Catálogo de Productos y Servicios',
      description:
        'Gestiona referencias, códigos estándar UNSPSC exigidos por la DIAN, unidades de medida y múltiples listas de precios con esquemas tributarios configurables.',
      badge: 'Catálogo DIAN',
      icon: (
        <svg className="w-5 h-5 text-leaf-600 dark:text-leaf-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
      accentBorder: 'hover:border-leaf-500/50 dark:hover:border-leaf-500/50',
      badgeColor: 'bg-leaf-50 text-leaf-700 border-leaf-200 dark:bg-leaf-950/60 dark:text-leaf-300 dark:border-leaf-800',
      highlights: ['Códigos UNSPSC Colombia', 'Tarifas IVA 0%, 5%, 19%', 'Retenciones en la Fuente / ICA', 'Control de Stock'],
    },
    {
      category: 'Finanzas',
      title: 'Contabilidad Básica Automática',
      description:
        'Cada documento fiscal emitido o recibido genera automáticamente su asiento contable de partida doble sin intervención manual, listo para reportes exógena y balance.',
      badge: 'Automatización',
      icon: (
        <svg className="w-5 h-5 text-sapphire-600 dark:text-sapphire-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
      accentBorder: 'hover:border-sapphire-500/50 dark:hover:border-sapphire-500/50',
      badgeColor: 'bg-sapphire-50 text-sapphire-700 border-sapphire-200 dark:bg-sapphire-950/60 dark:text-sapphire-300 dark:border-sapphire-800',
      highlights: ['Partida Doble Inmediata', 'Plan Único de Cuentas (PUC)', 'Libro Diario y Mayor', 'Cierre Fiscal Mensual'],
    },
    {
      category: 'Criptografía & Datos',
      title: 'Seguridad Multitenant con RLS',
      description:
        'Aislamiento riguroso a nivel de fila (PostgreSQL Row Level Security). Ningún tenant puede acceder ni consultar información de otra organización bajo ninguna circunstancia.',
      badge: 'Aislamiento Estricto',
      icon: (
        <svg className="w-5 h-5 text-leaf-600 dark:text-leaf-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      accentBorder: 'hover:border-leaf-500/50 dark:hover:border-leaf-500/50',
      badgeColor: 'bg-leaf-50 text-leaf-700 border-leaf-200 dark:bg-leaf-950/60 dark:text-leaf-300 dark:border-leaf-800',
      highlights: ['PostgreSQL FORCE RLS', 'Auditoría Inmutable Append-Only', 'Protección contra Inyección', 'Sesiones Cifradas Argon2id'],
    },
    {
      category: 'Infraestructura',
      title: 'Almacenamiento S3 Inmutable',
      description:
        'Los archivos XML firmados y los PDFs generados se custodian en almacenamiento de objetos compatible con S3 (MinIO), protegidos contra borrado y manipulación.',
      badge: 'Custodia Legal',
      icon: (
        <svg className="w-5 h-5 text-sapphire-600 dark:text-sapphire-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      ),
      accentBorder: 'hover:border-sapphire-500/50 dark:hover:border-sapphire-500/50',
      badgeColor: 'bg-sapphire-50 text-sapphire-700 border-sapphire-200 dark:bg-sapphire-950/60 dark:text-sapphire-300 dark:border-sapphire-800',
      highlights: ['Compatibilidad S3 / MinIO', 'Custodia Legal a 5 Años', 'URLs Seguras con Expiración', 'Descarga Masiva de Comprobantes'],
    },
  ];

  return (
    <section id="modulos" className="py-24 relative overflow-hidden bg-slate-50/60 dark:bg-slate-950/80 transition-colors duration-200 border-t border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sapphire-50 dark:bg-sapphire-950/60 border border-sapphire-200 dark:border-sapphire-800/80 text-xs font-semibold text-sapphire-700 dark:text-sapphire-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-sapphire-500 animate-pulse" />
            Arquitectura Modular Monolítica
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Un ERP diseñado para crecer al ritmo de tu empresa
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed">
            Activa solo los módulos que necesitas hoy. La arquitectura de Nuvora garantiza sincronización
            consistente y en tiempo real entre facturación, contabilidad y almacenamiento.
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
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60">
                      {m.icon}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-leaf-700 dark:text-leaf-400">
                      {m.category}
                    </span>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${m.badgeColor}`}>
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
                <div className="text-xs font-bold text-slate-900 dark:text-slate-200 mb-3 flex items-center justify-between">
                  <span>Capacidades incluidas</span>
                  <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">4 de 4 activas</span>
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
