import { menusBySystem } from '../data/app-shell-config'
import { renderFactoryProfilePage } from '../pages/factory-profile'
import { renderOverviewPage, renderRisksPage, renderTodosPage } from '../pages/workbench'
import { renderPlaceholderPage, renderRouteNotFound } from '../pages/placeholder'
import { renderCapabilityPage } from '../pages/capability'
import { renderFactoryStatusPage } from '../pages/factory-status'
import { renderFactoryPerformancePage } from '../pages/factory-performance'
import { renderSettlementDetailPage, renderSettlementListPage } from '../pages/settlement'
import {
  renderCapacityOverviewPage,
  renderCapacityRiskPage,
  renderCapacityBottleneckPage,
  renderCapacityConstraintsPage,
  renderCapacityPoliciesPage,
} from '../pages/capacity'
import {
  renderProductionDemandInboxPage,
  renderProductionOrdersPage,
  renderProductionPlanPage,
  renderProductionDeliveryWarehousePage,
  renderProductionChangesPage,
  renderProductionStatusPage,
  renderProductionOrderDetailPage,
} from '../pages/production'
import { renderProductionCraftDictPage } from '../pages/production-craft-dict'
import { renderTechPackPage } from '../pages/tech-pack'
import { renderTaskBreakdownPage } from '../pages/task-breakdown'
import { renderDyePrintOrdersPage } from '../pages/dye-print-orders'
import { renderDependenciesPage } from '../pages/dependencies'
import { renderMaterialIssuePage } from '../pages/material-issue'
import { renderQcStandardsPage } from '../pages/qc-standards'
import { renderQcRecordDetailPage, renderQcRecordsPage } from '../pages/qc-records'
import { renderReworkPage } from '../pages/rework'
import {
  renderDeductionCalcPage,
  renderDeductionCalcDetailPage,
} from '../pages/deduction-calc'
import { renderArbitrationPage } from '../pages/arbitration'
import { renderPenaltyOutputPage } from '../pages/penalty-output'
import { renderStatementsPage } from '../pages/statements'
import { renderAdjustmentsPage } from '../pages/adjustments'
import { renderBatchesPage } from '../pages/batches'
import { renderMaterialStatementsPage } from '../pages/material-statements'
import { renderPaymentSyncPage } from '../pages/payment-sync'
import { renderHistoryPage } from '../pages/history'
import { renderDispatchBoardPage } from '../pages/dispatch-board'
import { renderDispatchTendersPage } from '../pages/dispatch-tenders'
import { renderDispatchExceptionsPage } from '../pages/dispatch-exceptions'
import { renderProgressBoardPage } from '../pages/progress-board'
import { renderProgressExceptionsPage } from '../pages/progress-exceptions'
import { renderProgressStatusWritebackPage } from '../pages/progress-status-writeback'
import { renderProgressMaterialPage } from '../pages/progress-material'
import { renderProgressUrgePage } from '../pages/progress-urge'
import { renderProgressHandoverPage } from '../pages/progress-handover'
import {
  renderTraceMappingPage,
  renderTraceParentCodesPage,
  renderTraceUnitPricePage,
  renderTraceUniqueCodesPage,
} from '../pages/trace'
import { renderPdaNotifyPage } from '../pages/pda-notify'
import { renderPdaNotifyDueSoonPage } from '../pages/pda-notify-due-soon'
import { renderPdaNotifyDetailPage } from '../pages/pda-notify-detail'
import { renderPdaTaskReceivePage } from '../pages/pda-task-receive'
import { renderPdaTaskReceiveDetailPage } from '../pages/pda-task-receive-detail'
import { renderPdaExecPage } from '../pages/pda-exec'
import { renderPdaExecDetailPage } from '../pages/pda-exec-detail'
import { renderPdaHandoverPage } from '../pages/pda-handover'
import { renderPdaHandoverDetailPage } from '../pages/pda-handover-detail'
import { renderPdaSettlementPage } from '../pages/pda-settlement'
import type { MenuGroup, MenuItem } from '../data/app-shell-types'

type RouteRenderer = (pathname: string) => string

function normalizePathname(pathname: string): string {
  return pathname.split('#')[0].split('?')[0] || '/'
}

const exactRoutes: Record<string, RouteRenderer> = {
  '/': () => renderOverviewPage(),
  '/fcs/factories/profile': () => renderFactoryProfilePage(),
  '/fcs/factories/capability': () => renderCapabilityPage(),
  '/fcs/factories/status': () => renderFactoryStatusPage(),
  '/fcs/factories/performance': () => renderFactoryPerformancePage(),
  '/fcs/factories/settlement': () => renderSettlementListPage(),
  '/fcs/workbench/overview': () => renderOverviewPage(),
  '/fcs/workbench/todos': () => renderTodosPage(),
  '/fcs/workbench/risks': () => renderRisksPage(),
  '/fcs/capacity/overview': () => renderCapacityOverviewPage(),
  '/fcs/capacity/risk': () => renderCapacityRiskPage(),
  '/fcs/capacity/bottleneck': () => renderCapacityBottleneckPage(),
  '/fcs/capacity/constraints': () => renderCapacityConstraintsPage(),
  '/fcs/capacity/policies': () => renderCapacityPoliciesPage(),
  '/fcs/production/demand-inbox': () => renderProductionDemandInboxPage(),
  '/fcs/production/orders': () => renderProductionOrdersPage(),
  '/fcs/production/plan': () => renderProductionPlanPage(),
  '/fcs/production/delivery-warehouse': () => renderProductionDeliveryWarehousePage(),
  '/fcs/production/changes': () => renderProductionChangesPage(),
  '/fcs/production/status': () => renderProductionStatusPage(),
  '/fcs/production/craft-dict': () => renderProductionCraftDictPage(),
  '/fcs/process/task-breakdown': () => renderTaskBreakdownPage(),
  '/fcs/process/dye-print-orders': () => renderDyePrintOrdersPage(),
  '/fcs/process/dependencies': () => renderDependenciesPage(),
  '/fcs/process/material-issue': () => renderMaterialIssuePage(),
  '/fcs/process/qc-standards': () => renderQcStandardsPage(),
  '/fcs/quality/qc-records': () => renderQcRecordsPage(),
  '/fcs/quality/rework': () => renderReworkPage(),
  '/fcs/quality/deduction-calc': () => renderDeductionCalcPage(),
  '/fcs/quality/arbitration': () => renderArbitrationPage(),
  '/fcs/quality/penalty-output': () => renderPenaltyOutputPage(),
  '/fcs/settlement/statements': () => renderStatementsPage(),
  '/fcs/settlement/adjustments': () => renderAdjustmentsPage(),
  '/fcs/settlement/batches': () => renderBatchesPage(),
  '/fcs/settlement/material-statements': () => renderMaterialStatementsPage(),
  '/fcs/settlement/payment-sync': () => renderPaymentSyncPage(),
  '/fcs/settlement/history': () => renderHistoryPage(),
  '/fcs/dispatch/board': () => renderDispatchBoardPage(),
  '/fcs/dispatch/tenders': () => renderDispatchTendersPage(),
  '/fcs/dispatch/exceptions': () => renderDispatchExceptionsPage(),
  '/fcs/progress/board': () => renderProgressBoardPage(),
  '/fcs/progress/exceptions': () => renderProgressExceptionsPage(),
  '/fcs/progress/handover': () => renderProgressHandoverPage(),
  '/fcs/progress/urge': () => renderProgressUrgePage(),
  '/fcs/progress/status-writeback': () => renderProgressStatusWritebackPage(),
  '/fcs/progress/material': () => renderProgressMaterialPage(),
  '/fcs/production/create': () =>
    renderPlaceholderPage(
      '生成生产单',
      '根据生产需求创建生产单，包括拆单规则配置、批次划分、工艺路线选择等。',
      '生产单管理',
    ),
  '/fcs/trace/mapping': () =>
    renderTraceMappingPage(),
  '/fcs/trace/parent-codes': () =>
    renderTraceParentCodesPage(),
  '/fcs/trace/unique-codes': () =>
    renderTraceUniqueCodesPage(),
  '/fcs/trace/unit-price': () =>
    renderTraceUnitPricePage(),
  '/fcs/pda': () => renderPdaNotifyPage(),
  '/fcs/pda/notify': () => renderPdaNotifyPage(),
  '/fcs/pda/notify/due-soon': () => renderPdaNotifyDueSoonPage(),
  '/fcs/pda/task-receive': () => renderPdaTaskReceivePage(),
  '/fcs/pda/exec': () => renderPdaExecPage(),
  '/fcs/pda/handover': () => renderPdaHandoverPage(),
  '/fcs/pda/settlement': () => renderPdaSettlementPage(),
}

const dynamicRoutes: Array<{ pattern: RegExp; render: (match: RegExpExecArray) => string }> = [
  {
    pattern: /^\/fcs\/production\/orders\/([^/]+)$/,
    render: (match) => renderProductionOrderDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/factories\/settlement\/([^/]+)$/,
    render: (match) => renderSettlementDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/quality\/qc-records\/([^/]+)$/,
    render: (match) => renderQcRecordDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/quality\/deduction-calc\/([^/]+)$/,
    render: (match) => renderDeductionCalcDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/tech-pack\/([^/]+)$/,
    render: (match) => renderTechPackPage(match[1]),
  },
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
    pattern: /^\/fcs\/pda\/handover\/([^/]+)$/,
    render: (match) => renderPdaHandoverDetailPage(match[1]),
  },
]

function findMenuByPath(pathname: string): { group: MenuGroup; item: MenuItem } | null {
  const normalizedPathname = normalizePathname(pathname)
  const allGroups = Object.values(menusBySystem).flat()

  for (const group of allGroups) {
    for (const item of group.items) {
      if (item.href === normalizedPathname) {
        return { group, item }
      }

      if (item.children) {
        const child = item.children.find((childItem) => childItem.href === normalizedPathname)
        if (child) {
          return { group, item: child }
        }
      }
    }
  }

  return null
}

export function resolvePage(pathname: string): string {
  const normalizedPathname = normalizePathname(pathname)

  const directRenderer = exactRoutes[normalizedPathname]
  if (directRenderer) {
    return directRenderer(normalizedPathname)
  }

  for (const route of dynamicRoutes) {
    const matched = route.pattern.exec(normalizedPathname)
    if (matched) {
      return route.render(matched)
    }
  }

  const menu = findMenuByPath(normalizedPathname)
  if (menu) {
    return renderPlaceholderPage(
      menu.item.title,
      `${menu.item.title} 页面已接入路由与菜单联动，待迁移完整 UI 与交互。`,
      menu.group.title,
    )
  }

  return renderRouteNotFound(pathname)
}
