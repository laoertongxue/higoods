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

export function notifyPdaCuttingInboundRouteLeave(
  previousPathname: string,
  nextPathname: string,
  dispatchEvent: (event: Event) => unknown = (event) => window.dispatchEvent(event),
): boolean {
  if (
    !previousPathname.startsWith('/fcs/pda/cutting/inbound/') ||
    previousPathname === nextPathname
  ) {
    return false
  }

  dispatchEvent(new Event('higood:pda-cutting-inbound-leave'))
  return true
}

export function notifyPdaCuttingRouteLeave(
  previousPathname: string,
  nextPathname: string,
  dispatchEvent: (event: Event) => unknown = (event) => window.dispatchEvent(event),
): boolean {
  if (previousPathname === nextPathname) return false

  const inboundNotified = notifyPdaCuttingInboundRouteLeave(
    previousPathname,
    nextPathname,
    dispatchEvent,
  )
  const handoverNotified = notifyPdaCuttingHandoverRouteLeave(
    previousPathname,
    nextPathname,
    dispatchEvent,
  )
  return inboundNotified || handoverNotified
}
