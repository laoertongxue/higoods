import { escapeHtml } from '../../../utils'
import { appStore } from '../../../state/store.ts'
import {
  listKnittingMachines,
  type KnittingMachine,
  type KnittingMachineStatus,
} from '../../../data/fcs/knitting-task-domain.ts'
import {
  buildKnittingMachineScheduleLink,
  buildKnittingMachinesLink,
  buildKnittingWorkOrdersLink,
} from '../../../data/fcs/fcs-route-links.ts'
import {
  paginateKnittingItems,
  renderBadge,
  renderMetricCard,
  renderPageHeader,
  renderPaginationControls,
  renderSection,
  renderTable,
} from './shared'

function renderMachineStatusBadge(status: KnittingMachineStatus): string {
  const tone =
    status === '生产中'
      ? 'info'
      : status === '已排产'
        ? 'warning'
        : status === '空闲'
          ? 'success'
          : status === '维修'
            ? 'danger'
            : 'muted'
  return renderBadge(status, tone)
}

function renderTopActions(): string {
  return `
    <div class="flex flex-wrap gap-2">
      <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-nav="${escapeHtml(buildMachineDialogLink('create'))}">新增横机</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildKnittingMachineScheduleLink())}">查看横机排产</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildKnittingWorkOrdersLink())}">返回加工单</button>
    </div>
  `
}

function buildMachineDialogLink(dialog: 'create' | 'edit' | 'maintenance', machineNo?: string): string {
  const params = new URLSearchParams()
  params.set('dialog', dialog)
  if (machineNo) params.set('machineNo', machineNo)
  return `${buildKnittingMachinesLink()}?${params.toString()}`
}

function getCurrentDialogState(): { dialog: string; machineNo: string } {
  const [, stateQueryString = ''] = (appStore.getState().pathname || '').split('?')
  const queryString = stateQueryString || (typeof window === 'undefined' ? '' : window.location.search.replace(/^\?/, ''))
  const params = new URLSearchParams(queryString)
  return {
    dialog: params.get('dialog') || '',
    machineNo: params.get('machineNo') || '',
  }
}

function renderSummaryCards(machines: KnittingMachine[]): string {
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
      ${renderMetricCard('横机总数', String(machines.length), '周哥针织厂')}
      ${renderMetricCard('生产中', String(machines.filter((machine) => machine.status === '生产中').length), '横机成片中')}
      ${renderMetricCard('已排产', String(machines.filter((machine) => machine.status === '已排产').length), '待开工或待排产执行')}
      ${renderMetricCard('空闲', String(machines.filter((machine) => machine.status === '空闲').length), '可用于排机')}
      ${renderMetricCard('维修', String(machines.filter((machine) => machine.status === '维修').length), '不可排机')}
      ${renderMetricCard('停用', String(machines.filter((machine) => machine.status === '停用').length), '不计入产能')}
    </section>
  `
}

function renderFilters(): string {
  return renderSection(
    '筛选',
    `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">横机编号</span>
          <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="输入横机编号" />
        </label>
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">机台组</span>
          <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option>全部机台组</option>
            <option>整件针织组</option>
            <option>部位针织组</option>
            <option>横机预留组</option>
          </select>
        </label>
        <label class="text-sm">
          <span class="text-xs text-muted-foreground">设备状态</span>
          <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option>全部状态</option>
            <option>空闲</option>
            <option>已排产</option>
            <option>生产中</option>
            <option>维修</option>
            <option>停用</option>
          </select>
        </label>
        <div class="flex items-end gap-2">
          <button type="button" class="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" data-nav="${escapeHtml(`${buildKnittingMachinesLink()}?filtered=1`)}">筛选</button>
          <button type="button" class="h-9 rounded-md border px-3 text-sm hover:bg-muted" data-nav="${escapeHtml(buildKnittingMachinesLink())}">重置</button>
        </div>
      </div>
    `,
  )
}

function renderMachineRows(machines: KnittingMachine[]): string {
  return machines
    .map((machine) => `
      <tr class="border-b align-top last:border-b-0">
        <td class="px-3 py-3 font-mono text-xs font-medium">${escapeHtml(machine.machineNo)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(machine.machineName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(machine.machineGroupName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(machine.needleType)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(machine.supportedKinds.map((kind) => kind === 'WHOLE_GARMENT' ? '整件针织' : '部位针织').join('、'))}</td>
        <td class="px-3 py-3">${renderMachineStatusBadge(machine.status)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(machine.currentTaskNo || '未占用')}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(machine.dailyCapacityText)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(machine.locationText)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(machine.ownerName)}</td>
        <td class="px-3 py-3 text-sm">${escapeHtml(machine.remark)}</td>
        <td class="px-3 py-3">
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildKnittingMachineScheduleLink())}">查看排产</button>
            <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildMachineDialogLink('edit', machine.machineNo))}">编辑</button>
            <button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-muted" data-nav="${escapeHtml(buildMachineDialogLink('maintenance', machine.machineNo))}">维修</button>
          </div>
        </td>
      </tr>
    `)
    .join('')
}

function renderMachineDialog(machines: KnittingMachine[]): string {
  const { dialog, machineNo } = getCurrentDialogState()
  if (!dialog) return ''
  const machine = machines.find((item) => item.machineNo === machineNo)
  const title =
    dialog === 'create'
      ? '新增横机'
      : dialog === 'maintenance'
        ? `登记维修${machine ? ` - ${machine.machineNo}` : ''}`
        : `编辑横机${machine ? ` - ${machine.machineNo}` : ''}`
  return `
    <div class="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-4">
      <section class="w-full max-w-2xl rounded-lg border bg-background shadow-xl">
        <div class="flex items-center justify-between border-b px-5 py-4">
          <h2 class="text-base font-semibold">${escapeHtml(title)}</h2>
          <button type="button" class="rounded-md border px-2 py-1 text-sm hover:bg-muted" data-nav="${escapeHtml(buildKnittingMachinesLink())}">关闭</button>
        </div>
        <div class="grid gap-4 p-5 md:grid-cols-2">
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">横机编号</span>
            <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(machine?.machineNo || '')}" placeholder="例：H-093" />
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">机台组</span>
            <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option ${machine?.machineGroupName === '整件针织组' ? 'selected' : ''}>整件针织组</option>
              <option ${machine?.machineGroupName === '部位针织组' ? 'selected' : ''}>部位针织组</option>
              <option ${machine?.machineGroupName === '横机预留组' ? 'selected' : ''}>横机预留组</option>
            </select>
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">针型</span>
            <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(machine?.needleType || '12G')}" />
          </label>
          <label class="text-sm">
            <span class="text-xs text-muted-foreground">设备状态</span>
            <select class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm">
              ${['空闲', '已排产', '生产中', '维修', '停用'].map((status) => `<option ${machine?.status === status ? 'selected' : ''}>${status}</option>`).join('')}
            </select>
          </label>
          <label class="text-sm md:col-span-2">
            <span class="text-xs text-muted-foreground">备注</span>
            <textarea class="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm">${escapeHtml(machine?.remark || '')}</textarea>
          </label>
        </div>
        <div class="flex justify-end gap-2 border-t px-5 py-4">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildKnittingMachinesLink())}">取消</button>
          <button type="button" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-nav="${escapeHtml(buildKnittingMachinesLink())}">保存</button>
        </div>
      </section>
    </div>
  `
}

export function renderCraftKnittingMachinesPage(): string {
  const machines = listKnittingMachines()
  const paging = paginateKnittingItems(machines, 'machinesPage', 10)
  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('横机设备', '维护周哥针织厂横机档案，排机动作只从可用横机中选择。', renderTopActions())}
      ${renderSummaryCards(machines)}
      ${renderFilters()}
      ${renderSection(
        '横机设备清单',
        renderTable(
          ['横机编号', '设备名称', '机台组', '针型', '适用任务', '状态', '当前任务', '日产能', '位置', '负责人', '备注', '操作'],
          renderMachineRows(paging.rows),
          'min-w-[1700px]',
        ) + renderPaginationControls(paging, '台横机'),
      )}
      ${renderMachineDialog(machines)}
    </div>
  `
}

export function handleCraftKnittingMachinesEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-knitting-machine-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.knittingMachineAction
  const machineNo = actionNode.dataset.machineNo
  if (action === 'create') window.alert('原型动作：新增横机设备')
  if (action === 'edit') window.alert(`原型动作：编辑横机 ${machineNo || ''}`)
  if (action === 'maintenance') window.alert(`原型动作：登记维修 ${machineNo || ''}`)
  if (action === 'filter') window.alert('原型动作：按当前条件筛选横机')
  if (action === 'reset') window.alert('原型动作：重置筛选条件')
  return true
}
