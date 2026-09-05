export type RouteRenderer = (pathname: string) => string | Promise<string>

export type DynamicRouteRenderer = (match: RegExpExecArray) => string | Promise<string>

export interface RouteRegistry {
  exactRoutes: Record<string, RouteRenderer>
  dynamicRoutes: Array<{ pattern: RegExp; render: DynamicRouteRenderer }>
}
