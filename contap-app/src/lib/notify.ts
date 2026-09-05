import 'server-only';
import { db } from './db';
import { env } from './env';
import { rupees } from './money';

/**
 * Every message the platform sends is written to the database first and sent
 * second. Without SMTP configured, messages still queue and are visible in the
 * admin panel, so nothing is silently lost and nothing is silently faked.
 */

export type TemplateName =
  | 'welcome'
  | 'verify_email'
  | 'password_reset'
  | 'order_confirmed'
  | 'payment_received'
  | 'profile_published'
  | 'card_dispatched'
  | 'card_delivered'
  | 'card_activated'
  | 'renewal_reminder'
  | 'renewal_successful'
  | 'lead_received';

type Built = { subject: string; body: string };

const APP = () => env.appUrl;

const TEMPLATES: Record<TemplateName, (v: Record<string, string | number>) => Built> = {
  welcome: (v) => ({
    subject: 'Welcome to NFCY',
    body: `Hi ${v.name},

Your NFCY account is ready.

Next step is your profile. It takes about ten minutes and you can change every word of it later.

${APP()}/dashboard/profile

If you get stuck, reply to this email or message us on WhatsApp at ${env.whatsapp}.`,
  }),

  verify_email: (v) => ({
    subject: 'Confirm your email',
    body: `Hi ${v.name},

Confirm this is your email address:

${v.link}

The link works for 24 hours. If you did not sign up for NFCY, ignore this and nothing happens.`,
  }),

  password_reset: (v) => ({
    subject: 'Reset your NFCY password',
    body: `Hi ${v.name},

Use this link to set a new password:

${v.link}

It works for one hour and once only. If you did not ask for this, ignore it. Your current password still works.`,
  }),

  order_confirmed: (v) => ({
    subject: `Order ${v.orderNumber} received`,
    body: `Hi ${v.name},

We have your order ${v.orderNumber} for ${v.total}.

You can follow it here:
${APP()}/dashboard/orders/${v.orderId}

While your card is being made, build your profile. The card ships already pointed at it.
${APP()}/dashboard/profile`,
  }),

  payment_received: (v) => ({
    subject: `Payment received for ${v.orderNumber}`,
    body: `Hi ${v.name},

We received ${v.total} for order ${v.orderNumber}.

Your invoice is in your dashboard:
${APP()}/dashboard/orders/${v.orderId}`,
  }),

  profile_published: (v) => ({
    subject: 'Your NFCY profile is live',
    body: `Hi ${v.name},

Your profile is live at ${v.url}

Share the link, or wait for your card and let people tap it. Both go to the same place, and you can change what they see whenever you want.`,
  }),

  card_dispatched: (v) => ({
    subject: `Your card is on its way`,
    body: `Hi ${v.name},

Order ${v.orderNumber} was dispatched.

Courier: ${v.courier}
Tracking number: ${v.awb}
${v.trackingUrl ? `Track it: ${v.trackingUrl}` : ''}

When it arrives, activate it here:
${APP()}/dashboard/cards`,
  }),

  card_delivered: (v) => ({
    subject: 'Your card has been delivered',
    body: `Hi ${v.name},

Your card has been delivered. One step left.

Activate it here with the code printed on the card:
${APP()}/dashboard/cards

Once it is active, tapping it opens your profile.`,
  }),

  card_activated: (v) => ({
    subject: 'Your card is active',
    body: `Hi ${v.name},

Card ${v.serial} is active and pointed at ${v.url}

Tap it on any phone and your profile opens. Change your profile whenever you want, and every card you have ever handed out follows.`,
  }),

  renewal_reminder: (v) => ({
    subject:
      Number(v.daysLeft) === 1
        ? 'Your NFCY profile renews tomorrow'
        : `Your NFCY profile renews in ${v.daysLeft} days`,
    body: `Hi ${v.name},

Your profile stays online until ${v.expiresOn}, which is ${v.daysLeft} day${Number(v.daysLeft) === 1 ? '' : 's'} away.

Renewing is ${v.price} for the year and keeps your link, your QR, your analytics and your edits exactly as they are.

${APP()}/dashboard/renewal

Your card is yours either way. If the profile pauses, renewing brings it straight back.`,
  }),

  renewal_successful: (v) => ({
    subject: 'Renewed for another year',
    body: `Hi ${v.name},

Your NFCY profile is renewed until ${v.expiresOn}.

Nothing changed and nothing needs doing. Your link and your card keep working.`,
  }),

  lead_received: (v) => ({
    subject: `New enquiry from ${v.leadName}`,
    body: `Hi ${v.name},

Someone left an enquiry on your profile.

Name: ${v.leadName}
${v.phone ? `Phone: ${v.phone}` : ''}
${v.email ? `Email: ${v.email}` : ''}

${v.message ? `Message:\n${v.message}` : ''}

All your enquiries: ${APP()}/dashboard/leads`,
  }),
};

export async function notify(input: {
  template: TemplateName;
  to: string;
  userId?: string | null;
  vars: Record<string, string | number>;
  /** Same key twice means the same message: the second one is dropped. */
  dedupeKey?: string;
}): Promise<void> {
  try {
    if (input.dedupeKey) {
      const seen = await db.notification.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (seen) return;
    }

    const built = TEMPLATES[input.template](input.vars);

    const row = await db.notification.create({
      data: {
        userId: input.userId ?? null,
        channel: 'email',
        template: input.template,
        toAddress: input.to,
        subject: built.subject,
        body: built.body,
        status: 'queued',
        dedupeKey: input.dedupeKey ?? null,
      },
    });

    if (!env.mail.configured) return; // queued and visible in admin, honestly not sent

    try {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.createTransport({
        host: env.mail.host,
        port: env.mail.port,
        secure: env.mail.port === 465,
        auth: { user: env.mail.user, pass: env.mail.password },
      });
      await transport.sendMail({
        from: env.mail.from,
        to: input.to,
        subject: built.subject,
        text: built.body,
      });
      await db.notification.update({
        where: { id: row.id },
        data: { status: 'sent', sentAt: new Date() },
      });
    } catch (e) {
      await db.notification.update({
        where: { id: row.id },
        data: { status: 'failed', error: String(e).slice(0, 500) },
      });
    }
  } catch (e) {
    // A failed notification must never break the action that triggered it.
    console.error('[notify]', e);
  }
}

export const money = rupees;
