'use client';

import { BoltIcon, Cog6ToothIcon, PauseIcon, PlayIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

export default function MonitoringHeader() {
  const [isMonitoringActive, setIsMonitoringActive] = useState(true);

  return (
    <div className="sm:flex sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compliance Monitoring</h1>
        <p className="mt-1 text-sm text-gray-600">
          Real-time monitoring and automated compliance checks across all integrated systems
        </p>
      </div>

      <div className="mt-4 sm:mt-0 flex items-center space-x-3">
        {/* Monitoring Status */}
        <div
          className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md ${
            isMonitoringActive ? 'text-green-700 bg-green-100' : 'text-gray-700 bg-gray-100'
          }`}
        >
          <div
            className={`h-2 w-2 rounded-full mr-2 ${
              isMonitoringActive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
            }`}
          ></div>
          {isMonitoringActive ? 'Monitoring Active' : 'Monitoring Paused'}
        </div>

        {/* Toggle Monitoring */}
        <button
          onClick={() => setIsMonitoringActive(!isMonitoringActive)}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          {isMonitoringActive ? (
            <>
              <PauseIcon className="mr-2 h-5 w-5" />
              Pause Monitoring
            </>
          ) : (
            <>
              <PlayIcon className="mr-2 h-5 w-5" />
              Resume Monitoring
            </>
          )}
        </button>

        {/* Configure Automation */}
        <button className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
          <BoltIcon className="mr-2 h-5 w-5" />
          Configure Automation
        </button>

        {/* Settings */}
        <button className="p-2 border border-gray-300 shadow-sm rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
          <Cog6ToothIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
