import { escapeHtml } from '../../../utils'
import { listDyeFormulaRecords } from '../../../data/fcs/dyeing-task-domain.ts'
import { buildDyeingWorkOrderDetailLink, buildTaskDetailLink } from '../../../data/fcs/fcs-route-links.ts'
import {
  buildDyeingHref,
  getSelectedDyeOrderId,
  renderActionButton,
  renderPageHeader,
  renderSection,
} from './shared'

function renderFormulaList(selectedId: string): string {
  const rows = listDyeFormulaRecords()
    .map((record) => {
      const active = record.dyeOrderId === selectedId
      return `
        <tr class="border-b last:border-b-0 ${active ? 'bg-blue-50/70' : ''}">
          <td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.dyeOrderNo || '暂无数据')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.colorNo)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.rawMaterialSku)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.targetColor)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.formulaName)}</td>
          <td class="px-3 py-3 text-sm">${record.feedTotalQty} ${escapeHtml(record.feedUnit)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.taskNo || '暂无数据')}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.usageStatus)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(record.remark || '—')}</td>
          <td class="px-3 py-3">
            ${renderActionButton({
              label: '查看明细',
              action: 'navigate',
              attrs: { href: `${buildDyeingHref('/fcs/craft/dyeing/work-orders', record.dyeOrderId)}&tab=formula` },
            })}
          </td>
        </tr>
      `
    })
    .join('')

  return renderSection(
    '染色配方列表',
    `
      <div class="mb-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
        染色配方是染色加工单下的子信息；本入口仅保留为加工单配方视图的兼容展示。
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 font-medium">染色加工单号</th>
              <th class="px-3 py-2 font-medium">色号</th>
              <th class="px-3 py-2 font-medium">原料面料</th>
              <th class="px-3 py-2 font-medium">目标颜色</th>
              <th class="px-3 py-2 font-medium">配方</th>
              <th class="px-3 py-2 font-medium">投料</th>
              <th class="px-3 py-2 font-medium">关联任务</th>
              <th class="px-3 py-2 font-medium">使用状态</th>
              <th class="px-3 py-2 font-medium">备注</th>
              <th class="px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  )
}

function renderFormulaDetail(selectedId: string): string {
  const selected = listDyeFormulaRecords().find((record) => record.dyeOrderId === selectedId) || listDyeFormulaRecords()[0]
  if (!selected) {
    return renderSection('配方明细', '<div class="text-sm text-muted-foreground">暂无数据</div>')
  }

  return renderSection(
    '配方明细',
    `
      <div class="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <article class="rounded-lg border bg-background p-4 text-sm">
          <div class="grid grid-cols-2 gap-x-4 gap-y-2">
            <span class="text-xs text-muted-foreground">染色加工单号</span>
            <span class="text-xs font-medium">${escapeHtml(selected.dyeOrderNo || '暂无数据')}</span>
            <span class="text-xs text-muted-foreground">色号</span>
            <span class="text-xs">${escapeHtml(selected.colorNo)}</span>
            <span class="text-xs text-muted-foreground">原料面料</span>
            <span class="text-xs">${escapeHtml(selected.rawMaterialSku)}</span>
            <span class="text-xs text-muted-foreground">目标颜色</span>
            <span class="text-xs">${escapeHtml(selected.targetColor)}</span>
            <span class="text-xs text-muted-foreground">关联任务</span>
            <span class="text-xs">${escapeHtml(selected.taskNo || '暂无数据')}</span>
            <span class="text-xs text-muted-foreground">使用状态</span>
            <span class="text-xs">${escapeHtml(selected.usageStatus)}</span>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            ${renderActionButton({
              label: '打开移动端执行页',
              action: 'navigate',
              attrs: { href: selected.taskId ? buildTaskDetailLink(selected.taskId) : '' },
              disabled: !selected.taskId,
            })}
            ${renderActionButton({
              label: '查看加工单',
              action: 'navigate',
              attrs: { href: selected.dyeOrderId ? `${buildDyeingWorkOrderDetailLink(selected.dyeOrderId)}?tab=formula` : '' },
              disabled: !selected.dyeOrderId,
            })}
          </div>
        </article>
        <article class="rounded-lg border bg-background p-4">
          <div class="mb-3 text-sm font-medium">配方与投料</div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-xs text-muted-foreground">
                <tr>
                  <th class="px-3 py-2 font-medium">染料/助剂</th>
                  <th class="px-3 py-2 font-medium">编码</th>
                  <th class="px-3 py-2 font-medium">投料</th>
                  <th class="px-3 py-2 font-medium">备注</th>
                </tr>
              </thead>
              <tbody>
                ${selected.lines
                  .map(
                    (line) => `
                      <tr class="border-b last:border-b-0">
                        <td class="px-3 py-3 text-sm">${escapeHtml(line.materialName)}</td>
                        <td class="px-3 py-3 text-sm">${escapeHtml(line.materialCode)}</td>
                        <td class="px-3 py-3 text-sm">${line.feedQty} ${escapeHtml(line.feedUnit)}</td>
                        <td class="px-3 py-3 text-sm">${escapeHtml(line.note || '—')}</td>
                      </tr>
                    `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    `,
  )
}

export function renderCraftDyeingDyeOrdersPage(): string {
  const records = listDyeFormulaRecords()
  const selectedId = getSelectedDyeOrderId(records[0]?.dyeOrderId || '')

  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('染色配方', '染色配方归属于染色加工单，不作为独立主单。')}
      ${renderFormulaList(selectedId)}
      ${renderFormulaDetail(selectedId)}
    </div>
  `
}
