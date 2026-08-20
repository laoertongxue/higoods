import { APF_FACTORY_ID, APF_FACTORY_NAME } from './special-craft-dedicated-factories.ts'

export const BUTTON_LOOP_OPERATION_ID = 'AUX-OP-BUTTON-LOOP'
export const BUTTON_LOOP_CRAFT_NAME = '盘扣'
export const BUTTON_LOOP_INPUT_UNIT = '张'
export const BUTTON_LOOP_OUTPUT_UNIT = '个'
export const BUTTON_LOOP_RECEIVER_WAREHOUSE_NAME = '中央辅料仓'

export interface ButtonLoopBindingTicketInput {
  feiTicketId: string
  feiTicketNo: string
  actualLengthM: number
}

export interface ButtonLoopSelectedBindingStripInput {
  patternFileId: string
  patternFileName: string
  bindingStripId: string
  bindingStripNo: string
  bindingStripName: string
  lengthCm: number
  widthCm: number
  requiresButtonLoop: boolean
  tickets?: ButtonLoopBindingTicketInput[]
}

export interface ButtonLoopTaskInputLine extends ButtonLoopBindingTicketInput {
  inputLineId: string
  patternFileId: string
  patternFileName: string
  bindingStripId: string
  bindingStripNo: string
  bindingStripName: string
  lengthCm: number
  widthCm: number
  received: boolean
  receivedAt?: string
  receivedBy?: string
}

export interface ButtonLoopTaskEvent {
  eventId: string
  action: 'CREATE' | 'CONFIRM_RECEIVE' | 'PROCESS_REPORT' | 'SUBMIT_HANDOVER' | 'COMPLETE'
  operatorName: string
  operatedAt: string
  inputTicketNos?: string[]
  outputQty?: number
  unit: '张' | '个'
  remark: string
}

export interface ButtonLoopTaskOrder {
  taskOrderId: string
  taskOrderNo: string
  operationId: typeof BUTTON_LOOP_OPERATION_ID
  craftName: typeof BUTTON_LOOP_CRAFT_NAME
  quantityMode: 'TICKET_INPUT_OUTPUT'
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  styleName: string
  techPackSnapshotId: string
  factoryId: string
  factoryName: string
  receiverWarehouseName: typeof BUTTON_LOOP_RECEIVER_WAREHOUSE_NAME
  selectedBindingStripCount: number
  inputLines: ButtonLoopTaskInputLine[]
  inputTicketCount: number
  receivedTicketCount: number
  inputLengthM: number
  inputUnit: typeof BUTTON_LOOP_INPUT_UNIT
  outputQty: number
  handedOverQty: number
  waitHandoverQty: number
  outputUnit: typeof BUTTON_LOOP_OUTPUT_UNIT
  status: '待接收' | '加工中' | '已完结'
  events: ButtonLoopTaskEvent[]
}

export type ButtonLoopTaskAction =
  | {
      action: 'CONFIRM_RECEIVE'
      feiTicketNos: string[]
      operatorName: string
      operatedAt: string
    }
  | {
      action: 'PROCESS_REPORT' | 'SUBMIT_HANDOVER'
      outputQty: number
      operatorName: string
      operatedAt: string
    }
  | {
      action: 'COMPLETE'
      operatorName: string
      operatedAt: string
    }

function roundLength(value: number): number {
  return Math.round(value * 100) / 100
}

function stableHash(value: string): string {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function assertPositiveInteger(value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('盘扣产出或交出数量必须为正整数。')
  }
}

function buildEventId(taskOrderId: string, action: ButtonLoopTaskEvent['action'], index: number): string {
  return `${taskOrderId}-EV-${action}-${String(index + 1).padStart(3, '0')}`
}

export function buildButtonLoopTaskOrders(input: {
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  styleName: string
  techPackSnapshotId: string
  selectedBindingStrips: ButtonLoopSelectedBindingStripInput[]
}): ButtonLoopTaskOrder[] {
  const selected = input.selectedBindingStrips.filter((item) => item.requiresButtonLoop)
  if (selected.length === 0) return []

  const taskSignature = [input.productionOrderId, input.techPackSnapshotId, BUTTON_LOOP_OPERATION_ID].join('::')
  const taskOrderId = `AUX-BUTTON-${stableHash(taskSignature)}`
  const inputLines = selected.flatMap((strip) =>
    (strip.tickets ?? []).map((ticket) => ({
      ...ticket,
      inputLineId: `BLIN-${stableHash([input.productionOrderId, strip.bindingStripId, ticket.feiTicketId].join('::'))}`,
      patternFileId: strip.patternFileId,
      patternFileName: strip.patternFileName,
      bindingStripId: strip.bindingStripId,
      bindingStripNo: strip.bindingStripNo,
      bindingStripName: strip.bindingStripName,
      lengthCm: strip.lengthCm,
      widthCm: strip.widthCm,
      actualLengthM: roundLength(Number(ticket.actualLengthM) || 0),
      received: false,
    })),
  )

  const inputLengthM = roundLength(inputLines.reduce((sum, line) => sum + line.actualLengthM, 0))
  return [{
    taskOrderId,
    taskOrderNo: `AUX-${input.productionOrderNo.replace(/^PO-/, '')}-BUTTON-01`,
    operationId: BUTTON_LOOP_OPERATION_ID,
    craftName: BUTTON_LOOP_CRAFT_NAME,
    quantityMode: 'TICKET_INPUT_OUTPUT',
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo,
    styleCode: input.styleCode,
    styleName: input.styleName,
    techPackSnapshotId: input.techPackSnapshotId,
    factoryId: APF_FACTORY_ID,
    factoryName: APF_FACTORY_NAME,
    receiverWarehouseName: BUTTON_LOOP_RECEIVER_WAREHOUSE_NAME,
    selectedBindingStripCount: selected.length,
    inputLines,
    inputTicketCount: inputLines.length,
    receivedTicketCount: 0,
    inputLengthM,
    inputUnit: BUTTON_LOOP_INPUT_UNIT,
    outputQty: 0,
    handedOverQty: 0,
    waitHandoverQty: 0,
    outputUnit: BUTTON_LOOP_OUTPUT_UNIT,
    status: '待接收',
    events: [{
      eventId: buildEventId(taskOrderId, 'CREATE', 0),
      action: 'CREATE',
      operatorName: '系统',
      operatedAt: '',
      unit: BUTTON_LOOP_INPUT_UNIT,
      remark: inputLines.length
        ? `按技术包快照生成，待接收 ${inputLines.length} 张捆条菲票。`
        : `按技术包快照生成，${selected.length} 条盘扣捆条待裁床生成菲票。`,
    }],
  }]
}

export function applyButtonLoopTaskAction(
  current: ButtonLoopTaskOrder,
  action: ButtonLoopTaskAction,
): ButtonLoopTaskOrder {
  if (current.status === '已完结') throw new Error('盘扣加工单已完结，不允许继续操作。')

  if (action.action === 'CONFIRM_RECEIVE') {
    if (current.inputTicketCount === 0) throw new Error('待裁床生成捆条菲票后才能确认接收。')
    const requested = new Set(action.feiTicketNos.map((item) => item.trim()).filter(Boolean))
    const known = new Set(current.inputLines.map((item) => item.feiTicketNo))
    const unknown = [...requested].find((ticketNo) => !known.has(ticketNo))
    if (unknown) throw new Error(`捆条菲票 ${unknown} 不属于当前盘扣加工单。`)
    const inputLines = current.inputLines.map((line) =>
      requested.has(line.feiTicketNo) && !line.received
        ? { ...line, received: true, receivedAt: action.operatedAt, receivedBy: action.operatorName }
        : { ...line },
    )
    const receivedTicketCount = inputLines.filter((item) => item.received).length
    const newlyReceived = inputLines
      .filter((line, index) => line.received && !current.inputLines[index]?.received)
      .map((line) => line.feiTicketNo)
    if (newlyReceived.length === 0) return { ...current, inputLines }
    const event: ButtonLoopTaskEvent = {
      eventId: buildEventId(current.taskOrderId, action.action, current.events.length),
      action: action.action,
      operatorName: action.operatorName,
      operatedAt: action.operatedAt,
      inputTicketNos: newlyReceived,
      unit: BUTTON_LOOP_INPUT_UNIT,
      remark: `确认接收 ${newlyReceived.length} 张捆条菲票。`,
    }
    return {
      ...current,
      inputLines,
      receivedTicketCount,
      status: receivedTicketCount > 0 ? '加工中' : current.status,
      events: [...current.events, event],
    }
  }

  if (action.action === 'PROCESS_REPORT') {
    if (current.inputTicketCount === 0 || current.receivedTicketCount !== current.inputTicketCount) {
      throw new Error('全部捆条菲票确认接收后才能填报盘扣产出。')
    }
    assertPositiveInteger(action.outputQty)
    const outputQty = current.outputQty + action.outputQty
    return {
      ...current,
      status: '加工中',
      outputQty,
      waitHandoverQty: outputQty - current.handedOverQty,
      events: [...current.events, {
        eventId: buildEventId(current.taskOrderId, action.action, current.events.length),
        action: action.action,
        operatorName: action.operatorName,
        operatedAt: action.operatedAt,
        outputQty: action.outputQty,
        unit: BUTTON_LOOP_OUTPUT_UNIT,
        remark: `本次填报盘扣产出 ${action.outputQty} 个，累计 ${outputQty} 个。`,
      }],
    }
  }

  if (action.action === 'SUBMIT_HANDOVER') {
    assertPositiveInteger(action.outputQty)
    if (action.outputQty > current.waitHandoverQty) {
      throw new Error(`交出数量不能超过待交出的 ${current.waitHandoverQty} 个。`)
    }
    const handedOverQty = current.handedOverQty + action.outputQty
    return {
      ...current,
      status: '加工中',
      handedOverQty,
      waitHandoverQty: current.outputQty - handedOverQty,
      events: [...current.events, {
        eventId: buildEventId(current.taskOrderId, action.action, current.events.length),
        action: action.action,
        operatorName: action.operatorName,
        operatedAt: action.operatedAt,
        outputQty: action.outputQty,
        unit: BUTTON_LOOP_OUTPUT_UNIT,
        remark: `发起交出 ${action.outputQty} 个盘扣至${BUTTON_LOOP_RECEIVER_WAREHOUSE_NAME}。`,
      }],
    }
  }

  if (current.inputTicketCount === 0 || current.receivedTicketCount !== current.inputTicketCount) {
    throw new Error('仍有捆条菲票未确认接收，不能完成加工单。')
  }
  if (current.outputQty <= 0) throw new Error('尚未填报盘扣产出，不能完成加工单。')
  if (current.waitHandoverQty > 0) throw new Error(`仍有 ${current.waitHandoverQty} 个待交出，不能完成加工单。`)
  return {
    ...current,
    status: '已完结',
    events: [...current.events, {
      eventId: buildEventId(current.taskOrderId, action.action, current.events.length),
      action: action.action,
      operatorName: action.operatorName,
      operatedAt: action.operatedAt,
      outputQty: current.outputQty,
      unit: BUTTON_LOOP_OUTPUT_UNIT,
      remark: `盘扣加工单完成，累计产出并交出 ${current.outputQty} 个。`,
    }],
  }
}
