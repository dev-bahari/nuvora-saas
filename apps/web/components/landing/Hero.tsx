'use client';

import { useState } from 'react';
import Link from 'next/link';

export function Hero() {
  const [copied, setCopied] = useState<boolean>(false);
  const sampleCufe = 'd57ddb3a98f12c8a77912bc00194827aa61bf84210e69b';

  const copyCufe = () => {
    navigator.clipboard?.writeText(sampleCufe);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-28 overflow-hidden glow-hero-light dark:glow-hero-dark transition-colors duration-300">
      {/* Decorative ambient blurred color spots */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[300px] bg-leaf-500/10 dark:bg-leaf-500/15 blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[250px] bg-sapphire-500/10 dark:bg-sapphire-500/15 blur-[100px] -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left Column: Value Proposition & High-Conversion CTAs */}
          <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
            {/* Regulatory Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-leaf-50 dark:bg-leaf-950/60 border border-leaf-200 dark:border-leaf-500/30 text-xs font-bold text-leaf-800 dark:text-leaf-300 shadow-sm animate-fade-in">
              <span className="flex h-2 w-2 rounded-full bg-leaf-500 animate-ping" />
              <span>DIAN Colombia UBL 2.1 — Anexo Técnico Vigente 2026</span>
            </div>

            {/* Main Headline with High Visual Balance */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
              Facturación Electrónica y{' '}
              <span className="bg-gradient-to-r from-leaf-600 via-emerald-500 to-sapphire-600 dark:from-leaf-400 dark:via-emerald-300 dark:to-sapphire-400 bg-clip-text text-transparent">
                ERP Modular
              </span>{' '}
              para Empresas en Colombia
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl font-normal leading-relaxed mx-auto lg:mx-0">
              Genera facturas electrónicas, notas crédito y notas débito con validación previa de la DIAN en menos de
              medio segundo. Controla clientes, inventario y asientos contables automáticos con la máxima seguridad
              multitenant.
            </p>

            {/* High-Conversion CTA Group */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link
                  href="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl font-bold text-white bg-gradient-to-r from-leaf-600 via-emerald-600 to-sapphire-600 hover:from-leaf-500 hover:to-sapphire-500 shadow-xl shadow-leaf-600/25 dark:shadow-leaf-500/20 hover:shadow-leaf-600/40 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 text-base"
                >
                  <span>Comenzar Prueba Gratuita</span>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>

                <a
                  href="#dian"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-200 text-base"
                >
                  <span>Explorar Módulos</span>
                </a>
              </div>

              {/* Conversion micro-guarantees */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400 font-medium pt-1">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-leaf-600 dark:text-leaf-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  14 días de prueba sin tarjeta
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-leaf-600 dark:text-leaf-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Certificado digital DIAN incluido
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-leaf-600 dark:text-leaf-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Cancelación en cualquier momento
                </span>
              </div>
            </div>

            {/* Trust Metrics Grid */}
            <div className="pt-6 grid grid-cols-3 gap-6 border-t border-slate-200 dark:border-slate-800/80 max-w-lg mx-auto lg:mx-0">
              <div>
                <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">&lt; 400ms</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Emisión & Firma XAdES</div>
              </div>
              <div>
                <div className="font-display text-2xl font-extrabold text-leaf-600 dark:text-leaf-400">100%</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Conforme DIAN UBL 2.1</div>
              </div>
              <div>
                <div className="font-display text-2xl font-extrabold text-sapphire-600 dark:text-sapphire-400">PostgreSQL</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Aislamiento RLS Estricto</div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Adaptive Invoice Card */}
          <div className="lg:col-span-5 relative">
            {/* Ambient Backlight Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-leaf-500 to-sapphire-500 rounded-3xl blur-xl opacity-20 dark:opacity-30 pointer-events-none" />

            {/* Floating Trust Badge 1 */}
            <div className="hidden sm:flex absolute -top-4 -left-4 z-20 items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg text-xs font-bold text-slate-800 dark:text-slate-200 animate-float">
              <span className="w-2.5 h-2.5 rounded-full bg-leaf-500 animate-pulse" />
              <span>Firma Digital XAdES-EPES</span>
            </div>

            {/* Invoice Container */}
            <div className="relative rounded-2xl bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl p-6 sm:p-7 backdrop-blur-xl space-y-6 card-hover-lift">
              {/* Header: Document Type and DIAN Status */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-leaf-700 dark:text-leaf-400 uppercase tracking-wider">
                      Factura Electrónica de Venta
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-leaf-50 dark:bg-leaf-500/10 text-leaf-700 dark:text-leaf-400 border border-leaf-200 dark:border-leaf-500/20 flex items-center gap-1 shadow-sm">
                      <svg className="w-3 h-3 text-leaf-600 dark:text-leaf-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Aprobada DIAN
                    </span>
                  </div>
                  <div className="text-2xl font-display font-extrabold text-slate-900 dark:text-white mt-1">
                    SETP-99000142
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-slate-400">Fecha de Emisión</div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    21 Sep 2026, 16:20
                  </div>
                </div>
              </div>

              {/* Emisor & Adquirente Info Block */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-950/70 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Emisor (Empresa)</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">Soluciones Andinas SAS</div>
                  <div className="text-slate-500 font-mono text-[11px]">NIT: 900.829.412-1</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase text-slate-400">Adquirente (Cliente)</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">Innovación Digital SAS</div>
                  <div className="text-slate-500 font-mono text-[11px]">NIT: 901.442.109-3</div>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-400 text-[11px] font-bold border-b border-slate-100 dark:border-slate-800 pb-1.5 uppercase">
                  <span>Descripción del Ítem</span>
                  <span>Cant.</span>
                  <span>Total (COP)</span>
                </div>
                <div className="flex justify-between items-center text-slate-800 dark:text-slate-200 py-1">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Suscripción SaaS ERP — Plan Pyme</div>
                    <div className="text-[10px] text-leaf-600 dark:text-leaf-400 font-medium">Tarifa General IVA 19%</div>
                  </div>
                  <div className="text-slate-500 font-mono">1</div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-white">$250.000,00</div>
                </div>
                <div className="flex justify-between items-center text-slate-800 dark:text-slate-200 py-1">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Certificado Digital DIAN Firma XAdES</div>
                    <div className="text-[10px] text-leaf-600 dark:text-leaf-400 font-medium">Tarifa General IVA 19%</div>
                  </div>
                  <div className="text-slate-500 font-mono">1</div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-white">$85.000,00</div>
                </div>
              </div>

              {/* Tax Calculations */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Subtotal Bruto:</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">$335.000,00</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>IVA Generado (19%):</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">$63.650,00</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Retención en la Fuente (-2.5%):</span>
                  <span className="font-mono font-semibold text-leaf-600 dark:text-leaf-400">-$8.375,00</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white pt-2.5 border-t border-slate-200 dark:border-slate-800">
                  <span>Total a Pagar:</span>
                  <span className="font-mono text-leaf-600 dark:text-leaf-400 text-lg">$390.275,00 COP</span>
                </div>
              </div>

              {/* Interactive CUFE and QR footer */}
              <div className="bg-slate-50 dark:bg-slate-950/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <svg className="w-3 h-3 text-leaf-600 dark:text-leaf-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      CUFE Verificado (SHA-384)
                    </span>
                    <button
                      type="button"
                      onClick={copyCufe}
                      className="text-[10px] text-sapphire-600 dark:text-sapphire-400 hover:underline font-semibold"
                    >
                      {copied ? '¡Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 truncate">{sampleCufe}...</div>
                </div>

                {/* QR Visual */}
                <div className="w-10 h-10 rounded-lg bg-white p-1 border border-slate-200 shadow-sm flex-shrink-0 flex items-center justify-center">
                  <div className="w-full h-full bg-slate-950 rounded-[3px] flex items-center justify-center text-[8px] font-bold font-mono text-white">
                    DIAN
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
