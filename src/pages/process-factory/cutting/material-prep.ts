import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftCuttingMaterialPrepPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '裁片管理',
    title: '仓库配料',
    description: '承接配料、领料、二维码流转等仓库配料相关内容的骨架页。',
    sections: [
      { title: '配料任务', description: '后续承接按订单、颜色或批次维度的配料任务。' },
      { title: '领料与出库', description: '后续承接配料领用、仓内移交和出库状态。' },
      { title: '流转追踪', description: '后续承接二维码流转、收发和差异提示。' },
    ],
  })
}
