type P = { className?: string };

const s = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const wrap = (children: React.ReactNode) => (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={p.className} {...s}>
    {children}
  </svg>
);

export const IconHome = wrap(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5" /></>);
export const IconUser = wrap(<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></>);
export const IconCard = wrap(<><rect x="2.5" y="5" width="19" height="14" rx="3" /><path d="M2.5 10h19" /><path d="M6 15h4" /></>);
export const IconChart = wrap(<><path d="M3 21h18" /><rect x="4.5" y="12" width="3.6" height="6" rx="1" /><rect x="10.2" y="7" width="3.6" height="11" rx="1" /><rect x="15.9" y="9.5" width="3.6" height="8.5" rx="1" /></>);
export const IconBox = wrap(<><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></>);
export const IconInbox = wrap(<><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M4.5 6h15l1.5 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" /></>);
export const IconRefresh = wrap(<><path d="M20 11a8 8 0 1 0-.6 4" /><path d="M20 5v6h-6" /></>);
export const IconCog = wrap(<><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>);
export const IconUsers = wrap(<><circle cx="9" cy="8" r="3.6" /><path d="M2.5 21c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8" /><path d="M17 4.6a3.6 3.6 0 0 1 0 6.9M18.5 15.6c2 .8 3.5 2.6 3.5 5.4" /></>);
export const IconTag = wrap(<><path d="M3 12.6V4a1 1 0 0 1 1-1h8.6a1 1 0 0 1 .7.3l7.4 7.4a1 1 0 0 1 0 1.4l-8.6 8.6a1 1 0 0 1-1.4 0L3.3 13.3a1 1 0 0 1-.3-.7z" /><circle cx="7.8" cy="7.8" r="1.4" fill="currentColor" stroke="none" /></>);
export const IconShield = wrap(<><path d="M12 3 4.5 6v6c0 4.6 3.1 7.9 7.5 9 4.4-1.1 7.5-4.4 7.5-9V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></>);
export const IconTruck = wrap(<><path d="M2.5 6.5h11v10h-11z" /><path d="M13.5 10h4l3 3v3.5h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>);
export const IconBell = wrap(<><path d="M18 9a6 6 0 0 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9" /><path d="M10.3 19a2 2 0 0 0 3.4 0" /></>);
export const IconQr = wrap(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14h1M14 20h3M20 17v4" /></>);
export const IconLink = wrap(<><path d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.4 1.4" /><path d="M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.4-1.4" /></>);
export const IconPhone = wrap(<><path d="M6.5 3h3l1.5 4-2 1.4a12 12 0 0 0 5.6 5.6L16 12l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3z" /></>);
export const IconMail = wrap(<><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></>);
export const IconMap = wrap(<><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11" /><circle cx="12" cy="10" r="2.6" /></>);
export const IconGlobe = wrap(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18" /></>);
export const IconPlus = wrap(<><path d="M12 5v14M5 12h14" /></>);
export const IconTrash = wrap(<><path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" /><path d="M6.5 7 7.5 20h9L17.5 7" /></>);
export const IconCheck = wrap(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconStar = wrap(<path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />);
export const IconCake = wrap(<><path d="M4 20h16" /><path d="M5 20v-6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V20" /><path d="M5 15.5c1.6 0 1.6 1.2 3.2 1.2s1.6-1.2 3.3-1.2 1.6 1.2 3.2 1.2 1.7-1.2 3.3-1.2" /><path d="M12 11.5V8.5" /><path d="M12 6.2c.9-.8.6-2-.6-2.7.9 1 .1 1.9.6 2.7" /></>);
export const IconDownload = wrap(<><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5" /><path d="M4 20h16" /></>);
export const IconExternal = wrap(<><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" /></>);
export const IconCopy = wrap(<><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 5.5v-1a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1" /></>);
export const IconWhatsApp = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={p.className} fill="currentColor">
    <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2m0 1.8a8.2 8.2 0 1 1-4.2 15.2l-.3-.2-3 .8.8-3-.2-.3A8.2 8.2 0 0 1 12 3.8m-3.1 4c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.4 1.1 2.6c.1.2 1.8 2.8 4.4 3.8 2.2.9 2.6.7 3.1.7s1.5-.6 1.7-1.2c.2-.6.2-1.1.1-1.2l-.6-.3-1.6-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-2-1.2 7.3 7.3 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.5.3-.5v-.5l-.8-1.9c-.2-.4-.4-.4-.6-.4z" />
  </svg>
);
export const IconInstagram = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={p.className} {...s}>
    <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);
export const IconFacebook = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={p.className} fill="currentColor">
    <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6A22 22 0 0 0 14.3 3.5c-2.4 0-4 1.45-4 4.1v2.3H7.6V13h2.7v8z" />
  </svg>
);
export const IconLinkedIn = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={p.className} fill="currentColor">
    <path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0 0-5M3 9.5h4V21H3zM9.5 9.5h3.8v1.6a4.2 4.2 0 0 1 3.7-2c3 0 4 2 4 5V21h-4v-6c0-1.5-.5-2.5-1.9-2.5s-2 1-2 2.4V21h-3.6z" />
  </svg>
);
export const IconYouTube = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={p.className} fill="currentColor">
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8M10 15V9l5.2 3z" />
  </svg>
);
export const IconX = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={p.className} fill="currentColor">
    <path d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.2l-4.9-6.4L5.1 21H2l7.3-8.3L2.4 3h6.4l4.4 5.8zm-1.1 16.1h1.7L7.7 4.8H5.9z" />
  </svg>
);
export const IconTelegram = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={p.className} fill="currentColor">
    <path d="M21.7 4.3 2.9 11.5c-.9.4-.9 1.1 0 1.4l4.7 1.5 1.8 5.5c.2.6.4.8 1 .8.5 0 .7-.2 1-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.5c.3-1.2-.5-1.8-1.5-1.4M8.4 13.9l9.8-6.2-8 7.1-.3 3.2z" />
  </svg>
);
export const IconPinterest = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={p.className} fill="currentColor">
    <path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.5 1.8-2.5.9 0 1.3.6 1.3 1.4 0 .9-.6 2.2-.9 3.4-.2 1 .5 1.9 1.5 1.9 1.9 0 3.2-2.4 3.2-5.2 0-2.2-1.5-3.8-4.1-3.8a4.8 4.8 0 0 0-5 4.8c0 .9.3 1.5.7 2 .2.2.2.3.1.6l-.2.8c-.1.3-.3.4-.5.3-1.4-.6-2.1-2.2-2.1-4C5.1 7.4 7.6 4 12.3 4c3.8 0 6.3 2.7 6.3 5.7 0 3.9-2.2 6.8-5.4 6.8-1.1 0-2.1-.6-2.4-1.3l-.7 2.6c-.2.9-.8 1.9-1.2 2.6A10 10 0 1 0 12 2" />
  </svg>
);
export const IconSnapchat = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={p.className} fill="currentColor">
    <path d="M12 2.4c2.8 0 4.6 2.2 4.6 5 0 .7-.1 1.6-.1 2.1.3.2.7.2 1 .1.5-.2 1.2.1 1.2.7 0 .5-.4.8-1.2 1.1-.5.2-1 .4-1 .8 0 .8 2 3 3.9 3.4.4.1.6.4.5.7-.2.7-1.5 1-2.5 1.2-.2 0-.3.2-.3.4-.1.3-.1.7-.3.9-.2.2-.6.2-1 .1-.5-.1-1-.2-1.7-.1-.7.1-1.3.5-1.9.9-.6.4-1.3.8-2.2.8s-1.6-.4-2.2-.8c-.6-.4-1.2-.8-1.9-.9-.7-.1-1.2 0-1.7.1-.4.1-.8.1-1-.1-.2-.2-.2-.6-.3-.9 0-.2-.1-.4-.3-.4-1-.2-2.3-.5-2.5-1.2-.1-.3.1-.6.5-.7 1.9-.4 3.9-2.6 3.9-3.4 0-.4-.5-.6-1-.8-.8-.3-1.2-.6-1.2-1.1 0-.6.7-.9 1.2-.7.3.1.7.1 1-.1 0-.5-.1-1.4-.1-2.1 0-2.8 1.8-5 4.6-5" />
  </svg>
);
export const IconThreads = (p: P) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={p.className} fill="currentColor">
    <path d="M16.4 11.3c-.1 0-.2-.1-.3-.1-.2-3.2-1.9-5-4.8-5-2.4 0-4.1 1.4-4.5 3.4l1.9.4c.3-1.3 1.2-2 2.6-2 1.6 0 2.6.9 2.8 2.7-.7-.1-1.4-.2-2.2-.2-2.7 0-4.5 1.5-4.4 3.6.1 1.9 1.7 3.2 3.8 3.2 1.9 0 3.2-.9 3.8-2.5.5.7.8 1.6.9 2.7l1.9-.3c-.2-1.7-.8-3-1.7-3.9.3-.6.4-1.3.2-2m-4.9 4.1c-.9 0-1.9-.4-1.9-1.4 0-.9.9-1.7 2.6-1.7.7 0 1.3.1 1.9.2-.2 1.9-1.2 2.9-2.6 2.9M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 18.2A8.2 8.2 0 1 1 12 3.8a8.2 8.2 0 0 1 0 16.4" />
  </svg>
);

export const SOCIAL_ICONS: Record<string, (p: P) => React.JSX.Element> = {
  instagram: IconInstagram,
  facebook: IconFacebook,
  linkedin: IconLinkedIn,
  youtube: IconYouTube,
  x: IconX,
  telegram: IconTelegram,
  pinterest: IconPinterest,
  snapchat: IconSnapchat,
  threads: IconThreads,
  whatsapp: IconWhatsApp,
  website: IconGlobe,
  custom: IconLink,
};

export const SOCIAL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  x: 'X',
  telegram: 'Telegram',
  pinterest: 'Pinterest',
  snapchat: 'Snapchat',
  threads: 'Threads',
  whatsapp: 'WhatsApp',
  website: 'Website',
  custom: 'Custom link',
};

/**
 * Icons referenced by name.
 *
 * A server component cannot hand a function to a client component: React has no
 * way to serialise it across that boundary. So navigation passes an icon NAME
 * and the client resolves it here.
 */
export const NAV_ICONS = {
  home: IconHome,
  user: IconUser,
  card: IconCard,
  chart: IconChart,
  box: IconBox,
  inbox: IconInbox,
  refresh: IconRefresh,
  cog: IconCog,
  users: IconUsers,
  tag: IconTag,
  shield: IconShield,
  truck: IconTruck,
  bell: IconBell,
  qr: IconQr,
  link: IconLink,
  star: IconStar,
} as const;

export type NavIconName = keyof typeof NAV_ICONS;
