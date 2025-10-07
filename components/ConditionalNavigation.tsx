'use client';

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';

export default function ConditionalNavigation() {
  const pathname = usePathname();

  // Don't show main navigation on dashboard pages
  if (pathname.startsWith('/dashboard')) {
    return null;
  }

  return <Navigation />;
}
