import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftCuttingReplenishmentPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '裁片管理',
    title: '补料管理',
    description: '承接补料计算、补料申请和审核处理的统一骨架页。',
    sections: [
      { title: '补料计算', description: '后续承接损耗、缺口与补料建议计算结果。' },
      { title: '补料申请', description: '后续承接补料申请单与审批轨迹。' },
      { title: '审核结果', description: '后续承接补料审核状态、回写和关闭结果。' },
    ],
  })
}
