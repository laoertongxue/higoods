import type { RouteRegistry } from './route-types'
import {
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
  renderPdaCuttingExecutionUnitPage,
  renderPdaCuttingHandoverPage,
  renderPdaCuttingInboundPage,
  renderPdaCuttingPickupPage,
  renderPdaCuttingReplenishmentFeedbackPage,
  renderPdaCuttingSpreadingPage,
  renderPdaCuttingTaskDetailPage,
} from './route-renderers'

export const routes: RouteRegistry = {
  exactRoutes: {
    '/fcs/pda': () => renderPdaNotifyPage(),
    '/fcs/pda/notify': () => renderPdaNotifyPage(),
    '/fcs/pda/notify/due-soon': () => renderPdaNotifyDueSoonPage(),
    '/fcs/pda/quality': () => renderPdaQualityPage(),
    '/fcs/pda/task-receive': () => renderPdaTaskReceivePage(),
    '/fcs/pda/exec': () => renderPdaExecPage(),
    '/fcs/pda/handover': () => renderPdaHandoverPage(),
    '/fcs/pda/settlement': () => renderPdaSettlementPage(),
  },
  dynamicRoutes: [
    {
      pattern: /^\/fcs\/pda\/notify\/([^/]+)$/,
      render: (match) => renderPdaNotifyDetailPage(match[1]),
    },
    {
      pattern: /^\/fcs\/pda\/exec\/([^/]+)$/,
      render: (match) => renderPdaExecDetailPage(match[1]),
    },
    {
      pattern: /^\/fcs\/pda\/task-receive\/([^/]+)$/,
      render: (match) => renderPdaTaskReceiveDetailPage(match[1]),
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
      pattern: /^\/fcs\/pda\/cutting\/pickup\/([^/]+)$/,
      render: (match) => renderPdaCuttingPickupPage(match[1]),
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
  ],
}
