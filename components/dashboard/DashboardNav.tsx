'use client';

import { Menu, Transition } from '@headlessui/react';
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  Cog6ToothIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { Fragment } from 'react';

interface DashboardNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  onMenuClick?: () => void;
}

export default function DashboardNav({ user, onMenuClick }: DashboardNavProps) {
  return (
    <nav className="fixed top-0 z-50 w-full bg-white border-b border-gray-200">
      <div className="px-3 py-3 lg:px-5 lg:pl-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-start">
            <button
              onClick={onMenuClick}
              type="button"
              className="inline-flex items-center p-2 text-sm text-gray-500 rounded-lg sm:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <span className="sr-only">Open sidebar</span>
              <Bars3Icon className="w-6 h-6" />
            </button>
            <Link href="/" className="flex ml-2 md:mr-24">
              <span className="self-center text-xl font-semibold sm:text-2xl whitespace-nowrap">
                <span className="text-primary-600">Overmatch</span>{' '}
                <span className="text-black">Digital</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center">
            {/* Notifications - Meets Fitts's Law (44x44px) */}
            <button
              type="button"
              className="relative p-3 text-gray-400 hover:text-gray-500 hover:bg-gray-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              aria-label="View notifications"
            >
              <BellIcon className="h-6 w-6" />
              <span
                className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-400"
                aria-label="New notifications"
              ></span>
            </button>

            {/* Profile dropdown - Larger touch target */}
            <div className="ml-3">
              <Menu as="div" className="relative">
                <Menu.Button className="flex items-center p-1.5 text-sm bg-white rounded-full hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                  <span className="sr-only">Open user menu</span>
                  {user.image ? (
                    <img
                      className="h-10 w-10 rounded-full"
                      src={user.image}
                      alt={user.name || 'User'}
                    />
                  ) : (
                    <UserCircleIcon className="h-10 w-10 text-gray-400" />
                  )}
                </Menu.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="origin-top-right absolute right-0 mt-2 w-56 rounded-lg shadow-lg py-2 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/dashboard/profile"
                          className={`${
                            active ? 'bg-gray-50' : ''
                          } block px-4 py-3 text-base text-gray-700 hover:text-gray-900 transition-colors`}
                        >
                          <span className="flex items-center">
                            <UserCircleIcon className="h-5 w-5 mr-3 text-gray-400" />
                            Your Profile
                          </span>
                        </Link>
                      )}
                    </Menu.Item>
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href="/dashboard/settings"
                          className={`${
                            active ? 'bg-gray-50' : ''
                          } block px-4 py-3 text-base text-gray-700 hover:text-gray-900 transition-colors`}
                        >
                          <span className="flex items-center">
                            <Cog6ToothIcon className="h-5 w-5 mr-3 text-gray-400" />
                            Settings
                          </span>
                        </Link>
                      )}
                    </Menu.Item>
                    <hr className="my-2 border-gray-200" />
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() => signOut({ callbackUrl: '/' })}
                          className={`${
                            active ? 'bg-gray-50' : ''
                          } block w-full text-left px-4 py-3 text-base text-gray-700 hover:text-gray-900 transition-colors`}
                        >
                          <span className="flex items-center">
                            <ArrowRightOnRectangleIcon className="h-5 w-5 mr-3 text-gray-400" />
                            Sign out
                          </span>
                        </button>
                      )}
                    </Menu.Item>
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
