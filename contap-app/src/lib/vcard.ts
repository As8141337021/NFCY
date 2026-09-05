/**
 * A downloadable contact card. Built by hand because the format is simple and
 * the escaping rules are the only part that actually matters.
 */

type VCardInput = {
  fullName: string;
  designation?: string | null;
  company?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  bio?: string | null;
  /** YYYY-MM-DD, and only when the person chose to share it. */
  birthday?: string | null;
  profileUrl: string;
};

/** RFC 6350: backslash, newline, comma and semicolon all have to be escaped. */
function esc(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** vCard lines fold at 75 octets, and each continuation starts with a space. */
function fold(line: string): string {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch, 'utf8') > 74) {
      out.push(cur);
      cur = ' ' + ch;
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.join('\r\n');
}

export function buildVCard(p: VCardInput): string {
  const parts = p.fullName.trim().split(/\s+/);
  const last = parts.length > 1 ? (parts.pop() as string) : '';
  const first = parts.join(' ');

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(p.fullName)}`,
  ];

  if (p.company) lines.push(`ORG:${esc(p.company)}`);
  if (p.designation) lines.push(`TITLE:${esc(p.designation)}`);
  if (p.phone) lines.push(`TEL;TYPE=CELL,VOICE:+91${p.phone}`);
  if (p.whatsapp && p.whatsapp !== p.phone) lines.push(`TEL;TYPE=CELL:+91${p.whatsapp}`);
  if (p.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(p.email)}`);
  if (p.website) lines.push(`URL:${esc(p.website)}`);
  lines.push(`URL:${esc(p.profileUrl)}`);
  if (p.address) lines.push(`ADR;TYPE=WORK:;;${esc(p.address)};;;;`);
  if (p.bio) lines.push(`NOTE:${esc(p.bio.slice(0, 500))}`);
  // BDAY is what puts the date into the phone's own birthday reminders
  if (p.birthday) lines.push(`BDAY:${p.birthday}`);

  lines.push(`REV:${new Date().toISOString()}`);
  lines.push('END:VCARD');

  return lines.map(fold).join('\r\n') + '\r\n';
}

/** A safe filename for the download, in ASCII. */
export function vcardFilename(fullName: string): string {
  const base = fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${base || 'contact'}.vcf`;
}
