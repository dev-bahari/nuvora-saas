import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/80 py-16 text-slate-600 dark:text-slate-400 text-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-200 dark:border-slate-800/80">
          {/* Brand info */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 p-1.5 flex items-center justify-center shadow-md group-hover:scale-105 transition-all">
                <Image
                  src="/icono-blanco.png"
                  alt="Empyra Logo"
                  width={28}
                  height={28}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-display font-extrabold text-lg text-slate-900 dark:text-white tracking-tight leading-none">
                  Empyra
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-leaf-700 dark:text-leaf-400 mt-0.5">
                  Facturación Inteligente
                </span>
              </div>
            </Link>
            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
              La plataforma moderna de facturación electrónica y gestión para empresas colombianas que quieren crecer sin enredos.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-leaf-700 dark:text-leaf-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-leaf-500 animate-pulse" />
              100% Conforme ante la DIAN
            </div>
          </div>

          {/* Links: Producto */}
          <div>
            <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-4">
              Soluciones
            </div>
            <ul className="space-y-2.5">
              <li>
                <a href="#beneficios" className="hover:text-leaf-700 dark:hover:text-leaf-400 transition-colors">
                  Facturación en 1 Clic
                </a>
              </li>
              <li>
                <a href="#modulos" className="hover:text-leaf-700 dark:hover:text-leaf-400 transition-colors">
                  Directorio de Clientes
                </a>
              </li>
              <li>
                <a href="#modulos" className="hover:text-leaf-700 dark:hover:text-leaf-400 transition-colors">
                  Catálogo de Productos y Precios
                </a>
              </li>
              <li>
                <a href="#modulos" className="hover:text-leaf-700 dark:hover:text-leaf-400 transition-colors">
                  Reportes para tu Contador
                </a>
              </li>
              <li>
                <a href="#precios" className="hover:text-leaf-700 dark:hover:text-leaf-400 transition-colors">
                  Planes y Precios
                </a>
              </li>
            </ul>
          </div>

          {/* Links: Cumplimiento y Confianza */}
          <div>
            <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-4">
              Confianza & Seguridad
            </div>
            <ul className="space-y-2.5">
              <li>
                <span className="text-slate-700 dark:text-slate-300 font-medium">Validación DIAN en Tiempo Real</span>
              </li>
              <li>
                <span className="text-slate-700 dark:text-slate-300 font-medium">Código QR y CUFE Oficial</span>
              </li>
              <li>
                <span className="text-slate-700 dark:text-slate-300 font-medium">Custodia Legal por 5 Años</span>
              </li>
              <li>
                <span className="text-slate-700 dark:text-slate-300 font-medium">Copias de Seguridad Diarias</span>
              </li>
              <li>
                <span className="text-slate-700 dark:text-slate-300 font-medium">Datos 100% Privados y Seguros</span>
              </li>
            </ul>
          </div>

          {/* Contacto & Ayuda */}
          <div>
            <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-4">
              Atención al Cliente
            </div>
            <ul className="space-y-2.5">
              <li>
                <Link href="/login" className="hover:text-leaf-700 dark:hover:text-leaf-400 transition-colors">
                  Ingreso a tu Cuenta
                </Link>
              </li>
              <li>
                <Link href="/onboarding" className="hover:text-leaf-700 dark:hover:text-leaf-400 transition-colors">
                  Crear Cuenta Gratis
                </Link>
              </li>
              <li>
                <a href="#faq" className="hover:text-leaf-700 dark:hover:text-leaf-400 transition-colors">
                  Preguntas Frecuentes
                </a>
              </li>
              <li>
                <span className="text-slate-500 dark:text-slate-400">Bogotá D.C. — Colombia</span>
              </li>
              <li>
                <span className="text-slate-700 dark:text-slate-300 font-semibold">Soporte: contacto@empyra.co</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500 dark:text-slate-400">
          <div>
            © {new Date().getFullYear()} Empyra SAS. Todos los derechos reservados. Diseñado para empresas colombianas.
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-medium">
            <span>Resolución DIAN 000165 de 2023</span>
            <span>•</span>
            <span>Seguridad y Privacidad Garantizada</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
