export function notifyPdaWoolRouteLeave(
  previousPathname: string,
  nextPathname: string,
  dispatchEvent: (event: Event) => unknown = (event) => window.dispatchEvent(event),
): boolean {
  const previousPath = previousPathname.split('?')[0] || ''
  const nextPath = nextPathname.split('?')[0] || ''
  if (!previousPath.startsWith('/fcs/pda/exec/') || previousPath === nextPath) {
    return false
  }

  dispatchEvent(new Event('higood:pda-wool-exec-leave'))
  return true
}
