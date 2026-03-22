import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftCuttingSummaryPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '裁片管理',
    title: '裁剪总结',
    description: '承接生产单裁剪总结、产出汇总和差异归因的骨架页。',
    sections: [
      { title: '产出总结', description: '后续承接生产单维度的裁剪产出结果。' },
      { title: '损耗分析', description: '后续承接裁剪损耗和差异归因。' },
      { title: '回传结果', description: '后续承接裁剪完成后的回传、交接和结算基础数据。' },
    ],
  })
}
