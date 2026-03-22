import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftPrintingDashboardsPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '印花管理',
    title: '生产大屏',
    description: '承接印花综合大屏与 24 小时大屏切换视图的统一骨架页。',
    sections: [
      { title: '综合大屏', description: '后续承接工单、产出、异常和设备态势的大屏视图。' },
      { title: '24小时视图', description: '后续承接 24 小时产出与节拍监控。' },
      { title: '关键指标', description: '后续承接实时产量、在制、延误和预警指标。' },
    ],
  })
}
