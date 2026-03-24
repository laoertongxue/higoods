// 阶段性占位：本页将在阶段 5 / 步骤 4 正式建设，承接周转口袋主档与车缝交接追溯。
import { renderCraftCuttingPlaceholderPage } from './placeholder-page'

export function renderCraftCuttingTransferBagsPage(): string {
  return renderCraftCuttingPlaceholderPage({
    pageKey: 'transfer-bags',
    phaseOwner: '将在后续阶段正式建设，补齐周转口袋主档、父子码映射与车缝交接追溯。',
    currentLimit: '当前仅完成菜单与路由占位，尚未接入载具编码、单次使用周期和交接追踪链路。',
    futureScopes: ['周转口袋主档与编码', '扫描载具码 + 菲票父子映射', '发出 / 签收 / 回仓 / 复用周期追溯'],
    quickLinks: [
      { label: '返回生产单进度', href: '/fcs/craft/cutting/production-progress' },
      { label: '去裁片仓', href: '/fcs/craft/cutting/cut-piece-warehouse' },
      { label: '去裁剪总结', href: '/fcs/craft/cutting/summary' },
    ],
  })
}
