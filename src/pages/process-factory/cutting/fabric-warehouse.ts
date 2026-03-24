// 阶段性占位：本页将在阶段 5 / 步骤 1 正式建设，承接裁床仓库存对象。
import { renderCraftCuttingPlaceholderPage } from './placeholder-page'

export function renderCraftCuttingFabricWarehousePage(): string {
  return renderCraftCuttingPlaceholderPage({
    pageKey: 'fabric-warehouse',
    phaseOwner: '将在后续阶段正式建设，补齐裁床仓库存视图、待裁出入仓和现场签收记录。',
    currentLimit: '当前仅完成菜单与路由占位，尚未接入裁床仓库存、库位和交接明细。',
    futureScopes: ['裁床仓库存视图', '待裁发料与签收', '与生产单进度、仓库配料联动'],
    quickLinks: [
      { label: '返回生产单进度', href: '/fcs/craft/cutting/production-progress' },
      { label: '去仓库配料 / 领料', href: '/fcs/craft/cutting/material-prep' },
      { label: '去裁片仓', href: '/fcs/craft/cutting/cut-piece-warehouse' },
    ],
  })
}
