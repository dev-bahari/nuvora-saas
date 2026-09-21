export function ModulesSection() {
  const modules = [
    {
      category: 'Facturación & Ventas',
      title: 'Emisión Fiscal Instantánea',
      description:
        'Crea borradores colaborativos, calcula impuestos con precisión decimal y emite facturas con un clic. Validación DIAN directa con código QR y generación de PDF oficial.',
      badge: 'Core',
      highlights: ['Factura Electrónica UBL 2.1', 'Notas Crédito y Débito', 'Representación Gráfica PDF', 'Envío Certificado por Email'],
    },
    {
      category: 'Directorio Comercial',
      title: 'Clientes y Terceros con RUT',
      description:
        'Administra personas naturales y jurídicas con validación automática del dígito de verificación DIAN. Asigna condiciones comerciales, plazos y exenciones impositivas.',
      badge: 'CRM Ligero',
      highlights: ['Validación DV Algorítmica', 'Régimen Simple y Ordinario', 'Historial Fiscal por Cliente', 'Exportación a Excel / CSV'],
    },
    {
      category: 'Inventario & Precios',
      title: 'Catálogo de Productos y Servicios',
      description:
        'Gestiona referencias, códigos estándar UNSPSC exigidos por la DIAN, unidades de medida y múltiples listas de precios con esquemas tributarios configurables.',
      badge: 'Catálogo',
      highlights: ['Códigos UNSPSC Colombia', 'Tarifas IVA 0%, 5%, 19%', 'Retenciones en la Fuente / ICA', 'Control de Stock'],
    },
    {
      category: 'Finanzas',
      title: 'Contabilidad Básica Automática',
      description:
        'Cada documento fiscal emitido o recibido genera automáticamente su asiento contable de partida doble sin intervención manual, listo para reportes exógena y balance.',
      badge: 'Automatización',
      highlights: ['Partida Doble Inmediata', 'Plan Único de Cuentas (PUC)', 'Libro Diario y Mayor', 'Cierre Fiscal Mensual'],
    },
    {
      category: 'Criptografía & Datos',
      title: 'Seguridad Multitenant con RLS',
      description:
        'Aislamiento riguroso a nivel de fila (PostgreSQL Row Level Security). Ningún tenant puede acceder ni consultar información de otra organización bajo ninguna circunstancia.',
      badge: 'Bank-Grade',
      highlights: ['PostgreSQL FORCE RLS', 'Auditoría Inmutable Append-Only', 'Protección contra Inyección', 'Sesiones Cifradas Argon2id'],
    },
    {
      category: 'Infraestructura',
      title: 'Almacenamiento S3 Inmutable',
      description:
        'Los archivos XML firmados y los PDFs generados se custodian en almacenamiento de objetos compatible con S3 (MinIO), protegidos contra borrado y manipulación.',
      badge: 'Inalterable',
      highlights: ['Compatibilidad S3 / MinIO', 'Custodia Legal a 5 Años', 'URLs Seguras con Expiración', 'Descarga Masiva de Comprobantes'],
    },
  ];

  return (
    <section id="modulos" className="py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs font-semibold text-brand-300">
            Arquitectura Modular Monolítica
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Un ERP diseñado para crecer al ritmo de tu empresa
          </h2>
          <p className="text-slate-300 text-base sm:text-lg">
            Activa solo los módulos que necesitas hoy. La arquitectura de Nuvora garantiza sincronización
            consistente entre facturación, contabilidad y almacenamiento.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {modules.map((m) => (
            <div
              key={m.title}
              className="rounded-2xl bg-slate-900/60 border border-slate-800 p-8 flex flex-col justify-between hover:border-brand-500/30 transition-colors"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-brand-400">
                    {m.category}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {m.badge}
                  </span>
                </div>
                <h3 className="text-xl font-bold font-display text-white">{m.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{m.description}</p>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-800/80">
                <div className="text-xs font-semibold text-slate-300 mb-3">Capacidades incluidas:</div>
                <ul className="space-y-2">
                  {m.highlights.map((h) => (
                    <li key={h} className="text-xs text-slate-400 flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-accent-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {h}
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
