import type { RouteRegistry } from './route-types'
import {
  renderPdaLoginPage,
  renderPdaOnboardingPage,
  renderPdaNotifyDetailPage,
  renderPdaNotifyDueSoonPage,
  renderPdaNotifyPage,
  renderPdaQualityDetailPage,
  renderPdaQualityPage,
  renderPdaSettlementPage,
  renderPdaTaskReceiveDetailPage,
  renderPdaTaskReceivePage,
  renderPdaExecDetailPage,
  renderPdaExecPage,
  renderPdaHandoverDetailPage,
  renderPdaHandoverPage,
  renderPdaSewingSelfReturnPage,
  renderPdaTransferBagDetailPage,
  renderPdaCuttingExecutionUnitPage,
  renderPdaCuttingHandoverPage,
  renderPdaCuttingFeiTicketNumberingPage,
  renderPdaCuttingInboundPage,
  renderPdaCuttingReplenishmentFeedbackPage,
  renderPdaCuttingSpreadingPage,
  renderPdaCuttingTaskDetailPage,
  renderPdaWarehousePage,
  renderPdaWarehouseWaitProcessPage,
  renderPdaWarehouseWaitHandoverPage,
  renderPdaWarehouseInboundRecordsPage,
  renderPdaWarehouseOutboundRecordsPage,
  renderPdaWarehouseStocktakePage,
} from './route-renderers'
import { renderRouteRedirect } from './route-utils'
import { getPdaCurrentAuthSession, resolvePdaPostLoginRoute, buildPdaAuthLoginPath } from '../data/fcs/factory-onboarding-flow.ts'

function decodeRouteSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export const routes: RouteRegistry = {
  exactRoutes: {
    '/fcs/pda': () =>
      renderRouteRedirect(
        resolvePdaPostLoginRoute(getPdaCurrentAuthSession(), '/fcs/pda/exec') || buildPdaAuthLoginPath('/fcs/pda/exec'),
        '工厂端移动应用',
      ),
    '/fcs/pda/auth/login': () => renderPdaLoginPage(),
    '/fcs/pda/auth/onboarding': () => renderPdaOnboardingPage(),
    '/fcs/pda/notify': () => renderPdaNotifyPage(),
    '/fcs/pda/notify/due-soon': () => renderPdaNotifyDueSoonPage(),
    '/fcs/pda/quality': () => renderPdaQualityPage(),
    '/fcs/pda/task-receive': () => renderPdaTaskReceivePage(),
    '/fcs/pda/exec': () => renderPdaExecPage(),
    '/fcs/pda/handover': () => renderPdaHandoverPage(),
    '/fcs/pda/handover/sewing-self-return': () => renderPdaSewingSelfReturnPage(),
    '/fcs/pda/transfer-bag-detail': () => renderPdaTransferBagDetailPage(),
    '/fcs/pda/warehouse': () => renderPdaWarehousePage(),
    '/fcs/pda/warehouse/wait-process': () => renderPdaWarehouseWaitProcessPage(),
    '/fcs/pda/warehouse/wait-handover': () => renderPdaWarehouseWaitHandoverPage(),
    '/fcs/pda/warehouse/inbound-records': () => renderPdaWarehouseInboundRecordsPage(),
    '/fcs/pda/warehouse/outbound-records': () => renderPdaWarehouseOutboundRecordsPage(),
    '/fcs/pda/warehouse/stocktake': () => renderPdaWarehouseStocktakePage(),
    '/fcs/pda/cutting/fei-ticket-numbering': () => renderPdaCuttingFeiTicketNumberingPage(),
    '/fcs/pda/settlement': () => renderPdaSettlementPage(),
  },
  dynamicRoutes: [
    {
      pattern: /^\/fcs\/pda\/notify\/([^/]+)$/,
      render: (match) => renderPdaNotifyDetailPage(match[1]),
    },
    {
      pattern: /^\/fcs\/pda\/exec\/([^/]+)$/,
      render: (match) => renderPdaExecDetailPage(decodeRouteSegment(match[1])),
    },
    {
      pattern: /^\/fcs\/pda\/task-receive\/([^/]+)$/,
      render: (match) => renderPdaTaskReceiveDetailPage(decodeRouteSegment(match[1])),
    },
    {
      pattern: /^\/fcs\/pda\/cutting\/task\/([^/]+)$/,
      render: (match) => renderPdaCuttingTaskDetailPage(match[1]),
    },
    {
      pattern: /^\/fcs\/pda\/cutting\/unit\/([^/]+)\/([^/]+)$/,
      render: (match) => renderPdaCuttingExecutionUnitPage(match[1], match[2]),
    },
    {
      pattern: /^\/fcs\/pda\/cutting\/spreading\/([^/]+)$/,
      render: (match) => renderPdaCuttingSpreadingPage(match[1]),
    },
    {
      pattern: /^\/fcs\/pda\/cutting\/inbound\/([^/]+)$/,
      render: (match) => renderPdaCuttingInboundPage(match[1]),
    },
    {
      pattern: /^\/fcs\/pda\/cutting\/handover\/([^/]+)$/,
      render: (match) => renderPdaCuttingHandoverPage(match[1]),
    },
    {
      pattern: /^\/fcs\/pda\/cutting\/replenishment-feedback\/([^/]+)$/,
      render: (match) => renderPdaCuttingReplenishmentFeedbackPage(match[1]),
    },
    {
      pattern: /^\/fcs\/pda\/quality\/([^/]+)$/,
      render: (match) => renderPdaQualityDetailPage(match[1]),
    },
    {
      pattern: /^\/fcs\/pda\/handover\/([^/]+)$/,
      render: (match) => renderPdaHandoverDetailPage(match[1]),
    },
    {
      pattern: /^\/fcs\/pda\/transfer-bag\/([^/]+)$/,
      render: (match) => renderPdaTransferBagDetailPage(match[1]),
    },
  ],
}
