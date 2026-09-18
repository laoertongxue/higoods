export type PmsTradeSubjectStatus = '启用' | '停用'

export interface PmsTradeSubject {
  subjectCode: string
  subjectName: string
  shortName: string
  countryOrRegion: string
  settlementCurrency: 'RMB' | 'USD' | 'IDR' | 'HKD'
  taxNo: string
  legalPerson: string
  bankName: string
  bankAccount: string
  contactName: string
  contactPhone: string
  status: PmsTradeSubjectStatus
  usedInPurchaseOrders: number
  remark: string
  createdAt: string
  updatedAt: string
}

const subjects: PmsTradeSubject[] = [
  { subjectCode: 'TS-001', subjectName: 'HiGOOD 香港公司', shortName: '香港主体', countryOrRegion: '中国香港', settlementCurrency: 'HKD', taxNo: 'HK-2026-889001', legalPerson: '林志远', bankName: '汇丰银行香港分行', bankAccount: '**** 8821', contactName: '林志远', contactPhone: '+852 9012 3456', status: '启用', usedInPurchaseOrders: 42, remark: '主要出口结算主体', createdAt: '2026-01-05 09:00:00', updatedAt: '2026-05-20 10:00:00' },
  { subjectCode: 'TS-002', subjectName: '深圳市海古德服饰有限公司', shortName: '深圳主体', countryOrRegion: '中国', settlementCurrency: 'RMB', taxNo: '91440300MA5XXXXXX1', legalPerson: '陈海', bankName: '招商银行深圳分行', bankAccount: '**** 3306', contactName: '陈海', contactPhone: '13800138101', status: '启用', usedInPurchaseOrders: 36, remark: '国内采购与付款主体', createdAt: '2026-01-05 09:10:00', updatedAt: '2026-05-18 14:00:00' },
  { subjectCode: 'TS-003', subjectName: 'PT. HIGOOD GARMENT INDONESIA', shortName: '印尼主体', countryOrRegion: '印度尼西亚', settlementCurrency: 'IDR', taxNo: '01.234.567.8-091.000', legalPerson: 'Andi Wijaya', bankName: 'Bank Mandiri', bankAccount: '**** 1120', contactName: 'Andi Wijaya', contactPhone: '081200010101', status: '启用', usedInPurchaseOrders: 18, remark: '本地清关与费用结算', createdAt: '2026-01-15 09:30:00', updatedAt: '2026-05-25 16:00:00' },
  { subjectCode: 'TS-004', subjectName: '广州海古德供应链管理有限公司', shortName: '广州供应链', countryOrRegion: '中国', settlementCurrency: 'RMB', taxNo: '91440101MA5XXXXXX2', legalPerson: '李广', bankName: '中国银行广州分行', bankAccount: '**** 7712', contactName: '李广', contactPhone: '13800138102', status: '启用', usedInPurchaseOrders: 11, remark: '面辅料集中采购', createdAt: '2026-02-02 10:00:00', updatedAt: '2026-05-12 11:20:00' },
  { subjectCode: 'TS-005', subjectName: '义乌市海古德进出口有限公司', shortName: '义乌主体', countryOrRegion: '中国', settlementCurrency: 'USD', taxNo: '91330782MA5XXXXXX3', legalPerson: '吴义', bankName: '义乌农商银行', bankAccount: '**** 5568', contactName: '吴义', contactPhone: '13800138103', status: '启用', usedInPurchaseOrders: 7, remark: '小商品与辅料出口', createdAt: '2026-02-20 09:40:00', updatedAt: '2026-04-28 15:10:00' },
  { subjectCode: 'TS-006', subjectName: '杭州海古德品牌管理有限公司', shortName: '杭州主体', countryOrRegion: '中国', settlementCurrency: 'RMB', taxNo: '91330101MA5XXXXXX4', legalPerson: '赵品', bankName: '杭州银行', bankAccount: '**** 2233', contactName: '赵品', contactPhone: '13800138104', status: '停用', usedInPurchaseOrders: 3, remark: '品牌业务调整，暂停使用', createdAt: '2026-03-08 11:00:00', updatedAt: '2026-05-06 09:00:00' },
  { subjectCode: 'TS-007', subjectName: 'PT. HIGOOD LOGISTIK NUSANTARA', shortName: '印尼物流主体', countryOrRegion: '印度尼西亚', settlementCurrency: 'IDR', taxNo: '02.345.678.9-092.000', legalPerson: 'Budi Santoso', bankName: 'BCA', bankAccount: '**** 9087', contactName: 'Budi Santoso', contactPhone: '081200010202', status: '启用', usedInPurchaseOrders: 9, remark: '头程与本地物流费用', createdAt: '2026-03-20 09:20:00', updatedAt: '2026-05-22 13:30:00' },
]

export function listPmsTradeSubjects(): PmsTradeSubject[] {
  return subjects
}

export function getPmsTradeSubject(subjectCode: string): PmsTradeSubject | undefined {
  return subjects.find((subject) => subject.subjectCode === subjectCode)
}
