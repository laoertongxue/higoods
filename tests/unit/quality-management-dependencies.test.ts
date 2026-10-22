import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_GARMENT_INSPECTION_STANDARD } from '../../src/data/fcs/quality-management-records.ts'
import * as rules from '../../src/data/fcs/quality-management-rules.ts'
import type { AdditionalInspectionStandard, InspectionConfiguration, InspectionStandard } from '../../src/data/fcs/quality-management-types.ts'

const basic = (): InspectionStandard => structuredClone(DEFAULT_GARMENT_INSPECTION_STANDARD)
function extra(id: string, target = 'garment-size-chest', level: AdditionalInspectionStandard['level'] = 'STYLE'): AdditionalInspectionStandard {
  return { ...basic(), id, familyId: id, kind: 'ADDITIONAL', name: id, level, applicability: { sourceKinds: ['PRODUCTION_RETURN'], stages: ['POST_FINISHING_QC'],
    ...(level === 'STYLE' ? { styleIds: ['S1'], styleCategories: ['BASIC'] } : { styleCategories: ['BASIC'] }) }, items: [],
    overrides: [{ targetItemId: target, fields: ['criterion'], values: { criterion: '明确覆盖要求' } }] }
}
const validate = (all: InspectionConfiguration[]) => (rules as any).validateEffectiveInspectionConfigurationSet(all)
test('最终有效基本版本删项或停用，不能借已停用旧版满足仍有效附加依赖', () => {
  const old = basic(), next = { ...basic(), id: 'base-v2', version: 2 }
  next.items = next.items.filter(item => item.id !== 'garment-size-chest')
  assert.throws(() => validate([{ ...old, status: 'DISABLED' }, next, extra('chest')]), /原检查项|依赖/)
  assert.throws(() => validate([{ ...old, status: 'DISABLED' }, extra('chest')]), /原检查项|依赖/)
  assert.doesNotThrow(() => validate([next, { ...extra('chest'), status: 'DISABLED' }]))
})
test('类别附加新增项为指定款提供原项；删项/停用类别须保护更高层仍有效依赖', () => {
  const category = extra('category', '', 'STYLE_CATEGORY'); category.overrides = []
  category.items = [{ id: 'category-added', dimension: '工艺', name: '独立附加项', content: '检查要求', criterion: '标准资料', references: [] }]
  const specific = extra('specific', 'category-added')
  assert.doesNotThrow(() => validate([basic(), category, specific]))
  const removed = { ...category, id: 'category-v2', version: 2, items: [{ ...category.items[0], id: 'different-added' }] }
  assert.throws(() => validate([basic(), { ...category, status: 'DISABLED' }, removed, specific]), /category-added/)
  assert.throws(() => validate([basic(), { ...category, status: 'DISABLED' }, specific]), /category-added/)
  assert.doesNotThrow(() => validate([basic(), { ...category, status: 'DISABLED' }, { ...specific, status: 'DISABLED' }]))
})
test('覆盖不能引用自己、同层或更高层尚未合成的新增项', () => {
  const specific = extra('self', 'own-item'); specific.items = [{ id: 'own-item', dimension: '工艺', name: '新增项', content: '检查', criterion: '明确要求', references: [] }]
  assert.throws(() => validate([basic(), specific]), /own-item/)
  const category = extra('category', 'own-item', 'STYLE_CATEGORY')
  const provider = { ...specific, id: 'provider', familyId: 'provider', overrides: [] }
  assert.throws(() => validate([basic(), category, provider]), /own-item/)
})
test('依赖必须覆盖消费者全部适用来源，不能用一个重叠点替代整个复用范围', () => {
  const production = basic(); production.applicability = { sourceKinds: ['PRODUCTION_RETURN'], stages: ['POST_FINISHING_QC'] }
  const stock = { ...basic(), id: 'stock-basic', familyId: 'stock-basic', applicability: { sourceKinds: ['WAREHOUSE_STOCK' as const], stages: ['WAREHOUSE_STOCK_QC'] } }
  const shared = extra('shared'); shared.applicability = { sourceKinds: ['PRODUCTION_RETURN', 'WAREHOUSE_STOCK'], stages: ['POST_FINISHING_QC', 'WAREHOUSE_STOCK_QC'], styleIds: ['S1'] }
  assert.doesNotThrow(() => validate([production, stock, shared]))
  for(const sourceKind of ['PRODUCTION_RETURN','WAREHOUSE_STOCK'] as const){const resolved=rules.resolveInspectionStandard({basicStandards:[production,stock],additionalStandards:[shared],context:{sourceKind,styleId:'S1'}});assert.equal(resolved.items.find(item=>item.id==='garment-size-chest')?.criterion,'明确覆盖要求')}
  stock.items = stock.items.filter(item => item.id !== 'garment-size-chest')
  assert.throws(() => validate([production, stock, shared]), /garment-size-chest/)
})
test('已知来源只枚举真实默认环节，自定义环节仍按明确复用范围逐一保护依赖',()=>{
 const production=basic();production.applicability={sourceKinds:['PRODUCTION_RETURN'],stages:['POST_FINISHING_QC']}
 const stock=basic();stock.id=stock.familyId='custom-stock';stock.applicability={sourceKinds:['WAREHOUSE_STOCK'],stages:['WAREHOUSE_STOCK_QC','CUSTOM_EXPLICIT_STAGE']}
 const shared=extra('custom-shared');shared.applicability={sourceKinds:['PRODUCTION_RETURN','WAREHOUSE_STOCK'],stages:['POST_FINISHING_QC','WAREHOUSE_STOCK_QC','CUSTOM_EXPLICIT_STAGE'],styleIds:['S1']}
 assert.throws(()=>validate([production,stock,shared]),/garment-size-chest/,'不能忽略自定义环节中尚缺的生产基本标准')
 production.applicability.stages!.push('CUSTOM_EXPLICIT_STAGE');assert.doesNotThrow(()=>validate([production,stock,shared]))
})
test('类别新增项只覆盖其类别，指定款引用时须明确类别条件，不能猜款式所属类别', () => {
  const category = extra('category', '', 'STYLE_CATEGORY'); category.overrides = []; category.items = [{ id: 'category-added', dimension: '工艺', name: '新增项', content: '检查', criterion: '要求', references: [] }]
  const specific = extra('specific', 'category-added'); delete specific.applicability.styleCategories
  assert.throws(() => validate([basic(), category, specific]), /category-added/)
})
test('指定款已有正式类别事实可引用类别新增项，无事实或复用款未全部覆盖仍拒绝',()=>{
 const category=extra('known-category','','STYLE_CATEGORY');category.overrides=[];category.applicability.styleCategories=['P-BASIC'];category.items=[{id:'known-category-added',dimension:'工艺',name:'正式类别新增项',content:'检查',criterion:'要求',references:[]}]
 const specific=extra('known-style','known-category-added');delete specific.applicability.styleCategories;specific.applicability.styleIds=['CODE-1']
 const identities={styleCategories:[['P-BASIC','基础款'],['P-DESIGN','设计款']],styleIds:[['S-1','CODE-1'],['S-2','CODE-2']],styles:[{styleId:'S-1',styleCode:'CODE-1',styleCategories:['P-BASIC']},{styleId:'S-2',styleCode:'CODE-2',styleCategories:['P-DESIGN']}]}
 assert.doesNotThrow(()=>rules.validateEffectiveInspectionConfigurationSet([basic(),category,specific],identities))
 const resolved=rules.resolveInspectionStandard({basicStandards:[basic()],additionalStandards:[category,specific],context:{sourceKind:'PRODUCTION_RETURN',styleId:'S-1',styleCode:'CODE-1',styleCategory:'基础款',styleCategoryAliases:['P-BASIC']}})
 assert.equal(resolved.items.find(item=>item.id==='known-category-added')?.criterion,'明确覆盖要求')
 specific.applicability.styleIds=['CODE-1','CODE-2'];assert.throws(()=>rules.validateEffectiveInspectionConfigurationSet([basic(),category,specific],identities),/known-category-added/)
 specific.applicability.styleIds=['UNKNOWN'];assert.throws(()=>rules.validateEffectiveInspectionConfigurationSet([basic(),category,specific],identities),/known-category-added/)
})
test('本期仅成衣后道/库存的size和color字符串条件可生效，未知属性及产前版条件明确拒绝', () => {
  const itemOnly = basic(); itemOnly.items[0].applicability = { sourceKinds: ['PRODUCTION_RETURN', 'WAREHOUSE_STOCK'], attributes: [{ key: 'size', value: 'M' }] }
  assert.doesNotThrow(() => validate([itemOnly]))
  const unsupported = extra('unknown'); unsupported.overrides[0].applicability = { attributes: [{ key: 'hasButton', value: true }] }
  assert.throws(() => validate([basic(), unsupported]), /不支持|尺码|颜色/)
  const sample = basic(); sample.items[0].applicability = { attributes: [{ key: 'size', value: 'M' }] }
  assert.throws(() => validate([sample]), /产前版|来源/)
  const numeric = extra('numeric'); numeric.overrides[0].applicability = { attributes: [{ key: 'size', value: 38 }] }
  assert.throws(() => validate([basic(), numeric]), /文字|字符串/)
})
test('运行时未知条件不静默跳过；正式类别别名与编号可匹配相同范围', () => {
  assert.throws(() => rules.matchesInspectionApplicability({ attributes: [{ key: 'hasButton', value: true }] }, { sourceKind: 'PRODUCTION_RETURN' }), /不支持/)
  assert.equal(rules.matchesInspectionApplicability({ styleCategories: ['POSITION-BASIC'] }, { sourceKind: 'PRODUCTION_RETURN', styleCategory: '基础款', styleCategoryAliases: ['POSITION-BASIC'] } as any), true)
})

test('同一正式类别的ID与名称、同款ID与款号不能分别发布同层附加标准',()=>{
 const aliases={styleCategories:[['POSITION-BASIC','基础款']],styleIds:[['STYLE-ID','STYLE-CODE']]}
 const a=extra('a','','STYLE_CATEGORY');a.overrides=[];a.items=[{id:'a-item',dimension:'工艺',name:'检查A',content:'检查',criterion:'明确要求',references:[]}];a.applicability.styleCategories=['POSITION-BASIC']
 const b=structuredClone(a);b.id=b.familyId='b';b.items[0].id='b-item';b.applicability.styleCategories=['基础款']
 assert.throws(()=>(rules.validateEffectiveInspectionConfigurationSet as any)([basic(),a,b],aliases),/重叠/)
 const x=extra('x'),y=extra('y');x.applicability.styleIds=['STYLE-ID'];y.applicability.styleIds=['STYLE-CODE']
 assert.throws(()=>(rules.validateEffectiveInspectionConfigurationSet as any)([basic(),x,y],aliases),/重叠/)
})
test('依赖覆盖识别正式类别别名但不把同一款上的不同定位合并',()=>{
 const category=extra('provider','','STYLE_CATEGORY');category.overrides=[];category.applicability.styleCategories=['POSITION-BASIC'];category.items=[{id:'position-check',dimension:'工艺',name:'检查',content:'检查',criterion:'要求',references:[]}]
 const specific=extra('consumer','position-check');specific.applicability.styleCategories=['基础款']
 assert.doesNotThrow(()=>(rules.validateEffectiveInspectionConfigurationSet as any)([basic(),category,specific],{styleCategories:[['POSITION-BASIC','基础款'],['POSITION-DESIGN','设计款']]}))
 specific.applicability.styleCategories=['设计款'];assert.throws(()=>(rules.validateEffectiveInspectionConfigurationSet as any)([basic(),category,specific],{styleCategories:[['POSITION-BASIC','基础款'],['POSITION-DESIGN','设计款']]}),/position-check/)
})
test('未知编号保持原样，同名歧义必须明确正式ID，不猜编号前缀',()=>{
 const a=extra('a'),b=extra('b');a.applicability.styleIds=['unknown-id'];b.applicability.styleIds=['unknown-code']
 assert.doesNotThrow(()=>(rules.validateEffectiveInspectionConfigurationSet as any)([basic(),a,b],{styleIds:[['REAL-ID','REAL-CODE']]}))
 const category=extra('category','','STYLE_CATEGORY');category.overrides=[];category.items=[{id:'known',dimension:'工艺',name:'检查',content:'检查',criterion:'要求',references:[]}];category.applicability.styleCategories=['重名定位']
 assert.throws(()=>(rules.validateEffectiveInspectionConfigurationSet as any)([basic(),category],{styleCategories:[['POSITION-1','重名定位'],['POSITION-2','重名定位']]}),/歧义|不唯一|正式/)
})

test('类别附加以真实多定位同款证明重叠，不传递合并不同款的类别',()=>{
 const category=(id:string,position:string)=>{const row=extra(id,'','STYLE_CATEGORY');row.overrides=[];row.applicability.styleCategories=[position];row.items=[{id:'item-'+id,dimension:'工艺',name:'检查',content:'检查',criterion:'要求',references:[]}];return row}
 const identities={styleCategories:[['P-A','类别A'],['P-B','类别B'],['P-C','类别C']],styleIds:[['S-1','CODE-1'],['S-2','CODE-2']],styles:[{styleId:'S-1',styleCode:'CODE-1',styleCategories:['P-A','P-B']},{styleId:'S-2',styleCode:'CODE-2',styleCategories:['P-B','P-C']}]}
 assert.throws(()=>(rules.validateEffectiveInspectionConfigurationSet as any)([basic(),category('a','类别A'),category('b','类别B')],identities),/重叠/)
 assert.doesNotThrow(()=>(rules.validateEffectiveInspectionConfigurationSet as any)([basic(),category('a','类别A'),category('c','类别C')],identities))
 const unknown={...identities,styles:[]};assert.doesNotThrow(()=>(rules.validateEffectiveInspectionConfigurationSet as any)([basic(),category('a','类别A'),category('b','类别B')],unknown))
})


test('未使用的重名款号不阻断无关配置，明确使用该款号才要求唯一身份',()=>{
 const identities={styleIds:[['S1','DUPLICATED-CODE'],['S2','DUPLICATED-CODE']],styles:[{styleId:'S1',styleCode:'DUPLICATED-CODE',styleCategories:['BASIC']},{styleId:'S2',styleCode:'DUPLICATED-CODE',styleCategories:['BASIC']}]}
 assert.doesNotThrow(()=>(rules.validateEffectiveInspectionConfigurationSet as any)([basic()],identities))
 const ambiguous=extra('ambiguous');ambiguous.applicability.styleIds=['DUPLICATED-CODE']
 assert.throws(()=>(rules.validateEffectiveInspectionConfigurationSet as any)([basic(),ambiguous],identities),/歧义/)
})

test('FR-FINAL-02 基本原项仅M码时不能发布L码覆盖，M码有效覆盖保留其他项目', () => {
  const provider = basic()
  const chest = provider.items.find(item => item.id === 'garment-size-chest')!
  chest.applicability = { sourceKinds: ['PRODUCTION_RETURN'], attributes: [{ key: 'size', value: 'M' }] }
  const consumer = extra('size-dependent')
  consumer.overrides[0].applicability = { attributes: [{ key: 'size', value: 'L' }] }
  // 该L码项目在原基本标准中确实不存在；整份基本标准适用L不能替它提供原项。
  const originalL = rules.resolveInspectionStandard({ basicStandards: [provider], additionalStandards: [], context: { sourceKind: 'PRODUCTION_RETURN', styleId: 'S1', attributes: { size: 'L' } } })
  assert.equal(originalL.items.some(item => item.id === chest.id), false)
  assert.throws(() => validate([provider, consumer]), /原检查项|依赖/)
  assert.throws(() => rules.validateInspectionConfiguration({ ...consumer, status: 'DRAFT' }, [provider]), /原检查项|依赖/)
  consumer.overrides[0].applicability.attributes![0].value = 'M'
  assert.doesNotThrow(() => validate([provider, consumer]))
  const resolved = rules.resolveInspectionStandard({ basicStandards: [provider], additionalStandards: [consumer], context: { sourceKind: 'PRODUCTION_RETURN', styleId: 'S1', styleCategory: 'BASIC', attributes: { size: 'M' } } })
  assert.equal(resolved.items.find(item => item.id === chest.id)?.criterion, '明确覆盖要求')
  assert.equal(resolved.items.find(item => item.id === 'garment-size-length')?.criterion, provider.items.find(item => item.id === 'garment-size-length')!.criterion)
})

test('FR-FINAL-02 类别新增原项的项目条件也限定指定款覆盖依赖，不能借整份类别范围扩大', () => {
  const category = extra('item-conditional-category', '', 'STYLE_CATEGORY')
  category.overrides = []
  category.items = [{ id: 'category-m-only', dimension: '工艺', name: 'M码独立要求', content: '只检查M码', criterion: '原要求', references: [], applicability: { attributes: [{ key: 'size', value: 'M' }] } }]
  const specific = extra('item-conditional-specific', 'category-m-only')
  specific.overrides[0].applicability = { attributes: [{ key: 'size', value: 'L' }] }
  assert.throws(() => validate([basic(), category, specific]), /category-m-only/)
  specific.overrides[0].applicability.attributes![0].value = 'M'
  assert.doesNotThrow(() => validate([basic(), category, specific]))
  const resolved = rules.resolveInspectionStandard({ basicStandards: [basic()], additionalStandards: [category, specific], context: { sourceKind: 'PRODUCTION_RETURN', styleId: 'S1', styleCategory: 'BASIC', attributes: { size: 'M' } } })
  assert.equal(resolved.items.find(item => item.id === 'category-m-only')?.criterion, '明确覆盖要求')
})

test('FR-FINAL-02 原项范围收窄后最终有效集合须拒绝仍依赖更广范围的附加', () => {
  const before = basic(), consumer = extra('whole-range-dependent')
  assert.doesNotThrow(() => validate([before, consumer]))
  const next = structuredClone(before)
  next.id = 'narrowed-base-v2'; next.version = 2
  next.items.find(item => item.id === 'garment-size-chest')!.applicability = { sourceKinds: ['PRODUCTION_RETURN'], attributes: [{ key: 'size', value: 'M' }] }
  assert.throws(() => validate([{ ...before, status: 'DISABLED' }, next, consumer]), /garment-size-chest/)
})

test('FR-FINAL-03 指定款同层唯一不能用不同尺码或颜色拆成两份有效附加', () => {
  for (const key of ['size', 'color']) {
    const a = extra(`${key}-a`), b = extra(`${key}-b`)
    a.applicability.attributes = [{ key, value: key === 'size' ? 'M' : '红色' }]
    b.applicability.attributes = [{ key, value: key === 'size' ? 'L' : '蓝色' }]
    assert.throws(() => validate([basic(), a, b]), /重叠/, `${key}只细分项目，不能解除款级同层唯一`)
    assert.throws(() => rules.validateInspectionConfiguration({ ...b, status: 'DRAFT' }, [basic(), a]), /重叠/)
  }
})

test('FR-FINAL-03 正式类别别名/同款ID别名在不同SKU条件下仍不能发布同层两份', () => {
  const identities = { styleCategories: [['P-BASIC', '基础款']], styleIds: [['S1', 'CODE-1']], styles: [{ styleId: 'S1', styleCode: 'CODE-1', styleCategories: ['P-BASIC'] }] }
  const a = extra('category-m', '', 'STYLE_CATEGORY'); a.overrides = []
  a.items = [{ id: 'category-m-item', dimension: '工艺', name: '新增要求', content: '检查', criterion: '要求', references: [] }]
  a.applicability.styleCategories = ['P-BASIC']; a.applicability.attributes = [{ key: 'size', value: 'M' }]
  const b = structuredClone(a); b.id = b.familyId = 'category-l'; b.applicability.styleCategories = ['基础款']; b.applicability.attributes![0].value = 'L'
  assert.throws(() => rules.validateEffectiveInspectionConfigurationSet([basic(), a, b], identities), /重叠/)
  const x = extra('style-m'), y = extra('style-l')
  delete x.applicability.styleCategories; delete y.applicability.styleCategories
  x.applicability.styleIds = ['S1']; y.applicability.styleIds = ['CODE-1']
  x.applicability.attributes = [{ key: 'size', value: 'M' }]; y.applicability.attributes = [{ key: 'size', value: 'L' }]
  assert.throws(() => rules.validateEffectiveInspectionConfigurationSet([basic(), x, y], identities), /重叠/)
})

test('FR-FINAL-03 款级附加唯一仍尊重不同来源环节和不同款，基本标准条件交集规则不扩大', () => {
  const a = extra('scope-production'), b = extra('scope-stock')
  a.applicability.attributes = [{ key: 'size', value: 'M' }]
  b.applicability = { sourceKinds: ['WAREHOUSE_STOCK'], stages: ['WAREHOUSE_STOCK_QC'], styleIds: ['S1'], attributes: [{ key: 'size', value: 'L' }] }
  assert.doesNotThrow(() => validate([basic(), a, b]))
  const otherStyle = extra('other-style'); otherStyle.applicability.styleIds = ['S2']; delete otherStyle.applicability.styleCategories
  otherStyle.applicability.attributes = [{ key: 'size', value: 'L' }]
  assert.doesNotThrow(() => validate([basic(), a, otherStyle]))
  const m = basic(); m.applicability = { sourceKinds: ['PRODUCTION_RETURN'], stages: ['POST_FINISHING_QC'], attributes: [{ key: 'size', value: 'M' }] }
  const l = structuredClone(m); l.id = l.familyId = 'basic-l'; l.applicability.attributes![0].value = 'L'
  assert.doesNotThrow(() => validate([m, l]), '本次不能把附加款级唯一未经确认扩展到基本标准')
})
