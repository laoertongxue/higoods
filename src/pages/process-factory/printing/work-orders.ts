import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftPrintingWorkOrdersPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '印花管理',
    title: '印花工单',
    description: '承接印花工单主列表、状态跟踪和工单详情入口的骨架页。',
    sections: [
      { title: '工单列表', description: '后续承接印花工单查询、状态和承接主体。' },
      { title: '工艺执行', description: '后续承接印花执行节点、产出和回货信息。' },
      { title: '工单详情', description: '后续承接创建、编辑、查看等页内动作入口。' },
    ],
  })
}
