import type { RouteRegistry } from './route-types'
import {
  renderWlsTransferMaterialPrepDetailPage,
  renderWlsTransferMaterialPrepPage,
} from './route-renderers-wls'
import { renderRouteRedirect } from './route-utils'

export const routes: RouteRegistry = {
  exactRoutes: {
    '/wls': () => renderRouteRedirect('/wls/transfer-warehouse/material-prep', '正在跳转到中转仓配料管理'),
    '/wls/transfer-warehouse': () => renderRouteRedirect('/wls/transfer-warehouse/material-prep', '正在跳转到中转仓配料管理'),
    '/wls/transfer-warehouse/material-prep': () => renderWlsTransferMaterialPrepPage(),
    '/wls/transfer-warehouse/material-prep-detail': () => renderWlsTransferMaterialPrepDetailPage(),
  },
  dynamicRoutes: [],
}
