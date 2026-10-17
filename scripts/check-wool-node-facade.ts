/** Node fact/static-UI checks only. No browser persistence or transaction claim.
 * Domain commands use their existing Node facade; the fake window is restored
 * before an asynchronous UI handler resumes to render its result.
 */
export function withWoolFactNodeFacade<T>(action: () => T): T {
  const browserWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'window')
  try { return action() }
  finally { if (browserWindow) Object.defineProperty(globalThis, 'window', browserWindow) }
}
