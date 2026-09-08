export function notifyPdaWoolRouteLeave(
  previousPathname: string,
  nextPathname: string,
  dispatchEvent?: (event: Event) => unknown,
): boolean {
  const previousPath = previousPathname.split('?')[0] || ''
  const nextPath = nextPathname.split('?')[0] || ''
  if (!previousPath.startsWith('/fcs/pda/exec/') || previousPath === nextPath) {
    return false
  }

  const dispatcher = dispatchEvent
    ?? (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function'
      ? null
      : (event: Event) => window.dispatchEvent(event))
  if (!dispatcher) return false

  dispatcher(new Event('higood:pda-wool-exec-leave'))
  return true
}
