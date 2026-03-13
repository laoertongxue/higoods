export type TechPackStatus = 'MISSING' | 'BETA' | 'RELEASED'

export interface TechPackPatternFile {
  id: string
  fileName: string
  fileUrl: string
  uploadedAt: string
  uploadedBy: string
}

export interface TechPackProcess {
  id: string
  seq: number
  name: string
  timeMinutes: number
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH'
  qcPoint: string
}

export interface TechPackSizeRow {
  id: string
  part: string
  S: number
  M: number
  L: number
  XL: number
  tolerance: number
}

export interface TechPackBomItem {
  id: string
  type: string
  name: string
  spec: string
  unitConsumption: number
  lossRate: number
  supplier: string
}

export interface TechPackPatternDesign {
  id: string
  name: string
  imageUrl: string
}

export interface TechPackAttachment {
  id: string
  fileName: string
  fileType: string
  fileSize: string
  uploadedAt: string
  uploadedBy: string
  downloadUrl: string
}

export interface TechPack {
  spuCode: string
  spuName: string
  status: TechPackStatus
  versionLabel: string
  completenessScore: number
  missingChecklist: string[]
  lastUpdatedAt: string
  lastUpdatedBy: string
  // 详细数据
  patternFiles: TechPackPatternFile[]
  patternDesc: string
  processes: TechPackProcess[]
  sizeTable: TechPackSizeRow[]
  bomItems: TechPackBomItem[]
  patternDesigns: TechPackPatternDesign[]
  attachments: TechPackAttachment[]
}

// 计算完整度
export function calculateCompleteness(techPack: TechPack): { score: number; missing: string[] } {
  const missing: string[] = []
  let score = 0
  const weights = { pattern: 20, process: 25, size: 15, bom: 20, patternDesign: 10, attachment: 10 }
  
  if (techPack.patternFiles.length > 0 || techPack.patternDesc.trim()) {
    score += weights.pattern
  } else {
    missing.push('制版文件')
  }
  
  if (techPack.processes.length > 0) {
    score += weights.process
  } else {
    missing.push('工序表')
  }
  
  if (techPack.sizeTable.length > 0) {
    score += weights.size
  } else {
    missing.push('尺码表')
  }
  
  if (techPack.bomItems.length > 0) {
    score += weights.bom
  } else {
    missing.push('BOM物料')
  }
  
  if (techPack.patternDesigns.length > 0) {
    score += weights.patternDesign
  } else {
    missing.push('花型设计')
  }
  
  if (techPack.attachments.length > 0) {
    score += weights.attachment
  } else {
    missing.push('附件')
  }
  
  return { score, missing }
}

// Mock 数据
export const techPacks: TechPack[] = [
  {
    spuCode: 'SPU-2024-001',
    spuName: '春季休闲T恤',
    status: 'RELEASED',
    versionLabel: 'v1.0',
    completenessScore: 100,
    missingChecklist: [],
    lastUpdatedAt: '2024-03-15 14:30:00',
    lastUpdatedBy: 'Budi Santoso',
    patternFiles: [
      { id: 'pf-1', fileName: '前片纸样.pdf', fileUrl: '#', uploadedAt: '2024-03-10', uploadedBy: 'Budi' },
      { id: 'pf-2', fileName: '后片纸样.pdf', fileUrl: '#', uploadedAt: '2024-03-10', uploadedBy: 'Budi' },
    ],
    patternDesc: '标准休闲版型，前后片分开裁剪，袖口收边处理',
    processes: [
      { id: 'p-1', seq: 1, name: '裁剪', timeMinutes: 5, difficulty: 'LOW', qcPoint: '检查尺寸' },
      { id: 'p-2', seq: 2, name: '缝合肩线', timeMinutes: 3, difficulty: 'MEDIUM', qcPoint: '检查针距' },
      { id: 'p-3', seq: 3, name: '上袖', timeMinutes: 8, difficulty: 'HIGH', qcPoint: '检查对称性' },
      { id: 'p-4', seq: 4, name: '缝合侧缝', timeMinutes: 4, difficulty: 'LOW', qcPoint: '检查平整度' },
      { id: 'p-5', seq: 5, name: '下摆处理', timeMinutes: 3, difficulty: 'LOW', qcPoint: '检查收边' },
    ],
    sizeTable: [
      { id: 's-1', part: '胸围', S: 96, M: 100, L: 104, XL: 108, tolerance: 4 },
      { id: 's-2', part: '衣长', S: 68, M: 70, L: 72, XL: 74, tolerance: 2 },
      { id: 's-3', part: '肩宽', S: 42, M: 44, L: 46, XL: 48, tolerance: 2 },
    ],
    bomItems: [
      { id: 'b-1', type: '面料', name: '纯棉针织布', spec: '180g/m²', unitConsumption: 0.8, lossRate: 3, supplier: 'PT Textile Indo' },
      { id: 'b-2', type: '辅料', name: '缝纫线', spec: '40s/2', unitConsumption: 50, lossRate: 5, supplier: 'CV Thread Jaya' },
    ],
    patternDesigns: [
      { id: 'pd-1', name: '胸前Logo', imageUrl: '/placeholder.svg' },
    ],
    attachments: [
      { id: 'a-1', fileName: '工艺说明书.pdf', fileType: 'PDF', fileSize: '2.3MB', uploadedAt: '2024-03-12', uploadedBy: 'Dewi', downloadUrl: '#' },
    ],
  },
  {
    spuCode: 'SPU-2024-002',
    spuName: '商务休闲裤',
    status: 'BETA',
    versionLabel: 'beta',
    completenessScore: 65,
    missingChecklist: ['花型设计', '附件'],
    lastUpdatedAt: '2024-03-18 10:00:00',
    lastUpdatedBy: 'Dewi Lestari',
    patternFiles: [
      { id: 'pf-3', fileName: '裤片纸样.pdf', fileUrl: '#', uploadedAt: '2024-03-16', uploadedBy: 'Dewi' },
    ],
    patternDesc: '商务休闲版型，直筒裤腿，腰头带扣设计',
    processes: [
      { id: 'p-6', seq: 1, name: '裁剪', timeMinutes: 6, difficulty: 'LOW', qcPoint: '检查对称' },
      { id: 'p-7', seq: 2, name: '缝合裤片', timeMinutes: 10, difficulty: 'MEDIUM', qcPoint: '检查缝线' },
      { id: 'p-8', seq: 3, name: '上腰头', timeMinutes: 8, difficulty: 'HIGH', qcPoint: '检查平整' },
    ],
    sizeTable: [
      { id: 's-4', part: '腰围', S: 76, M: 80, L: 84, XL: 88, tolerance: 2 },
      { id: 's-5', part: '裤长', S: 100, M: 102, L: 104, XL: 106, tolerance: 2 },
    ],
    bomItems: [
      { id: 'b-3', type: '面料', name: '棉涤混纺', spec: '250g/m²', unitConsumption: 1.2, lossRate: 4, supplier: 'PT Fabric Master' },
    ],
    patternDesigns: [],
    attachments: [],
  },
  {
    spuCode: 'SPU-2024-003',
    spuName: '女士连衣裙',
    status: 'BETA',
    versionLabel: 'beta',
    completenessScore: 45,
    missingChecklist: ['工序表', '花型设计', '附件'],
    lastUpdatedAt: '2024-03-20 09:15:00',
    lastUpdatedBy: 'Ahmad Wijaya',
    patternFiles: [
      { id: 'pf-4', fileName: '裙身纸样.pdf', fileUrl: '#', uploadedAt: '2024-03-19', uploadedBy: 'Ahmad' },
    ],
    patternDesc: 'A字裙版型，腰部收褶设计，裙摆自然垂坠',
    processes: [],
    sizeTable: [
      { id: 's-6', part: '胸围', S: 84, M: 88, L: 92, XL: 96, tolerance: 2 },
      { id: 's-7', part: '裙长', S: 90, M: 92, L: 94, XL: 96, tolerance: 2 },
    ],
    bomItems: [
      { id: 'b-4', type: '面料', name: '雪纺', spec: '100g/m²', unitConsumption: 1.5, lossRate: 5, supplier: 'CV Chiffon Indo' },
    ],
    patternDesigns: [],
    attachments: [],
  },
  {
    spuCode: 'SPU-2024-004',
    spuName: '运动短裤',
    status: 'MISSING',
    versionLabel: '-',
    completenessScore: 0,
    missingChecklist: ['制版文件', '工序表', '尺码表', 'BOM物料', '花型设计', '附件'],
    lastUpdatedAt: '-',
    lastUpdatedBy: '-',
    patternFiles: [],
    patternDesc: '',
    processes: [],
    sizeTable: [],
    bomItems: [],
    patternDesigns: [],
    attachments: [],
  },
  {
    spuCode: 'SPU-2024-005',
    spuName: '针织开衫',
    status: 'RELEASED',
    versionLabel: 'v1.2',
    completenessScore: 100,
    missingChecklist: [],
    lastUpdatedAt: '2024-03-22 16:45:00',
    lastUpdatedBy: 'Siti Rahayu',
    patternFiles: [
      { id: 'pf-5', fileName: '开衫前片.pdf', fileUrl: '#', uploadedAt: '2024-03-20', uploadedBy: 'Siti' },
      { id: 'pf-6', fileName: '开衫后片.pdf', fileUrl: '#', uploadedAt: '2024-03-20', uploadedBy: 'Siti' },
    ],
    patternDesc: '宽松版型，落肩设计，前开扣设计',
    processes: [
      { id: 'p-9', seq: 1, name: '裁剪', timeMinutes: 6, difficulty: 'LOW', qcPoint: '检查尺寸' },
      { id: 'p-10', seq: 2, name: '缝合', timeMinutes: 15, difficulty: 'MEDIUM', qcPoint: '检查针距' },
      { id: 'p-11', seq: 3, name: '钉扣', timeMinutes: 5, difficulty: 'LOW', qcPoint: '检查位置' },
    ],
    sizeTable: [
      { id: 's-8', part: '胸围', S: 100, M: 104, L: 108, XL: 112, tolerance: 4 },
      { id: 's-9', part: '衣长', S: 60, M: 62, L: 64, XL: 66, tolerance: 2 },
    ],
    bomItems: [
      { id: 'b-5', type: '面料', name: '针织罗纹', spec: '280g/m²', unitConsumption: 0.9, lossRate: 3, supplier: 'PT Knit Jaya' },
      { id: 'b-6', type: '辅料', name: '纽扣', spec: '15mm', unitConsumption: 6, lossRate: 2, supplier: 'CV Button Indo' },
    ],
    patternDesigns: [
      { id: 'pd-2', name: '袖口花纹', imageUrl: '/placeholder.svg' },
    ],
    attachments: [
      { id: 'a-2', fileName: '针织工艺说明.pdf', fileType: 'PDF', fileSize: '1.8MB', uploadedAt: '2024-03-21', uploadedBy: 'Siti', downloadUrl: '#' },
    ],
  },
  {
    spuCode: 'SPU-2024-006',
    spuName: '牛仔夹克',
    status: 'BETA',
    versionLabel: 'beta',
    completenessScore: 80,
    missingChecklist: ['附件'],
    lastUpdatedAt: '2024-03-23 11:20:00',
    lastUpdatedBy: 'Hendra Kusuma',
    patternFiles: [
      { id: 'pf-7', fileName: '夹克纸样.pdf', fileUrl: '#', uploadedAt: '2024-03-22', uploadedBy: 'Hendra' },
    ],
    patternDesc: '经典牛仔夹克版型，双口袋设计，金属纽扣',
    processes: [
      { id: 'p-12', seq: 1, name: '裁剪', timeMinutes: 8, difficulty: 'MEDIUM', qcPoint: '检查纹路' },
      { id: 'p-13', seq: 2, name: '缝合', timeMinutes: 20, difficulty: 'HIGH', qcPoint: '检查针距' },
      { id: 'p-14', seq: 3, name: '钉扣', timeMinutes: 6, difficulty: 'LOW', qcPoint: '检查位置' },
      { id: 'p-15', seq: 4, name: '水洗', timeMinutes: 30, difficulty: 'HIGH', qcPoint: '检查色牢度' },
    ],
    sizeTable: [
      { id: 's-10', part: '胸围', S: 104, M: 108, L: 112, XL: 116, tolerance: 4 },
      { id: 's-11', part: '衣长', S: 62, M: 64, L: 66, XL: 68, tolerance: 2 },
    ],
    bomItems: [
      { id: 'b-7', type: '面料', name: '牛仔布', spec: '12oz', unitConsumption: 1.3, lossRate: 4, supplier: 'PT Denim Indo' },
      { id: 'b-8', type: '辅料', name: '金属扣', spec: '17mm', unitConsumption: 8, lossRate: 2, supplier: 'CV Metal Jaya' },
    ],
    patternDesigns: [
      { id: 'pd-3', name: '后背刺绣', imageUrl: '/placeholder.svg' },
    ],
    attachments: [],
  },
]

// 根据SPU获取技术包
export function getTechPackBySpuCode(spuCode: string): TechPack | undefined {
  return techPacks.find(tp => tp.spuCode === spuCode)
}

// 创建空白beta技术包
export function createBetaTechPack(spuCode: string, spuName: string): TechPack {
  return {
    spuCode,
    spuName,
    status: 'BETA',
    versionLabel: 'beta',
    completenessScore: 0,
    missingChecklist: ['制版文件', '工序表', '尺码表', 'BOM物料', '花型设计', '附件'],
    lastUpdatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    lastUpdatedBy: 'System',
    patternFiles: [],
    patternDesc: '',
    processes: [],
    sizeTable: [],
    bomItems: [],
    patternDesigns: [],
    attachments: [],
  }
}

// 获取或创建技术包（如果不存在则创建beta版本）
export function getOrCreateTechPack(spuCode: string, spuName?: string): TechPack {
  let techPack = getTechPackBySpuCode(spuCode)
  if (!techPack) {
    // 如果没有提供spuName，尝试从已有的MISSING技术包或使用spuCode
    const finalSpuName = spuName || spuCode
    techPack = createBetaTechPack(spuCode, finalSpuName)
    techPacks.push(techPack)
  }
  return techPack
}

// 更新技术包
export function updateTechPack(spuCode: string, updates: Partial<TechPack>): TechPack | undefined {
  const index = techPacks.findIndex(tp => tp.spuCode === spuCode)
  if (index === -1) return undefined
  techPacks[index] = { ...techPacks[index], ...updates }
  return techPacks[index]
}
