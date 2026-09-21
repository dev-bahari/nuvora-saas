import type { Metadata } from 'next';
import { Outfit, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Empyra — Facturación Electrónica y Gestión Empresarial Inteligente',
  description:
    'Factura en segundos, automatiza tus cobros y mantén tu empresa 100% al día con la DIAN sin enredos. La plataforma moderna para empresas que quieren crecer.',
  icons: {
    icon: '/icono-blanco.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${outfit.variable} ${plusJakarta.variable}`}>
      <body className="antialiased min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-leaf-500 selection:text-white transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}
