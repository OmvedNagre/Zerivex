import type { Metadata } from 'next';
import '@/styles/globals.css';
import { AuthProvider } from '@/components/auth/AuthProvider';

export const metadata: Metadata = {
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
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
