import Link from 'next/link';

export function Hero() {
  return (
    <section className="relative pt-12 pb-24 lg:pt-20 lg:pb-32 overflow-hidden glow-gradient">
      {/* Background radial glow accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-brand-500/10 blur-[130px] -z-10 pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[250px] bg-accent-500/10 blur-[120px] -z-10 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Copy & Value Proposition */}
          <div className="lg:col-span-7 space-y-8 text-center lg:text-left">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-brand-500/30 text-xs font-semibold text-brand-300 shadow-inner">
              <span className="flex h-2 w-2 rounded-full bg-accent-400 animate-pulse" />
              <span>Validación Previa DIAN UBL 2.1 — Normatividad Colombia 2026</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
              Facturación Electrónica y{' '}
              <span className="bg-gradient-to-r from-brand-400 via-brand-300 to-accent-300 bg-clip-text text-transparent">
                ERP Modular
              </span>{' '}
              para Empresas en Colombia
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl font-normal leading-relaxed mx-auto lg:mx-0">
              Emite facturas electrónicas, notas crédito y notas débito con validación DIAN en menos de un segundo.
              Organiza clientes, productos y asientos contables automáticos en una arquitectura multitenant blindada.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link
                href="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 shadow-xl shadow-brand-500/25 transition-all hover:scale-[1.02] active:scale-[0.99]"
              >
                Comenzar Prueba Gratuita
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <a
                href="#dian"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-colors"
              >
                Explorar Cumplimiento DIAN
              </a>
            </div>

            {/* Trust Highlights */}
            <div className="pt-6 grid grid-cols-3 gap-4 border-t border-slate-800/80 max-w-lg mx-auto lg:mx-0">
              <div>
                <div className="font-display text-2xl font-bold text-white">&lt; 500ms</div>
                <div className="text-xs text-slate-400 font-medium">Emisión & Firma XAdES</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold text-accent-400">100%</div>
                <div className="text-xs text-slate-400 font-medium">Conforme DIAN UBL 2.1</div>
              </div>
              <div>
                <div className="font-display text-2xl font-bold text-brand-400">Row-Level</div>
                <div className="text-xs text-slate-400 font-medium">Aislamiento por Tenant</div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Invoice Preview Card */}
          <div className="lg:col-span-5 relative">
            {/* Outer Glow */}
            <div className="absolute -inset-1.5 bg-gradient-to-r from-brand-600 to-accent-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition duration-1000" />

            <div className="relative rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl p-6 sm:p-7 backdrop-blur-xl space-y-6">
              {/* Card Header with Status Badge */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
                      Factura Electrónica de Venta
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-500/10 text-accent-400 border border-accent-500/20 flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Aprobada DIAN
                    </span>
                  </div>
                  <div className="text-xl font-display font-bold text-white mt-1">SETP-99000142</div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-slate-400">Fecha Emisión</div>
                  <div className="text-xs font-semibold text-slate-200">21 Sep 2026, 15:45</div>
                </div>
              </div>

              {/* Emisor & Adquirente Info */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                <div>
                  <div className="text-[10px] font-semibold uppercase text-slate-500">Emisor (Tenant)</div>
                  <div className="font-semibold text-slate-200 truncate">Soluciones Andinas SAS</div>
                  <div className="text-slate-400">NIT: 900.829.412-1</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase text-slate-500">Adquirente (Cliente)</div>
                  <div className="font-semibold text-slate-200 truncate">Innovación Digital SAS</div>
                  <div className="text-slate-400">NIT: 901.442.109-3</div>
                </div>
              </div>

              {/* Invoice Lines Table */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-400 text-[11px] font-semibold border-b border-slate-800/60 pb-1.5">
                  <span>Descripción</span>
                  <span>Cant.</span>
                  <span>Total (COP)</span>
                </div>
                <div className="flex justify-between text-slate-200 py-1">
                  <div>
                    <div className="font-medium">Suscripción SaaS ERP — Plan Pyme</div>
                    <div className="text-[10px] text-slate-500">IVA 19% Incluido</div>
                  </div>
                  <div className="text-slate-400 font-mono">1</div>
                  <div className="font-mono font-medium">$250.000,00</div>
                </div>
                <div className="flex justify-between text-slate-200 py-1">
                  <div>
                    <div className="font-medium">Certificado Digital DIAN Firma XAdES</div>
                    <div className="text-[10px] text-slate-500">IVA 19% Incluido</div>
                  </div>
                  <div className="text-slate-400 font-mono">1</div>
                  <div className="font-mono font-medium">$85.000,00</div>
                </div>
              </div>

              {/* Totals & Tax Calculation Breakdown */}
              <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal Imponible:</span>
                  <span className="font-mono">$335.000,00</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>IVA Generado (19%):</span>
                  <span className="font-mono">$63.650,00</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Retención en la Fuente (-2.5%):</span>
                  <span className="font-mono text-emerald-400">-$8.375,00</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
                  <span>Total a Pagar:</span>
                  <span className="font-mono text-brand-300 font-extrabold text-base">$390.275,00 COP</span>
                </div>
              </div>

              {/* CUFE & Security Badge */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                <div className="space-y-0.5 overflow-hidden">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <svg className="w-3 h-3 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    CUFE Verificado
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 truncate">
                    d57ddb3a98f12c8a77912bc00194827aa...
                  </div>
                </div>

                {/* Simulated QR badge */}
                <div className="w-9 h-9 rounded-lg bg-white p-1 flex-shrink-0 flex items-center justify-center">
                  <div className="w-full h-full bg-slate-950 rounded-[2px] flex items-center justify-center text-[7px] font-bold font-mono text-white">
                    QR
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
