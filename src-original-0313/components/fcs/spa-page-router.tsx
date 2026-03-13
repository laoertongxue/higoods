'use client'

import { lazy, Suspense, useMemo } from 'react'
import { useSpaPathname } from '@/components/app-shell/app-shell-context'
import { useParams } from '@/lib/navigation'
import { Spinner } from '@/components/ui/spinner'

// Lazy-load all page components
const OverviewPage = lazy(() => import('@/components/fcs/workbench/overview-page').then(m => ({ default: m.OverviewPage })))
const TodosPage = lazy(() => import('@/components/fcs/workbench/todos-page').then(m => ({ default: m.TodosPage })))
const RisksPage = lazy(() => import('@/components/fcs/workbench/risks-page').then(m => ({ default: m.RisksPage })))
const FactoryProfilePage = lazy(() => import('@/components/fcs/factories/factory-profile-page').then(m => ({ default: m.FactoryProfilePage })))
const CapabilityPage = lazy(() => import('@/components/fcs/capability/capability-page').then(m => ({ default: m.CapabilityPage })))
const SettlementListPage = lazy(() => import('@/components/fcs/settlement/settlement-list-page').then(m => ({ default: m.SettlementListPage })))
const SettlementDetailPage = lazy(() => import('@/components/fcs/settlement/settlement-detail-page').then(m => ({ default: m.SettlementDetailPage })))
const FactoryStatusPage = lazy(() => import('@/components/fcs/status/factory-status-page').then(m => ({ default: m.FactoryStatusPage })))
const FactoryPerformancePage = lazy(() => import('@/components/fcs/performance/factory-performance-page').then(m => ({ default: m.FactoryPerformancePage })))
const DemandInboxPage = lazy(() => import('@/components/fcs/production/demand-inbox-page').then(m => ({ default: m.DemandInboxPage })))
const OrdersPage = lazy(() => import('@/components/fcs/production/orders-page').then(m => ({ default: m.OrdersPage })))
const OrderDetailPage = lazy(() => import('@/components/fcs/production/order-detail-page').then(m => ({ default: m.OrderDetailPage })))
const ProductionPlanPage = lazy(() => import('@/components/fcs/production/production-plan-page').then(m => ({ default: m.ProductionPlanPage })))
const DeliveryWarehousePage = lazy(() => import('@/components/fcs/production/delivery-warehouse-page').then(m => ({ default: m.DeliveryWarehousePage })))
const ProductionChangesPage = lazy(() => import('@/components/fcs/production/production-changes-page').then(m => ({ default: m.ProductionChangesPage })))
const ProductionStatusPage = lazy(() => import('@/components/fcs/production/production-status-page').then(m => ({ default: m.ProductionStatusPage })))
const DispatchBoardPage = lazy(() => import('@/components/fcs/dispatch/dispatch-board-page').then(m => ({ default: m.DispatchBoardPage })))
const TendersPage = lazy(() => import('@/components/fcs/dispatch/tenders-page').then(m => ({ default: m.TendersPage })))
const AwardPage = lazy(() => import('@/components/fcs/dispatch/award-page').then(m => ({ default: m.AwardPage })))
const DispatchExceptionsPage = lazy(() => import('@/components/fcs/dispatch/dispatch-exceptions-page').then(m => ({ default: m.DispatchExceptionsPage })))
const ProgressBoardPage = lazy(() => import('@/components/fcs/progress/progress-board-page').then(m => ({ default: m.ProgressBoardPage })))
const ExceptionsPage = lazy(() => import('@/components/fcs/progress/exceptions-page').then(m => ({ default: m.ExceptionsPage })))
const UrgePage = lazy(() => import('@/components/fcs/progress/urge-page').then(m => ({ default: m.UrgePage })))
const HandoverPage = lazy(() => import('@/components/fcs/progress/handover-page').then(m => ({ default: m.HandoverPage })))
const TaskBreakdownPage = lazy(() => import('@/components/fcs/process/task-breakdown-page').then(m => ({ default: m.TaskBreakdownPage })))
const QcStandardsPage = lazy(() => import('@/components/fcs/process/qc-standards-page').then(m => ({ default: m.QcStandardsPage })))
const MaterialIssuePage = lazy(() => import('@/components/fcs/process/material-issue-page').then(m => ({ default: m.MaterialIssuePage })))
const DyePrintOrdersPage = lazy(() => import('@/components/fcs/process/dye-print-orders-page'))
const CapacityOverviewPage = lazy(() => import('@/components/fcs/capacity/capacity-overview-page').then(m => ({ default: m.CapacityOverviewPage })))
const CapacityConstraintsPage = lazy(() => import('@/components/fcs/capacity/capacity-constraints-page').then(m => ({ default: m.CapacityConstraintsPage })))
const CapacityBottleneckPage = lazy(() => import('@/components/fcs/capacity/capacity-bottleneck-page').then(m => ({ default: m.CapacityBottleneckPage })))
const CapacityRiskPage = lazy(() => import('@/components/fcs/capacity/capacity-risk-page').then(m => ({ default: m.CapacityRiskPage })))
const CapacityPoliciesPage = lazy(() => import('@/components/fcs/capacity/capacity-policies-page').then(m => ({ default: m.CapacityPoliciesPage })))
const StatementsPage = lazy(() => import('@/components/fcs/settlement/statements-page').then(m => ({ default: m.StatementsPage })))
const PaymentSyncPage = lazy(() => import('@/components/fcs/settlement/payment-sync-page').then(m => ({ default: m.PaymentSyncPage })))
const MaterialStatementsPage = lazy(() => import('@/components/fcs/settlement/material-statements-page').then(m => ({ default: m.MaterialStatementsPage })))
const HistoryPage = lazy(() => import('@/components/fcs/settlement/history-page').then(m => ({ default: m.HistoryPage })))
const BatchesPage = lazy(() => import('@/components/fcs/settlement/batches-page').then(m => ({ default: m.BatchesPage })))
const AdjustmentsPage = lazy(() => import('@/components/fcs/settlement/adjustments-page').then(m => ({ default: m.AdjustmentsPage })))
const ReworkPage = lazy(() => import('@/components/fcs/quality/rework-page').then(m => ({ default: m.ReworkPage })))
const PenaltyOutputPage = lazy(() => import('@/components/fcs/quality/penalty-output-page').then(m => ({ default: m.PenaltyOutputPage })))
const ArbitrationPage = lazy(() => import('@/components/fcs/quality/arbitration-page').then(m => ({ default: m.ArbitrationPage })))
const PagePlaceholder = lazy(() => import('@/components/fcs/page-placeholder').then(m => ({ default: m.PagePlaceholder })))
const TechPackPageRaw = lazy(() => import('@/components/fcs/tech-pack/tech-pack-view').then(m => ({ default: m.TechPackPage })))

// Wrapper: reads spuCode from the last URL path segment
function TechPackPageWrapper() {
  const params = useParams()
  const spuCode = typeof params['id'] === 'string' ? decodeURIComponent(params['id']) : ''
  return <TechPackPageRaw spuCode={spuCode} />
}

// Static route table
const staticRoutes: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  '/': FactoryProfilePage,
  '/fcs/workbench/overview': OverviewPage,
  '/fcs/workbench/todos': TodosPage,
  '/fcs/workbench/risks': RisksPage,
  '/fcs/factories/profile': FactoryProfilePage,
  '/fcs/factories/capability': CapabilityPage,
  '/fcs/factories/settlement': SettlementListPage,
  '/fcs/factories/status': FactoryStatusPage,
  '/fcs/factories/performance': FactoryPerformancePage,
  '/fcs/production/demand-inbox': DemandInboxPage,
  '/fcs/production/orders': OrdersPage,
  '/fcs/production/plan': ProductionPlanPage,
  '/fcs/production/delivery-warehouse': DeliveryWarehousePage,
  '/fcs/production/changes': ProductionChangesPage,
  '/fcs/production/status': ProductionStatusPage,
  '/fcs/production/create': PagePlaceholder,
  '/fcs/dispatch/board': DispatchBoardPage,
  '/fcs/dispatch/tenders': TendersPage,
  '/fcs/dispatch/award': AwardPage,
  '/fcs/dispatch/exceptions': DispatchExceptionsPage,
  '/fcs/progress/board': ProgressBoardPage,
  '/fcs/progress/exceptions': ExceptionsPage,
  '/fcs/progress/urge': UrgePage,
  '/fcs/progress/handover': HandoverPage,
  '/fcs/process/task-breakdown': TaskBreakdownPage,
  '/fcs/process/qc-standards': QcStandardsPage,
  '/fcs/process/material-issue': MaterialIssuePage,
  '/fcs/process/dye-print-orders': DyePrintOrdersPage,
  '/fcs/capacity/overview': CapacityOverviewPage,
  '/fcs/capacity/constraints': CapacityConstraintsPage,
  '/fcs/capacity/bottleneck': CapacityBottleneckPage,
  '/fcs/capacity/risk': CapacityRiskPage,
  '/fcs/capacity/policies': CapacityPoliciesPage,
  '/fcs/settlement/statements': StatementsPage,
  '/fcs/settlement/payment-sync': PaymentSyncPage,
  '/fcs/settlement/material-statements': MaterialStatementsPage,
  '/fcs/settlement/history': HistoryPage,
  '/fcs/settlement/batches': BatchesPage,
  '/fcs/settlement/adjustments': AdjustmentsPage,
  '/fcs/quality/rework': ReworkPage,
  '/fcs/quality/penalty-output': PenaltyOutputPage,
  '/fcs/quality/arbitration': ArbitrationPage,
  '/fcs/trace/unit-price': PagePlaceholder,
  '/fcs/trace/unique-codes': PagePlaceholder,
  '/fcs/trace/parent-codes': PagePlaceholder,
  '/fcs/trace/mapping': PagePlaceholder,
}

// Dynamic route patterns (order matters - more specific first)
const dynamicRoutes: Array<{
  pattern: RegExp
  component: React.ComponentType<any>
}> = [
  { pattern: /^\/fcs\/tech-pack\/([^/]+)$/, component: TechPackPageWrapper },
  { pattern: /^\/fcs\/production\/orders\/([^/]+)$/, component: OrderDetailPage },
  { pattern: /^\/fcs\/factories\/settlement\/([^/]+)$/, component: SettlementDetailPage },
]

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export function SpaPageRouter() {
  const pathname = useSpaPathname()

  const PageComponent = useMemo(() => {
    if (staticRoutes[pathname]) {
      return staticRoutes[pathname]
    }
    for (const route of dynamicRoutes) {
      if (route.pattern.test(pathname)) {
        return route.component
      }
    }
    return FactoryProfilePage
  }, [pathname])

  return (
    <Suspense fallback={<LoadingFallback />}>
      <PageComponent />
    </Suspense>
  )
}
