import { handler, ok, readJson, rateLimit, clientKey } from '@/lib/api';
import { z } from 'zod';
import { cartItemSchema } from '@/lib/validate';
import { currentUser } from '@/lib/auth';
import { priceCart } from '@/lib/pricing';

export const runtime = 'nodejs';

const schema = z.object({
  items: z.array(cartItemSchema).min(1).max(50),
  couponCode: z.string().trim().max(40).optional().nullable(),
});

/**
 * Prices a cart for display. The same function runs again at checkout, so what
 * is shown here and what is charged there can never drift apart.
 */
export const POST = handler(async (req) => {
  await rateLimit(clientKey(req, 'price'), 120, 300);
  const input = await readJson(req, schema);
  const user = await currentUser();

  const priced = await priceCart({
    items: input.items,
    couponCode: input.couponCode ?? null,
    userId: user?.id ?? null,
  });

  return ok(priced);
});
