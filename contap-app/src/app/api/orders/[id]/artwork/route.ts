import { db } from '@/lib/db';
import { handler, ok, readJson } from '@/lib/api';
import { requireUser, HttpError } from '@/lib/auth';
import { orderArtworkSchema } from '@/lib/validate';

export const runtime = 'nodejs';

/**
 * The photograph for a card that is printed with the buyer's face on it.
 *
 * Set after payment rather than before, so nobody has to find a good photo
 * standing at a checkout, and so it can be replaced if the printer asks for a
 * better one. Locked once the card has actually gone to production.
 */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = await readJson(req, orderArtworkSchema);

  const item = await db.orderItem.findFirst({
    where: { id: input.orderItemId, orderId: id, order: { userId: user.id } },
    include: { order: { select: { status: true } } },
  });
  if (!item) throw new HttpError(404, 'That order line is not yours.', 'not_found');

  const gone: string[] = ['DISPATCHED', 'DELIVERED', 'ACTIVATED', 'CANCELLED'];
  if (gone.includes(item.order.status)) {
    throw new HttpError(
      409,
      'This card has already gone to production, so the photo cannot be changed now. Message us and we will sort it out.',
      'too_late',
    );
  }

  const photo = await db.mediaAsset.findUnique({
    where: { id: input.photoMediaId },
    select: { mimeType: true, ownerId: true },
  });
  if (!photo || !photo.mimeType.startsWith('image/')) {
    throw new HttpError(422, 'That file is not an image.', 'validation');
  }
  if (photo.ownerId && photo.ownerId !== user.id) {
    throw new HttpError(403, 'That file is not yours.', 'forbidden');
  }

  const current = (item.customization ?? {}) as Record<string, unknown>;
  const updated = await db.orderItem.update({
    where: { id: item.id },
    data: { customization: { ...current, photoMediaId: input.photoMediaId } as never },
  });

  await db.orderStatusEvent.create({
    data: {
      orderId: id,
      status: item.order.status as never,
      note: `Photo uploaded for ${item.productName}.`,
    },
  });

  return ok({ orderItemId: updated.id, photoMediaId: input.photoMediaId });
});
