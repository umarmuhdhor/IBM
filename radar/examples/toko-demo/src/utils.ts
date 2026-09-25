/**
 * Utility functions used across multiple modules.
 * These are intentional "touch-point" files for the experiment tasks.
 */

/**
 * Format a number as Indonesian Rupiah currency string.
 * @example formatRupiah(125000) // "Rp 125.000"
 */
export function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

/**
 * Clamp a value between min and max (inclusive).
 * Used by cart to enforce item quantity limits.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Sum an array of numbers.
 */
export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
