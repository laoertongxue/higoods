export type PmsSettingStatus = '启用' | '停用'
export type PmsSettingSource = '平台内置' | 'PCS 同步' | 'WMS 同步' | '手工维护'

export interface PmsSettingUser {
  userId: string
  name: string
  account: string
  roleName: string
  department: string
  phone: string
  status: PmsSettingStatus
  lastLoginAt: string
  source: PmsSettingSource
}

export interface PmsSettingRole {
  roleCode: string
  roleName: string
  scope: string
  memberCount: number
  description: string
  source: PmsSettingSource
  updatedAt: string
}

export interface PmsSettingDictionary {
  code: string
  name: string
  category: string
  source: PmsSettingSource
  referenceCount: number
  status: PmsSettingStatus
  updatedAt: string
}

export const pmsSettingUsers: PmsSettingUser[] = [
  { userId: 'USR-PMS-WANG', name: '王采购', account: 'wang.caigou', roleName: '采购员', department: '采购部', phone: '13800138401', status: '启用', lastLoginAt: '2026-06-13 08:40', source: '平台内置' },
  { userId: 'USR-PMS-CHEN', name: '陈主管', account: 'chen.zhuguan', roleName: '采购主管', department: '采购部', phone: '13800138402', status: '启用', lastLoginAt: '2026-06-13 09:05', source: '平台内置' },
  { userId: 'USR-PMS-LIU', name: '刘财务', account: 'liu.caiwu', roleName: '财务', department: '财务部', phone: '13800138403', status: '启用', lastLoginAt: '2026-06-12 17:20', source: '平台内置' },
  { userId: 'USR-PMS-ZHAO', name: '赵敏', account: 'zhao.min', roleName: '运营对接', department: '直播运营', phone: '13800138404', status: '启用', lastLoginAt: '2026-06-12 15:10', source: '平台内置' },
  { userId: 'USR-PMS-SUN', name: '孙倩', account: 'sun.qian', roleName: '运营对接', department: '直播运营', phone: '13800138405', status: '启用', lastLoginAt: '2026-06-11 11:00', source: '平台内置' },
  { userId: 'USR-PMS-GUO', name: '郭质检', account: 'guo.zhijian', roleName: '质检', department: '品控部', phone: '13800138406', status: '启用', lastLoginAt: '2026-06-10 16:40', source: '平台内置' },
  { userId: 'USR-PMS-WU', name: '吴仓管', account: 'wu.cangguan', roleName: '仓库', department: '仓储部', phone: '13800138407', status: '启用', lastLoginAt: '2026-06-13 07:30', source: 'WMS 同步' },
  { userId: 'USR-PMS-LI', name: '李离职', account: 'li.lizhi', roleName: '采购员', department: '采购部', phone: '13800138408', status: '停用', lastLoginAt: '2026-04-28 10:00', source: '平台内置' },
]

export const pmsSettingRoles: PmsSettingRole[] = [
  { roleCode: 'ROLE-PMS-BUYER', roleName: '采购员', scope: '采购建议、采购单、面辅料采购、跟踪、供应商确认', memberCount: 2, description: '负责采购执行与单据维护，不能审核供应商与推进结算', source: '平台内置', updatedAt: '2026-05-20 10:00:00' },
  { roleCode: 'ROLE-PMS-MANAGER', roleName: '采购主管', scope: '审核、状态推进、BOM 提交、关闭采购单', memberCount: 1, description: '拥有审批与状态推进权限', source: '平台内置', updatedAt: '2026-05-20 10:00:00' },
  { roleCode: 'ROLE-PMS-FINANCE', roleName: '财务', scope: '对账、请款、付款登记', memberCount: 1, description: '负责对账差异确认与付款', source: '平台内置', updatedAt: '2026-05-20 10:00:00' },
  { roleCode: 'ROLE-PMS-OPS', roleName: '运营对接', scope: 'KOL 采购需求提交与查询', memberCount: 2, description: '直播运营需求提报', source: '平台内置', updatedAt: '2026-05-18 14:00:00' },
  { roleCode: 'ROLE-PMS-QC', roleName: '质检', scope: '供应商确认单查看、到货质检信息', memberCount: 1, description: '只读查看，不参与单据编辑', source: '平台内置', updatedAt: '2026-05-18 14:00:00' },
  { roleCode: 'ROLE-PMS-WH', roleName: '仓库', scope: '物流签收、物料档案只读', memberCount: 1, description: '负责国内/头程物流签收', source: 'WMS 同步', updatedAt: '2026-05-25 16:00:00' },
]

export const pmsSettingDictionaries: PmsSettingDictionary[] = [
  { code: 'DICT-PURCHASE-TYPE', name: '采购类型（做货/成衣/样衣）', category: '采购单据', source: '平台内置', referenceCount: 3, status: '启用', updatedAt: '2026-05-10 09:00:00' },
  { code: 'DICT-MATERIAL-CATEGORY', name: '物料类别（面料/辅料/纱线/包材/耗材）', category: '物料档案', source: 'PCS 同步', referenceCount: 5, status: '启用', updatedAt: '2026-05-12 10:30:00' },
  { code: 'DICT-UNIT', name: '计量单位', category: '基础资料', source: 'PCS 同步', referenceCount: 20, status: '启用', updatedAt: '2026-04-30 10:00:00' },
  { code: 'DICT-SUPPLIER-STATUS', name: '供应商状态', category: '供应商', source: '平台内置', referenceCount: 5, status: '启用', updatedAt: '2026-05-08 15:00:00' },
  { code: 'DICT-TRANSPORT-METHOD', name: '运输方式（海卡/海派/空卡/空派…）', category: '头程物流', source: '平台内置', referenceCount: 7, status: '启用', updatedAt: '2026-05-06 11:00:00' },
  { code: 'DICT-BILLING-METHOD', name: '计费方式（计费重/实重/体积/整柜）', category: '头程物流', source: '平台内置', referenceCount: 4, status: '启用', updatedAt: '2026-05-06 11:00:00' },
  { code: 'DICT-LOGISTICS-FEE', name: '物流费用项（7 项）', category: '对账结算', source: '平台内置', referenceCount: 7, status: '启用', updatedAt: '2026-05-15 14:00:00' },
  { code: 'DICT-PAYMENT-STATUS', name: '请款/付款状态', category: '对账结算', source: '平台内置', referenceCount: 8, status: '启用', updatedAt: '2026-05-15 14:00:00' },
  { code: 'DICT-WAREHOUSE-TYPE', name: '仓库类型', category: '仓储', source: 'WMS 同步', referenceCount: 5, status: '启用', updatedAt: '2026-06-01 09:00:00' },
  { code: 'DICT-KOL-STATUS', name: 'KOL 需求状态', category: '采购建议', source: '平台内置', referenceCount: 5, status: '停用', updatedAt: '2026-05-28 16:00:00' },
]

export function listPmsSettingUsers(): PmsSettingUser[] {
  return pmsSettingUsers
}

export function listPmsSettingRoles(): PmsSettingRole[] {
  return pmsSettingRoles
}

export function listPmsSettingDictionaries(): PmsSettingDictionary[] {
  return pmsSettingDictionaries
}
