import { Item } from '../cart/cart';
import { sum } from '../utils';

/**
 * Calculate the total price for the given cart items.
 * Shipping and coupon support are not yet implemented —
 * see experiment tasks 1 (coupon) and 3 (shipping).
 */
export function calculateTotal(items: Item[]): number {
  return sum(items.map((i) => i.price * i.quantity));
}
