export function notifyPdaCuttingHandoverRouteLeave(
  previousPathname: string,
  nextPathname: string,
  dispatchEvent?: (event: Event) => unknown,
): boolean {
  if (
    !previousPathname.startsWith('/fcs/pda/cutting/handover/') ||
    previousPathname === nextPathname
  ) {
    return false
  }

  const dispatcher = dispatchEvent
    ?? (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function'
      ? null
      : (event: Event) => window.dispatchEvent(event))
  if (!dispatcher) return false

  dispatcher(new Event('higood:pda-cutting-handover-leave'))
  return true
}

export function notifyPdaCuttingInboundRouteLeave(
  previousPathname: string,
  nextPathname: string,
  dispatchEvent?: (event: Event) => unknown,
): boolean {
  if (
    !previousPathname.startsWith('/fcs/pda/cutting/inbound/') ||
    previousPathname === nextPathname
  ) {
    return false
  }

  const dispatcher = dispatchEvent
    ?? (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function'
      ? null
      : (event: Event) => window.dispatchEvent(event))
  if (!dispatcher) return false

  dispatcher(new Event('higood:pda-cutting-inbound-leave'))
  return true
}

export function notifyPdaCuttingRouteLeave(
  previousPathname: string,
  nextPathname: string,
  dispatchEvent?: (event: Event) => unknown,
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
