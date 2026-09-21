import Link from 'next/link';

export function PricingSection() {
  const plans = [
    {
      name: 'Emprendedor',
      badge: 'Ideal para Independientes',
      price: '$49.000',
      period: 'COP / mes',
      description: 'Todo lo necesario para emitir facturación electrónica conforme a la DIAN sin complicaciones.',
      isPopular: false,
      features: [
        'Hasta 50 facturas electrónicas / mes',
        'Notas crédito y notas débito ilimitadas',
        '1 usuario administrador',
        'Envío automático de XML y PDF por email',
        'Directorio de hasta 100 clientes',
        'Soporte técnico por correo',
      ],
      ctaText: 'Comenzar Plan Emprendedor',
      ctaHref: '/register?plan=starter',
    },
    {
      name: 'Pyme Pro',
      badge: 'El Más Elegido por Pymes',
      price: '$129.000',
      period: 'COP / mes',
      description: 'Facturación ilimitada con contabilidad básica automática y múltiples usuarios para tu equipo.',
      isPopular: true,
      features: [
        'Facturación electrónica ILIMITADA',
        'Notas crédito y débito ilimitadas',
        'Hasta 5 usuarios con permisos por rol',
        'Asientos contables automáticos (Partida Doble)',
        'Catálogo ilimitado de clientes y productos',
        'Certificado digital propio incluido',
        'Reportes fiscales y exportación exógena',
        'Soporte prioritario WhatsApp y chat',
      ],
      ctaText: 'Iniciar 14 Días Gratis',
      ctaHref: '/register?plan=pro',
    },
    {
      name: 'Corporativo',
      badge: 'Multi-empresa & API',
      price: '$299.000',
      period: 'COP / mes',
      description: 'Para empresas consolidadas que requieren integración API con sus propios sistemas y auditoría avanzada.',
      isPopular: false,
      features: [
        'Facturación y documentos ILIMITADOS',
        'Multi-empresa (hasta 3 razones sociales/NITs)',
        'Usuarios ilimitados con roles personalizados',
        'API REST y Webhooks para sincronización ERP',
        'Almacenamiento S3 dedicado con retención 10 años',
        'Bitácora inmutable de auditoría forense',
        'Gerente de cuenta dedicado y SLA 99.9%',
      ],
      ctaText: 'Hablar con Especialista',
      ctaHref: '/register?plan=enterprise',
    },
  ];

  return (
    <section id="precios" className="py-24 bg-slate-900/40 border-t border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-500/10 border border-accent-500/20 text-xs font-semibold text-accent-300">
            Planes Transparentes en Pesos Colombianos
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Precios justos, sin costos ocultos ni permanencia
          </h2>
          <p className="text-slate-300 text-base sm:text-lg">
            Todos los planes incluyen validación directa con la DIAN, generación de CUFE y almacenamiento legal seguro.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl p-8 flex flex-col justify-between transition-all duration-300 relative ${
                p.isPopular
                  ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950/40 border-2 border-brand-500/60 shadow-2xl shadow-brand-500/15 lg:-translate-y-2'
                  : 'bg-slate-900/60 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {p.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 text-[11px] font-bold uppercase tracking-wider text-white shadow-md">
                  Más Popular
                </div>
              )}

              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-display text-2xl font-bold text-white">{p.name}</h3>
                    <div className="text-xs text-brand-300 font-medium mt-0.5">{p.badge}</div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mb-6 leading-relaxed">{p.description}</p>

                <div className="mb-6 pb-6 border-b border-slate-800">
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-4xl font-extrabold text-white">{p.price}</span>
                    <span className="text-xs text-slate-400 font-medium">{p.period}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">Facturación mensual o anual con 20% OFF</div>
                </div>

                <div className="space-y-3 mb-8">
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    ¿Qué incluye este plan?
                  </div>
                  <ul className="space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="text-xs text-slate-300 flex items-start gap-2.5">
                        <svg
                          className="w-4 h-4 text-accent-400 flex-shrink-0 mt-0.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <Link
                  href={p.ctaHref}
                  className={`w-full block text-center py-3.5 px-6 rounded-xl font-semibold text-sm transition-all ${
                    p.isPopular
                      ? 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white shadow-lg shadow-brand-500/30 hover:scale-[1.02]'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                  }`}
                >
                  {p.ctaText}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
