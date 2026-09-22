'use client';

import type { LineInput } from '@nuvora/contracts';

interface LineItemProps {
  index: number;
  line: LineInput;
  onChange: (index: number, field: keyof LineInput, value: string | number) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

const TAX_TREATMENTS = [
  { value: 'TAXED', label: 'Gravado' },
  { value: 'EXEMPT', label: 'Exento' },
  { value: 'EXCLUDED', label: 'Excluido' },
  { value: 'NON_TAXED', label: 'No gravado' },
] as const;

export function LineItem({ index, line, onChange, onRemove, canRemove }: LineItemProps) {
  return (
    <tr>
      <td className="p-2">
        <input
          type="text"
          value={line.description}
          onChange={(e) => onChange(index, 'description', e.target.value)}
          placeholder="Descripción"
          className="w-full border rounded px-2 py-1 text-sm"
          aria-label={`Descripción línea ${index + 1}`}
        />
      </td>
      <td className="p-2 w-24">
        <input
          type="number"
          value={line.quantity}
          min="0.000001"
          step="any"
          onChange={(e) => onChange(index, 'quantity', e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm text-right"
          aria-label={`Cantidad línea ${index + 1}`}
        />
      </td>
      <td className="p-2 w-32">
        <input
          type="number"
          value={line.unitPrice}
          min="0"
          step="any"
          onChange={(e) => onChange(index, 'unitPrice', e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm text-right"
          aria-label={`Precio unitario línea ${index + 1}`}
        />
      </td>
      <td className="p-2 w-20">
        <input
          type="number"
          value={line.discountPct ?? 0}
          min="0"
          max="100"
          step="any"
          onChange={(e) => onChange(index, 'discountPct', parseFloat(e.target.value) || 0)}
          className="w-full border rounded px-2 py-1 text-sm text-right"
          aria-label={`Descuento % línea ${index + 1}`}
        />
      </td>
      <td className="p-2 w-32">
        <select
          value={line.taxTreatment}
          onChange={(e) => onChange(index, 'taxTreatment', e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm"
          aria-label={`Tratamiento IVA línea ${index + 1}`}
        >
          {TAX_TREATMENTS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </td>
      <td className="p-2 w-20">
        <input
          type="number"
          value={line.taxRate ?? 0}
          min="0"
          max="100"
          step="any"
          onChange={(e) => onChange(index, 'taxRate', parseFloat(e.target.value) || 0)}
          className="w-full border rounded px-2 py-1 text-sm text-right"
          disabled={line.taxTreatment !== 'TAXED'}
          aria-label={`Tasa IVA % línea ${index + 1}`}
        />
      </td>
      <td className="p-2 w-10 text-center">
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="text-red-500 hover:text-red-700 text-lg leading-none"
            aria-label={`Eliminar línea ${index + 1}`}
          >
            ×
          </button>
        )}
      </td>
    </tr>
  );
}
