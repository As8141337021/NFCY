import 'server-only';
import { db } from './db';
import { isStaff, type SessionUser } from './auth';

/**
 * A profile exists to be opened by a card. Nothing is printed before someone
 * orders one, and nothing is published before someone owns one, so a profile
 * without a card behind it would be a page with no way in and a second QR code
 * competing with the one on the card.
 *
 * A card is minted the moment a payment is confirmed, so a buyer can start
 * building while theirs is still at the printer. They do not have to wait for
 * the post.
 */
export async function cardsOwned(userId: string): Promise<number> {
  return db.nfcCard.count({
    where: {
      userId,
      status: { in: ['UNASSIGNED', 'ASSIGNED', 'ACTIVE'] },
    },
  });
}

/** Whether this person is allowed to create a profile at all. */
export async function mayCreateProfile(user: SessionUser): Promise<boolean> {
  // staff build demo and support profiles without buying anything
  if (isStaff(user.role)) return true;
  // an organisation's seats are bought in bulk by the organisation
  if (user.organizationId) return true;
  return (await cardsOwned(user.id)) > 0;
}

/**
 * The card that speaks for a profile.
 *
 * Its short link is what the chip holds and what every QR encodes, so a tap
 * and a scan land in the same place and are counted the same way. Where a
 * profile has several cards, the first one activated is the one whose code the
 * QR carries; the others still open the same profile.
 */
export async function cardForProfile(profileId: string) {
  return db.nfcCard.findFirst({
    where: { profileId, status: { in: ['ASSIGNED', 'ACTIVE'] } },
    orderBy: [{ activatedAt: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, code: true, serial: true, status: true },
  });
}
