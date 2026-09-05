import { handler, ok, rateLimit, clientKey } from '@/lib/api';
import { requireUser, HttpError } from '@/lib/auth';
import { storeUpload } from '@/lib/storage';

export const runtime = 'nodejs';
export const maxDuration = 30;

export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit(clientKey(req, 'upload'), 60, 600);
  await rateLimit(`upload-user:${user.id}`, 120, 3600);

  const form = await req.formData().catch(() => null);
  if (!form) throw new HttpError(400, 'That upload was not readable. Please try again.', 'bad_form');

  const file = form.get('file');
  if (!(file instanceof File)) throw new HttpError(400, 'No image was attached.', 'no_file');

  const asset = await storeUpload(file, user.id);
  return ok(asset);
});
