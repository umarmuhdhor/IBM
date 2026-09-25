import { clamp } from '../utils';

/** A single item in the shopping cart. */
export interface Item {
  productId: number;
  name: string;
  price: number;
  quantity: number;
}

const MAX_QUANTITY = 99;

/**
 * Add a product to the cart, or increment its quantity if already present.
 * Quantity is clamped to MAX_QUANTITY.
 */
export function addItem(cart: Item[], product: Omit<Item, 'quantity'>): Item[] {
  const existing = cart.find((i) => i.productId === product.productId);
  if (existing) {
    return cart.map((i) =>
      i.productId === product.productId
        ? { ...i, quantity: clamp(i.quantity + 1, 1, MAX_QUANTITY) }
        : i,
    );
  }
  return [...cart, { ...product, quantity: 1 }];
}

/**
 * Remove one unit of a product from the cart.
 * Removes the entry entirely when quantity reaches zero.
 */
export function removeItem(cart: Item[], productId: number): Item[] {
  return cart
    .map((i) =>
      i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i,
    )
    .filter((i) => i.quantity > 0);
}
