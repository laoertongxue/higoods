import { appStore } from '../../../../state/store.ts'
import { buildCuttingRouteWithContext } from '../navigation-context.ts'
import { getCanonicalCuttingPath } from '../meta.ts'
import { state, type TransferBagDetailTab } from './state.ts'

export function getCurrentTransferBagPathname(): string {
  return appStore.getState().pathname.split('?')[0] || getCanonicalCuttingPath('transfer-bags')
}

export function isTransferBagDetailPage(): boolean {
  return getCurrentTransferBagPathname() === getCanonicalCuttingPath('transfer-bag-detail')
}

export function buildTransferBagDetailRoute(options: {
  bagId?: string | null
  bagCode?: string | null
  usageId?: string | null
  usageNo?: string | null
  detailTab?: TransferBagDetailTab | null
  focusSection?: string | null
}): string {
  return buildCuttingRouteWithContext('transferBags', {
    ...(state.drillContext || {}),
    sourcePageKey: state.drillContext?.sourcePageKey || 'transfer-bags',
    bagId: options.bagId || undefined,
    bagCode: options.bagCode || undefined,
    usageId: options.usageId || undefined,
    usageNo: options.usageNo || undefined,
    autoOpenDetail: true,
    detailTab: options.detailTab || undefined,
    focusSection: options.focusSection || undefined,
  })
}

export function buildTransferBagListRoute(): string {
  if (!state.drillContext) return getCanonicalCuttingPath('transfer-bags')
  return buildCuttingRouteWithContext('transferBags', {
    ...state.drillContext,
    bagId: undefined,
    bagCode: undefined,
    usageId: undefined,
    usageNo: undefined,
    detailTab: undefined,
    focusSection: undefined,
  })
}
