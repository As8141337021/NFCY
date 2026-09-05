'use client';

import { useState } from 'react';
import { IconCopy, IconCheck } from '@/components/icons';

export default function CopyLink({ url, label }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard can be blocked; fall back to a selection the user can copy
      const el = document.createElement('textarea');
      el.value = url;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      try {
        document.execCommand('copy');
      } catch {
        window.prompt('Copy this link', url);
      }
      el.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <button type="button" className="btn btn-quiet btn-sm" onClick={copy} aria-live="polite">
      {copied ? <IconCheck /> : <IconCopy />}
      {copied ? 'Copied' : (label ?? url.replace(/^https?:\/\//, ''))}
    </button>
  );
}
