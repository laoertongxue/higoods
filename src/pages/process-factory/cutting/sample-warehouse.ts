// 阶段性占位：本页将在阶段 5 / 步骤 3 正式建设，承接样衣仓对象与流转记录。
import { renderCraftCuttingPlaceholderPage } from './placeholder-page'

export function renderCraftCuttingSampleWarehousePage(): string {
  return renderCraftCuttingPlaceholderPage({
    pageKey: 'sample-warehouse',
    phaseOwner: '将在后续阶段正式建设，补齐样衣仓库存、归还登记和超期追踪。',
    currentLimit: '当前仅完成菜单与路由占位，尚未接入样衣仓库存、借出单和归还确认记录。',
    futureScopes: ['样衣仓库存与状态', '借出 / 归还与超期提醒', '与裁片仓、裁剪总结联动'],
    quickLinks: [
      { label: '返回生产单进度', href: '/fcs/craft/cutting/production-progress' },
      { label: '去裁剪总结', href: '/fcs/craft/cutting/summary' },
      { label: '去周转口袋 / 车缝交接', href: '/fcs/craft/cutting/transfer-bags' },
    ],
  })
}
