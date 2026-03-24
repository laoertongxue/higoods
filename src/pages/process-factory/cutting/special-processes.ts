// 阶段性占位：本页将在阶段 6 / 步骤 2 正式建设，承接裁片域特殊工艺对象。
import { renderCraftCuttingPlaceholderPage } from './placeholder-page'

export function renderCraftCuttingSpecialProcessesPage(): string {
  return renderCraftCuttingPlaceholderPage({
    pageKey: 'special-processes',
    phaseOwner: '将在后续阶段正式建设，补齐特殊工艺台账、触发条件与协同处理动作。',
    currentLimit: '当前仅完成菜单与路由占位，尚未接入特殊工艺对象、筛选器和跨工序联动。',
    futureScopes: ['特殊工艺台账与对象视图', '触发条件与异常收口', '与生产单进度、裁剪总结联动'],
    quickLinks: [
      { label: '返回生产单进度', href: '/fcs/craft/cutting/production-progress' },
      { label: '去补料管理', href: '/fcs/craft/cutting/replenishment' },
      { label: '去裁剪总结', href: '/fcs/craft/cutting/summary' },
    ],
  })
}
