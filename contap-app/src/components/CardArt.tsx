/**
 * The product visuals, drawn rather than photographed.
 * When real product photographs exist they are uploaded in the admin panel and
 * shown instead; this is what renders until then, and it is a finished visual,
 * not a placeholder.
 */

export function CardArtDefs() {
  return (
    <svg className="defs" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ca-classic" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#242A35" />
          <stop offset="1" stopColor="#0D1017" />
        </linearGradient>
        <linearGradient id="ca-matte" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#191C22" />
          <stop offset="0.5" stopColor="#0C0E13" />
          <stop offset="1" stopColor="#05070A" />
        </linearGradient>
        <linearGradient id="ca-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8A6B33" />
          <stop offset="0.45" stopColor="#EBCE94" />
          <stop offset="0.62" stopColor="#D9B06A" />
          <stop offset="1" stopColor="#7E6130" />
        </linearGradient>
        <linearGradient id="ca-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6E7683" />
          <stop offset="0.28" stopColor="#C3CAD4" />
          <stop offset="0.44" stopColor="#7C838F" />
          <stop offset="0.62" stopColor="#AEB6C1" />
          <stop offset="0.8" stopColor="#5F666F" />
          <stop offset="1" stopColor="#8E959F" />
        </linearGradient>
        <linearGradient id="ca-review" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#222834" />
          <stop offset="1" stopColor="#0B0E14" />
        </linearGradient>
        <linearGradient id="ca-stand" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#252B37" />
          <stop offset="1" stopColor="#0C0F16" />
        </linearGradient>
        <linearGradient id="ca-ig" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#F9CE34" />
          <stop offset="0.35" stopColor="#EE2A7B" />
          <stop offset="0.7" stopColor="#9B36B7" />
          <stop offset="1" stopColor="#4C5FD7" />
        </linearGradient>
        <linearGradient id="ca-igface" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1E2430" />
          <stop offset="1" stopColor="#0A0D13" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const Wordmark = ({ fill = '#EAF0F6', opacity = 0.9 }: { fill?: string; opacity?: number }) => (
  <text
    x="34"
    y="45"
    fontFamily="var(--display)"
    fontSize="21"
    fontWeight="700"
    letterSpacing="-.7"
    fill={fill}
    fillOpacity={opacity}
  >
    NFCY
  </text>
);

const TapRing = ({ stroke = '#34E0F0', x = 252, y = 152 }: { stroke?: string; x?: number; y?: number }) => (
  <>
    <g transform={`translate(${x},${y})`} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round">
      <path d="M0 -13a12 12 0 0 1 0 26" />
      <path d="M8 -22a21 21 0 0 1 0 44" />
    </g>
    <circle cx={x - 7} cy={y} r="3.4" fill={stroke} />
  </>
);

const Lines = ({ fill = '#EAF0F6' }: { fill?: string }) => (
  <>
    <rect x="34" y="150" width="86" height="6" rx="3" fill={fill} fillOpacity=".12" />
    <rect x="34" y="164" width="56" height="6" rx="3" fill={fill} fillOpacity=".08" />
  </>
);

export function CardArt({ slug, className }: { slug: string; className?: string }) {
  const box = '0 0 340 214';

  if (slug === 'black-matte-gold-nfc-card') {
    return (
      <svg viewBox={box} className={className} aria-hidden="true">
        <rect x="2" y="2" width="336" height="210" rx="18" fill="url(#ca-matte)" />
        <rect x="2.75" y="2.75" width="334.5" height="208.5" rx="17.5" fill="none" stroke="url(#ca-gold)" strokeWidth="1.6" />
        <TapRing stroke="url(#ca-gold)" />
        <circle cx="245" cy="152" r="3.4" fill="#D9B06A" />
        <Wordmark fill="url(#ca-gold)" opacity={1} />
        <Lines />
      </svg>
    );
  }

  if (slug === 'signature-portrait-nfc-card') {
    // a matte card with a portrait panel: a head and shoulders silhouette
    // rather than a stock face, since the real one is the customer's own
    return (
      <svg viewBox="0 0 320 200" className={className} role="img" aria-label="Matte card printed with your photograph">
        <rect x="8" y="8" width="304" height="184" rx="16" fill="#15181E" stroke="#333A46" />
        <rect x="26" y="30" width="104" height="140" rx="10" fill="#0D1015" stroke="#3A424F" />
        <circle cx="78" cy="86" r="24" fill="#232A34" />
        <path d="M46 156c0-19 14-31 32-31s32 12 32 31z" fill="#232A34" />
        <rect x="148" y="44" width="120" height="9" rx="4.5" fill="#E6EAF0" opacity=".9" />
        <rect x="148" y="64" width="88" height="7" rx="3.5" fill="#7E8899" />
        <rect x="148" y="82" width="66" height="7" rx="3.5" fill="#5D6675" />
        <g stroke="#34E0F0" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".85">
          <path d="M250 140a10 10 0 0 1 0 14" />
          <path d="M258 132a21 21 0 0 1 0 30" />
          <circle cx="243" cy="147" r="2.6" fill="#34E0F0" stroke="none" />
        </g>
      </svg>
    );
  }

  if (slug === 'premium-metal-nfc-card') {
    return (
      <svg viewBox={box} className={className} aria-hidden="true">
        <rect x="2" y="2" width="336" height="210" rx="16" fill="url(#ca-metal)" />
        <rect x="8" y="8" width="324" height="198" rx="12" fill="none" stroke="#05070A" strokeOpacity=".38" strokeWidth="1.2" />
        <rect x="2.75" y="2.75" width="334.5" height="208.5" rx="15.5" fill="none" stroke="#EDF2F7" strokeOpacity=".55" strokeWidth="1.5" />
        <TapRing stroke="#0B0E14" />
        <Wordmark fill="#0B0E14" opacity={0.7} />
        <Lines fill="#0B0E14" />
      </svg>
    );
  }

  if (slug === 'google-review-card') {
    return (
      <svg viewBox={box} className={className} aria-hidden="true">
        <rect x="2" y="2" width="336" height="210" rx="18" fill="url(#ca-review)" />
        <rect x="2.75" y="2.75" width="334.5" height="208.5" rx="17.5" fill="none" stroke="#33405A" strokeWidth="1.5" />
        <g fill="#D9B06A">
          {[60, 108, 156, 204, 252].map((x) => (
            <path
              key={x}
              d={`M${x} 66l6.5 13.2 14.6 2.1-10.5 10.3 2.5 14.5L${x} 99.3l-13.1 6.8 2.5-14.5-10.5-10.3 14.6-2.1z`}
            />
          ))}
        </g>
        <text x="170" y="150" textAnchor="middle" fontFamily="var(--display)" fontSize="20" fontWeight="700" letterSpacing="-.4" fill="#EAF0F6" fillOpacity=".9">
          Review us on Google
        </text>
        <text x="170" y="176" textAnchor="middle" fontFamily="var(--mono)" fontSize="11" letterSpacing="1.6" fill="#34E0F0" fillOpacity=".8">
          TAP OR SCAN
        </text>
      </svg>
    );
  }

  if (slug === 'google-review-stand') {
    return (
      <svg viewBox={box} className={className} aria-hidden="true">
        <ellipse cx="170" cy="188" rx="96" ry="10" fill="#000" fillOpacity=".45" />
        <path d="M118 44 L232 44 L246 158 L104 158 Z" fill="url(#ca-stand)" stroke="#33405A" strokeWidth="1.4" />
        <path d="M104 158 L246 158 L258 176 L92 176 Z" fill="#161B24" stroke="#33405A" strokeWidth="1.2" />
        <g transform="translate(175,104)" fill="none" stroke="#34E0F0" strokeOpacity=".85" strokeWidth="3.4" strokeLinecap="round">
          <path d="M0 -15a14 14 0 0 1 0 30" />
          <path d="M10 -26a25 25 0 0 1 0 52" />
        </g>
        <circle cx="167" cy="104" r="3.8" fill="#34E0F0" />
        <text x="175" y="66" textAnchor="middle" fontFamily="var(--display)" fontSize="15" fontWeight="700" letterSpacing="-.3" fill="#EAF0F6" fillOpacity=".85">
          Rate us
        </text>
        <text x="175" y="142" textAnchor="middle" fontFamily="var(--mono)" fontSize="9.5" letterSpacing="1.4" fill="#34E0F0" fillOpacity=".75">
          TAP HERE
        </text>
      </svg>
    );
  }

  if (slug === 'instagram-nfc-card') {
    return (
      <svg viewBox={box} className={className} aria-hidden="true">
        <rect x="2" y="2" width="336" height="210" rx="18" fill="url(#ca-igface)" />
        <rect x="2.75" y="2.75" width="334.5" height="208.5" rx="17.5" fill="none" stroke="url(#ca-ig)" strokeWidth="2" />
        <g transform="translate(170,100)">
          <rect x="-28" y="-28" width="56" height="56" rx="16" fill="none" stroke="url(#ca-ig)" strokeWidth="5" />
          <circle cx="0" cy="0" r="13" fill="none" stroke="url(#ca-ig)" strokeWidth="5" />
          <circle cx="17" cy="-17" r="3.4" fill="url(#ca-ig)" />
        </g>
        <text x="170" y="161" textAnchor="middle" fontFamily="var(--display)" fontSize="18" fontWeight="600" letterSpacing="-.3" fill="#EAF0F6" fillOpacity=".82">
          @yourhandle
        </text>
      </svg>
    );
  }

  if (slug === 'annual-renewal') {
    return (
      <svg viewBox={box} className={className} aria-hidden="true">
        <rect x="2" y="2" width="336" height="210" rx="18" fill="url(#ca-classic)" />
        <rect x="2.75" y="2.75" width="334.5" height="208.5" rx="17.5" fill="none" stroke="rgba(52,224,240,.4)" strokeWidth="1.5" />
        <g transform="translate(170,96)" fill="none" stroke="#34E0F0" strokeWidth="4" strokeLinecap="round">
          <path d="M28 0a28 28 0 1 1-8.2-19.8" />
          <path d="M28 -22v22h-22" />
        </g>
        <text x="170" y="164" textAnchor="middle" fontFamily="var(--display)" fontSize="19" fontWeight="700" letterSpacing="-.4" fill="#EAF0F6" fillOpacity=".9">
          One more year
        </text>
      </svg>
    );
  }

  // classic, and anything new the admin adds
  return (
    <svg viewBox={box} className={className} aria-hidden="true">
      <rect x="2" y="2" width="336" height="210" rx="18" fill="url(#ca-classic)" />
      <rect x="2.75" y="2.75" width="334.5" height="208.5" rx="17.5" fill="none" stroke="#33405A" strokeWidth="1.5" />
      <TapRing />
      <Wordmark opacity={0.88} />
      <Lines />
    </svg>
  );
}
