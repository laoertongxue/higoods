import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftCuttingOrderProgressPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '裁片管理',
    title: '订单进度',
    description: '承接裁片订单进度、生产裁片进度和相关交付节点的骨架页。',
    sections: [
      { title: '订单进度总览', description: '后续承接生产单在裁片环节的当前推进情况。' },
      { title: '裁片执行明细', description: '后续承接分单、排产、完成量与异常标记。' },
      { title: '交付节点', description: '后续承接交期、回仓和移交节点。' },
    ],
  })
}
