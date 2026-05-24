import { listGeneratedCutOrderSourceRecords, type GeneratedCutOrderSourceRecord } from '../../../data/fcs/cutting/generated-cut-orders.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderMaterialIdentityBlock } from './material-identity.ts'
import type {
  BindingProcessAbnormalItem,
  BindingProcessMode,
  BindingProcessOrder,
  BindingProcessStatus,
} from './special-processes-model.ts'

const numberFormatter = new Intl.NumberFormat('zh-CN')

const statusToneMap: Record<BindingProcessStatus, string> = {
  待加工: 'border-slate-200 bg-slate-50 text-slate-700',
  加工中: 'border-blue-200 bg-blue-50 text-blue-700',
  已完成: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  异常处理中: 'border-rose-200 bg-rose-50 text-rose-700',
  已入库: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  已取消: 'border-zinc-200 bg-zinc-50 text-zinc-700',
}

const modeToneMap: Record<BindingProcessMode, string> = {
  裁床内部加工: 'border-sky-200 bg-sky-50 text-sky-700',
  外部承接工厂加工: 'border-violet-200 bg-violet-50 text-violet-700',
}

function formatNumber(value: number): string {
  return numberFormatter.format(Math.max(0, Number(value || 0)))
}

function formatLength(value: number): string {
  return `${Number(value || 0).toFixed(1)} 米`
}

function formatRate(value: number): string {
  return `${Number(value || 0).toFixed(1)}%`
}

function renderBadge(label: string, className = 'border-slate-200 bg-slate-50 text-slate-700'): string {
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`
}

function buildMaterialIdentity(source: GeneratedCutOrderSourceRecord): BindingProcessOrder['materialIdentity'] {
  return {
    materialSku: source.materialIdentity?.materialSku || source.materialSku,
    materialName: source.materialIdentity?.materialName || source.materialName || source.materialSku,
    materialColor: source.materialIdentity?.materialColor || source.materialColor || '按裁片单',
    materialAlias: source.materialIdentity?.materialAlias || source.materialAlias || '技术包别名待补',
    materialImageUrl: source.materialIdentity?.materialImageUrl || source.materialImageUrl || '',
    materialUnit: source.materialIdentity?.materialUnit || source.materialUnit || '米',
  }
}

function buildPatternIdentity(source: GeneratedCutOrderSourceRecord): BindingProcessOrder['patternIdentity'] {
  const pattern = source.patternIdentity
  return {
    patternFileId: pattern?.patternFileId || source.patternIdentity?.patternFileName || `${source.cutOrderId}-pattern`,
    patternFileName: pattern?.patternFileName || '纸样文件待补',
    patternVersion: pattern?.patternVersion || '纸样版本待补',
    patternKind: pattern?.patternKind || '布料纸样',
    effectiveWidthText:
      pattern?.effectiveWidthValue && pattern?.effectiveWidthUnit
        ? `${pattern.effectiveWidthValue}${pattern.effectiveWidthUnit}`
        : '有效幅宽待补',
    piecePartNames: pattern?.piecePartNames?.length
      ? pattern.piecePartNames
      : source.pieceRows.map((piece) => piece.partName).filter(Boolean),
  }
}

function buildAbnormalItems(seedKey: string, orderNo: string): BindingProcessAbnormalItem[] {
  if (seedKey === 'actual-short') {
    return [
      {
        abnormalId: `${orderNo}-ABN-LEN`,
        abnormalType: '实际长度小于计划长度',
        abnormalLevel: '需处理',
        description: '实际捆条长度低于计划长度，需进入补料管理判断是否补料、补录或继续补排。',
        targetModule: '补料管理',
        handlingStatus: '待处理',
        reportedAt: '2026-05-18 16:20',
        reportedBy: '裁床组长 梁敏',
      },
    ]
  }
  if (seedKey === 'loss-high') {
    return [
      {
        abnormalId: `${orderNo}-ABN-LOSS`,
        abnormalType: '损耗率超阈值',
        abnormalLevel: '紧急',
        description: '损耗率超过 8% 原型阈值，需进入裁剪结果核查追踪来源面料和操作记录。',
        targetModule: '裁剪结果核查',
        handlingStatus: '待处理',
        reportedAt: '2026-05-19 11:30',
        reportedBy: '裁床核查员 周静',
      },
    ]
  }
  return []
}

function buildBindingOrder(source: GeneratedCutOrderSourceRecord, index: number): BindingProcessOrder {
  const seed = [
    { mode: '裁床内部加工' as const, status: '已入库' as const, key: 'normal-inbound' },
    { mode: '裁床内部加工' as const, status: '异常处理中' as const, key: 'actual-short' },
    { mode: '裁床内部加工' as const, status: '异常处理中' as const, key: 'loss-high' },
    { mode: '裁床内部加工' as const, status: '已完成' as const, key: 'done-pending-inbound' },
    { mode: '外部承接工厂加工' as const, status: '待加工' as const, key: 'external-aux' },
    { mode: '外部承接工厂加工' as const, status: '已完成' as const, key: 'external-returned' },
    { mode: '裁床内部加工' as const, status: '加工中' as const, key: 'in-progress' },
    { mode: '裁床内部加工' as const, status: '待加工' as const, key: 'pending' },
  ][index % 8]

  const plannedLength = 180 + index * 34
  const bindingWidth = [1.2, 1.5, 1.8, 2.0][index % 4]
  const plannedOutputQty = 540 + index * 90
  const actualLength =
    seed.key === 'actual-short'
      ? plannedLength * 0.78
      : seed.key === 'loss-high'
        ? plannedLength * 0.96
        : seed.mode === '外部承接工厂加工' && seed.key !== 'external-returned'
          ? 0
          : seed.status === '待加工'
            ? 0
            : plannedLength * 0.94
  const lossLength =
    seed.key === 'loss-high'
      ? plannedLength * 0.13
      : seed.key === 'actual-short'
        ? plannedLength - actualLength
        : seed.status === '待加工'
          ? 0
          : plannedLength - actualLength
  const lossRate = plannedLength ? (lossLength / plannedLength) * 100 : 0
  const abnormalItems = buildAbnormalItems(seed.key, `BT-${String(index + 1).padStart(3, '0')}`)
  const bindingOrderId = `binding-${source.cutOrderId}-${index + 1}`
  const bindingOrderNo = `BT-${String(source.productionOrderNo || source.productionOrderId).replace(/^PO-/, '')}-${String(index + 1).padStart(2, '0')}`
  const isExternal = seed.mode === '外部承接工厂加工'

  return {
    bindingOrderId,
    bindingOrderNo,
    processType: '捆条',
    processMode: seed.mode,
    sourceCutOrderId: source.cutOrderId,
    sourceCutOrderNo: source.cutOrderNo,
    sourceProductionOrderId: source.productionOrderId,
    sourceProductionOrderNo: source.productionOrderNo,
    sourceSpreadingOrderId: `SPRD-${String(index + 1).padStart(3, '0')}`,
    sourceSpreadingOrderNo: `铺布单-${String(index + 1).padStart(3, '0')}`,
    sourceFeiTicketIds: [`fei-${source.cutOrderId}-${index + 1}`],
    sourceFeiTicketNos: [`FT-${String(index + 1).padStart(4, '0')}`],
    materialIdentity: buildMaterialIdentity(source),
    patternIdentity: buildPatternIdentity(source),
    bindingWidth,
    plannedLength,
    actualLength,
    lossLength,
    lossRate,
    plannedOutputQty,
    actualOutputQty: actualLength > 0 ? Math.round(plannedOutputQty * Math.min(actualLength / plannedLength, 1)) : 0,
    unit: '米',
    operatorName: isExternal ? '' : ['李秀兰', '陈芳', '周海', '郭敏'][index % 4],
    startedAt: seed.status === '待加工' ? '' : `2026-05-${String(14 + index).padStart(2, '0')} 09:20`,
    completedAt: ['已完成', '已入库'].includes(seed.status) ? `2026-05-${String(15 + index).padStart(2, '0')} 16:40` : '',
    status: seed.status,
    costItems: isExternal
      ? []
      : [
          {
            costItemId: `${bindingOrderId}-labor`,
            costType: '人工',
            amount: Math.round((actualLength || plannedLength) * 0.32),
            unit: '元',
            remark: '按实际加工长度估算',
          },
          {
            costItemId: `${bindingOrderId}-loss`,
            costType: '损耗',
            amount: Math.round(lossLength * 1.8),
            unit: '元',
            remark: '按损耗长度估算',
          },
        ],
    abnormalItems,
    inboundInventoryRecordIds: seed.status === '已入库' || seed.key === 'external-returned' ? [`INV-BIND-${String(index + 1).padStart(3, '0')}`] : [],
    linkedReplenishmentIds: abnormalItems.some((item) => item.targetModule === '补料管理') ? [`RP-BIND-${String(index + 1).padStart(3, '0')}`] : [],
    linkedCheckItemIds: abnormalItems.some((item) => item.targetModule === '裁剪结果核查') ? [`CHECK-BIND-${String(index + 1).padStart(3, '0')}`] : [],
    externalReceiverFactoryName:
      seed.key === 'external-aux'
        ? '辅助工艺厂 A'
        : seed.key === 'external-returned'
          ? '特种工艺厂 B'
          : '',
    externalHandoverOrderNo: isExternal ? `HO-SC-${String(index + 1).padStart(3, '0')}` : '',
    externalHandoverRecordNo: isExternal ? `HR-SC-${String(index + 1).padStart(3, '0')}-01` : '',
    externalReturnStatus: seed.key === 'external-returned' ? '已回仓' : seed.key === 'external-aux' ? '待回仓' : '',
    remark: isExternal
      ? '外部承接工厂加工不使用内部捆条加工单完成全流程，必须走通用交出单、交出记录和特殊工艺回仓。'
      : '裁床内部捆条加工结果进入裁床待交出仓库存或对应裁片库存。',
  }
}

export function buildBindingProcessOrders(): BindingProcessOrder[] {
  return listGeneratedCutOrderSourceRecords().slice(0, 12).map(buildBindingOrder)
}

function getBindingOrderById(bindingOrderId?: string): BindingProcessOrder {
  const rows = buildBindingProcessOrders()
  return rows.find((row) => row.bindingOrderId === bindingOrderId) || rows[0]
}

function renderSourceSummary(row: BindingProcessOrder): string {
  return `
    <div class="space-y-1 text-xs text-muted-foreground">
      <p><span class="text-foreground">生产单：</span>${escapeHtml(row.sourceProductionOrderNo)}</p>
      <p><span class="text-foreground">来源裁片单：</span>${escapeHtml(row.sourceCutOrderNo)}</p>
      <p><span class="text-foreground">来源铺布单：</span>${escapeHtml(row.sourceSpreadingOrderNo)}</p>
      <p><span class="text-foreground">菲票：</span>${escapeHtml(row.sourceFeiTicketNos.join(' / '))}</p>
    </div>
  `
}

function renderPatternSummary(row: BindingProcessOrder): string {
  return `
    <div class="mt-2 text-xs text-muted-foreground">
      <p>纸样：${escapeHtml(row.patternIdentity.patternFileName)}</p>
      <p class="mt-1">${escapeHtml([row.patternIdentity.patternVersion, row.patternIdentity.effectiveWidthText].filter(Boolean).join(' / '))}</p>
      <p class="mt-1 line-clamp-2">部位：${escapeHtml(row.patternIdentity.piecePartNames.slice(0, 4).join('、') || '部位待补')}</p>
    </div>
  `
}

function renderProcessData(row: BindingProcessOrder): string {
  return `
    <div class="grid gap-1 text-xs text-muted-foreground">
      <span>捆条宽度：${escapeHtml(`${row.bindingWidth} cm`)}</span>
      <span>计划长度：${escapeHtml(formatLength(row.plannedLength))}</span>
      <span>实际长度：${escapeHtml(row.actualLength ? formatLength(row.actualLength) : '待回写')}</span>
      <span class="${row.lossRate > 8 ? 'font-medium text-rose-600' : ''}">损耗：${escapeHtml(formatLength(row.lossLength))} / ${escapeHtml(formatRate(row.lossRate))}</span>
      <span>实际产出数量：${escapeHtml(`${formatNumber(row.actualOutputQty)} 米`)}</span>
    </div>
  `
}

function renderFollowupSummary(row: BindingProcessOrder): string {
  if (row.processMode === '外部承接工厂加工') {
    return `
      <div class="space-y-1 text-xs text-muted-foreground">
        <p>外部流程：走特殊工艺交出</p>
        <p>承接工厂：${escapeHtml(row.externalReceiverFactoryName || '承接工厂待补')}</p>
        <p>通用交出单：${escapeHtml(row.externalHandoverOrderNo || '待生成')}</p>
        <p>交出记录：${escapeHtml(row.externalHandoverRecordNo || '待生成')}</p>
        <p>回仓状态：${escapeHtml(row.externalReturnStatus || '待回仓')}</p>
      </div>
    `
  }
  return `
    <div class="space-y-1 text-xs text-muted-foreground">
      <p>入库状态：${escapeHtml(row.inboundInventoryRecordIds.length ? '已进入裁床待交出仓库存' : row.status === '已完成' ? '待入库' : '未完成')}</p>
      <p>库存记录：${escapeHtml(row.inboundInventoryRecordIds.join(' / ') || '暂无')}</p>
      <p>补料关联：${escapeHtml(row.linkedReplenishmentIds.join(' / ') || '无')}</p>
      <p>核查关联：${escapeHtml(row.linkedCheckItemIds.join(' / ') || '无')}</p>
    </div>
  `
}

function renderAbnormalSummary(row: BindingProcessOrder): string {
  if (!row.abnormalItems.length) return renderBadge('无异常', 'border-emerald-200 bg-emerald-50 text-emerald-700')
  return row.abnormalItems
    .map((item) => renderBadge(`${item.abnormalType} / ${item.targetModule}`, item.abnormalLevel === '紧急' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700'))
    .join('')
}

function renderOrderCard(row: BindingProcessOrder): string {
  const detailHref = `/fcs/craft/cutting/special-processes/${encodeURIComponent(row.bindingOrderId)}`
  return `
    <article class="rounded-lg border bg-card p-4">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            ${renderBadge(row.status, statusToneMap[row.status])}
            ${renderBadge(row.processMode, modeToneMap[row.processMode])}
          </div>
          <p class="mt-2 font-semibold text-foreground">${escapeHtml(row.bindingOrderNo)}</p>
          <p class="mt-1 text-xs text-muted-foreground">加工单不改变裁片单主状态</p>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-medium text-muted-foreground">来源对象</p>
          <div class="mt-2">${renderSourceSummary(row)}</div>
        </div>
        <div class="min-w-0">
          ${renderMaterialIdentityBlock(
            {
              materialSku: row.materialIdentity.materialSku,
              materialLabel: row.materialIdentity.materialName,
              materialAlias: row.materialIdentity.materialAlias,
              materialImageUrl: row.materialIdentity.materialImageUrl,
            },
            { compact: true, imageSizeClass: 'h-9 w-9' },
          )}
          <p class="mt-1 text-xs text-muted-foreground">颜色：${escapeHtml(row.materialIdentity.materialColor)}</p>
          ${renderPatternSummary(row)}
        </div>
        <div class="min-w-0">
          <p class="text-xs font-medium text-muted-foreground">加工数据</p>
          <div class="mt-2">${renderProcessData(row)}</div>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-medium text-muted-foreground">后续与异常</p>
          <div class="mt-2 flex flex-wrap gap-1">${renderAbnormalSummary(row)}</div>
          <div class="mt-2">${renderFollowupSummary(row)}</div>
        </div>
        <div class="flex shrink-0 flex-col gap-2">
          <a href="${escapeHtml(detailHref)}" data-nav="${escapeHtml(detailHref)}" class="rounded-md border px-3 py-2 text-center text-xs hover:bg-muted">查看</a>
          ${
            row.processMode === '裁床内部加工'
              ? `
                <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-cutting-binding-action="start" data-row-id="${escapeHtml(row.bindingOrderId)}">开始加工</button>
                <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-cutting-binding-action="complete" data-row-id="${escapeHtml(row.bindingOrderId)}">完成加工</button>
                <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-cutting-binding-action="inbound" data-row-id="${escapeHtml(row.bindingOrderId)}">入库</button>
              `
              : `
                <a href="/fcs/craft/cutting/handover-orders" data-nav="/fcs/craft/cutting/handover-orders" class="rounded-md border px-3 py-2 text-center text-xs hover:bg-muted">查看交出单</a>
                <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-cutting-binding-action="external-boundary" data-row-id="${escapeHtml(row.bindingOrderId)}">边界说明</button>
              `
          }
          <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-cutting-binding-action="abnormal" data-row-id="${escapeHtml(row.bindingOrderId)}">记录异常</button>
        </div>
      </div>
    </article>
  `
}

function renderKpi(label: string, value: string | number, hint: string, valueClass = 'text-foreground'): string {
  return `
    <article class="rounded-lg border bg-card p-4">
      <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
      <p class="mt-2 text-2xl font-semibold ${valueClass}">${escapeHtml(String(value))}</p>
      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(hint)}</p>
    </article>
  `
}

export function renderCraftCuttingSpecialProcessesPage(): string {
  const rows = buildBindingProcessOrders()
  const internalRows = rows.filter((row) => row.processMode === '裁床内部加工')
  const externalRows = rows.filter((row) => row.processMode === '外部承接工厂加工')
  const abnormalRows = rows.filter((row) => row.abnormalItems.length > 0)
  const inboundRows = rows.filter((row) => row.inboundInventoryRecordIds.length > 0)
  const totalActualOutput = internalRows.reduce((sum, row) => sum + row.actualOutputQty, 0)

  return `
    <section class="space-y-5 p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-foreground">捆条加工单</h1>
          <p class="mt-1 text-sm text-muted-foreground">裁床内部捆条加工独立管理；外部承接工厂加工继续走通用交出单、交出记录和特殊工艺回仓。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <a href="/fcs/craft/cutting/replenishment?sourceType=binding" data-nav="/fcs/craft/cutting/replenishment?sourceType=binding" class="rounded-md border px-3 py-2 text-sm hover:bg-muted">查看补料管理</a>
          <a href="/fcs/craft/cutting/summary?checkType=捆条异常" data-nav="/fcs/craft/cutting/summary?checkType=捆条异常" class="rounded-md border px-3 py-2 text-sm hover:bg-muted">查看核查项</a>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-binding-action="refresh">刷新</button>
        </div>
      </div>

      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${renderKpi('内部加工单', `${formatNumber(internalRows.length)} 单`, '裁床内部完成，不走通用交出单', 'text-sky-700')}
        ${renderKpi('外部特殊工艺交出', `${formatNumber(externalRows.length)} 单`, '外部捆条必须走通用交出', 'text-violet-700')}
        ${renderKpi('异常处理中', `${formatNumber(abnormalRows.length)} 单`, '进入补料管理或裁剪结果核查', 'text-rose-600')}
        ${renderKpi('已入库产出', `${formatNumber(inboundRows.length)} 单`, '产出进入裁床待交出仓库存', 'text-emerald-600')}
        ${renderKpi('实际产出数量', `${formatNumber(totalActualOutput)} 米`, '来自内部捆条加工回写', 'text-slate-900')}
      </section>

      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${['待加工', '加工中', '已完成', '异常处理中', '已入库']
          .map((status) => {
            const count = rows.filter((row) => row.status === status).length
            return `<div class="rounded-lg border bg-muted/20 px-3 py-2 text-sm"><span class="font-medium text-foreground">${escapeHtml(status)}</span><span class="ml-2 text-muted-foreground">${formatNumber(count)} 单</span></div>`
          })
          .join('')}
      </section>

      <section class="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-base font-semibold text-foreground">内部加工与外部交出边界</h2>
          <span class="text-xs text-muted-foreground">主列表使用复合列展示，1440px 下不依赖横向滚动。</span>
        </div>
        ${rows.map(renderOrderCard).join('')}
      </section>
    </section>
  `
}

function renderDetailMetric(label: string, value: string): string {
  return `
    <article class="rounded-lg border bg-muted/20 p-3">
      <p class="text-xs text-muted-foreground">${escapeHtml(label)}</p>
      <p class="mt-1 font-medium text-foreground">${escapeHtml(value)}</p>
    </article>
  `
}

function renderDetailSection(title: string, body: string): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="text-base font-semibold text-foreground">${escapeHtml(title)}</h2>
      <div class="mt-3">${body}</div>
    </section>
  `
}

export function renderCraftCuttingSpecialProcessDetailPage(bindingOrderId?: string): string {
  const row = getBindingOrderById(bindingOrderId)
  const backHref = '/fcs/craft/cutting/special-processes'
  return `
    <section class="space-y-5 p-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <a href="${backHref}" data-nav="${backHref}" class="text-sm text-blue-700 hover:underline">返回捆条加工单</a>
          <h1 class="mt-2 text-2xl font-semibold text-foreground">捆条加工单详情</h1>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(row.bindingOrderNo)} · ${escapeHtml(row.processMode)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${renderBadge(row.status, statusToneMap[row.status])}
          ${renderBadge(row.processMode, modeToneMap[row.processMode])}
        </div>
      </div>

      ${renderDetailSection(
        '基本信息',
        `<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderDetailMetric('加工单号', row.bindingOrderNo)}
          ${renderDetailMetric('加工方式', row.processMode)}
          ${renderDetailMetric('加工状态', row.status)}
          ${renderDetailMetric('操作人', row.operatorName || row.externalReceiverFactoryName || '待安排')}
          ${renderDetailMetric('开始时间', row.startedAt || '待开始')}
          ${renderDetailMetric('完成时间', row.completedAt || '待完成')}
          ${renderDetailMetric('产出单位', row.unit)}
          ${renderDetailMetric('备注', row.remark)}
        </div>`,
      )}

      ${renderDetailSection(
        '来源对象',
        `<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderDetailMetric('来源生产单', row.sourceProductionOrderNo)}
          ${renderDetailMetric('来源裁片单', row.sourceCutOrderNo)}
          ${renderDetailMetric('来源铺布单', row.sourceSpreadingOrderNo)}
          ${renderDetailMetric('来源菲票', row.sourceFeiTicketNos.join(' / '))}
        </div>`,
      )}

      ${renderDetailSection(
        '面料与纸样',
        `<div class="grid gap-4 xl:grid-cols-2">
          <div>
            ${renderMaterialIdentityBlock(
              {
                materialSku: row.materialIdentity.materialSku,
                materialLabel: row.materialIdentity.materialName,
                materialAlias: row.materialIdentity.materialAlias,
                materialImageUrl: row.materialIdentity.materialImageUrl,
              },
              { compact: true, imageSizeClass: 'h-10 w-10' },
            )}
            <p class="mt-2 text-xs text-muted-foreground">颜色：${escapeHtml(row.materialIdentity.materialColor)} / 单位：${escapeHtml(row.materialIdentity.materialUnit)}</p>
          </div>
          <div class="text-sm text-muted-foreground">
            <p class="font-medium text-foreground">${escapeHtml(row.patternIdentity.patternFileName)}</p>
            <p class="mt-1">${escapeHtml(row.patternIdentity.patternVersion)} / ${escapeHtml(row.patternIdentity.effectiveWidthText)}</p>
            <p class="mt-1">部位集合：${escapeHtml(row.patternIdentity.piecePartNames.join('、') || '部位待补')}</p>
          </div>
        </div>`,
      )}

      ${renderDetailSection(
        '加工参数',
        `<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          ${renderDetailMetric('捆条宽度', `${row.bindingWidth} cm`)}
          ${renderDetailMetric('计划长度', formatLength(row.plannedLength))}
          ${renderDetailMetric('计划产出数量', `${formatNumber(row.plannedOutputQty)} 米`)}
          ${renderDetailMetric('加工方式边界', row.processMode === '裁床内部加工' ? '内部加工单承接' : '走特殊工艺交出')}
          ${renderDetailMetric('是否影响裁片单主状态', '不影响')}
        </div>`,
      )}

      ${renderDetailSection(
        '实际产出',
        `<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderDetailMetric('实际长度', row.actualLength ? formatLength(row.actualLength) : '待回写')}
          ${renderDetailMetric('实际产出数量', `${formatNumber(row.actualOutputQty)} 米`)}
          ${renderDetailMetric('损耗长度', formatLength(row.lossLength))}
          ${renderDetailMetric('损耗率', formatRate(row.lossRate))}
        </div>`,
      )}

      ${renderDetailSection(
        '损耗与异常',
        row.abnormalItems.length
          ? `<div class="grid gap-3 md:grid-cols-2">
              ${row.abnormalItems
                .map(
                  (item) => `
                    <article class="rounded-lg border bg-muted/20 p-3">
                      <div class="flex flex-wrap gap-2">
                        ${renderBadge(item.abnormalType, item.abnormalLevel === '紧急' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700')}
                        ${renderBadge(item.targetModule, 'border-blue-200 bg-blue-50 text-blue-700')}
                      </div>
                      <p class="mt-2 text-sm text-foreground">${escapeHtml(item.description)}</p>
                      <p class="mt-2 text-xs text-muted-foreground">${escapeHtml(item.reportedAt)} / ${escapeHtml(item.reportedBy)} / ${escapeHtml(item.handlingStatus)}</p>
                    </article>
                  `,
                )
                .join('')}
            </div>`
          : '<div class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">当前加工单暂无损耗异常。</div>',
      )}

      ${renderDetailSection(
        '成本记录',
        row.costItems.length
          ? `<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">${row.costItems
              .map((item) => renderDetailMetric(`${item.costType}成本`, `${formatNumber(item.amount)} ${item.unit} / ${item.remark}`))
              .join('')}</div>`
          : '<div class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">外部承接工厂成本由交出和回仓链路承接，本页不重复维护。</div>',
      )}

      ${renderDetailSection(
        '入库记录',
        `<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderDetailMetric('入库状态', row.inboundInventoryRecordIds.length ? '已进入裁床待交出仓库存' : row.status === '已完成' ? '待入库' : '未形成入库')}
          ${renderDetailMetric('库存记录', row.inboundInventoryRecordIds.join(' / ') || '暂无')}
          ${renderDetailMetric('库存来源', row.inboundInventoryRecordIds.length ? '捆条加工' : '待加工完成')}
          ${renderDetailMetric('后续可参与', row.inboundInventoryRecordIds.length ? '车缝任务分配和交出' : '待入库后参与')}
        </div>`,
      )}

      ${renderDetailSection(
        '补料或核查关联',
        `<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          ${renderDetailMetric('补料管理', row.linkedReplenishmentIds.join(' / ') || '无')}
          ${renderDetailMetric('裁剪结果核查', row.linkedCheckItemIds.join(' / ') || '无')}
          ${renderDetailMetric('外部交出单', row.externalHandoverOrderNo || '内部加工不适用')}
          ${renderDetailMetric('特殊工艺回仓', row.externalReturnStatus || '内部加工不适用')}
        </div>`,
      )}
    </section>
  `
}

function showBindingToast(message: string): void {
  const rootId = 'cutting-binding-toast-root'
  let root = document.getElementById(rootId)
  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'fixed right-6 top-20 z-50 flex flex-col gap-2'
    document.body.appendChild(root)
  }
  const toast = document.createElement('div')
  toast.className = 'rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-lg'
  toast.textContent = message
  root.appendChild(toast)
  window.setTimeout(() => {
    toast.remove()
    if (root && root.childElementCount === 0) root.remove()
  }, 1800)
}

export function handleCraftCuttingSpecialProcessesEvent(target: HTMLElement): boolean {
  const button = target.closest<HTMLElement>('[data-cutting-binding-action]')
  if (!button) return false

  const action = button.dataset.cuttingBindingAction
  if (action === 'refresh') {
    showBindingToast('捆条加工单已刷新')
    return true
  }
  if (action === 'start') {
    showBindingToast('已记录开始加工动作')
    return true
  }
  if (action === 'complete') {
    showBindingToast('已记录完成加工动作，实际产出待核对')
    return true
  }
  if (action === 'inbound') {
    showBindingToast('捆条产出已标记进入裁床待交出仓库存')
    return true
  }
  if (action === 'abnormal') {
    showBindingToast('捆条异常已进入补料管理或裁剪结果核查')
    return true
  }
  if (action === 'external-boundary') {
    showBindingToast('外部捆条必须走通用交出单和特殊工艺回仓')
    return true
  }
  return false
}

export function isCraftCuttingSpecialProcessesDialogOpen(): boolean {
  return false
}
