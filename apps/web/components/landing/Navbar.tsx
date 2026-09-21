'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-slate-950 dark:bg-slate-900 border border-slate-800 dark:border-slate-700 flex items-center justify-center p-1.5 shadow-md group-hover:scale-105 transition-all">
            <Image
              src="/icono-blanco.png"
              alt="Logo Empyra"
              width={32}
              height={32}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-extrabold text-xl tracking-tight text-slate-900 dark:text-white leading-none">
              Empyra
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-leaf-700 dark:text-leaf-400 mt-0.5">
              Facturación Inteligente
            </span>
          </div>
        </Link>

        {/* Navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <a
            href="#beneficios"
            className="hover:text-leaf-700 dark:hover:text-leaf-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 rounded-md px-1"
          >
            Beneficios
          </a>
          <a
            href="#modulos"
            className="hover:text-leaf-700 dark:hover:text-leaf-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 rounded-md px-1"
          >
            Módulos
          </a>
          <a
            href="#precios"
            className="hover:text-leaf-700 dark:hover:text-leaf-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 rounded-md px-1"
          >
            Planes
          </a>
          <a
            href="#faq"
            className="hover:text-leaf-700 dark:hover:text-leaf-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 rounded-md px-1"
          >
            Preguntas
          </a>
        </nav>

        {/* Actions: Theme Toggle + Auth CTAs */}
        <div className="flex items-center gap-3 sm:gap-4">
          <ThemeToggle />

          <Link
            href="/login"
            className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors px-2 py-1.5"
          >
            Ingresar
          </Link>

          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-leaf-600 hover:bg-leaf-500 shadow-md shadow-leaf-600/20 hover:shadow-lg hover:shadow-leaf-600/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-600 focus-visible:ring-offset-2"
          >
            <span>Crear Cuenta</span>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
