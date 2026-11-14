'use client';

import { useDispatch } from 'react-redux';
import { purgeSession } from '@/store/slices/authSlice';

export default function LogoutButton() {
  const dispatch = useDispatch();

  const handleLogout = () => {
    // purgeSession clears every localStorage key (a superset of the manual
    // list this used to remove one-by-one), resets Redux auth/tenant state,
    // AND clears the has_session/must_reset cookies middleware.ts relies on.
    // Dispatching it directly — instead of the old manual localStorage.removeItem
    // calls that never touched Redux or cookies — is what makes the new
    // middleware-based redirect work correctly right after logout.
    dispatch(purgeSession());

    window.location.href = '/';
  };

  return (
    <button
      onClick={handleLogout}
      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
    >
      Logout
    </button>
  );
}