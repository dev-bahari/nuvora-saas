'use client';

import { useState } from 'react';
import type { AIUInput } from '@nuvora/contracts';

interface AIUPanelProps {
  aiu: AIUInput | null;
  onChange: (aiu: AIUInput | null) => void;
}

const DEFAULT_AIU: AIUInput = {
  base: '0',
  administracionPct: 0,
  imprevistosPct: 0,
  utilidadPct: 10,
  ivaOnUtilidadPct: 19,
  mode: 'SPECIAL',
};

export function AIUPanel({ aiu, onChange }: AIUPanelProps) {
  const [open, setOpen] = useState(!!aiu);

  function toggle() {
    if (open) {
      onChange(null);
    } else {
      onChange(DEFAULT_AIU);
    }
    setOpen(!open);
  }

  function update(field: keyof AIUInput, value: string | number) {
    if (!aiu) return;
    onChange({ ...aiu, [field]: value });
  }

  return (
    <div className="border rounded p-4 space-y-3">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 font-medium text-sm"
        aria-expanded={open}
      >
        <span>{open ? '▼' : '▶'}</span>
        AIU (Administración, Imprevistos y Utilidad)
        {aiu && <span className="text-xs text-blue-600 ml-2">activo</span>}
      </button>

      {open && aiu && (
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs font-medium mb-1">Base AIU</label>
            <input
              type="number"
              value={aiu.base}
              min="0"
              step="any"
              onChange={(e) => update('base', e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Administración (%)</label>
            <input
              type="number"
              value={aiu.administracionPct}
              min="0" max="100" step="any"
              onChange={(e) => update('administracionPct', parseFloat(e.target.value) || 0)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Imprevistos (%)</label>
            <input
              type="number"
              value={aiu.imprevistosPct}
              min="0" max="100" step="any"
              onChange={(e) => update('imprevistosPct', parseFloat(e.target.value) || 0)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Utilidad (%)</label>
            <input
              type="number"
              value={aiu.utilidadPct}
              min="0" max="100" step="any"
              onChange={(e) => update('utilidadPct', parseFloat(e.target.value) || 0)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">IVA sobre utilidad (%)</label>
            <input
              type="number"
              value={aiu.ivaOnUtilidadPct ?? 0}
              min="0" max="100" step="any"
              onChange={(e) => update('ivaOnUtilidadPct', parseFloat(e.target.value) || 0)}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Modo</label>
            <select
              value={aiu.mode ?? 'SPECIAL'}
              onChange={(e) => update('mode', e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="SPECIAL">Especial</option>
              <option value="INFORMATIVE">Informativo</option>
              <option value="NONE">Sin AIU</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
