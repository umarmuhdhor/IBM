import { Item } from '../cart/cart';
import { calculateTotal } from '../checkout/checkout';
import { formatRupiah } from '../utils';

interface HeaderProps {
  items: Item[];
}

/**
 * Site header — shows the store title and the current cart total.
 *
 * Calling `calculateTotal(items)` here is intentional: it makes the header
 * a cross-file touch-point so that experiment tasks 3 (shipping) and 4
 * (international pricing) also require changes here.
 */
export default function Header({ items }: HeaderProps) {
  const total = calculateTotal(items);

  return (
    <header
      style={{
        background: 'var(--accent)',
        color: '#fff',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Toko Demo</span>
      <span>
        Cart total: <strong>{formatRupiah(total)}</strong>
      </span>
    </header>
  );
}
