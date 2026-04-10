export type MaterialArchiveKind = 'fabric' | 'accessory' | 'yarn' | 'consumable'

export type MaterialArchiveStatus = 'ACTIVE' | 'DRAFT' | 'INACTIVE'

export type MaterialArchiveSource = '自建档案' | '旧系统迁移' | '开发沉淀' | '样衣沉淀'

export interface MaterialArchiveLog {
  id: string
  time: string
  operator: string
  action: string
  detail: string
}

export interface MaterialArchiveReference {
  styleCode: string
  styleName: string
  phase: string
  usage: string
  updatedAt: string
}

export interface MaterialArchiveVariant {
  name: string
  value: string
  note?: string
  imageUrl?: string
}

export interface MaterialArchiveDraft {
  archiveCode: string
  name: string
  alias: string
  subCategory: string
  materialSummary: string
  specSummary: string
  fieldA: string
  fieldB: string
  fieldC: string
  unit: string
  useScope: string
  applicableCategories: string[]
  processTags: string[]
  source: MaterialArchiveSource
  status: MaterialArchiveStatus
  governanceOwner: string
  imageUrl: string
  summary: string
  notes: string
}

export interface MaterialArchiveRecord extends MaterialArchiveDraft {
  id: string
  kind: MaterialArchiveKind
  createdAt: string
  updatedAt: string
  updatedBy: string
  migrationNote?: string
  variants: MaterialArchiveVariant[]
  references: MaterialArchiveReference[]
  logs: MaterialArchiveLog[]
}

export const MATERIAL_ARCHIVE_STATUS_LABELS: Record<MaterialArchiveStatus, string> = {
  ACTIVE: '启用',
  DRAFT: '草稿',
  INACTIVE: '停用',
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function buildSeedLogs(name: string, owner: string, createdAt: string, updatedAt: string, source: MaterialArchiveSource): MaterialArchiveLog[] {
  return [
    {
      id: `${name}-log-1`,
      time: createdAt,
      operator: source === '旧系统迁移' ? '主档迁移专员' : owner,
      action: source === '旧系统迁移' ? '迁移建档' : '新建档案',
      detail: `建立「${name}」主档并补齐基础识别信息。`,
    },
    {
      id: `${name}-log-2`,
      time: updatedAt,
      operator: owner,
      action: '主档复核',
      detail: `复核「${name}」规格表达、适用范围与治理口径。`,
    },
  ]
}

function seedRecord(
  kind: MaterialArchiveKind,
  data: Omit<MaterialArchiveRecord, 'kind' | 'logs'> & { logs?: MaterialArchiveLog[] },
): MaterialArchiveRecord {
  return {
    ...data,
    kind,
    logs: data.logs || buildSeedLogs(data.name, data.governanceOwner, data.createdAt, data.updatedAt, data.source),
  }
}

const materialArchiveRepository: Record<MaterialArchiveKind, MaterialArchiveRecord[]> = {
  fabric: [
    seedRecord('fabric', {
      id: 'fabric-rose-jacquard-chiffon',
      archiveCode: 'FAB-260410-001',
      name: '玫瑰提花雪纺',
      alias: 'Rose Jacquard Chiffon',
      subCategory: '梭织雪纺',
      materialSummary: '100%涤纶 / 提花雪纺平纹',
      specSummary: '145cm / 92g / 无弹',
      fieldA: '100%涤纶 / 提花雪纺平纹',
      fieldB: '145cm / 92g',
      fieldC: '轻薄垂顺，适合抽褶与层叠',
      unit: '米',
      useScope: '连衣裙、上衣、穆斯林长袍',
      applicableCategories: ['连衣裙', '上衣', '长裙'],
      processTags: ['印花', '抽褶', '荷叶边'],
      source: '开发沉淀',
      status: 'ACTIVE',
      governanceOwner: '面料治理组',
      imageUrl: 'https://picsum.photos/seed/higood-fabric-rose/480/360',
      summary: '用于轻薄女装与穆斯林友好系列的外层面料，强调垂顺和印花表现。',
      notes: '商品中心只维护主档表达，采购价与库存由下游系统承接。',
      createdAt: '2026-04-02 09:20',
      updatedAt: '2026-04-09 16:30',
      updatedBy: '面料治理专员',
      migrationNote: '原始面料资料来自开发打样沉淀，已按商品中心主档口径重组字段。',
      variants: [
        { name: '推荐色系', value: '玫红 / 米白 / 湖蓝', note: '按花型任务挂接' },
        { name: '季节建议', value: '春夏', note: '适合轻薄罩袍与连衣裙' },
      ],
      references: [
        { styleCode: 'STYLE-20260403-018', styleName: '穆斯林层叠连衣裙', phase: '首版样衣', usage: '外层主面料', updatedAt: '2026-04-09 11:20' },
        { styleCode: 'STYLE-20260407-026', styleName: '印花荷叶边衬衫', phase: '商品企划', usage: '门襟与袖片', updatedAt: '2026-04-10 09:45' },
      ],
    }),
    seedRecord('fabric', {
      id: 'fabric-soft-denim',
      archiveCode: 'FAB-260410-002',
      name: '轻弹仿牛仔斜纹',
      alias: 'Soft Stretch Denim Look',
      subCategory: '仿牛仔',
      materialSummary: '68%棉 28%涤纶 4%氨纶 / 斜纹',
      specSummary: '150cm / 245g / 微弹',
      fieldA: '棉涤氨混纺 / 斜纹',
      fieldB: '150cm / 245g',
      fieldC: '微弹挺括，适合裤装与外套',
      unit: '米',
      useScope: '裤子、短裙、轻外套',
      applicableCategories: ['裤子', '短裙', '外套'],
      processTags: ['水洗', '撞色', '压线'],
      source: '自建档案',
      status: 'ACTIVE',
      governanceOwner: '面料治理组',
      imageUrl: 'https://picsum.photos/seed/higood-fabric-denim/480/360',
      summary: '适合基础改款和低价改款的牛仔视觉面料，兼顾挺括和舒适。',
      notes: '用于开发阶段的主档标准面料，不承接仓储库存信息。',
      createdAt: '2026-04-01 14:00',
      updatedAt: '2026-04-08 18:15',
      updatedBy: '商品企划',
      variants: [
        { name: '主推荐色', value: '中蓝 / 深蓝', note: '适合街头休闲系列' },
      ],
      references: [
        { styleCode: 'STYLE-20260408-031', styleName: '休闲牛仔短外套', phase: '产前确认', usage: '主面料', updatedAt: '2026-04-10 10:20' },
      ],
    }),
    seedRecord('fabric', {
      id: 'fabric-rib-knit',
      archiveCode: 'FAB-260410-003',
      name: '坑条罗纹针织',
      alias: 'Rib Knit Jersey',
      subCategory: '针织罗纹',
      materialSummary: '95%棉 5%氨纶 / 罗纹针织',
      specSummary: '110cm / 260g / 高弹',
      fieldA: '棉氨罗纹针织',
      fieldB: '110cm / 260g',
      fieldC: '高弹贴身，适合打底与领口袖口',
      unit: '公斤',
      useScope: '基础上衣、开衫、卫衣辅面料',
      applicableCategories: ['上衣', '开衫', '卫衣'],
      processTags: ['罗纹', '拼接', '基础款'],
      source: '开发沉淀',
      status: 'ACTIVE',
      governanceOwner: '面料治理组',
      imageUrl: 'https://picsum.photos/seed/higood-fabric-rib/480/360',
      summary: '用于基础打底和针织领袖口的标准罗纹主档。',
      notes: '适合作为款式档案中的标准辅面料引用。',
      createdAt: '2026-03-29 10:30',
      updatedAt: '2026-04-07 13:20',
      updatedBy: '面料治理专员',
      variants: [
        { name: '标准克重', value: '240g / 260g', note: '按款式紧度选择' },
      ],
      references: [
        { styleCode: 'STYLE-20260406-012', styleName: '云感基础针织上衣', phase: '商品企划', usage: '领口与袖口', updatedAt: '2026-04-09 09:10' },
      ],
    }),
    seedRecord('fabric', {
      id: 'fabric-floral-lace',
      archiveCode: 'FAB-260410-004',
      name: '花卉镂空蕾丝',
      alias: 'Floral Lace',
      subCategory: '蕾丝',
      materialSummary: '锦纶混纺 / 花卉镂空',
      specSummary: '138cm / 180g / 无弹',
      fieldA: '锦纶混纺 / 花卉镂空蕾丝',
      fieldB: '138cm / 180g',
      fieldC: '透视感强，适合叠搭和局部拼接',
      unit: '米',
      useScope: '礼服、连衣裙、蕾丝上衣',
      applicableCategories: ['连衣裙', '上衣', '礼服'],
      processTags: ['蕾丝', '拼接', '礼服'],
      source: '自建档案',
      status: 'DRAFT',
      governanceOwner: '面料治理组',
      imageUrl: 'https://picsum.photos/seed/higood-fabric-lace/480/360',
      summary: '用于礼服和设计款的装饰性面料主档，当前处于草稿治理阶段。',
      notes: '需在面料主档完成透视等级确认后再开放全站引用。',
      createdAt: '2026-04-06 16:40',
      updatedAt: '2026-04-10 09:00',
      updatedBy: '设计研发',
      variants: [
        { name: '透视等级', value: '中透', note: '需配里布方案' },
      ],
      references: [],
    }),
  ],
  accessory: [
    seedRecord('accessory', {
      id: 'accessory-lace-trim-18mm',
      archiveCode: 'ACC-260410-012',
      name: '1.8cm蕾丝刺绣花边',
      alias: 'Lace Trim 18mm',
      subCategory: '花边',
      materialSummary: '涤纶底布 / 蕾丝刺绣',
      specSummary: '1.8cm宽 / 多色',
      fieldA: '涤纶底布 / 蕾丝刺绣',
      fieldB: '1.8cm宽 / 软挺适中',
      fieldC: '领口、袖口、门襟点缀',
      unit: '码',
      useScope: '上衣、连衣裙、穆斯林头巾边饰',
      applicableCategories: ['上衣', '连衣裙', '居家'],
      processTags: ['花边', '刺绣', '边饰'],
      source: '旧系统迁移',
      status: 'ACTIVE',
      governanceOwner: '辅料治理组',
      imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/08/32cb1988c82030903f7d4703e2ad66f4.png',
      summary: '从旧系统迁移的基础花边主档，保留名称、图像和颜色变体，剥离供应商与价格字段。',
      notes: '辅料主档只表达规格与适用部位，不承接采购信息。',
      createdAt: '2026-04-08 18:51',
      updatedAt: '2026-04-10 10:05',
      updatedBy: '辅料治理专员',
      migrationNote: '旧系统原始记录包含供应商、成本价和销量，本次迁移已剥离为采购与库存域信息。',
      variants: [
        { name: 'white', value: '白色', imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/08/32cb1988c82030903f7d4703e2ad66f4.png' },
        { name: 'pink', value: '粉色', imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/08/2a488771eb7ae7b5c8da2c577a3a4b4d.jpg' },
        { name: 'blue', value: '浅蓝', imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/08/e0f674aa34c42762fbba8091c67b88e7.jpg' },
        { name: 'apricot', value: '杏色', imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/08/427d4a73ea33d79998727f922ed7ab75.jpg' },
      ],
      references: [
        { styleCode: 'STYLE-20260409-052', styleName: '甜美蕾丝短袖上衣', phase: '首版样衣', usage: '门襟边饰', updatedAt: '2026-04-10 09:30' },
        { styleCode: 'STYLE-20260409-077', styleName: '休闲印花长裙', phase: '商品企划', usage: '袖口点缀', updatedAt: '2026-04-10 10:12' },
      ],
    }),
    seedRecord('accessory', {
      id: 'accessory-sequin-patch',
      archiveCode: 'ACC-260410-013',
      name: '24cm*17cm亮片刺绣布贴',
      alias: 'Sequin Embroidery Patch',
      subCategory: '绣片',
      materialSummary: '布贴基底 / 亮片刺绣',
      specSummary: '24cm × 17cm / 单片',
      fieldA: '布贴基底 / 亮片刺绣',
      fieldB: '24cm × 17cm',
      fieldC: '胸前主视觉装饰',
      unit: '片',
      useScope: '卫衣、外套、牛仔上衣',
      applicableCategories: ['卫衣', '外套', '上衣'],
      processTags: ['亮片', '绣片', '大装饰'],
      source: '旧系统迁移',
      status: 'ACTIVE',
      governanceOwner: '辅料治理组',
      imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/09/c4c08761c18fb541cbccb3224d9f60b5.jpg',
      summary: '大面积装饰绣片主档，适合秀场感和街头款式的局部装饰。',
      notes: '已将旧系统 SKU 变体归并为单一辅料主档。',
      createdAt: '2026-04-09 10:24',
      updatedAt: '2026-04-10 09:48',
      updatedBy: '设计研发',
      migrationNote: '旧系统以库存 SKU 管理颜色和供应商，商品中心只保留主档和变体表达。',
      variants: [
        { name: '同图主款', value: '亮片银彩', imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/09/c4c08761c18fb541cbccb3224d9f60b5.jpg' },
      ],
      references: [
        { styleCode: 'STYLE-20260410-009', styleName: '街头拼接卫衣', phase: '设计开发', usage: '胸前装饰', updatedAt: '2026-04-10 09:55' },
      ],
    }),
    seedRecord('accessory', {
      id: 'accessory-rainbow-embroidery',
      archiveCode: 'ACC-260410-014',
      name: '19cm直径七彩绣片',
      alias: 'Rainbow Embroidery Badge',
      subCategory: '绣章',
      materialSummary: '绣章基底 / 多色电脑绣',
      specSummary: '直径 19cm / 单片',
      fieldA: '绣章基底 / 多色电脑绣',
      fieldB: '直径 19cm',
      fieldC: '大身前片或后背装饰',
      unit: '片',
      useScope: '卫衣、T恤、童装',
      applicableCategories: ['卫衣', '上衣', '童装'],
      processTags: ['彩色', '绣章', '童趣'],
      source: '旧系统迁移',
      status: 'ACTIVE',
      governanceOwner: '辅料治理组',
      imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/09/9fc858a350ec48d36d7b83f65a2ecd4c.jpg',
      summary: '用于年轻款和童装的视觉焦点绣章主档。',
      notes: '主档统一表达规格与用途，颜色差异沉到变体维度。',
      createdAt: '2026-04-09 10:30',
      updatedAt: '2026-04-10 10:02',
      updatedBy: '辅料治理专员',
      migrationNote: '从旧系统两条同图 SKU 合并为一条主档。',
      variants: [
        { name: '同图-1', value: '七彩正片', imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/09/9fc858a350ec48d36d7b83f65a2ecd4c.jpg' },
        { name: '同图-2', value: '七彩高亮', imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/09/9fc858a350ec48d36d7b83f65a2ecd4c.jpg' },
      ],
      references: [
        { styleCode: 'STYLE-20260408-051', styleName: '彩色学院风卫衣', phase: '首版样衣', usage: '后背装饰', updatedAt: '2026-04-09 18:00' },
      ],
    }),
    seedRecord('accessory', {
      id: 'accessory-butterfly-embroidery',
      archiveCode: 'ACC-260410-015',
      name: '6.5cm*8cm蝴蝶绣品',
      alias: 'Butterfly Embroidery Patch',
      subCategory: '绣片',
      materialSummary: '纱面基底 / 蝴蝶电脑绣',
      specSummary: '6.5cm × 8cm / 单片',
      fieldA: '纱面基底 / 蝴蝶电脑绣',
      fieldB: '6.5cm × 8cm',
      fieldC: '肩部、胸前、裙摆点缀',
      unit: '片',
      useScope: '女装上衣、连衣裙、童装',
      applicableCategories: ['上衣', '连衣裙', '童装'],
      processTags: ['刺绣', '蝴蝶元素', '局部点缀'],
      source: '旧系统迁移',
      status: 'ACTIVE',
      governanceOwner: '辅料治理组',
      imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/09/008f0974cad1f3a77b49335900d528e9.jpg',
      summary: '小尺寸蝴蝶绣片，适合甜美和年轻系列的局部装饰。',
      notes: '旧系统以多个颜色 SKU 记录，迁移后归并到变体。',
      createdAt: '2026-04-09 10:35',
      updatedAt: '2026-04-10 10:06',
      updatedBy: '设计研发',
      migrationNote: '旧字段中的成本和供应商未迁入商品中心主档。',
      variants: [
        { name: '同图-1', value: '浅金', imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/09/008f0974cad1f3a77b49335900d528e9.jpg' },
        { name: '同图-2', value: '淡粉', imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/09/026978fda39ac5eb254cc05b3da9d451.jpg' },
        { name: '同图-3', value: '暖灰', imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/09/e38e60af81cf5d87a429c5aa5cb7a9d9.jpg' },
      ],
      references: [
        { styleCode: 'STYLE-20260410-019', styleName: '蝴蝶刺绣短袖上衣', phase: '设计开发', usage: '胸前点缀', updatedAt: '2026-04-10 10:18' },
      ],
    }),
    seedRecord('accessory', {
      id: 'accessory-organza-flower',
      archiveCode: 'ACC-260410-016',
      name: '9*4cm双层立体纱花水晶钻',
      alias: 'Organza Flower Crystal Patch',
      subCategory: '立体花饰',
      materialSummary: '双层纱花 / 水晶钻点缀',
      specSummary: '9cm × 4cm / 单片',
      fieldA: '双层纱花 / 水晶钻点缀',
      fieldB: '9cm × 4cm',
      fieldC: '肩部、腰节、头巾胸针装饰',
      unit: '片',
      useScope: '礼服、穆斯林长袍、名媛套装',
      applicableCategories: ['连衣裙', '套装', '长裙'],
      processTags: ['立体花饰', '水钻', '礼服'],
      source: '旧系统迁移',
      status: 'DRAFT',
      governanceOwner: '辅料治理组',
      imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/09/463bea7b6db32f538dbc21450f9a7233.jpg',
      summary: '礼服和高价长袍常用的立体花饰主档，当前仍在做适用范围确认。',
      notes: '建议与礼服系列搭配，量产前需确认固定方式。',
      createdAt: '2026-04-09 10:39',
      updatedAt: '2026-04-10 09:35',
      updatedBy: '辅料治理专员',
      migrationNote: '旧系统保留四个同图 SKU，本次迁移只保留主档和颜色变体。',
      variants: [
        { name: '同图-1', value: '香槟', imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/09/463bea7b6db32f538dbc21450f9a7233.jpg' },
        { name: '同图-2', value: '银白', imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/09/287e2457f13d6899a063657da29aaafe.jpg' },
        { name: '同图-3', value: '雾粉', imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/09/3c1394f4a4a9f5577004a9092108ba5f.jpg' },
        { name: '同图-4', value: '蓝灰', imageUrl: 'https://file.higood.id/higood_live/proudcts/2026/04/09/a52ef333b3ee8e87bcca94c6cc3d3f3b.jpg' },
      ],
      references: [],
    }),
  ],
  yarn: [
    seedRecord('yarn', {
      id: 'yarn-combed-cotton-32s',
      archiveCode: 'YRN-260410-001',
      name: '32S精梳棉纱',
      alias: '32S Combed Cotton Yarn',
      subCategory: '棉纱',
      materialSummary: '100%精梳棉 / 32S',
      specSummary: '单纱 / 筒纱 / 本白',
      fieldA: '100%精梳棉 / 32S',
      fieldB: '环锭纺 / 单纱',
      fieldC: '适合基础T恤与针织上衣',
      unit: '公斤',
      useScope: 'T恤、针织上衣、打底衫',
      applicableCategories: ['上衣', '卫衣', '居家'],
      processTags: ['基础款', '针织', '棉感'],
      source: '开发沉淀',
      status: 'ACTIVE',
      governanceOwner: '纱线治理组',
      imageUrl: 'https://picsum.photos/seed/higood-yarn-cotton/480/360',
      summary: '标准基础棉纱主档，用于云感基础款和日常针织品类。',
      notes: '纱线主档不管理供应商与库存，仅服务于成分、纱支和适用品类引用。',
      createdAt: '2026-03-28 11:00',
      updatedAt: '2026-04-09 17:35',
      updatedBy: '纱线治理专员',
      variants: [
        { name: '色系', value: '本白 / 漂白 / 米杏', note: '按色卡挂接' },
      ],
      references: [
        { styleCode: 'STYLE-20260405-041', styleName: '基础圆领T恤', phase: '商品企划', usage: '主纱线', updatedAt: '2026-04-09 14:20' },
      ],
    }),
    seedRecord('yarn', {
      id: 'yarn-viscose-blend-40s',
      archiveCode: 'YRN-260410-002',
      name: '40S粘胶弹力混纺纱',
      alias: '40S Viscose Stretch Blend',
      subCategory: '混纺纱',
      materialSummary: '65%粘胶 30%锦纶 5%氨纶 / 40S',
      specSummary: '赛络纺 / 柔滑 / 轻弹',
      fieldA: '粘胶锦纶氨纶 / 40S',
      fieldB: '赛络纺 / 柔滑轻弹',
      fieldC: '适合贴身针织与设计上衣',
      unit: '公斤',
      useScope: '针织上衣、开衫、连衣裙',
      applicableCategories: ['上衣', '开衫', '连衣裙'],
      processTags: ['柔滑', '针织', '设计款'],
      source: '自建档案',
      status: 'ACTIVE',
      governanceOwner: '纱线治理组',
      imageUrl: 'https://picsum.photos/seed/higood-yarn-viscose/480/360',
      summary: '用于设计针织和贴身单品的弹力混纺纱线主档。',
      notes: '颜色变化由款式色卡承接，主档只保留纱线能力表达。',
      createdAt: '2026-04-03 15:15',
      updatedAt: '2026-04-10 08:50',
      updatedBy: '商品企划',
      variants: [
        { name: '推荐针型', value: '12G / 14G', note: '按版型松紧选择' },
      ],
      references: [
        { styleCode: 'STYLE-20260410-123', styleName: '设计针织上衣', phase: '设计开发', usage: '主纱线', updatedAt: '2026-04-10 09:40' },
      ],
    }),
    seedRecord('yarn', {
      id: 'yarn-wool-248',
      archiveCode: 'YRN-260410-003',
      name: '2/48Nm羊毛混纺纱',
      alias: '2/48Nm Wool Blend',
      subCategory: '羊毛纱',
      materialSummary: '50%羊毛 50%腈纶 / 2/48Nm',
      specSummary: '双股并纱 / 适合秋冬针织',
      fieldA: '羊毛腈纶混纺 / 2/48Nm',
      fieldB: '双股并纱 / 14G 推荐',
      fieldC: '适合秋冬开衫与毛衣',
      unit: '公斤',
      useScope: '毛衣、开衫、男装针织',
      applicableCategories: ['毛衣', '开衫', '男装上衣'],
      processTags: ['秋冬', '针织', '保暖'],
      source: '开发沉淀',
      status: 'ACTIVE',
      governanceOwner: '纱线治理组',
      imageUrl: 'https://picsum.photos/seed/higood-yarn-wool/480/360',
      summary: '面向秋冬系列的标准羊毛混纺纱线主档。',
      notes: '适用于轻商务男装和通勤女装针织类目。',
      createdAt: '2026-03-30 09:10',
      updatedAt: '2026-04-08 16:40',
      updatedBy: '纱线治理专员',
      variants: [
        { name: '推荐色卡', value: '驼色 / 炭灰 / 酒红', note: '季度色卡引用' },
      ],
      references: [
        { styleCode: 'STYLE-20260401-104', styleName: '男装针织上衣', phase: '商品企划', usage: '主纱线', updatedAt: '2026-04-08 11:30' },
      ],
    }),
    seedRecord('yarn', {
      id: 'yarn-polyester-150d',
      archiveCode: 'YRN-260410-004',
      name: '150D涤纶长丝',
      alias: '150D Polyester Filament',
      subCategory: '化纤长丝',
      materialSummary: '100%涤纶 / 150D',
      specSummary: '长丝 / 光泽中等 / 稳定性高',
      fieldA: '100%涤纶 / 150D',
      fieldB: '长丝 / 光泽中等',
      fieldC: '适合里布、拼接和轻功能面料',
      unit: '公斤',
      useScope: '里布、轻外套、运动套装',
      applicableCategories: ['外套', '套装', '运动'],
      processTags: ['功能', '稳定性', '拼接'],
      source: '自建档案',
      status: 'INACTIVE',
      governanceOwner: '纱线治理组',
      imageUrl: 'https://picsum.photos/seed/higood-yarn-poly/480/360',
      summary: '曾用于运动和里布方向，当前已停用，仅保留历史引用追溯。',
      notes: '停用后不可新增引用，但保留历史款式追溯关系。',
      createdAt: '2026-03-25 13:25',
      updatedAt: '2026-04-07 18:05',
      updatedBy: '纱线治理专员',
      variants: [],
      references: [
        { styleCode: 'STYLE-20260328-121', styleName: '休闲薄外套', phase: '历史引用', usage: '里布纱线', updatedAt: '2026-04-01 09:10' },
      ],
    }),
  ],
  consumable: [
    seedRecord('consumable', {
      id: 'consumable-dust-bag',
      archiveCode: 'CON-260410-001',
      name: '透明防尘袋',
      alias: 'Transparent Dust Bag',
      subCategory: '包装耗材',
      materialSummary: 'PE / 半透明',
      specSummary: '45cm × 60cm / 中号',
      fieldA: 'PE / 半透明包装',
      fieldB: '45cm × 60cm / 中号',
      fieldC: '成衣包装与样衣防护',
      unit: '个',
      useScope: '成衣包装、样衣保护、直播备货',
      applicableCategories: ['外套', '连衣裙', '居家'],
      processTags: ['包装', '防尘', '出样'],
      source: '自建档案',
      status: 'ACTIVE',
      governanceOwner: '耗材治理组',
      imageUrl: 'https://picsum.photos/seed/higood-consumable-dustbag/480/360',
      summary: '用于样衣和成衣包装的标准防尘袋主档。',
      notes: '包装耗材主档不维护库存余额，由仓储系统接管。',
      createdAt: '2026-04-02 10:10',
      updatedAt: '2026-04-09 15:15',
      updatedBy: '耗材治理专员',
      variants: [
        { name: '尺码', value: '中号 / 大号', note: '按成衣长度选择' },
      ],
      references: [
        { styleCode: 'STYLE-20260407-025', styleName: '优雅连衣裙', phase: '出样包装', usage: '样衣包装', updatedAt: '2026-04-09 16:40' },
      ],
    }),
    seedRecord('consumable', {
      id: 'consumable-barcode-sticker',
      archiveCode: 'CON-260410-002',
      name: '条码贴',
      alias: 'Barcode Sticker',
      subCategory: '标识耗材',
      materialSummary: '铜版纸 / 覆膜',
      specSummary: '40mm × 25mm / 卷装',
      fieldA: '铜版纸 / 覆膜',
      fieldB: '40mm × 25mm / 卷装',
      fieldC: '吊牌、包装袋和出货箱体贴标',
      unit: '卷',
      useScope: '包装袋、吊牌、箱唛',
      applicableCategories: ['箱包', '饰品', '居家'],
      processTags: ['条码', '标签', '包装'],
      source: '开发沉淀',
      status: 'ACTIVE',
      governanceOwner: '耗材治理组',
      imageUrl: 'https://picsum.photos/seed/higood-consumable-barcode/480/360',
      summary: '统一出样和发货标签的标准条码贴主档。',
      notes: '条码规则由商品编码中心维护，耗材主档只表达贴标对象和规格。',
      createdAt: '2026-04-01 17:40',
      updatedAt: '2026-04-08 17:10',
      updatedBy: '系统配置专员',
      variants: [
        { name: '应用对象', value: '吊牌 / 包装袋 / 箱唛', note: '不同对象使用同一主档' },
      ],
      references: [
        { styleCode: 'STYLE-20260409-111', styleName: '情侣装套装', phase: '出样包装', usage: '吊牌贴标', updatedAt: '2026-04-10 08:30' },
      ],
    }),
    seedRecord('consumable', {
      id: 'consumable-hangtag-card',
      archiveCode: 'CON-260410-003',
      name: '牛皮纸吊牌套卡',
      alias: 'Kraft Hangtag Card',
      subCategory: '品牌耗材',
      materialSummary: '牛皮纸 / 烫金品牌信息',
      specSummary: '55mm × 90mm / 双联卡',
      fieldA: '牛皮纸 / 烫金品牌信息',
      fieldB: '55mm × 90mm / 双联卡',
      fieldC: '品牌信息、尺码贴和洗护信息承载',
      unit: '套',
      useScope: '女装、男装、童装统一品牌吊牌',
      applicableCategories: ['上衣', '外套', '童装'],
      processTags: ['品牌', '吊牌', '烫金'],
      source: '自建档案',
      status: 'ACTIVE',
      governanceOwner: '耗材治理组',
      imageUrl: 'https://picsum.photos/seed/higood-consumable-tag/480/360',
      summary: '用于跨品牌线统一吊牌表达的标准耗材主档。',
      notes: '品牌视觉版本由品牌中心管理，商品中心只管理吊牌载体主档。',
      createdAt: '2026-03-31 09:50',
      updatedAt: '2026-04-10 09:20',
      updatedBy: '品牌运营',
      variants: [
        { name: '品牌线', value: 'Chicmore / Asaya / MODISH', note: '按品牌视觉包引用' },
      ],
      references: [
        { styleCode: 'STYLE-20260405-093', styleName: 'Asaya衬衫', phase: '上新准备', usage: '吊牌信息承载', updatedAt: '2026-04-10 09:35' },
      ],
    }),
    seedRecord('consumable', {
      id: 'consumable-hook-bag',
      archiveCode: 'CON-260410-004',
      name: '陈列挂钩胶袋',
      alias: 'Display Hook Bag',
      subCategory: '陈列耗材',
      materialSummary: 'PE / 自带挂钩封口',
      specSummary: '28cm × 38cm / 小号',
      fieldA: 'PE / 自带挂钩封口',
      fieldB: '28cm × 38cm / 小号',
      fieldC: '配饰、小件辅料和童装陈列包装',
      unit: '个',
      useScope: '饰品、童装、小件配件',
      applicableCategories: ['饰品', '童装', '玩具'],
      processTags: ['陈列', '挂钩', '包装'],
      source: '样衣沉淀',
      status: 'DRAFT',
      governanceOwner: '耗材治理组',
      imageUrl: 'https://picsum.photos/seed/higood-consumable-hook/480/360',
      summary: '用于陈列型包装的小件挂钩胶袋，当前处于试运行草稿状态。',
      notes: '需与视觉陈列规范确认挂钩位置和展示方式。',
      createdAt: '2026-04-07 13:35',
      updatedAt: '2026-04-10 08:40',
      updatedBy: '耗材治理专员',
      variants: [],
      references: [],
    }),
  ],
}

function listInternal(kind: MaterialArchiveKind): MaterialArchiveRecord[] {
  return materialArchiveRepository[kind]
}

export function listMaterialArchiveRecords(kind: MaterialArchiveKind): MaterialArchiveRecord[] {
  return listInternal(kind)
    .slice()
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function getMaterialArchiveRecord(kind: MaterialArchiveKind, id: string): MaterialArchiveRecord | null {
  return listInternal(kind).find((item) => item.id === id) ?? null
}

function createLog(action: string, detail: string, operator: string, time: string): MaterialArchiveLog {
  return {
    id: `${action}-${time}-${Math.random().toString(36).slice(2, 8)}`,
    action,
    detail,
    operator,
    time,
  }
}

export function createMaterialArchiveRecord(kind: MaterialArchiveKind, draft: MaterialArchiveDraft): MaterialArchiveRecord {
  const now = formatDateTime(new Date())
  const record: MaterialArchiveRecord = {
    ...cloneRecord(draft),
    id: `${kind}-${Date.now()}`,
    kind,
    createdAt: now,
    updatedAt: now,
    updatedBy: draft.governanceOwner || '商品中心管理员',
    variants: [],
    references: [],
    logs: [
      createLog('新建档案', `创建${draft.name}主档，并完成基础信息录入。`, draft.governanceOwner || '商品中心管理员', now),
    ],
  }
  listInternal(kind).unshift(record)
  return record
}

export function updateMaterialArchiveRecord(kind: MaterialArchiveKind, id: string, draft: MaterialArchiveDraft): MaterialArchiveRecord | null {
  const record = getMaterialArchiveRecord(kind, id)
  if (!record) return null

  const now = formatDateTime(new Date())
  record.archiveCode = draft.archiveCode
  record.name = draft.name
  record.alias = draft.alias
  record.subCategory = draft.subCategory
  record.materialSummary = draft.materialSummary
  record.specSummary = draft.specSummary
  record.fieldA = draft.fieldA
  record.fieldB = draft.fieldB
  record.fieldC = draft.fieldC
  record.unit = draft.unit
  record.useScope = draft.useScope
  record.applicableCategories = cloneRecord(draft.applicableCategories)
  record.processTags = cloneRecord(draft.processTags)
  record.source = draft.source
  record.status = draft.status
  record.governanceOwner = draft.governanceOwner
  record.imageUrl = draft.imageUrl
  record.summary = draft.summary
  record.notes = draft.notes
  record.updatedAt = now
  record.updatedBy = draft.governanceOwner || '商品中心管理员'
  record.logs.unshift(
    createLog('编辑档案', `更新${draft.name}主档字段，复核规格表达与适用范围。`, record.updatedBy, now),
  )
  return record
}
