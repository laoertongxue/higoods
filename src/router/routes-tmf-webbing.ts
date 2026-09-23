import type { RouteRegistry } from './route-types'

function createAsyncRenderer<TArgs extends unknown[]>(
  importModule: () => Promise<Record<string, unknown>>,
  exportName: string,
): (...args: TArgs) => Promise<string> {
  let modulePromise: Promise<Record<string, unknown>> | null = null

  return async (...args: TArgs): Promise<string> => {
    if (!modulePromise) {
      modulePromise = importModule().catch((error) => {
        modulePromise = null
        throw error
      })
    }

    const renderer = (await modulePromise)[exportName]
    if (typeof renderer !== 'function') {
      throw new Error(`页面渲染函数不存在: ${exportName}`)
    }
    return (renderer as (...rendererArgs: unknown[]) => Promise<string>)(...args)
  }
}

const renderTmfSemiFinishedFlowPage = createAsyncRenderer<['purchase-demands' | 'semi-finished-orders']>(
  () => import('../pages/process-factory/accessory/webbing/semi-finished-orders'),
  'renderTmfSemiFinishedFlowPage',
)
const renderTmfWorkOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/accessory/webbing/work-orders'),
  'renderTmfWorkOrdersPage',
)
const renderTmfPendingReceiptsPage = createAsyncRenderer(
  () => import('../pages/process-factory/accessory/webbing/pending-receipts'),
  'renderTmfPendingReceiptsPage',
)
const renderTmfHandoverRecordsPage = createAsyncRenderer(
  () => import('../pages/process-factory/accessory/webbing/handover-records'),
  'renderTmfHandoverRecordsPage',
)
const renderTmfPdaExecution = createAsyncRenderer(
  () => import('../pages/process-factory/accessory/webbing/pda-execution'),
  'renderTmfPdaExecution',
)
const renderTmfWorkOrderDetailPage = createAsyncRenderer<[string]>(
  () => import('../pages/process-factory/accessory/webbing/work-order-detail'),
  'renderTmfWorkOrderDetailPage',
)

export const routes: RouteRegistry = {
  exactRoutes: {
    '/fcs/craft/accessory/webbing/purchase-demands': () => renderTmfSemiFinishedFlowPage('purchase-demands'),
    '/fcs/craft/accessory/webbing/semi-finished-orders': () => renderTmfSemiFinishedFlowPage('semi-finished-orders'),
    '/fcs/craft/accessory/webbing/work-orders': () => renderTmfWorkOrdersPage(),
    '/fcs/craft/accessory/webbing/pending-receipts': () => renderTmfPendingReceiptsPage(),
    '/fcs/craft/accessory/webbing/handover-records': () => renderTmfHandoverRecordsPage(),
    '/fcs/craft/accessory/webbing/pda': () => renderTmfPdaExecution(),
  },
  dynamicRoutes: [
    {
      pattern: /^\/fcs\/craft\/accessory\/webbing\/work-orders\/([^/?]+)(?:\?.*)?$/,
      render: (match) => renderTmfWorkOrderDetailPage(decodeURIComponent(match[1])),
    },
  ],
}
