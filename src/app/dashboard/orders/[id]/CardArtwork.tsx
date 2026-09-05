'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import ImagePicker from '@/components/ImagePicker';

/**
 * The photograph for a card printed with the buyer's face on it.
 *
 * Asked for after payment on purpose: nobody has a good photo to hand while
 * they are paying, and this way it can be replaced right up until the card
 * goes to production.
 */
export default function CardArtwork({
  orderId,
  orderItemId,
  productName,
  finish,
  photoUrl,
  locked,
}: {
  orderId: string;
  orderItemId: string;
  productName: string;
  finish: string | null;
  photoUrl: string | null;
  locked: boolean;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [url, setUrl] = useState(photoUrl);
  const [error, setError] = useState('');

  async function save(mediaId: string, mediaUrl: string) {
    setError('');
    const res = await api<{ photoMediaId: string }>(`/api/orders/${orderId}/artwork`, {
      method: 'PATCH',
      json: { orderItemId, photoMediaId: mediaId },
    });
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setUrl(mediaUrl);
    toast('Photo saved');
    router.refresh();
  }

  return (
    <div className="card" style={{ borderColor: url ? 'var(--line)' : 'rgba(240,180,90,.45)' }}>
      <div className="card-head">
        <h2>{url ? 'The photo for your card' : 'We need your photo'}</h2>
        {finish ? <span className="pill">{finish}</span> : null}
      </div>

      {error ? <p className="form-error" role="alert">{error}</p> : null}

      <p className="muted small" style={{ marginBottom: 16 }}>
        {locked
          ? `Your ${productName} has gone to production, so the photo is fixed now.`
          : url
            ? `This is what will be printed on your ${productName}. You can change it until we start printing.`
            : `Your ${productName} is printed with your photograph on it. Upload one and we will start.`}
      </p>

      {locked ? (
        url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="The photo on your card" style={{ width: 150, borderRadius: 12 }} />
        ) : null
      ) : (
        <ImagePicker
          label="Your photograph"
          hint="Head and shoulders, facing the camera, in good light. A plain background prints best."
          url={url}
          onPicked={(id, u) => void save(id, u)}
          onCleared={() => setUrl(null)}
        />
      )}
    </div>
  );
}
