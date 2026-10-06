"""生成本方案的字段/处置/追踪附件。仅写同目录文档，不读写业务数据。"""
import csv
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
AUDIT = HERE.parent / '2026-10-04-product-material-domain-audit-v2'
fields = []


def add_fields(prefix, owner, page, section, refs, rows):
    for i, row in enumerate(rows.strip().splitlines(), 1):
        key, label, typ, required, default, unit, rule = row.split('|')
        fields.append(dict(field_id=f'{prefix}-{i:03}', object=owner, field_key=key,
                           label=label, type=typ, required=required, default=default,
                           unit_or_dictionary=unit, page=page, validation_and_change=rule,
                           proposal_section=section, decision_refs=refs,
                           design_status='目标字段设计；未实施'))


add_fields('CFG','配置项','P11','§5','B08/B09/B10/B11', '''
optionId|配置项ID|稳定ID|是|系统生成|无|引用不随排序或改名变化
dimension|属性字典|枚举|是|当前面板|独立属性|品类/风格/品类编号分开命名空间
businessCode|业务编码|字符串|是|按模板生成或输入|无|字典内唯一；使用后不随数组位置改变
nameZh|中文名称|文本|是|空|无|去首尾空白；同义名称通过别名表达
nameForeign|外文名称|语言文本集合|否|空|语言|按实际语言保存；不把所有外文都称英文
aliases|展示别名|文本列表|否|空|无|不产生第二套内部尺码
sortOrder|排序|整数|是|末位|无|调整不改业务编码
status|状态|启用/停用|是|启用|无|停用限制新选；历史引用保留
usedCount|使用数|计算整数|只读|按真实引用|条|可进入使用位置；不可人工输入
logs|变更记录|记录引用|只读|按动作产生|无|同一人可改和审；保留原新值
''')
add_fields('TPL','分类与物料模板','P11','§5.2','A01/B01/B02/B03/B04/B05', '''
categoryId|分类ID|稳定ID|是|系统生成|无|商品类目与物料子类的命名空间独立
parentCategoryId|上级分类|ID|条件|空|分类树|禁止成环；商品正式类目保存叶节点
materialKind|物料大类|枚举|物料必填|入口带入|面料/辅料/纱线/耗材/配件|五类固定；服装纽扣拉链归辅料
templateId|模板ID|稳定ID|是|系统生成|无|模板引用可追溯
templateVersion|模板版本|整数|是|1|无|已用模板不原地改变身份定义
attributeKey|属性键|字符串|是|定义时填写|无|模板内唯一；稳定不随文案变
attributeLabel|属性名称|文本|是|空|无|中文业务名
dataType|数据类型|枚举|是|文本|文本/数值/单选/多选/成分/引用|不支持任意执行脚本
identityLevel|归属层级|枚举|是|主档|主档/SKU/包装/工艺|不允许把批次实测纳入标准主档
isIdentityDimension|是否身份维度|布尔|是|否|无|改变值是否需要新身份由模板定义
requiredCondition|必填条件|受控条件|是|不必填|子类/工艺适用条件|染色Pantone强制；不适用字段隐藏
unitId|属性单位|ID|数值适用时|空|单位字典|幅宽cm；克重g/m²
valueDictionary|取值字典引用|ID|选择型必填|空|独立字典|不把多种属性混在备注选项
displayOrder|显示顺序|整数|是|末位|无|不影响身份
helpText|填写说明|文本|否|空|无|注明标准值而非批次实测
categoryCode|分类业务码|字符串|是|系统生成或指定|分类命名空间|唯一；被引用后稳定，不跟随排序变化
categoryName|分类名称|文本|是|空|无|可维护语言别名；不代替稳定分类ID
''')
add_fields('UNIT','单位定义','P11','§5/§8','B12/B13/B14/B15', '''
unitId|单位ID|稳定ID|是|系统生成|无|统一内部身份
code|单位编码|字符串|是|空|M/Yard/PCS/KG等|旧别名有明确映射；不擅自解释cns
name|单位名称|文本|是|空|无|米/码/件等业务显示
dimension|量纲|枚举|是|空|长度/质量/面积/数量/体积/包装|跨量纲不可使用全局任意系数
quantityScale|数量精度|整数|是|计数0其余3建议|0至8|不是价格精度
divisible|是否允许拆分|布尔|是|按单位定义|无|计数默认不允许小数
fixedBaseUnitId|固定换算基准单位|ID|有固定关系时|空|同量纲单位|只维护固定物理关系
fixedFactor|固定系数|十进制|有基准时|空|1本单位对应基准数量|必须大于0；Yard到M为0.9144
''')
add_fields('COLOR','颜色与Pantone','P11/P10','§5/§9','B08/C04/C05', '''
colorId|颜色ID|稳定ID|颜色适用时|空|颜色字典|不可仅按显示名合并
colorCode|稳定颜色码|字符串|颜色适用时|取字典|无|生成SKU使用；审核后改名不改码
colorName|颜色名|文本|颜色适用时|取字典|无|可维护中外文别名
pantoneId|Pantone引用|ID|染色必填|空|Pantone字典|色样不能替代
pantoneSystem|Pantone体系|枚举/字典|染色必填|明确选择|TCX/TPX等实际体系|迁入体系不能由新模板默认值猜填
pantoneNumber|Pantone编号|字符串|染色必填|空|体系内编号|保持字符；字典校验不凭颜色名推导
sampleAssetIds|确认色样资料|ID列表|否|空|资料资产|辅助识别；保留版本
''')
add_fields('STYLE','款式SPU','P01/P02','§6','A03/A04/A05/A06/A07/B10/B11/F02', '''
styleId|款式ID|稳定ID|是|系统生成|无|一款式衣服唯一内部身份
styleCode|款式编码|字符串|是|系统模板|无|迁入保留；建档可指定唯一值；审核后锁定
styleName|款式名称|文本|是|空|无|改名留痕不改身份
styleNameTranslations|多语款式名称|语言文本集合|否|空|语言|不是各店铺已发布标题的直接写入口
styleNumber|款号|字符串|否|空|无|与内部主码含义明确；保留来源款号
brandId|品牌|ID|是|空|品牌字典|单选；交付标准不同品牌分别建SPU
formalCategoryId|正式主分类|ID|是|空|商品类目树|单选叶类目；平台类目单独映射
categoryIds|品类|ID列表|否|空|品类字典|多选建议；如套装；独立于风格和品类编号
styleTagIds|风格|ID列表|否|空|风格字典|多选；如休闲
categoryNumberId|品类编号|ID|否|空|品类编号字典|单选建议；保留正式编号89等
productPositionId|商品定位|ID|否|空|商品定位|单选；八项业务取值
trendElementIds|流行元素|ID列表|否|空|流行元素|多选
marketingFabricIds|营销面料描述|ID列表|否|空|营销面料字典|不能替代真实物料或结构化成分
specialCraftTagIds|特殊工艺标签|ID列表|否|空|营销工艺标签|不自动建加工单
crowdIds|人群|ID列表|否|空|人群|多选
ageIds|年龄|ID列表|否|空|年龄|多选
audiencePositionIds|人群定位|ID列表|否|空|人群定位|多选
materialStructure|材质类型|枚举|是|明确选择|毛织/非毛织|技术分类不充当营销面料名
year|年份|整数|否|空|年|实际维护
seasonIds|季节|字典列表|否|空|季节|保留已有季节
buyerId|买手/资料责任人|人员ID|否|当前责任人|人员目录|Vendor仅经身份核实后映射；不是供应商
deliveryMode|交付方式|枚举|是|单件|单件/固定实物套装/虚拟组合|虚拟组合仍有自己的SPU/SKU
mainAssetId|主识别图|资料ID|审核前是|空|图片|真实可识别图可放大
galleryAssetIds|补充图片|ID列表|否|空|图片|有序并保留用途
technicalRefs|技术包与核价引用|引用集合|只读|源领域读取|技术版本|技术包是否存在不决定档案身份审核
sameStyleRelations|同款关联|关系列表|否|空|其他SPU|不合并库存/身份；不同品牌可关联
substitutionRelations|替代关联|带条件关系列表|否|空|其他SKU或物料|适用条件和版本独立；不由同款自动推导
remark|备注|文本|否|空|无|对象内留痕
''')
add_fields('CONTENT','基础销售内容','P02/P13','§6.2/§11.3','E04/E06', '''
contentId|内容ID|稳定ID|是|系统生成|无|引用内容版本
ownerId|所属SPU或渠道商品|ID|是|当前对象|无|基础与店铺内容明确分属
languageCode|语言|字符串|是|店铺默认或选择|zh/id/en/ms|按真实内容语言保存
title|标题|文本|是|空或基础继承|无|渠道覆盖不反写SPU
descriptionHtml|商品描述|富文本|发布前是|空或继承|无|保留HTML语义；渲染清理危险内容
sellingPoints|卖点|文本列表|否|空|无|共同内容可初始化渠道
mediaRefs|图片视频序列|有序引用列表|发布前按渠道规则|空|媒体用途|文件本体不塞入JSON
sizeChartAssetId|销售尺码图|资料ID|按渠道类目要求|空|图片|引用技术尺寸版本
sizeChartSourceVersionId|尺码图技术来源|ID|有技术来源图时|空|技术尺寸版本|渠道不改工厂尺寸
inheritanceMode|继承/覆盖状态|字段级标记|渠道内容是|跟随未发布基础|无|平台改动形成店铺覆盖
baseContentVersionId|基础内容版本|ID|继承时|当前基础版本|无|已发布不因基础变化直接覆盖
contentVersion|内容版本|整数|是|1|无|每次实际内容变更递增
''')
add_fields('SKU','商品SKU','P03','§6.3/§6.4','A04/A06/B09/B15/E05', '''
skuId|内部SKU ID|稳定ID|是|系统生成|无|外部ID多对一引用它
skuCode|SKU编码|字符串|是|规则生成|无|唯一；审核后锁定
styleId|所属款式|ID|是|当前SPU|款式|已用后不可跨款式改归属
skuName|规格名称|文本|是|由款式和规格生成|无|显示名不代替结构字段
skuNameTranslations|多语规格名|语言文本集合|否|空|语言|可修正留痕
colorId|颜色|ID|是|空|颜色|统一内部颜色
sizeId|尺码|ID|是|空|一套尺码字典|字母/数字/均码；无市场体系ID
patternIdentityId|花型交付差异|ID|构成销售/交付差异时|空|花型|营销描述变化不自动新SKU
extraIdentityValues|其他交付规格|受控属性集合|条件|空|模板|必须明确实物区别
barcodeAliases|条码/旧码别名|字符串列表|否|空|识别关系|唯一识别同一SKU；保留旧码
mainUnitId|主单位|ID|是|件；实物套装可套|单位|使用后锁定；没有库存字段
skuImageId|规格识别图|资料ID|审核前是|可引用款式图|图片|按规格可识别
compositionVersionId|组合组成版本|ID|虚拟组合必填|空|组件清单|至少两条；无自引用循环
channelMappings|渠道关联行|只读关联|只读|按真实映射|外部规格|真实PID与ID；无映射是合法空集
technicalReferences|技术引用|只读集合|只读|技术域读取|版本|预期材料与BOM移到技术域维护
''')
add_fields('COMP','组合组成','P02/P03','§6.4','A06/E03/E09', '''
compositionId|组成ID|稳定ID|是|系统生成|无|属于组合SKU
ownerSkuId|组合SKU|ID|是|当前SKU|商品SKU|平台仅映射组合SKU
componentSkuId|组件SKU|ID|是|空|普通或实物套装SKU|不允许嵌套虚拟组合或自引用
quantity|组件数量|正十进制|是|空|组件主单位|按交付单位精度；必须正数
version|组成版本|整数|是|1|无|旧订单保存原组成；改变交付需新规格/版本
''')
add_fields('MAT','物料主档','P04-P09','§7','A01/A02/A03/B01/B02/B03/B04/B05', '''
materialId|物料主档ID|稳定ID|是|系统生成|无|SKU和技术引用的根对象
materialCode|根物料编码|字符串|是|系统模板|无|迁入保留；审核后锁定；无供方地区依赖
materialName|物料名称|文本|是|空|无|唯一身份不依赖名称
materialNameTranslations|多语物料名|语言文本集合|否|空|语言|保留英文标题来源
kind|物料大类|枚举|是|入口确定|五类|不另设原料和加工料两套身份
subcategoryId|物料子类|ID|是|空|物料分类|加载适用模板
templateVersionId|属性模板版本|ID|是|当前已启用|物料模板|保存后追溯；不被新模板静默改写
specSummary|规格摘要|派生/说明|否|适用属性组合|无|不得代替必填结构字段
compositionLines|成分与比例|明细列表|适用时|空|成分/百分比|合计100%；比例精度按模板
structureId|组织结构|ID|面料适用时|空|组织|普通/针织/梭织来源映射明确
widthCm|幅宽|十进制|面料适用时|空|cm|唯一幅宽；就是有效幅宽；大于0；无空差计算
gramWeightGsm|克重|十进制|面料适用时|空|g/m²|不得把旧KG字段直接填入
yarnCountSystemId|纱支体系|ID|纱线适用时|空|Ne/Nm/tex/denier等|体系和值一起保存
yarnCountValue|纱支数值|十进制|纱线适用时|空|体系对应单位|大于0；不是筒数
plyCount|股数|整数|纱线适用时|空|股|大于0
twistValue|捻度|十进制|模板要求时|空|需带单位|不与纱支合为无规则文本
twistUnit|捻度单位|字典|填捻度时|空|捻/m等|与数值成对
categoryAttributes|分类适用根属性|结构属性集合|按模板|空|TPL字段|含纽扣结构/拉链齿型/织带宽/绳直径等
equipmentCompatibility|设备适配|关系集合|配件适用时|空|设备类型/型号|多值独立关系；不得放colorName
mainAssetId|主图|资料ID|审核前是|空|图片|实际识别图
galleryAssetIds|物料图集|ID列表|否|空|图片|用途和顺序明确
barcodeTemplateId|条码标签模板|ID|打印时|默认物料模板|模板|不是用某一个SKU码当模板身份
remark|备注|文本|否|空|无|不承担必填结构属性
''')
add_fields('ATTR','分类属性模板实例字段','P09/P10/P11','§5.2/§7','B01/B02/B03/B04/B05', '''
componentId|成分项|字典ID|成分适用时|空|成分字典|主档compositionLines明细；不与营销面料标签共用自由文本
componentPercent|成分比例|十进制|成分适用时|空|%|主档明细；0至100；同一成分不重复；合计100
constructionType|结构/款式|字典ID|纽扣拉链花边装饰件按模板必填|空|子类结构字典|主档categoryAttributes；不能用此名称替代SKU实物规格
materialComposition|结构材质|字典/成分引用|辅料耗材配件适用时|空|材质字典|主档；不得强迫所有配件填面料成分比例
buttonHoleCount|纽扣孔数|非负整数|孔式纽扣必填|空|孔|主档；脚式使用固定方式字段而非虚填0孔
buttonFastening|纽扣固定方式|枚举|纽扣必填|空|孔式/脚式等配置|主档；驱动孔数适用条件
buttonDiameterMm|纽扣直径|正十进制|纽扣SKU必填|空|mm|SKU identityValues；交付尺寸差异形成SKU
buttonThicknessMm|纽扣厚度|正十进制|模板要求时|空|mm|SKU identityValues；未知为空
zipperToothType|拉链齿型|字典ID|拉链必填|空|齿型字典|主档；与结构材质分开
zipperOpening|拉链开合结构|字典ID|拉链必填|空|开口/闭口等配置|主档；按交付要求
zipperLengthCm|拉链长度|正十进制|拉链SKU必填|空|cm|SKU identityValues；不可只写在名称
zipperGauge|拉链规格号|字符串|拉链模板要求时|空|规格号字典|SKU identityValues；不是尺寸单位
trimWidthMm|织带/松紧带/花边标准宽度|正十进制|相应子类适用时|空|mm|根技术规格；成品阶段有变化写产出有效值；保留TMF对象分工
ropeDiameterMm|绳子标准直径|正十进制|绳子必填|空|mm|根技术规格；截断长度在技术用料，不自动创建物料SKU
trimShape|花边/装饰件形状|文本/字典|形状构成交付要求时|空|子类模板|根或SKU层级由已发布模板明确；不能两处并列可改
yarnUse|纱线用途|多选字典|纱线适用时|空|针织/车缝/包缝/绣花/织带|主档；与纱线颜色分开
bagLengthMm|包装袋长度|正十进制|包装袋SKU必填|空|mm|SKU identityValues；此处是耗材自身尺寸，不是物流箱尺寸
bagWidthMm|包装袋宽度|正十进制|包装袋SKU必填|空|mm|SKU identityValues
bagThicknessUm|包装袋厚度|正十进制|包装袋SKU必填|空|μm|SKU identityValues；导入不得把mm无换算直接填入
tapeWidthMm|胶带宽度|正十进制|胶带SKU必填|空|mm|SKU identityValues
tapeNominalLengthM|胶带标准卷长|正十进制|按固定卷交付时|空|M|独立交付规格时入SKU；仅包装变化时归PACK并通过模板固定归属
fluidGrade|油剂牌号|字符串|油剂SKU必填|空|牌号|SKU identityValues；非供应商名称
fluidViscosityGrade|黏度等级|字符串|油剂模板要求时|空|适用等级|SKU identityValues；等级不当纯数值换算
fluidNetContent|油剂净含量|正十进制|独立包装交付规格时|空|明确KG/L等|SKU规格或PACK含量按交付身份判定；不得与每基本单位净重混用
partModel|配件型号|字符串|设备配件SKU必填|空|型号|SKU identityValues
partDimensions|配件尺寸|有字段名/数值/单位的明细|模板要求时|空|mm等|SKU identityValues；孔距/直径/长宽高分别有名称
partMountingSpec|安装/接口规格|文本/字典|模板要求时|空|适配规格|SKU identityValues
compatibleEquipmentTypeId|适配设备类型|ID|配件适配行必填|空|设备类型字典|主档equipmentCompatibility明细；可多行
compatibleEquipmentModelId|适配设备型号|ID|明确型号限制时|空|相应设备型号|主档适配明细；不得放颜色字段
''')
add_fields('MSKU','物料SKU','P10','§7/§9','A02/C01/C06/C08/F03/F04', '''
materialSkuId|物料SKU ID|稳定ID|是|系统生成|无|合并现有SKU与变种为唯一身份
materialId|根物料主档|ID|是|投入继承或选择|MAT|不可随供方改变
materialSkuCode|物料SKU码|字符串|是|规则生成或保留迁入|编码规则|审核后锁定；旧码做别名
name|SKU名称|文本|是|根名与规格生成|无|可修订显示名
baseSpecSegment|基础规格段|稳定字符串|多基础规格时|B01建议|编码模板|已用唯一基础码不因新增规格追改
identityValues|本类身份规格|受控集合|模板要求|空|子类模板|纽扣直径/拉链长度/耗材尺寸等
colorId|颜色引用|ID|适用时|空|COLOR|耗材配件不通用强制
pantoneId|Pantone|ID|染色必填|空|COLOR|明确体系和色号
stage|当前加工阶段|枚举|是|基础|基础/染后/印后/绣后/烫画后|由当前加工定义推导
inputSkuId|直接投入SKU|ID|加工SKU必填|创建入口带入|MSKU|不能通过含X猜前驱
processDefinitionId|本道加工定义|ID|加工SKU必填|创建时生成|PROC|一产出一个直接定义
rootSkuId|基础投入SKU|派生ID|只读|沿前驱计算|MSKU|分支可追溯不作为第二可写前驱
effectiveSpecValues|阶段产出有效规格|结构集合|加工适用时|明确继承并记录|模板及单位|幅宽克重变更落实在产出；不是自动缩水计算
mainUnitId|主计量单位|ID|是|按适用类型建议|UNIT|每SKU一个；不再由root直接覆盖
defaultPricingUnitRelationId|默认计价单位关系|ID|成本完整时是|主单位|UOM|可用主单位或有效辅助关系
skuImageId|产出识别图|资料ID|审核前是|明确选择|图片|不能用花型图冒充实物结果
barcodeAliases|条码/旧码|字符串列表|否|来源保留|无|同一身份多识别码
technicalUsages|技术使用位置|只读引用|只读|从BOM和版本反查|技术域|不手填假引用数
''')
add_fields('PROC','物料加工定义','P10加工关系','§9','C01/C02/C03/C04/C05/C06/C07/C08', '''
processDefinitionId|加工定义ID|稳定ID|是|系统生成|无|每个产出对应一条定义
inputSkuId|投入SKU|ID|是|入口带入|MSKU|显式前驱；不能成环
outputSkuId|产出SKU|ID|是|新建生成|MSKU|与产出记录一致保存
processType|工艺|枚举|是|明确选择|染色/印花/绣花/烫画|本期物料身份工艺四种
objectType|作用对象|枚举|是|物料|物料/裁片/毛织部位/成衣|本表只保存物料；其他进入技术生产对象
processVersionId|工艺资料版本|ID|是|当前确认版本|技术资料|工艺参数变更可追溯
pantoneId|染色色号|ID|染色是|空|Pantone|强制体系和编号
patternId|花型|ID|印绣烫必填|空|花型库|pl编号是花型而非执行文件
patternVersionId|花型版本|ID|有花型时|明确选择|花型版本|资料修正与交付变更区分
printSide|印花面别|枚举|印花必填|A|A/AB|不再DM/SM；与渗透独立
penetration|是否渗透印|布尔|印花是|否|编码参数|是时必须入码
frontPatternVersionId|正面花型|ID|印花必填|取花型版本|花型|正反顺序明确
backPatternVersionId|反面花型|ID|AB必填|可同正面|花型|同花双面与不同花双面分清
executionAssetIds|执行工艺资料|ID列表|审核前按工艺要求|空|印花稿/绣花版/烫画稿|与展示图片分用途
unitBridgeVersionId|输入输出单位换算|ID|单位不同时|空|固定/规格关系|不得暗含损耗缩率
codeRuleVersionId|编码规则版本|ID|是|当前启用模板|规则|不按后改模板重生成旧码
deliveryRevisionSegment|交付修订段|字符串|实质版本差异时|空|R02等建议|普通资料纠错不加新码
''')
add_fields('UOM','SKU单位关系','P10计量单位','§8','B12/B13/B14', '''
relationId|换算关系ID|稳定ID|是|系统生成|无|包装规格不同可有不同关系
materialSkuId|物料SKU|ID|是|当前SKU|MSKU|独立维护
auxUnitId|辅助单位|ID|是|选择|UNIT|不与主单位重复
mainQtyPerAux|一辅助单位对应主单位数量|正十进制|是|空|主单位/辅助单位|方向固定；大于0；至少8位系数建议
basisType|换算依据类型|枚举|是|明确选择|固定/规格标准/包装含量|跨量纲不得无依据
basisReference|依据内容|文本/资料ID|规格标准时是|空|无|可追溯不默认1
packageSpecId|包装规格|ID|包装关系必填|空|PACK|相同包单位不同含量必须区分
uses|适用用途|多选|是|明确选择|采购/计价/发料|下游选择器只提供适用关系
isDefaultForUse|默认用途|集合标记|否|空|各用途|每用途最多一个默认
version|关系版本|整数|是|1|无|历史单据保留采用时系数
status|关系状态|枚举|是|有效|有效/停用|不能停掉当前唯一必要计价换算
changeReason|变更原因|文本|调整是|空|无|改系数必须说明；不重算历史
''')
add_fields('PACK','包装与物流','P03/P10包装物流','§8.2','B14/B15', '''
packageSpecId|包装规格ID|稳定ID|是|系统生成|无|可维护多种包装
ownerSkuId|所属SKU|ID|是|当前SKU|商品或物料SKU|对象种类明确
packageTypeId|包装类型|ID|是|空|包/箱/卷/筒等|不因包装名变化自动新SKU
contentQty|标准包装含量|正十进制|是|空|含量单位|与辅助关系对照一致
contentUnitId|含量单位|ID|是|主单位或有效关系|单位|不可只填600无单位
netWeightPerMainKg|每主单位净重|十进制|适用时|空|KG/主单位|不与面料g/m²混用
grossWeightKg|包装毛重|十进制|适用时|空|KG/本包装|注明测量基准
lengthCm|包装长|十进制|适用时|空|cm|大于0；未知为空
widthCm|包装宽|十进制|适用时|空|cm|不是面料幅宽
heightCm|包装高|十进制|适用时|空|cm|不得用0冒充实测
volumeM3|包装体积|计算/确认值|适用时|按尺寸计算|m³|明确来自尺寸还是确认资料
measurementBasis|测量基准|文本|有测量时|本包装|无|说明每件/每包；批次实测在外域
version|包装版本|整数|是|1|无|历史含量不随当前重写
''')
add_fields('COST','物料标准成本','P10标准成本','§10','D01/D02/D03/D04/D05/D06/D07/D08/D09/D10/D11/D12/D13', '''
costVersionId|成本版本ID|稳定ID|是|保存时生成|无|金额变化形成版本；展示换币不形成版本
materialSkuId|成本对象SKU|ID|是|当前SKU|MSKU|与加工阶段同身份
purchaseStandardCny|人工标准采购价|可空十进制|基础完整核价是|未维护|CNY/计价单位|含税；真实0需明确确认；非最近采购自动同步
transportStandardCny|基础标准运输价|可空十进制|基础完整核价是|未维护|CNY/计价单位|只计一次
purchaseIncludesTransport|采购价已含基础运输|布尔|基础是|明确选择|无|是时另计运输为0并留说明
processStandardCny|本道加工单价|可空十进制|加工完整核价是|未维护|CNY/产出计价单位|含税含辅材；无Asaya分价
pricingUnitRelationId|本成本计价单位|ID|是|SKU默认|UOM或主单位|本阶段按产出
predecessorCostVersionId|采用的上道标准|ID|加工是|当前前驱版本|COST|自动追随最新标准；历史快照保留
unitBridgeVersionId|上道归一单位依据|ID|单位不同时|空|UOM|不含损耗/缩率
inheritedCostCny|承接上道单价|计算十进制|只读|计算|CNY/本产出单位|缺上道/换算时不冒充完整
totalStandardCny|综合标准成本|计算十进制|只读|P+T或上道+F|CNY/本产出单位|后段运输及一次性费用不进入
sourceMoney|原币金额与币种|金额对象|存在原始来源时|保留来源|原币/原单位|不得丢弃旧币种；来源精度保留
normalizationBasis|归一计算依据|记录|原币非CNY时|人工确认|固定采用汇率/时间|与展示汇率区分；本期不自动重生效
taxIncluded|含税口径|只读布尔|是|是|无|不得混入未税标准
completeness|成本完整性|计算原因集合|只读|检查依赖|无|未维护与0分开
effectiveAt|标准生效时间|时间|是|保存成功时间|Asia/Shanghai显示|自动生效，无下游复核门槛
changeReason|成本变更原因|文本|修改是|空|无|版本可追溯
displayCurrency|展示币种|界面选择|是|RMB|CNY/IDR/USD|只是视图；不写标准或历史
displayFxId|展示汇率引用|ID|非CNY展示是|当前展示汇率|FX|缺汇率提示，不默认1
''')
add_fields('FX','展示汇率','P11价格展示','§10','D03/D12', '''
fxId|汇率ID|稳定ID|是|系统生成|无|仅展示参数
baseCurrency|基准币种|币种|是|CNY|CNY|页面可显示RMB标签
quoteCurrency|目标币种|币种|是|IDR或USD|IDR/USD|销售MYR是店铺价格币种，独立
rate|展示汇率|正十进制|是|人工填写|1CNY=X目标币|方向明确；无值不切换
source|汇率来源说明|文本|是|人工说明|无|示例与真实来源分开
asOf|采用时间|时间|是|维护时填写|时区|不设置成本汇率发布审批
''')
add_fields('STORE','店铺','P14','§11.1','E01/E02/E12', '''
storeId|店铺ID|稳定ID|是|系统生成|无|归并项目店铺与店铺主档的重复身份
storeCode|内部店铺编码|字符串|是|输入或生成|无|唯一且使用后稳定
storeName|店铺名称|文本|是|空|无|保留实际名称
channelCode|经营渠道|枚举|是|明确选择|Shopify/TikTok/独立站|其他渠道仅历史查询
externalStoreId|外部店铺ID|字符串|正式连接是|空|平台命名空间|不转数值；不能用内部名称冒充
marketCode|经营市场|枚举|是|ID|ID/MY|一店一个默认市场
salesCurrency|销售币种|币种|是|IDR或MYR按市场建议|ISO币种|不得读取结算币种代替
settlementCurrency|结算币种|币种|是|明确选择|ISO币种|独立保存
languageCode|默认销售语言|语言码|是|按市场建议|id/ms/en|实际内容语言明确
timeZone|店铺时区|时区码|是|按店铺配置|IANA|不使用浏览器时间覆盖业务时间
teamId|运营团队|ID|否|空|现有团队|不是开发项目
ownerId|负责人|人员ID|是|明确选择|人员目录|变更留痕
operatingStatus|经营状态|枚举|是|启用|启用/停用/历史|停用不等于平台已下架
inventorySource|可售规则来源|只读引用|是|WMS共享|WMS|删除手工库存/店铺分配模式
connectionDescription|渠道连接描述|非敏感元数据|否|演示连接|无|原型不收集真实密钥；不假装已连接生产
''')
add_fields('LIST','渠道PID容器','P12/P13','§11/§12','E03/E04/E06/E09/E10/E11', '''
listingId|内部渠道商品ID|稳定ID|是|系统生成|无|上传批次不能替代它
storeId|所属店铺|ID|是|明确选择|STORE|渠道/市场从店铺引用
platformProductId|外部PID|字符串|平台分配后是|发布前空|平台|渠道+店铺+PID唯一；不截断/不伪造
styleId|唯一款式|ID|是|选择|STYLE|全部外部规格只能映射本SPU
contentVersionId|渠道内容版本|ID|是|当前草稿|CONTENT|发布指定版本
platformCategoryId|平台类目|字符串|发布按平台规则|映射初始化|平台类目版本|不同于内部正式类目
platformBrandId|平台品牌|字符串|平台要求时|映射初始化|平台品牌|不改SPU品牌身份
platformAttributes|平台属性|键值集合|平台必填项是|映射初始化|平台类目属性定义|保留原始字段/单位和版本
handle|Handle|字符串|平台适用时|空|平台规则|只属于渠道内容
sourceTestingOrderId|可选测款单|ID|否|来源动作带入|测款|无开发项目必填
testingListingActionId|测款上架动作|ID|测款发起时|来源带入|动作记录|返回对应动作结果不串单
platformStatus|平台实际状态|只读状态|有观测时|未发布|平台状态对照|本地请求不冒充已在售
platformRawStatus|平台原状态|原值|有回执时|空|平台|保留来源码不直接作中文界面文案
syncStatus|同步状态|计算状态|只读|待发布或待同步|同步结果|当前版本全范围成功才一致
lastSuccessAt|最近成功同步时间|时间|有成功时|空|时区|不以尝试时间代替
sourceIdentity|来源身份|记录|迁入是|保存原值|历史系统|历史必须完整映射内部SKU
''')
add_fields('EXT','平台规格实例','P13规格映射','§11.3/§11.5','E03/E05/E08/E09/E13', '''
externalVariantId|内部平台规格记录ID|稳定ID|是|系统生成|无|同内部SKU可多条
listingId|父渠道商品|ID|是|当前LIST|LIST|唯一父容器
platformVariantId|平台规格ID|字符串|分配后是|发布前空|平台|渠道+店铺+PID+规格ID唯一
sellerSku|商家SKU文本|字符串|平台要求时|内部SKU码初始化|平台规则|不等于外部规格ID；可有不同文本
internalSkuId|内部SKU映射|ID|正式保存是|选择|SKU|必须属父SPU；不按此字段去重
displayColor|平台颜色显示|文本|平台要求时|内部名初始化|渠道内容|回传改名不改内部颜色
displaySize|平台尺码显示|文本|平台要求时|内部名初始化|单一尺码的外部别名|不创建市场尺码体系
displayPattern|平台花型显示|文本|适用时|内部名初始化|渠道内容|展示与身份分离
platformAttributeValues|平台规格属性|键值集合|平台要求时|初始化映射|平台属性|按实际外部实例保存
imageId|平台规格图片|资料ID|平台要求时|SKU图初始化|媒体|用途和版本明确
mappingVersion|映射版本|整数|是|1|无|改正保留旧订单快照
mappingEffectiveAt|映射生效时间|时间|是|保存成功|时区|新订单采用新版本
mappingReason|映射更正原因|文本|更正是|空|无|同SPU更正；未完履约移交OMS
defaultPriceGroupId|默认价组|ID|是|内部SKU店铺价组|PRICE|同SKU初始相同价
active|规格启停|布尔|是|是|无|外部下架回执独立；不删历史映射
''')
add_fields('PRICE','渠道价格','P13价格','§11.4','E07/E08', '''
priceId|价格记录ID|稳定ID|是|系统生成|无|默认与覆盖关系可追溯
storeId|价格店铺范围|ID|是|当前店铺|STORE|市场币种由店铺配置
internalSkuId|默认价所属SKU|ID|默认价是|映射带入|SKU|同店铺同SKU同类型默认共用
externalVariantId|覆盖对象|ID|覆盖价是|当前规格|EXT|按外部实例独立
priceType|价格类型|枚举|是|日常|吊牌/日常/直播/批发/清仓|保留五类语义，不复用单值
amount|价格金额|十进制|该价已设置时|未设置|销售币种|非负；发布日常价大于0；空与0分开
currency|币种|币种|是|店铺销售币种|ISO币种|不使用结算币种自动替换
mode|跟随或覆盖|枚举|是|跟随|默认/独立覆盖|改默认不覆盖已独立值
validFrom|起始时间|时间|限时价需要|空|店铺时区|与结束成对校验
validTo|结束时间|时间|限时价需要|空|店铺时区|大于开始；到期参考日常价
origin|变更来源|枚举|是|PCS|PCS/平台|平台改单实例价形成覆盖
version|价格版本|整数|是|1|无|同步按提交版本处理
''')
add_fields('SYNC','发布与同步记录','P13/P15','§12','E04/E10/E11/E12/E13', '''
operationId|业务操作ID|稳定ID|是|动作开始生成|无|重复提交/重试复用；不会再建另一PID
listingId|渠道商品|ID|是|当前对象|LIST|按对象记录
targetVariantIds|目标规格|ID列表|涉及规格时|本次明确范围|EXT|部分失败只重试失败项
action|动作|枚举|是|明确动作|发布/更新/下架/拉取/同步|动作意图和平台结果分开
direction|方向|枚举|是|动作决定|PCS到平台/平台到PCS/WMS到平台|字段责任不混用
fieldScope|字段范围|键列表|是|本次变更字段|字段同步矩阵|不支持字段不能报已同步
baseVersion|共同基线版本|版本引用|是|最近一致版本|无|同字段并发检测依据
submittedVersion|提交版本|版本引用|PCS发送时是|当前内容/价格版本|无|旧回执不能覆盖新资料
sourceEventId|来源变更ID|字符串|回传时是|外部或演示事件|无|防止自己回传形成循环
result|结果|枚举|是|未提交|提交中/成功/部分成功/失败/结果待核实|有相应回执才成功
receipt|逐对象回执|结构记录|有返回时|空|平台原值|保存外部ID/状态和字段结果
errorReason|失败原因|业务文本|失败时|空|无|说明对象、可重试动作；不让用户清缓存
conflictingValues|双方并发值|字段值集合|真实同字段冲突时|空|PCS值/平台值/版本|仅并发边界人工选最终值
observedAvailability|平台可售观测值|回执记录|数量同步时|来源回执|SKU单位|不是PCS可编辑库存或档案摘要
wmsSourceRef|WMS共享可售来源|ID/来源版本|数量同步时|权威来源|WMS|不建店铺分配量
startedAt|发起时间|时间|是|动作时间|时区|不等于成功时间
completedAt|完成时间|时间|收到确定结果时|空|时区|结果待核实不能填成功时间
''')
add_fields('ASSET','资料引用','P02/P10/P13','§13','F03/F04/F07', '''
assetId|资料ID|稳定ID|是|保存时生成或复用|无|文件引用而非Base64
ownerId|所属对象|ID|是|当前对象|无|跨对象共享同文件仍各有引用
role|资料用途|枚举|是|明确选择|实物图/花型图/执行稿/尺码图/视频/附件|角色不互相冒充
fileName|文件名|文本|是|原文件名|无|同名不代表相同文件
mimeType|文件类型|字符串|是|读取文件|MIME|受控白名单
sizeBytes|文件大小|整数|是|读取文件|bytes|展示真实大小
fileRef|文件实体引用|ID/静态资源路径|是|保存生成|Blob或静态资源|临时objectURL不作持久地址
version|资料版本|整数|是|1|无|替换保留有效历史引用
sortOrder|显示顺序|整数|否|末位|无|主图角色唯一
''')
add_fields('GOV','共用审核与审计','所有档案与配置','§4/§13','F01/F02/F03/F04/F05/F06/F07', '''
reviewStatus|审核状态|枚举|是|草稿|草稿/待审核/通过|驳回回草稿并说明原因
lifecycleStatus|使用状态|枚举|是|未启用|未启用/启用/停用/归档|不与技术包/库存/平台状态合并
recordVersion|记录版本|整数|是|1|无|保存核对版本避免多标签静默覆盖
createdAt|建档时间|时间|是|保存成功|时区|不当库存入库时间
createdBy|建档人|人员ID|是|当前操作人|现有人员|真实操作身份
updatedAt|更新时间|时间|是|保存成功|时区|未保存不变
updatedBy|修改人|人员ID|是|当前操作人|现有人员|与审核人可同一人
reviewedAt|审核时间|时间|审核后|空|时区|保留独立动作
reviewedBy|审核人|人员ID|审核后|空|现有人员|不禁止作者自审
sourceSystem|来源系统|字符串|迁入时|空|无|保留真实来源
sourceId|原记录ID|字符串|迁入时|空|来源命名空间|不能只保留可变名称
legacyCode|历史业务码|字符串列表|存在旧码时|来源值|无|可查可扫码；不建历史修复工作台
legacyValues|必要历史原值|受控来源记录|有语义待核时|原值保留|来源字段/币种/单位|不作为目标可写业务字段
changeLog|动作日志|对象引用|是|按真实动作|无|原值新值、原因、操作者、时间
''')


def write_csv(name, rows):
    assert rows
    with (HERE / name).open('w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


write_csv('field-dictionary.csv', fields)
field_index = {(f['object'], f['field_key']): f['field_id'] for f in fields}

# 每条是一个可独立判断的要求。源决策可以关联多个原子要求。
requirements = []


def reqs(domain, section, wp, impl, rows):
    for line in rows.strip().splitlines():
        refs, requirement, acceptance = line.split('|')
        number = sum(r['requirement_id'].startswith(domain + '-') for r in requirements) + 1
        rid = f'{domain}-{number:03}'
        source_doc = '../2026-10-04-product-material-domain-audit-v2/confirmed-rules-and-refinements.md §1/§9' if refs.startswith('USR-') else ('../../../AGENTS.md' if refs=='AGENTS' else '../2026-10-04-product-material-domain-audit-v2/decision-register-2026-10-05.md')
        pages = {'ARCH':'P01-P17 对应身份入口','CFG':'P11 基础配置及P02/P10取值表单','PROD':'P01-P03 款式与规格',
                 'MAT':'P04-P10 五类物料与SKU详情','CODE':'P10 加工定义/编码预览及条码打印','UOM':'P10 计量单位/包装物流',
                 'COST':'P10 标准成本、P11展示汇率、P17 BOM','CHAN':'P12-P14 渠道商品/规格/店铺',
                 'SYNC':'P13/P15 同步、P16测款上架及WMS来源','BRIDGE':'P16/P17 测款/技术与既有毛织对象',
                 'GOV':'P01-P17 全部适用页面及相关打印'}[domain]
        requirements.append(dict(requirement_id=rid,
            source=f'{source_doc} {refs}; prototype-adjustment-proposal.md {section}',
            decision_refs=refs, atomic_requirement=requirement, work_package=wp,
            implementation_position=impl, automation=f'待实施：验证 {acceptance}',
            page_device_performance=f'待实施：{pages}；管理端1366×768及1280×720；适用动作完整结果<500ms；不适用项按实施计划说明',
            status='待实施', evidence='尚无实现/验收证据；现状仅见current-prototype-evidence.md',
            product_confirmation=f'业务方向：用户2026-10-05及既有确认；细化方案：R1待评审；来源{refs}'))


reqs('ARCH','§2/§3','WP01','src/data/pcs-material-archive-types.ts; pcs-style-archive-types.ts; pcs-sku-archive-types.ts', '''
A01|保留五类物料身份并将服装纽扣拉链归辅料|五类均可建档且不进入设备配件
A02|基础及加工产出只使用一个物料SKU身份|同一产出没有独立variant第二份记录
A03|新根码可系统生成且迁入原码保留|两种来源编码均可追溯
A03|人工指定编码限建档且唯一|审核后修改编码被阻止
A04|服装规格默认颜色加统一尺码|同色同尺无交付差异不可重复
A04|实质款式改变建立新SPU|不能用渠道改名替代新款式身份
A05|品牌交付标准不同使用不同SPU|同款关系不合并两品牌规格
A07|同款关联不合并身份|加入同款后SKU和渠道映射不改变
A07|替代关系独立维护适用条件|同款不能自动获得替代资格
A08|采购来源地区和默认仓不在档案编辑|跳转采购时由采购选择实际条件
USR-010|商品物料档案不提供供应商字段或供应商Tab|详情表单及导入模板无供方编辑
USR-011|商品物料档案不提供库存输入或库存摘要|列表详情和保存结构均无库存事实
''')
reqs('ARCH','§1/§15','WP01','目标原型范围及参数；仅在对应业务文件内实现', '''
AGENTS|仅实现原型页面Mock和必要轻交互|不创建真实平台接口或微服务领域框架
F06|实际成本与历史异常治理不进入本期页面|无额外费用分摊或历史修复工作台
A06/C05|未给定的精确编码字符和组合结构标为本轮方案建议|不能把细化参数倒写成用户此前已逐字确认
''')
reqs('CFG','§5','WP02','src/pages/pcs-config-workspace.ts; src/data/pcs-config-dimensions.ts; pcs-config-workspace-repository.ts', '''
B01|面料根规格维护成分组织幅宽克重|结构属性具备数值及单位
B02|辅料子类加载各自身份模板|纽扣直径与拉链长度不共用泛规格字段
B03|纱支体系数值股数和捻度结构化保存|改变筒重不改纱线身份
B04|耗材按包装袋胶带油剂等适用模板展示|不适用颜色不会阻断耗材保存
B05|设备适配为多值独立关系|适配设备不存入colorName
B06|空差从目标表单导入及计算中排除|任何宽度计算不读取空差
B07|只维护一个语义为有效幅宽的字段|150cm直接使用不额外扣减
B08|染色规格审核前必须有Pantone体系和号|只有色样图时审核失败
B09|所有服装只用一套尺码字典|跨市场同一内部尺码ID不复制
B10|品牌主分类和商品定位使用单选|保存结构只容纳一个有效引用
B10|风格流行元素特殊工艺人群年龄定位分别多选|字段互不覆盖
B11|品类风格品类编号是三个字典|套装休闲89编号可同时保存
B11|风格编号相关键完整迁移为品类编号|数组排序不改变89业务码
B11|原343项配置及浏览器当前新增项均保留语义和来源|同名跨维度不自动合并且不以旧快照覆盖当前有效项
F04|已用模板变更生成新版本|旧档案标准不被配置编辑静默改写
F05|停用字典不供新选但保留历史显示|旧引用可读新表单不可选
''')
reqs('PROD','§6','WP03','src/pages/pcs-product-archives.ts; src/pages/pcs-product-information.ts; src/data/pcs-style-product-information.ts', '''
A04|款式无需测款历史即可建档|没有测款单仍可保存并审核
A04|商品SKU审核和启用不依赖技术包发布|技术包为空不篡改档案审核结果
A06|固定实物套装以SKU按套交付|档案主单位与套装交付一致
A06|虚拟组合以组合SPU和SKU承接|平台规格只映射组合SKU
A06|虚拟组合记录组件SKU和正数量|无组件自引用循环或嵌套虚拟组合
A06|组合交付变更保留历史组成版本|旧订单组件不随当前调整被替换
E06|工厂尺寸由技术资料维护|档案和渠道只引用版本
E04|基础销售内容只初始化或更新未覆盖草稿|已发布店铺覆盖值不被基础改动抹掉
E05|平台规格别名不改变内部色码身份|Hitam和Black可映射同内部颜色SKU
E09|内部SKU无渠道关联是合法状态|不标缺映射错误
E09|SKU渠道关联只显示真实持久外部实例|平台ID不由SKU字符串拼成
F07|材料意向和正式BOM只在技术域维护|SKU详情不另存可写expectedMaterials事实
''')
reqs('MAT','§7/§9','WP04','src/pages/pcs-material-archives.ts; pcs-material-archive-detail.ts; src/data/pcs-material-archive-repository.ts; pcs-material-variant-repository.ts', '''
A02|五类列表提供共用主档和SKU视图|视图切换不会创建新记录
A02|删除独立变种创建和维护入口|加工树节点进入同一SKU详情
B01|阶段技术变化保存在产出SKU有效规格|根主档变更不能静默改旧阶段规格
F03|新审核SKU具备可识别资料|无图或仅无关占位图不能满足识别要求
F07|复制主档只复制资料与允许属性|不复制审核及生产事实
F07|复制SKU必须有真实身份差异|同规格复制被指回既有SKU
F07|条码打印使用SKU身份和真实图文|打印不改变库存或业务状态
C01|染印绣烫物料加工产生新SKU|四种工艺都有完整前驱产出
C01|裁片压褶打揽不产生物料SKU|操作进入技术生产对象
C02|同目标返工不自动生成永久SKU|返工仍引用原目标身份
C02|对象变化后同工艺可再次出现|面料印花后裁片印花不被全链禁重
C04|花型ID与执行文件分用途关联|pl编号不是绣花版文件本身
C06|资料小修与交付改变分开|小修留版本而实质差异新产出
C07|加工建单不要求库存有量或接口成功|WMS断开仍可按加工业务条件建单
C08|多基础规格使用实际前驱完整码|两种基础投入不撞同一个产出码
''')
reqs('CODE','§9.2','WP04','src/data/pcs-material-variant-repository.ts; src/data/pcs-design-revision-material-sku.ts（现有规则统一到物料SKU）', '''
C05|单面A双面AB进入印花码|无DM或SM生成值
C05|渗透印有独立入码段|同花同面普通和渗透码不同
C01|烫画具有明确工艺编码段|TH建议模板正确保留前驱
C04|不同花双面保留正反顺序|交换正反对应不同交付定义
C06|同花号交付变化有修订段|资料小修不改变旧码
C08|编码使用结构字段生成并保留规则版本|不靠解析字符X寻找前驱
A03|旧码别名可查可扫码|旧xPT映射同一目标身份
A03|生成码超长时禁止静默截断|超过建议256字符给出可改原因
B08|不同Pantone体系同号不发生新编码冲突|非默认体系显式段且旧资料不猜体系
''')
reqs('UOM','§8','WP05','src/pages/pcs-material-archive-detail.ts; src/data/pcs-material-archive-types.ts; pcs-material-archive-repository.ts', '''
B12|每物料SKU有且只有一个主单位|根档案不再有第二个可写主单位
B12|SKU详情有独立计量单位Tab|刷新直达仍读正确SKU单位
B12|辅助关系使用1辅=X主的固定方向|米码和包PCS显示一致且X正数
B13|跨量纲换算必须具备规格依据|KG与M缺依据不能保存
B13|批次实测不覆盖标准换算|历史单据按当时系数读取
B14|包装含量和包装规格独立保存|同名包的100与600含量可区分
B14|纯包装变化不自动新增永久SKU|修改包装版本不改物料码
B15|净重毛重与面料克重分属不同基准|KG和g/m²不能互填
B15|体积来源明确且未知不默填零|包装尺寸和面料幅宽不混用
F04|使用过的主单位锁定|辅助调整生成新版本不重算历史
''')
reqs('COST','§10','WP06','src/data/pcs-material-archive-repository.ts; pcs-tech-pack-bom-price-review-invalidation.ts; 技术BOM价格读取', '''
D01|印花染色取消Asaya分价|界面和保存模型只有共同标准
D02|标准采购成本人工维护|实际采购价变化不自动改标准
D03|默认人民币支持IDR和USD展示|切换不改变成本原值及版本
D03|缺展示汇率有明确反馈|不默认使用1或展示零
D04|全部标准价统一含税|表单及导出口径一致
D05|基础运输只累计一次|已含运采购不再重复加T
D05|后段运输不进入公式|加工表单无额外运输输入行
D06|损耗缩率不进入本期物料公式|加法结果不乘损耗缩率
D07|加工费按产出单位表达|元米转元码使用正确方向
D08|辅材已含在加工费中|染化料绣花线不重复加项
D09|不纳入一次性费和分摊|公式无制网开版打样摊销
D10|未维护与真实零值不同|缺价链不能标完整核价
D11|来源精度保留且统一末次舍入|不逐层按展示4位截断
D12|上游变化自动更新所有依赖分支|5变6时示例链变7/7.8/9且不要求下游复核
D12|展示汇率变化不触发成本重新生效|标准版本数和历史金额不变
D13|已确认已发布历史成本快照不被改写|原已发布BOM仍用原成本
D13|未发布草稿读最新参考并显示变化|普通读取不写一整包业务快照
''')
reqs('CHAN','§11','WP07','src/pages/pcs-channel-products.ts; pcs-channel-stores.ts; src/data/pcs-channel-listing-spec-types.ts; pcs-channel-product-project-repository.ts', '''
E01|当前新刊登仅三渠道两市场|停用来源只在含历史范围展示
E02|店铺销售币种与结算币种分开|MY销售MYR不被结算CNY替换
E02|默认一个店铺一个市场|不建设多市场工作台
E03|一个PID只对应同一SPU|跨款式SKU选择和保存都阻止
E03|平台规格实例有独立稳定身份|同PID两外部ID映射同内部SKU均保留
E04|店铺内容覆盖值独立|另一个店铺标题变化不串改
E05|外部规格显示属性与内部身份映射分开|外部改尺码名不建内部新尺码
E06|销售尺码图记录技术来源版本|可回到原工厂尺寸资料
E07|五类价格语义分别保存|吊牌日常直播批发清仓互不覆盖
E08|同SKU外部实例默认同价且允许覆盖|默认调价只改跟随项
E08|平台侧改单实例价形成该实例覆盖|不扩散改其他外部ID价格
E09|正式历史和新渠道明细都匹配内部SKU|导入缺映射阻断且不落待匹配队列
E10|测款渠道上架是可选来源入口|无项目和测款先通过条件
E10|删除项目身份字段及必填依赖|保存渠道商品不要求projectId
E13|映射更正保存版本并保持旧订单快照|旧订单不因映射更正被自动重绑
E13|未完成履约受映射更正影响时移交OMS处理|显示受影响引用而非直接改订单
E07|价格有效期使用店铺时区|结束不得早于开始且到期按日常价展示
E01|店铺停用阻止新增刊登而保留历史|不会把经营停用伪报平台下架
E09|复制渠道商品清空原外部身份|新容器保留完整内部映射且不复用源PID
''')
reqs('SYNC','§12','WP08','src/pages/pcs-channel-products.ts; 渠道发布/同步轻量记录与现有店铺同步页面', '''
E11|正常PCS变更自动同步平台|当前回执成功后显示一致
E11|正常平台变更自动进入渠道记录|不要求逐次人工采纳
E11|同字段同时修改才进入差异处理|不同字段可合并且同步不互相覆盖
E11|旧回执不能覆盖新版本|迟到回执只记历史
E11|回传识别本次同步来源防止循环|自身回传不无限再发
E11|部分失败只重试失败范围|成功外部ID不因重试重复新建
E11|首次发布结果未知时先核实同次操作|不盲目重发创建新PID
E11|平台不支持字段不能标同步成功|保留本地语义并显示适用限制
E12|多个外部实例共用同一WMS可售来源|100不累加成300且无店铺预分量
E12|平台回传数量不改WMS权威库存|只在同步回执保留观测值
E10|发布结果返回准确测款上架动作|不串另一个测款单或发布批次
E11|演示同步与真实API能力分开标示|无伪造真实连接成功声明
''')
reqs('BRIDGE','§9.3/§12.4','WP09','src/data/pcs-technical-data-version-types.ts; pcs-design-revision-material-sku.ts; src/data/fcs/wool-domain/types.ts', '''
C03|多色纱线通过技术BOM保存多投入|不任选一种纱线当唯一前驱
C03|毛织部位片复用既有产出对象|不增第六物料类或每片永久SKU
C03|kg片件各按真实对象使用|一件计划不冒充一片产出
C03|横机报告不等于缝盘完成|两阶段事实关联仍分开
C01|设计改款可连续染色再印花|移除印花自动排除染色的目标串联限制
E10|先上架测款不解除生产准备业务门槛|测款结论仍按原业务控制后续生产
''')
reqs('GOV','§4/§13/§14','WP10','src/main.ts; src/router/route-renderers.ts; 相关PCS记录/附件存储入口与专项检查', '''
F01|同一操作人可以维护并审核|有权限时不因作者等于审核人阻断
F02|主档和首批SKU可一并审核|两者结果原子且可追溯
F02|后加SKU独立审核|已通过同档其他SKU不被重置
F03|身份资料完整性与成本完整性分开|缺价可建档但不作完整核价
F04|名称翻译修正留痕但不换身份|旧业务快照保留当时信息
F05|停用不自动终止在途或下架渠道|各领域动作需明确发起
F06|不建设历史坏数据治理或待匹配正式队列|样例和菜单均无此模块
F07|业务导入先预览再按主对象原子保存|主档和明细不会半套成功
F07|导出覆盖筛选的全部匹配记录|跨分页导出无操作列
F07|真实图片可预览和打印|不存在已识别图片加载失败却宣称验收
USR-013|全部PCS页面无浏览器资料维护工具|正常和读取失败页面无备份迁移清理入口
AGENTS|记录及文件使用现有IndexedDB轻量存储|保存成功以事务complete为准
AGENTS|普通读取和初始化不写业务数据|首次打开不整包种子落盘
AGENTS|复制记录复用附件且有效引用不误删|文件字节不重复存入JSON
AGENTS|多标签冲突及重复提交有记录级保护|不静默覆盖或重复建对象
AGENTS|失败保留输入与旧记录并可重试|不回退localStorage虚报成功
AGENTS|适用页面与动作完整结果严格小于500ms|任何慢样本不以平均值掩盖
AGENTS|主管PDA与打印只消费正确引用且不增加档案维护页|相关桥接按既有设备定向验收
F07|默认20行并支持筛选分页列配置|排序和重进默认一致且计数对应筛选
F07|查询重置导出位于完整筛选卡|空集导出有业务反馈
F07|编码名称识别图归同一单元格|窄屏可辨认且可打开原图
F07|批量动作展示选中数和逐项结果|不能只用通用成功提示掩盖失败项
F05|停用归档等影响动作二次确认|取消不改变业务数据
F02|审核动作有明确前置条件和结果|草稿待审通过与使用状态分开
F01|标准成本维护使用独立职责|不借用买手版师审核名单作为金额权限
AGENTS|普通页面读取失败仅提示原因和重试|无清空缓存或资料迁移工具
AGENTS|业务导入导出不变成浏览器整库备份恢复|字段模板与操作仅含业务对象
''')
write_csv('requirement-traceability.csv', requirements)

decisions=[]
text=(AUDIT/'decision-register-2026-10-05.md').read_text()
for line in text.splitlines():
    if re.match(r'^\| [A-F]\d\d \|',line):
        cells=[s.strip() for s in line.strip('|').split('|')]
        did,rule,source,state=cells
        linked=[r for r in requirements if did in r['decision_refs'].split('/')]
        assert linked, did
        decisions.append(dict(decision_id=did,confirmed_rule=rule,source=source,
            proposal_sections='; '.join(dict.fromkeys(r['source'].split('; ')[-1] for r in linked)),
            requirement_ids=';'.join(r['requirement_id'] for r in linked),coverage='已映射到方案与待实施需求；不是已实现'))
assert len(decisions)==64
write_csv('decision-coverage.csv',decisions)

# 已盘点403字段的逐项处置；作用域对象/动作DTO/统计投影分别处理。
old=list(csv.DictReader((AUDIT/'prototype-fields.csv').open(encoding='utf-8-sig')))
special={
 'projectId':('移除目标业务字段','LIST.sourceTestingOrderId','项目不是业务对象；若真实来源为测款使用明确测款引用'),
 'projectCode':('移除目标业务字段','GOV.legacyValues','保留必要来源追溯，不再显示项目列'),
 'projectName':('移除目标业务字段','GOV.legacyValues','不作为渠道或款式必填'),
 'projectNodeId':('移除目标业务字段','LIST.testingListingActionId','仅真实测款上架动作另行明确映射'),
 'sourceProjectId':('移除目标业务字段','LIST.sourceTestingOrderId','款式本身不需要来源项目；保留测款关联需证明来源'),
 'sourceProjectCode':('移除目标业务字段','GOV.legacyValues','旧值仅来源追溯'),
 'sourceProjectName':('移除目标业务字段','GOV.legacyValues','不进入目标表单'),
 'sourceProjectNodeId':('移除目标业务字段','GOV.legacyValues','不以节点驱动档案状态'),
 'legacyOriginProject':('来源保留','GOV.legacyValues','原来源字符串不创建项目业务对象'),
 'rawOriginProject':('退役旧治理对象','GOV.legacyValues','不建历史待治理队列'),
 'stockQty':('移出PCS事实','GOV.legacyValues','WMS唯一库存；原手填数量只留必要来源，不伪装平台回执或迁成权威库存'),
 'mappingHealth':('移除历史治理状态','EXT.internalSkuId','正式映射完整；无渠道链接合法；新保存仍校验'),
 'pendingItems':('退役旧治理容器','GOV.legacyValues','历史缺父重复等场景不在本期'),
 'expectedMaterials':('迁出到技术域','外域:技术资料材料意向/BOM','不在SKU保存第二份可写BOM'),
 'linkedProjectStoreIds':('合并店铺身份映射','STORE.storeId','存量关系归一storeId并保留来源；不保留双店铺主表'),
 'channelTitle':('迁到渠道内容','CONTENT.title','不作为内部SKU的另一个标题事实'),
 'suggestedRetailPrice':('迁到销售价格','PRICE.amount','按吊牌/建议语义保留，币种范围明确'),
 'widthText':('结构化迁移','MAT.widthCm','仅有效幅宽；不可猜缺失单位'),
 'gramWeightText':('结构化迁移','MAT.gramWeightGsm','明确g/m²；旧90g不能直接认作合格克重'),
 'weightText':('结构化并保留来源','PACK.netWeightPerMainKg','确认基准与单位，不只存展示串'),
 'volumeText':('结构化并保留来源','PACK.volumeM3','明确包装及体积单位'),
 'variantId':('合并唯一SKU身份','MSKU.materialSkuId','旧ID转来源映射；不留独立变种身份'),
 'predecessorVariantId':('合并显式前驱','MSKU.inputSkuId','指向实际前驱SKU'),
 'variantCode':('合并SKU编码','MSKU.materialSkuCode','保留已用原码别名；不再两处可写'),
 'baseSkuCode':('改用稳定身份引用','MSKU.inputSkuId','编码只作可读显示/来源，不用于前驱主关联'),
 'chainCategory':('派生视图','MSKU.stage','基础/加工由SKU关系判定'),
 'layerIndex':('派生视图','MSKU.inputSkuId','根据无环前驱关系计算，不单独手填'),
 'designRevisionProcesses':('统一加工定义','PROC.processType','支持染后再印；不让PRINT排除DYE'),
 'designRevisionRawSkuId':('统一加工定义','MSKU.rootSkuId','原始投入通过关系追溯'),
 'designRevisionDyedSkuId':('统一加工定义','MSKU.inputSkuId','印后SKU直接关联染后SKU'),
 'temporarySpuName':('移除临时身份命名','STYLE.styleName','直接建档后是正式款式对象；必要旧值留来源'),
 'upstreamChannelProductCode':('归一外部身份','LIST.platformProductId','需核对原值确为PID；不拼装'),
 'upstreamProductId':('归一外部身份','LIST.platformProductId','双字段核同后只保留一个外部PID事实'),
 'upstreamSkuId':('保留外部身份','EXT.platformVariantId','按不透明字符串保存；新增内部SKU映射'),
 'listingBatchCode':('迁到发布动作','SYNC.operationId','批次仅一次发布操作，非商品主身份'),
 'listingBatchId':('迁到发布动作/媒体归属','SYNC.operationId','实际父商品使用listingId；有序媒体属内容版本'),
 'listingBatchStatus':('迁到发布结果','SYNC.result','与平台实际状态分开'),
 'uploadedSpecLineCount':('计算发布结果','SYNC.receipt','按当次目标规格成功数统计'),
 'specLineCount':('关联统计','EXT.externalVariantId','外部实例数与内部SKU去重数分开'),
 'currencyCode':('按费用领域迁移','PRICE.currency','渠道价用销售币种，材料价用原币/计算币种，不能混为通用字段'),
 'currency':('按费用领域迁移','PRICE.currency','明确本对象价格币种并去掉重复别名'),
 'priceRangeLabel':('销售参考展示','PRICE.amount','不作为款式身份或材料成本'),
 'costPricingStatus':('技术核价只读引用','STYLE.technicalRefs','来自核价版本，不由主档写入'),
 'techPackStatus':('技术资料只读引用','STYLE.technicalRefs','不决定款式能否建档'),
 'baseInfoStatus':('重组校验与审核','GOV.reviewStatus','必填资料完整性与生命周期分开'),
 'specificationStatus':('重组校验与审核','GOV.reviewStatus','规格各自审核，不互相覆盖'),
 'productType':('明确交付方式','STYLE.deliveryMode','普通/实物套装/虚拟组合按实际语义映射'),
 'styleCodes':('完整更名','STYLE.categoryNumberId','品类编号独立，编码不可随数组位置改变'),
}
common={
 'createdAt':'GOV.createdAt','createdBy':'GOV.createdBy','updatedAt':'GOV.updatedAt','updatedBy':'GOV.updatedBy',
 'operatorName':'GOV.updatedBy','operator':'GOV.updatedBy','time':'GOV.updatedAt','generatedAt':'GOV.createdAt','generatedBy':'GOV.createdBy',
 'legacySystem':'GOV.sourceSystem','legacyCode':'GOV.legacyCode','archiveStatus':'GOV.lifecycleStatus','status':'GOV.lifecycleStatus',
 'mainImageId':'ASSET.assetId','mainImageUrl':'ASSET.fileRef','galleryImageIds':'ASSET.assetId','galleryImageUrls':'ASSET.fileRef',
 'imageId':'ASSET.assetId','imageUrl':'ASSET.fileRef','imageName':'ASSET.fileName','skuImageUrl':'ASSET.fileRef',
 'patternImageUrl':'ASSET.fileRef','productImageId':'ASSET.assetId','productImageUrl':'ASSET.fileRef','productImageName':'ASSET.fileName',
 'weightKg':'PACK.netWeightPerMainKg','lengthCm':'PACK.lengthCm','widthCm':'PACK.widthCm','heightCm':'PACK.heightCm',
 'packagingInfo':'PACK.packageSpecId','barcode':'MSKU.barcodeAliases','barcodeTemplateCode':'MAT.barcodeTemplateId',
 'mainUnit':'MSKU.mainUnitId','auxiliaryUnits':'UOM.auxUnitId','unitConversions':'UOM.relationId','pricingUnit':'MSKU.defaultPricingUnitRelationId',
 'fromUnit':'UOM.auxUnitId','toUnit':'MSKU.mainUnitId','factor':'UOM.mainQtyPerAux',
 'colorName':'COLOR.colorName','pantoneCode':'COLOR.pantoneNumber','pantoneRef':'COLOR.pantoneId','patternCode':'PROC.patternId',
 'processType':'PROC.processType','processCode':'PROC.processType','processName':'PROC.processType','craftCode':'PROC.processVersionId','processes':'PROC.processDefinitionId',
 'materialId':'MAT.materialId','materialCode':'MAT.materialCode','materialName':'MAT.materialName','materialNameEn':'MAT.materialNameTranslations',
 'kind':'MAT.kind','categoryName':'MAT.subcategoryId','specSummary':'MAT.specSummary','composition':'MAT.compositionLines','processTags':'PROC.processType',
 'materialSkuId':'MSKU.materialSkuId','materialSkuCode':'MSKU.materialSkuCode','specName':'MSKU.identityValues','sizeName':'SKU.sizeId',
 'styleId':'STYLE.styleId','styleCode':'STYLE.styleCode','styleName':'STYLE.styleName','styleNameEn':'STYLE.styleNameTranslations',
 'styleNumber':'STYLE.styleNumber','brandId':'STYLE.brandId','brandName':'STYLE.brandId','yearTag':'STYLE.year','seasonTags':'STYLE.seasonIds',
 'categoryId':'STYLE.formalCategoryId','subCategoryId':'STYLE.formalCategoryId','subCategoryName':'STYLE.formalCategoryId','thirdCategoryName':'STYLE.formalCategoryId',
 'productCategoryId':'STYLE.formalCategoryId','productConfigRefs':'CFG.optionId','productInformationVersion':'GOV.recordVersion',
 'materialType':'STYLE.materialStructure','categoryTags':'STYLE.categoryIds','popularElementTags':'STYLE.trendElementIds','fabricTags':'STYLE.marketingFabricIds',
 'ageTags':'STYLE.ageIds','audiencePositionTags':'STYLE.audiencePositionIds','categoryCode':'STYLE.categoryNumberId','categoryCodeName':'STYLE.categoryNumberId',
 'productPosition':'STYLE.productPositionId','styleTags':'STYLE.styleTagIds','targetAudienceTags':'STYLE.crowdIds','buyerId':'STYLE.buyerId','buyerName':'STYLE.buyerId',
 'skuId':'SKU.skuId','skuCode':'SKU.skuCode','skuName':'SKU.skuName','skuNameEn':'SKU.skuNameTranslations','printName':'SKU.patternIdentityId',
 'sellingPointText':'CONTENT.sellingPoints','detailDescription':'CONTENT.descriptionHtml','imageSource':'ASSET.role',
 'channelProductId':'LIST.listingId','channelProductCode':'LIST.listingId','storeId':'STORE.storeId','masterStoreId':'STORE.storeId','storeName':'STORE.storeName',
 'channelCode':'STORE.channelCode','channelName':'STORE.channelCode','settlementCurrency':'STORE.settlementCurrency','pricingCurrency':'STORE.salesCurrency',
 'listingTitle':'CONTENT.title','styleListingTitle':'CONTENT.title','listingDescription':'CONTENT.descriptionHtml',
 'listingPrice':'PRICE.amount','defaultPriceAmount':'PRICE.amount','priceAmount':'PRICE.amount',
 'specLines':'EXT.externalVariantId','specLineId':'EXT.externalVariantId','specLineCode':'EXT.externalVariantId','sellerSku':'EXT.sellerSku',
 'lineStatus':'SYNC.result','channelProductStatus':'LIST.platformStatus','upstreamSyncStatus':'LIST.syncStatus','lastUpstreamSyncAt':'LIST.lastSuccessAt',
 'uploadResultText':'SYNC.receipt','uploadedAt':'SYNC.completedAt','listingImages':'CONTENT.mediaRefs','mainImageUrls':'CONTENT.mediaRefs','detailImageUrls':'CONTENT.mediaRefs',
 'listingMainImageId':'ASSET.assetId','listingImageIds':'ASSET.assetId','listingImageSource':'ASSET.role','listingImageConfirmedAt':'GOV.reviewedAt',
 'listingImageConfirmedBy':'GOV.reviewedBy','listingImageId':'ASSET.assetId','sortNo':'ASSET.sortOrder','mainFlag':'ASSET.role','sourceType':'ASSET.role',
 'id':'CFG.optionId','code':'CFG.businessCode','name_zh':'CFG.nameZh','name_en':'CFG.nameForeign','nameZh':'CFG.nameZh','nameEn':'CFG.nameForeign','sortOrder':'CFG.sortOrder',
 'parentId':'TPL.parentCategoryId','level':'TPL.parentCategoryId','logs':'CFG.logs','action':'GOV.changeLog','detail':'GOV.changeLog','logId':'GOV.changeLog',
 'usageId':'MSKU.technicalUsages','technicalVersionId':'STYLE.technicalRefs','technicalVersionLabel':'STYLE.technicalRefs','consumptionText':'MSKU.technicalUsages',
 'techPackVersionId':'STYLE.technicalRefs','techPackVersionCode':'STYLE.technicalRefs','techPackVersionLabel':'STYLE.technicalRefs',
 'remark':'GOV.changeLog','listingRemark':'GOV.changeLog','displayName':'MSKU.name','name':'CFG.nameZh','description':'TPL.helpText',
}
dispositions=[]
for n,row in enumerate(old,1):
    obj,key=row['object'],row['field']
    if key in special:
        action,target,note=special[key]
    elif 'StoreSnapshot' in obj or obj=='ConfigWorkspaceSnapshot':
        action,target,note='退役整包持久化容器','存储:按记录仓库与事务','保留业务记录语义；禁止将整包快照搬入IndexedDB持续重写'
    elif obj=='StyleArchivePendingItem':
        action,target,note='退役历史治理对象','GOV.legacyValues','本期不建设缺父/重复待治理工作台；原始证据仍保留'
    elif obj=='SkuExpectedMaterialLine':
        action,target,note='迁出到技术域','外域:技术资料材料意向/BOM','整条材料意向及数量、单位、说明均保留到技术草稿；不在商品SKU再维护第二份BOM'
    elif obj in ['MaterialLogRecord','ConfigLog']:
        action,target,note='保留事件日志字段','GOV.changeLog','保留日志自身ID、所属对象、摘要、详情、操作人和发生时间；不把日志ID当配置ID或操作时间当当前档案更新时间'
    elif obj=='MaterialUsageRecord':
        action,target,note='保留技术使用引用','MSKU.technicalUsages','保留所属物料/款式、技术版本和使用摘要；由技术域关联计算，不新增另一份档案或手工引用统计'
    elif obj in ['FlatDimensionMeta','ConfigWorkspaceSummaryItem'] and key in ['id','name','description']:
        action,target,note='保留配置面板元数据','CFG.dimension','本项标识属性维度和面板说明；不是该字典下的某个选项ID'
    elif obj=='ProductCategoryNode' and key in ['id','code','name','parentId','level']:
        target={'id':'TPL.categoryId','code':'TPL.categoryCode','name':'TPL.categoryName','parentId':'TPL.parentCategoryId','level':'TPL.parentCategoryId'}[key]
        action,note='保留分类结构','层级从父子关系推导，不能把层级数字保存为父ID' if key=='level' else '分类ID/业务码/名称及父节点分开；不与属性选项混为同一命名空间'
    elif obj=='ProductCategoryDraft' and key=='name':
        action,target,note='保留分类草稿名称','TPL.categoryName','与分类树正式记录同字段规则'
    elif key in ['ok','existed','message','error','variant','style'] and (obj.endswith('Result') or obj.endswith('Input')):
        action,target,note='动作结果收口','动作:显式校验结果','不是档案主字段；变种结果转SKU结果'
    elif key=='costPrice':
        if obj.startswith('SkuArchive'):
            action,target,note='迁到技术核价引用','STYLE.technicalRefs','成衣核价由技术/核价域维护，来源金额保留快照'
        else:
            action,target,note='拆分标准成本','COST.purchaseStandardCny','原cost含义按来源核实；不能把综合价误作采购价再叠运输'
    elif key=='freightCost':
        action,target,note=('迁出成衣物流费用','外域:物流/成衣核价','不得在商品SKU身份重复维护') if obj.startswith('SkuArchive') else ('拆分基础标准运输','COST.transportStandardCny','派生阶段不再新增运输成本')
    elif key.endswith('Count') or key in ['count','lastListingAt','targetChannelCodes']:
        action,target,note='保留只读关联投影','关联投影:对应领域记录','从真实关联计算，不把缓存计数/最后上架时间当可写主事实'
    elif key.startswith('currentTechPack') or key.startswith('inherited') or key=='linkedDesignRevisionTaskIds':
        action,target,note='保留技术域引用','STYLE.technicalRefs','技术版本/设计任务/素材继承来源保留，不引入开发项目'
    elif key in ['invalidatedReason','effectiveAt','invalidatedAt']:
        action,target,note='拆分状态与审计','GOV.changeLog','保留渠道停用/发布实际动作时序，不混为单一status'
    elif key in common:
        action,target,note='保留并按目标归属收口',common[key],'按字段字典类型和必填规则保存；原有副本仅显示投影'
        if key in ['mainUnit','auxiliaryUnits','unitConversions','pricingUnit'] and obj=='MaterialArchiveRecord':
            action,note='下沉每个物料SKU','主档仅创建时提供批量默认；不保留第二可写单位事实'
        if key=='colorName' and obj.startswith('Material'):
            note='物料配件现有设备值转适配关系；真正颜色转颜色字典；不得强行按颜色处理全部类型'
        if key=='sizeName' and obj.startswith('Material'):
            target,note='MSKU.identityValues','物料非服装尺码；按分类拆为对应规格字段'
        if key=='skuId' and obj=='PcsProjectChannelProductRecord':
            action,target,note='下沉平台规格映射','EXT.internalSkuId','父PID不以单个skuId代表全部规格'
        if key in ['skuCode','skuName'] and obj=='PcsProjectChannelProductRecord':
            action,target,note='下沉映射显示','EXT.internalSkuId','由每条平台规格所映射内部SKU读取编码和名称；父PID不另存一个SKU代表全部规格'
        if key in ['styleId','styleCode','styleName'] and obj=='PcsProjectChannelProductRecord':
            action,target,note='渠道父记录引用款式','LIST.styleId','只保存款式稳定ID，编码名称读取款式投影；不在渠道另建款式主资料'
        if obj=='SkuArchiveRecord' and key in ['barcode','colorName','pricingUnit','unitConversions']:
            target={'barcode':'SKU.barcodeAliases','colorName':'SKU.colorId','pricingUnit':'SKU.mainUnitId','unitConversions':'PACK.contentUnitId'}[key]
            note='商品规格使用商品身份与交付单位；原销售计价含义归PRICE，不误迁到物料SKU；包装换算有依据'
        if key=='status' and obj in ['ConfigOption','ProductCategoryNode','ConfigWorkspaceOptionDraft','ProductCategoryDraft']:
            target,note='CFG.status','字典启停，不套业务档案审核状态'
        if key in ['colorName','sizeName','printName'] and obj.startswith('ChannelListingSpecLine'):
            target={'colorName':'EXT.displayColor','sizeName':'EXT.displaySize','printName':'EXT.displayPattern'}[key]
            note='保留平台显示名，新增internalSkuId显式映射'
        if key=='categoryName' and obj=='StyleArchiveShellRecord':
            target,note='STYLE.formalCategoryId','类目名称来自正式分类引用'
        if key=='remark':
            target,note='对象备注及GOV.changeLog','备注留在本对象；修改动作另留审计'
    else:
        raise ValueError(f'未处置字段: {obj}.{key}')
    dispositions.append(dict(source_index=n,source_file=row['file'],source_object=obj,source_field=key,
         source_type=row['type'],source_optional=row['optional'],source_line=row['line'],disposition=action,
         target_contract=target,detail=note,status='处置设计；未执行转换',evidence='403字段来自2026-10-04审计快照；本轮关键结构补核见current-prototype-evidence.md'))
write_csv('prototype-field-disposition.csv',dispositions)

# 对69组线上观察指定目标位置。外域信息明确保留承接责任，不能硬塞进PCS主档。
online_targets = {
1:('保留身份','STYLE.styleCode;SKU.skuCode;GOV.sourceId','§6'),2:('分层承接','CONTENT.title;CONTENT.languageCode','§6.2/§11.3'),
3:('保留内容版本','CONTENT.descriptionHtml','§6.2/§11.3'),4:('技术域承接','外域:技术尺寸版本;STYLE.technicalRefs','§6.3'),
5:('保留来源引用','CONTENT.sizeChartAssetId;CONTENT.sizeChartSourceVersionId','§11.3'),6:('采购域承接','外域:采购供货策略','§2'),
7:('技术域承接','外域:工艺要求;PROC.processType','§9'),8:('区分交付方式','STYLE.deliveryMode;COMP.componentSkuId','§6.4'),
9:('保留技术分类','STYLE.materialStructure','§6'),10:('保留身份与映射','STYLE.brandId;LIST.platformBrandId','§5/§11'),
11:('渠道内容承接','LIST.handle','§11.3'),12:('分开内部平台分类','STYLE.formalCategoryId;LIST.platformCategoryId','§5'),
13:('移出PCS库存事实','外域:WMS;GOV.legacyValues','§2/§12.3'),14:('按测量基准承接','PACK.netWeightPerMainKg;PACK.lengthCm;PACK.widthCm;PACK.heightCm','§8.2'),
15:('按适用成本或物流域承接','COST.transportStandardCny;外域:物流计价','§10'),16:('销售价格承接','PRICE.priceType;PRICE.amount','§11.4'),
17:('保留原值待来源核实','STYLE.buyerId;GOV.legacyValues','§15'),18:('供方域承接','外域:采购供应商资料','§2'),
19:('采购域承接','外域:采购货源关系','§2'),20:('保留对象备注','STYLE.remark;MAT.remark;GOV.changeLog','§4'),
21:('保留资料与用途','ASSET.role;CONTENT.mediaRefs','§13'),22:('独立属性承接','STYLE.categoryIds;STYLE.styleTagIds;STYLE.trendElementIds;STYLE.marketingFabricIds;STYLE.crowdIds;STYLE.ageIds;STYLE.audiencePositionIds','§5'),
23:('完整命名收口','STYLE.categoryNumberId;CFG.businessCode','§5'),24:('独立属性承接','STYLE.productPositionId','§5'),
25:('区分标签和技术','STYLE.specialCraftTagIds;外域:工艺技术','§5/§9'),26:('分用途承接','MAT.compositionLines;LIST.platformAttributes','§5'),
27:('技术意向承接','外域:技术资料材料意向','§6.3'),28:('技术加工定义承接','PROC.processType;MSKU.inputSkuId','§9'),
29:('渠道属性承接','LIST.platformAttributes','§11.3'),30:('身份与显示分开','SKU.colorId;SKU.sizeId;EXT.displayColor;EXT.displaySize','§6/§11'),
31:('五类价格分开','PRICE.priceType;PRICE.amount','§11.4'),32:('成衣核价域承接','STYLE.technicalRefs;GOV.legacyValues','§6.3'),
33:('审核维度拆分','GOV.reviewStatus','§4'),34:('渠道外部身份与回执','STORE.storeId;LIST.platformProductId;SYNC.completedAt','§11/§12'),
35:('技术生产事实承接','STYLE.technicalRefs;外域:生产执行','§2/§12.4'),36:('WMS承接','外域:WMS','§2'),
37:('经营分析承接','外域:经营分析与商品运营标签','§2'),38:('保留真实事件语义','GOV.createdBy;GOV.createdAt;GOV.sourceSystem;GOV.legacyValues','§4/§13'),
39:('同款与标签分开','STYLE.sameStyleRelations;STYLE.trendElementIds','§6.2'),40:('五类与子类映射','MAT.kind;MAT.subcategoryId','§5'),
41:('按证据映射阶段','MSKU.stage;GOV.legacyValues','§7/§15'),42:('纱线类别承接','MAT.kind;MAT.categoryAttributes','§5'),
43:('采购/WMS承接','外域:默认收货策略和实际单据','§2'),44:('保留身份','MAT.materialCode;MAT.materialName;MAT.materialNameTranslations','§7'),
45:('标准成本拆分','COST.totalStandardCny;GOV.legacyValues','§10'),46:('保留原币与人工标准','COST.purchaseStandardCny;COST.sourceMoney;COST.normalizationBasis','§10'),
47:('基础运输承接','COST.transportStandardCny;COST.sourceMoney','§10'),48:('计算字段','COST.totalStandardCny','§10'),
49:('单位独立视图','UNIT.code;MSKU.mainUnitId;UOM.auxUnitId','§8'),50:('包装关系承接','PACK.contentQty;PACK.contentUnitId;UOM.packageSpecId','§8'),
51:('核实基准后映射','MAT.gramWeightGsm;PACK.netWeightPerMainKg;GOV.legacyValues','§15'),52:('本期明确排除','原始调查证据保留；无目标业务字段','§5'),
53:('单一有效幅宽','MAT.widthCm;MSKU.effectiveSpecValues','§5/§7'),54:('结构成分承接','MAT.compositionLines;CFG.businessCode','§5'),
55:('组织结构承接','MAT.structureId','§5'),56:('供方域承接并保留Vendor原义待核','外域:采购供应商;GOV.legacyValues','§2/§15'),
57:('采购物流策略承接','外域:采购区域/物流策略','§2'),58:('资料引用承接','ASSET.assetId;ASSET.role;ASSET.fileRef','§13'),
59:('审核生命周期分开','GOV.reviewStatus;GOV.lifecycleStatus','§4'),60:('显式加工定义','PROC.processType;PROC.objectType','§9'),
61:('颜色与采购来源分开','COLOR.colorId;COLOR.pantoneSystem;COLOR.pantoneNumber;外域:采购来源','§9'),
62:('按结构模板生成','MSKU.materialSkuCode;PROC.codeRuleVersionId','§9.2'),63:('花型资料独立','PROC.patternId;PROC.patternVersionId;ASSET.role','§9'),
64:('按来源证据映射','MSKU.identityValues;MSKU.inputSkuId;PROC.processType;GOV.legacyValues','§9/§15'),
65:('取消品牌分栏保留历史原值','COST.purchaseStandardCny;COST.transportStandardCny;COST.processStandardCny;GOV.legacyValues','§10'),
66:('统一标准价','COST.purchaseStandardCny;COST.transportStandardCny;COST.processStandardCny','§10'),
67:('测量基准分开','PACK.volumeM3;PACK.netWeightPerMainKg;PACK.grossWeightKg','§8.2'),68:('WMS承接','外域:WMS;GOV.legacyValues','§2'),
69:('资料身份审计承接','ASSET.role;MSKU.materialSkuCode;GOV.createdAt','§7/§13')}
online=[]
for row in csv.DictReader((AUDIT/'online-field-mapping.csv').open(encoding='utf-8-sig')):
    i=int(row['id'].split('-')[1]);action,target,section=online_targets[i]
    online.append(dict(source_id=row['id'],source_page=row['source_page'],observed_fields=row['visible_fields'],
       disposition=action,target_fields=target,proposal_section=section,confirmed_basis=row['confirmation_refs'],
       status='方案已指定承接；未迁移；来源未核实项按§15保留',source_evidence='../2026-10-04-product-material-domain-audit-v2/online-field-mapping.csv'))
write_csv('online-information-coverage.csv',online)
print({'fields':len(fields),'requirements':len(requirements),'decisions':len(decisions),'prototype_fields':len(dispositions),'online_groups':len(online)})
