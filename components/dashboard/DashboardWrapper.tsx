'use client';

import { useState } from 'react';
import Breadcrumbs from '@/components/dashboard/Breadcrumbs';
import DashboardNav from '@/components/dashboard/DashboardNav';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import { SkipToMainContent } from '@/components/SkipToMainContent';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';

interface DashboardWrapperProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
  children: React.ReactNode;
}

export default function DashboardWrapper({ user, children }: DashboardWrapperProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Enable keyboard navigation
  useKeyboardNavigation([
    {
      key: 'b',
      ctrl: true,
      action: () => setIsSidebarCollapsed(!isSidebarCollapsed),
      description: 'Toggle sidebar',
    },
  ]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <>
      {/* Skip to main content link for accessibility */}
      <SkipToMainContent />

      {/* Top Navigation */}
      <DashboardNav user={user} onMenuClick={toggleSidebar} />

      <div className="flex h-screen pt-[64px]">
        {/* Sidebar */}
        <DashboardSidebar
          userRole={user.role}
          isOpen={isSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          onClose={() => setIsSidebarOpen(false)}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Main Content - Adjust margin based on sidebar state */}
        <main
          id="main-content"
          className={`flex-1 overflow-y-auto transition-all duration-300 ${
            isSidebarCollapsed ? 'sm:ml-16' : 'sm:ml-64'
          }`}
          role="main"
          aria-label="Main content"
        >
          <div className="p-8">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-gray-900 bg-opacity-50 sm:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </>
  );
}
