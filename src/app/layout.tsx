import type { Metadata } from 'next';
import '@/styles/globals.css';
import '@/styles/customer-ui.css';
import { Toaster } from '@/components/ui/Toast';
import { ConfirmationProvider } from '@/components/ui/ConfirmationProvider';
import { AuthProvider } from '@/components/auth/AuthProvider';

export const metadata: Metadata = {
  metadataBase: new URL('https://zerivex.tech'),
  title: 'Zerivex — Security for Software Built with AI',
  description: 'Independent application-security verification and continuous monitoring for software built with AI.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: 'var(--ds-bg-page)', color: 'var(--ds-text-primary)' }}>
        <AuthProvider>
          <ConfirmationProvider>{children}</ConfirmationProvider>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
