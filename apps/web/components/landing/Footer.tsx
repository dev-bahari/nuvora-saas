import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-900 py-16 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-900">
          {/* Brand info */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold">
                N
              </div>
              <span className="font-display font-bold text-lg text-white">Nuvora</span>
            </Link>
            <p className="text-slate-400 text-xs leading-relaxed">
              Plataforma SaaS de Facturación Electrónica y ERP Modular adaptada a la normatividad tributaria colombiana.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-accent-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-accent-400" />
              Sistemas Operativos 100% Conformes DIAN
            </div>
          </div>

          {/* Links: Producto */}
          <div>
            <div className="font-semibold text-white uppercase tracking-wider text-[11px] mb-4">Producto</div>
            <ul className="space-y-2.5">
              <li>
                <a href="#dian" className="hover:text-white transition-colors">
                  Validación Previa DIAN
                </a>
              </li>
              <li>
                <a href="#modulos" className="hover:text-white transition-colors">
                  Módulo de Facturación
                </a>
              </li>
              <li>
                <a href="#modulos" className="hover:text-white transition-colors">
                  Notas Crédito y Débito
                </a>
              </li>
              <li>
                <a href="#modulos" className="hover:text-white transition-colors">
                  Contabilidad Automática
                </a>
              </li>
              <li>
                <a href="#precios" className="hover:text-white transition-colors">
                  Planes y Tarifas
                </a>
              </li>
            </ul>
          </div>

          {/* Links: Cumplimiento y Seguridad */}
          <div>
            <div className="font-semibold text-white uppercase tracking-wider text-[11px] mb-4">Seguridad & DIAN</div>
            <ul className="space-y-2.5">
              <li>
                <span className="text-slate-300">Anexo Técnico UBL 2.1</span>
              </li>
              <li>
                <span className="text-slate-300">Firma Criptográfica XAdES-EPES</span>
              </li>
              <li>
                <span className="text-slate-300">PostgreSQL Row-Level Security</span>
              </li>
              <li>
                <span className="text-slate-300">Custodia S3 de XMLs y PDFs</span>
              </li>
              <li>
                <span className="text-slate-300">Trazabilidad Inmutable Append-Only</span>
              </li>
            </ul>
          </div>

          {/* Contacto & Legal */}
          <div>
            <div className="font-semibold text-white uppercase tracking-wider text-[11px] mb-4">Compañía</div>
            <ul className="space-y-2.5">
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Acceso a Clientes
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-white transition-colors">
                  Crear Cuenta Nueva
                </Link>
              </li>
              <li>
                <span className="text-slate-400">Bogotá D.C. — Colombia</span>
              </li>
              <li>
                <span className="text-slate-400">Soporte: contacto@nuvora.co</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            © {new Date().getFullYear()} Nuvora SAS. Todos los derechos reservados. Colombia.
          </div>
          <div className="flex items-center gap-6">
            <span>Resolución DIAN 000165 de 2023 / Anexo 1.9</span>
            <span>Aislamiento Multitenant Certificado</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
