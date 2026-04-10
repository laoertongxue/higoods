export type ConfigStatus = 'ENABLED' | 'DISABLED'

export type FlatDimensionId =
  | 'brands'
  | 'crowdPositioning'
  | 'ages'
  | 'crowds'
  | 'productPositioning'
  | 'specialCrafts'
  | 'sizes'
  | 'trendElements'
  | 'fabrics'
  | 'styles'
  | 'categories'
  | 'colors'
  | 'styleCodes'

export interface ConfigLog {
  id: string
  action: string
  detail: string
  operator: string
  time: string
}

export interface ConfigOption {
  id: string
  code: string
  name_zh: string
  name_en?: string
  status: ConfigStatus
  sortOrder: number
  updatedAt: string
  updatedBy: string
  logs: ConfigLog[]
}

export interface FlatDimensionMeta {
  id: FlatDimensionId
  name: string
  description: string
}

export const FLAT_DIMENSION_META: FlatDimensionMeta[] = [
  { id: 'brands', name: '品牌', description: '维护品牌主数据、展示口径和启停状态' },
  { id: 'crowdPositioning', name: '人群定位', description: '维护品牌或商品的人群定位标签' },
  { id: 'ages', name: '年龄', description: '维护商品适配年龄带配置' },
  { id: 'crowds', name: '人群', description: '维护人群分层和营销标签' },
  { id: 'productPositioning', name: '商品定位', description: '维护商品价格带与设计定位' },
  { id: 'specialCrafts', name: '特殊工艺', description: '维护工艺标签和设计工法' },
  { id: 'sizes', name: '尺码', description: '维护尺码标准与展示顺序' },
  { id: 'trendElements', name: '流行元素', description: '维护趋势元素与版型标签' },
  { id: 'fabrics', name: '面料', description: '维护商品主面料与材质标签' },
  { id: 'styles', name: '风格', description: '维护风格标签与商品风格池' },
  { id: 'categories', name: '品类', description: '维护销售品类和展示分组' },
  { id: 'colors', name: '颜色', description: '维护颜色值、色卡别名和展示顺序' },
  { id: 'styleCodes', name: '风格编号', description: '维护风格编号映射和命名口径' },
]

const BRANDS = [
  'Chicmore',
  'FADFAD',
  'Tendblank',
  'Asaya',
  'LUXME',
  'MODISH',
  'PRIMA',
]

const CROWD_POSITIONING = ['穆斯林', '穆斯林友好', '非穆斯林']

const AGES = ['18~30', '25~45', '45~65']

const CROWDS = ['年轻', '成熟', '中老年']

const PRODUCT_POSITIONING = ['基础款', '设计款', '设计改款', '低价改款', '低价']

const SPECIAL_CRAFTS = ['绣花', '激光切', '烫画', '直喷', '贝壳绣', '四合扣', '打条', '打揽', '压褶']

const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'One Size']

const TREND_ELEMENTS = [
  'boho',
  '动物纹',
  '撞色',
  '扎染',
  '渐变',
  '拼接',
  '图腾',
  '刺绣',
  '料',
  '条纹',
  '蕾丝',
  '流苏',
  '棉麻',
  '牛仔',
  '缎面',
  'A字型',
  'H型',
  'X型',
  'S型',
  '0型',
  '不对称',
  '两件套',
  '运动',
  '波点',
  '素色',
  '丝绒',
  '彩色',
  '字母',
  '不规则',
  '百褶',
  '泡泡袖',
]

const FABRICS = [
  '混纺',
  '涤纶',
  '呢料',
  '棉麻',
  '针织',
  '雪纺',
  '锻面',
  '棉',
  '仿牛仔',
  '蕾丝',
  '牛仔',
  '丝绒',
  '灯芯绒',
  '弹力布',
  '绒面',
  '鹿皮绒',
  'PU皮',
  '毛织',
  '皮草',
  '麂皮',
  '网纱',
  '羊羔毛',
  '法兰绒',
  '竹节麻',
]

const STYLES = ['休闲', '度假', '复古', '秀场', '礼服', '名媛', '通勤', '街头', '中式', '碎花', '性感', '优雅', '甜美']

const CATEGORIES = [
  '上衣',
  '连衣裙',
  '半裙',
  '裤子',
  '套装',
  '开衫',
  '短裙',
  '中长裙',
  '长裙',
  '外套',
  '毛衣',
  '连体裤',
  '马甲',
  '卫衣',
  '饰品',
  '男装外套',
  '男装上衣',
  '男装裤子',
  '男装套装',
  '鞋子',
  '泳装',
  '男鞋',
  '女鞋',
  '居家',
  '童装',
  '童鞋',
  '玩具',
  '数码',
  '睡衣',
  '箱包',
  '美妆+工具',
  '内衣',
  '假发',
  '女性护理',
  '宠物用品',
]

const COLORS = [
  'Rose',
  'Pink',
  'Yellow',
  'Lemon Yellow',
  'Orange',
  'Blue',
  'Green',
  'Chartreuse',
  'Purple',
  'Black',
  'White',
  'Gold',
  'Silver',
  'Khaki',
  'Apricot',
  'Brown',
  'Gray',
  'Camouflage',
  'Multicolor',
  'Same As Photo',
  'Leopard',
  'Dark blue',
  'Light blue',
  'Dark green',
  'Light green',
  'Beige',
  'Wine red',
  'Coffee',
  'champagne',
  'Deep brown',
  'Camel',
  'Caramel',
  'Dark gray',
  'Brick red',
  'Light gray',
  'Red',
  'Navy blue',
  'ZTJ339-1#',
  'ZTJ339-3#',
  'ZTJ339-4#',
  'ZTJ339-2#',
  'Light Pink',
  'Slot peep',
  'Fine hole peep',
  'Rose gold',
  'White colorhair',
  'Green colorhair',
  'Black colorhair',
  'Brown colorhair',
  'Nude',
  'black step feet',
  'nude step feet',
  'black tights',
  'nude tights',
  'ArmyGreen',
  'Red Painting',
  'White Painting',
  'Black Painting',
  'Right hand black',
  'Left hand black',
  'Light coffee',
  'Dark coffee',
  'White & Black ShuangPin',
  'Black & White Shuangpin',
  'Fruit green',
  'Light purple',
  'Brown short',
  'Brown long',
  'Black short',
  'Black long',
  'Grey short',
  'Grey long',
  'Grey stripes',
  'Red stripes',
  'Grey Short Sleeve dress',
  'Dark grey1',
  'Dark grey2',
  'Blue1',
  'Blue2',
  'Army green1',
  'Army green2',
  'green+purple',
  'Black dress',
  'Skirt （single piece）',
  'Cardigan + Print Top （2 pieces）',
  'winered',
]

const STYLE_CODES = [
  '1-Casul Shirt-18-30休闲衬衫',
  '2-prin shirt-18-30印花衬衫',
  '3-Sweet Blouse-18-30设计上衣',
  '4-Short Sleeve Top-18-35短袖上衣',
  '5-print top-25-45印花上衣',
  '6-long shirt-25-45长款衬衫',
  '7-Office Blouse-25-45通勤衬衫',
  '8-Classic Blouse-25-45印花衬衫',
  '9-Print Shirt-45-60长款衬衫',
  '10-print shirt-45-60印花衬衫',
  '11-knit top-18-30针织上衣',
  '12-Casual Set-18-30休闲套装',
  '13-Preppy Dress-18-30学院风连衣裙',
  '14-muslim dress-18-30穆斯林连衣裙',
  '15-mini dress-18-30娃娃裙',
  '16-Preppy Dress-18-30简约连衣裙',
  '17-Classic Dress-18-30长袖连衣裙',
  '18-Classic Dress-18-30短袖连衣裙',
  '19-Asaya print dress-30-45 平价印花连衣裙',
  '20-Elegant Dress-30-45优雅连衣裙',
  '21-Elegant Dress-30-45短袖连衣裙',
  '22-Casual Dress-30-45休闲连衣裙',
  '23-sexy dress-30-45性感连衣裙',
  '24-short dress-30-45短款连衣裙',
  '25- OL dress-30-45通勤连衣裙',
  '26-Loose dress-40-60宽松连衣裙',
  '27-Casual Set-30-55休闲套装',
  '28-Office Set-30-45通勤套装&连体裤',
  '29-print set jumpsuit-30-45印花套装&连体裤',
  '30-Sweet Set-18-30搭配套装',
  '31-Sweet Set-18-30优雅套装',
  '32- fashion set-30-45时尚套装',
  '33- print set-45-60休闲套装',
  '34-Jeans-牛仔裤',
  '35-coat-外套',
  '36-basic clothing-基础打底',
  '37-lace top-蕾丝上衣',
  '38-senior dress-高级连衣裙',
  '39-denim Jacket-牛仔外套',
  '40-set-高价套装',
  '41-Basic top-女士基础上衣',
  '42-Women T-shirt-女士T恤',
  '43-Sweatshirt-女士卫衣',
  '45-Skirt-18-30-半裙',
  '46-穆斯林高价长袍',
  '47-Pajamas-睡衣',
  '48-Casul Shirt-30-45宽松衬衫',
  '49-Classic Top-18-30穆斯林设计上衣',
  '50-muslim OL shirt-25-45穆斯林通勤上衣',
  '51-muslim long shirt-45-60穆斯林长款衬衫',
  '52-muslim knit top-18-30穆斯林针织上衣',
  '53-muslim knit cardigan-18-30穆斯林针织开衫',
  '54-knit cardigan-18-30针织开衫',
  '55-Casual Dress-18-30休闲连衣裙',
  '56-muslim casual set-30-55穆斯林休闲套装',
  '57-muslim OL-30-55穆斯林通勤服饰',
  '58-muslim casual shirt-18-30穆斯林休闲衬衫',
  '59-muslim abaya-30-45高价穆斯林传统服饰',
  "60-Men's basic T-shirt-男装基础T恤",
  '61-design shirt-25-45设计衬衫',
  '62-elegant top-25-45设计上衣',
  '63-Short Sleeve Lace Top-25-45短袖蕾丝上衣',
  '65-Short Sleeve Top-25-45短袖上衣',
  '66-Casual Shirt-25-45休闲衬衫',
  '67-Traditional Muslim top-18-30-传统穆斯林上衣',
  '68-Traditional Muslim Dress-25-35-传统穆斯林连衣裙',
  '69-Traditional Muslim Tunic-30-55-传统穆斯林上衣',
  '70-Traditional Muslim Abaya-25-45',
  "71-Business Men's Wear-轻商务男装",
  '72- Classic Top-18-35纯色上衣',
  '73- Plain-colored Top-35-55-纯色上衣',
  '74-Casual Skirt-18-35休闲半裙',
  '75-casual skirt-35-55休闲半裙',
  '76-simple pants-18-35简约裤子',
  '77-casual pants-35-55简约裤子',
  '78-simple T-shirt-18-35简约T恤',
  '79-loose T-shirt-35-55宽松T恤',
  '80-Printed Blouse-35-55印花上衣',
  '81-print skirt-18-35印花半裙',
  '82-print skirt-35-55印花半裙',
  '83-Solid robe-18-35纯色长袍',
  '84-solid robe-35-55纯色长袍',
  '85-asaya pajamas-18-35-低价睡衣',
  '86-OL skirt-通勤半裙',
  '90-fadfad basic clothing-超级基础女装',
  '91-Casual Blouse-18-35休闲衬衫',
  '92-Printed Tunik-35-55印花长款上衣',
  '87-Casual Set-18-35休闲套装',
  '88-Sweet Set-18-35印花套装',
  '89-Printed Set-35-55印花套装',
  '93-Asaya shirt-20-45衬衫',
  '94-Casaul Dress-35-55休闲长裙',
  '95-Asaya dress-18-30-年轻印花长裙',
  '96-Asaya night dress-30-55睡衣',
  '97-Modern Gamis -25-35日常穆斯林长裙',
  '98-Sarimbit-30-45穆斯林家庭装',
  '99-casual pants-休闲裤子',
  '100-Basic NU裸感基础款',
  '101-Cloudsoft云感基础款',
  '102-Basic Nature户外基础款',
  "103-Men's polo-男装polo",
  "104-Men's basic & micro-design knitwear-男装针织",
  "105-men's shirts-男装衬衫",
  "106-Men's hoodies-男装卫衣",
  "107-men's jacket&coat-男装外套",
  "108-Men's trousers-男装长裤",
  "109-Men's shorts-男装短裤",
  "110-Men's suits-男装套装",
  '111-couple outfit-25-35情侣装',
  '112-Printed short-sleeved shirt-30-55印花短袖衬衫',
  '113-Design T-shirts-25-45设计T恤',
  '118-Office Vest-25-35通勤马甲',
  '120-Casual Tshirt-18-30休闲t恤',
  '121-Casual Jacket-18-30休闲薄外套',
  '122-Sweet Skirt-18-30设计半裙',
  '123-Sweet Top-18-30设计针织上衣',
]

const OPERATOR_POOL = ['商品中心管理员', '系统配置专员', '商品企划', '类目治理负责人']

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function createAuditTrail(dimensionName: string, itemName: string, seed: number): Pick<ConfigOption, 'updatedAt' | 'updatedBy' | 'logs'> {
  const baseTime = new Date('2026-03-24T09:00:00+08:00')
  const logTimes = [seed * 11, seed * 11 + 56, seed * 11 + 128].map((hourOffset) => {
    const next = new Date(baseTime)
    next.setHours(next.getHours() + hourOffset)
    return next
  })

  const logs: ConfigLog[] = [
    {
      id: `log-${seed}-1`,
      action: '初始化配置',
      detail: `完成${dimensionName}「${itemName}」的初始化建档，补齐基础展示信息。`,
      operator: OPERATOR_POOL[seed % OPERATOR_POOL.length],
      time: formatDateTime(logTimes[0]),
    },
    {
      id: `log-${seed}-2`,
      action: '补充维护',
      detail: `复核${dimensionName}「${itemName}」排序与展示口径，确保前台展示一致。`,
      operator: OPERATOR_POOL[(seed + 1) % OPERATOR_POOL.length],
      time: formatDateTime(logTimes[1]),
    },
    {
      id: `log-${seed}-3`,
      action: '配置复核',
      detail: `确认${dimensionName}「${itemName}」启用状态，并留存维度维护日志。`,
      operator: OPERATOR_POOL[(seed + 2) % OPERATOR_POOL.length],
      time: formatDateTime(logTimes[2]),
    },
  ]

  const latestLog = logs[logs.length - 1]

  return {
    updatedAt: latestLog.time,
    updatedBy: latestLog.operator,
    logs,
  }
}

function buildCode(index: number): string {
  return String(index + 1)
}

function buildAlias(dimensionId: FlatDimensionId, value: string): string {
  if (dimensionId === 'styleCodes') {
    return ''
  }

  return /[A-Za-z]/.test(value) ? value : ''
}

function createDimensionOptions(
  dimensionId: FlatDimensionId,
  dimensionName: string,
  values: string[],
): ConfigOption[] {
  return values.map((value, index) => {
    const seed = index + 1 + dimensionName.length * 3
    const audit = createAuditTrail(dimensionName, value, seed)

    return {
      id: `${dimensionId}-${index + 1}`,
      code: buildCode(index),
      name_zh: value,
      name_en: buildAlias(dimensionId, value),
      status: 'ENABLED',
      sortOrder: index + 1,
      updatedAt: audit.updatedAt,
      updatedBy: audit.updatedBy,
      logs: audit.logs,
    }
  })
}

export function createInitialConfigData(): Record<FlatDimensionId, ConfigOption[]> {
  return {
    brands: createDimensionOptions('brands', '品牌', BRANDS),
    crowdPositioning: createDimensionOptions('crowdPositioning', '人群定位', CROWD_POSITIONING),
    ages: createDimensionOptions('ages', '年龄', AGES),
    crowds: createDimensionOptions('crowds', '人群', CROWDS),
    productPositioning: createDimensionOptions('productPositioning', '商品定位', PRODUCT_POSITIONING),
    specialCrafts: createDimensionOptions('specialCrafts', '特殊工艺', SPECIAL_CRAFTS),
    sizes: createDimensionOptions('sizes', '尺码', SIZES),
    trendElements: createDimensionOptions('trendElements', '流行元素', TREND_ELEMENTS),
    fabrics: createDimensionOptions('fabrics', '面料', FABRICS),
    styles: createDimensionOptions('styles', '风格', STYLES),
    categories: createDimensionOptions('categories', '品类', CATEGORIES),
    colors: createDimensionOptions('colors', '颜色', COLORS),
    styleCodes: createDimensionOptions('styleCodes', '风格编号', STYLE_CODES),
  }
}
