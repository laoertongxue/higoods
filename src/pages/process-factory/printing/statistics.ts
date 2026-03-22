import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftPrintingStatisticsPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '印花管理',
    title: '数据统计',
    description: '承接印花订单、工单、产出和损耗统计的骨架页。',
    sections: [
      { title: '产量统计', description: '后续承接日、周、月维度的印花产量统计。' },
      { title: '损耗统计', description: '后续承接损耗、返修和不良比例统计。' },
      { title: '效率分析', description: '后续承接工厂、班组或设备效率对比。' },
    ],
  })
}
