/**
 * Centralized logger utility.
 * - Wraps console.* with NODE_ENV guard for debug.
 * - In production, debug is silenced; warn/error still surface.
 * - Prevents PII leaks by requiring explicit debug calls.
 */

type LogArgs = unknown[];

function isDev(): boolean {
    try {
        // Electron main / backend runs in Node; NODE_ENV may be undefined
        return process.env.NODE_ENV !== 'production';
    } catch {
        return true;
    }
}

export const logger = {
    debug(...args: LogArgs): void {
        if (isDev()) {
            // eslint-disable-next-line no-console
            console.log('[DEBUG]', ...args);
        }
    },
    info(...args: LogArgs): void {
        // eslint-disable-next-line no-console
        console.log('[INFO]', ...args);
    },
    warn(...args: LogArgs): void {
        // eslint-disable-next-line no-console
        console.warn('[WARN]', ...args);
    },
    error(...args: LogArgs): void {
        // eslint-disable-next-line no-console
        console.error('[ERROR]', ...args);
    },
};

export default logger;
