import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GlobalAi Payee - Universal AI + Blockchain Wallet',
  description: 'A universal AI + Blockchain-powered wallet that works globally with location-based detection, automatic currency conversion, and seamless offline + online transactions.',
  keywords: ['blockchain', 'wallet', 'ai', 'payments', 'crypto', 'fintech', 'global', 'currency'],
  authors: [{ name: 'GlobalAi Payee Team' }],
  creator: 'GlobalAi Payee',
  publisher: 'GlobalAi Payee',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'GlobalAi Payee - Universal AI + Blockchain Wallet',
    description: 'A universal AI + Blockchain-powered wallet that works globally with location-based detection, automatic currency conversion, and seamless offline + online transactions.',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    siteName: 'GlobalAi Payee',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'GlobalAi Payee',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GlobalAi Payee - Universal AI + Blockchain Wallet',
    description: 'A universal AI + Blockchain-powered wallet that works globally with location-based detection, automatic currency conversion, and seamless offline + online transactions.',
    images: ['/og-image.png'],
    creator: '@globalaipayee',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_VERIFICATION_ID,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ErrorBoundary>
          <Providers>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#22c55e',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}