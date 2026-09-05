/**
 * Cache a successful dynamic import while allowing a failed import to be retried.
 * This preserves the loading and recovery semantics previously repeated in main.ts.
 */
export function createRetryableModuleLoader<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null

  return () => {
    if (!pending) {
      pending = load().catch((error) => {
        pending = null
        throw error
      })
    }
    return pending
  }
}
