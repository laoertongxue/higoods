// 阶段性占位：本页将在阶段 5 / 步骤 2 正式建设，承接裁片仓库存与后道交接准备。
import { renderCraftCuttingPlaceholderPage } from './placeholder-page'

export function renderCraftCuttingCutPieceWarehousePage(): string {
  return renderCraftCuttingPlaceholderPage({
    pageKey: 'cut-piece-warehouse',
    phaseOwner: '将在后续阶段正式建设，补齐裁片仓库存、入仓分区与发后道追踪。',
    currentLimit: '当前仅完成菜单与路由占位，尚未接入裁片入仓明细、区位和后道签收记录。',
    futureScopes: ['裁片入仓与区位管理', '发后道与签收追踪', '与菲票 / 打编号、裁剪总结联动'],
    quickLinks: [
      { label: '返回生产单进度', href: '/fcs/craft/cutting/production-progress' },
      { label: '去裁片单（原始单）', href: '/fcs/craft/cutting/original-orders' },
      { label: '去周转口袋 / 车缝交接', href: '/fcs/craft/cutting/transfer-bags' },
    ],
  })
}
