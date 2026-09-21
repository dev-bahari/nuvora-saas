export function DianShowcase() {
  const features = [
    {
      title: 'Validación Previa UBL 2.1',
      description:
        'Esquemas XML estandarizados bajo el Anexo Técnico 1.9 de la DIAN. Validación previa de reglas contables y sintácticas en milisegundos antes del envío.',
      badge: 'Anexo 1.9 / 2026',
      colorClass: 'text-leaf-600 dark:text-leaf-400 bg-leaf-50 dark:bg-leaf-950/60 border-leaf-200 dark:border-leaf-800',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      ),
    },
    {
      title: 'Firma Digital XAdES-EPES',
      description:
        'Firma criptográfica automática con certificado digital avalado por la ONAC. Integridad garantizada y no repudio jurídico sin intervención manual.',
      badge: 'Criptografía Segura',
      colorClass: 'text-sapphire-600 dark:text-sapphire-400 bg-sapphire-50 dark:bg-sapphire-950/60 border-sapphire-200 dark:border-sapphire-800',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
    {
      title: 'Cálculo Exacto de CUFE y CUDE',
      description:
        'Generación determinística bajo algoritmo SHA-384 combinando clave técnica, numeración y valores fiscales sin margen de discrepancia aritmética.',
      badge: 'SHA-384 Inmutable',
      colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      title: 'Representación Gráfica & QR Oficial',
      description:
        'Motor de renderizado PDF de alta resolución con código QR bidimensional reglamentario para verificación directa en el portal transaccional de la DIAN.',
      badge: 'PDF / Playwright',
      colorClass: 'text-leaf-600 dark:text-leaf-400 bg-leaf-50 dark:bg-leaf-950/60 border-leaf-200 dark:border-leaf-800',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        'Ajustes y anulaciones con causas DIAN tipificadas (descuentos globales, devoluciones, anulación de factura) vinculadas permanentemente al documento original.',
      badge: 'Trazabilidad Fiscal',
      colorClass: 'text-sapphire-600 dark:text-sapphire-400 bg-sapphire-50 dark:bg-sapphire-950/60 border-sapphire-200 dark:border-sapphire-800',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    },
    {
      title: 'Notificación y Entrega Certificada',
      description:
        'Despacho automático del paquete legal (ApplicationResponse XML + PDF firmado) por correo electrónico al adquirente con seguimiento de acuse de recibo.',
      badge: 'Entrega Inmediata',
      colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      ),
    },
  ];

  return (
    <section id="dian" className="py-24 bg-slate-50 dark:bg-slate-900/40 border-y border-slate-200 dark:border-slate-800/80 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-leaf-100 dark:bg-leaf-950/70 border border-leaf-300 dark:border-leaf-500/30 text-xs font-bold text-leaf-800 dark:text-leaf-300">
            Cumplimiento DIAN Garantizado
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            La normativa fiscal colombiana, resuelta con precisión matemática
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg">
            Nuvora asume toda la complejidad de comunicación SOAP, algoritmos de firma y validación previa con los
            servidores de la DIAN para que tu operación nunca se detenga.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 shadow-sm hover:shadow-xl dark:hover:shadow-2xl hover:border-leaf-300 dark:hover:border-leaf-500/40 card-hover-lift group"
            >
              <div className="flex items-center justify-between mb-6">
                <div
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center group-hover:scale-110 transition-transform duration-200 ${feature.colorClass}`}
                >
                  {feature.icon}
                </div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {feature.badge}
                </span>
              </div>
              <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white mb-2 group-hover:text-leaf-600 dark:group-hover:text-leaf-400 transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
