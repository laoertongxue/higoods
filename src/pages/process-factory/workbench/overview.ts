import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftWorkbenchOverviewPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '工作台',
    title: '总览',
    description: '聚合裁片、印花、染色三个工艺模块的当日任务、在制状态和关键提醒，作为工艺工厂运营系统的统一入口。',
    sections: [
      { title: '工艺总览', description: '后续承接工艺订单、工单和产出状态的聚合概况。' },
      { title: '待处理事项', description: '后续承接工艺审核、异常跟进、交接待办等内容。' },
      { title: '运营提醒', description: '后续承接工艺产能、交付和质量风险提示。' },
    ],
  })
}
