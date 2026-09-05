import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, Manrope, JetBrains_Mono } from 'next/font/google';
import { env } from '@/lib/env';
import { ToastProvider } from '@/components/Toast';
import './globals.css';
import './app.css';

const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
  display: 'swap',
});
const body = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: 'NFCY. Your digital identity. One tap away.',
    template: '%s · NFCY',
  },
  description:
    'One NFC card that opens your whole profile. Contact, business, socials, products and location, shared in one tap and changed from your phone. Cards from ₹499.',
  openGraph: {
    type: 'website',
    siteName: 'NFCY',
    url: env.appUrl,
  },
  twitter: { card: 'summary_large_image' },
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23090B10'/%3E%3Cg fill='none' stroke='%2334E0F0' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M12 10a8 8 0 0 1 0 12'/%3E%3Cpath d='M17 7a13 13 0 0 1 0 18'/%3E%3C/g%3E%3Ccircle cx='9' cy='16' r='2' fill='%2334E0F0'/%3E%3C/svg%3E",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#090B10',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="lit">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
