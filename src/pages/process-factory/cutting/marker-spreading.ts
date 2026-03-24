// 阶段性占位：本页将在阶段 3 / 步骤 1 正式建设，承接唛架与铺布对象。
import { renderCraftCuttingPlaceholderPage } from './placeholder-page'

export function renderCraftCuttingMarkerSpreadingPage(): string {
  return renderCraftCuttingPlaceholderPage({
    pageKey: 'marker-spreading',
    phaseOwner: '将在后续阶段正式建设，补齐唛架维护、铺布计划与铺布记录联动。',
    currentLimit: '当前仅完成菜单与路由占位，尚未接入唛架版本、铺布参数与现场回写记录。',
    futureScopes: ['唛架维护与版本管理', '铺布计划与执行记录', '与原始裁片单、仓库配料联动'],
    quickLinks: [
      { label: '返回生产单进度', href: '/fcs/craft/cutting/production-progress' },
      { label: '去裁片单（原始单）', href: '/fcs/craft/cutting/original-orders' },
      { label: '去仓库配料 / 领料', href: '/fcs/craft/cutting/material-prep' },
    ],
  })
}
