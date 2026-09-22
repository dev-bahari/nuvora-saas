'use client';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

interface Props {
  state: SaveState;
}

const MESSAGES: Record<SaveState, string> = {
  idle: '',
  saving: 'Guardando…',
  saved: 'Guardado ✓',
  error: 'Error al guardar',
  conflict: 'Conflicto de versión — recarga la página',
};

const COLORS: Record<SaveState, string> = {
  idle: 'text-neutral-400',
  saving: 'text-neutral-500',
  saved: 'text-green-600',
  error: 'text-red-600',
  conflict: 'text-orange-600 font-semibold',
};

export function SaveStatus({ state }: Props) {
  if (state === 'idle') return null;
  return (
    <span className={`text-sm ${COLORS[state]}`} aria-live="polite">
      {MESSAGES[state]}
    </span>
  );
}
