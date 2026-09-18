/** Local prototype configuration. Published versions here never write to an online system. */
export interface TimingRule {
  id: string; name: string; work: string; region: string; supplyMode: string; process: string;
  route: string; minQty: number; maxQty: number | null; days: number | null;
  priority: number; state: 'Mock 已发布' | '候选待确认' | '停用'; startEvent: string; endEvent: string;
  unit: string; source: string; pending: string;
}
export interface RuleSample { work: string; region: string; supplyMode: string; process: string; route: string; quantity: number; unit: string }
/** Explicit local linkage. Source facts remain owned by the original business page. */
export interface TaskWorkRuleMapping {
  id:string; taskId:string; nodeId:string; facts:RuleSample;
  sourceDocumentType:string; sourceDocumentId:string; sourceEntryId?:string;
  startEvent:string; endEvent:string; startAnchor:'actualStartAt'|'actualReadyAt'|'taskStartedAt';
  endAnchor:'actualEndAt'; source:string;
}
export interface EventMapping {
  id: string; work: string; system: string; document: string; relationKey: string;
  granularity: string; startEvent: string; endEvent: string; quantityField: string;
  unitField: string; stateTranslation: string; dedupKey: string;
}
export interface MappingSample { system:string; document:string; event:string; eventId:string; attributes:Record<string,string|number> }
export function matchEventMapping(mapping:EventMapping,sample:MappingSample,seenEventIds:string[]=[]):{state:'命中'|'未命中'|'重复事件';message:string} {
  if(seenEventIds.includes(sample.eventId))return {state:'重复事件',message:`事件 ${sample.eventId} 已读取，不重复累计数量。`}
  if(!mapping.system.split('/').map(value=>value.trim()).includes(sample.system)||!mapping.document.split('+').map(value=>value.trim()).includes(sample.document))return {state:'未命中',message:'来源系统或单据类型与映射不符。'}
  if(sample.event!==mapping.endEvent)return {state:'未命中',message:`当前事件“${sample.event}”不是完成事件“${mapping.endEvent}”，不能把到仓或出库当作工厂完成实收。`}
  const required=[...mapping.relationKey.split('+').map(value=>value.trim()),mapping.quantityField,mapping.unitField]
  const absent=required.filter(key=>sample.attributes[key]===undefined||sample.attributes[key]==='')
  if(absent.length)return {state:'未命中',message:`缺少 ${absent.join('、')}，关联待处理，不按 SPU 或最后一张单猜测。`}
  const quantity=Number(sample.attributes[mapping.quantityField])
  if(!Number.isFinite(quantity)||quantity<0)return {state:'未命中',message:'数量不是有效非负数，须回来源确认。'}
  return {state:'命中',message:`匹配 ${mapping.work}，事件 ${sample.eventId}，本次有效数量 ${quantity} ${sample.attributes[mapping.unitField]}；按关联键保留明细和批次。`}
}
export interface ResponsibilityRule { id: string; work: string; team: string; owner: string; receiver: string; coordinator: string; effectiveAt: string }
export interface DependencyRule { id: string; name: string; days: number; predecessors: string[]; unit: string; inputSku: string; outputSku: string; releaseMode: string; releaseQty: number; qualifiedOnly: boolean }
export interface StageRule { id: string; name: string; order: number; capDays: number | null; startEvent: string; endEvent: string }
export interface WorkDefinition { id: string; stage: string; name: string; condition: string; anchors: string; team: string; rule: string; reuse: string }
export interface RiskRule { nearDueDays: number; staleDays: number; escalationDays: number; predictionSource: string; dayMode: '连续24小时自然日'; timezone: string }
export interface ConfigurationDraft {
  stages: StageRule[]; works: WorkDefinition[]; rules: TimingRule[]; mappings: EventMapping[];
  taskWorkMappings?: TaskWorkRuleMapping[];
  responsibilities: ResponsibilityRule[]; dependencies: DependencyRule[];
  group: { name: string; capDays: number; mode: '子项网络' | '组代理'; proxyDays: number };
  risk: RiskRule;
}
export interface ConfigIssue { code: string; severity: '阻断' | '提示'; message: string }
export interface TaskBaseline { id: string; ruleVersion: string; baselineDueAt: string | null; effectiveDueAt: string | null; businessState: string }
export interface PublicationImpact { taskId: string; previousVersion: string; nextVersion: string; baselineDueAt: string | null; effectiveDueAt: string | null; action: string }

const eqOrAny = (value: string, sample: string) => value === '全部' || value === sample

export function matchTimingRules(rules: TimingRule[], sample: RuleSample): { state: '命中' | '未命中' | '冲突' | '输入无效'; matches: TimingRule[]; message: string } {
  if (!Number.isFinite(sample.quantity) || sample.quantity < 0) return { state:'输入无效',matches:[],message:'数量必须为非负数，不能用空值或负数匹配规则。' }
  const candidates = rules.filter(rule => rule.state === 'Mock 已发布' && rule.days !== null && rule.work === sample.work
    && eqOrAny(rule.region, sample.region) && eqOrAny(rule.supplyMode, sample.supplyMode)
    && eqOrAny(rule.process, sample.process) && eqOrAny(rule.route, sample.route)
    && rule.unit === sample.unit && sample.quantity >= rule.minQty && (rule.maxQty === null || sample.quantity <= rule.maxQty))
  if (!candidates.length) return { state:'未命中',matches:[],message:'无可用规则：标准待配置，不按 0 天或默认通用值补齐。候选规则不参与正式匹配。' }
  const priority = Math.min(...candidates.map(rule => rule.priority))
  const matches = candidates.filter(rule => rule.priority === priority)
  return matches.length === 1
    ? { state:'命中',matches,message:`命中 ${matches[0].id}，要求 ${matches[0].days} 个自然日；优先级 ${priority}。` }
    : { state:'冲突',matches,message:`同优先级 ${priority} 命中 ${matches.length} 条规则，阻断试算与发布，不能任意取一条。` }
}

function overlaps(a: TimingRule, b: TimingRule): boolean {
  return a.work === b.work && a.priority === b.priority && a.unit === b.unit
    && ['region','supplyMode','process','route'].every(key => {
      const field = key as 'region'|'supplyMode'|'process'|'route'
      return a[field] === '全部' || b[field] === '全部' || a[field] === b[field]
    }) && Math.max(a.minQty,b.minQty) <= Math.min(a.maxQty ?? Infinity,b.maxQty ?? Infinity)
}

export function dependencySpan(nodes: DependencyRule[]): { days: number | null; finishes: Record<string,number>; cycle: string[]; missing: string[] } {
  const lookup = new Map(nodes.map(node => [node.id,node]))
  const finishes: Record<string,number> = {}; const visiting: string[] = []; const cycles = new Set<string>(); const missing = new Set<string>()
  function finish(id: string): number {
    if (id in finishes) return finishes[id]
    const node = lookup.get(id)
    if (!node) { missing.add(id); return NaN }
    if (visiting.includes(id)) { visiting.slice(visiting.indexOf(id)).forEach(key => cycles.add(key)); return NaN }
    visiting.push(id)
    const result = Math.max(0,...node.predecessors.map(finish)) + node.days
    visiting.pop(); finishes[id] = result; return result
  }
  nodes.forEach(node => finish(node.id))
  const days = Math.max(0,...Object.values(finishes))
  return { days:Number.isFinite(days) && !cycles.size && !missing.size ? days : null, finishes,cycle:[...cycles],missing:[...missing] }
}

export function validateConfiguration(draft: ConfigurationDraft): ConfigIssue[] {
  const issues: ConfigIssue[] = []; const block = (code: string,message: string) => issues.push({code,severity:'阻断',message})
  const active = draft.rules.filter(rule => rule.state === 'Mock 已发布')
  active.forEach((rule,index) => {
    if (rule.days === null || !Number.isFinite(rule.days) || rule.days < 0) block('SLA_MISSING',`${rule.id} 缺少有效的自然日预算。`)
    if (!Number.isFinite(rule.minQty) || rule.minQty < 0 || (rule.maxQty !== null && (!Number.isFinite(rule.maxQty) || rule.maxQty < rule.minQty))) block('QUANTITY_RANGE',`${rule.id} 数量档无效。`)
    if (!rule.startEvent.trim() || !rule.endEvent.trim()) block('ANCHOR_MISSING',`${rule.id} 起止事件不完整。`)
    if (![1,2,3,4].includes(rule.priority)) block('PRIORITY_INVALID',`${rule.id} 匹配优先级必须为 1–4。`)
    if (rule.priority === 1 && !rule.source.trim()) block('EXCEPTION_EVIDENCE',`${rule.id} 特批必须有明确依据。`)
    active.slice(index+1).filter(other => overlaps(rule,other)).forEach(other => block('RULE_CONFLICT',`${rule.id} 与 ${other.id} 条件及数量档重叠，同优先级冲突。`))
  })
  draft.mappings.forEach(mapping => { if ([mapping.relationKey,mapping.dedupKey,mapping.startEvent,mapping.endEvent,mapping.quantityField,mapping.unitField].some(value => !value.trim())) block('MAPPING_MISSING',`${mapping.id} 关联、去重、数量单位或事件字段缺失。`) })
  draft.responsibilities.forEach(rule => { if (!rule.team.trim() || !rule.owner.trim()) block('OWNER_MISSING',`${rule.id} 主责任团队或人员缺失，必须待指派。`) })
  draft.stages.forEach(stage => { if (stage.capDays !== null && (!Number.isFinite(stage.capDays) || stage.capDays < 0)) block('STAGE_CAP',`${stage.id} 阶段上限无效。`) })
  const span = dependencySpan(draft.dependencies)
  if (span.cycle.length) block('DEPENDENCY_CYCLE',`依赖存在循环：${span.cycle.join(' → ')}。`)
  if (span.missing.length) block('DEPENDENCY_MISSING',`依赖引用不存在的工作：${span.missing.join('、')}。`)
  draft.dependencies.forEach(node => {
    if (!Number.isFinite(node.days) || node.days < 0) block('DEPENDENCY_DURATION',`${node.id} 预算无效。`)
    if (!Number.isFinite(node.releaseQty) || node.releaseQty <= 0) block('RELEASE_QUANTITY',`${node.id} 放行门槛须大于 0。`)
    if (!node.qualifiedOnly) block('QUALITY_RELEASE',`${node.id} 必须以合格数量放行。`)
    node.predecessors.forEach(id => {
      const predecessor = draft.dependencies.find(item => item.id === id)
      if (predecessor && predecessor.unit !== node.unit) block('UNIT_MISMATCH',`${id} → ${node.id} 单位不一致，未提供有效换算，不能放行。`)
      if (predecessor && predecessor.outputSku !== node.inputSku) block('SKU_MISMATCH',`${id} 的产出 ${predecessor.outputSku} 与 ${node.id} 的投入 ${node.inputSku} 不匹配。`)
    })
  })
  if (!Number.isFinite(draft.group.capDays) || draft.group.capDays <= 0) block('GROUP_CAP_INVALID','组上限须为大于 0 的自然日数。')
  const calculated = draft.group.mode === '组代理' ? draft.group.proxyDays : span.days
  if (calculated !== null && calculated > draft.group.capDays) block('GROUP_CAP_EXCEEDED',`${draft.group.name} ${draft.group.mode} ${calculated} 天超过组上限 ${draft.group.capDays} 天；不能截短结果或自动放宽上限。`)
  if (draft.group.mode === '组代理') issues.push({code:'CHILD_BUDGET_PENDING',severity:'提示',message:'组代理单独参加总时效计算，内部动作保留事实与责任，子预算待分配，不重复加总。'})
  if ([draft.risk.nearDueDays,draft.risk.staleDays,draft.risk.escalationDays].some(value => !Number.isFinite(value) || value <= 0)) block('RISK_THRESHOLD','预警、数据有效期及升级阈值须大于 0。')
  if (draft.risk.dayMode !== '连续24小时自然日') block('DAY_MODE','自然日口径固定，周末及节假日不停表。')
  const candidates = draft.rules.filter(rule => rule.state === '候选待确认')
  if (candidates.length) issues.push({code:'CANDIDATE_EXCLUDED',severity:'提示',message:`${candidates.length} 条会议候选尚未正式确认，不参与生效规则匹配。`})
  return issues
}

export function publicationImpact(tasks: TaskBaseline[], version: string, selectedIds: string[] = []): PublicationImpact[] {
  const selected = new Set(selectedIds)
  return tasks.map(task => ({taskId:task.id,previousVersion:task.ruleVersion,nextVersion:selected.has(task.id) ? version : task.ruleVersion,
    baselineDueAt:task.baselineDueAt,effectiveDueAt:task.effectiveDueAt,
    action: selected.has(task.id) ? '选定工作命中后重算当前路线标准与预测；原始基线、生效截止及历史逾期均保留' : '沿用原版本及原始基线'}))
}

export function createConfiguration(works: WorkDefinition[], stageNames: {id:string;name:string}[]): ConfigurationDraft {
  return {
    taskWorkMappings:[],
    works:structuredClone(works),
    stages:stageNames.map((stage,index) => ({...stage,order:index+1,capDays:stage.id === 'S02' ? 5 : null,startEvent:stage.id==='S02'?'生产需求产生':'本阶段具备输入',endEvent:stage.id==='S02'?'技术资料发布':'本阶段必要工作完成'})),
    rules:[
      {id:'MOCK-SLA-CN-TRANSFER-01',name:'中国采购后仓到厂运输',work:'ACT-S03-12',region:'CN',supplyMode:'现货采购',process:'无加工',route:'印尼仓→车缝厂',minQty:1,maxQty:null,days:1,priority:3,state:'Mock 已发布',startEvent:'调拨出库确认',endEvent:'目标工厂合格实收',unit:'PCS',source:'产品设计第12.7节 Mock',pending:''},
      {id:'MOCK-SLA-ID-TRANSFER-01',name:'印尼现货仓到厂运输',work:'ACT-S03-12',region:'ID',supplyMode:'现货采购',process:'无加工',route:'印尼仓→车缝厂',minQty:1,maxQty:null,days:0.5,priority:3,state:'Mock 已发布',startEvent:'调拨出库确认',endEvent:'目标工厂合格实收',unit:'PCS',source:'演示预算，非线上正式标准',pending:''},
      {id:'MOCK-SLA-STOCK-TRANSFER-01',name:'库存直调到厂',work:'ACT-S03-12',region:'ID',supplyMode:'已有库存',process:'无加工',route:'印尼仓→车缝厂',minQty:1,maxQty:null,days:0.5,priority:3,state:'Mock 已发布',startEvent:'调拨出库确认',endEvent:'目标工厂合格实收',unit:'PCS',source:'演示预算，库存足仍计调拨',pending:''},
      {id:'MOCK-SLA-SEW-SMALL-01',name:'车缝 1–500 件',work:'ACT-S07-03',region:'ID',supplyMode:'全部',process:'梭织',route:'全部',minQty:1,maxQty:500,days:3,priority:3,state:'Mock 已发布',startEvent:'本批投入及任务满足',endEvent:'本批合格产出',unit:'PCS',source:'演示预算',pending:''},
      {id:'MOCK-SLA-SEW-LARGE-01',name:'车缝 501–1000 件',work:'ACT-S07-03',region:'ID',supplyMode:'全部',process:'梭织',route:'全部',minQty:501,maxQty:1000,days:6,priority:3,state:'Mock 已发布',startEvent:'本批投入及任务满足',endEvent:'本批合格产出',unit:'PCS',source:'演示预算',pending:''},
      {id:'CANDIDATE-ID-ACCESSORY-05',name:'本土辅料全流程 5 天候选',work:'ACT-S03-15',region:'ID',supplyMode:'本土制作',process:'全部',route:'全部',minQty:1,maxQty:null,days:5,priority:3,state:'候选待确认',startEvent:'待确认',endEvent:'待确认',unit:'PCS',source:'2026-09-16 会议纪要',pending:'需确认准确起止、含排队/调拨范围及内部预算；不能将 3+5+2 同时发布'},
    ],
    mappings:[
      {id:'MAP-PURCHASE',work:'ACT-S03-02',system:'PMS',document:'面辅料采购单',relationKey:'需求明细ID + 采购明细ID',granularity:'采购明细 / 目标 SKU',startEvent:'采购需求确认',endEvent:'有效商家下单',quantityField:'实际采购数量',unitField:'采购单位',stateTranslation:'待处理→待下单；已下单→完成下单动作',dedupKey:'来源系统 + 事件ID'},
      {id:'MAP-TRANSFER',work:'ACT-S03-12',system:'WMS / FCS',document:'调拨单 + 工厂接收单',relationKey:'调拨明细ID + 物流批次ID + 接收明细ID',granularity:'物料 SKU / 批次 / 供给分配',startEvent:'调拨出库确认',endEvent:'工厂合格实收',quantityField:'工厂实收合格数量',unitField:'实收单位',stateTranslation:'已出库→运输中；已实收→按有效数量完成',dedupKey:'来源系统 + 事件ID + 更正版本'},
      {id:'MAP-SHIPMENT',work:'ACT-S09-05',system:'WMS / OMS',document:'实际发货单',relationKey:'发货行ID + 订单行ID + 生产来源分配ID',granularity:'发货行 / 实际生产来源',startEvent:'本次具备发货条件',endEvent:'实际交运确认',quantityField:'实际发货数量',unitField:'发货单位',stateTranslation:'打印运单不算发货；实发事实后关联订单',dedupKey:'来源系统 + 实发事件ID'},
    ],
    responsibilities:[
      {id:'OWNER-TRANSFER',work:'ACT-S03-12',team:'物流组',owner:'物流主管',receiver:'车缝厂收货组',coordinator:'主跟单',effectiveAt:'2026-09-17T00:00'},
      {id:'OWNER-PURCHASE',work:'ACT-S03-02',team:'采购组',owner:'采购员甲',receiver:'收货仓库',coordinator:'主跟单',effectiveAt:'2026-09-17T00:00'},
      {id:'OWNER-SHIPMENT',work:'ACT-S09-05',team:'履约仓',owner:'出库主管',receiver:'物流交接人',coordinator:'主跟单',effectiveAt:'2026-09-17T00:00'},
    ],
    dependencies:[
      {id:'DEP-MAKE',name:'辅料制作',days:3,predecessors:[],unit:'PCS',inputSku:'原辅料',outputSku:'白色辅料',releaseMode:'全量',releaseQty:1000,qualifiedOnly:true},
      {id:'DEP-DYE',name:'辅料染色',days:2,predecessors:['DEP-MAKE'],unit:'PCS',inputSku:'白色辅料',outputSku:'黑色目标辅料',releaseMode:'全量',releaseQty:1000,qualifiedOnly:true},
    ],
    group:{name:'辅料制作及染色演示组',capDays:5,mode:'子项网络',proxyDays:5},
    risk:{nearDueDays:2,staleDays:2,escalationDays:1,predictionSource:'已分配产能 + 有效合格数量；不足时待判定',dayMode:'连续24小时自然日',timezone:'Asia/Shanghai'},
  }
}
