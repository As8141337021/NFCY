import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { requireUserOrRedirect } from '@/lib/guards';
import CardsClient from './CardsClient';

export const metadata: Metadata = { title: 'My cards' };
export const dynamic = 'force-dynamic';

export default async function CardsPage() {
  const user = await requireUserOrRedirect('/dashboard/cards');

  const [cards, profiles] = await Promise.all([
    db.nfcCard.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { name: true, slug: true } },
        profile: { select: { username: true } },
      },
    }),
    db.profile.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, username: true, fullName: true },
    }),
  ]);

  return (
    <>
      <div className="page-head">
        <h1>My cards</h1>
        <p>
          Every card here is a short link the chip stores. Change where it points and the card in someone else&apos;s
          wallet follows, without reprinting anything.
        </p>
      </div>

      {cards.length === 0 ? (
        <div className="empty" style={{ marginBottom: 24 }}>
          <h3>No cards on your account yet</h3>
          <p>
            If you have ordered one it will show here once we assign it. If you already have a card in your hand, use
            the form below to activate it.
          </p>
          <Link href="/cards" className="btn btn-accent">
            See the cards
          </Link>
        </div>
      ) : null}

      <CardsClient
        appUrl={env.appUrl}
        profiles={profiles}
        cards={cards.map((c) => ({
          id: c.id,
          serial: c.serial,
          code: c.code,
          status: c.status,
          productName: c.product?.name ?? null,
          productSlug: c.product?.slug ?? null,
          destinationType: c.destinationType,
          destinationUrl: c.destinationUrl,
          profileId: c.profileId,
          profileUsername: c.profile?.username ?? null,
          tapCount: c.tapCount,
          activatedAt: c.activatedAt?.toISOString() ?? null,
          lastTapAt: c.lastTapAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
