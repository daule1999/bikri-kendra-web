'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function LogViewer() {
  const [isVisible, setIsVisible] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    if (isVisible) {
      const interval = setInterval(() => {
        setLogs(logger.getLogs());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const filteredLogs = logs.filter(log => 
    filter === 'all' || log.level === filter
  );

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-600';
      case 'warn': return 'text-yellow-600';
      case 'info': return 'text-blue-600';
      case 'debug': return 'text-gray-600';
      default: return 'text-gray-800';
    }
  };

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full shadow-lg z-50 hover:bg-gray-700"
        title="Toggle Log Viewer"
      >
        📋
      </button>

      {/* Log Viewer Modal */}
      {isVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-6xl h-5/6 flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">Application Logs</h3>
              <div className="flex items-center space-x-4">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="border rounded px-2 py-1"
                >
                  <option value="all">All Levels</option>
                  <option value="error">Errors</option>
                  <option value="warn">Warnings</option>
                  <option value="info">Info</option>
                  <option value="debug">Debug</option>
                </select>
                <button
                  onClick={() => {
                    logger.clearLogs();
                    setLogs([]);
                  }}
                  className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    const dataStr = logger.exportLogs();
                    const dataBlob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(dataBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `logs-${new Date().toISOString()}.json`;
                    link.click();
                  }}
                  className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  Export
                </button>
                <button
                  onClick={() => setIsVisible(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Logs Content */}
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-2">
                {filteredLogs.length === 0 ? (
                  <p className="text-gray-500 text-center">No logs to display</p>
                ) : (
                  filteredLogs.map((log, index) => (
                    <div key={index} className="border-l-4 border-gray-300 pl-4 py-2 bg-gray-50">
                      <div className="flex items-center space-x-2 text-sm">
                        <span className="text-gray-500">{log.timestamp}</span>
                        <span className={`font-semibold ${getLevelColor(log.level)}`}>
                          [{log.level.toUpperCase()}]
                        </span>
                        <span className="font-medium text-purple-600">[{log.component}]</span>
                      </div>
                      <div className="mt-1">
                        <p className="text-gray-800">{log.message}</p>
                        {log.data && (
                          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {typeof log.data === 'string' 
                              ? log.data 
                              : JSON.stringify(log.data, null, 2)
                            }
                          </pre>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t p-4 text-sm text-gray-600">
              Total logs: {logs.length} | Filtered: {filteredLogs.length}
            </div>
          </div>
        </div>
      )}
    </>
  );
}