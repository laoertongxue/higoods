import { renderDetailDrawer as uiDetailDrawer, renderDrawer as uiDrawer } from '../components/ui/index.ts'
import { findProjectByCode, findProjectNodeByWorkItemTypeCode, listProjects } from '../data/pcs-project-repository.ts'
import { recordSampleLedgerEvent } from '../data/pcs-sample-project-writeback.ts'
import { escapeHtml } from '../utils.ts'

type SampleReturnCaseType = 'RETURN' | 'DISPOSITION'
type SampleReturnCaseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'EXECUTING' | 'CLOSED' | 'REJECTED' | 'CANCELLED'

interface SampleReturnCaseRecord {
  id: string
  caseCode: string
  caseType: SampleReturnCaseType
  status: SampleReturnCaseStatus
  sampleCode: string
  sampleName: string
  responsibleSite: string
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  workItemTypeCode: string
  workItemTypeName: string
  reasonText: string
  returnRecipient: string
  returnDepartment: string
  returnAddress: string
  logisticsProvider: string
  trackingNumber: string
  createdAt: string
  updatedAt: string
  handledAt: string
}

interface SampleReturnPageState {
  keyword: string
  typeFilter: string
  statusFilter: string
  selectedCaseId: string | null
  detailOpen: boolean
  createOpen: boolean
  newCaseType: SampleReturnCaseType
  newProjectId: string
  newReasonText: string
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function createSeedCases(): SampleReturnCaseRecord[] {
  const projectA = findProjectByCode('PRJ-20251216-003') || listProjects()[0]
  const projectB = findProjectByCode('PRJ-20251216-004') || listProjects()[1] || listProjects()[0]
  const returnNode = findProjectNodeByWorkItemTypeCode(projectA.projectId, 'SAMPLE_RETURN_HANDLE')
  const disposalNode = findProjectNodeByWorkItemTypeCode(projectB.projectId, 'SAMPLE_RETAIN_REVIEW')
  return [
    {
      id: 'ret_seed_001',
      caseCode: 'RET-20260115-001',
      caseType: 'RETURN',
      status: 'APPROVED',
      sampleCode: 'SY-SZ-00991',
      sampleName: '牛仔短裤样衣',
      responsibleSite: '深圳',
      projectId: projectA.projectId,
      projectCode: projectA.projectCode,
      projectName: projectA.projectName,
      projectNodeId: returnNode?.projectNodeId || '',
      workItemTypeCode: 'SAMPLE_RETURN_HANDLE',
      workItemTypeName: returnNode?.workItemTypeName || '样衣退回处理',
      reasonText: '样衣不符合继续使用要求，需要正式退回供应商。',
      returnRecipient: '供应商收货人',
      returnDepartment: '样衣管理组',
      returnAddress: '东莞样衣供应商回寄点',
      logisticsProvider: '顺丰',
      trackingNumber: 'SF-RET-001',
      createdAt: '2026-01-15 09:00:00',
      updatedAt: '2026-01-15 11:00:00',
      handledAt: '',
    },
    {
      id: 'disp_seed_001',
      caseCode: 'DSP-20260116-001',
      caseType: 'DISPOSITION',
      status: 'EXECUTING',
      sampleCode: 'SY-SZ-00992',
      sampleName: '针织开衫旧样',
      responsibleSite: '深圳',
      projectId: projectB.projectId,
      projectCode: projectB.projectCode,
      projectName: projectB.projectName,
      projectNodeId: disposalNode?.projectNodeId || '',
      workItemTypeCode: 'SAMPLE_RETAIN_REVIEW',
      workItemTypeName: disposalNode?.workItemTypeName || '样衣留存评估',
      reasonText: '样衣超期未归还，转入正式处置流程。',
      returnRecipient: '样衣处置管理员',
      returnDepartment: '样衣管理组',
      returnAddress: '深圳样衣处置区',
      logisticsProvider: '内部移交',
      trackingNumber: 'DSP-001',
      createdAt: '2026-01-16 09:30:00',
      updatedAt: '2026-01-16 10:30:00',
      handledAt: '',
    },
  ]
}

let caseStore = createSeedCases()

let state: SampleReturnPageState = {
  keyword: '',
  typeFilter: 'all',
  statusFilter: 'all',
  selectedCaseId: null,
  detailOpen: false,
  createOpen: false,
  newCaseType: 'RETURN',
  newProjectId: '',
  newReasonText: '',
}

function getCases() {
  return caseStore.filter((item) => {
    if (state.keyword) {
      const keyword = state.keyword.toLowerCase()
      if (![item.caseCode, item.sampleCode, item.sampleName, item.projectCode, item.projectName].some((text) => text.toLowerCase().includes(keyword))) {
        return false
      }
    }
    if (state.typeFilter !== 'all' && item.caseType !== state.typeFilter) return false
    if (state.statusFilter !== 'all' && item.status !== state.statusFilter) return false
    return true
  })
}

function getSelectedCase() {
  if (!state.selectedCaseId) return null
  return caseStore.find((item) => item.id === state.selectedCaseId) || null
}

function updateCase(caseId: string, patch: Partial<SampleReturnCaseRecord>) {
  caseStore = caseStore.map((item) => (item.id === caseId ? { ...item, ...patch, updatedAt: patch.updatedAt || nowText() } : item))
}

function writeReturnCaseEvent(record: SampleReturnCaseRecord) {
  const eventType = record.caseType === 'RETURN' ? 'RETURN_SUPPLIER' : 'DISPOSAL'
  recordSampleLedgerEvent({
    ledgerEventId: `${record.id}::${eventType}`,
    eventType,
    sampleCode: record.sampleCode,
    sampleName: record.sampleName,
    sampleType: '样衣',
    responsibleSite: record.responsibleSite,
    sourcePage: '样衣退货与处理',
    sourceModule: '样衣退货与处理',
    sourceDocType: record.caseType === 'RETURN' ? '样衣退回单' : '样衣处置单',
    sourceDocId: record.id,
    sourceDocCode: record.caseCode,
    projectId: record.projectId,
    projectCode: record.projectCode,
    projectName: record.projectName,
    projectNodeId: record.projectNodeId,
    workItemTypeCode: record.workItemTypeCode,
    workItemTypeName: record.workItemTypeName,
    operatorName: '当前用户',
    businessDate: nowText(),
    note: record.reasonText,
    locationDisplay: record.caseType === 'RETURN' ? '供应商退回完成' : '深圳处置区',
    locationType: record.caseType === 'RETURN' ? '在途' : '处置区',
    locationCode: record.caseType === 'RETURN' ? 'RETURNED' : 'SZ-DISPOSAL',
    custodianType: record.caseType === 'RETURN' ? '系统' : '仓管',
    custodianName: record.caseType === 'RETURN' ? '退回完成' : '样衣仓管',
    returnRecipient: record.returnRecipient,
    returnDepartment: record.returnDepartment,
    returnAddress: record.returnAddress,
    returnDate: nowText(),
    logisticsProvider: record.logisticsProvider,
    trackingNumber: record.trackingNumber,
    modificationReason: record.reasonText,
  } as never)
}

export function executeSampleReturnCase(caseId: string): boolean {
  const record = caseStore.find((item) => item.id === caseId)
  if (!record || !['APPROVED', 'EXECUTING'].includes(record.status)) return false
  writeReturnCaseEvent(record)
  updateCase(caseId, { status: 'CLOSED', handledAt: nowText() })
  return true
}

function renderCreateDrawer(): string {
  if (!state.createOpen) return ''
  return uiDrawer(
    {
      title: '新建样衣退货与处理',
      subtitle: '执行退回或处置后，会正式写入样衣台账事件并回写项目节点。',
      closeAction: { prefix: 'sample-return', action: 'close-create' },
      width: 'md',
    },
    `
      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-sm font-medium">案件类型</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-sample-return-field="type">
            <option value="RETURN" ${state.newCaseType === 'RETURN' ? 'selected' : ''}>退回</option>
            <option value="DISPOSITION" ${state.newCaseType === 'DISPOSITION' ? 'selected' : ''}>处置</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">项目</label>
          <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-sample-return-field="project">
            <option value="">请选择项目</option>
            ${listProjects().map((item) => `<option value="${item.projectId}" ${state.newProjectId === item.projectId ? 'selected' : ''}>${escapeHtml(`${item.projectCode} · ${item.projectName}`)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">原因说明</label>
          <textarea class="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm" data-sample-return-field="reason">${escapeHtml(state.newReasonText)}</textarea>
        </div>
      </div>
    `,
    {
      cancel: { prefix: 'sample-return', action: 'close-create', label: '取消' },
      confirm: { prefix: 'sample-return', action: 'submit-create', label: '创建案件', variant: 'primary' },
    },
  )
}

function renderDetailDrawer(): string {
  const record = getSelectedCase()
  if (!state.detailOpen || !record) return ''
  const actionLabel = record.caseType === 'RETURN' ? '执行退回' : '执行处置'
  const canExecute = ['APPROVED', 'EXECUTING'].includes(record.status)
  return uiDetailDrawer(
    {
      title: '样衣退货与处理详情',
      subtitle: record.caseCode,
      closeAction: { prefix: 'sample-return', action: 'close-detail' },
      width: 'md',
    },
    `
      <div class="grid gap-3 text-sm md:grid-cols-2">
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">案件类型</div><div class="mt-1 font-medium">${record.caseType === 'RETURN' ? '退回' : '处置'}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">当前状态</div><div class="mt-1 font-medium">${escapeHtml(record.status)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">样衣编号</div><div class="mt-1 font-medium">${escapeHtml(record.sampleCode)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">样衣名称</div><div class="mt-1 font-medium">${escapeHtml(record.sampleName)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">关联项目</div><div class="mt-1 font-medium">${escapeHtml(`${record.projectCode} · ${record.projectName}`)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3"><div class="text-xs text-muted-foreground">项目节点</div><div class="mt-1 font-medium">${escapeHtml(record.workItemTypeName)}</div></div>
        <div class="rounded-lg border bg-muted/20 p-3 md:col-span-2"><div class="text-xs text-muted-foreground">原因说明</div><div class="mt-1 font-medium">${escapeHtml(record.reasonText)}</div></div>
      </div>
    `,
    canExecute ? `<button class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground" data-sample-return-action="execute-case">${actionLabel}</button>` : '',
  )
}

export function handleSampleReturnEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-sample-return-action]')
  const action = actionNode?.dataset.sampleReturnAction
  if (!action) return false
  if (action === 'open-detail') {
    const caseId = actionNode?.dataset.caseId
    if (caseId) {
      state.selectedCaseId = caseId
      state.detailOpen = true
    }
    return true
  }
  if (action === 'close-detail') {
    state.detailOpen = false
    return true
  }
  if (action === 'open-create') {
    state.createOpen = true
    return true
  }
  if (action === 'close-create') {
    state.createOpen = false
    return true
  }
  if (action === 'execute-case' && state.selectedCaseId) return executeSampleReturnCase(state.selectedCaseId)
  if (action === 'submit-create') {
    const project = listProjects().find((item) => item.projectId === state.newProjectId)
    if (!project) return true
    const node = findProjectNodeByWorkItemTypeCode(project.projectId, state.newCaseType === 'RETURN' ? 'SAMPLE_RETURN_HANDLE' : 'SAMPLE_RETAIN_REVIEW')
    if (!node) return true
    caseStore = [
      {
        id: `${state.newCaseType === 'RETURN' ? 'ret' : 'disp'}_manual_${String(caseStore.length + 1).padStart(3, '0')}`,
        caseCode: `${state.newCaseType === 'RETURN' ? 'RET' : 'DSP'}-${nowText().slice(0, 10).replace(/-/g, '')}-${String(caseStore.length + 1).padStart(3, '0')}`,
        caseType: state.newCaseType,
        status: 'APPROVED',
        sampleCode: state.newCaseType === 'RETURN' ? 'SY-SZ-00995' : 'SY-SZ-00996',
        sampleName: state.newCaseType === 'RETURN' ? '待退回样衣' : '待处置样衣',
        responsibleSite: '深圳',
        projectId: project.projectId,
        projectCode: project.projectCode,
        projectName: project.projectName,
        projectNodeId: node.projectNodeId,
        workItemTypeCode: node.workItemTypeCode,
        workItemTypeName: node.workItemTypeName,
        reasonText: state.newReasonText || '页面新建案件',
        returnRecipient: state.newCaseType === 'RETURN' ? '供应商收货人' : '样衣处置管理员',
        returnDepartment: '样衣管理组',
        returnAddress: state.newCaseType === 'RETURN' ? '东莞样衣供应商回寄点' : '深圳样衣处置区',
        logisticsProvider: state.newCaseType === 'RETURN' ? '顺丰' : '内部移交',
        trackingNumber: `${state.newCaseType === 'RETURN' ? 'RET' : 'DSP'}-TRACK-${String(caseStore.length + 1).padStart(3, '0')}`,
        createdAt: nowText(),
        updatedAt: nowText(),
        handledAt: '',
      },
      ...caseStore,
    ]
    state.createOpen = false
    state.newReasonText = ''
    state.newProjectId = ''
    return true
  }
  if (action === 'reset') {
    state.keyword = ''
    state.typeFilter = 'all'
    state.statusFilter = 'all'
    return true
  }
  return false
}

export function handleSampleReturnInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.sampleReturnField
  if (!field) return false
  if (field === 'keyword') {
    state.keyword = (target as HTMLInputElement).value
    return true
  }
  if (field === 'type-filter') {
    state.typeFilter = (target as HTMLSelectElement).value
    return true
  }
  if (field === 'status-filter') {
    state.statusFilter = (target as HTMLSelectElement).value
    return true
  }
  if (field === 'type') {
    state.newCaseType = (target as HTMLSelectElement).value as SampleReturnCaseType
    return true
  }
  if (field === 'project') {
    state.newProjectId = (target as HTMLSelectElement).value
    return true
  }
  if (field === 'reason') {
    state.newReasonText = (target as HTMLTextAreaElement).value
    return true
  }
  return false
}

export function isSampleReturnDialogOpen(): boolean {
  return state.detailOpen || state.createOpen
}

export function renderSampleReturnPage(): string {
  const cases = getCases()
  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">样衣退货与处理</h1>
          <p class="mt-1 text-sm text-muted-foreground">执行退回或处置时，会正式生成样衣台账事件，并回写样衣退回处理或样衣留存评估节点。</p>
        </div>
        <button class="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground" data-sample-return-action="open-create">新建案件</button>
      </header>

      <section class="rounded-lg border bg-white p-4">
        <div class="grid gap-4 md:grid-cols-[2fr,1fr,1fr,auto]">
          <input class="h-9 rounded-md border px-3 text-sm" placeholder="搜索案件编号/样衣/项目" value="${escapeHtml(state.keyword)}" data-sample-return-field="keyword" />
          <select class="h-9 rounded-md border px-3 text-sm" data-sample-return-field="type-filter">
            <option value="all" ${state.typeFilter === 'all' ? 'selected' : ''}>全部类型</option>
            <option value="RETURN" ${state.typeFilter === 'RETURN' ? 'selected' : ''}>退回</option>
            <option value="DISPOSITION" ${state.typeFilter === 'DISPOSITION' ? 'selected' : ''}>处置</option>
          </select>
          <select class="h-9 rounded-md border px-3 text-sm" data-sample-return-field="status-filter">
            <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
            ${['DRAFT', 'SUBMITTED', 'APPROVED', 'EXECUTING', 'CLOSED', 'REJECTED', 'CANCELLED'].map((item) => `<option value="${item}" ${state.statusFilter === item ? 'selected' : ''}>${item}</option>`).join('')}
          </select>
          <button class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-gray-50" data-sample-return-action="reset">重置筛选</button>
        </div>
      </section>

      <section class="overflow-hidden rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[1100px] text-sm">
            <thead>
              <tr class="border-b bg-muted/30 text-left text-muted-foreground">
                <th class="px-3 py-2 font-medium">案件编号</th>
                <th class="px-3 py-2 font-medium">案件类型</th>
                <th class="px-3 py-2 font-medium">样衣编号</th>
                <th class="px-3 py-2 font-medium">样衣名称</th>
                <th class="px-3 py-2 font-medium">关联项目</th>
                <th class="px-3 py-2 font-medium">项目节点</th>
                <th class="px-3 py-2 font-medium">责任站点</th>
                <th class="px-3 py-2 font-medium">当前状态</th>
                <th class="px-3 py-2 font-medium">更新时间</th>
                <th class="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              ${cases.length > 0 ? cases.map((item) => `
                <tr class="border-b last:border-b-0 hover:bg-muted/30">
                  <td class="px-3 py-3 font-medium text-primary">${escapeHtml(item.caseCode)}</td>
                  <td class="px-3 py-3">${item.caseType === 'RETURN' ? '退回' : '处置'}</td>
                  <td class="px-3 py-3">${escapeHtml(item.sampleCode)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.sampleName)}</td>
                  <td class="px-3 py-3">${escapeHtml(`${item.projectCode} · ${item.projectName}`)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.workItemTypeName)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.responsibleSite)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.status)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.updatedAt)}</td>
                  <td class="px-3 py-3"><button class="inline-flex h-7 items-center rounded-md border px-2 text-xs hover:bg-muted" data-sample-return-action="open-detail" data-case-id="${item.id}">查看</button></td>
                </tr>
              `).join('') : '<tr><td colspan="10" class="px-4 py-12 text-center text-muted-foreground">暂无样衣退货与处理案件</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      ${renderDetailDrawer()}
      ${renderCreateDrawer()}
    </div>
  `
}
