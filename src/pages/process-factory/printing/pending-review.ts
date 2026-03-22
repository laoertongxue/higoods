import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftPrintingPendingReviewPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '印花管理',
    title: '待审核工单',
    description: '承接待审核印花工单、审核结果和回退处理的骨架页。',
    sections: [
      { title: '待审核列表', description: '后续承接待审核工单筛选和批量处理。' },
      { title: '审核要点', description: '后续承接审核维度、差异提示和判定依据。' },
      { title: '审核结果', description: '后续承接通过、驳回和回退结果。' },
    ],
  })
}
