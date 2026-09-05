export function normalizeRoutePathname(pathname: string): string {
  return pathname.split('#')[0].split('?')[0] || '/'
}

export function isRouteAtOrBelow(pathname: string, routeRoot: string): boolean {
  const normalizedPathname = normalizeRoutePathname(pathname)
  const normalizedRoot = normalizeRoutePathname(routeRoot).replace(/\/+$/, '') || '/'
  if (normalizedRoot === '/') return normalizedPathname === '/'
  return normalizedPathname === normalizedRoot || normalizedPathname.startsWith(`${normalizedRoot}/`)
}

export function isRouteAtOrBelowAny(pathname: string, routeRoots: readonly string[]): boolean {
  return routeRoots.some((routeRoot) => isRouteAtOrBelow(pathname, routeRoot))
}

export function isProductionConfirmationPrintPath(pathname: string): boolean {
  return /^\/fcs\/production\/orders\/[^/]+\/confirmation-print\/?$/.test(normalizeRoutePathname(pathname))
}
