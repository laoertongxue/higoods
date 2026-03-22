import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftCuttingWarehouseManagementPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '裁片管理',
    title: '仓库管理',
    description: '承接裁床仓、样衣仓、裁片仓三个仓库视图的统一骨架页。',
    sections: [
      { title: '裁床仓', description: '后续承接裁床仓在库、出入库和库存预警。' },
      { title: '样衣仓', description: '后续承接样衣在仓、移交和回收情况。' },
      { title: '裁片仓', description: '后续承接裁片在仓、待发和已交接状态。' },
    ],
  })
}
