import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ConditionalFooter from '@/components/ConditionalFooter';
import ConditionalNavigation from '@/components/ConditionalNavigation';
import { ToastProvider } from '@/contexts/ToastContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Overmatch Digital - SOC 1/SOC 2 Compliance & Cybersecurity Services',
  description:
    'Expert cybersecurity and CPA partnership services for SOC 1 and SOC 2 compliance audits. Comprehensive compliance management solutions for your organization.',
  keywords:
    'SOC 1, SOC 2, compliance audit, cybersecurity, CPA services, Trust Services Criteria, security audit',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>
        <ToastProvider>
          <ConditionalNavigation />
          <main className="min-h-screen">{children}</main>
          <ConditionalFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
