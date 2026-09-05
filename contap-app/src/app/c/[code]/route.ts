import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { track, looksLikeBot } from '@/lib/analytics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What the NFC chip actually stores: nfcy.in/t/<code>
 *
 * The chip holds nothing but this short code. The destination lives in the
 * database, so a customer can change their number, their profile or even which
 * Instagram account the card opens, and the card in someone's wallet follows
 * along. A card is never reprogrammed and never reprinted.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;

  const card = await db.nfcCard.findUnique({
    where: { code: code.toUpperCase() },
    include: { profile: { select: { id: true, username: true, status: true } } },
  });

  const home = env.appUrl;

  if (!card) {
    return NextResponse.redirect(`${home}/tap?state=unknown`, 302);
  }

  const ua = req.headers.get('user-agent') ?? '';
  const isBot = looksLikeBot(ua);

  if (!isBot) {
    await db.nfcCard
      .update({
        where: { id: card.id },
        data: { tapCount: { increment: 1 }, lastTapAt: new Date() },
      })
      .catch(() => {});
  }

  // a card that has been made but not yet handed to anyone
  if (card.status === 'UNASSIGNED' || card.status === 'ASSIGNED') {
    return NextResponse.redirect(`${home}/tap?state=inactive&serial=${encodeURIComponent(card.serial)}`, 302);
  }
  if (card.status === 'SUSPENDED' || card.status === 'LOST' || card.status === 'REPLACED') {
    return NextResponse.redirect(`${home}/tap?state=disabled`, 302);
  }

  let destination: string | null = null;
  let eventType: 'NFC_TAP' | 'REVIEW_REDIRECT' = 'NFC_TAP';

  if (card.destinationType === 'PROFILE') {
    if (!card.profile) {
      return NextResponse.redirect(`${home}/tap?state=inactive&serial=${encodeURIComponent(card.serial)}`, 302);
    }
    if (card.profile.status === 'RENEWAL_REQUIRED') {
      return NextResponse.redirect(`${home}/${card.profile.username}`, 302);
    }
    destination = `${home}/${card.profile.username}?s=nfc`;
  } else {
    destination = card.destinationUrl;
    if (card.destinationType === 'GOOGLE_REVIEW') eventType = 'REVIEW_REDIRECT';
    if (!destination) {
      return NextResponse.redirect(`${home}/tap?state=nodestination&serial=${encodeURIComponent(card.serial)}`, 302);
    }
  }

  if (!isBot) {
    await track(req, {
      profileId: card.profileId,
      cardId: card.id,
      type: eventType,
      label: card.destinationType,
      source: 'nfc',
    });
  }

  // never cached: the destination is the customer's to change at any moment
  return new NextResponse(null, {
    status: 302,
    headers: { location: destination, 'cache-control': 'no-store, max-age=0' },
  });
}
