import type { PFCatalogEntry } from './model'

// 来源：已确认产品设计目录；规则仍为候选，未发布为正式SLA。
export const catalog: PFCatalogEntry[] = [
  {
    "id": "ACT-S01-01",
    "name": "受理并落实主跟单",
    "condition": "每笔有效生产需求",
    "anchors": "需求产生→主跟单及责任确认",
    "team": "跟单主管",
    "rule": "受理规则；不得延后总T0",
    "stage": "S01"
  },
  {
    "id": "ACT-S01-02",
    "name": "确认物料需求",
    "condition": "需用料且需求未确定",
    "anchors": "有效需求及技术输入→用料版本确认",
    "team": "跟单／技术",
    "rule": "按类型配置，未知有判断期限",
    "stage": "S01"
  },
  {
    "id": "ACT-S01-03",
    "name": "确认供给路线与缺口",
    "condition": "按每种目标物料",
    "anchors": "用料确认→库存／采购／制作路线确认",
    "team": "采购／跟单",
    "rule": "按判断类型配置；主例W01=1天",
    "stage": "S01"
  },
  {
    "id": "ACT-S02-01",
    "name": "确认准备计划",
    "condition": "需组织本次准备",
    "anchors": "需求关联→计划确认",
    "team": "主跟单",
    "rule": "准备组上限候选5天",
    "stage": "S02"
  },
  {
    "id": "ACT-S02-02",
    "name": "产前样制作",
    "condition": "本路线需要且不能复用",
    "anchors": "输入及制作任务满足→样衣结果完成",
    "team": "版房／样衣团队",
    "rule": "按工艺类型；当前不强加独立样衣审核任务",
    "stage": "S02"
  },
  {
    "id": "ACT-S02-03",
    "name": "梭织尺码纸样",
    "condition": "梭织且需要本次纸样",
    "anchors": "基版／任务具备→尺码纸样结果",
    "team": "版师",
    "rule": "与产前样可并行；按类型配置",
    "stage": "S02"
  },
  {
    "id": "ACT-S02-04",
    "name": "毛织尺码纸样",
    "condition": "毛织且需要本次纸样",
    "anchors": "基版／任务具备→毛织规格结果",
    "team": "毛织版师",
    "rule": "按毛织类型配置",
    "stage": "S02"
  },
  {
    "id": "ACT-S02-05",
    "name": "花型执行",
    "condition": "需花型／定位印准备",
    "anchors": "任务要求具备→花型提交",
    "team": "花型团队",
    "rule": "定位印准备组候选5天",
    "stage": "S02"
  },
  {
    "id": "ACT-S02-06",
    "name": "花型审核",
    "condition": "当前花型结果需审核",
    "anchors": "花型提交→有效审核通过",
    "team": "买手",
    "rule": "同组约束；驳回产生新轮次",
    "stage": "S02"
  },
  {
    "id": "ACT-S02-07",
    "name": "毛纱调色要求提交",
    "condition": "需毛纱调色",
    "anchors": "计划确认→调色要求可执行",
    "team": "跟单",
    "rule": "按要求类型配置",
    "stage": "S02"
  },
  {
    "id": "ACT-S02-08",
    "name": "毛纱调色执行",
    "condition": "毛纱要求已就绪",
    "anchors": "要求／样品具备→调色结果",
    "team": "调色工厂",
    "rule": "需求后3天规则是否适用需配置",
    "stage": "S02"
  },
  {
    "id": "ACT-S02-09",
    "name": "面料调色要求提交",
    "condition": "需面料调色",
    "anchors": "计划确认→调色要求可执行",
    "team": "跟单",
    "rule": "按要求类型配置",
    "stage": "S02"
  },
  {
    "id": "ACT-S02-10",
    "name": "面料调色执行",
    "condition": "面料要求已就绪",
    "anchors": "要求／样品具备→调色结果",
    "team": "调色工厂",
    "rule": "需求后3天候选固定期限",
    "stage": "S02"
  },
  {
    "id": "ACT-S02-11",
    "name": "调色审核",
    "condition": "对应专业结果需审核",
    "anchors": "调色提交→指定目标色有效通过",
    "team": "买手",
    "rule": "类型与轮次规则",
    "stage": "S02"
  },
  {
    "id": "ACT-S02-12",
    "name": "技术资料确认",
    "condition": "适用准备输出满足",
    "anchors": "必要专业结果齐→确认通过",
    "team": "跟单",
    "rule": "显式计时，不遗漏等待确认",
    "stage": "S02"
  },
  {
    "id": "ACT-S02-13",
    "name": "技术资料发布／放行",
    "condition": "需形成供生产使用版本",
    "anchors": "确认完成→有效发布版本",
    "team": "技术／跟单",
    "rule": "与确认分事件；复用版本不重复制作",
    "stage": "S02"
  },
  {
    "id": "ACT-S03-01",
    "name": "分配合格库存",
    "condition": "本任务使用现货／已入库供给",
    "anchors": "用料确认→来源库存及数量锁定关系",
    "team": "仓储",
    "rule": "库存足够不跳过此判断",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-02",
    "name": "缺口采购下单",
    "condition": "确认缺口需要采购",
    "anchors": "确认采购需求→有效采购单下发",
    "team": "采购",
    "rule": "辅料下单候选24小时；地区与供给方式独立",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-03",
    "name": "供应商备货并交出",
    "condition": "外部采购",
    "anchors": "有效下单→供应商足量／分批交出",
    "team": "采购对接供应商",
    "rule": "中国现货／印尼现货等分类",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-04",
    "name": "国内采购运输",
    "condition": "对应供应商到集货仓段存在",
    "anchors": "供方交出→集货仓实收",
    "team": "物流",
    "rule": "运输路线规则",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-05",
    "name": "集货与转运准备",
    "condition": "必须集货或等待转运",
    "anchors": "集货仓实收→转运实际出库",
    "team": "物流／集货仓",
    "rule": "等待也计时；不叠加到同段运输",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-06",
    "name": "跨境运输",
    "condition": "存在跨境段",
    "anchors": "转运出库→目的地到达",
    "team": "物流",
    "rule": "渠道／起讫地类型",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-07",
    "name": "目的地配送到仓",
    "condition": "有独立配送段",
    "anchors": "目的地放行→业务仓到仓",
    "team": "物流",
    "rule": "当地路线规则",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-08",
    "name": "采购到仓验收",
    "condition": "采购到仓",
    "anchors": "实到→验收结果及差异确认",
    "team": "仓库／来料质检",
    "rule": "到仓与合格不能等同",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-09",
    "name": "采购入库",
    "condition": "验收后需库存入账",
    "anchors": "可入库→实收入库记录",
    "team": "仓库",
    "rule": "明确库存形成时刻",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-10",
    "name": "调拨安排与待出库",
    "condition": "现货或采购入库需送厂",
    "anchors": "可调拨／需调拨→调拨安排完成",
    "team": "仓库／计划",
    "rule": "等待不得消失在两个单据之间",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-11",
    "name": "调拨出库",
    "condition": "调拨具备出库条件",
    "anchors": "出库责任起点→实际出库确认",
    "team": "发出仓库",
    "rule": "不是创建调拨单即完成",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-12",
    "name": "调拨运输",
    "condition": "已实际出库",
    "anchors": "出库→到目标厂交付",
    "team": "物流",
    "rule": "仓到厂路线规则",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-13",
    "name": "目标工厂接收",
    "condition": "到厂交付",
    "anchors": "交付→目标工厂实收及差异确认",
    "team": "接收工厂",
    "rule": "正确SKU、批次、合格数量",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-14",
    "name": "辅料制版／打样",
    "condition": "本土制作且本次需要",
    "anchors": "要求齐→可用于制作的版／样",
    "team": "辅料工厂",
    "rule": "包含在本土制作组；不一律添加",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-15",
    "name": "辅料制作",
    "condition": "本土委托制作",
    "anchors": "版／样／原料满足→制作产出",
    "team": "辅料工厂",
    "rule": "本土全流程候选5天，叶子预算另分配",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-16",
    "name": "面料染色",
    "condition": "目标面料需染色",
    "anchors": "色样／原料满足→合格加工产出",
    "team": "染色工厂",
    "rule": "染色组候选5天，范围待发布",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-17",
    "name": "面料印花",
    "condition": "目标面料需印花",
    "anchors": "花型／原料满足→合格印花产出",
    "team": "印花工厂",
    "rule": "印花组候选3天；普通／定位等分类",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-18",
    "name": "辅料染色",
    "condition": "目标辅料需染色",
    "anchors": "目标色／原料满足→目标色合格辅料",
    "team": "染色工厂",
    "rule": "不能以原料采购完成代替",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-19",
    "name": "加工检验与交出",
    "condition": "加工产出须交下一环节",
    "anchors": "加工完成→检验及交出确认",
    "team": "加工工厂",
    "rule": "交出数量／质量分开；运输另配置",
    "stage": "S03"
  },
  {
    "id": "ACT-S03-20",
    "name": "加工产出接收",
    "condition": "从加工厂进入下一厂／仓",
    "anchors": "实际交付→指定接收方实收",
    "team": "下一厂／仓库",
    "rule": "正确目标SKU及投入数量",
    "stage": "S03"
  },
  {
    "id": "ACT-S04-01",
    "name": "来源需求／提前加工单匹配",
    "condition": "存在提前单／合并来源",
    "anchors": "正式建单条件满足→匹配确认",
    "team": "计划／跟单",
    "rule": "同一提前单不得复制重复执行",
    "stage": "S04"
  },
  {
    "id": "ACT-S04-02",
    "name": "生产单创建确认",
    "condition": "生产方案可确认",
    "anchors": "必要输入就绪→生产单有效",
    "team": "计划",
    "rule": "不改生产任务T0",
    "stage": "S04"
  },
  {
    "id": "ACT-S04-03",
    "name": "生成／确认生产任务",
    "condition": "技术路线已放行",
    "anchors": "生产单具备→工艺任务成立",
    "team": "计划",
    "rule": "按工艺路线真实生成",
    "stage": "S04"
  },
  {
    "id": "ACT-S04-04",
    "name": "任务分配",
    "condition": "任务需选择工厂／负责人",
    "anchors": "可分配→有效分配",
    "team": "计划",
    "rule": "工厂／数量／批次明确",
    "stage": "S04"
  },
  {
    "id": "ACT-S04-05",
    "name": "任务下发",
    "condition": "任务已分配",
    "anchors": "可下发→工厂收到有效任务",
    "team": "计划",
    "rule": "首批回货锚点需配置，不能默认所有下发同义",
    "stage": "S04"
  },
  {
    "id": "ACT-S05-01",
    "name": "裁床领料配料",
    "condition": "本批料可用",
    "anchors": "本批物料齐→配料完成",
    "team": "裁厂仓管",
    "rule": "齐料后候选1天",
    "stage": "S05"
  },
  {
    "id": "ACT-S05-02",
    "name": "拉布／铺布",
    "condition": "路线需要",
    "anchors": "布料与任务满足→铺布完成",
    "team": "裁厂",
    "rule": "包含裁床组预算",
    "stage": "S05"
  },
  {
    "id": "ACT-S05-03",
    "name": "裁剪",
    "condition": "任务与布料满足",
    "anchors": "裁床可执行→有效裁片输出",
    "team": "裁厂",
    "rule": "进入裁床后组候选2天",
    "stage": "S05"
  },
  {
    "id": "ACT-S05-04",
    "name": "编号与菲票配套",
    "condition": "现场工艺需要",
    "anchors": "裁片输出→编号／菲票关系就绪",
    "team": "裁厂",
    "rule": "依据现有菲票事实，不重复造票",
    "stage": "S05"
  },
  {
    "id": "ACT-S05-05",
    "name": "裁片检验",
    "condition": "裁片需验收",
    "anchors": "待验裁片→合格裁片",
    "team": "裁厂质检",
    "rule": "不合格不释放数量",
    "stage": "S05"
  },
  {
    "id": "ACT-S05-06",
    "name": "裁片交出",
    "condition": "下一环节可接续",
    "anchors": "可交裁片→交出确认",
    "team": "裁厂仓管",
    "rule": "包／袋／SKU数量明细",
    "stage": "S05"
  },
  {
    "id": "ACT-S05-07",
    "name": "裁片下游接收",
    "condition": "已交出到下一环节",
    "anchors": "到达→下游实收",
    "team": "下一工厂",
    "rule": "交出不等于实收",
    "stage": "S05"
  },
  {
    "id": "ACT-S06-01",
    "name": "特殊工艺任务接收",
    "condition": "本批有此工艺",
    "anchors": "任务及投入到达→接收确认",
    "team": "特殊工艺厂",
    "rule": "工艺类型确定规则",
    "stage": "S06"
  },
  {
    "id": "ACT-S06-02",
    "name": "特殊工艺执行",
    "condition": "按实际工艺类型实例化",
    "anchors": "技术／投入齐→加工完成",
    "team": "特殊工艺厂",
    "rule": "相关辅助工艺候选3天；不全单固定套用",
    "stage": "S06"
  },
  {
    "id": "ACT-S06-03",
    "name": "特殊工艺检验",
    "condition": "工艺产出须检验",
    "anchors": "加工完成→合格产出",
    "team": "工艺质检",
    "rule": "返工为新轮次",
    "stage": "S06"
  },
  {
    "id": "ACT-S06-04",
    "name": "特殊工艺交出",
    "condition": "合格输出需移交",
    "anchors": "可交出→实际交出",
    "team": "特殊工艺厂",
    "rule": "据物料去向配置",
    "stage": "S06"
  },
  {
    "id": "ACT-S06-05",
    "name": "车缝齐套确认",
    "condition": "准备进入车缝",
    "anchors": "所需裁片／辅料实收→本批齐套",
    "team": "计划／车缝收货",
    "rule": "按批次判断，不被其他批尾料无限阻挡",
    "stage": "S06"
  },
  {
    "id": "ACT-S06-06",
    "name": "分单",
    "condition": "本批具备分单条件",
    "anchors": "齐套→分单结果生效",
    "team": "计划",
    "rule": "齐套分单候选2天",
    "stage": "S06"
  },
  {
    "id": "ACT-S06-07",
    "name": "厂内配套与交接",
    "condition": "需配套送至执行组",
    "anchors": "可配套→执行组实收",
    "team": "车缝厂／计划",
    "rule": "外部调拨已计时间不重复加",
    "stage": "S06"
  },
  {
    "id": "ACT-S07-01",
    "name": "车缝任务接收",
    "condition": "已下发",
    "anchors": "有效下发→接收确认",
    "team": "车缝厂",
    "rule": "任务接收与物料接收分开",
    "stage": "S07"
  },
  {
    "id": "ACT-S07-02",
    "name": "车缝排队与开工",
    "condition": "具备可执行数量",
    "anchors": "可执行→实际开工",
    "team": "车缝厂",
    "rule": "等待计本环节责任耗时",
    "stage": "S07"
  },
  {
    "id": "ACT-S07-03",
    "name": "车缝执行",
    "condition": "本批可执行",
    "anchors": "实际开工→完成产出",
    "team": "车缝厂",
    "rule": "按类型／数量档预算及分配能力预测",
    "stage": "S07"
  },
  {
    "id": "ACT-S07-04",
    "name": "车缝自检",
    "condition": "须保证交出质量",
    "anchors": "产出→可交合格数量",
    "team": "车缝厂",
    "rule": "废次返工不冒充合格",
    "stage": "S07"
  },
  {
    "id": "ACT-S07-05",
    "name": "分批回货交出",
    "condition": "可交合格产出",
    "anchors": "可交→实际回货交出",
    "team": "车缝厂",
    "rule": "首批／90%为数量里程碑，不是另加工时",
    "stage": "S07"
  },
  {
    "id": "ACT-S07-06",
    "name": "回货运输",
    "condition": "独立运输段",
    "anchors": "回货交出→接收地到达",
    "team": "物流",
    "rule": "按回货路线；自然日",
    "stage": "S07"
  },
  {
    "id": "ACT-S07-07",
    "name": "回货实收",
    "condition": "到达指定接收方",
    "anchors": "到达→实收数量及差异",
    "team": "接收仓／后道厂",
    "rule": "与工厂申报数量分开",
    "stage": "S07"
  },
  {
    "id": "ACT-S08-01",
    "name": "回货接收检验",
    "condition": "到货后需初检",
    "anchors": "实收→检验与分流",
    "team": "质检组",
    "rule": "合格／返工／待判分列",
    "stage": "S08"
  },
  {
    "id": "ACT-S08-02",
    "name": "后道任务领取与排队",
    "condition": "需后道加工",
    "anchors": "具备输入→有效开工",
    "team": "后道厂",
    "rule": "不可用领取时间掩盖之前等待",
    "stage": "S08"
  },
  {
    "id": "ACT-S08-03",
    "name": "后道执行",
    "condition": "按烫包等实际路线",
    "anchors": "开工→后道完成",
    "team": "后道厂",
    "rule": "不同类型独立配置，不由旧图直接取2天",
    "stage": "S08"
  },
  {
    "id": "ACT-S08-04",
    "name": "终检",
    "condition": "需终检放行",
    "anchors": "后道结果具备→检验判定",
    "team": "质检组",
    "rule": "质量通过才能释放",
    "stage": "S08"
  },
  {
    "id": "ACT-S08-05",
    "name": "质量处置及复检",
    "condition": "本批不合格／待判",
    "anchors": "问题确认→最终处置结果",
    "team": "质量责任团队",
    "rule": "返工新实例；自然日不暂停",
    "stage": "S08"
  },
  {
    "id": "ACT-S08-06",
    "name": "成衣交出",
    "condition": "可交成衣",
    "anchors": "放行→交出确认",
    "team": "后道厂",
    "rule": "与入库实收不同",
    "stage": "S08"
  },
  {
    "id": "ACT-S08-07",
    "name": "成衣仓实收",
    "condition": "成衣到仓",
    "anchors": "交付→仓库实收数量",
    "team": "成衣仓",
    "rule": "按来源生产批次",
    "stage": "S08"
  },
  {
    "id": "ACT-S08-08",
    "name": "成衣入库及可发确认",
    "condition": "实收且质量满足",
    "anchors": "可入库→可供发货库存",
    "team": "成衣仓",
    "rule": "不是客户实发终点",
    "stage": "S08"
  },
  {
    "id": "ACT-S09-01",
    "name": "发货条件确认",
    "condition": "有效成衣待发",
    "anchors": "具备检查条件→可发／待履约原因明确",
    "team": "履约仓／业务",
    "rule": "无可发订单原因单列，不归责工厂",
    "stage": "S09"
  },
  {
    "id": "ACT-S09-02",
    "name": "拣配",
    "condition": "具备实际业务发货任务",
    "anchors": "可拣配→本次拣配完成",
    "team": "履约仓",
    "rule": "此处不提前确立监控模块的客户订单集合",
    "stage": "S09"
  },
  {
    "id": "ACT-S09-03",
    "name": "复核",
    "condition": "本次拣配完成",
    "anchors": "待复核→货品数量复核通过",
    "team": "履约仓",
    "rule": "错货差异不得出库",
    "stage": "S09"
  },
  {
    "id": "ACT-S09-04",
    "name": "包装与交运准备",
    "condition": "本次需包装",
    "anchors": "可打包→可实际交运",
    "team": "履约仓",
    "rule": "打印运单不等于发货",
    "stage": "S09"
  },
  {
    "id": "ACT-S09-05",
    "name": "实际发货确认",
    "condition": "本次货物实际发出",
    "anchors": "可交运→有效实际发货事件",
    "team": "履约仓",
    "rule": "用户确认的实发终点；准确事件待业务发布",
    "stage": "S09"
  },
  {
    "id": "ACT-S09-06",
    "name": "发货订单／生产来源关联",
    "condition": "实发时才建立",
    "anchors": "实发事实→对应订单行与生产来源数量确认",
    "team": "履约／数据责任团队",
    "rule": "若有记录延迟，单独数据时效；不延后实发时刻",
    "stage": "S09"
  },
  {
    "id": "ACT-S09-07",
    "name": "订单时效核算",
    "condition": "已有实发订单关联",
    "anchors": "所需订单事实齐→时效结果可查",
    "team": "DDS自动计算／数据责任团队",
    "rule": "系统核算不额外加入生产实发工期",
    "stage": "S09"
  }
]
