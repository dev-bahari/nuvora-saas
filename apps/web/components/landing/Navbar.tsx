import Link from 'next/link';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 glass-nav transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-accent-400 p-[1px] shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
              <svg
                className="w-5 h-5 text-brand-400 group-hover:text-brand-300 transition-colors"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-display font-extrabold text-xl tracking-tight text-white flex items-center gap-1.5">
              Nuvora
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20">
                SaaS
              </span>
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Facturación & ERP Colombia</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#dian" className="hover:text-white transition-colors">
            Cumplimiento DIAN
          </a>
          <a href="#modulos" className="hover:text-white transition-colors">
            Módulos ERP
          </a>
          <a href="#seguridad" className="hover:text-white transition-colors">
            Seguridad RLS
          </a>
          <a href="#precios" className="hover:text-white transition-colors">
            Planes
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-lg transition-colors hover:bg-slate-900"
          >
            Iniciar Sesión
          </Link>
          <Link
            href="/register"
            className="text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 px-5 py-2.5 rounded-xl shadow-lg shadow-brand-500/25 transition-all hover:shadow-brand-500/40 hover:-translate-y-0.5 active:translate-y-0"
          >
            Comenzar Gratis
          </Link>
        </div>
      </div>
    </header>
  );
}
