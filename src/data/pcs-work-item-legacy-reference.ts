import type { PcsProjectWorkItemCode } from './pcs-project-domain-contract.ts'

export type PcsWorkItemLegacyReferenceUseMode =
  | 'DIRECT_MAPPING'
  | 'PARTIAL_REFERENCE'
  | 'DISPLAY_ONLY'

export interface PcsWorkItemLegacyReference {
  workItemTypeCode: PcsProjectWorkItemCode
  legacyCodes: string[]
  legacyNames: string[]
  legacyFieldGroupTitles: string[]
  legacyFieldLabels: string[]
  referenceUseMode: PcsWorkItemLegacyReferenceUseMode
}

const PCS_WORK_ITEM_LEGACY_REFERENCES: Partial<Record<PcsProjectWorkItemCode, PcsWorkItemLegacyReference>> = {
  PROJECT_INIT: {
    workItemTypeCode: 'PROJECT_INIT',
    legacyCodes: ['PROJECT_INIT'],
    legacyNames: ['商品项目立项'],
    legacyFieldGroupTitles: ['基础识别信息', '商品属性定义', '商品定位信息', '品牌与渠道信息', '样衣策略定义', '组织与责任信息', '补充信息'],
    legacyFieldLabels: ['项目名称', '商品图片', '风格编号', '分类', '二级分类', '款式类型', '风格', '价格带', '品牌', '目标销售渠道', '样衣获取方式', '外采供应商/平台', '外采链接', '外采单价', '负责人', '执行团队', '协作人', '备注', '附件'],
    referenceUseMode: 'DIRECT_MAPPING',
  },
  SAMPLE_ACQUIRE: {
    workItemTypeCode: 'SAMPLE_ACQUIRE',
    legacyCodes: ['SAMPLE_ACQUIRE'],
    legacyNames: ['样衣获取', '样衣获取（深圳前置打版）'],
    legacyFieldGroupTitles: ['样衣获取基础信息', '外采信息（条件必填）', '样衣规格与数量', '物流与到货信息', '样衣资产关联'],
    legacyFieldLabels: ['获取方式', '获取用途', '关联商品项目', '申请人/买手', '外采平台', '外采店铺', '外采商品链接', '单件价格', '下单时间', '样衣数量', '颜色/色号', '尺码组合', '预计到货时间', '快递公司', '快递单号', '样衣编号', '样衣状态', '库存记录'],
    referenceUseMode: 'DIRECT_MAPPING',
  },
  SAMPLE_INBOUND_CHECK: {
    workItemTypeCode: 'SAMPLE_INBOUND_CHECK',
    legacyCodes: ['SAMPLE_INBOUND_SZ'],
    legacyNames: ['到样样衣管理（深圳）', '到样入库与核对'],
    legacyFieldGroupTitles: ['基础信息', '样衣状态及规格', '物流与凭证'],
    legacyFieldLabels: ['关联样衣编号', '到样日期', '接收仓库/仓位', '接收人', '样衣数量', '颜色/色号', '尺码组合', '样衣状态', '快递公司', '快递单号', '到货照片', '入库凭证附件'],
    referenceUseMode: 'PARTIAL_REFERENCE',
  },
  FEASIBILITY_REVIEW: {
    workItemTypeCode: 'FEASIBILITY_REVIEW',
    legacyCodes: ['FEASIBILITY_REVIEW'],
    legacyNames: ['初步可行性判断'],
    legacyFieldGroupTitles: ['关联信息', '评估内容', '审批信息'],
    legacyFieldLabels: ['关联商品项目', '关联样衣编号', '判断维度', '可行性结论', '判断说明', '参与评估角色', '审批状态', '审批人'],
    referenceUseMode: 'DIRECT_MAPPING',
  },
  SAMPLE_SHOOT_FIT: {
    workItemTypeCode: 'SAMPLE_SHOOT_FIT',
    legacyCodes: ['CONTENT_SHOOT'],
    legacyNames: ['内容拍摄', '样衣拍摄与试穿'],
    legacyFieldGroupTitles: ['拍摄计划', '拍摄执行', '后期制作'],
    legacyFieldLabels: ['拍摄日期', '拍摄地点', '所需物料', '拍摄风格', '实际拍摄日期', '摄影师', '是否涉及模特', '模特姓名', '是否需要后期编辑', '后期编辑截止日期', '精修程度'],
    referenceUseMode: 'PARTIAL_REFERENCE',
  },
  SAMPLE_CONFIRM: {
    workItemTypeCode: 'SAMPLE_CONFIRM',
    legacyCodes: ['SAMPLE_CONFIRM'],
    legacyNames: ['样品确认', '样衣确认'],
    legacyFieldGroupTitles: ['样品评估', '修改详情', '最终决定'],
    legacyFieldLabels: ['外观确认', '尺寸确认', '工艺确认', '面料确认', '是否需要修改', '修改说明', '是否进入下一阶段', '确认备注'],
    referenceUseMode: 'DIRECT_MAPPING',
  },
  SAMPLE_COST_REVIEW: {
    workItemTypeCode: 'SAMPLE_COST_REVIEW',
    legacyCodes: ['SAMPLE_COST_REVIEW'],
    legacyNames: ['样品成本评审', '样衣核价'],
    legacyFieldGroupTitles: ['成本分析', '成本评估', '下一步决策'],
    legacyFieldLabels: ['实际样品成本', '目标生产成本', '成本差异', '成本差异率', '成本合规性', '评审意见', '是否继续生产', '决策理由'],
    referenceUseMode: 'DIRECT_MAPPING',
  },
  SAMPLE_PRICING: {
    workItemTypeCode: 'SAMPLE_PRICING',
    legacyCodes: ['SAMPLE_PRICING'],
    legacyNames: ['样品定价', '样衣定价'],
    legacyFieldGroupTitles: ['定价详情', '价格审批'],
    legacyFieldLabels: ['基础成本', '目标利润率', '计算价格', '最终定价', '定价策略', '审批人', '审批日期', '审批状态'],
    referenceUseMode: 'DIRECT_MAPPING',
  },
  CHANNEL_PRODUCT_LISTING: {
    workItemTypeCode: 'CHANNEL_PRODUCT_LISTING',
    legacyCodes: ['CHANNEL_PRODUCT_PREP', 'PRODUCT_LISTING', 'PRODUCT_LAUNCH'],
    legacyNames: ['商品上架', '渠道商品准备'],
    legacyFieldGroupTitles: ['基础上架信息（通用）', '渠道属性包 - TikTok', '渠道属性包 - Shopee', '补充信息'],
    legacyFieldLabels: ['关联商品项目', '上架渠道', '上架状态', '上架负责人', '上架时间', '是否已生成SPU/SKU', 'Washing Instructions', 'Style', 'Materials', 'Shopee一级分类', 'Shopee二级分类', 'Shopee三级分类', '附件', '备注'],
    referenceUseMode: 'PARTIAL_REFERENCE',
  },
  VIDEO_TEST: {
    workItemTypeCode: 'VIDEO_TEST',
    legacyCodes: ['VIDEO_TEST'],
    legacyNames: ['视频测试', '短视频测款'],
    legacyFieldGroupTitles: ['视频制作', '视频发布', '效果追踪'],
    legacyFieldLabels: ['视频创意', '拍摄日期', '后期编辑截止日期', '视频格式', '发布平台', '发布日期', '发布时间', '视频标题', '视频描述', '播放量', '点赞量', '评论数', '分享数', '转化率'],
    referenceUseMode: 'DIRECT_MAPPING',
  },
  LIVE_TEST: {
    workItemTypeCode: 'LIVE_TEST',
    legacyCodes: ['LIVE_TEST_SZ', 'LIVE_TEST_JKT'],
    legacyNames: ['直播测试（深圳）', '直播测试（jackets）', '直播测款'],
    legacyFieldGroupTitles: ['直播测款信息', '直播表现数据', '用户反馈'],
    legacyFieldLabels: ['直播日期', '直播时间', '主播', '直播平台', '最高在线人数', '总观看人数', '销售件数', '销售额', '转化率', '用户反馈摘要', '用户常问问题'],
    referenceUseMode: 'PARTIAL_REFERENCE',
  },
  PATTERN_TASK: {
    workItemTypeCode: 'PATTERN_TASK',
    legacyCodes: ['PRE_PATTERN'],
    legacyNames: ['预制版', '制版任务'],
    legacyFieldGroupTitles: ['版型制作', '版型确认'],
    legacyFieldLabels: ['纸样类型', '制版师', '制作日期', '尺码范围', '版本号', '审批状态', '确认人', '确认日期', '确认意见'],
    referenceUseMode: 'PARTIAL_REFERENCE',
  },
  PATTERN_ARTWORK_TASK: {
    workItemTypeCode: 'PATTERN_ARTWORK_TASK',
    legacyCodes: ['PRE_PRINT'],
    legacyNames: ['预印花', '花型任务'],
    legacyFieldGroupTitles: ['印花准备', '印花确认'],
    legacyFieldLabels: ['印花工艺', '印花设计师', '设计稿准备日期', '颜色潘通色号', '印花分辨率', '审批状态', '确认人', '确认日期', '确认意见'],
    referenceUseMode: 'PARTIAL_REFERENCE',
  },
  FIRST_SAMPLE: {
    workItemTypeCode: 'FIRST_SAMPLE',
    legacyCodes: ['PRE_SAMPLE_FLOW'],
    legacyNames: ['预制样流程', '首版样衣打样'],
    legacyFieldGroupTitles: ['流程协调', '样衣反馈'],
    legacyFieldLabels: ['版型状态', '印花状态', '样衣制作开始日期', '样衣制作结束日期', '协调人备注', '样衣合体度', '样衣质量反馈', '反馈日期'],
    referenceUseMode: 'PARTIAL_REFERENCE',
  },
  PRE_PRODUCTION_SAMPLE: {
    workItemTypeCode: 'PRE_PRODUCTION_SAMPLE',
    legacyCodes: ['PRE_PRODUCTION_SAMPLE'],
    legacyNames: ['量产前样品', '产前版样衣'],
    legacyFieldGroupTitles: ['样品生产', '质量检验'],
    legacyFieldLabels: ['生产工厂', '生产工单号', '材料确认', '计划交付日期', '实际交付日期', '生产成本', '检验日期', '检验员', '检验结果', '检验备注'],
    referenceUseMode: 'DIRECT_MAPPING',
  },
  SAMPLE_RETAIN_REVIEW: {
    workItemTypeCode: 'SAMPLE_RETAIN_REVIEW',
    legacyCodes: ['SAMPLE_STORAGE', 'SAMPLE_DISTRIBUTION'],
    legacyNames: ['样品暂存', '样品分发', '样衣留存评估', '样衣留存与库存'],
    legacyFieldGroupTitles: ['暂存详情', '分发详情'],
    legacyFieldLabels: ['暂存位置', '暂存时长', '暂存原因', '入库日期', '分发对象', '分发目的', '分发日期', '物流公司', '物流单号'],
    referenceUseMode: 'DISPLAY_ONLY',
  },
  SAMPLE_RETURN_HANDLE: {
    workItemTypeCode: 'SAMPLE_RETURN_HANDLE',
    legacyCodes: ['SAMPLE_RETURN_FIRST', 'SAMPLE_RETURN_SECOND'],
    legacyNames: ['样品寄回（首次）', '样品寄回（二次）', '样衣退货与处理'],
    legacyFieldGroupTitles: ['寄回详情'],
    legacyFieldLabels: ['收件人', '收件部门', '收件地址', '寄出日期', '物流公司', '物流单号', '修改原因'],
    referenceUseMode: 'DISPLAY_ONLY',
  },
}

export function getPcsWorkItemLegacyReference(
  workItemTypeCode: PcsProjectWorkItemCode,
): PcsWorkItemLegacyReference | null {
  const found = PCS_WORK_ITEM_LEGACY_REFERENCES[workItemTypeCode]
  if (!found) return null
  return {
    ...found,
    legacyCodes: [...found.legacyCodes],
    legacyNames: [...found.legacyNames],
    legacyFieldGroupTitles: [...found.legacyFieldGroupTitles],
    legacyFieldLabels: [...found.legacyFieldLabels],
  }
}

export function listPcsWorkItemLegacyReferences(): PcsWorkItemLegacyReference[] {
  return Object.values(PCS_WORK_ITEM_LEGACY_REFERENCES)
    .filter((item): item is PcsWorkItemLegacyReference => Boolean(item))
    .map((item) => getPcsWorkItemLegacyReference(item.workItemTypeCode) as PcsWorkItemLegacyReference)
}
