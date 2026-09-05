'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { useToast } from '@/components/Toast';

/** A card that is printed to order has to be told what to look like. */
const FINISHES = ['Black matte', 'Silver matte'] as const;

export default function AddToCart({
  productId,
  name,
  priceMinor,
  label,
  inStock,
  needsFinish = false,
}: {
  productId: string;
  name: string;
  priceMinor: number;
  label: string;
  inStock: boolean;
  needsFinish?: boolean;
}) {
  const { add } = useCart();
  const { toast } = useToast();
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [finish, setFinish] = useState<string>(FINISHES[0]);

  if (!inStock) {
    return (
      <button type="button" className="btn btn-quiet full" disabled aria-disabled="true">
        Out of stock
      </button>
    );
  }

  return (
    <div className="stack-sm">
      {needsFinish ? (
        <div className="finish-pick" role="radiogroup" aria-label="Card finish">
          {FINISHES.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={finish === f}
              className={`finish-opt${finish === f ? ' on' : ''}`}
              onClick={() => setFinish(f)}
            >
              <span className={`finish-dot ${f === 'Black matte' ? 'black' : 'silver'}`} aria-hidden="true" />
              {f}
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        className="btn btn-accent full"
        onClick={() => {
          add({
            productId,
            quantity: 1,
            name,
            priceMinor,
            customization: needsFinish ? { finish } : null,
          });
          setAdded(true);
          toast(needsFinish ? `${name}, ${finish.toLowerCase()}, added to your cart` : `${name} added to your cart`);
          setTimeout(() => setAdded(false), 2500);
        }}
      >
        {added ? 'Added' : label}
      </button>
      {added ? (
        <button type="button" className="btn btn-ghost full" onClick={() => router.push('/checkout')}>
          Go to checkout
        </button>
      ) : null}
    </div>
  );
}
