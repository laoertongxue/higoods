export function notifyPdaCuttingHandoverRouteLeave(
  previousPathname: string,
  nextPathname: string,
  dispatchEvent: (event: Event) => unknown = (event) => window.dispatchEvent(event),
): boolean {
  if (
    !previousPathname.startsWith('/fcs/pda/cutting/handover/') ||
    previousPathname === nextPathname
  ) {
    return false
  }

  dispatchEvent(new Event('higood:pda-cutting-handover-leave'))
  return true
}
