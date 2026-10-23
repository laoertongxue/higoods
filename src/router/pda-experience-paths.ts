/** Path-only boundary: safe for the initial shell; does not import factory or task packs. */
export function isThirdPartyPdaRouteAllowed(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0].replace(/\/$/, '')
  // A sewing assignment may receive cut pieces without entering warehouse management.
  if (pathname === '/fcs/pda' || pathname === '/fcs/pda/cutting/simple-cut-piece-handover') return true
  // The two-segment execution route belongs to binding/special-craft orders;
  // all three sewing task modes use the single task-identity segment.
  return /^\/fcs\/pda\/(?:auth\/(?:login|onboarding)|task-receive(?:\/[^/]+)?|exec(?:\/[^/]+)?|handover(?:\/[^/]+)?|settlement|quality(?:\/[^/]+)?|notify(?:\/[^/]+)?)$/.test(pathname)
    && pathname !== '/fcs/pda/handover/sewing-self-return'
}
