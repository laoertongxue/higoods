// 阶段性占位：本页将在阶段 4 / 步骤 1 正式建设，承接菲票 / 打编号链路。
import { renderCraftCuttingPlaceholderPage } from './placeholder-page'

export function renderCraftCuttingFeiTicketsPage(): string {
  return renderCraftCuttingPlaceholderPage({
    pageKey: 'fei-tickets',
    phaseOwner: '将在后续阶段正式建设，补齐菲票打印、编号回写与原始裁片单追溯链路。',
    currentLimit: '当前仅完成菜单与路由占位，尚未接入菲票明细、打印批次和编号回落关系。',
    futureScopes: ['菲票打印入口与编号规则', '原始裁片单回落追溯', '与合并裁剪批次的执行上下文联动'],
    quickLinks: [
      { label: '返回生产单进度', href: '/fcs/craft/cutting/production-progress' },
      { label: '去裁片单（原始单）', href: '/fcs/craft/cutting/original-orders' },
      { label: '去合并裁剪批次', href: '/fcs/craft/cutting/merge-batches' },
    ],
  })
}
