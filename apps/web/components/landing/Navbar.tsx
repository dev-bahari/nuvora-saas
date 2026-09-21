import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 transition-all duration-300 glass-nav-light dark:glass-nav-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 rounded-xl">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sapphire-600 via-leaf-500 to-emerald-400 p-[1.5px] shadow-md shadow-leaf-500/20 group-hover:scale-105 transition-transform duration-200">
            <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[10px] flex items-center justify-center transition-colors">
              <svg
                className="w-5 h-5 text-leaf-600 dark:text-leaf-400 group-hover:text-leaf-500 transition-colors"
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
            <span className="font-display font-extrabold text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              Nuvora
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-leaf-50 dark:bg-leaf-500/10 text-leaf-700 dark:text-leaf-300 border border-leaf-200 dark:border-leaf-500/20">
                SaaS
              </span>
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Facturación & ERP Colombia
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <a href="#dian" className="hover:text-leaf-600 dark:hover:text-white transition-colors">
            Cumplimiento DIAN
          </a>
          <a href="#modulos" className="hover:text-leaf-600 dark:hover:text-white transition-colors">
            Módulos ERP
          </a>
          <a href="#seguridad" className="hover:text-leaf-600 dark:hover:text-white transition-colors">
            Seguridad RLS
          </a>
          <a href="#precios" className="hover:text-leaf-600 dark:hover:text-white transition-colors">
            Planes & Precios
          </a>
          <a href="#faq" className="hover:text-leaf-600 dark:hover:text-white transition-colors">
            Preguntas
          </a>
        </nav>

        {/* Right actions: Theme toggle + Auth buttons */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          <Link
            href="/login"
            className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white px-3.5 py-2 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Iniciar Sesión
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 text-sm font-bold text-white bg-gradient-to-r from-leaf-600 via-emerald-600 to-sapphire-600 hover:from-leaf-500 hover:to-sapphire-500 px-5 py-2.5 rounded-xl shadow-md shadow-leaf-600/20 hover:shadow-lg hover:shadow-leaf-600/30 transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>Comenzar Gratis</span>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
