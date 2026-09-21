export function DianShowcase() {
  const features = [
    {
      title: 'Validación Previa UBL 2.1',
      description:
        'Estructuración de esquemas XML conformes con el anexo técnico vigente de la DIAN. Validación de sintaxis y reglas de negocio en milisegundos.',
      badge: 'Anexo 1.9 / 2026',
      icon: (
        <svg className="w-6 h-6 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
    },
    {
      title: 'Firma Digital XAdES-EPES',
      description:
        'Firma criptográfica con certificado digital emitido por entidad certificadora abierta autorizada por la ONAC, garantizando no repudio e integridad.',
      badge: 'Criptografía Segura',
      icon: (
        <svg className="w-6 h-6 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
    {
      title: 'Cálculo de CUFE y CUDE',
      description:
        'Generación determinística e irreversible del Código Único de Factura Electrónica bajo algoritmo SHA-384 con software-security-code.',
      badge: 'SHA-384 Exacto',
      icon: (
        <svg className="w-6 h-6 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      title: 'Representación Gráfica & QR',
      description:
        'Generación instantánea de PDF oficial con código QR DIAN de alta resolución para consulta directa en el catálogo fiscal nacional.',
      badge: 'PDF / Playwright',
      icon: (
        <svg className="w-6 h-6 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="7" y="7" width="3" height="3" />
          <rect x="14" y="7" width="3" height="3" />
          <rect x="7" y="14" width="3" height="3" />
        </svg>
      ),
    },
    {
      title: 'Notas Crédito y Débito',
      description:
        'Ajustes documentales enlazados directamente al documento padre emitido con causas DIAN tipificadas (descuentos, devoluciones, anulación).',
      badge: 'Trazabilidad Total',
      icon: (
        <svg className="w-6 h-6 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    },
    {
      title: 'Notificación por Correo Certificado',
      description:
        'Despacho automático de paquete legal (PDF + XML firmado) al adquirente con registro de entrega y trazabilidad en bitácora de auditoría.',
      badge: 'Entrega Automática',
      icon: (
        <svg className="w-6 h-6 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      ),
    },
  ];

  return (
    <section id="dian" className="py-24 bg-slate-900/50 border-y border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-500/10 border border-accent-500/20 text-xs font-semibold text-accent-300">
            Cumplimiento Fiscal Colombiano
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            El estándar más exigente de la DIAN, simplificado al máximo
          </h2>
          <p className="text-slate-300 text-base sm:text-lg">
            Nuvora abstrae toda la complejidad técnica y legal de los servicios web SOAP y REST de la DIAN,
            permitiéndote operar con total tranquilidad jurídica.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="glass-panel p-8 rounded-2xl hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <span className="text-[11px] font-semibold text-slate-400 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
                  {feature.badge}
                </span>
              </div>
              <h3 className="text-xl font-bold font-display text-white mb-2 group-hover:text-brand-300 transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
