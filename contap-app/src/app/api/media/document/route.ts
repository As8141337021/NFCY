import { handler, ok, rateLimit, clientKey } from '@/lib/api';
import { requireUser, HttpError } from '@/lib/auth';
import { storeDocument } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * A PDF a business hands out: a catalogue, a price list, a brochure.
 * Separate from the image upload so neither can be talked into accepting what
 * the other is for.
 */
export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit(clientKey(req, 'upload-doc'), 30, 600);
  await rateLimit(`upload-doc-user:${user.id}`, 60, 3600);

  const form = await req.formData().catch(() => null);
  if (!form) throw new HttpError(400, 'That upload was not readable. Please try again.', 'bad_form');

  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'No file was attached.', 'no_file');

  const asset = await storeDocument(file, user.id);
  return ok(asset);
});
