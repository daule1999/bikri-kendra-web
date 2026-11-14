export function getOS(): 'mac' | 'windows' | 'linux' | 'other' {
    if (typeof window === 'undefined') return 'other';
    const userAgent = window.navigator.userAgent.toLowerCase();

    if (userAgent.includes('mac os') || userAgent.includes('macintosh')) {
        return 'mac';
    }
    if (userAgent.includes('windows') || userAgent.includes('win32')) {
        return 'windows';
    }
    if (userAgent.includes('linux')) {
        return 'linux';
    }

    return 'other';
}
