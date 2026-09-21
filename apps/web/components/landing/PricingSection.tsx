'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = [
    {
      name: 'Emprendedor',
      badge: 'Ideal para Independientes',
      monthlyPrice: '$49.000',
      annualPrice: '$39.200',
      period: 'COP / mes',
      billingNote: isAnnual ? 'Facturado anualmente ($470.400 COP/año)' : 'Facturación mensual sin ataduras',
      description: 'Todo lo necesario para emitir facturación electrónica conforme a la DIAN de forma rápida y sencilla.',
      isPopular: false,
      features: [
        'Hasta 50 facturas electrónicas al mes',
        'Notas crédito y notas débito ilimitadas',
        '1 usuario administrador',
        'Envío automático de factura en PDF por email',
        'Directorio de hasta 100 clientes con NIT verificado',
        'Soporte por correo y WhatsApp',
      ],
      ctaText: 'Comenzar Emprendedor',
      ctaHref: '/onboarding?plan=starter',
    },
    {
      name: 'Pyme Pro',
      badge: 'El Más Elegido por Empresas',
      monthlyPrice: '$129.000',
      annualPrice: '$103.200',
      period: 'COP / mes',
      billingNote: isAnnual ? 'Facturado anualmente ($1.238.400 COP/año)' : 'Facturación mensual sin ataduras',
      description: 'Facturación ilimitada con reportes de ventas automáticos y múltiples accesos para potenciar a tu equipo.',
      isPopular: true,
      features: [
        'Facturación electrónica ILIMITADA',
        'Notas crédito y débito ilimitadas',
        'Hasta 5 usuarios con permisos por función',
        'Reportes de ventas e impuestos listos para tu contador',
        'Catálogo ilimitado de clientes y productos',
        'Certificado digital para firma incluido sin costo extra',
        'Descarga masiva de comprobantes en Excel',
        'Soporte prioritario por WhatsApp y videollamada',
      ],
      ctaText: 'Iniciar 14 Días Gratis',
      ctaHref: '/onboarding?plan=pro',
    },
    {
      name: 'Corporativo',
      badge: 'Multi-empresa & Crecimiento',
      monthlyPrice: '$299.000',
      annualPrice: '$239.200',
      period: 'COP / mes',
      billingNote: isAnnual ? 'Facturado anualmente ($2.870.400 COP/año)' : 'Facturación mensual sin ataduras',
      description: 'Para empresas consolidadas que manejan varias razones sociales y requieren integración con otros sistemas.',
      isPopular: false,
      features: [
        'Facturación y documentos ILIMITADOS',
        'Hasta 3 razones sociales o empresas (NITs)',
        'Usuarios ilimitados con roles personalizados',
        'Conexión API con tus sistemas actuales',
        'Custodia de facturas extendida a 10 años',
        'Asesor tributario y técnico exclusivo',
        'Capacitación personalizada para todo tu equipo',
      ],
      ctaText: 'Hablar con un Asesor',
      ctaHref: '/onboarding?plan=enterprise',
    },
  ];

  return (
    <section id="precios" className="py-24 relative overflow-hidden bg-white dark:bg-slate-900/60 transition-colors duration-200 border-t border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-leaf-50 dark:bg-leaf-950/60 border border-leaf-200 dark:border-leaf-800/80 text-xs font-bold text-leaf-800 dark:text-leaf-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-leaf-500" />
            Precios Claros en Pesos Colombianos
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Planes justos, sin letras pequeñas ni permanencia
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed">
            Todos los planes incluyen validación directa con la DIAN, generación de código QR y custodia de tus documentos sin cobros sorpresa.
          </p>

          {/* Billing Switcher */}
          <div className="pt-4 flex items-center justify-center gap-4">
            <span className={`text-sm font-bold transition-colors ${!isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
              Mensual
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isAnnual}
              aria-label="Alternar facturación mensual y anual"
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-leaf-500 bg-slate-200 dark:bg-slate-700 cursor-pointer"
            >
              <div
                className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 flex items-center justify-center ${
                  isAnnual ? 'translate-x-6 bg-leaf-500 text-white' : 'translate-x-0'
                }`}
              >
                {isAnnual && (
                  <svg className="w-3.5 h-3.5 text-leaf-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </button>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold transition-colors ${isAnnual ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                Anual
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-leaf-100 text-leaf-800 dark:bg-leaf-950 dark:text-leaf-300 border border-leaf-200 dark:border-leaf-800 animate-pulse">
                Ahorra 20%
              </span>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch pt-4">
          {plans.map((p) => {
            const price = isAnnual ? p.annualPrice : p.monthlyPrice;

            return (
              <div
                key={p.name}
                className={`card-hover-lift rounded-2xl p-8 flex flex-col justify-between transition-all duration-300 relative ${
                  p.isPopular
                    ? 'bg-gradient-to-b from-white via-white to-leaf-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/90 border-2 border-leaf-500 dark:border-leaf-500/80 shadow-xl shadow-leaf-500/10 lg:-translate-y-2'
                    : 'bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800/90 shadow-sm hover:shadow-lg'
                }`}
              >
                {p.isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-leaf-600 to-sapphire-600 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-md flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    Más Popular
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{p.name}</h3>
                      <div className="text-xs text-leaf-700 dark:text-leaf-400 font-semibold mt-1">{p.badge}</div>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">{p.description}</p>

                  <div className="mb-6 pb-6 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {price}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{p.period}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                      {p.billingNote}
                    </div>
                  </div>

                  <div className="space-y-3 mb-8">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
                      ¿Qué incluye este plan?
                    </div>
                    <ul className="space-y-2.5">
                      {p.features.map((f) => (
                        <li key={f} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5 leading-relaxed">
                          <div className="w-4 h-4 rounded-full bg-leaf-100 dark:bg-leaf-950/80 flex items-center justify-center flex-shrink-0 mt-0.5 text-leaf-600 dark:text-leaf-400">
                            <svg
                              className="w-2.5 h-2.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <Link
                    href={p.ctaHref}
                    className={`w-full block text-center py-3.5 px-6 rounded-xl font-bold text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                      p.isPopular
                        ? 'bg-leaf-600 hover:bg-leaf-500 text-white shadow-lg shadow-leaf-600/25 hover:shadow-leaf-600/40 focus-visible:ring-leaf-600'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 focus-visible:ring-slate-400'
                    }`}
                  >
                    {p.ctaText}
                  </Link>
                  <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-2">
                    Cancela en cualquier momento con un clic.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
