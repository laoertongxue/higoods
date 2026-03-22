import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftDyeingReportsPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '染色管理',
    title: '染色报表',
    description: '承接染色产量、损耗、回货和工厂对比报表的骨架页。',
    sections: [
      { title: '产量报表', description: '后续承接染色产量、完成量和在制报表。' },
      { title: '损耗报表', description: '后续承接损耗、返工和差异分析。' },
      { title: '工厂对比', description: '后续承接工厂维度的产出和质量对比。' },
    ],
  })
}
