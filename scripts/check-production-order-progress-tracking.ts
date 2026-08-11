import assert from 'node:assert/strict'
import { menusBySystem } from '../src/data/app-shell-config.ts'
import { routes } from '../src/router/routes-fcs.ts'
import { listProductionReturnReminderLogs } from '../src/data/fcs/production-return-fulfillment.ts'
import {
  closeProductionOrderProgressOverlay,
  handleProductionOrderProgressEvent,
  renderProductionOrderProgressTrackingPage,
} from '../src/pages/production-order-progress-tracking.ts'

function assertIncludes(source: string, expected: string, context: string): void {
  assert.ok(source.includes(expected), `${context} 缺少「${expected}」`)
}

function actionTarget(action: string, orderId: string): HTMLElement {
  return {
    closest: (selector: string) => selector.includes('data-progress-action')
      ? { dataset: { progressAction: action, orderId } }
      : null,
  } as unknown as HTMLElement
}

function fieldTarget(field: string, value: string): HTMLElement {
  return {
    closest: (selector: string) => selector.includes('data-progress-field')
      ? { dataset: { progressField: field }, value }
      : null,
  } as unknown as HTMLElement
}

async function main(): Promise<void> {
  const progressGroup = (menusBySystem.fcs ?? [])
    .flatMap((group) => group.items)
    .find((item) => item.key === 'fcs-platform-progress')
  assert.ok(progressGroup, '未找到任务进度与异常菜单组')
  assert.deepEqual(
    progressGroup.children?.slice(0, 2).map((item) => [item.title, item.href]),
    [
      ['生产单进度跟踪', '/fcs/production_order_track/index'],
      ['任务进度跟踪', '/fcs/progress/board'],
    ],
    '生产单进度跟踪应当沿用线上入口并排在任务进度跟踪之前',
  )
  assert.ok(routes.exactRoutes['/fcs/production_order_track/index'], '缺少线上同名生产单进度跟踪路由')
  assert.ok(routes.exactRoutes['/fcs/progress/production-orders'], '缺少原型历史地址兼容路由')

  const reminderCountBeforeRender = listProductionReturnReminderLogs().length
  const listHtml = renderProductionOrderProgressTrackingPage()
  renderProductionOrderProgressTrackingPage()
  assert.equal(
    listProductionReturnReminderLogs().length,
    reminderCountBeforeRender,
    '列表渲染只能读取提醒事实，不得在渲染过程中重复写入提醒',
  )
  ;[
    '生产单进度跟踪',
    '跟踪生产单全生命周期进度，从备料到交付的每个节点一目了然',
    '生产单号/SPU', '起版', '状态', '风险等级', '是否有节点', '车缝是否分配', '售卖类型',
    '染色状态', '印花状态', '裁片单状态', '送去工厂时间', '生产下单时间', '下单数量',
    '回货履约', '合同状态', '履约数据不完整', '已逾期', '今日到期', '明日到期', '即将到期', '已达成', '无分阶段回货规则', '竞价中',
    '基础信息', '工序进度', '数据流转', '状态', '加工厂 / 回货履约', '时间', '印染状态', '物料采购', '库存物料', '操作',
    '20 条/页', '共 43 条，第 1 页 / 共 3 页', 'PO16234', 'PO16215',
    '万隆车缝厂', '第8自然日 · 70%', '另有 1 家工厂', '详情', '展开', '款式实拍图', '物料实拍图',
  ].forEach((text) => assertIncludes(listHtml, text, '线上基线列表'))
  ;['违反回货规则', '最近节点', '车缝加工厂'].forEach((legacy) => {
    assert.ok(!listHtml.includes(legacy), `列表不应残留旧回货表达「${legacy}」`)
  })
  assert.ok(!listHtml.includes('PO16214'), '第一页固定 20 条，不应渲染第 21 条')
  assert.equal((listHtml.match(/data-progress-action="detail"/g) ?? []).length, 20, '第一页应渲染 20 个详情入口')
  assert.equal((listHtml.match(/data-progress-action="expand"/g) ?? []).length, 20, '第一页应渲染 20 个展开入口')
  ;['进行中生产单', '临期生产单', '多泳道进度矩阵', '导出生产单列表'].forEach((legacy) => {
    assert.ok(!listHtml.includes(legacy), `线上基线页不应残留旧原型结构「${legacy}」`)
  })

  const previousDocument = globalThis.document
  globalThis.document = {
    querySelector: () => ({ outerHTML: '' }),
  } as unknown as Document
  try {
    assert.equal(handleProductionOrderProgressEvent(fieldTarget('returnStatus', 'OVERDUE')), true, '已逾期筛选应被处理')
    const overdueHtml = renderProductionOrderProgressTrackingPage()
    assertIncludes(overdueHtml, '共 1 条，第 1 页 / 共 1 页', '已逾期筛选结果')
    assertIncludes(overdueHtml, 'PO16234', '已逾期筛选结果')
    assert.ok(!overdueHtml.includes('PO16233'), '已逾期筛选不得混入即将到期生产单')

    assert.equal(handleProductionOrderProgressEvent(fieldTarget('returnStatus', 'BIDDING')), true, '竞价中筛选应被处理')
    const biddingHtml = renderProductionOrderProgressTrackingPage()
    assertIncludes(biddingHtml, '共 1 条，第 1 页 / 共 1 页', '竞价中筛选结果')
    assertIncludes(biddingHtml, 'PO16230', '竞价中筛选结果')
    assert.ok(!biddingHtml.includes('PO16234'), '竞价中筛选不得混入已逾期生产单')

    assert.equal(handleProductionOrderProgressEvent(actionTarget('reset', '')), true, '重置筛选应被处理')
    assertIncludes(renderProductionOrderProgressTrackingPage(), '共 43 条，第 1 页 / 共 3 页', '重置筛选结果')

    assert.equal(handleProductionOrderProgressEvent(actionTarget('expand', 'PO16234')), true, '展开动作应被处理')
    const expandedHtml = renderProductionOrderProgressTrackingPage()
    ;[
      '生产单详情', '关键时间', '异常与提醒', '关联', '合同与回货履约（按加工厂）',
      '回货规则：', '自然日；分配日为第1天；合同不打印具体时间',
      '万隆车缝厂', '棉兰卫星车缝厂',
      '截止前1天提醒', '截止当天提醒', '仅累计本工厂/本分配记录',
      '质检、复检是流程节点，不改变到货确认日期', '原工厂回货仍归原分配，不与新工厂互相抵扣',
    ].forEach((text) => assertIncludes(expandedHtml, text, '生产单展开详情'))

    assert.equal(handleProductionOrderProgressEvent(actionTarget('detail', 'PO16234')), true, '详情动作应被处理')
    const detailHtml = renderProductionOrderProgressTrackingPage()
    assertIncludes(detailHtml, 'PO16234 生产进度详情', '生产单详情弹窗')
    assertIncludes(detailHtml, '沿用线上生产单详情/展开结构，并补充合同与回货履约', '生产单详情弹窗')
    assert.equal(closeProductionOrderProgressOverlay(), true, 'Esc关闭入口应优先关闭生产单详情')
    assert.ok(!renderProductionOrderProgressTrackingPage().includes('PO16234 生产进度详情'), 'Esc关闭后不得残留生产单详情')

    assert.equal(handleProductionOrderProgressEvent(actionTarget('preview-image', 'PO16234')), true, '款式大图动作应被处理')
    assertIncludes(renderProductionOrderProgressTrackingPage(), '高清大图', '款式大图预览')
    assert.equal(closeProductionOrderProgressOverlay(), true, 'Esc关闭入口应关闭款式大图')
    assert.ok(!renderProductionOrderProgressTrackingPage().includes('高清大图'), 'Esc关闭后不得残留款式大图')
  } finally {
    globalThis.document = previousDocument
  }

  console.log([
    '生产单进度跟踪专项验收通过',
    '线上基线：筛选区、20条分页、10列表格、详情/展开入口',
    '本轮增量：列表直接展示主加工厂回货节点、目标/已确认/缺口、提醒状态与其他工厂数量',
    '履约口径：自然日、分配日第1天、三次提醒、到货确认日、原/新工厂不抵扣',
    '渲染边界：列表和详情仅读取共享回货事实，渲染过程中不生成提醒记录',
  ].join('\n'))
}

void main()
