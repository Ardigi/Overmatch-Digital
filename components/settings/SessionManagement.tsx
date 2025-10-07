'use client';

import {
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  MapPinIcon,
  ShieldCheckIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useState } from 'react';
import { LoadingButton, LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/contexts/ToastContext';
import { useRevokeAllSessions, useRevokeSession, useSessions } from '@/hooks/api/useAuth';

interface Session {
  id: string;
  userId: string;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  location?: {
    city?: string;
    country?: string;
  };
  deviceInfo?: {
    browser?: string;
    os?: string;
    device?: string;
  };
  lastActivityAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export default function SessionManagement() {
  const { showSuccess, showError } = useToast();
  const { data: sessions, loading, execute: refreshSessions } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeAllSessions = useRevokeAllSessions();
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSession.mutate(sessionId);
      showSuccess('Session revoked', 'The session has been terminated.');
      refreshSessions();
    } catch (error) {
      showError('Revoke failed', 'Failed to revoke the session. Please try again.');
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      await revokeAllSessions.mutate();
      showSuccess('All sessions revoked', 'All other sessions have been terminated.');
      refreshSessions();
      setShowRevokeAllConfirm(false);
    } catch (error) {
      showError('Revoke failed', 'Failed to revoke sessions. Please try again.');
    }
  };

  const getDeviceIcon = (deviceType?: string) => {
    if (deviceType?.toLowerCase().includes('mobile')) {
      return <DevicePhoneMobileIcon className="h-8 w-8 text-gray-400" />;
    }
    return <ComputerDesktopIcon className="h-8 w-8 text-gray-400" />;
  };

  const isSessionSuspicious = (session: Session) => {
    // Check for suspicious patterns
    if (!session.location?.country) return false;
    // Add more sophisticated checks here
    return false;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  const activeSessions = sessions || [];
  const currentSession = activeSessions.find((s) => s.isCurrent);
  const otherSessions = activeSessions.filter((s) => !s.isCurrent);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Active Sessions</h3>
            {otherSessions.length > 0 && (
              <button
                onClick={() => setShowRevokeAllConfirm(true)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Revoke all other sessions
              </button>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Manage your active sessions and see where you're signed in.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {/* Current Session */}
          {currentSession && (
            <div className="p-6">
              <div className="flex items-start gap-4">
                {getDeviceIcon(currentSession.deviceInfo?.device)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-gray-900">Current Session</h4>
                    <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                      Active
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {currentSession.deviceInfo?.browser} on {currentSession.deviceInfo?.os}
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <MapPinIcon className="h-3 w-3" />
                      {currentSession.location?.city}, {currentSession.location?.country}
                    </div>
                    <div className="flex items-center gap-1">
                      <GlobeAltIcon className="h-3 w-3" />
                      {currentSession.ipAddress}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Started {format(new Date(currentSession.createdAt), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
                <div className="flex items-center">
                  <ShieldCheckIcon className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </div>
          )}

          {/* Other Sessions */}
          {otherSessions.map((session) => (
            <div key={session.id} className="p-6">
              <div className="flex items-start gap-4">
                {getDeviceIcon(session.deviceInfo?.device)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-gray-900">
                      {session.deviceInfo?.browser} on {session.deviceInfo?.os}
                    </h4>
                    {isSessionSuspicious(session) && (
                      <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600" />
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <MapPinIcon className="h-3 w-3" />
                      {session.location?.city}, {session.location?.country}
                    </div>
                    <div className="flex items-center gap-1">
                      <GlobeAltIcon className="h-3 w-3" />
                      {session.ipAddress}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Last active {format(new Date(session.lastActivityAt), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeSession(session.id)}
                  className="text-gray-400 hover:text-red-600"
                  title="Revoke session"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}

          {activeSessions.length === 0 && (
            <div className="p-6 text-center text-gray-500">No active sessions found.</div>
          )}
        </div>
      </div>

      {/* Security Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Session Security Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Review your active sessions regularly</li>
          <li>• Revoke any sessions you don't recognize</li>
          <li>• Sign out when using shared or public computers</li>
          <li>• Enable two-factor authentication for extra security</li>
        </ul>
      </div>

      {/* Revoke All Confirmation */}
      {showRevokeAllConfirm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Revoke all other sessions?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will sign you out of all other devices and browsers. You'll remain signed in on
              this device.
            </p>
            <div className="flex gap-3">
              <LoadingButton
                onClick={handleRevokeAllSessions}
                loading={revokeAllSessions.loading}
                className="btn-danger flex-1"
              >
                Revoke All
              </LoadingButton>
              <button
                onClick={() => setShowRevokeAllConfirm(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
