import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftPrintingProgressPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '印花管理',
    title: '生产进度',
    description: '承接印花生产进度、在制状态和关键节点追踪的骨架页。',
    sections: [
      { title: '进度总览', description: '后续承接工单进度、在制量和延误提示。' },
      { title: '工序节点', description: '后续承接印花关键节点、交接和回货状态。' },
      { title: '异常提示', description: '后续承接延误、返工和待确认问题。' },
    ],
  })
}
