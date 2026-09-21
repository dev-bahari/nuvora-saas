'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export function Hero() {
  const [copied, setCopied] = useState(false);
  const sampleCufe = 'fe8080dfc83b8b1a3d994326ad7c39050d24f0c436b772ad37e90f230';

  const handleCopy = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(sampleCufe);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 transition-colors duration-200">
      {/* Ambient background glows */}
      <div
        className="glow-hero-light dark:glow-hero-dark absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Commercial High-Converting Copy */}
          <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
            {/* Regulatory Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-leaf-50 dark:bg-leaf-950/60 border border-leaf-200 dark:border-leaf-800/80 text-xs font-bold text-leaf-800 dark:text-leaf-300 shadow-sm">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-leaf-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-leaf-500" />
              </span>
              <span>100% Conforme ante la DIAN Colombia</span>
              <span className="text-leaf-500">•</span>
              <span className="text-[11px] font-medium text-leaf-700 dark:text-leaf-400">Sin intermediarios</span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
              Facturación electrónica{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-leaf-600 to-sapphire-600 dark:from-leaf-400 dark:to-sapphire-400">
                fácil, rápida y sin estrés
              </span>
            </h1>

            {/* Business-focused description */}
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Emite facturas aprobadas por la DIAN en segundos, envía comprobantes automáticos por email
              a tus clientes y mantén el control de tus ventas y cuentas claras desde un solo lugar.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link
                href="/onboarding"
                className="w-full sm:w-auto px-7 py-4 rounded-xl text-base font-bold text-white bg-leaf-600 hover:bg-leaf-500 shadow-lg shadow-leaf-600/25 hover:shadow-leaf-600/40 hover:-translate-y-0.5 transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-600 focus-visible:ring-offset-2 flex items-center justify-center gap-2"
              >
                <span>Probar 14 Días Gratis</span>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>

              <a
                href="#modulos"
                className="w-full sm:w-auto px-6 py-4 rounded-xl text-base font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900/90 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/90 dark:border-slate-800 shadow-sm transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 flex items-center justify-center gap-2"
              >
                <span>Ver Cómo Funciona</span>
                <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </a>
            </div>

            {/* Trust and Conversion Badges */}
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-y-2 gap-x-6 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-leaf-100 dark:bg-leaf-950/80 flex items-center justify-center text-leaf-600 dark:text-leaf-400">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span>Sin tarjeta de crédito</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-leaf-100 dark:bg-leaf-950/80 flex items-center justify-center text-leaf-600 dark:text-leaf-400">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span>Listo en 3 minutos</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-leaf-100 dark:bg-leaf-950/80 flex items-center justify-center text-leaf-600 dark:text-leaf-400">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span>Soporte por WhatsApp</span>
              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Empyra Invoice Card */}
          <div className="lg:col-span-5 relative">
            <div className="card-hover-lift rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xl p-6 sm:p-7 relative overflow-hidden transition-all duration-300">
              {/* Card top bar */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-950 p-1.5 flex items-center justify-center shadow-md">
                    <Image
                      src="/icono-blanco.png"
                      alt="Empyra Icon"
                      width={28}
                      height={28}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="font-display font-extrabold text-sm text-slate-900 dark:text-white">
                      Empyra Cloud
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Factura Electrónica de Venta
                    </div>
                  </div>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-leaf-50 dark:bg-leaf-950/60 border border-leaf-200 dark:border-leaf-800 text-[11px] font-bold text-leaf-700 dark:text-leaf-300">
                  <span className="w-2 h-2 rounded-full bg-leaf-500 animate-pulse" />
                  Aprobada DIAN
                </div>
              </div>

              {/* Invoice Meta */}
              <div className="grid grid-cols-2 gap-3 text-xs mb-5 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    Número
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">SETP-990000042</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    Cliente / Adquirente
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white truncate mt-0.5">Almacenes Éxito S.A.</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    Fecha de Emisión
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 mt-0.5">Hoy, 04:15 PM</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    Estado Fiscal
                  </div>
                  <div className="text-leaf-700 dark:text-leaf-400 font-bold mt-0.5 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Aceptada en 0.8s
                  </div>
                </div>
              </div>

              {/* Item Lines */}
              <div className="space-y-2.5 mb-5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                  <div className="truncate pr-4">
                    <div className="font-semibold text-slate-900 dark:text-white">Servicios de Consultoría y Software</div>
                    <div className="text-[11px] text-slate-500">Cant: 1 • Tarifa IVA 19%</div>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white whitespace-nowrap">$1.500.000 COP</div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                  <div className="truncate pr-4">
                    <div className="font-semibold text-slate-900 dark:text-white">Licenciamiento Anual Cloud</div>
                    <div className="text-[11px] text-slate-500">Cant: 1 • Exento IVA</div>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white whitespace-nowrap">$850.000 COP</div>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-leaf-50/60 dark:bg-slate-950/80 p-4 rounded-xl border border-leaf-100 dark:border-slate-800 mb-5">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>Subtotal</span>
                  <span>$2.350.000 COP</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>IVA (19%)</span>
                  <span>$285.000 COP</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white pt-2 border-t border-leaf-200/60 dark:border-slate-800">
                  <span>Total Facturado</span>
                  <span className="text-leaf-700 dark:text-leaf-400 text-base font-display">$2.635.000 COP</span>
                </div>
              </div>

              {/* CUFE & Quick Copy Box */}
              <div className="bg-slate-50 dark:bg-slate-950/80 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    Código Único CUFE
                  </div>
                  <div className="text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate">
                    {sampleCufe}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
                    copied
                      ? 'bg-leaf-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  aria-label="Copiar código CUFE"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
