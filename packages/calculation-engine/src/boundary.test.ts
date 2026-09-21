import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION, Decimal } from './index.js';

describe('@nuvora/calculation-engine boundary', () => {
  it('exports engine version and Decimal class', () => {
    expect(ENGINE_VERSION).toBe('1.0.0');
    expect(typeof Decimal).toBe('function');
  });

  it('preserves Decimal precision without JavaScript floating point rounding errors', () => {
    const a = new Decimal('0.1');
    const b = new Decimal('0.2');
    const sum = a.plus(b);
    expect(sum.toString()).toBe('0.3');
  });
});
