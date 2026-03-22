import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftCuttingPieceOrdersPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '裁片管理',
    title: '裁片单',
    description: '承接裁片单、唛架、铺布等裁剪执行主体的骨架页。',
    sections: [
      { title: '裁片单列表', description: '后续承接裁片单主列表与状态跟踪。' },
      { title: '唛架与铺布', description: '后续承接唛架方案、铺布信息与裁床配置。' },
      { title: '执行反馈', description: '后续承接裁剪产出、损耗和补数结果。' },
    ],
  })
}
