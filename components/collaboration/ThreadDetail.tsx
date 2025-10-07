'use client';

import {
  ArrowLeftIcon,
  CheckBadgeIcon,
  DocumentIcon,
  ExclamationCircleIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Message {
  id: string;
  author: string;
  role: string;
  organization: string;
  content: string;
  timestamp: string;
  attachments?: Attachment[];
  isEncrypted: boolean;
  isCPA?: boolean;
}

interface Attachment {
  id: string;
  name: string;
  size: string;
  type: string;
}

interface ThreadDetailProps {
  threadId: string;
}

// Mock data - in a real app, this would be fetched from an API
const threadData = {
  id: '1',
  subject: 'Access Control Policy Clarification',
  status: 'open',
  priority: 'high',
  relatedControl: 'AC-2',
  participants: ['Sarah Johnson', 'Emily Rodriguez', 'Michael Chen'],
  messages: [
    {
      id: '1',
      author: 'Sarah Johnson',
      role: 'Lead CPA',
      organization: 'Johnson & Associates CPA',
      content:
        "Hi Emily, I'm reviewing the access control policies for the SOC 2 audit. Could you provide more details about the password rotation policy for privileged accounts? Specifically, I need to understand:\n\n1. The rotation frequency for admin accounts\n2. How password complexity is enforced\n3. Whether MFA is mandatory for all privileged users",
      timestamp: '2024-01-18 10:30 AM',
      isEncrypted: true,
      isCPA: true,
    },
    {
      id: '2',
      author: 'Emily Rodriguez',
      role: 'Compliance Specialist',
      organization: 'Your Organization',
      content:
        'Hi Sarah, thanks for reaching out. Here are the details on our password policies:\n\n1. Admin accounts require password rotation every 60 days\n2. Passwords must be minimum 12 characters with uppercase, lowercase, numbers, and special characters\n3. Yes, MFA is mandatory for all privileged accounts - we use hardware tokens for highest privilege accounts',
      timestamp: '2024-01-18 11:15 AM',
      attachments: [
        { id: '1', name: 'Password_Policy_v2.3.pdf', size: '245 KB', type: 'pdf' },
        { id: '2', name: 'MFA_Implementation_Guide.pdf', size: '1.2 MB', type: 'pdf' },
      ],
      isEncrypted: true,
    },
    {
      id: '3',
      author: 'Michael Chen',
      role: 'Senior Auditor',
      organization: 'Johnson & Associates CPA',
      content:
        "Thanks Emily. I've reviewed the attached documents. The policies look comprehensive. One follow-up question: How do you track and monitor compliance with these policies? Do you have any automated enforcement mechanisms?",
      timestamp: '2024-01-18 2:30 PM',
      isEncrypted: true,
      isCPA: true,
    },
  ],
};

export default function ThreadDetail({ threadId }: ThreadDetailProps) {
  const router = useRouter();
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      // In a real app, this would send the message to the server
      console.log('Sending message:', newMessage);
      setNewMessage('');
      setAttachments([]);
    }
  };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(Array.from(e.target.files));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg h-[calc(100vh-12rem)]">
      {/* Thread Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => router.push('/dashboard/collaboration')}
              className="mr-4 p-2 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 flex items-center">
                {threadData.subject}
                <LockClosedIcon
                  className="h-4 w-4 ml-2 text-gray-400"
                  title="End-to-end encrypted"
                />
              </h1>
              <div className="flex items-center space-x-3 text-sm text-gray-500">
                <span>Control: {threadData.relatedControl}</span>
                <span>•</span>
                <span className="text-yellow-600">Priority: High</span>
                <span>•</span>
                <span>{threadData.participants.length} participants</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              Open
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4" style={{ height: 'calc(100% - 200px)' }}>
        <div className="space-y-6">
          {threadData.messages.map((message) => (
            <div key={message.id} className="flex items-start space-x-3">
              <div className="relative">
                <UserCircleIcon className="h-10 w-10 text-gray-400" />
                {message.isCPA && (
                  <CheckBadgeIcon
                    className="absolute -bottom-1 -right-1 h-5 w-5 text-blue-500 bg-white rounded-full"
                    title="Verified CPA"
                  />
                )}
              </div>

              <div className="flex-1">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-gray-900">{message.author}</span>
                      <span className="ml-2 text-sm text-gray-500">
                        {message.role} • {message.organization}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{message.timestamp}</span>
                  </div>

                  <div className="text-sm text-gray-700 whitespace-pre-wrap">{message.content}</div>

                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 cursor-pointer"
                        >
                          <DocumentIcon className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-gray-700">{attachment.name}</span>
                          <span className="ml-2 text-gray-500">({attachment.size})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-200 px-6 py-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your secure message..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              rows={3}
            />
            {attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {attachments.map((file, idx) => (
                  <div key={idx} className="text-sm text-gray-600 flex items-center">
                    <PaperClipIcon className="h-4 w-4 mr-1" />
                    {file.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <label className="cursor-pointer">
              <input type="file" multiple onChange={handleAttachment} className="hidden" />
              <div className="p-3 rounded-lg hover:bg-gray-100 transition-colors">
                <PaperClipIcon className="h-5 w-5 text-gray-600" />
              </div>
            </label>

            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className="p-3 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center text-xs text-gray-500">
          <LockClosedIcon className="h-3 w-3 mr-1" />
          Messages are end-to-end encrypted
        </div>
      </div>
    </div>
  );
}
