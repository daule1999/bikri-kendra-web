'use client';

import React, { useState } from 'react';
import { Provider } from 'react-redux';
import { makeStore } from '../store/store';
import type { AppStore } from '../store/store';
import type { AuthState } from '../store/types/auth';

export default function StoreProvider({
    children,
    preloadedAuth,
}: {
    children: React.ReactNode;
    // Cookie-derived, non-sensitive auth fields read server-side in
    // app/layout.tsx (username/userRole/mustResetPassword only — never the
    // access token, see lib/cookies.ts for why). Used to seed this store's
    // very first render so it matches what the server already rendered,
    // instead of the old behavior of starting "logged out" until hydration
    // read localStorage.
    preloadedAuth?: Partial<AuthState>;
}) {
    // useState with a lazy initializer (not useRef) so exactly one store is
    // created per mount and never recreated on re-render — the initializer
    // only runs on the very first render. Runs once during the server's
    // render pass and once during client hydration — each gets its own
    // instance, there's no cross-request sharing. Unlike a ref, state is
    // safe to read during render, which React's ref rules otherwise forbid
    // (see https://react.dev/reference/react/useRef).
    const [store] = useState<AppStore>(() => makeStore(preloadedAuth));

    return <Provider store={store}>{children}</Provider>;
}
