'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'nfcy_cart_v1';
const EVENT = 'nfcy:cart';

export type CartItem = {
  productId: string;
  quantity: number;
  /** Kept for display only. What is charged always comes from the server. */
  name: string;
  priceMinor: number;
  /** Only for a card that is made to order, such as the printed portrait. */
  customization?: { finish?: string } | null;
};

function read(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i): i is CartItem =>
        Boolean(i) && typeof i === 'object' &&
        typeof (i as CartItem).productId === 'string' &&
        Number.isInteger((i as CartItem).quantity),
      )
      .map((i) => ({ ...i, quantity: Math.min(2000, Math.max(1, i.quantity)) }));
  } catch {
    return [];
  }
}

function write(items: CartItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // a private window with storage disabled: the cart simply lives in memory
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/**
 * The cart lives in the browser on purpose: it costs nothing, survives a
 * refresh, and never has to be reconciled with a server session. Every rupee
 * is recomputed server side before anything is charged.
 */
export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(read());
    setReady(true);
    const sync = () => setItems(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync); // another tab changed it
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const add = useCallback((item: CartItem) => {
    const next = read();
    const found = next.find((i) => i.productId === item.productId);
    if (found) found.quantity = Math.min(2000, found.quantity + item.quantity);
    else next.push(item);
    write(next);
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    const next = read()
      .map((i) => (i.productId === productId ? { ...i, quantity: Math.min(2000, Math.max(0, quantity)) } : i))
      .filter((i) => i.quantity > 0);
    write(next);
  }, []);

  const remove = useCallback((productId: string) => {
    write(read().filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => write([]), []);

  const count = items.reduce((n, i) => n + i.quantity, 0);

  return { items, count, ready, add, setQuantity, remove, clear };
}

export const cartCount = () => read().reduce((n, i) => n + i.quantity, 0);
