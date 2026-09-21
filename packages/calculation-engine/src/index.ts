/**
 * @nuvora/calculation-engine
 * Pure domain calculation package for Colombian fiscal formulas.
 * Rule: Only Decimal.js allowed; no JavaScript floating point for money.
 */

import { Decimal } from 'decimal.js';

export const ENGINE_VERSION = '1.0.0';

/**
 * Configure Decimal defaults: 20 precision digits, ROUND_HALF_UP.
 */
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };
