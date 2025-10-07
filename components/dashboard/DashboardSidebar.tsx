'use client';

import {
  BeakerIcon,
  BoltIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ChartBarIcon,
  ChartPieIcon,
  ChatBubbleLeftRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  DocumentCheckIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  readOnly?: boolean; // Indicates if this is view-only for clients
  clientView?: boolean; // Shows this is a client-specific view
}

interface NavCategory {
  name: string;
  items: NavItem[];
}

// Navigation structure with proper SOC compliance role-based visibility
// Client role sees only relevant compliance features
const navigation: NavCategory[] = [
  {
    name: 'Main',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
      { name: 'Tasks', href: '/dashboard/tasks', icon: ClipboardDocumentCheckIcon },
      { name: 'Messages', href: '/dashboard/collaboration', icon: ChatBubbleLeftRightIcon },
    ],
  },
  {
    name: 'Compliance',
    items: [
      { name: 'Audit Status', href: '/dashboard/projects', icon: FolderIcon, readOnly: true },
      { name: 'Policies', href: '/dashboard/policies', icon: DocumentTextIcon, readOnly: true },
      { name: 'Controls', href: '/dashboard/controls', icon: ShieldCheckIcon, readOnly: true },
      { name: 'Evidence', href: '/dashboard/evidence', icon: DocumentDuplicateIcon },
      {
        name: 'Testing',
        href: '/dashboard/testing',
        icon: BeakerIcon,
        roles: ['team', 'AUDITOR', 'ADMIN', 'SUPER_ADMIN'],
      },
    ],
  },
  {
    name: 'Issues & Risks',
    items: [
      {
        name: 'Risk Register',
        href: '/dashboard/risks',
        icon: ExclamationTriangleIcon,
        readOnly: true,
      },
      { name: 'Findings', href: '/dashboard/findings', icon: ExclamationTriangleIcon },
      {
        name: 'Monitoring',
        href: '/dashboard/monitoring',
        icon: BoltIcon,
        roles: ['team', 'ADMIN', 'SUPER_ADMIN'],
      },
    ],
  },
  {
    name: 'Reports',
    items: [
      {
        name: 'Compliance Reports',
        href: '/dashboard/reports',
        icon: ChartBarIcon,
        clientView: true,
      },
      {
        name: 'Analytics',
        href: '/dashboard/analytics',
        icon: ChartPieIcon,
        roles: ['team', 'ADMIN', 'SUPER_ADMIN'],
      },
    ],
  },
  {
    name: 'Account',
    items: [
      { name: 'Billing', href: '/dashboard/billing', icon: CurrencyDollarIcon, clientView: true },
      { name: 'Team', href: '/dashboard/users', icon: UsersIcon, clientView: true },
      { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon, clientView: true },
    ],
  },
  {
    name: 'Audit Management', // Team-only features
    items: [
      {
        name: 'Workpapers',
        href: '/dashboard/workpapers',
        icon: DocumentCheckIcon,
        roles: ['team', 'AUDITOR', 'ADMIN', 'SUPER_ADMIN'],
      },
      {
        name: 'Project Timeline',
        href: '/dashboard/timeline',
        icon: CalendarIcon,
        roles: ['team', 'ADMIN', 'SUPER_ADMIN'],
      },
      {
        name: 'Audit Trails',
        href: '/dashboard/audit-logs',
        icon: MagnifyingGlassIcon,
        roles: ['team', 'ADMIN', 'SUPER_ADMIN'],
      },
    ],
  },
  {
    name: 'Business Operations', // Only visible to team members
    items: [
      {
        name: 'All Clients',
        href: '/dashboard/clients',
        icon: BuildingOfficeIcon,
        roles: ['team', 'ADMIN', 'SUPER_ADMIN'],
      },
      {
        name: 'Sales Pipeline',
        href: '/dashboard/sales',
        icon: ChartPieIcon,
        roles: ['team', 'ADMIN', 'SUPER_ADMIN'],
      },
      {
        name: 'Partners',
        href: '/dashboard/partners',
        icon: UserGroupIcon,
        roles: ['team', 'ADMIN', 'SUPER_ADMIN'],
      },
      {
        name: 'Business Analytics',
        href: '/dashboard/analytics/business',
        icon: ChartBarIcon,
        roles: ['team', 'ADMIN', 'SUPER_ADMIN'],
      },
      {
        name: 'System Admin',
        href: '/dashboard/admin',
        icon: Cog6ToothIcon,
        roles: ['ADMIN', 'SUPER_ADMIN'],
      },
    ],
  },
];

interface DashboardSidebarProps {
  userRole?: string;
  isOpen?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}

export default function DashboardSidebar({
  userRole,
  isOpen = false,
  isCollapsed = false,
  onClose,
  onToggleCollapse,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  const isItemActive = (href: string) => {
    // Exact match for dashboard root
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    // For other routes, check exact match or subpaths
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Progressive disclosure: Start with only essential categories expanded
  // This follows Miller's Law by reducing cognitive load
  const getInitialCollapsedState = () => {
    const collapsed = new Set<string>();
    // Keep only Main and current active category expanded
    navigation.forEach((category) => {
      if (category.name !== 'Main') {
        const hasActiveItem = category.items.some((item) => isItemActive(item.href));
        if (!hasActiveItem) {
          collapsed.add(category.name);
        }
      }
    });
    return collapsed;
  };

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    getInitialCollapsedState()
  );

  const toggleCategory = (categoryName: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(categoryName)) {
      newCollapsed.delete(categoryName);
    } else {
      newCollapsed.add(categoryName);
    }
    setCollapsedCategories(newCollapsed);
  };

  const filterItemsByRole = (items: NavItem[]) => {
    return items.filter((item) => {
      if (!item.roles) return true;
      return item.roles.includes(userRole || '');
    });
  };

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen pt-20 transition-all duration-300 bg-white border-r border-gray-200 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } sm:translate-x-0 ${isCollapsed ? 'w-16' : 'w-64'}`}
    >
      {/* Collapse Toggle Button - Meets Fitts's Law (44x44px minimum) */}
      <button
        onClick={onToggleCollapse}
        className="hidden sm:flex absolute top-20 -right-5 z-50 w-11 h-11 items-center justify-center bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronDoubleRightIcon className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronDoubleLeftIcon className="w-5 h-5 text-gray-600" />
        )}
      </button>

      <div className={`h-full ${isCollapsed ? 'px-2' : 'px-3'} pb-4 overflow-y-auto bg-white`}>
        <nav className="space-y-2">
          {navigation.map((category) => {
            const filteredItems = filterItemsByRole(category.items);
            if (filteredItems.length === 0) return null;

            const isCategoryCollapsed = collapsedCategories.has(category.name);
            const hasActiveItem = filteredItems.some((item) => isItemActive(item.href));

            return (
              <div key={category.name} className="space-y-1">
                {!isCollapsed && (
                  <button
                    onClick={() => toggleCategory(category.name)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset ${
                      hasActiveItem
                        ? 'text-primary-700 bg-primary-50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                    aria-expanded={!isCategoryCollapsed}
                    aria-controls={`category-${category.name}`}
                  >
                    <span>{category.name}</span>
                    <ChevronRightIcon
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isCategoryCollapsed ? '' : 'rotate-90'
                      }`}
                    />
                  </button>
                )}
                {(!isCategoryCollapsed || isCollapsed) && (
                  <ul
                    className={`space-y-1 ${isCollapsed ? '' : 'ml-2'}`}
                    id={`category-${category.name}`}
                  >
                    {filteredItems.map((item) => {
                      const isActive = isItemActive(item.href);

                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            className={`flex items-center ${isCollapsed ? 'justify-center px-2 py-3' : 'px-3 py-2.5'} rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset ${
                              isActive
                                ? 'text-white bg-primary-600 shadow-sm'
                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                            title={isCollapsed ? item.name : undefined}
                            aria-current={isActive ? 'page' : undefined}
                          >
                            <item.icon
                              className={`${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'} flex-shrink-0 ${
                                isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'
                              }`}
                              aria-hidden="true"
                            />
                            {!isCollapsed && (
                              <>
                                <span className="ml-3 text-sm font-medium flex-1">{item.name}</span>
                                {/* Show read-only badge for clients */}
                                {item.readOnly && userRole === 'client' && (
                                  <span
                                    className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                      isActive
                                        ? 'bg-primary-500 text-white'
                                        : 'bg-gray-200 text-gray-600'
                                    }`}
                                  >
                                    View Only
                                  </span>
                                )}
                              </>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Organization Selector - Only for team members, hide when collapsed */}
        {!isCollapsed && userRole && userRole !== 'client' && (
          <div className="pt-4 mt-4 space-y-2 border-t border-gray-200">
            <div className="px-3 py-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Organization
              </p>
              <select className="mt-2 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md">
                <option>Acme Corp</option>
                <option>TechStart Inc</option>
                <option>Global Finance</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
