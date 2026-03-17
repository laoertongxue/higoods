import { renderPdaFrame } from './pda-shell'
import { escapeHtml, toClassName } from '../utils'
import {
  createSettlementChangeRequest,
  getSettlementActiveRequestByFactory,
  getSettlementEffectiveInfoByFactory,
  getSettlementLatestRequestByFactory,
  getSettlementStatusClass,
  getSettlementStatusLabel,
  type SettlementChangeRequest,
  type SettlementEffectiveInfoSnapshot,
} from '../data/fcs/settlement-change-requests'

type MainTab = 'overview' | 'tasks' | 'deductions' | 'cycles'
type TaskView = 'week' | 'all'
type DedView = 'week' | 'all'

type SettlementStatus = '待结算' | '部分结算' | '已结算'
type PaymentStatus = '待付款' | '部分付款' | '已付款'
type DeductionSettlementStatus = '待计入结算' | '已计入结算' | '处理中'
type CycleStatus = '待生成' | '待付款' | '部分付款' | '已付款'
type DeductionReason = '质量不合格' | '质量问题扣款' | '数量差异扣款' | '交接异常扣款' | '其他扣款'
type DeductionSource = '接收质检不合格' | '完工质检不合格' | '交接争议确认扣款' | '逾期违约扣款' | '辅料超耗扣款' | '数量短缺扣款'
type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'orange'

interface TaskIncome {
  taskId: string
  productionOrderId: string
  spuName: string
  process: string
  completedQty: number
  qualifiedQty: number
  defectQty: number
  qtyUnit: string
  unitPrice: number
  grossIncome: number
  deductionAmount: number
  netIncome: number
  settlementStatus: SettlementStatus
  paymentStatus: PaymentStatus
  cycleId: string
  shouldPayAmount: number
  paidAmount: number
  unpaidAmount: number
  isCurrentWeek?: boolean
  lastPaymentDate?: string
  payments?: Array<{ seq: string; date: string; amount: number }>
}

interface DeductionRecord {
  deductionId: string
  taskId: string
  productionOrderId: string
  spuName: string
  process: string
  reason: DeductionReason
  source: DeductionSource
  defectQty: number
  qtyUnit: string
  unitDeductPrice?: number
  deductQty?: number
  amount: number
  includedInSettlement: boolean
  settlementStatus: DeductionSettlementStatus
  cycleId?: string
  cycleIncludedAt?: string
  problemSummary: string
  responsibilitySummary: string
  currentStatus: string
  isCurrentWeek?: boolean
}

interface PaymentRecord {
  paymentId: string
  cycleId: string
  paymentDate: string
  amount: number
  method: string
  status: '已完成' | '处理中'
  remark: string
}

interface SettlementCycle {
  cycleId: string
  periodStart: string
  periodEnd: string
  taskCount: number
  completedQty: number
  qualifiedQty: number
  defectQty: number
  grossIncome: number
  deductionAmount: number
  shouldPayAmount: number
  paidAmount: number
  unpaidAmount: number
  status: CycleStatus
  isCurrentWeek?: boolean
  lastPaymentDate?: string
  nextPaymentNote?: string
  paymentCount: number
  paidCount: number
  tasks: TaskIncome[]
  payments: PaymentRecord[]
}

interface PdaSettlementState {
  activeTab: MainTab
  taskView: TaskView
  dedView: DedView
  taskSearch: string
  dedSearch: string
  showHistory: boolean
  showInfo: boolean
  taskDrawerTaskId: string | null
  dedDrawerId: string | null
  cycleDrawerId: string | null
  settlementRequestDrawerMode: 'create' | 'detail' | null
  settlementRequestErrors: Partial<Record<'accountHolderName' | 'idNumber' | 'bankName' | 'bankAccountNo', string>>
  settlementRequestErrorText: string
  settlementRequestForm: SettlementEffectiveInfoSnapshot & { submitRemark: string }
}

const CURRENT_FACTORY_ID = 'ID-FAC-0001'
const CURRENT_FACTORY_OPERATOR = '工厂财务-Adi'

const state: PdaSettlementState = {
  activeTab: 'overview',
  taskView: 'week',
  dedView: 'week',
  taskSearch: '',
  dedSearch: '',
  showHistory: false,
  showInfo: false,
  taskDrawerTaskId: null,
  dedDrawerId: null,
  cycleDrawerId: null,
  settlementRequestDrawerMode: null,
  settlementRequestErrors: {},
  settlementRequestErrorText: '',
  settlementRequestForm: {
    accountHolderName: '',
    idNumber: '',
    bankName: '',
    bankAccountNo: '',
    bankBranch: '',
    submitRemark: '',
  },
}

function fmtIDR(n: number): string {
  return `${n.toLocaleString('id-ID')} IDR`
}

function fmtRate(n: number, unit = '件'): string {
  return `${n.toLocaleString('id-ID')} IDR/${unit}`
}

function fmtQty(n: number, unit = '件'): string {
  return `${n.toLocaleString('id-ID')} ${unit}`
}

function maskBankAccountNo(accountNo: string): string {
  const raw = accountNo.replace(/\s+/g, '')
  if (raw.length <= 8) return raw
  return `${raw.slice(0, 4)} **** **** ${raw.slice(-4)}`
}

function getChangedSettlementFields(request: SettlementChangeRequest): string {
  const changed: string[] = []
  if (request.before.accountHolderName !== request.after.accountHolderName) changed.push('开户名')
  if (request.before.idNumber !== request.after.idNumber) changed.push('证件号')
  if (request.before.bankName !== request.after.bankName) changed.push('银行名称')
  if (request.before.bankAccountNo !== request.after.bankAccountNo) changed.push('银行账号')
  if (request.before.bankBranch !== request.after.bankBranch) changed.push('开户支行')
  return changed.length > 0 ? changed.join('、') : '信息确认'
}

function getRequestNextStepText(request: SettlementChangeRequest): string {
  if (request.status === 'PENDING_REVIEW') return '平台正在审核申请，待上传签字证明后完成通过处理'
  if (request.status === 'APPROVED') return '申请已通过，当前结算信息已更新为新版本'
  return request.rejectReason || '申请未通过，可重新发起申请'
}

function resetSettlementRequestForm(): void {
  const effective = getSettlementEffectiveInfoByFactory(CURRENT_FACTORY_ID)
  if (!effective) return
  state.settlementRequestForm = {
    accountHolderName: effective.accountHolderName,
    idNumber: effective.idNumber,
    bankName: effective.bankName,
    bankAccountNo: effective.bankAccountNo,
    bankBranch: effective.bankBranch,
    submitRemark: '',
  }
  state.settlementRequestErrors = {}
  state.settlementRequestErrorText = ''
}

const PAYMENT_RECORDS: PaymentRecord[] = [
  { paymentId: 'PAY-2026-001', cycleId: 'STL-2026-01-001', paymentDate: '2026-01-25', amount: 28_750_000, method: '银行转账', status: '已完成', remark: '1月全额付款' },
  { paymentId: 'PAY-2026-002', cycleId: 'STL-2026-02-001', paymentDate: '2026-02-20', amount: 15_000_000, method: '银行转账', status: '已完成', remark: '2月第1笔' },
  { paymentId: 'PAY-2026-003', cycleId: 'STL-2026-02-001', paymentDate: '2026-02-25', amount: 15_000_000, method: '银行转账', status: '已完成', remark: '2月第2笔，已付清' },
  { paymentId: 'PAY-2026-004', cycleId: 'STL-2026-02-002', paymentDate: '2026-02-28', amount: 12_400_000, method: '银行转账', status: '已完成', remark: '2月第2周期全额付款' },
  { paymentId: 'PAY-2026-005', cycleId: 'STL-2026-03-001', paymentDate: '2026-03-10', amount: 15_000_000, method: '银行转账', status: '已完成', remark: '3月第1周期第1笔' },
  { paymentId: 'PAY-2026-006', cycleId: 'STL-2026-03-001', paymentDate: '2026-03-18', amount: 11_500_000, method: '银行转账', status: '已完成', remark: '3月第1周期第2笔' },
  { paymentId: 'PAY-2026-007', cycleId: 'STL-2026-03-001', paymentDate: '2026-03-28', amount: 6_950_000, method: '银行转账', status: '处理中', remark: '尾款，银行处理中，预计3~5工作日到账' },
  { paymentId: 'PAY-2026-008', cycleId: 'STL-2026-03-002', paymentDate: '2026-04-05', amount: 8_000_000, method: '银行转账', status: '处理中', remark: '预付款处理中，尾款预计4月20日付清' },
  { paymentId: 'PAY-2026-W12-01', cycleId: 'STL-2026-W12', paymentDate: '2026-03-20', amount: 12_500_000, method: '银行转账', status: '已完成', remark: '本周第1笔，覆盖车缝任务' },
  { paymentId: 'PAY-2026-W12-02', cycleId: 'STL-2026-W12', paymentDate: '2026-03-25', amount: 9_800_000, method: '银行转账', status: '已完成', remark: '本周第2笔，覆盖裁片+整烫任务' },
  { paymentId: 'PAY-2026-W12-03', cycleId: 'STL-2026-W12', paymentDate: '2026-04-02', amount: 7_450_000, method: '银行转账', status: '处理中', remark: '本周尾款，银行处理中，预计3~5工作日到账' },
]

const TASK_INCOMES: TaskIncome[] = [
  { taskId: 'PDA-EXEC-W01', productionOrderId: 'PO-2026-0040', spuName: '基础款衬衫', process: '车缝', completedQty: 1600, qualifiedQty: 1580, defectQty: 20, qtyUnit: '件', unitPrice: 8500, grossIncome: 13_600_000, deductionAmount: 200_000, netIncome: 13_400_000, settlementStatus: '已结算', paymentStatus: '已付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 13_400_000, paidAmount: 13_400_000, unpaidAmount: 0, lastPaymentDate: '2026-03-25', payments: [{ seq: '第1笔', date: '2026-03-20', amount: 6_700_000 }, { seq: '第2笔', date: '2026-03-25', amount: 6_700_000 }] },
  { taskId: 'PDA-EXEC-W02', productionOrderId: 'PO-2026-0041', spuName: '工装裤', process: '裁片', completedQty: 2200, qualifiedQty: 2200, defectQty: 0, qtyUnit: '件', unitPrice: 3200, grossIncome: 7_040_000, deductionAmount: 0, netIncome: 7_040_000, settlementStatus: '已结算', paymentStatus: '已付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 7_040_000, paidAmount: 7_040_000, unpaidAmount: 0, lastPaymentDate: '2026-03-25', payments: [{ seq: '第1笔', date: '2026-03-25', amount: 7_040_000 }] },
  { taskId: 'PDA-EXEC-W03', productionOrderId: 'PO-2026-0042', spuName: '休闲外套', process: '整烫', completedQty: 980, qualifiedQty: 960, defectQty: 20, qtyUnit: '件', unitPrice: 2000, grossIncome: 1_960_000, deductionAmount: 80_000, netIncome: 1_880_000, settlementStatus: '部分结算', paymentStatus: '部分付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 1_880_000, paidAmount: 900_000, unpaidAmount: 980_000, lastPaymentDate: '2026-03-25', payments: [{ seq: '第1笔', date: '2026-03-25', amount: 900_000 }] },
  { taskId: 'PDA-EXEC-W04', productionOrderId: 'PO-2026-0043', spuName: '牛仔裤C', process: '车缝', completedQty: 1200, qualifiedQty: 1160, defectQty: 40, qtyUnit: '件', unitPrice: 8500, grossIncome: 10_200_000, deductionAmount: 280_000, netIncome: 9_920_000, settlementStatus: '部分结算', paymentStatus: '部分付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 9_920_000, paidAmount: 4_500_000, unpaidAmount: 5_420_000, lastPaymentDate: '2026-03-20', payments: [{ seq: '第1笔', date: '2026-03-20', amount: 4_500_000 }] },
  { taskId: 'PDA-EXEC-W05', productionOrderId: 'PO-2026-0044', spuName: '连衣裙A款', process: '包装', completedQty: 1500, qualifiedQty: 1500, defectQty: 0, qtyUnit: '件', unitPrice: 1500, grossIncome: 2_250_000, deductionAmount: 0, netIncome: 2_250_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 2_250_000, paidAmount: 0, unpaidAmount: 2_250_000, payments: [] },
  { taskId: 'PDA-EXEC-W06', productionOrderId: 'PO-2026-0045', spuName: '商务衬衫B', process: '整烫', completedQty: 800, qualifiedQty: 800, defectQty: 0, qtyUnit: '件', unitPrice: 2000, grossIncome: 1_600_000, deductionAmount: 60_000, netIncome: 1_540_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 1_540_000, paidAmount: 0, unpaidAmount: 1_540_000, payments: [] },
  { taskId: 'PDA-EXEC-W07', productionOrderId: 'PO-2026-0046', spuName: '运动套装', process: '裁片', completedQty: 1800, qualifiedQty: 1800, defectQty: 0, qtyUnit: '件', unitPrice: 3200, grossIncome: 5_760_000, deductionAmount: 0, netIncome: 5_760_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 5_760_000, paidAmount: 0, unpaidAmount: 5_760_000, payments: [] },
  { taskId: 'PDA-EXEC-W08', productionOrderId: 'PO-2026-0047', spuName: '基础款T恤', process: '包装', completedQty: 2400, qualifiedQty: 2380, defectQty: 20, qtyUnit: '件', unitPrice: 1500, grossIncome: 3_600_000, deductionAmount: 100_000, netIncome: 3_500_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-W12', isCurrentWeek: true, shouldPayAmount: 3_500_000, paidAmount: 0, unpaidAmount: 3_500_000, payments: [] },
  { taskId: 'PDA-EXEC-001', productionOrderId: 'PO-2024-0012', spuName: '基础款衬衫', process: '裁片', completedQty: 1800, qualifiedQty: 1800, defectQty: 0, qtyUnit: '件', unitPrice: 3500, grossIncome: 6_300_000, deductionAmount: 0, netIncome: 6_300_000, settlementStatus: '已结算', paymentStatus: '已付款', cycleId: 'STL-2026-03-001', shouldPayAmount: 6_300_000, paidAmount: 6_300_000, unpaidAmount: 0, lastPaymentDate: '2026-03-18', payments: [{ seq: '第1笔', date: '2026-03-10', amount: 3_150_000 }, { seq: '第2笔', date: '2026-03-18', amount: 3_150_000 }] },
  { taskId: 'PDA-EXEC-003', productionOrderId: 'PO-2024-0012', spuName: '基础款衬衫', process: '车缝', completedQty: 1800, qualifiedQty: 1755, defectQty: 45, qtyUnit: '件', unitPrice: 8500, grossIncome: 15_300_000, deductionAmount: 510_000, netIncome: 14_790_000, settlementStatus: '已结算', paymentStatus: '已付款', cycleId: 'STL-2026-03-001', shouldPayAmount: 14_790_000, paidAmount: 14_790_000, unpaidAmount: 0, lastPaymentDate: '2026-03-18', payments: [{ seq: '第1笔', date: '2026-03-10', amount: 7_395_000 }, { seq: '第2笔', date: '2026-03-18', amount: 7_395_000 }] },
  { taskId: 'PDA-EXEC-014', productionOrderId: 'PO-2024-0024', spuName: '工装裤', process: '裁片', completedQty: 2000, qualifiedQty: 2000, defectQty: 0, qtyUnit: '件', unitPrice: 3200, grossIncome: 6_400_000, deductionAmount: 0, netIncome: 6_400_000, settlementStatus: '已结算', paymentStatus: '已付款', cycleId: 'STL-2026-03-001', shouldPayAmount: 6_400_000, paidAmount: 6_400_000, unpaidAmount: 0, lastPaymentDate: '2026-03-10', payments: [{ seq: '第1笔', date: '2026-03-10', amount: 6_400_000 }] },
  { taskId: 'PDA-EXEC-016', productionOrderId: 'PO-2024-0026', spuName: '休闲外套', process: '裁片', completedQty: 1100, qualifiedQty: 1080, defectQty: 20, qtyUnit: '件', unitPrice: 3800, grossIncome: 4_180_000, deductionAmount: 80_000, netIncome: 4_100_000, settlementStatus: '部分结算', paymentStatus: '部分付款', cycleId: 'STL-2026-03-001', shouldPayAmount: 4_100_000, paidAmount: 2_000_000, unpaidAmount: 2_100_000, lastPaymentDate: '2026-03-18', payments: [{ seq: '第1笔', date: '2026-03-18', amount: 2_000_000 }] },
  { taskId: 'PDA-EXEC-007', productionOrderId: 'PO-2024-0017', spuName: '基础款T恤', process: '裁片', completedQty: 1500, qualifiedQty: 1465, defectQty: 35, qtyUnit: '件', unitPrice: 3500, grossIncome: 5_250_000, deductionAmount: 175_000, netIncome: 5_075_000, settlementStatus: '部分结算', paymentStatus: '部分付款', cycleId: 'STL-2026-03-001', shouldPayAmount: 5_075_000, paidAmount: 2_700_000, unpaidAmount: 2_375_000, lastPaymentDate: '2026-03-18', payments: [{ seq: '第1笔', date: '2026-03-18', amount: 2_700_000 }] },
  { taskId: 'PDA-EXEC-008', productionOrderId: 'PO-2024-0018', spuName: '基础款T恤', process: '车缝', completedQty: 800, qualifiedQty: 800, defectQty: 0, qtyUnit: '件', unitPrice: 8500, grossIncome: 6_800_000, deductionAmount: 255_000, netIncome: 6_545_000, settlementStatus: '部分结算', paymentStatus: '待付款', cycleId: 'STL-2026-03-001', shouldPayAmount: 6_545_000, paidAmount: 0, unpaidAmount: 6_545_000, payments: [] },
  { taskId: 'PDA-EXEC-009', productionOrderId: 'PO-2024-0019', spuName: '连衣裙A款', process: '整烫', completedQty: 800, qualifiedQty: 720, defectQty: 80, qtyUnit: '件', unitPrice: 2000, grossIncome: 1_600_000, deductionAmount: 360_000, netIncome: 1_240_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-03-002', shouldPayAmount: 1_240_000, paidAmount: 0, unpaidAmount: 1_240_000, payments: [] },
  { taskId: 'PDA-EXEC-010', productionOrderId: 'PO-2024-0020', spuName: '运动套装', process: '包装', completedQty: 1200, qualifiedQty: 1200, defectQty: 0, qtyUnit: '件', unitPrice: 1500, grossIncome: 1_800_000, deductionAmount: 0, netIncome: 1_800_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-03-002', shouldPayAmount: 1_800_000, paidAmount: 0, unpaidAmount: 1_800_000, payments: [] },
  { taskId: 'PDA-EXEC-011', productionOrderId: 'PO-2024-0021', spuName: '商务衬衫B', process: '车缝', completedQty: 600, qualifiedQty: 600, defectQty: 0, qtyUnit: '件', unitPrice: 8500, grossIncome: 5_100_000, deductionAmount: 60_000, netIncome: 5_040_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-03-002', shouldPayAmount: 5_040_000, paidAmount: 0, unpaidAmount: 5_040_000, payments: [] },
  { taskId: 'PDA-EXEC-012', productionOrderId: 'PO-2024-0022', spuName: '商务衬衫B', process: '整烫', completedQty: 965, qualifiedQty: 917, defectQty: 48, qtyUnit: '件', unitPrice: 2000, grossIncome: 1_930_000, deductionAmount: 192_000, netIncome: 1_738_000, settlementStatus: '待结算', paymentStatus: '待付款', cycleId: 'STL-2026-03-002', shouldPayAmount: 1_738_000, paidAmount: 0, unpaidAmount: 1_738_000, payments: [] },
  { taskId: 'PDA-EXEC-020', productionOrderId: 'PO-2024-0030', spuName: '休闲外套', process: '车缝', completedQty: 950, qualifiedQty: 950, defectQty: 0, qtyUnit: '件', unitPrice: 8500, grossIncome: 8_075_000, deductionAmount: 0, netIncome: 8_075_000, settlementStatus: '已结算', paymentStatus: '已付款', cycleId: 'STL-2026-02-001', shouldPayAmount: 8_075_000, paidAmount: 8_075_000, unpaidAmount: 0, lastPaymentDate: '2026-02-25', payments: [{ seq: '第1笔', date: '2026-02-20', amount: 4_000_000 }, { seq: '第2笔', date: '2026-02-25', amount: 4_075_000 }] },
]

const DEDUCTION_RECORDS: DeductionRecord[] = [
  { deductionId: 'DED-W12-001', taskId: 'PDA-EXEC-W01', productionOrderId: 'PO-2026-0040', spuName: '基础款衬衫', process: '车缝', reason: '质量不合格', source: '接收质检不合格', defectQty: 20, qtyUnit: '件', unitDeductPrice: 10_000, deductQty: 20, amount: 200_000, includedInSettlement: true, settlementStatus: '已计入结算', cycleId: 'STL-2026-W12', cycleIncludedAt: '2026-03-19 09:00', isCurrentWeek: true, problemSummary: '20件车缝线迹跳针，前片缝合不达标', responsibilitySummary: '工厂操作问题，质检已留证，工厂签认', currentStatus: '已确认，已计入本周结算' },
  { deductionId: 'DED-W12-002', taskId: 'PDA-EXEC-W03', productionOrderId: 'PO-2026-0042', spuName: '休闲外套', process: '整烫', reason: '质量不合格', source: '完工质检不合格', defectQty: 20, qtyUnit: '件', unitDeductPrice: 4_000, deductQty: 20, amount: 80_000, includedInSettlement: true, settlementStatus: '已计入结算', cycleId: 'STL-2026-W12', cycleIncludedAt: '2026-03-22 10:00', isCurrentWeek: true, problemSummary: '20件整烫后肩部定型不达标，需质量处理', responsibilitySummary: '温度设置不当，质检记录已存档', currentStatus: '已确认，已计入本周结算' },
  { deductionId: 'DED-W12-003', taskId: 'PDA-EXEC-W04', productionOrderId: 'PO-2026-0043', spuName: '牛仔裤C', process: '车缝', reason: '质量问题扣款', source: '完工质检不合格', defectQty: 40, qtyUnit: '件', unitDeductPrice: 5_000, deductQty: 40, amount: 200_000, includedInSettlement: true, settlementStatus: '已计入结算', cycleId: 'STL-2026-W12', cycleIncludedAt: '2026-03-21 14:00', isCurrentWeek: true, problemSummary: '40件裤脚缝边不均，需质量处理后复核', responsibilitySummary: '工厂自检上报，扣款已协商一致', currentStatus: '已确认，已计入本周结算' },
  { deductionId: 'DED-W12-004', taskId: 'PDA-EXEC-W04', productionOrderId: 'PO-2026-0043', spuName: '牛仔裤C', process: '车缝', reason: '数量差异扣款', source: '数量短缺扣款', defectQty: 0, qtyUnit: '件', amount: 80_000, includedInSettlement: true, settlementStatus: '已计入结算', cycleId: 'STL-2026-W12', cycleIncludedAt: '2026-03-23 11:00', isCurrentWeek: true, problemSummary: '实交1200件，应交1220件，差20件，按合同扣款', responsibilitySummary: '交接签收单确认差异，工厂已认可', currentStatus: '已确认，已计入本周结算' },
  { deductionId: 'DED-W12-005', taskId: 'PDA-EXEC-W06', productionOrderId: 'PO-2026-0045', spuName: '商务衬衫B', process: '整烫', reason: '其他扣款', source: '辅料超耗扣款', defectQty: 0, qtyUnit: '件', amount: 60_000, includedInSettlement: false, settlementStatus: '待计入结算', isCurrentWeek: true, problemSummary: '辅料超耗12%，超耗部分按合同扣款', responsibilitySummary: '领料记录核实，超耗责任认定', currentStatus: '待计入本周结算' },
  { deductionId: 'DED-W12-006', taskId: 'PDA-EXEC-W08', productionOrderId: 'PO-2026-0047', spuName: '基础款T恤', process: '包装', reason: '质量不合格', source: '接收质检不合格', defectQty: 20, qtyUnit: '件', unitDeductPrice: 5_000, deductQty: 20, amount: 100_000, includedInSettlement: false, settlementStatus: '待计入结算', isCurrentWeek: true, problemSummary: '20件包装破损，不符合交付标准', responsibilitySummary: '工厂操作问题，已拍照留证', currentStatus: '待计入本周结算' },
  { deductionId: 'DED-2026-001', taskId: 'PDA-EXEC-003', productionOrderId: 'PO-2024-0012', spuName: '基础款衬衫', process: '车缝', reason: '质量不合格', source: '接收质检不合格', defectQty: 45, qtyUnit: '件', unitDeductPrice: 10_000, deductQty: 45, amount: 450_000, includedInSettlement: true, settlementStatus: '已计入结算', cycleId: 'STL-2026-03-001', cycleIncludedAt: '2026-03-05 09:00', problemSummary: '车缝线迹跳针，45件前片缝合不达标', responsibilitySummary: '工厂生产操作问题，质检留证，工厂已签认', currentStatus: '已确认，已计入3月第1周期' },
  { deductionId: 'DED-2026-002', taskId: 'PDA-EXEC-007', productionOrderId: 'PO-2024-0017', spuName: '基础款T恤', process: '裁片', reason: '质量不合格', source: '完工质检不合格', defectQty: 35, qtyUnit: '件', unitDeductPrice: 5_000, deductQty: 35, amount: 175_000, includedInSettlement: true, settlementStatus: '已计入结算', cycleId: 'STL-2026-03-001', cycleIncludedAt: '2026-03-06 10:30', problemSummary: '裁片前片肩宽偏大1.5cm，35件不合格', responsibilitySummary: '裁剪操作失误，完工质检发现，已留证', currentStatus: '已确认，已计入3月第1周期' },
  { deductionId: 'DED-2026-003', taskId: 'PDA-EXEC-008', productionOrderId: 'PO-2024-0018', spuName: '基础款T恤', process: '车缝', reason: '其他扣款', source: '逾期违约扣款', defectQty: 0, qtyUnit: '件', amount: 255_000, includedInSettlement: true, settlementStatus: '已计入结算', cycleId: 'STL-2026-03-001', cycleIncludedAt: '2026-03-07 14:00', problemSummary: '任务逾期2天，按合同扣除违约金', responsibilitySummary: '设备故障导致逾期，已提交生产暂停记录', currentStatus: '已确认，已计入3月第1周期' },
]

const SETTLEMENT_CYCLES: SettlementCycle[] = [
  { cycleId: 'STL-2026-W12', periodStart: '2026-03-16', periodEnd: '2026-03-22', taskCount: 8, completedQty: 12480, qualifiedQty: 12380, defectQty: 100, grossIncome: 46_010_000, deductionAmount: 720_000, shouldPayAmount: 45_290_000, paidAmount: 29_750_000, unpaidAmount: 15_540_000, status: '部分付款', isCurrentWeek: true, lastPaymentDate: '2026-03-25', nextPaymentNote: '尾款 7,450,000 IDR 银行处理中，预计3~5工作日到账', paymentCount: 3, paidCount: 2, tasks: TASK_INCOMES.filter((t) => t.cycleId === 'STL-2026-W12'), payments: PAYMENT_RECORDS.filter((p) => p.cycleId === 'STL-2026-W12') },
  { cycleId: 'STL-2026-03-001', periodStart: '2026-03-01', periodEnd: '2026-03-15', taskCount: 6, completedQty: 9000, qualifiedQty: 8900, defectQty: 100, grossIncome: 44_230_000, deductionAmount: 960_000, shouldPayAmount: 43_270_000, paidAmount: 26_500_000, unpaidAmount: 16_770_000, status: '部分付款', lastPaymentDate: '2026-03-18', nextPaymentNote: '尾款 6,950,000 IDR 银行处理中，预计3~5工作日到账', paymentCount: 3, paidCount: 2, tasks: TASK_INCOMES.filter((t) => t.cycleId === 'STL-2026-03-001'), payments: PAYMENT_RECORDS.filter((p) => p.cycleId === 'STL-2026-03-001') },
  { cycleId: 'STL-2026-03-002', periodStart: '2026-03-16', periodEnd: '2026-03-31', taskCount: 10, completedQty: 9695, qualifiedQty: 9547, defectQty: 148, grossIncome: 27_897_000, deductionAmount: 820_000, shouldPayAmount: 27_077_000, paidAmount: 8_000_000, unpaidAmount: 19_077_000, status: '待付款', nextPaymentNote: '预计4月10日结算，4月20日付款', paymentCount: 1, paidCount: 0, tasks: TASK_INCOMES.filter((t) => t.cycleId === 'STL-2026-03-002'), payments: PAYMENT_RECORDS.filter((p) => p.cycleId === 'STL-2026-03-002') },
  { cycleId: 'STL-2026-02-002', periodStart: '2026-02-16', periodEnd: '2026-02-28', taskCount: 4, completedQty: 5800, qualifiedQty: 5800, defectQty: 0, grossIncome: 12_400_000, deductionAmount: 0, shouldPayAmount: 12_400_000, paidAmount: 12_400_000, unpaidAmount: 0, status: '已付款', lastPaymentDate: '2026-02-28', paymentCount: 1, paidCount: 1, tasks: [], payments: PAYMENT_RECORDS.filter((p) => p.cycleId === 'STL-2026-02-002') },
  { cycleId: 'STL-2026-02-001', periodStart: '2026-02-01', periodEnd: '2026-02-15', taskCount: 5, completedQty: 7200, qualifiedQty: 7170, defectQty: 30, grossIncome: 30_240_000, deductionAmount: 240_000, shouldPayAmount: 30_000_000, paidAmount: 30_000_000, unpaidAmount: 0, status: '已付款', lastPaymentDate: '2026-02-25', paymentCount: 2, paidCount: 2, tasks: TASK_INCOMES.filter((t) => t.cycleId === 'STL-2026-02-001'), payments: PAYMENT_RECORDS.filter((p) => p.cycleId === 'STL-2026-02-001') },
  { cycleId: 'STL-2026-01-001', periodStart: '2026-01-01', periodEnd: '2026-01-31', taskCount: 8, completedQty: 11200, qualifiedQty: 11200, defectQty: 0, grossIncome: 28_750_000, deductionAmount: 0, shouldPayAmount: 28_750_000, paidAmount: 28_750_000, unpaidAmount: 0, status: '已付款', lastPaymentDate: '2026-01-25', paymentCount: 1, paidCount: 1, tasks: [], payments: PAYMENT_RECORDS.filter((p) => p.cycleId === 'STL-2026-01-001') },
]

const CW = SETTLEMENT_CYCLES.find((c) => c.isCurrentWeek) || SETTLEMENT_CYCLES[0]
const CW_TASKS = TASK_INCOMES.filter((t) => t.isCurrentWeek)
const CW_DEDUCTIONS = DEDUCTION_RECORDS.filter((d) => d.isCurrentWeek)
const CW_GROSS = CW_TASKS.reduce((s, t) => s + t.grossIncome, 0)
const CW_DEDUCT = CW_DEDUCTIONS.reduce((s, d) => s + d.amount, 0)
const CW_PAID = CW.paidAmount
const CW_UNPAID = CW.unpaidAmount
const CW_SHOULD = CW.shouldPayAmount
const CW_DEDUCT_COUNT = CW_DEDUCTIONS.length
const CW_DEDUCT_INCLUDED = CW_DEDUCTIONS.filter((d) => d.includedInSettlement)
const CW_DEDUCT_PENDING = CW_DEDUCTIONS.filter((d) => !d.includedInSettlement)

const ALL_GROSS = TASK_INCOMES.reduce((s, t) => s + t.grossIncome, 0)
const ALL_DEDUCT = DEDUCTION_RECORDS.reduce((s, d) => s + d.amount, 0)
const ALL_SHOULD = TASK_INCOMES.reduce((s, t) => s + t.shouldPayAmount, 0)
const ALL_PAID = PAYMENT_RECORDS.filter((p) => p.status === '已完成').reduce((s, p) => s + p.amount, 0)
const ALL_UNPAID = ALL_SHOULD - ALL_PAID

function paymentVariant(s: PaymentStatus): BadgeVariant {
  return s === '已付款' ? 'green' : s === '部分付款' ? 'amber' : 'gray'
}

function settlementVariant(s: SettlementStatus): BadgeVariant {
  return s === '已结算' ? 'green' : s === '部分结算' ? 'amber' : 'blue'
}

function cycleVariant(s: CycleStatus): BadgeVariant {
  return s === '已付款' ? 'green' : s === '部分付款' ? 'amber' : s === '待付款' ? 'orange' : 'gray'
}

function deductVariant(s: DeductionSettlementStatus): BadgeVariant {
  return s === '已计入结算' ? 'green' : s === '处理中' ? 'amber' : 'gray'
}

function renderStatusBadge(text: string, variant: BadgeVariant): string {
  return `<span class="inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium ${
    variant === 'green'
      ? 'bg-green-50 text-green-700'
      : variant === 'amber'
        ? 'bg-amber-50 text-amber-700'
        : variant === 'red'
          ? 'bg-red-50 text-red-700'
          : variant === 'blue'
            ? 'bg-blue-50 text-blue-700'
            : variant === 'orange'
              ? 'bg-orange-50 text-orange-700'
              : 'bg-muted text-muted-foreground'
  }">${escapeHtml(text)}</span>`
}

function renderRow(
  label: string,
  value: string,
  opts: { bold?: boolean; red?: boolean; green?: boolean; orange?: boolean } = {},
): string {
  return `
    <div class="flex items-center justify-between py-0.5">
      <span class="text-xs text-muted-foreground">${escapeHtml(label)}</span>
      <span class="text-xs tabular-nums ${toClassName(
        opts.bold ? 'font-semibold' : '',
        opts.red ? 'font-semibold text-red-600' : '',
        opts.green ? 'font-semibold text-green-600' : '',
        opts.orange ? 'font-semibold text-orange-600' : '',
      )}">${escapeHtml(value)}</span>
    </div>
  `
}

function renderProgress(value: number, heightClass = 'h-2'): string {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
  return `
    <div class="${heightClass} w-full overflow-hidden rounded-full bg-muted">
      <div class="h-full bg-primary transition-all" style="width:${normalized}%"></div>
    </div>
  `
}

function renderSCard(title: string, body: string, className = ''): string {
  return `
    <article class="rounded-lg border bg-card shadow-none ${className}">
      <header class="px-4 pb-1.5 pt-3">
        <h3 class="text-sm font-semibold">${escapeHtml(title)}</h3>
      </header>
      <div class="space-y-1.5 px-4 pb-3">${body}</div>
    </article>
  `
}

function renderDrawer(title: string, body: string, closeAction: string): string {
  return `
    <div class="fixed inset-0 z-50 flex flex-col bg-background">
      <div class="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <button class="rounded p-1 hover:bg-muted" data-pda-sett-action="${closeAction}">
          <i data-lucide="x" class="h-5 w-5"></i>
        </button>
        <h2 class="flex-1 truncate text-sm font-semibold">${escapeHtml(title)}</h2>
      </div>
      <div class="flex-1 space-y-4 overflow-y-auto p-4">${body}</div>
    </div>
  `
}

function getTaskById(taskId: string | null): TaskIncome | null {
  if (!taskId) return null
  return TASK_INCOMES.find((item) => item.taskId === taskId) ?? null
}

function getDedById(deductionId: string | null): DeductionRecord | null {
  if (!deductionId) return null
  return DEDUCTION_RECORDS.find((item) => item.deductionId === deductionId) ?? null
}

function getCycleById(cycleId: string | null): SettlementCycle | null {
  if (!cycleId) return null
  return SETTLEMENT_CYCLES.find((item) => item.cycleId === cycleId) ?? null
}

function renderTaskDrawer(task: TaskIncome): string {
  const weekCard =
    task.isCurrentWeek
      ? renderSCard(
          '本周结算影响',
          `${renderRow('是否纳入本周结算', task.settlementStatus === '待结算' ? '待纳入' : '已纳入')}
           ${renderRow('本周计入金额', fmtIDR(task.shouldPayAmount), { bold: true })}
           ${renderRow('本周扣款', task.deductionAmount > 0 ? fmtIDR(task.deductionAmount) : '—', { red: task.deductionAmount > 0 })}
           ${renderRow('本周已付', fmtIDR(task.paidAmount), { green: task.paidAmount > 0 })}
           ${renderRow('本周未付', task.unpaidAmount > 0 ? fmtIDR(task.unpaidAmount) : '—', { red: task.unpaidAmount > 0 })}`,
          'border-blue-200 bg-blue-50/30',
        )
      : ''

  const payments =
    task.payments && task.payments.length > 0
      ? renderSCard(
          '付款记录',
          task.payments
            .map(
              (p) => `
                <div class="flex items-center justify-between py-0.5 text-xs">
                  <span class="text-muted-foreground">${escapeHtml(`${p.seq} · ${p.date}`)}</span>
                  <span class="font-medium text-green-700">${escapeHtml(fmtIDR(p.amount))}</span>
                </div>
              `,
            )
            .join(''),
        )
      : ''

  return renderDrawer(
    `任务收入 · ${task.taskId}`,
    `
      ${weekCard}
      ${renderSCard(
        '金额明细',
        `${renderRow('毛收入', fmtIDR(task.grossIncome))}
         ${renderRow('扣款金额', task.deductionAmount > 0 ? fmtIDR(task.deductionAmount) : '—', { red: task.deductionAmount > 0 })}
         ${renderRow('应结金额', fmtIDR(task.shouldPayAmount), { bold: true })}
         ${renderRow('已付金额', fmtIDR(task.paidAmount), { green: task.paidAmount > 0 })}
         ${renderRow('未付金额', task.unpaidAmount > 0 ? fmtIDR(task.unpaidAmount) : '已付清', {
           red: task.unpaidAmount > 0,
           green: task.unpaidAmount === 0,
         })}`,
      )}
      ${renderSCard(
        '数量明细',
        `${renderRow('完成数量', fmtQty(task.completedQty, task.qtyUnit))}
         ${renderRow('合格数量', fmtQty(task.qualifiedQty, task.qtyUnit))}
         ${renderRow('不合格数量', task.defectQty > 0 ? fmtQty(task.defectQty, task.qtyUnit) : '—')}
         ${renderRow('单价', fmtRate(task.unitPrice, task.qtyUnit))}`,
      )}
      ${renderSCard(
        '基础信息',
        `${renderRow('任务编号', task.taskId)}
         ${renderRow('生产单号', task.productionOrderId)}
         ${renderRow('款式', task.spuName)}
         ${renderRow('工序', task.process)}
         ${renderRow('结算周期', task.cycleId)}
         ${renderRow('结算状态', task.settlementStatus)}
         ${renderRow('付款状态', task.paymentStatus)}`,
      )}
      ${payments}
      <div class="flex flex-wrap gap-2">
        <button
          class="flex-1 rounded-md border px-3 py-2 text-xs hover:bg-muted"
          data-pda-sett-action="goto-cycle-from-task"
          data-cycle-id="${escapeHtml(task.cycleId)}"
        >
          <i data-lucide="arrow-right" class="mr-1 inline-block h-3.5 w-3.5"></i>查看所属周期
        </button>
      </div>
    `,
    'close-task-drawer',
  )
}

function renderDeductionDrawer(ded: DeductionRecord): string {
  return renderDrawer(
    `扣款明细 · ${ded.deductionId}`,
    `
      ${renderSCard(
        '本周结算影响',
        `${renderRow('是否影响本周拿钱', ded.includedInSettlement ? '是，已计入结算' : '待计入，尚未影响', {
          red: ded.includedInSettlement,
          orange: !ded.includedInSettlement,
        })}
         ${renderRow('影响金额', fmtIDR(ded.amount), { red: true })}
         ${renderRow('所属周期', ded.cycleId || '待分配')}
         ${renderRow('当前状态', ded.currentStatus)}`,
        ded.isCurrentWeek ? 'border-amber-200 bg-amber-50/30' : '',
      )}
      ${renderSCard(
        '扣款信息',
        `${renderRow('扣款单号', ded.deductionId)}
         ${renderRow('扣款原因', ded.reason)}
         ${renderRow('扣款来源', ded.source)}
         ${renderRow('扣款金额', fmtIDR(ded.amount), { bold: true })}
         ${ded.unitDeductPrice ? renderRow('单件扣款价', fmtRate(ded.unitDeductPrice, ded.qtyUnit)) : ''}
         ${ded.deductQty ? renderRow('扣款数量', fmtQty(ded.deductQty, ded.qtyUnit)) : ''}`,
      )}
      ${renderSCard(
        '关联任务',
        `${renderRow('任务编号', ded.taskId)}
         ${renderRow('款式', ded.spuName)}
         ${renderRow('工序', ded.process)}
         ${renderRow('生产单号', ded.productionOrderId)}`,
      )}
      ${renderSCard(
        '问题记录',
        `<p class="text-xs leading-relaxed text-muted-foreground">${escapeHtml(ded.problemSummary)}</p>
         <p class="mt-1 text-xs leading-relaxed text-muted-foreground">责任认定：${escapeHtml(ded.responsibilitySummary)}</p>`,
      )}
      <div class="flex gap-2">
        <button
          class="flex-1 rounded-md border px-3 py-2 text-xs hover:bg-muted"
          data-pda-sett-action="goto-task-from-ded"
          data-task-id="${escapeHtml(ded.taskId)}"
        >
          <i data-lucide="arrow-right" class="mr-1 inline-block h-3.5 w-3.5"></i>查看关联任务
        </button>
        <button class="flex-1 rounded-md px-3 py-2 text-xs text-muted-foreground" disabled>申诉（功能建设中）</button>
      </div>
    `,
    'close-ded-drawer',
  )
}

function renderCycleDrawer(cycle: SettlementCycle): string {
  const paidRate = cycle.shouldPayAmount > 0 ? Math.round((cycle.paidAmount / cycle.shouldPayAmount) * 100) : 0

  const payments =
    cycle.payments.length > 0
      ? renderSCard(
          cycle.isCurrentWeek ? '本周付款记录' : '付款记录',
          cycle.payments
            .map(
              (p) => `
                <div class="border-b py-1 last:border-0">
                  <div class="flex items-start justify-between">
                    <div class="min-w-0 flex-1">
                      <div class="text-xs font-medium">${escapeHtml(p.paymentId)}</div>
                      <div class="text-[10px] text-muted-foreground">${escapeHtml(`${p.paymentDate} · ${p.method}`)}</div>
                      <div class="mt-0.5 text-[10px] text-muted-foreground">${escapeHtml(p.remark)}</div>
                    </div>
                    <div class="ml-3 flex shrink-0 flex-col items-end">
                      <span class="text-xs font-semibold text-green-700">${escapeHtml(fmtIDR(p.amount))}</span>
                      ${renderStatusBadge(p.status, p.status === '已完成' ? 'green' : 'amber')}
                    </div>
                  </div>
                </div>
              `,
            )
            .join(''),
        )
      : ''

  const tasks =
    cycle.tasks.length > 0
      ? renderSCard(
          cycle.isCurrentWeek ? '本周覆盖任务' : '覆盖任务',
          cycle.tasks
            .map(
              (t) => `
                <button
                  class="w-full border-b py-1.5 text-left last:border-0"
                  data-pda-sett-action="goto-task-from-cycle"
                  data-task-id="${escapeHtml(t.taskId)}"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <span class="text-xs font-medium">${escapeHtml(t.taskId)}</span>
                      <span class="ml-2 text-[10px] text-muted-foreground">${escapeHtml(`${t.spuName} · ${t.process}`)}</span>
                    </div>
                    <i data-lucide="chevron-right" class="h-3.5 w-3.5 text-muted-foreground"></i>
                  </div>
                  <div class="mt-0.5 flex items-center gap-2">
                    <span class="text-[10px] text-muted-foreground">净额 ${escapeHtml(fmtIDR(t.netIncome))}</span>
                    ${renderStatusBadge(t.paymentStatus, paymentVariant(t.paymentStatus))}
                  </div>
                </button>
              `,
            )
            .join(''),
        )
      : ''

  return renderDrawer(
    `结算周期 · ${cycle.cycleId}`,
    `
      ${renderSCard(
        cycle.isCurrentWeek ? '本周付款状态' : '付款状态',
        `${renderRow('应付金额', fmtIDR(cycle.shouldPayAmount), { bold: true })}
         ${renderRow('已付金额', fmtIDR(cycle.paidAmount), { green: cycle.paidAmount > 0 })}
         ${renderRow('未付金额', cycle.unpaidAmount > 0 ? fmtIDR(cycle.unpaidAmount) : '已付清', {
           red: cycle.unpaidAmount > 0,
           green: cycle.unpaidAmount === 0,
         })}
         <div class="pt-1">
           <div class="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
             <span>付款进度</span>
             <span>${paidRate}%</span>
           </div>
           ${renderProgress(paidRate, 'h-1.5')}
         </div>
         ${
           cycle.unpaidAmount > 0
             ? `<div class="mt-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700">还差 ${escapeHtml(fmtIDR(cycle.unpaidAmount))} 未付</div>`
             : ''
         }
         ${cycle.nextPaymentNote ? `<p class="mt-1 text-[10px] text-muted-foreground">${escapeHtml(cycle.nextPaymentNote)}</p>` : ''}`,
        cycle.unpaidAmount > 0 ? 'border-orange-200 bg-orange-50/30' : 'border-green-200 bg-green-50/30',
      )}
      ${payments}
      ${tasks}
      ${renderSCard(
        '金额汇总',
        `${renderRow('毛收入', fmtIDR(cycle.grossIncome))}
         ${renderRow('扣款', cycle.deductionAmount > 0 ? fmtIDR(cycle.deductionAmount) : '—', { red: cycle.deductionAmount > 0 })}
         ${renderRow('应结金额', fmtIDR(cycle.shouldPayAmount), { bold: true })}
         ${renderRow('覆盖任务数', `${cycle.taskCount} 个`)}
         ${renderRow('完成数量', fmtQty(cycle.completedQty))}
         ${renderRow('不合格数量', cycle.defectQty > 0 ? fmtQty(cycle.defectQty) : '—')}
         ${renderRow('周期起止', `${cycle.periodStart} ~ ${cycle.periodEnd}`)}`,
      )}
    `,
    'close-cycle-drawer',
  )
}

function renderSettlementInfoSection(): string {
  const effective = getSettlementEffectiveInfoByFactory(CURRENT_FACTORY_ID)
  if (!effective) {
    return `
      <article class="rounded-lg border bg-card p-4 shadow-none">
        <div class="text-sm font-semibold">结算信息</div>
        <div class="mt-2 text-xs text-muted-foreground">当前工厂尚未初始化结算信息</div>
        <div class="mt-1 text-xs text-muted-foreground">初始化完成后，才可查看结算信息并发起修改申请</div>
      </article>
    `
  }

  const activeRequest = getSettlementActiveRequestByFactory(CURRENT_FACTORY_ID)
  const latestRequest = getSettlementLatestRequestByFactory(CURRENT_FACTORY_ID)
  const currentRequest = activeRequest ?? latestRequest
  const hasActiveRequest = Boolean(activeRequest)

  return `
    <article class="rounded-lg border bg-card shadow-none">
      <header class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 class="text-sm font-semibold">结算信息</h3>
          <p class="mt-0.5 text-[10px] text-muted-foreground">以下为当前生效结算信息，提交申请后不会立即生效</p>
        </div>
        <button
          class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          data-pda-sett-action="${hasActiveRequest ? 'open-settlement-request-detail' : 'open-settlement-change-request'}"
        >
          ${hasActiveRequest ? '查看修改申请' : '申请修改结算信息'}
        </button>
      </header>

      <div class="grid gap-2 px-4 py-3 md:grid-cols-2">
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <p class="text-[10px] text-muted-foreground">开户名</p>
          <p class="mt-0.5 text-xs font-medium">${escapeHtml(effective.accountHolderName)}</p>
        </div>
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <p class="text-[10px] text-muted-foreground">证件号</p>
          <p class="mt-0.5 text-xs font-medium">${escapeHtml(effective.idNumber)}</p>
        </div>
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <p class="text-[10px] text-muted-foreground">银行名称</p>
          <p class="mt-0.5 text-xs font-medium">${escapeHtml(effective.bankName)}</p>
        </div>
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <p class="text-[10px] text-muted-foreground">银行账号</p>
          <p class="mt-0.5 text-xs font-medium">${escapeHtml(maskBankAccountNo(effective.bankAccountNo))}</p>
        </div>
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <p class="text-[10px] text-muted-foreground">开户支行</p>
          <p class="mt-0.5 text-xs font-medium">${escapeHtml(effective.bankBranch || '—')}</p>
        </div>
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <p class="text-[10px] text-muted-foreground">当前版本号</p>
          <p class="mt-0.5 text-xs font-medium">${escapeHtml(effective.versionNo)}</p>
        </div>
        <div class="rounded-md border bg-muted/20 px-3 py-2">
          <p class="text-[10px] text-muted-foreground">最近生效时间</p>
          <p class="mt-0.5 text-xs font-medium">${escapeHtml(effective.effectiveAt)}</p>
        </div>
      </div>

      ${
        currentRequest
          ? `
            <div class="border-t px-4 py-3">
              <div class="mb-1.5 flex items-center gap-2">
                <span class="text-xs font-medium">当前申请</span>
                <span class="inline-flex rounded border px-2 py-0.5 text-[10px] ${getSettlementStatusClass(currentRequest.status)}">
                  ${escapeHtml(getSettlementStatusLabel(currentRequest.status))}
                </span>
              </div>
              <div class="space-y-1 text-[11px] text-muted-foreground">
                <p>申请号：${escapeHtml(currentRequest.requestId)} · 申请时间：${escapeHtml(currentRequest.submittedAt)}</p>
                <p>当前处理阶段：${escapeHtml(getSettlementStatusLabel(currentRequest.status))}</p>
                <p>签字证明：${currentRequest.signedProofFiles.length > 0 ? `已上传 ${currentRequest.signedProofFiles.length} 份` : '未上传'}</p>
                <p>变更摘要：${escapeHtml(getChangedSettlementFields(currentRequest))}</p>
                <p>下一步：${escapeHtml(getRequestNextStepText(currentRequest))}</p>
              </div>
            </div>
          `
          : ''
      }
    </article>
  `
}

function renderSettlementRequestDrawer(): string {
  const mode = state.settlementRequestDrawerMode
  if (!mode) return ''

  const activeRequest = getSettlementActiveRequestByFactory(CURRENT_FACTORY_ID)
  const latestRequest = getSettlementLatestRequestByFactory(CURRENT_FACTORY_ID)
  const currentRequest = activeRequest ?? latestRequest

  if (mode === 'create') {
    return renderDrawer(
      '申请修改结算信息',
      `
        <div class="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">提交后进入待审核，当前生效信息不会立即变更。</div>
        ${
          state.settlementRequestErrorText
            ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(state.settlementRequestErrorText)}</div>`
            : ''
        }
        <div class="space-y-3">
          <label class="block space-y-1">
            <span class="text-xs font-medium">开户名 *</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs ${state.settlementRequestErrors.accountHolderName ? 'border-red-500' : ''}" value="${escapeHtml(state.settlementRequestForm.accountHolderName)}" data-pda-sett-field="request.accountHolderName" />
            ${
              state.settlementRequestErrors.accountHolderName
                ? `<p class="text-[10px] text-red-600">${escapeHtml(state.settlementRequestErrors.accountHolderName)}</p>`
                : ''
            }
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">证件号 *</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs ${state.settlementRequestErrors.idNumber ? 'border-red-500' : ''}" value="${escapeHtml(state.settlementRequestForm.idNumber)}" data-pda-sett-field="request.idNumber" />
            ${
              state.settlementRequestErrors.idNumber
                ? `<p class="text-[10px] text-red-600">${escapeHtml(state.settlementRequestErrors.idNumber)}</p>`
                : ''
            }
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">银行名称 *</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs ${state.settlementRequestErrors.bankName ? 'border-red-500' : ''}" value="${escapeHtml(state.settlementRequestForm.bankName)}" data-pda-sett-field="request.bankName" />
            ${
              state.settlementRequestErrors.bankName
                ? `<p class="text-[10px] text-red-600">${escapeHtml(state.settlementRequestErrors.bankName)}</p>`
                : ''
            }
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">银行账号 *</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs ${state.settlementRequestErrors.bankAccountNo ? 'border-red-500' : ''}" value="${escapeHtml(state.settlementRequestForm.bankAccountNo)}" data-pda-sett-field="request.bankAccountNo" />
            ${
              state.settlementRequestErrors.bankAccountNo
                ? `<p class="text-[10px] text-red-600">${escapeHtml(state.settlementRequestErrors.bankAccountNo)}</p>`
                : ''
            }
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">开户支行</span>
            <input class="h-9 w-full rounded-md border px-3 text-xs" value="${escapeHtml(state.settlementRequestForm.bankBranch)}" data-pda-sett-field="request.bankBranch" />
          </label>
          <label class="block space-y-1">
            <span class="text-xs font-medium">申请说明</span>
            <textarea class="min-h-[72px] w-full rounded-md border px-3 py-2 text-xs" placeholder="可填写变更原因" data-pda-sett-field="request.submitRemark">${escapeHtml(
              state.settlementRequestForm.submitRemark,
            )}</textarea>
          </label>
        </div>
        <button class="mt-2 inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground" data-pda-sett-action="submit-settlement-change-request">提交申请</button>
      `,
      'close-settlement-request-drawer',
    )
  }

  if (!currentRequest) {
    return renderDrawer(
      '查看修改申请',
      `<div class="rounded-md border bg-muted/30 px-3 py-3 text-xs text-muted-foreground">当前暂无申请记录</div>`,
      'close-settlement-request-drawer',
    )
  }

  return renderDrawer(
    '查看修改申请',
    `
      <div class="rounded-md border bg-muted/20 px-3 py-2">
        <div class="flex items-center justify-between">
          <p class="text-xs font-medium">${escapeHtml(currentRequest.requestId)}</p>
          <span class="inline-flex rounded border px-2 py-0.5 text-[10px] ${getSettlementStatusClass(currentRequest.status)}">
            ${escapeHtml(getSettlementStatusLabel(currentRequest.status))}
          </span>
        </div>
        <p class="mt-1 text-[10px] text-muted-foreground">申请时间：${escapeHtml(currentRequest.submittedAt)} · 提交人：${escapeHtml(currentRequest.submittedBy)}</p>
        <p class="mt-1 text-[10px] text-muted-foreground">当前版本：${escapeHtml(currentRequest.currentVersionNo)} · 目标版本：${escapeHtml(currentRequest.targetVersionNo)}</p>
        <p class="mt-1 text-[10px] text-muted-foreground">签字证明：${currentRequest.signedProofFiles.length > 0 ? `已上传 ${currentRequest.signedProofFiles.length} 份` : '未上传'}</p>
        <p class="mt-1 text-[10px] text-muted-foreground">变更摘要：${escapeHtml(getChangedSettlementFields(currentRequest))}</p>
        <p class="mt-1 text-[10px] text-muted-foreground">下一步：${escapeHtml(getRequestNextStepText(currentRequest))}</p>
      </div>

      <div class="rounded-md border p-3">
        <p class="mb-2 text-xs font-medium">变更前后</p>
        <div class="grid gap-2 md:grid-cols-2">
          <div class="space-y-1 rounded-md border bg-muted/20 p-2">
            <p class="text-[10px] text-muted-foreground">变更前（生效）</p>
            <p class="text-xs">开户名：${escapeHtml(currentRequest.before.accountHolderName)}</p>
            <p class="text-xs">证件号：${escapeHtml(currentRequest.before.idNumber)}</p>
            <p class="text-xs">银行：${escapeHtml(currentRequest.before.bankName)}</p>
            <p class="text-xs">账号：${escapeHtml(maskBankAccountNo(currentRequest.before.bankAccountNo))}</p>
            <p class="text-xs">支行：${escapeHtml(currentRequest.before.bankBranch || '—')}</p>
          </div>
          <div class="space-y-1 rounded-md border bg-muted/20 p-2">
            <p class="text-[10px] text-muted-foreground">申请修改后</p>
            <p class="text-xs">开户名：${escapeHtml(currentRequest.after.accountHolderName)}</p>
            <p class="text-xs">证件号：${escapeHtml(currentRequest.after.idNumber)}</p>
            <p class="text-xs">银行：${escapeHtml(currentRequest.after.bankName)}</p>
            <p class="text-xs">账号：${escapeHtml(maskBankAccountNo(currentRequest.after.bankAccountNo))}</p>
            <p class="text-xs">支行：${escapeHtml(currentRequest.after.bankBranch || '—')}</p>
          </div>
        </div>
      </div>

      <div class="rounded-md border p-3">
        <p class="mb-2 text-xs font-medium">申请进度</p>
        <div class="space-y-2">
          ${currentRequest.logs
            .map(
              (item) => `
                <div class="rounded-md border bg-muted/20 px-2.5 py-2">
                  <div class="flex items-center justify-between text-[10px]">
                    <span class="font-medium">${escapeHtml(item.action)}</span>
                    <span class="text-muted-foreground">${escapeHtml(item.createdAt)}</span>
                  </div>
                  <p class="mt-1 text-[10px] text-muted-foreground">操作人：${escapeHtml(item.actor)}</p>
                  <p class="text-[10px] text-muted-foreground">${escapeHtml(item.remark)}</p>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>
    `,
    'close-settlement-request-drawer',
  )
}

function renderOverviewContent(cwPaidRate: number): string {
  return `
    <div class="space-y-4 p-4">
      <div class="overflow-hidden rounded-xl border-2 border-primary bg-primary/5">
        <div class="flex items-center justify-between px-4 pb-1 pt-3">
          <div>
            <h2 class="text-base font-bold">本周能拿多少钱</h2>
            <p class="mt-0.5 text-[10px] text-muted-foreground">${escapeHtml(`${CW.cycleId} · ${CW.periodStart} ~ ${CW.periodEnd}`)}</p>
          </div>
          ${renderStatusBadge(CW.status, cycleVariant(CW.status))}
        </div>

        <div class="border-y border-primary/20 bg-primary/10 px-4 py-3">
          <div class="text-[10px] text-muted-foreground">本周预计到账（应结金额）</div>
          <div class="mt-0.5 text-2xl font-bold tabular-nums text-primary">${escapeHtml(fmtIDR(CW_SHOULD))}</div>
          <button class="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground" data-pda-sett-action="toggle-info">
            <i data-lucide="info" class="h-3 w-3"></i>
            本周预计到账 = 毛收入 ${escapeHtml(fmtIDR(CW_GROSS))} − 扣款 ${escapeHtml(fmtIDR(CW_DEDUCT))}
            <i data-lucide="${state.showInfo ? 'chevron-up' : 'chevron-down'}" class="h-3 w-3"></i>
          </button>
          ${
            state.showInfo
              ? `
                <div class="mt-1.5 rounded-md bg-background/60 px-2.5 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
                  <p>· 本周毛收入：${escapeHtml(fmtIDR(CW_GROSS))}（${CW.taskCount} 个任务，完成 ${escapeHtml(fmtQty(CW.completedQty))}）</p>
                  <p>· 本周扣款：${escapeHtml(fmtIDR(CW_DEDUCT))}（${CW_DEDUCT_COUNT} 笔，已计入 ${CW_DEDUCT_INCLUDED.length} 笔，待计入 ${CW_DEDUCT_PENDING.length} 笔）</p>
                  <p>· 本周未到账 = 应结金额 − 已付款金额</p>
                </div>
              `
              : ''
          }
        </div>

        <div class="grid grid-cols-3 divide-x">
          <div class="px-3 py-2.5 text-center">
            <div class="text-[10px] text-muted-foreground">本周已到账</div>
            <div class="mt-0.5 text-sm font-bold tabular-nums text-green-600">${escapeHtml(fmtIDR(CW_PAID))}</div>
          </div>
          <button class="px-3 py-2.5 text-center" data-pda-sett-action="open-current-week-cycle">
            <div class="text-[10px] text-muted-foreground">本周未到账</div>
            <div class="mt-0.5 text-sm font-bold tabular-nums text-red-600">${escapeHtml(fmtIDR(CW_UNPAID))}</div>
          </button>
          <button class="px-3 py-2.5 text-center" data-pda-sett-action="open-week-deductions">
            <div class="text-[10px] text-muted-foreground">本周扣款</div>
            <div class="mt-0.5 text-sm font-bold tabular-nums text-red-600">${escapeHtml(fmtIDR(CW_DEDUCT))}</div>
          </button>
        </div>

        <div class="px-4 pb-3 pt-2">
          <div class="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>付款进度</span>
            <span>${escapeHtml(`${fmtIDR(CW_PAID)} / ${fmtIDR(CW_SHOULD)} · ${cwPaidRate}%`)}</span>
          </div>
          ${renderProgress(cwPaidRate, 'h-2')}
        </div>

        ${
          CW_UNPAID > 0
            ? `
              <button
                class="flex w-full items-center gap-2 border-t border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700"
                data-pda-sett-action="open-current-week-cycle"
              >
                <i data-lucide="alert-triangle" class="h-3.5 w-3.5 shrink-0"></i>
                本周仍有 ${escapeHtml(fmtIDR(CW_UNPAID))} 未到账 · 去看周期
                <i data-lucide="chevron-right" class="ml-auto h-3.5 w-3.5"></i>
              </button>
            `
            : ''
        }
      </div>

      ${renderSettlementInfoSection()}

      <div>
        <h3 class="mb-2 text-xs font-semibold text-muted-foreground">本周钱从哪里来</h3>
        <div class="grid grid-cols-2 gap-2.5">
          ${[
            { label: '本周覆盖任务', value: `${CW.taskCount} 个`, sub: `${CW.periodStart} ~ ${CW.periodEnd}` },
            { label: '本周完成数量', value: fmtQty(CW.completedQty), sub: `合格 ${fmtQty(CW.qualifiedQty)}` },
            { label: '本周毛收入', value: fmtIDR(CW_GROSS), sub: `含 ${CW_DEDUCT_COUNT} 笔扣款` },
            { label: '本周净额', value: fmtIDR(CW_SHOULD), sub: '扣款后应结' },
          ]
            .map(
              (item) => `
                <button class="rounded-lg border bg-background px-3 py-2.5 text-left shadow-none transition-colors hover:bg-muted/40" data-pda-sett-action="open-week-tasks">
                  <div class="text-[10px] text-muted-foreground">${escapeHtml(item.label)}</div>
                  <div class="mt-0.5 text-sm font-bold tabular-nums">${escapeHtml(item.value)}</div>
                  <div class="mt-0.5 text-[10px] text-muted-foreground">${escapeHtml(item.sub)}</div>
                </button>
              `,
            )
            .join('')}
        </div>
      </div>

      <div>
        <h3 class="mb-2 text-xs font-semibold text-muted-foreground">本周重点提醒</h3>
        <div class="space-y-2">
          ${
            CW_UNPAID > 0
              ? `
                <button
                  class="flex w-full items-center gap-2.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-left"
                  data-pda-sett-action="open-current-week-cycle"
                >
                  <i data-lucide="clock" class="h-4 w-4 shrink-0 text-orange-500"></i>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-medium text-orange-800">本周还有 ${escapeHtml(fmtIDR(CW_UNPAID))} 未付</div>
                    <div class="mt-0.5 text-[10px] text-orange-600">${escapeHtml(CW.nextPaymentNote || '')}</div>
                  </div>
                  <i data-lucide="chevron-right" class="h-4 w-4 shrink-0 text-orange-400"></i>
                </button>
              `
              : ''
          }

          ${
            CW_DEDUCT_COUNT > 0
              ? `
                <button
                  class="flex w-full items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-left"
                  data-pda-sett-action="open-week-deductions"
                >
                  <i data-lucide="alert-triangle" class="h-4 w-4 shrink-0 text-red-500"></i>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-medium text-red-800">本周 ${CW_DEDUCT_COUNT} 笔扣款共 ${escapeHtml(fmtIDR(CW_DEDUCT))}</div>
                    <div class="mt-0.5 text-[10px] text-red-600">主要原因：${escapeHtml(
                      Array.from(new Set(CW_DEDUCTIONS.map((d) => d.reason))).join('、'),
                    )}</div>
                  </div>
                  <i data-lucide="chevron-right" class="h-4 w-4 shrink-0 text-red-400"></i>
                </button>
              `
              : ''
          }

          ${
            CW_DEDUCT_PENDING.length > 0
              ? `
                <button
                  class="flex w-full items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-left"
                  data-pda-sett-action="open-week-deductions"
                >
                  <i data-lucide="info" class="h-4 w-4 shrink-0 text-amber-500"></i>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-medium text-amber-800">${CW_DEDUCT_PENDING.length} 笔扣款（${escapeHtml(
                      fmtIDR(CW_DEDUCT_PENDING.reduce((s, d) => s + d.amount, 0)),
                    )}）待计入本周结算</div>
                    <div class="mt-0.5 text-[10px] text-amber-600">确认后将影响本周应结金额，查看本周扣款</div>
                  </div>
                  <i data-lucide="chevron-right" class="h-4 w-4 shrink-0 text-amber-400"></i>
                </button>
              `
              : ''
          }

          ${SETTLEMENT_CYCLES.filter((c) => !c.isCurrentWeek && c.status === '部分付款')
            .map(
              (c) => `
                <button
                  class="flex w-full items-center gap-2.5 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-left"
                  data-pda-sett-action="open-cycle-by-id"
                  data-cycle-id="${escapeHtml(c.cycleId)}"
                >
                  <i data-lucide="banknote" class="h-4 w-4 shrink-0 text-amber-500"></i>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-medium text-amber-800">周期 ${escapeHtml(c.cycleId)} 已部分付款</div>
                    <div class="mt-0.5 text-[10px] text-amber-600">还差 ${escapeHtml(fmtIDR(c.unpaidAmount))} · 查看付款明细</div>
                  </div>
                  <i data-lucide="chevron-right" class="h-4 w-4 shrink-0 text-amber-400"></i>
                </button>
              `,
            )
            .join('')}
        </div>
      </div>

      <div>
        <button class="flex items-center gap-1.5 py-1 text-xs text-muted-foreground" data-pda-sett-action="toggle-history">
          <i data-lucide="${state.showHistory ? 'chevron-up' : 'chevron-down'}" class="h-3.5 w-3.5"></i>
          累计经营信息
        </button>
        ${
          state.showHistory
            ? `
              <article class="mt-2 rounded-lg border bg-card shadow-none">
                <div class="space-y-1.5 px-4 py-3">
                  ${renderRow('累计毛收入', fmtIDR(ALL_GROSS))}
                  ${renderRow('累计扣款', fmtIDR(ALL_DEDUCT))}
                  ${renderRow('累计应结', fmtIDR(ALL_SHOULD), { bold: true })}
                  ${renderRow('累计已付', fmtIDR(ALL_PAID), { green: true })}
                  ${renderRow('累计未付', ALL_UNPAID > 0 ? fmtIDR(ALL_UNPAID) : '已付清', { red: ALL_UNPAID > 0 })}
                  ${renderRow('历史周期数', `${SETTLEMENT_CYCLES.length} 个`)}
                </div>
              </article>
            `
            : ''
        }
      </div>
    </div>
  `
}

function renderTasksContent(visibleTasks: TaskIncome[]): string {
  return `
    <div class="space-y-3 p-4">
      <div class="flex items-center gap-2">
        <div class="shrink-0 overflow-hidden rounded-lg border bg-background">
          <button class="px-3 py-1.5 text-xs font-medium ${state.taskView === 'week' ? 'bg-primary text-white' : 'text-muted-foreground'}" data-pda-sett-action="set-task-view" data-value="week">本周</button>
          <button class="px-3 py-1.5 text-xs font-medium ${state.taskView === 'all' ? 'bg-primary text-white' : 'text-muted-foreground'}" data-pda-sett-action="set-task-view" data-value="all">全部</button>
        </div>
        <div class="relative flex-1">
          <i data-lucide="search" class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"></i>
          <input
            class="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-xs"
            placeholder="搜索任务/款式/工序"
            value="${escapeHtml(state.taskSearch)}"
            data-pda-sett-field="task-search"
          />
        </div>
      </div>

      ${
        state.taskView === 'week'
          ? `
            <div class="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <span>本周 ${CW.taskCount} 个任务</span>
              <span>·</span>
              <span>净额 ${escapeHtml(fmtIDR(CW_SHOULD))}</span>
              <span>·</span>
              <span class="${CW_UNPAID > 0 ? 'font-medium text-red-600' : 'text-green-600'}">${escapeHtml(
                CW_UNPAID > 0 ? `未付 ${fmtIDR(CW_UNPAID)}` : '已付清',
              )}</span>
            </div>
          `
          : ''
      }

      ${
        visibleTasks.length === 0
          ? '<div class="py-10 text-center text-xs text-muted-foreground">暂无符合条件的任务</div>'
          : visibleTasks
              .map(
                (task) => `
                  <button class="w-full text-left" data-pda-sett-action="open-task-drawer" data-task-id="${escapeHtml(task.taskId)}">
                    <article class="rounded-lg border bg-card shadow-none transition-colors hover:bg-muted/30">
                      <div class="px-4 py-3">
                        <div class="mb-1.5 flex items-center justify-between">
                          <div class="flex min-w-0 items-center gap-2">
                            <span class="truncate text-xs font-semibold">${escapeHtml(task.taskId)}</span>
                            ${task.isCurrentWeek ? renderStatusBadge('本周', 'blue') : ''}
                          </div>
                          <div class="flex shrink-0 items-center gap-1.5">
                            ${renderStatusBadge(task.paymentStatus, paymentVariant(task.paymentStatus))}
                            <i data-lucide="chevron-right" class="h-3.5 w-3.5 text-muted-foreground"></i>
                          </div>
                        </div>
                        <div class="mb-2 text-[10px] text-muted-foreground">${escapeHtml(`${task.spuName} · ${task.process} · ${task.cycleId}`)}</div>
                        <div class="grid grid-cols-3 gap-x-2 text-xs">
                          <div>
                            <div class="text-[10px] text-muted-foreground">应结金额</div>
                            <div class="font-semibold tabular-nums">${escapeHtml(fmtIDR(task.shouldPayAmount))}</div>
                          </div>
                          <div>
                            <div class="text-[10px] text-muted-foreground">扣款</div>
                            <div class="font-semibold tabular-nums ${task.deductionAmount > 0 ? 'text-red-600' : 'text-muted-foreground'}">${escapeHtml(
                              task.deductionAmount > 0 ? fmtIDR(task.deductionAmount) : '—',
                            )}</div>
                          </div>
                          <div>
                            <div class="text-[10px] text-muted-foreground">未付</div>
                            <div class="font-semibold tabular-nums ${task.unpaidAmount > 0 ? 'text-red-600' : 'text-green-600'}">${escapeHtml(
                              task.unpaidAmount > 0 ? fmtIDR(task.unpaidAmount) : '已付清',
                            )}</div>
                          </div>
                        </div>
                        <div class="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                          <span>完成 ${escapeHtml(fmtQty(task.completedQty, task.qtyUnit))}</span>
                          <span>单价 ${escapeHtml(fmtRate(task.unitPrice, task.qtyUnit))}</span>
                          ${task.lastPaymentDate ? `<span>最近付款 ${escapeHtml(task.lastPaymentDate)}</span>` : ''}
                        </div>
                      </div>
                    </article>
                  </button>
                `,
              )
              .join('')
      }
    </div>
  `
}

function renderDeductionsContent(visibleDeds: DeductionRecord[]): string {
  const reasons = Array.from(new Set(CW_DEDUCTIONS.map((d) => d.reason))).join('、')

  return `
    <div class="space-y-3 p-4">
      <div class="flex items-center gap-2">
        <div class="shrink-0 overflow-hidden rounded-lg border bg-background">
          <button class="px-3 py-1.5 text-xs font-medium ${state.dedView === 'week' ? 'bg-primary text-white' : 'text-muted-foreground'}" data-pda-sett-action="set-ded-view" data-value="week">本周</button>
          <button class="px-3 py-1.5 text-xs font-medium ${state.dedView === 'all' ? 'bg-primary text-white' : 'text-muted-foreground'}" data-pda-sett-action="set-ded-view" data-value="all">全部</button>
        </div>
        <div class="relative flex-1">
          <i data-lucide="search" class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"></i>
          <input
            class="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-xs"
            placeholder="搜索扣款单/款式/原因"
            value="${escapeHtml(state.dedSearch)}"
            data-pda-sett-field="ded-search"
          />
        </div>
      </div>

      ${
        state.dedView === 'week'
          ? `
            <div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <div class="text-xs font-medium text-red-800">本周扣款 ${CW_DEDUCT_COUNT} 笔，共 ${escapeHtml(fmtIDR(CW_DEDUCT))}</div>
              <div class="mt-0.5 text-[10px] text-red-600">主要原因：${escapeHtml(reasons)} ·已计入 ${CW_DEDUCT_INCLUDED.length} 笔，待计入 ${CW_DEDUCT_PENDING.length} 笔</div>
            </div>
          `
          : ''
      }

      ${
        visibleDeds.length === 0
          ? '<div class="py-10 text-center text-xs text-muted-foreground">暂无符合条件的扣款记录</div>'
          : visibleDeds
              .map(
                (ded) => `
                  <button class="w-full text-left" data-pda-sett-action="open-ded-drawer" data-ded-id="${escapeHtml(ded.deductionId)}">
                    <article class="rounded-lg border bg-card shadow-none transition-colors hover:bg-muted/30">
                      <div class="px-4 py-3">
                        <div class="mb-1.5 flex items-start justify-between">
                          <div class="flex min-w-0 items-center gap-2">
                            <span class="text-xs font-semibold">${escapeHtml(ded.deductionId)}</span>
                            ${ded.isCurrentWeek ? renderStatusBadge('本周', 'blue') : ''}
                          </div>
                          <div class="flex shrink-0 items-center gap-1.5">
                            ${renderStatusBadge(ded.settlementStatus, deductVariant(ded.settlementStatus))}
                            <i data-lucide="chevron-right" class="h-3.5 w-3.5 text-muted-foreground"></i>
                          </div>
                        </div>
                        <div class="mb-1.5 flex items-center gap-3">
                          <div>
                            <div class="text-[10px] text-muted-foreground">扣款金额</div>
                            <div class="text-sm font-bold tabular-nums text-red-600">${escapeHtml(fmtIDR(ded.amount))}</div>
                          </div>
                          <div class="min-w-0 flex-1">
                            <div class="text-[10px] text-muted-foreground">扣款原因</div>
                            <div class="text-xs font-medium">${escapeHtml(ded.reason)}</div>
                          </div>
                        </div>
                        <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          <span>关联任务：${escapeHtml(ded.taskId)}</span>
                          <span>${escapeHtml(`${ded.spuName} · ${ded.process}`)}</span>
                          ${ded.cycleId ? `<span>周期：${escapeHtml(ded.cycleId)}</span>` : ''}
                        </div>
                        <p class="mt-1.5 line-clamp-1 text-[10px] text-muted-foreground">${escapeHtml(ded.problemSummary)}</p>
                      </div>
                    </article>
                  </button>
                `,
              )
              .join('')
      }
    </div>
  `
}

function renderCyclesContent(visibleCycles: SettlementCycle[]): string {
  return `
    <div class="space-y-3 p-4">
      ${visibleCycles
        .map((cycle) => {
          const paidRate = cycle.shouldPayAmount > 0 ? Math.round((cycle.paidAmount / cycle.shouldPayAmount) * 100) : 100
          return `
            <button class="w-full text-left" data-pda-sett-action="open-cycle-drawer" data-cycle-id="${escapeHtml(cycle.cycleId)}">
              <article class="rounded-lg border bg-card shadow-none transition-colors hover:bg-muted/30 ${cycle.isCurrentWeek ? 'border-2 border-primary' : ''}">
                <div class="px-4 py-3">
                  <div class="mb-2 flex items-center justify-between">
                    <div class="flex min-w-0 items-center gap-2">
                      <span class="truncate text-xs font-semibold">${escapeHtml(cycle.cycleId)}</span>
                      ${cycle.isCurrentWeek ? renderStatusBadge('本周期', 'blue') : ''}
                    </div>
                    <div class="flex shrink-0 items-center gap-1.5">
                      ${renderStatusBadge(cycle.status, cycleVariant(cycle.status))}
                      <i data-lucide="chevron-right" class="h-3.5 w-3.5 text-muted-foreground"></i>
                    </div>
                  </div>

                  <div class="mb-2 grid grid-cols-3 gap-x-2 text-xs">
                    <div>
                      <div class="text-[10px] text-muted-foreground">应结</div>
                      <div class="font-semibold tabular-nums">${escapeHtml(fmtIDR(cycle.shouldPayAmount))}</div>
                    </div>
                    <div>
                      <div class="text-[10px] text-muted-foreground">已付</div>
                      <div class="font-semibold tabular-nums ${cycle.paidAmount > 0 ? 'text-green-600' : 'text-muted-foreground'}">${escapeHtml(
                        cycle.paidAmount > 0 ? fmtIDR(cycle.paidAmount) : '—',
                      )}</div>
                    </div>
                    <div>
                      <div class="text-[10px] text-muted-foreground">未付</div>
                      <div class="font-semibold tabular-nums ${cycle.unpaidAmount > 0 ? 'text-red-600' : 'text-green-600'}">${escapeHtml(
                        cycle.unpaidAmount > 0 ? fmtIDR(cycle.unpaidAmount) : '已付清',
                      )}</div>
                    </div>
                  </div>

                  ${renderProgress(paidRate, 'h-1.5')}

                  <div class="mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
                    <span>${escapeHtml(`${cycle.periodStart} ~ ${cycle.periodEnd}`)}</span>
                    <span>${cycle.taskCount} 个任务</span>
                    ${cycle.lastPaymentDate ? `<span>最近付款 ${escapeHtml(cycle.lastPaymentDate)}</span>` : ''}
                    <span>${paidRate}% 已付</span>
                  </div>

                  ${
                    cycle.unpaidAmount > 0 && cycle.isCurrentWeek
                      ? `<div class="mt-1.5 text-[10px] font-medium text-red-600">还差 ${escapeHtml(fmtIDR(cycle.unpaidAmount))} 未付</div>`
                      : ''
                  }
                </div>
              </article>
            </button>
          `
        })
        .join('')}
    </div>
  `
}

function renderPageContent(): string {
  const visibleTasks = TASK_INCOMES
    .filter((t) => (state.taskView === 'week' ? t.isCurrentWeek : true))
    .filter(
      (t) =>
        !state.taskSearch ||
        t.taskId.includes(state.taskSearch) ||
        t.spuName.includes(state.taskSearch) ||
        t.process.includes(state.taskSearch),
    )
    .slice()
    .sort((a, b) => {
      const rank = (t: TaskIncome) => (t.paymentStatus === '待付款' ? 0 : t.paymentStatus === '部分付款' ? 1 : 2)
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      if (a.deductionAmount !== b.deductionAmount) return b.deductionAmount - a.deductionAmount
      return b.shouldPayAmount - a.shouldPayAmount
    })

  const visibleDeds = DEDUCTION_RECORDS.filter((d) => (state.dedView === 'week' ? d.isCurrentWeek : true))
    .filter(
      (d) =>
        !state.dedSearch ||
        d.deductionId.includes(state.dedSearch) ||
        d.spuName.includes(state.dedSearch) ||
        d.reason.includes(state.dedSearch),
    )
    .slice()
    .sort((a, b) => b.amount - a.amount)

  const visibleCycles = SETTLEMENT_CYCLES.slice().sort((a, b) => {
    if (a.isCurrentWeek) return -1
    if (b.isCurrentWeek) return 1
    return 0
  })

  const cwPaidRate = CW_SHOULD > 0 ? Math.round((CW_PAID / CW_SHOULD) * 100) : 0

  return `
    <div class="flex min-h-[760px] flex-col bg-muted/30">
      <div class="shrink-0 border-b bg-background px-4 pb-2 pt-4">
        <h1 class="text-base font-bold">结算</h1>
        <p class="mt-0.5 text-xs text-muted-foreground">本周期：${escapeHtml(`${CW.cycleId} · ${CW.periodStart} ~ ${CW.periodEnd}`)}</p>
      </div>

      <div class="shrink-0 border-b bg-background">
        ${([
          ['overview', '收入概览'],
          ['tasks', '任务收入'],
          ['deductions', '扣款明细'],
          ['cycles', '结算周期'],
        ] as Array<[MainTab, string]>)
          .map(
            ([key, label]) => `
              <button
                class="w-1/4 border-b-2 py-2.5 text-xs font-medium transition-colors ${
                  state.activeTab === key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
                }"
                data-pda-sett-action="switch-tab"
                data-tab="${key}"
              >${escapeHtml(label)}</button>
            `,
          )
          .join('')}
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        ${
          state.activeTab === 'overview'
            ? renderOverviewContent(cwPaidRate)
            : state.activeTab === 'tasks'
              ? renderTasksContent(visibleTasks)
              : state.activeTab === 'deductions'
                ? renderDeductionsContent(visibleDeds)
                : renderCyclesContent(visibleCycles)
        }
      </div>

      ${(() => {
        const task = getTaskById(state.taskDrawerTaskId)
        if (!task) return ''
        return renderTaskDrawer(task)
      })()}

      ${(() => {
        const ded = getDedById(state.dedDrawerId)
        if (!ded) return ''
        return renderDeductionDrawer(ded)
      })()}

      ${(() => {
        const cycle = getCycleById(state.cycleDrawerId)
        if (!cycle) return ''
        return renderCycleDrawer(cycle)
      })()}

      ${renderSettlementRequestDrawer()}
    </div>
  `
}

function validateSettlementRequestForm(): Partial<
  Record<'accountHolderName' | 'idNumber' | 'bankName' | 'bankAccountNo', string>
> {
  const errors: Partial<Record<'accountHolderName' | 'idNumber' | 'bankName' | 'bankAccountNo', string>> = {}
  if (!state.settlementRequestForm.accountHolderName.trim()) errors.accountHolderName = '请填写开户名'
  if (!state.settlementRequestForm.idNumber.trim()) errors.idNumber = '请填写证件号'
  if (!state.settlementRequestForm.bankName.trim()) errors.bankName = '请填写银行名称'
  if (!state.settlementRequestForm.bankAccountNo.trim()) {
    errors.bankAccountNo = '请填写银行账号'
  } else if (!/^[0-9]{8,30}$/.test(state.settlementRequestForm.bankAccountNo.trim())) {
    errors.bankAccountNo = '银行账号格式不正确'
  }
  return errors
}

export function renderPdaSettlementPage(): string {
  return renderPdaFrame(renderPageContent(), 'settlement')
}

export function handlePdaSettlementEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-sett-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.pdaSettField
    if (field === 'task-search') {
      state.taskSearch = fieldNode.value
      return true
    }
    if (field === 'ded-search') {
      state.dedSearch = fieldNode.value
      return true
    }
    if (field === 'request.accountHolderName') {
      state.settlementRequestForm.accountHolderName = fieldNode.value
      state.settlementRequestErrors.accountHolderName = undefined
      return true
    }
    if (field === 'request.idNumber') {
      state.settlementRequestForm.idNumber = fieldNode.value
      state.settlementRequestErrors.idNumber = undefined
      return true
    }
    if (field === 'request.bankName') {
      state.settlementRequestForm.bankName = fieldNode.value
      state.settlementRequestErrors.bankName = undefined
      return true
    }
    if (field === 'request.bankAccountNo') {
      state.settlementRequestForm.bankAccountNo = fieldNode.value
      state.settlementRequestErrors.bankAccountNo = undefined
      return true
    }
    if (field === 'request.bankBranch') {
      state.settlementRequestForm.bankBranch = fieldNode.value
      return true
    }
    if (field === 'request.submitRemark') {
      state.settlementRequestForm.submitRemark = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-sett-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaSettAction
  if (!action) return false

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as MainTab | undefined
    if (tab === 'overview' || tab === 'tasks' || tab === 'deductions' || tab === 'cycles') {
      state.activeTab = tab
    }
    return true
  }

  if (action === 'set-task-view') {
    const value = actionNode.dataset.value
    state.taskView = value === 'all' ? 'all' : 'week'
    return true
  }

  if (action === 'set-ded-view') {
    const value = actionNode.dataset.value
    state.dedView = value === 'all' ? 'all' : 'week'
    return true
  }

  if (action === 'toggle-info') {
    state.showInfo = !state.showInfo
    return true
  }

  if (action === 'toggle-history') {
    state.showHistory = !state.showHistory
    return true
  }

  if (action === 'open-week-tasks') {
    state.activeTab = 'tasks'
    state.taskView = 'week'
    return true
  }

  if (action === 'open-week-deductions') {
    state.activeTab = 'deductions'
    state.dedView = 'week'
    return true
  }

  if (action === 'open-current-week-cycle') {
    state.activeTab = 'cycles'
    state.cycleDrawerId = CW.cycleId
    state.taskDrawerTaskId = null
    state.dedDrawerId = null
    return true
  }

  if (action === 'open-task-drawer') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      state.taskDrawerTaskId = taskId
      state.dedDrawerId = null
      state.cycleDrawerId = null
    }
    return true
  }

  if (action === 'open-ded-drawer') {
    const dedId = actionNode.dataset.dedId
    if (dedId) {
      state.dedDrawerId = dedId
      state.taskDrawerTaskId = null
      state.cycleDrawerId = null
    }
    return true
  }

  if (action === 'open-cycle-drawer' || action === 'open-cycle-by-id') {
    const cycleId = actionNode.dataset.cycleId
    if (cycleId) {
      state.cycleDrawerId = cycleId
      state.taskDrawerTaskId = null
      state.dedDrawerId = null
      state.activeTab = 'cycles'
    }
    return true
  }

  if (action === 'close-task-drawer') {
    state.taskDrawerTaskId = null
    return true
  }

  if (action === 'close-ded-drawer') {
    state.dedDrawerId = null
    return true
  }

  if (action === 'close-cycle-drawer') {
    state.cycleDrawerId = null
    return true
  }

  if (action === 'goto-cycle-from-task') {
    const cycleId = actionNode.dataset.cycleId
    if (cycleId) {
      state.activeTab = 'cycles'
      state.taskDrawerTaskId = null
      state.dedDrawerId = null
      state.cycleDrawerId = cycleId
    }
    return true
  }

  if (action === 'goto-task-from-ded' || action === 'goto-task-from-cycle') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      state.activeTab = 'tasks'
      state.cycleDrawerId = null
      state.dedDrawerId = null
      state.taskDrawerTaskId = taskId
    }
    return true
  }

  if (action === 'open-settlement-change-request') {
    const effective = getSettlementEffectiveInfoByFactory(CURRENT_FACTORY_ID)
    if (!effective) {
      state.settlementRequestDrawerMode = null
      state.settlementRequestErrorText = '当前工厂尚未初始化结算信息'
      return true
    }

    const activeRequest = getSettlementActiveRequestByFactory(CURRENT_FACTORY_ID)
    if (activeRequest) {
      state.settlementRequestDrawerMode = 'detail'
      state.settlementRequestErrorText = '当前已有结算信息修改申请处理中'
      return true
    }

    resetSettlementRequestForm()
    state.settlementRequestDrawerMode = 'create'
    return true
  }

  if (action === 'open-settlement-request-detail') {
    const effective = getSettlementEffectiveInfoByFactory(CURRENT_FACTORY_ID)
    if (!effective) {
      state.settlementRequestDrawerMode = null
      state.settlementRequestErrorText = '当前工厂尚未初始化结算信息'
      return true
    }
    state.settlementRequestDrawerMode = 'detail'
    state.settlementRequestErrorText = ''
    return true
  }

  if (action === 'close-settlement-request-drawer') {
    state.settlementRequestDrawerMode = null
    state.settlementRequestErrorText = ''
    state.settlementRequestErrors = {}
    return true
  }

  if (action === 'submit-settlement-change-request') {
    const errors = validateSettlementRequestForm()
    if (Object.keys(errors).length > 0) {
      state.settlementRequestErrors = errors
      state.settlementRequestErrorText = '请先补全必填项'
      return true
    }

    const result = createSettlementChangeRequest({
      factoryId: CURRENT_FACTORY_ID,
      submittedBy: CURRENT_FACTORY_OPERATOR,
      submitRemark: state.settlementRequestForm.submitRemark,
      after: {
        accountHolderName: state.settlementRequestForm.accountHolderName.trim(),
        idNumber: state.settlementRequestForm.idNumber.trim(),
        bankName: state.settlementRequestForm.bankName.trim(),
        bankAccountNo: state.settlementRequestForm.bankAccountNo.trim(),
        bankBranch: state.settlementRequestForm.bankBranch.trim(),
      },
    })

    if (!result.ok) {
      state.settlementRequestErrorText = result.message
      return true
    }

    state.settlementRequestErrors = {}
    state.settlementRequestErrorText = result.message
    state.settlementRequestDrawerMode = 'detail'
    return true
  }

  return false
}
