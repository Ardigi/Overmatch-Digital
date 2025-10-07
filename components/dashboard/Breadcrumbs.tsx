'use client';

import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Breadcrumbs() {
  const pathname = usePathname();

  // Generate breadcrumb items from pathname
  const generateBreadcrumbs = () => {
    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs = [];

    // Always include home
    breadcrumbs.push({
      name: 'Dashboard',
      href: '/dashboard',
      icon: HomeIcon,
    });

    // Build breadcrumb trail
    let currentPath = '/dashboard';
    for (let i = 1; i < paths.length; i++) {
      currentPath += `/${paths[i]}`;

      // Format the name (convert kebab-case to Title Case)
      const name = paths[i]
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      breadcrumbs.push({
        name,
        href: currentPath,
      });
    }

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    // Don't show breadcrumbs on the dashboard home page
    return null;
  }

  return (
    <nav className="flex mb-4" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-3">
        {breadcrumbs.map((breadcrumb, index) => (
          <li key={breadcrumb.href} className="inline-flex items-center">
            {index > 0 && <ChevronRightIcon className="w-4 h-4 text-gray-400 mx-1" />}
            {index === breadcrumbs.length - 1 ? (
              // Current page
              <span className="text-sm font-medium text-gray-500">
                {breadcrumb.icon && <breadcrumb.icon className="w-4 h-4 mr-2 inline" />}
                {breadcrumb.name}
              </span>
            ) : (
              // Clickable breadcrumb
              <Link
                href={breadcrumb.href}
                className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-primary-600"
              >
                {breadcrumb.icon && <breadcrumb.icon className="w-4 h-4 mr-2" />}
                {breadcrumb.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
