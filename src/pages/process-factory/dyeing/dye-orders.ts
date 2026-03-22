import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftDyeingDyeOrdersPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '染色管理',
    title: '染料单',
    description: '承接染料单、配方、耗用和回写状态的骨架页。',
    sections: [
      { title: '染料单列表', description: '后续承接染料单主列表和状态跟踪。' },
      { title: '配方与用量', description: '后续承接染料配方、用量和替代关系。' },
      { title: '执行回写', description: '后续承接投料、耗用和回写结果。' },
    ],
  })
}
