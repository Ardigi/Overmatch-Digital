'use client';

import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  LockClosedIcon,
  PaperClipIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Thread {
  id: string;
  subject: string;
  type: 'question' | 'finding' | 'general' | 'urgent';
  status: 'open' | 'resolved' | 'waiting';
  participants: string[];
  lastMessage: {
    author: string;
    content: string;
    timestamp: string;
  };
  unreadCount: number;
  hasAttachments: boolean;
  isEncrypted: boolean;
  relatedControl?: string;
}

const threads: Thread[] = [
  {
    id: '1',
    subject: 'Access Control Policy Clarification',
    type: 'question',
    status: 'open',
    participants: ['Sarah Johnson', 'Emily Rodriguez'],
    lastMessage: {
      author: 'Sarah Johnson',
      content:
        'Could you provide more details about the password rotation policy for privileged accounts?',
      timestamp: '10 minutes ago',
    },
    unreadCount: 2,
    hasAttachments: false,
    isEncrypted: true,
    relatedControl: 'AC-2',
  },
  {
    id: '2',
    subject: 'Missing Evidence: Q3 Security Training Records',
    type: 'finding',
    status: 'waiting',
    participants: ['Michael Chen', 'David Kim'],
    lastMessage: {
      author: 'Michael Chen',
      content:
        'We need the security awareness training completion records for Q3. The deadline is approaching.',
      timestamp: '1 hour ago',
    },
    unreadCount: 0,
    hasAttachments: true,
    isEncrypted: true,
    relatedControl: 'AT-2',
  },
  {
    id: '3',
    subject: 'Incident Response Plan Review',
    type: 'urgent',
    status: 'open',
    participants: ['Sarah Johnson', 'Emily Rodriguez', 'David Kim'],
    lastMessage: {
      author: 'Emily Rodriguez',
      content:
        "I've uploaded the updated incident response plan. Please review sections 3.2 and 4.1.",
      timestamp: '2 hours ago',
    },
    unreadCount: 1,
    hasAttachments: true,
    isEncrypted: true,
    relatedControl: 'IR-8',
  },
  {
    id: '4',
    subject: 'Audit Schedule Discussion',
    type: 'general',
    status: 'resolved',
    participants: ['Sarah Johnson', 'Michael Chen'],
    lastMessage: {
      author: 'Sarah Johnson',
      content: "Great, let's proceed with the agreed timeline. I'll send calendar invites.",
      timestamp: 'Yesterday',
    },
    unreadCount: 0,
    hasAttachments: false,
    isEncrypted: true,
  },
];

const typeIcons = {
  question: QuestionMarkCircleIcon,
  finding: ExclamationCircleIcon,
  general: ChatBubbleLeftRightIcon,
  urgent: ExclamationCircleIcon,
};

const typeColors = {
  question: 'text-blue-600 bg-blue-100',
  finding: 'text-yellow-600 bg-yellow-100',
  general: 'text-gray-600 bg-gray-100',
  urgent: 'text-red-600 bg-red-100',
};

const statusBadges = {
  open: { text: 'Open', color: 'bg-green-100 text-green-800' },
  resolved: { text: 'Resolved', color: 'bg-gray-100 text-gray-800' },
  waiting: { text: 'Waiting', color: 'bg-yellow-100 text-yellow-800' },
};

export default function ActiveThreads() {
  const router = useRouter();
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'urgent'>('all');

  const filteredThreads = threads.filter((thread) => {
    if (filter === 'all') return true;
    if (filter === 'open') return thread.status === 'open';
    if (filter === 'urgent') return thread.type === 'urgent';
    return true;
  });

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Active Discussions</h2>
            <p className="mt-1 text-sm text-gray-500">
              Secure communication threads with your audit team
            </p>
          </div>
          <button
            className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 min-h-[44px]"
            aria-label="Start new discussion thread"
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4 mr-1.5" />
            New Thread
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex space-x-2">
          {['all', 'open', 'urgent'].map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption as typeof filter)}
              className={`px-4 py-2 rounded-md text-sm font-medium min-h-[40px] ${
                filter === filterOption
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              role="tab"
              aria-selected={filter === filterOption}
              aria-label={`Filter by ${filterOption} threads`}
            >
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {filteredThreads.map((thread) => {
          const Icon = typeIcons[thread.type];

          return (
            <div
              key={thread.id}
              className="px-6 py-4 hover:bg-gray-50 cursor-pointer focus-within:bg-gray-50"
              onClick={() => router.push(`/dashboard/collaboration/thread/${thread.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  router.push(`/dashboard/collaboration/thread/${thread.id}`);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Open thread: ${thread.subject}`}
            >
              <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg ${typeColors[thread.type]}`}>
                  <Icon className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 flex items-center">
                        {thread.subject}
                        {thread.isEncrypted && (
                          <LockClosedIcon className="h-3.5 w-3.5 ml-1 text-gray-400" />
                        )}
                      </h3>
                      <div className="mt-1 flex items-center space-x-2 text-xs">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${statusBadges[thread.status].color}`}
                        >
                          {statusBadges[thread.status].text}
                        </span>
                        {thread.relatedControl && (
                          <span className="text-gray-500">Control: {thread.relatedControl}</span>
                        )}
                      </div>
                    </div>
                    {thread.unreadCount > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        {thread.unreadCount} new
                      </span>
                    )}
                  </div>

                  <div className="mt-2">
                    <p className="text-sm text-gray-600 line-clamp-2">
                      <span className="font-medium">{thread.lastMessage.author}:</span>{' '}
                      {thread.lastMessage.content}
                    </p>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      <span>{thread.participants.length} participants</span>
                      {thread.hasAttachments && (
                        <span className="flex items-center">
                          <PaperClipIcon className="h-3 w-3 mr-0.5" />
                          Attachments
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{thread.lastMessage.timestamp}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredThreads.length === 0 && (
        <div className="px-6 py-12 text-center">
          <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">No threads match your filter</p>
        </div>
      )}
    </div>
  );
}
