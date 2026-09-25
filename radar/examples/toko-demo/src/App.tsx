import { useState } from 'react';
import './ui/theme.css';
import Header from './ui/Header';
import { Item, addItem, removeItem } from './cart/cart';
import { calculateTotal } from './checkout/checkout';
import { applyCoupon } from './checkout/coupon';
import { formatRupiah } from './utils';
import products from './data/products.json';

export default function App() {
  const [cart, setCart] = useState<Item[]>([]);

  function handleAdd(product: (typeof products)[number]) {
    setCart((prev) =>
      addItem(prev, {
        productId: product.id,
        name: product.name,
        price: product.price,
      }),
    );
  }

  function handleRemove(productId: number) {
    setCart((prev) => removeItem(prev, productId));
  }

  const subtotal = calculateTotal(cart);
  const total = applyCoupon(subtotal);

  return (
    <div>
      <Header items={cart} />

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem' }}>
        {/* Product list */}
        <section>
          <h2 style={{ marginTop: 0 }}>Products</h2>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.75rem' }}>
            {products.map((p) => (
              <li
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                <div>
                  <strong>{p.name}</strong>
                  <span
                    style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}
                  >
                    {p.category}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span>{formatRupiah(p.price)}</span>
                  <button
                    onClick={() => handleAdd(p)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Add
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Cart */}
        <section style={{ marginTop: '2rem' }}>
          <h2>Cart</h2>
          {cart.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Your cart is empty.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.5rem' }}>
              {cart.map((item) => (
                <li
                  key={item.productId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 1rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                  }}
                >
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span>{formatRupiah(item.price * item.quantity)}</span>
                    <button
                      onClick={() => handleRemove(item.productId)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      −
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Checkout summary */}
        <section
          style={{
            marginTop: '2rem',
            padding: '1rem 1.5rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Checkout Summary</h2>
          <p>
            Subtotal: <strong>{formatRupiah(subtotal)}</strong>
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            Shipping &amp; coupon: not yet implemented (see experiment tasks 1 &amp; 3)
          </p>
          <p style={{ fontSize: '1.1rem' }}>
            Total: <strong>{formatRupiah(total)}</strong>
          </p>
        </section>
      </main>
    </div>
  );
}
