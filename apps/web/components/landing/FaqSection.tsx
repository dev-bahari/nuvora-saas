'use client';

import React, { useState } from 'react';

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: '¿Es difícil empezar a facturar con Empyra?',
      answer:
        'Para nada. Creas tu cuenta en 3 minutos, ingresas los datos básicos de tu empresa o RUT y listo: ya puedes emitir tu primera factura electrónica. Además, si tienes dudas, nuestro equipo de soporte te asiste directamente por WhatsApp.',
    },
    {
      question: '¿Necesito comprar certificados digitales o pagar trámites adicionales?',
      answer:
        'No. En Empyra todo está incluido. La firma electrónica avalada por la DIAN viene incluida en los planes Pyme Pro y Corporativo sin costos ocultos ni trámites engorrosos.',
    },
    {
      question: '¿Mis facturas quedan 100% legales y aprobadas ante la DIAN?',
      answer:
        'Sí, totalmente. Cada factura emitida a través de Empyra cuenta con código QR oficial, código CUFE y validación previa aprobada en tiempo real por los servidores de la DIAN, cumpliendo la Resolución 000165.',
    },
    {
      question: '¿Puedo darle acceso a mi contador para que descargue los reportes?',
      answer:
        '¡Claro que sí! Puedes invitar a tu contador para que consulte las ventas, descargue los comprobantes en PDF o Excel y prepare las declaraciones sin que tengas que estar enviándole papeles a fin de mes.',
    },
    {
      question: '¿Tengo que firmar algún contrato de permanencia?',
      answer:
        'Ninguno. Puedes pagar mes a mes o aprovechar el 20% de descuento en el plan anual. Si en algún momento deseas suspender o cambiar de plan, puedes hacerlo con un solo clic y descargar toda tu información.',
    },
    {
      question: '¿Puedo importar mi lista actual de clientes y productos desde Excel?',
      answer:
        'Sí. Empyra cuenta con una herramienta sencilla para cargar tu catálogo de productos y tus clientes desde un archivo Excel en segundos, calculando automáticamente el dígito de verificación de cada NIT.',
    },
  ];

  return (
    <section id="faq" className="py-24 relative overflow-hidden bg-slate-50/60 dark:bg-slate-950/80 transition-colors duration-200 border-t border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sapphire-50 dark:bg-sapphire-950/60 border border-sapphire-200 dark:border-sapphire-800/80 text-xs font-bold text-sapphire-800 dark:text-sapphire-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-sapphire-500" />
            Preguntas Frecuentes
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Resolvemos tus dudas en segundos
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg">
            Todo lo que necesitas saber para empezar a facturar con total confianza.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.question}
                className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/90 overflow-hidden shadow-sm transition-all duration-200"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full text-left p-6 flex items-center justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf-500 cursor-pointer"
                >
                  <span className="font-display font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                    {faq.question}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${
                      isOpen
                        ? 'bg-leaf-100 text-leaf-700 dark:bg-leaf-950 dark:text-leaf-300 rotate-180'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/60 animate-fade-in">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
