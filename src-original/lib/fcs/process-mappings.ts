// 工艺名称映射 - ProcessMapping
// 旧系统/技术包工艺名称 → ProcessType.code 映射

export type MappingSource = 'LEGACY_TECH_PACK' | 'NEW_TECH_PACK'
export type MappingType = 'EXACT' | 'ALIAS' | 'SPLIT' | 'MERGE' | 'UNMAPPED'
export type MappingConfidence = 'HIGH' | 'MED' | 'LOW'

export interface ProcessMapping {
  id: string
  source: MappingSource
  legacyNameRaw: string
  legacyNameNorm: string
  mapType: MappingType
  processCodes: string[]
  confidence: MappingConfidence
  ruleJson?: {
    seqOrder?: string[]
  }
}

// 规范化名称：去空格、统一符号
export function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/，/g, ',')
    .toLowerCase()
}

// 预置映射条目（40+）
export const processMappings: ProcessMapping[] = [
  // 裁剪类 - EXACT
  { id: 'PM-001', source: 'LEGACY_TECH_PACK', legacyNameRaw: '裁片', legacyNameNorm: '裁片', mapType: 'EXACT', processCodes: ['PROC_CUT'], confidence: 'HIGH' },
  { id: 'PM-002', source: 'LEGACY_TECH_PACK', legacyNameRaw: '裁剪', legacyNameNorm: '裁剪', mapType: 'ALIAS', processCodes: ['PROC_CUT'], confidence: 'HIGH' },
  { id: 'PM-003', source: 'LEGACY_TECH_PACK', legacyNameRaw: '裁床', legacyNameNorm: '裁床', mapType: 'ALIAS', processCodes: ['PROC_CUT'], confidence: 'HIGH' },
  { id: 'PM-004', source: 'LEGACY_TECH_PACK', legacyNameRaw: '缩水', legacyNameNorm: '缩水', mapType: 'EXACT', processCodes: ['PROC_SHRINK'], confidence: 'HIGH' },
  { id: 'PM-005', source: 'LEGACY_TECH_PACK', legacyNameRaw: '预缩', legacyNameNorm: '预缩', mapType: 'ALIAS', processCodes: ['PROC_SHRINK'], confidence: 'HIGH' },
  { id: 'PM-006', source: 'LEGACY_TECH_PACK', legacyNameRaw: '定位裁', legacyNameNorm: '定位裁', mapType: 'EXACT', processCodes: ['PROC_POSITION_CUT'], confidence: 'HIGH' },
  { id: 'PM-007', source: 'LEGACY_TECH_PACK', legacyNameRaw: '定向裁', legacyNameNorm: '定向裁', mapType: 'EXACT', processCodes: ['PROC_DIRECTION_CUT'], confidence: 'HIGH' },
  { id: 'PM-008', source: 'LEGACY_TECH_PACK', legacyNameRaw: '激光切', legacyNameNorm: '激光切', mapType: 'EXACT', processCodes: ['PROC_LASER_CUT'], confidence: 'HIGH' },
  { id: 'PM-009', source: 'LEGACY_TECH_PACK', legacyNameRaw: '激光裁', legacyNameNorm: '激光裁', mapType: 'ALIAS', processCodes: ['PROC_LASER_CUT'], confidence: 'HIGH' },
  { id: 'PM-010', source: 'LEGACY_TECH_PACK', legacyNameRaw: '激光雕刻', legacyNameNorm: '激光雕刻', mapType: 'ALIAS', processCodes: ['PROC_LASER_CUT'], confidence: 'MED' },

  // 车缝类 - EXACT
  { id: 'PM-011', source: 'LEGACY_TECH_PACK', legacyNameRaw: '车缝', legacyNameNorm: '车缝', mapType: 'EXACT', processCodes: ['PROC_SEW'], confidence: 'HIGH' },
  { id: 'PM-012', source: 'LEGACY_TECH_PACK', legacyNameRaw: '缝纫', legacyNameNorm: '缝纫', mapType: 'ALIAS', processCodes: ['PROC_SEW'], confidence: 'HIGH' },
  { id: 'PM-013', source: 'LEGACY_TECH_PACK', legacyNameRaw: '缝制', legacyNameNorm: '缝制', mapType: 'ALIAS', processCodes: ['PROC_SEW'], confidence: 'HIGH' },
  { id: 'PM-014', source: 'LEGACY_TECH_PACK', legacyNameRaw: '车工', legacyNameNorm: '车工', mapType: 'ALIAS', processCodes: ['PROC_SEW'], confidence: 'HIGH' },
  { id: 'PM-015', source: 'LEGACY_TECH_PACK', legacyNameRaw: '压褶', legacyNameNorm: '压褶', mapType: 'EXACT', processCodes: ['PROC_PLEAT'], confidence: 'HIGH' },
  { id: 'PM-016', source: 'LEGACY_TECH_PACK', legacyNameRaw: '打褶', legacyNameNorm: '打褶', mapType: 'ALIAS', processCodes: ['PROC_PLEAT'], confidence: 'HIGH' },
  { id: 'PM-017', source: 'LEGACY_TECH_PACK', legacyNameRaw: '打揽', legacyNameNorm: '打揽', mapType: 'EXACT', processCodes: ['PROC_DALAN'], confidence: 'HIGH' },
  { id: 'PM-018', source: 'LEGACY_TECH_PACK', legacyNameRaw: '抽褶', legacyNameNorm: '抽褶', mapType: 'ALIAS', processCodes: ['PROC_DALAN'], confidence: 'MED' },

  // 打条/捆条/搪条 - ALIAS
  { id: 'PM-019', source: 'LEGACY_TECH_PACK', legacyNameRaw: '打条', legacyNameNorm: '打条', mapType: 'EXACT', processCodes: ['PROC_DATIAO'], confidence: 'HIGH' },
  { id: 'PM-020', source: 'LEGACY_TECH_PACK', legacyNameRaw: '装饰条', legacyNameNorm: '装饰条', mapType: 'ALIAS', processCodes: ['PROC_DATIAO'], confidence: 'MED' },
  { id: 'PM-021', source: 'LEGACY_TECH_PACK', legacyNameRaw: '领条', legacyNameNorm: '领条', mapType: 'ALIAS', processCodes: ['PROC_DATIAO'], confidence: 'MED' },
  { id: 'PM-022', source: 'LEGACY_TECH_PACK', legacyNameRaw: '捆条', legacyNameNorm: '捆条', mapType: 'EXACT', processCodes: ['PROC_KUNTIAO'], confidence: 'HIGH' },
  { id: 'PM-023', source: 'LEGACY_TECH_PACK', legacyNameRaw: '绑条', legacyNameNorm: '绑条', mapType: 'ALIAS', processCodes: ['PROC_KUNTIAO'], confidence: 'HIGH' },
  { id: 'PM-024', source: 'LEGACY_TECH_PACK', legacyNameRaw: '滚边', legacyNameNorm: '滚边', mapType: 'ALIAS', processCodes: ['PROC_KUNTIAO'], confidence: 'MED' },
  { id: 'PM-025', source: 'LEGACY_TECH_PACK', legacyNameRaw: '搪条', legacyNameNorm: '搪条', mapType: 'EXACT', processCodes: ['PROC_TANGTIAO'], confidence: 'HIGH' },
  { id: 'PM-026', source: 'LEGACY_TECH_PACK', legacyNameRaw: '包边', legacyNameNorm: '包边', mapType: 'ALIAS', processCodes: ['PROC_TANGTIAO'], confidence: 'HIGH' },

  // 扣类
  { id: 'PM-027', source: 'LEGACY_TECH_PACK', legacyNameRaw: '手缝扣', legacyNameNorm: '手缝扣', mapType: 'EXACT', processCodes: ['PROC_HAND_BUTTON'], confidence: 'HIGH' },
  { id: 'PM-028', source: 'LEGACY_TECH_PACK', legacyNameRaw: '钉扣', legacyNameNorm: '钉扣', mapType: 'ALIAS', processCodes: ['PROC_HAND_BUTTON'], confidence: 'MED' },
  { id: 'PM-029', source: 'LEGACY_TECH_PACK', legacyNameRaw: '机打扣', legacyNameNorm: '机打扣', mapType: 'EXACT', processCodes: ['PROC_MACHINE_BUTTON'], confidence: 'HIGH' },
  { id: 'PM-030', source: 'LEGACY_TECH_PACK', legacyNameRaw: '打扣', legacyNameNorm: '打扣', mapType: 'ALIAS', processCodes: ['PROC_MACHINE_BUTTON'], confidence: 'HIGH' },
  { id: 'PM-031', source: 'LEGACY_TECH_PACK', legacyNameRaw: '四爪扣', legacyNameNorm: '四爪扣', mapType: 'EXACT', processCodes: ['PROC_FOUR_CLAW'], confidence: 'HIGH' },
  { id: 'PM-032', source: 'LEGACY_TECH_PACK', legacyNameRaw: '鸡眼扣', legacyNameNorm: '鸡眼扣', mapType: 'EXACT', processCodes: ['PROC_EYELET'], confidence: 'HIGH' },
  { id: 'PM-033', source: 'LEGACY_TECH_PACK', legacyNameRaw: '气眼', legacyNameNorm: '气眼', mapType: 'ALIAS', processCodes: ['PROC_EYELET'], confidence: 'HIGH' },
  { id: 'PM-034', source: 'LEGACY_TECH_PACK', legacyNameRaw: '开扣眼', legacyNameNorm: '开扣眼', mapType: 'EXACT', processCodes: ['PROC_BUTTONHOLE'], confidence: 'HIGH' },
  { id: 'PM-035', source: 'LEGACY_TECH_PACK', legacyNameRaw: '扣眼', legacyNameNorm: '扣眼', mapType: 'ALIAS', processCodes: ['PROC_BUTTONHOLE'], confidence: 'HIGH' },
  { id: 'PM-036', source: 'LEGACY_TECH_PACK', legacyNameRaw: '锁眼', legacyNameNorm: '锁眼', mapType: 'ALIAS', processCodes: ['PROC_BUTTONHOLE'], confidence: 'HIGH' },
  { id: 'PM-037', source: 'LEGACY_TECH_PACK', legacyNameRaw: '曲牙', legacyNameNorm: '曲牙', mapType: 'EXACT', processCodes: ['PROC_QUYA'], confidence: 'HIGH' },
  { id: 'PM-038', source: 'LEGACY_TECH_PACK', legacyNameRaw: '拉链', legacyNameNorm: '拉链', mapType: 'ALIAS', processCodes: ['PROC_QUYA'], confidence: 'MED' },
  { id: 'PM-039', source: 'LEGACY_TECH_PACK', legacyNameRaw: '布包扣', legacyNameNorm: '布包扣', mapType: 'EXACT', processCodes: ['PROC_CLOTH_BUTTON'], confidence: 'HIGH' },
  { id: 'PM-040', source: 'LEGACY_TECH_PACK', legacyNameRaw: '包布扣', legacyNameNorm: '包布扣', mapType: 'ALIAS', processCodes: ['PROC_CLOTH_BUTTON'], confidence: 'HIGH' },
  { id: 'PM-041', source: 'LEGACY_TECH_PACK', legacyNameRaw: '手工盘扣', legacyNameNorm: '手工盘扣', mapType: 'EXACT', processCodes: ['PROC_PANKOU'], confidence: 'HIGH' },
  { id: 'PM-042', source: 'LEGACY_TECH_PACK', legacyNameRaw: '盘扣', legacyNameNorm: '盘扣', mapType: 'ALIAS', processCodes: ['PROC_PANKOU'], confidence: 'HIGH' },

  // 特种工艺
  { id: 'PM-043', source: 'LEGACY_TECH_PACK', legacyNameRaw: '绣花', legacyNameNorm: '绣花', mapType: 'EXACT', processCodes: ['PROC_EMBROIDER'], confidence: 'HIGH' },
  { id: 'PM-044', source: 'LEGACY_TECH_PACK', legacyNameRaw: '刺绣', legacyNameNorm: '刺绣', mapType: 'ALIAS', processCodes: ['PROC_EMBROIDER'], confidence: 'HIGH' },
  { id: 'PM-045', source: 'LEGACY_TECH_PACK', legacyNameRaw: '电绣', legacyNameNorm: '电绣', mapType: 'ALIAS', processCodes: ['PROC_EMBROIDER'], confidence: 'HIGH' },
  { id: 'PM-046', source: 'LEGACY_TECH_PACK', legacyNameRaw: '烫画', legacyNameNorm: '烫画', mapType: 'EXACT', processCodes: ['PROC_TANHUA'], confidence: 'HIGH' },
  { id: 'PM-047', source: 'LEGACY_TECH_PACK', legacyNameRaw: '热转印', legacyNameNorm: '热转印', mapType: 'ALIAS', processCodes: ['PROC_TANHUA'], confidence: 'HIGH' },
  { id: 'PM-048', source: 'LEGACY_TECH_PACK', legacyNameRaw: '直喷', legacyNameNorm: '直喷', mapType: 'EXACT', processCodes: ['PROC_DIRECT_PRINT'], confidence: 'HIGH' },
  { id: 'PM-049', source: 'LEGACY_TECH_PACK', legacyNameRaw: '数码印花', legacyNameNorm: '数码印花', mapType: 'ALIAS', processCodes: ['PROC_DIRECT_PRINT'], confidence: 'HIGH' },
  { id: 'PM-050', source: 'LEGACY_TECH_PACK', legacyNameRaw: '贝壳绣', legacyNameNorm: '贝壳绣', mapType: 'EXACT', processCodes: ['PROC_SHELL_EMBROIDER'], confidence: 'HIGH' },

  // 印染（外部约束）
  { id: 'PM-051', source: 'LEGACY_TECH_PACK', legacyNameRaw: '印花', legacyNameNorm: '印花', mapType: 'EXACT', processCodes: ['PROC_PRINT'], confidence: 'HIGH' },
  { id: 'PM-052', source: 'LEGACY_TECH_PACK', legacyNameRaw: '丝网印', legacyNameNorm: '丝网印', mapType: 'ALIAS', processCodes: ['PROC_PRINT'], confidence: 'HIGH' },
  { id: 'PM-053', source: 'LEGACY_TECH_PACK', legacyNameRaw: '染色', legacyNameNorm: '染色', mapType: 'EXACT', processCodes: ['PROC_DYE'], confidence: 'HIGH' },
  { id: 'PM-054', source: 'LEGACY_TECH_PACK', legacyNameRaw: '浸染', legacyNameNorm: '浸染', mapType: 'ALIAS', processCodes: ['PROC_DYE'], confidence: 'HIGH' },
  { id: 'PM-055', source: 'LEGACY_TECH_PACK', legacyNameRaw: '洗水', legacyNameNorm: '洗水', mapType: 'EXACT', processCodes: ['PROC_WASH'], confidence: 'HIGH' },
  { id: 'PM-056', source: 'LEGACY_TECH_PACK', legacyNameRaw: '水洗', legacyNameNorm: '水洗', mapType: 'ALIAS', processCodes: ['PROC_WASH'], confidence: 'HIGH' },
  { id: 'PM-057', source: 'LEGACY_TECH_PACK', legacyNameRaw: '做旧', legacyNameNorm: '做旧', mapType: 'ALIAS', processCodes: ['PROC_WASH'], confidence: 'MED' },

  // 后道
  { id: 'PM-058', source: 'LEGACY_TECH_PACK', legacyNameRaw: '整烫', legacyNameNorm: '整烫', mapType: 'EXACT', processCodes: ['PROC_IRON'], confidence: 'HIGH' },
  { id: 'PM-059', source: 'LEGACY_TECH_PACK', legacyNameRaw: '烫整', legacyNameNorm: '烫整', mapType: 'ALIAS', processCodes: ['PROC_IRON'], confidence: 'HIGH' },
  { id: 'PM-060', source: 'LEGACY_TECH_PACK', legacyNameRaw: '熨烫', legacyNameNorm: '熨烫', mapType: 'ALIAS', processCodes: ['PROC_IRON'], confidence: 'HIGH' },
  { id: 'PM-061', source: 'LEGACY_TECH_PACK', legacyNameRaw: '包装', legacyNameNorm: '包装', mapType: 'EXACT', processCodes: ['PROC_PACK'], confidence: 'HIGH' },
  { id: 'PM-062', source: 'LEGACY_TECH_PACK', legacyNameRaw: '装箱', legacyNameNorm: '装箱', mapType: 'ALIAS', processCodes: ['PROC_PACK'], confidence: 'HIGH' },
  { id: 'PM-063', source: 'LEGACY_TECH_PACK', legacyNameRaw: '质检', legacyNameNorm: '质检', mapType: 'EXACT', processCodes: ['PROC_QC'], confidence: 'HIGH' },
  { id: 'PM-064', source: 'LEGACY_TECH_PACK', legacyNameRaw: 'QC', legacyNameNorm: 'qc', mapType: 'ALIAS', processCodes: ['PROC_QC'], confidence: 'HIGH' },
  { id: 'PM-065', source: 'LEGACY_TECH_PACK', legacyNameRaw: '后整理', legacyNameNorm: '后整理', mapType: 'EXACT', processCodes: ['PROC_FINISHING'], confidence: 'HIGH' },
  { id: 'PM-066', source: 'LEGACY_TECH_PACK', legacyNameRaw: '后整', legacyNameNorm: '后整', mapType: 'ALIAS', processCodes: ['PROC_FINISHING'], confidence: 'HIGH' },

  // SPLIT 示例：裁剪+车缝
  { id: 'PM-067', source: 'LEGACY_TECH_PACK', legacyNameRaw: '裁剪车缝', legacyNameNorm: '裁剪车缝', mapType: 'SPLIT', processCodes: ['PROC_CUT', 'PROC_SEW'], confidence: 'HIGH', ruleJson: { seqOrder: ['PROC_CUT', 'PROC_SEW'] } },
  { id: 'PM-068', source: 'LEGACY_TECH_PACK', legacyNameRaw: '整烫包装', legacyNameNorm: '整烫包装', mapType: 'SPLIT', processCodes: ['PROC_IRON', 'PROC_PACK'], confidence: 'HIGH', ruleJson: { seqOrder: ['PROC_IRON', 'PROC_PACK'] } },
  
  // 技术包常见工序名（与SPU-2024-001等匹配）
  { id: 'PM-069', source: 'NEW_TECH_PACK', legacyNameRaw: '缝合肩线', legacyNameNorm: '缝合肩线', mapType: 'ALIAS', processCodes: ['PROC_SEW'], confidence: 'HIGH' },
  { id: 'PM-070', source: 'NEW_TECH_PACK', legacyNameRaw: '上袖', legacyNameNorm: '上袖', mapType: 'ALIAS', processCodes: ['PROC_SEW'], confidence: 'HIGH' },
  { id: 'PM-071', source: 'NEW_TECH_PACK', legacyNameRaw: '缝合侧缝', legacyNameNorm: '缝合侧缝', mapType: 'ALIAS', processCodes: ['PROC_SEW'], confidence: 'HIGH' },
  { id: 'PM-072', source: 'NEW_TECH_PACK', legacyNameRaw: '下摆处理', legacyNameNorm: '下摆处理', mapType: 'ALIAS', processCodes: ['PROC_SEW'], confidence: 'MED' },
  { id: 'PM-073', source: 'NEW_TECH_PACK', legacyNameRaw: '缝合裤片', legacyNameNorm: '缝合裤片', mapType: 'ALIAS', processCodes: ['PROC_SEW'], confidence: 'HIGH' },
  { id: 'PM-074', source: 'NEW_TECH_PACK', legacyNameRaw: '上腰头', legacyNameNorm: '上腰头', mapType: 'ALIAS', processCodes: ['PROC_SEW'], confidence: 'HIGH' },
  { id: 'PM-075', source: 'NEW_TECH_PACK', legacyNameRaw: '缝合', legacyNameNorm: '缝合', mapType: 'ALIAS', processCodes: ['PROC_SEW'], confidence: 'HIGH' },
  { id: 'PM-076', source: 'NEW_TECH_PACK', legacyNameRaw: '钉扣', legacyNameNorm: '钉扣', mapType: 'ALIAS', processCodes: ['PROC_MACHINE_BUTTON'], confidence: 'HIGH' },
]

// 根据名称获取映射
export function getMappingByName(name: string): ProcessMapping | undefined {
  const norm = normalizeName(name)
  return processMappings.find(m => m.legacyNameNorm === norm || normalizeName(m.legacyNameRaw) === norm)
}

// 批量映射
export function mapProcessNames(names: string[]): { name: string; mapping: ProcessMapping | null }[] {
  return names.map(name => ({
    name,
    mapping: getMappingByName(name) || null,
  }))
}

// 添加临时映射（运行时）
export function addTemporaryMapping(legacyName: string, processCodes: string[]): ProcessMapping {
  const newMapping: ProcessMapping = {
    id: `PM-TEMP-${Date.now()}`,
    source: 'NEW_TECH_PACK',
    legacyNameRaw: legacyName,
    legacyNameNorm: normalizeName(legacyName),
    mapType: processCodes.length > 1 ? 'SPLIT' : 'EXACT',
    processCodes,
    confidence: 'LOW',
  }
  processMappings.push(newMapping)
  return newMapping
}
