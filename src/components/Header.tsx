'use client';

import { useEffect, useState } from 'react';

import LogoutButton from './LogoutButton';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { useRouter } from 'next/navigation';

export default function Header() {
  const [username, setUsername] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { eventName, clearEvent } = useActiveEvent();

  useEffect(() => {
    console.log('[Header] Header component mounted');
    const storedUsername = localStorage.getItem('username');
    console.log('[Header] Retrieved username from localStorage:', storedUsername);
    if (storedUsername) {
      setUsername(storedUsername);
      console.log('[Header] Username set in state:', storedUsername);
    } else {
      console.log('[Header] No username found in localStorage');
    }

  }, []);

  const handleSwitchEvent = () => {
    clearEvent();
    router.push('/select-event?manual=true');
  };

  return (
    <header className="bg-sky-900 shadow-sm border-b px-4 sm:px-6 py-4">
      <div className="flex justify-between items-center">
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-1 sm:space-x-2"
        >
          <span>🏠</span>
          <span className="hidden sm:inline">Home</span>
        </button>

        <div className="flex-1 text-center mx-4 flex flex-col items-center">
          <h1 className="text-lg sm:text-xl font-bold text-white">Bikri Kendra</h1>
          <button
            onClick={handleSwitchEvent}
            className={`text-xs sm:text-sm font-medium px-3 py-1 rounded-full mt-1 border transition-all flex items-center gap-1 ${
              eventName && eventName !== 'No Event Selected'
                ? 'text-purple-200 hover:text-white bg-purple-900/30 border-purple-500/30 hover:border-purple-400 hover:bg-purple-800/40'
                : 'text-red-200 hover:text-white bg-red-900/40 border-red-500/30 hover:border-red-400 hover:bg-red-800/40 font-bold animate-pulse'
            }`}
            title="Switch Event Workspace"
          >
            📍 {eventName && eventName !== 'No Event Selected' ? eventName : 'Select Event'}
            <span className="opacity-70 text-[10px]">▼</span>
          </button>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center space-x-4">
          <span className="text-white text-sm lg:text-base">Welcome {username || 'User'}</span>
          <LogoutButton />
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden text-white p-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden mt-4 pt-4 border-t border-sky-800">
          <div className="flex flex-col space-y-3">
            <span className="text-white text-sm">Welcome {username || 'User'}</span>
            <button
              onClick={handleSwitchEvent}
              className={`text-left text-sm py-1 ${
                eventName && eventName !== 'No Event Selected' ? 'text-purple-200 hover:text-white' : 'text-red-300 hover:text-white font-bold'
              }`}
            >
              📍 Switch Event ({eventName && eventName !== 'No Event Selected' ? eventName : 'None Selected - Click to Select'})
            </button>
            <LogoutButton />
          </div>
        </div>
      )}
    </header>
  );
}