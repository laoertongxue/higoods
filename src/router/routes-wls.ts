import type { RouteRegistry } from './route-types'
import { renderRouteRedirect } from './route-utils'

export const routes: RouteRegistry = {
  exactRoutes: {
    '/wls': () => renderRouteRedirect('/fcs/material-prep/list', '配料管理已迁移至 FCS 工厂生产协同系统'),
    '/wls/transfer-warehouse': () => renderRouteRedirect('/fcs/material-prep/list', '配料管理已迁移至 FCS'),
    '/wls/transfer-warehouse/material-prep': () => renderRouteRedirect('/fcs/material-prep/list', '配料管理已迁移至 FCS'),
    '/wls/transfer-warehouse/material-prep-detail': () => renderRouteRedirect('/fcs/material-prep/list', '配料管理已迁移至 FCS'),
  },
  dynamicRoutes: [],
}
