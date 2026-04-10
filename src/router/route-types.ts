export type RouteRenderer = (pathname: string) => Promise<string>

export type DynamicRouteRenderer = (match: RegExpExecArray) => Promise<string>

export interface RouteRegistry {
  exactRoutes: Record<string, RouteRenderer>
  dynamicRoutes: Array<{ pattern: RegExp; render: DynamicRouteRenderer }>
}
