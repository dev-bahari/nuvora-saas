'use client';

import { toViewModel, type InvoiceViewLine, type InvoiceViewTaxSummary } from '@nuvora/invoice-view';
import type { DraftDocument } from '@nuvora/contracts';

interface Props {
  doc: DraftDocument;
}

export function InvoicePreview({ doc }: Props) {
  const vm = toViewModel(doc);

  return (
    <div className="relative border rounded p-6 bg-white text-sm space-y-4 text-neutral-800">
      {vm.isDraft && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          aria-hidden="true"
        >
          <span className="text-red-200 font-black text-2xl rotate-[-35deg] text-center leading-tight opacity-60">
            BORRADOR<br />NO VÁLIDO COMO FACTURA
          </span>
        </div>
      )}

      <div className="space-y-1">
        <h2 className="font-bold text-lg">
          {vm.documentType === 'INVOICE' ? 'Factura de venta' : vm.documentType}
        </h2>
        <p className="text-neutral-500">Fecha: {vm.issueDate}</p>
        {vm.dueDate && <p className="text-neutral-500">Vencimiento: {vm.dueDate}</p>}
      </div>

      <div className="space-y-1">
        <p className="font-semibold">{vm.customer.legalName}</p>
        <p className="text-neutral-500">
          {vm.customer.identificationType}: {vm.customer.identification}
          {vm.customer.dv ? `-${vm.customer.dv}` : ''}
        </p>
        <p className="text-neutral-500">{vm.customer.emailPrimary}</p>
      </div>

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-neutral-100">
            <th className="text-left p-2 border">Descripción</th>
            <th className="text-right p-2 border">Cant.</th>
            <th className="text-right p-2 border">Precio</th>
            <th className="text-right p-2 border">IVA</th>
            <th className="text-right p-2 border">Total</th>
          </tr>
        </thead>
        <tbody>
          {vm.lines.map((l: InvoiceViewLine) => (
            <tr key={l.id}>
              <td className="p-2 border">{l.description}</td>
              <td className="p-2 border text-right">{l.quantity}</td>
              <td className="p-2 border text-right">{l.unitPrice}</td>
              <td className="p-2 border text-right">{l.taxTreatmentLabel}</td>
              <td className="p-2 border text-right">{l.lineTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-col items-end space-y-1 text-sm">
        <p>Subtotal: <span className="font-medium">{vm.currency} {vm.subtotal}</span></p>
        {vm.taxSummary.map((ts: InvoiceViewTaxSummary, i: number) => (
          <p key={i}>{ts.label}: <span className="font-medium">{ts.taxAmount}</span></p>
        ))}
        {vm.aiu && (
          <p>AIU: <span className="font-medium">{vm.aiu.total}</span></p>
        )}
        <p className="text-base font-bold border-t pt-1">
          TOTAL: {vm.currency} {vm.grandTotal}
        </p>
      </div>

      {vm.notes && (
        <p className="text-neutral-500 text-xs border-t pt-2">{vm.notes}</p>
      )}
    </div>
  );
}
