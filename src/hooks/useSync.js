// useSync.js is now a thin re-export of the shared SyncProvider/useSync
// from SyncContext.js. Kept as a separate file (rather than updating the
// 4 screens' import paths) so this fix is a minimal, safe diff -- every
// existing `import { useSync } from '../hooks/useSync'` and every
// `useSync(user)` call site keeps working exactly as written.
//
// See SyncContext.js for why this changed from a plain hook (each screen
// had its own disconnected copy of the data) to a shared context (all
// screens now see the same data, so a push from one screen is immediately
// visible on every other screen without needing to switch tabs to trigger
// a fresh pull).
export { useSync } from './SyncContext';
