import { renderProcessFactoryScaffoldPage } from '../shared'

export function renderCraftDyeingWorkOrdersPage(): string {
  return renderProcessFactoryScaffoldPage({
    category: '染色管理',
    title: '染色工单',
    description: '承接染色工单主列表、状态跟踪和工单详情入口的骨架页。',
    sections: [
      { title: '工单列表', description: '后续承接染色工单查询、筛选和状态管理。' },
      { title: '执行节点', description: '后续承接染色执行、回货和交接节点。' },
      { title: '工单详情', description: '后续承接创建、编辑和查看等页内动作。' },
    ],
  })
}
