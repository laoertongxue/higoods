# 物料监控与决策：原子需求追踪矩阵

> 日期：2026-09-14。依据：[完整方案v2.0](/Users/laoer/.codex/.chatgpt-projects/g-p-69be5bc99ce08191941a97f8eb4a9bd5/物料监控与决策子域-完整产品方案-v2.0.md)（完整设计原件）；目标仓库 `AGENTS.md`。产品确认人及确认版本待确认。本表记录原型实现与局部验收；不是全方案或生产系统完成证明。

## 边界与工作包

本仓库是可操作产品原型。所有库存、事件、角色、审批、通知和执行回执演示必须标明模拟。生产接口、源账务、服务端权限及实际通知不可由前端演示宣称完成。生产依赖标为 `已阻塞`；可演示能力按条目记录实施及验证状态。验证中UT表示 `tests/unit/material-decision.test.ts`，UI表示 `tests/material-decision.spec.ts`（1366×768及1280×720命名页面；局部交互、图片大图、空值、失败状态）。证据按条目回填；已验证仅限本地原型的对应原子结果，不代表所在页面通过素材门禁或生产集成完成。测试日志由主代理执行，本次只读取日志、测试与代码，不重复运行。产品确认人仍待确认。

|工作包|职责|计划路径|
|---|---|---|
|W1|档案、对象、快照与模拟材料|`src/data/material-decision/{model,fixtures}.ts`|
|W2|供需、加工、包材与质量计算|`src/data/material-decision/calculations.ts`|
|W3|七入口、明细、筛选与导出|`src/pages/material-decision/{index,views,events}.ts`|
|W4|模拟风险、方案、配置流程|`src/data/material-decision/workflow.ts`、页面`events.ts`|
|W5|依赖登记、集成与权限模拟边界|`workflow.ts`、`fixtures.ts`；生产服务待绑定|
|W6|全量追踪、验收与交付证据|两测试文件及审查记录；路由接线由主任务绑定实际文件|

## 规范性条款矩阵

不同子项只在结果不可分离时合并；字段合同用原文章节逐字段核对。AT用例在后表独立保留，不能替代本表。页面及真实集成行的UT不替代浏览器或服务端证据。

|编号|来源|可判定结果|工作包|计划实现位置|自动化验证|页面/设备/生产验证|状态|证据|产品确认人/版本|
|---|---|---|---|---|---|---|---|---|---|
|SCOPE-001|方案§1.1—1.3|物料判断使用SKU与供给范围而非SPU总量|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|SCOPE-002|方案§1.1—1.3|每个风险展示物料范围、供需、时间、规则、完整度|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|SCOPE-003|方案§1.1—1.3|同范围同供给只计一次|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|SCOPE-004|方案§1.1—1.3|同范围同需求只计一次|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|SCOPE-005|方案§1.1—1.3|共用SKU不按品牌复制库存|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|SCOPE-006|方案§1.1—1.3|规则模拟不改变原始事实|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|SCOPE-007|方案§1.1—1.3|数据缺失显示不可计算或部分覆盖|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DOMAIN-001|方案§2.1—2.3|入口归属数据决策系统下供应链域的物料监控与决策|W1|`src/pages/material-decision/views.ts`：`renderBody`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；UI七路由可见；未专项断言层级全部字段|待确认/v2.0|
|DOMAIN-002|方案§2.1—2.3|生产监控以同级子域表达|W1|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DOMAIN-003|方案§2.1—2.3|采购仓储质量候选子域不宣称已建成|W1|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DOMAIN-004|方案§2.1—2.3|物料域仅输出物料缺口和可用时间不推导整体交付结论|W1|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DOMAIN-005|方案§2.1—2.3|分析记录不成为第二套正式库存账|W1|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DOMAIN-006|方案§2.1—2.3|旧页面不迁移、不停用、不作为完成率目标|W1|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ROLE-001|方案§3|供应链负责人能从总览进入方案比较|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ROLE-002|方案§3|计划采购人员能从缺口进入补充建议|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ROLE-003|方案§3|PPIC能查看需求日期与优先级|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ROLE-004|方案§3|仓储负责人能查看分布占用及数据问题|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ROLE-005|方案§3|加工负责人能查看等待与延误|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ROLE-006|方案§3|包装负责人能按品牌规格查看耗用|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ROLE-007|方案§3|资料负责人能定位映射异常|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ROLE-008|方案§3|规则管理员能进入版本试算|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|MODEL-001|方案§4.1—4.3|物料保留来源ID内部ID编码类型品牌规格颜色用途单位启停|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|MODEL-002|方案§4.1—4.3|地点保留来源编码工厂库区时区主体启停|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|MODEL-003|方案§4.1—4.3|库存事实绑定快照SKU批次位置质量数量与流水|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|MODEL-004|方案§4.1—4.3|占用作为分配关系不叠加为物理库存|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|MODEL-005|方案§4.1—4.3|承诺记录源行批次目标SKU未完成量日期状态目的地|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|MODEL-006|方案§4.1—4.3|需求记录源行数量地点日期优先级已履行及转化关联|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|MODEL-007|方案§4.1—4.3|实际占用与试算分配分列|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|MODEL-008|方案§4.1—4.3|加工转换支持步骤出现序号及多投入多产出|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|MODEL-009|方案§4.1—4.3|正式范围同类决策仅有一个主方案|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|MODEL-010|方案§4.1—4.3|持续风险保存首次发现最近更新与责任人|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|MODEL-011|方案§4.1—4.3|方案可有多个动作且一个动作覆盖多需求|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|MODEL-012|方案§4.1—4.3|正式BOM、分析口径、决策策略使用不同来源标签|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|MODEL-013|方案§4.1—4.3|临时假设显示模拟标记|W1|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RANGE-001|方案§5.1—5.3|分类支持面料辅料纱线包材耗材配件|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RANGE-002|方案§5.1—5.3|同SKU多用途使用同一库存池|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RANGE-003|方案§5.1—5.3|17条仓库档案编码名称属性与方案一致|W1|`src/data/material-decision/fixtures.ts`：`warehouses`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；UT只断言17条与成衣名称；未逐字段自动对照|待确认/v2.0|
|RANGE-004|方案§5.1—5.3|F&M WH显示88库区2770库位|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RANGE-005|方案§5.1—5.3|A&C WH显示92库区3115库位|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RANGE-006|方案§5.1—5.3|成衣库存不计为物料可用库存|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RANGE-007|方案§5.1—5.3|成衣仓物料纳入依赖实际SKU记录而非仓库属性|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RANGE-008|方案§5.1—5.3|七类加工场景标为待映射不伪造七个仓库|W1|`src/pages/material-decision/views.ts`：`renderBody`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；七场景待映射已渲染，未专项UI逐项断言|待确认/v2.0|
|RANGE-009|方案§5.1—5.3|停用仓残余库存可追溯|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RANGE-010|方案§5.1—5.3|停用仓默认不新增分配|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RANGE-011|方案§5.1—5.3|国家ID不能替代业务时区|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RANGE-012|方案§5.1—5.3|供给范围可选择SKU地点货权用途质量调拨条件|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RANGE-013|方案§5.1—5.3|重叠正式供给池联合分配而非重复承诺|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RANGE-014|方案§5.1—5.3|独立模拟重复引用资源标明不可相加|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RANGE-015|方案§5.1—5.3|跨仓候选资源在许可和可调达之前不作确定供给|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-001|方案§6.1—6.3|指标定义包含ID粒度单位公式来源时间窗时区精度版本责任人水位|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-002|方案§6.1—6.3|实存按SKU物理形态分组|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-003|方案§6.1—6.3|质量排除按明细集合去重|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-004|方案§6.1—6.3|自由可用等于合格减有效占用|W2|`src/data/material-decision/calculations.ts`：`assess`|UT AT01/02|不适用：本行为纯数量/去重算法合同；所在页面素材门禁独立阻塞|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|METRIC-005|方案§6.1—6.3|自由量负数保留异常不归零|W2|`src/data/material-decision/calculations.ts`：`assess`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；free保留负值；未测试负自由量界面|待确认/v2.0|
|METRIC-006|方案§6.1—6.3|运输中数量按交接来源去重|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-007|方案§6.1—6.3|已确认未来供给使用合法剩余量和可用时点|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-008|方案§6.1—6.3|日均实际耗用按完整自然日除净耗|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-009|方案§6.1—6.3|内部移交不当实际耗用|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-010|方案§6.1—6.3|订单折算日均显示销量用量系数与窗口|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-011|方案§6.1—6.3|覆盖天数不充当确定齐料结论|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-012|方案§6.1—6.3|首次缺口按时间匹配计算|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-013|方案§6.1—6.3|最大缺口不跨单位相加|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-014|方案§6.1—6.3|到货延期保留基准承诺|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-015|方案§6.1—6.3|零需求时覆盖不适用|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-016|方案§6.1—6.3|未知数据时覆盖不可算|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-017|方案§6.1—6.3|有限大数不展示无解释无穷|W2|`src/data/material-decision/calculations.ts`：`assess`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；覆盖为null；界面不可算而非完整无需求文案，需产品复核|待确认/v2.0|
|METRIC-018|方案§6.1—6.3|全局实物当前可用未来计划分别展示|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-019|方案§6.1—6.3|待审核供给仅进入候选情景|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-020|方案§6.1—6.3|已收待检不同时保留同量采购未收|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-021|方案§6.1—6.3|合格入库后冲减未来供给|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-022|方案§6.1—6.3|加工缺路线原料能力或日期时转候选|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-023|方案§6.1—6.3|逾期无新承诺不默认延至今天|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-024|方案§6.1—6.3|取消剩余承诺不抹除现存实物|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|METRIC-025|方案§6.1—6.3|基准保守计划三个情景不相加|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-001|方案§6.4—6.5|BOM锁定版本可追溯|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-002|方案§6.4—6.5|净耗加成式损耗使用乘一加损耗|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-003|方案§6.4—6.5|已含损耗不重复加成|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-004|方案§6.4—6.5|收得率使用净需求除收得率|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-005|方案§6.4—6.5|未履行需求减已履行不混同领用消耗|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-006|方案§6.4—6.5|中央发料与工厂投料按阶段防重复扣减|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-007|方案§6.4—6.5|销售预测转生产关联量退出预测|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-008|方案§6.4—6.5|预选估算不直接生成精确颜色采购|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-009|方案§6.4—6.5|已反映库存实际耗用不再次扣未来需求|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-010|方案§6.4—6.5|关联未知预测分情景并提示重叠未知|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-011|方案§6.4—6.5|额外人工需求必须声明是否包含已有计划|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-012|方案§6.4—6.5|日均默认7完整日并支持30与90|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-013|方案§6.4—6.5|预测窗口默认60支持7、15、30、60、90|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-014|方案§6.4—6.5|跨时区保留UTC并按范围业务日归属|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-015|方案§6.4—6.5|未完结今日独立标识|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-016|方案§6.4—6.5|同比环比完整程度一致|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|DEMAND-017|方案§6.4—6.5|历史发布结果与新规则重算分别标识|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|BALANCE-001|方案§6.6—6.7|B0扣范围外有效预留不扣内部预留|W2|`src/data/material-decision/calculations.ts`：`assess`|UT AT01/02|不适用：本行为纯数量/去重算法合同；所在页面素材门禁独立阻塞|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|BALANCE-002|方案§6.6—6.7|余额递推加首次可用供给减未履行与去重预测|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|BALANCE-003|方案§6.6—6.7|分配先硬占用再时间授权优先级及稳定ID|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|BALANCE-004|方案§6.6—6.7|占用归属未知显示覆盖不完整|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|BALANCE-005|方案§6.6—6.7|精确时间按事件顺序匹配|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|BALANCE-006|方案§6.6—6.7|仅日期默认当日需求先供给并提示不确定|W2|`src/data/material-decision/calculations.ts`：`assess`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；日内minimum与头部同日顺序提示；无同日用例|待确认/v2.0|
|BALANCE-007|方案§6.6—6.7|局部限制不能被公司正余额抵消|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|BALANCE-008|方案§6.6—6.7|固定策略目标线不得低于触发线|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|BALANCE-009|方案§6.6—6.7|补充量取可用后窗口安全量减基线的最大正值|W2|`src/data/material-decision/calculations.ts`：`assess`|UT AT09 intermediate deficit|不适用：本行为纯数量/去重算法合同；所在页面素材门禁独立阻塞|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|BALANCE-010|方案§6.6—6.7|到货前缺口单独保留不宣称普通采购解决|W2|`src/data/material-decision/calculations.ts`：`compareCandidate`|UT candidate comparison retains pre-arrival risk；UI SKU strategy组|UI方案比较保留到货前缺口|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|BALANCE-011|方案§6.6—6.7|正净量按MOQ和整包倍数上取整|W2|`src/data/material-decision/calculations.ts`：`roundReplenishment`|UT AT10|不适用：本行为纯数量/去重算法合同；所在页面素材门禁独立阻塞|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|BALANCE-012|方案§6.6—6.7|零净量不强制MOQ|W2|`src/data/material-decision/calculations.ts`：`roundReplenishment`|UT AT10|不适用：本行为纯数量/去重算法合同；所在页面素材门禁独立阻塞|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|BALANCE-013|方案§6.6—6.7|卷数不使用全局平均卷长折算|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|BALANCE-014|方案§6.6—6.7|当前日起目标周期不重复加提前期|W2|`src/data/material-decision/calculations.ts`：`assess`|UT AT11|不适用：本行为纯数量/去重算法合同；所在页面素材门禁独立阻塞|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|BALANCE-015|方案§6.6—6.7|到货后目标期仅加一次提前期|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|BALANCE-016|方案§6.6—6.7|安全天数不重复加量|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|BALANCE-017|方案§6.6—6.7|组合动作逐项重算剩余缺口|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|BALANCE-018|方案§6.6—6.7|未知成本不填0|W2|`src/pages/material-decision/views.ts`：`renderDetail`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；成本未知文案存在；缺金额完整度场景验证|待确认/v2.0|
|PROCESS-001|方案§7.1—7.3|加工路线不预设固定染印顺序|W2|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PROCESS-002|方案§7.1—7.3|加工明细包含输入输出数量单位计划实际交接目的地责任人|W2|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PROCESS-003|方案§7.1—7.3|预计可用包含加工后工序运输质检|W2|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PROCESS-004|方案§7.1—7.3|缺关键节点时间不生成确定日期|W2|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PROCESS-005|方案§7.1—7.3|部分产出发出接收按数量段并存|W2|`src/pages/material-decision/processing.ts`：`evaluateProcessing；renderProcessingPanel`|UT AT06；UI processing disjoint组|UI独立加工数量段；不与主供给链联动|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|PROCESS-006|方案§7.1—7.3|业务完成交接质量状态独立|W2|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PROCESS-007|方案§7.1—7.3|返工段可重新进入加工过程|W2|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PROCESS-008|方案§7.1—7.3|取消加工仍保留实物处置事项|W2|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PROCESS-009|方案§7.1—7.3|白坯不可当目标色当前可用|W2|`src/pages/material-decision/processing.ts`：`evaluateProcessing`|UT AT05/06/07、§7.2 loss；UI processing disjoint组|UI独立加工剩余60、空目标、不合格；不与主供给链联动|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|PROCESS-010|方案§7.1—7.3|已投坯布不能重复分配给其他任务|W2|`src/pages/material-decision/processing.ts`：`evaluateProcessing`|UT AT05/06/07、§7.2 loss；UI processing disjoint组|UI独立加工剩余60、空目标、不合格；不与主供给链联动|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|PROCESS-011|方案§7.1—7.3|预计产出按实际接收冲减|W2|`src/pages/material-decision/processing.ts`：`evaluateProcessing`|UT AT05/06/07、§7.2 loss；UI processing disjoint组|UI独立加工剩余60、空目标、不合格；不与主供给链联动|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|PROCESS-012|方案§7.1—7.3|损耗不合格未完成分别展示|W2|`src/pages/material-decision/processing.ts`：`evaluateProcessing`|UT AT05/06/07、§7.2 loss；UI processing disjoint组|UI独立加工剩余60、空目标、不合格；不与主供给链联动|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|PROCESS-013|方案§7.1—7.3|目标SKU为空排除目标供给|W2|`src/pages/material-decision/processing.ts`：`evaluateProcessing`|UT AT05/06/07、§7.2 loss；UI processing disjoint组|UI独立加工剩余60、空目标、不合格；不与主供给链联动|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|PROCESS-014|方案§7.1—7.3|采购加工调拨链按关联去重|W2|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PROCESS-015|方案§7.1—7.3|供给链关联未知提示重叠不直接相加|W2|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PROCESS-016|方案§7.1—7.3|比较成品采购、调拨、现坯加工、购坯加工四类候选|W2|`src/pages/material-decision/processing.ts`：`renderProcessingPanel`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；四候选存在；未全部参数路径验收|待确认/v2.0|
|PROCESS-017|方案§7.1—7.3|方案显示可执行量最早日残余缺口投入路线能力成本阻塞|W2|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PROCESS-018|方案§7.1—7.3|转换关系缺失仅显示待核实选项|W2|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PROCESS-019|方案§7.1—7.3|替代料只能使用有效批准范围|W2|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PROCESS-020|方案§7.1—7.3|建议0显示具体原因及单据|W2|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PROCESS-021|方案§7.1—7.3|有效执行单据跟踪剩余量不重复全量建议|W2|`src/data/material-decision/model.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PACKAGE-001|方案§8.1—8.3|历史7类10SPU28SKU仅作为清单枚举|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PACKAGE-002|方案§8.1—8.3|WLID002短码规格码保留未核实关系|W1|`src/data/material-decision/fixtures.ts`：`materials`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；旧短码独立且待核实；未全码目录验证|待确认/v2.0|
|PACKAGE-003|方案§8.1—8.3|WLID001与FLSZ385及405不自动覆盖替代|W1|`src/data/material-decision/fixtures.ts`：`materials`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；新旧袋保留待核实；未全部替代路径验收|待确认/v2.0|
|PACKAGE-004|方案§8.1—8.3|ASAYA重复袋码不擅自生成机器SKU|W1|`src/data/material-decision/fixtures.ts`：`materials`|UT AT16/17 directory；UI packaging conflict组|UI消耗页有重复码待核实及不造码说明；不涉及图片通过|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|PACKAGE-005|方案§8.1—8.3|图片斜线不推断不存在其他SKU|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PACKAGE-006|方案§8.1—8.3|共用白吊粒按三品牌共同资源池|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PACKAGE-007|方案§8.1—8.3|未找到吊牌配套不新造库存SPU|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PACKAGE-008|方案§8.1—8.3|6c与6.5c原始规格不擅定厚度单位|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PACKAGE-009|方案§8.1—8.3|包材规则包含品牌场景方式规格目的地单耗基数有效期|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PACKAGE-010|方案§8.1—8.3|内袋基数使用适用包装件数|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PACKAGE-011|方案§8.1—8.3|外袋基数使用包裹数|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PACKAGE-012|方案§8.1—8.3|标签面单基数使用打印张数|W1|`src/pages/material-decision/packaging.ts`：`renderPackagingPanel`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|待实施|代码核对；碳带缺换算显示不可算；无有效换算实现|待确认/v2.0|
|PACKAGE-013|方案§8.1—8.3|碳带按有效打印换算不按每件一卷|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PACKAGE-014|方案§8.1—8.3|额外损耗与良率参数互斥|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PACKAGE-015|方案§8.1—8.3|取消订单只撤未发生需求不自动回实耗库存|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PACKAGE-016|方案§8.1—8.3|事件按源ID及修订处理重复与冲正|W1|`src/pages/material-decision/packaging.ts`：`summarizePackagingEvents`|UT event duplicate / conflicting same revision；UI packaging conflict组|UI独立回传序列净领用80、重打5；不与主库存联动|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|PACKAGE-017|方案§8.1—8.3|实际包裹替代关联预测不叠加|W1|`src/pages/material-decision/packaging.ts`：`renderPackagingPanel`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|待实施|代码核对；仅文字声明，不应视作自动预测替换已实现|待确认/v2.0|
|PACKAGE-018|方案§8.1—8.3|齐套取适用组件可分配量除单耗最小值|W1|`src/pages/material-decision/packaging.ts`：`renderPackagingPanel；kitCapacity`|UT AT19/20；UI packaging conflict组|UI独立齐套80与单耗未知；不与全景库存联动|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|PACKAGE-019|方案§8.1—8.3|缺单耗或单位时齐套不可算|W1|`src/pages/material-decision/packaging.ts`：`renderPackagingPanel；kitCapacity`|UT AT19/20；UI packaging conflict组|UI独立齐套80与单耗未知；不与全景库存联动|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|PACKAGE-020|方案§8.1—8.3|不同品牌独立最大量注明不可相加|W1|`src/pages/material-decision/packaging.ts`：`renderPackagingPanel`|UT AT18 white pendant；UI packaging conflict组|独立面板可见每品牌100不可相加；未验证主库存联合分配|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|PACKAGE-021|方案§8.1—8.3|旧新袋尺寸方式分别监控|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PACKAGE-022|方案§8.1—8.3|停用物料显示残余处置建议|W1|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-001|方案§9.1—9.3|七类风险能独立表达|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-002|方案§9.1—9.3|等级综合影响时间恢复时间规模而非仅覆盖日|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-003|方案§9.1—9.3|同SPU短缺和超储可并存|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-004|方案§9.1—9.3|连续同问题更新同风险事件|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-005|方案§9.1—9.3|换版风险保留关联与变化说明|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-006|方案§9.1—9.3|复发记录关联与间隔|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-007|方案§9.1—9.3|客观风险与处理状态分离|W4|`src/data/material-decision/workflow.ts`：`moveRisk`|UT AT31；UI risk closure blocked组|UI缺口未解不能关闭；认领与处理不改变缺口|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|RISK-008|方案§9.1—9.3|认领采购暂缓不自动解除客观风险|W4|`src/data/material-decision/workflow.ts`：`moveRisk`|UT AT31；UI risk closure blocked组|UI缺口未解不能关闭；认领与处理不改变缺口|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|RISK-009|方案§9.1—9.3|暂缓需理由和复查时间|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-010|方案§9.1—9.3|暂缓到期或升级返回待确认|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-011|方案§9.1—9.3|执行失败返回处理中|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-012|方案§9.1—9.3|关闭需证据及重算|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-013|方案§9.1—9.3|接受风险保留接受人期限影响及客观风险|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-014|方案§9.1—9.3|数据中断不触发关闭|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-015|方案§9.1—9.3|方案绑定基线版本风险动作日期资源成本期限责任人|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-016|方案§9.1—9.3|模拟不占真实资源|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-017|方案§9.1—9.3|执行前变化展示差异并要求重算|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-018|方案§9.1—9.3|人工关联源单显示状态和来源|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RISK-019|方案§9.1—9.3|批量动作逐行显示成功失败|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-001|方案§10.1—10.3|支持对象与供给范围配置|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-002|方案§10.1—10.3|支持订单筛选与系数配置|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-003|方案§10.1—10.3|支持时区日历窗口配置|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-004|方案§10.1—10.3|支持供给状态ETA逾期配置|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-005|方案§10.1—10.3|支持补充量天数安全MOQ倍数配置|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-006|方案§10.1—10.3|支持加工路线转换参数配置|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-007|方案§10.1—10.3|支持品牌包装消耗组合配置|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-008|方案§10.1—10.3|支持ABC与超龄结构目标配置|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-009|方案§10.1—10.3|支持风险触发恢复阈值及连续周期|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-010|方案§10.1—10.3|普通用户只选发布口径或私有模拟|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-011|方案§10.1—10.3|不开放任意脚本公式编辑器|W4|`src/pages/material-decision/views.ts`：`renderConfiguration`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；无脚本编辑器；未反向门禁审查|待确认/v2.0|
|CONFIG-012|方案§10.1—10.3|规则按SKU场景、SKU默认、SPU场景、类别场景、全局优先匹配|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-013|方案§10.1—10.3|同层重叠阻断并显示冲突样例|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-014|方案§10.1—10.3|计算绑定需求供给补充配置包|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-015|方案§10.1—10.3|发布遵循草稿校验试算批准待生效生效替代|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-016|方案§10.1—10.3|改内容令旧试算失效|W4|`src/data/material-decision/workflow.ts`：`editDraft`|UT AT25/26；UI draft invalidation组|UI改系数后正式版本不变、修改安全量试算失效|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|CONFIG-017|方案§10.1—10.3|生效前允许撤回|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-018|方案§10.1—10.3|回滚创建恢复版本不删历史|W4|`src/pages/material-decision/events.ts`：`rollback；publish`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；恢复旧参数为新草稿；尚未完成回滚再发布及历史逐值用例|待确认/v2.0|
|CONFIG-019|方案§10.1—10.3|试算使用统一快照与对照版本|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-020|方案§10.1—10.3|报告包含覆盖无法算风险差缺口量金额完整度分布TOP差异|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-021|方案§10.1—10.3|差异行展示旧值新值规则事实|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-022|方案§10.1—10.3|试算不发单不通知不真实占用|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-023|方案§10.1—10.3|发布前验证映射冲突完整度差异解释|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-024|方案§10.1—10.3|批次整体切换不混新旧|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CONFIG-025|方案§10.1—10.3|失败保留上次完整结果与时效提示|W4|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|COMMON-001|方案§11.1|七主入口共用类别筛选不复制七套页|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|COMMON-002|方案§11.1|顶部显示范围截点口径版本更新时间完整度|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|COMMON-003|方案§11.1|快捷筛选含编码名称类别品牌范围风险|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|COMMON-004|方案§11.1|更多筛选含主体地点质量用途负责人状态启停异常|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|COMMON-005|方案§11.1|展开后查询重置导出更多筛选独立底行|W3|`src/pages/material-decision/views.ts`：`renderBody`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；动作行位于展开条件后；UI未展开验证|待确认/v2.0|
|COMMON-006|方案§11.1|表格物料列固定且支持列设置排序分页|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|COMMON-007|方案§11.1|个人视图可保存恢复|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|COMMON-008|方案§11.1|同单位非重叠才合计|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|COMMON-009|方案§11.1|金额合计展示币种估值日汇率完整度|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|COMMON-010|方案§11.1|指标可展开公式参数明细去重来源版本|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|COMMON-011|方案§11.1|导出附同快照筛选单位截点规则|W3|`src/pages/material-decision/events.ts`：`export`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；导出载荷含过滤快照单位规则；浏览器只断言文件名，未检查下载内容|待确认/v2.0|
|COMMON-012|方案§11.1|空值0无消耗区分展示|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OVERVIEW-001|方案§11.2|总览显示六类指标卡及粒度分母|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OVERVIEW-002|方案§11.2|趋势可选7、30、60日|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OVERVIEW-003|方案§11.2|风险分布可按类别区域负责人查看|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OVERVIEW-004|方案§11.2|待办显示缺口影响等级负责人动作解决日超时|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OVERVIEW-005|方案§11.2|结构目标来自配置不固定631|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OVERVIEW-006|方案§11.2|总览可跳转风险物料试算及保存视图|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OVERVIEW-007|方案§11.2|受影响订单按订单ID去重|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OVERVIEW-008|方案§11.2|风险对象按SKU与范围去重|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PANORAMA-001|方案§11.3|全景列表提供方案列出的识别库存预留供给需求风险责任时点字段|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PANORAMA-002|方案§11.3|默认风险严重度与首次缺口排序|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PANORAMA-003|方案§11.3|支持无库存有需求、残余停用等筛选|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PANORAMA-004|方案§11.3|监控无库存大于1万门槛|W3|`src/pages/material-decision/views.ts`：`selectedRows`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；无库存万量门槛；没有零库存有需求UI专项|待确认/v2.0|
|PANORAMA-005|方案§11.3|详情概览支持合法范围口径切换|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PANORAMA-006|方案§11.3|库存详情显示批次地点质量用途单位预留及纳入原因|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PANORAMA-007|方案§11.3|日历详情展开日期单据|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PANORAMA-008|方案§11.3|供给链详情显示来源行剩余ETA可信度关联逾期|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PANORAMA-009|方案§11.3|消耗详情显示单耗BOM包装映射依据|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PANORAMA-010|方案§11.3|风险方案详情支持模拟与关联已有单据|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|PANORAMA-011|方案§11.3|数据规则详情展示映射批次版本历史|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CALENDAR-001|方案§11.4|日周计划按SKU范围显示|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CALENDAR-002|方案§11.4|层次分列期初确定需求预测供给余额安全缺口|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CALENDAR-003|方案§11.4|条件供给独立情景开关|W3|`src/pages/material-decision/views.ts`：`renderConfiguration`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；条件供给开关存在，独立情景显示仍需核对|待确认/v2.0|
|CALENDAR-004|方案§11.4|单据明细包含来源行计划实际优先级适用去重原因|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CALENDAR-005|方案§11.4|缺口可生成候选方案及参数比较|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CALENDAR-006|方案§11.4|多品牌显示共享约束|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CALENDAR-007|方案§11.4|周汇总保留周内最低与首次缺口|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|CALENDAR-008|方案§11.4|日历可导出|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ANALYSIS-001|方案§11.5|提供实际趋势预测偏差商品关联结构处置四视图|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ANALYSIS-002|方案§11.5|销量推算实际领用退料净耗报损不混名|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ANALYSIS-003|方案§11.5|商品贡献展示映射版本覆盖率|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ANALYSIS-004|方案§11.5|BOM缺失对象不按0进入精确排名|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ANALYSIS-005|方案§11.5|跨物料商品销量按业务行去重|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ANALYSIS-006|方案§11.5|新品无历史不当无需求|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|WORKSPACE-001|方案§11.6—11.8|风险列表完整展示事件类型范围等级日期影响可信度负责人状态单据|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|WORKSPACE-002|方案§11.6—11.8|风险详情按问题证据方案执行复核排列|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|WORKSPACE-003|方案§11.6—11.8|方案比较含可用日解除率提前残余成本资源失败条件|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|WORKSPACE-004|方案§11.6—11.8|风险支持核实模拟保存关联复核|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|WORKSPACE-005|方案§11.6—11.8|质量列表显示来源对象问题影响责任证据复算|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|WORKSPACE-006|方案§11.6—11.8|质量页可定位指派关联修复重算|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|WORKSPACE-007|方案§11.6—11.8|质量页不修改源库存BOM订单|W3|`src/pages/material-decision/views.ts`：`renderBody`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；质量页只读；未反向检查所有动作|待确认/v2.0|
|WORKSPACE-008|方案§11.6—11.8|质量页显示分来源最近成功时间|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|WORKSPACE-009|方案§11.6—11.8|配置列表显示类型范围版本状态生效引用试算批准人|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|WORKSPACE-010|方案§11.6—11.8|配置详情含匹配预览差异发布记录|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|WORKSPACE-011|方案§11.6—11.8|配置编辑显示样例命中解释|W3|`src/pages/material-decision/views.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|WORKSPACE-012|方案§11.6—11.8|保存草稿不影响正式结果|W3|`src/data/material-decision/workflow.ts`：`editDraft`|UT AT25/26；UI draft invalidation组|UI改系数后正式版本不变、修改安全量试算失效|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|WORKSPACE-013|方案§11.6—11.8|发布与保存个人视图语义分开|W3|`src/pages/material-decision/views.ts`：`renderConfiguration`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|待实施|代码核对；草稿发布按钮区分；个人视图尚未实现|待确认/v2.0|
|INTEGRATION-001|方案§12.1—12.3|真实接入包含源行版本事件时间接入时间单位状态冲正关联|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|真实接口/服务端契约待接入；原型UT仅验证降级|生产源系统集成/授权/对账证据待提供；原型不能替代|已阻塞|未执行|待确认/v2.0|
|INTEGRATION-002|方案§12.1—12.3|快照源定义水位删除取消和全量对账|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|真实接口/服务端契约待接入；原型UT仅验证降级|生产源系统集成/授权/对账证据待提供；原型不能替代|已阻塞|未执行|待确认/v2.0|
|INTEGRATION-003|方案§12.1—12.3|真实源系统负责审批资源与最终合法校验|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|真实接口/服务端契约待接入；原型UT仅验证降级|生产源系统集成/授权/对账证据待提供；原型不能替代|已阻塞|未执行|待确认/v2.0|
|INTEGRATION-004|方案§12.1—12.3|真实创建采用唯一请求号幂等|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|真实接口/服务端契约待接入；原型UT仅验证降级|生产源系统集成/授权/对账证据待提供；原型不能替代|已阻塞|未执行|待确认/v2.0|
|INTEGRATION-005|方案§12.1—12.3|超时按原请求号查询不新建重试|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|真实接口/服务端契约待接入；原型UT仅验证降级|生产源系统集成/授权/对账证据待提供；原型不能替代|已阻塞|未执行|待确认/v2.0|
|INTEGRATION-006|方案§12.1—12.3|接口不支持幂等查询时关闭直接创建|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|真实接口/服务端契约待接入；原型UT仅验证降级|生产源系统集成/授权/对账证据待提供；原型不能替代|已阻塞|未执行|待确认/v2.0|
|INTEGRATION-007|方案§12.1—12.3|部分接受按行跟踪不重复下发|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|真实接口/服务端契约待接入；原型UT仅验证降级|生产源系统集成/授权/对账证据待提供；原型不能替代|已阻塞|未执行|待确认/v2.0|
|INTEGRATION-008|方案§12.1—12.3|真实回执后重算剩余缺口|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|真实接口/服务端契约待接入；原型UT仅验证降级|生产源系统集成/授权/对账证据待提供；原型不能替代|已阻塞|未执行|待确认/v2.0|
|INTEGRATION-009|方案§12.1—12.3|跨域共享同物料风险ID与需求调整关联|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|真实接口/服务端契约待接入；原型UT仅验证降级|生产源系统集成/授权/对账证据待提供；原型不能替代|已阻塞|未执行|待确认/v2.0|
|QUALITY-001|方案§13.1—13.2|映射缺失隔离影响量并阻止确定建议|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|QUALITY-002|方案§13.1—13.2|单位缺失不做跨单位数量建议|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|QUALITY-003|方案§13.1—13.2|负库存不归零|W2|`src/data/material-decision/calculations.ts`：`assess`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；原始负库存保留；未专项UT/UI|待确认/v2.0|
|QUALITY-004|方案§13.1—13.2|规则缺失显示未映射需求及比例|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|QUALITY-005|方案§13.1—13.2|占位1970显示未知保留原始值|W2|`src/data/material-decision/calculations.ts`：`validDate；assess`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；UT AT37仅日期校验；UI无逐项无效日期验证|待确认/v2.0|
|QUALITY-006|方案§13.1—13.2|数据过期标注水位不当正常|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|QUALITY-007|方案§13.1—13.2|估算实测保留方式时间|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|QUALITY-008|方案§13.1—13.2|真实卷数仅来自卷记录|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|QUALITY-009|方案§13.1—13.2|状态完成数量未完标记不一致|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|QUALITY-010|方案§13.1—13.2|对象覆盖率与同单位需求量覆盖率同时展示|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|QUALITY-011|方案§13.1—13.2|分母未知不显示100%|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|QUALITY-012|方案§13.1—13.2|事实接入计算时间分别保存|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|QUALITY-013|方案§13.1—13.2|迟到事实重算保留原结果及差异|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|QUALITY-014|方案§13.1—13.2|各来源水位与共同截点分别显示|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|QUALITY-015|方案§13.1—13.2|当时结果和修订重算标签及快照分离|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|QUALITY-016|方案§13.1—13.2|页面级来源不冒称行级对账|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ACCESS-001|方案§14|角色模拟区分查看创建配置发布执行权限|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ACCESS-002|方案§14|成本字段单独控制|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ACCESS-003|方案§14|查阅权限不等于可调拨许可|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ACCESS-004|方案§14|口径审批与采购审批分离|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ACCESS-005|方案§14|真实服务端按主体区域地点敏感度过滤|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|真实接口/服务端契约待接入；原型UT仅验证降级|生产源系统集成/授权/对账证据待提供；原型不能替代|已阻塞|未执行|待确认/v2.0|
|ACCESS-006|方案§14|真实导出剔除未授权行与字段|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|真实接口/服务端契约待接入；原型UT仅验证降级|生产源系统集成/授权/对账证据待提供；原型不能替代|已阻塞|未执行|待确认/v2.0|
|ACCESS-007|方案§14|通知按类型责任等级时间策略|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ACCESS-008|方案§14|首次升级失败超时恢复触发消息|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ACCESS-009|方案§14|小幅抖动不重复消息|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ACCESS-010|方案§14|摘要免打扰升级路径可配置|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ACCESS-011|方案§14|通知附快照|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|ACCESS-012|方案§14|暂停通知不暂停计算|W5|`src/data/material-decision/workflow.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|KPI-001|方案§15.1—15.2|按期满足率分同单位有效到期需求计算|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|KPI-002|方案§15.1—15.2|缺料订单率去重且区分预计实际|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|KPI-003|方案§15.1—15.2|准时率按可用状态而非发货|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|KPI-004|方案§15.1—15.2|基准与修订承诺准时率分报|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|KPI-005|方案§15.1—15.2|WAPE同基数周期且实际和0不可算|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|KPI-006|方案§15.1—15.2|周转天数用成本且不混数量覆盖|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|KPI-007|方案§15.1—15.2|超龄率明确库龄起点及跨仓继承|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|KPI-008|方案§15.1—15.2|采纳率分母排除不可执行阻塞建议|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|KPI-009|方案§15.1—15.2|解决时长暂缓时间单列|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|KPI-010|方案§15.1—15.2|指标目标无批准基线不伪造达标|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|KPI-011|方案§15.1—15.2|金额节约只标同快照估算差|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|KPI-012|方案§15.1—15.2|后续算法保留版本解释评估人工记录|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|KPI-013|方案§15.1—15.2|预测未经批准不作采购承诺|W2|`src/data/material-decision/calculations.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RELEASE-001|方案§16.1—16.3|B阶段包含范围口径策略试算不能全推后续|W6|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RELEASE-002|方案§16.1—16.3|试点覆盖普通面料加工料品牌袋共享白粒碳带|W6|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RELEASE-003|方案§16.1—16.3|未通过范围只读质量提示限制执行建议|W6|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RELEASE-004|方案§16.1—16.3|新域上线不依赖旧页停用|W6|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RELEASE-005|方案§16.1—16.3|列表详情P95目标3秒需容量实测|W6|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RELEASE-006|方案§16.1—16.3|异步试算显示进度范围失败对象|W6|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RELEASE-007|方案§16.1—16.3|15分钟与每日批次时效是目标不是既成事实|W6|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RELEASE-008|方案§16.1—16.3|计算绑定事实配置程序版本|W6|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RELEASE-009|方案§16.1—16.3|失败不覆盖最后完整结果|W6|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RELEASE-010|方案§16.1—16.3|恢复显示积压情况|W6|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RELEASE-011|方案§16.1—16.3|记录延迟异常失败冲突未知结果恢复耗时|W6|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RELEASE-012|方案§16.1—16.3|新仓类别由档案配置接入|W6|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|RELEASE-013|方案§16.1—16.3|新增算法走版本功能扩展|W6|`src/pages/material-decision/index.ts`（实际符号待绑定）|UI：字段/动作契约|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OPEN-001|方案§18|七类地点物权用途未确认列待映射|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OPEN-002|方案§18|启停与用途不明保留实物限制可用|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OPEN-003|方案§18|短细码关系未明不重复归并|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OPEN-004|方案§18|新旧袋无批准替代不混用|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OPEN-005|方案§18|ASAYA包装映射显示待确认|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OPEN-006|方案§18|配套无事实不建库存SPU|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OPEN-007|方案§18|三吊粒SPU无规则不跨替代|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OPEN-008|方案§18|打印换算缺失降级覆盖建议|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OPEN-009|方案§18|源预留合同未确认不启用生产确定分配|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|真实接口/服务端契约待接入；原型UT仅验证降级|生产源系统集成/授权/对账证据待提供；原型不能替代|已阻塞|未执行|待确认/v2.0|
|OPEN-010|方案§18|需求关联未确认不宣称生产去重|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|真实接口/服务端契约待接入；原型UT仅验证降级|生产源系统集成/授权/对账证据待提供；原型不能替代|已阻塞|未执行|待确认/v2.0|
|OPEN-011|方案§18|旧P2P3口径不静默统一|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OPEN-012|方案§18|采购枚举未核实不猜状态|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OPEN-013|方案§18|加工缺节点不把完工当可领用|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OPEN-014|方案§18|质量未放行不当合格|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OPEN-015|方案§18|正式时区日历保留周期上线前确认|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|OPEN-016|方案§18|成本不全明确不完整|W5|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|TRACE-001|方案§19.1—19.3|旧页观察标2026-09-11历史证据|W6|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|TRACE-002|方案§19.1—19.3|P1P3差异未核实不声称根因|W6|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|TRACE-003|方案§19.1—19.3|P2固定45或60天只作命名后备估算|W6|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|TRACE-004|方案§19.1—19.3|P3波动1000及30%仅历史情景不固化通则|W6|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|TRACE-005|方案§19.1—19.3|P5样例不作为通用数量规则|W6|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|TRACE-006|方案§19.1—19.3|用户截图与正式源事实区分|W6|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|
|TRACE-007|方案§19.1—19.3|所有实现关联来源章节与验收编号|W6|`src/data/material-decision/fixtures.ts`（实际符号待绑定）|UT：边界/数量结果|UI：对应入口与明细；1366×768、1280×720|待实施|未执行|待确认/v2.0|

## AT01—AT40验收合同

|编号|来源|可判定结果|工作包|计划实现位置|自动化验证|页面/设备/生产验证|状态|证据|产品确认人/版本|
|---|---|---|---|---|---|---|---|---|---|
|AT01|方案§17|合格库存100，内部预留30，范围内未履行需求50 → 初始保障量100，剩余50；自由量70另列，不重复扣预留|W2/W4|`src/data/material-decision/calculations.ts`：`assess`|UT AT01/02|不适用：本行为纯数量/去重算法合同；所在页面素材门禁独立阻塞|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|AT02|方案§17|AT01另有范围外预留20 → 初始保障量80，满足需求后30|W2/W4|`src/data/material-decision/calculations.ts`：`assess`|UT AT01/02|不适用：本行为纯数量/去重算法合同；所在页面素材门禁独立阻塞|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|AT03|方案§17|现货100中待检20、冻结10且不重叠 → 可用最多70；质量分类交叉时按明细集合去重|W2/W4|`src/data/material-decision/calculations.ts`|UT：AT03；UI：可观察解释|UI：命名场景与对应明细|待实施|未执行|待确认/v2.0|
|AT04|方案§17|采购100已接收40 → 在途剩余60；收到的40按质量状态进入现货，不再保留采购100|W2/W4|`src/data/material-decision/calculations.ts`：`assess`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；UT验证60剩余，但未验证接收40质量入库的完整联动|待确认/v2.0|
|AT05|方案§17|坯布100已投入加工，预计产出90 → 坯布不再自由分配；90只计未来目标物料供给|W2/W4|`src/pages/material-decision/processing.ts`：`evaluateProcessing`|UT AT05/06/07、§7.2 loss；UI processing disjoint组|UI独立加工剩余60、空目标、不合格；不与主供给链联动|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|AT06|方案§17|产出90中收货30、在途20、待发40 → 按数量段显示，三段合计90，不以整单状态重复纳入|W2/W4|`src/pages/material-decision/processing.ts`：`evaluateProcessing`|UT AT05/06/07、§7.2 loss；UI processing disjoint组|UI独立加工剩余60、空目标、不合格；不与主供给链联动|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|AT07|方案§17|输出目标SKU为空 → 不计目标供给；生成映射异常|W2/W4|`src/pages/material-decision/processing.ts`：`evaluateProcessing`|UT AT05/06/07、§7.2 loss；UI processing disjoint组|UI独立加工剩余60、空目标、不合格；不与主供给链联动|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|AT08|方案§17|日1需求80，日3供给100，期初50 → 日1缺30；日3到货不能抹掉日1短缺|W2/W4|`src/data/material-decision/calculations.ts`：`assess`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；UT验证日1缺30；UI未核对对应日行|待确认/v2.0|
|AT09|方案§17|补充可用日a后基线最低-30、期末20，安全余量10 → 净补充40，不能仅按期末得0|W2/W4|`src/data/material-decision/calculations.ts`：`assess`|UT AT09 intermediate deficit|不适用：本行为纯数量/去重算法合同；所在页面素材门禁独立阻塞|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|AT10|方案§17|净补充40，MOQ50，整包倍数20 → 建议60；净补充0时仍为0|W2/W4|`src/data/material-decision/calculations.ts`：`roundReplenishment`|UT AT10|不适用：本行为纯数量/去重算法合同；所在页面素材门禁独立阻塞|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|AT11|方案§17|今日起目标60天，提前期20天 → 不再加20得到80；到货后60天情景才使用80天终点|W2/W4|`src/data/material-decision/calculations.ts`：`assess`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|待实施|代码核对；60日分支通过；到货后60=80情景未实现，不能全AT通过|待确认/v2.0|
|AT12|方案§17|同一订单同时出现在销售推算和生产需求中 → 按关联覆盖规则扣除重叠；关系不明显示不确定，不全量相加|W2/W4|`src/data/material-decision/calculations.ts`：`assess`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|待实施|代码核对；覆盖量扣除分支通过；关联未知与来源关联ID未实现|待确认/v2.0|
|AT13|方案§17|需求日无消耗基数但有未来确认需求 → 覆盖天数不可用，仍按时间序列识别缺料|W2/W4|`src/data/material-decision/calculations.ts`：`assess`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|待实施|代码核对；测试仅无需求null，没有覆盖未知但未来有确定需求组合|待确认/v2.0|
|AT14|方案§17|取消未履行订单，部分包材已经实际耗用 → 撤销剩余需求，已耗数量不自动回库|W2/W4|`src/data/material-decision/calculations.ts`：`assess`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|待实施|代码核对；取消需求保留库存通过；真实已耗包材不联动|待确认/v2.0|
|AT15|方案§17|相同打印事件重复回传 → 实际消耗只记录一次；修订或冲正保留关联|W2/W4|`src/pages/material-decision/packaging.ts`：`summarizePackagingEvents`|UT event duplicate / conflicting same revision；UI packaging conflict组|UI独立回传序列净领用80、重打5；不与主库存联动|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|AT16|方案§17|WLID002同品牌两种尺寸 → 独立SKU监控，不以品牌汇成可互替库存|W2/W4|`src/pages/material-decision/packaging.ts`：`resolvePackagingRule`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；尺寸/品牌方式隔离通过；目录与主计算联动证据未全|待确认/v2.0|
|AT17|方案§17|ASAYA快递袋图片两格同码 → 标记待核实，不自动新建机器包装SKU|W2/W4|`src/data/material-decision/fixtures.ts`：`materials`|UT AT16/17 directory；UI packaging conflict组|UI消耗页有重复码待核实及不造码说明；不涉及图片通过|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|AT18|方案§17|共享白吊粒100，三品牌需求各60 → 联合需求180、缺80；不能每品牌各承诺100|W2/W4|`src/pages/material-decision/packaging.ts`：`sharedPendantPlan`|UT AT18白吊粒共享；UI packaging组|独立共享面板100供给、180需求、80缺口，不验证主系统跨域分配|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|AT19|方案§17|黑吊粒100、吊牌80、内袋120，每件各1 → 齐套80件；任一单耗未知则不输出确定齐套值|W2/W4|`src/pages/material-decision/packaging.ts`：`renderPackagingPanel；kitCapacity`|UT AT19/20；UI packaging conflict组|UI独立齐套80与单耗未知；不与全景库存联动|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|AT20|方案§17|碳带只有卷数，无有效打印换算 → 展示实物卷数，需求覆盖不可算，不使用每件一卷|W2/W4|`src/pages/material-decision/packaging.ts`：`renderPackagingPanel`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；缺打印换算独立展示与UT通过；主卷库存覆盖未专项验证|待确认/v2.0|
|AT21|方案§17|停用仓仍有库存 → 仍可见残余实物；是否纳入可用按用途规则判断|W2/W4|`src/data/material-decision/calculations.ts`：`assess`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|待实施|代码核对；UT usable=false保留实物；停用仓档案与供给策略尚未联动|待确认/v2.0|
|AT22|方案§17|新增七类加工地点但无真实仓库代码 → 作为待映射范围，不伪造七个仓库库存|W2/W4|`src/data/material-decision/calculations.ts`|UT：AT22；UI：可观察解释|UI：命名场景与对应明细|待实施|未执行|待确认/v2.0|
|AT23|方案§17|订单跨两种物料均短缺 → 风险对象可有两个，受影响订单只计一次|W2/W4|`src/data/material-decision/calculations.ts`|UT：AT23；UI：可观察解释|UI：命名场景与对应明细|待实施|未执行|待确认/v2.0|
|AT24|方案§17|同优先级包材规则条件重叠 → 发布失败，定位冲突规则与样例|W2/W4|`src/pages/material-decision/packaging.ts`：`resolvePackagingRule；handlePackagingClick`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|待实施|代码核对；独立面板冲突阻保存通过；不是正式配置发布冲突检测|待确认/v2.0|
|AT25|方案§17|草稿从系数1改为0.65 → 正式结果不变；试算用同一快照比较并解释差异|W2/W4|`src/data/material-decision/workflow.ts`：`editDraft；compareTrial`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|待实施|代码核对；正式不变和试算通过；报告缺完整规则事实差异解释|待确认/v2.0|
|AT26|方案§17|修改已经试算的草稿 → 试算失效，重算后才允许提交发布|W2/W4|`src/data/material-decision/workflow.ts`：`editDraft；publishTrial`|UT AT25/26、AT26/28；UI draft invalidation组|UI发布前强制重算；仅模拟批准角色|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|AT27|方案§17|新配置批次计算部分失败 → 不混合发布；展示上次完整结果与过期提示|W2/W4|`src/data/material-decision/workflow.ts`|UT：AT27；UI：可观察解释|UI：命名场景与对应明细|待实施|未执行|待确认/v2.0|
|AT28|方案§17|回滚规则 → 新建恢复版本，历史版本及结果保留|W2/W4|`src/pages/material-decision/events.ts`：`rollback`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；UI恢复新草稿；未重新发布恢复版本完整验证|待确认/v2.0|
|AT29|方案§17|创建源单接口超时 → 使用原请求号查询，不新请求重复下单|W5|`src/data/material-decision/workflow.ts`|UT：AT29；UI：可观察解释|真实幂等/部分接受/服务端授权验收，原型仅演示|已阻塞|未执行|待确认/v2.0|
|AT30|方案§17|方案100只接受60 → 跟踪60并对剩余40重新评估，已接受部分不重复|W5|`src/data/material-decision/workflow.ts`|UT：AT30；UI：可观察解释|真实幂等/部分接受/服务端授权验收，原型仅演示|已阻塞|未执行|待确认/v2.0|
|AT31|方案§17|用户已认领或已下采购单，但缺口仍在 → 客观风险不关闭；处理状态可等待执行|W2/W4|`src/data/material-decision/workflow.ts`：`moveRisk`|UT AT31；UI risk closure blocked组|UI缺口未解不能关闭；认领与处理不改变缺口|已验证|本地原型；output/material-decision-evidence/unit.log；output/material-decision-evidence/browser.log（2026-09-14主代理实跑；版本待最终收据绑定）|待确认/v2.0|
|AT32|方案§17|来源中断 → 不把未知视为0，不自动恢复正常|W2/W4|`src/data/material-decision/calculations.ts`|UT：AT32；UI：可观察解释|UI：命名场景与对应明细|待实施|未执行|待确认/v2.0|
|AT33|方案§17|同一SKU两处供给范围可互调但物权受限 → 无合法许可不推荐跨主体调拨|W2/W4|`src/data/material-decision/calculations.ts`|UT：AT33；UI：可观察解释|UI：命名场景与对应明细|待实施|未执行|待确认/v2.0|
|AT34|方案§17|显示金额缺少部分成本或币种不同 → 标明金额覆盖，不输出完整总额或虚假节约|W2/W4|`src/data/material-decision/calculations.ts`|UT：AT34；UI：可观察解释|UI：命名场景与对应明细|待实施|未执行|待确认/v2.0|
|AT35|方案§17|补录昨日出库 → 原发布结果保留，修订重算有独立版本和差异|W2/W4|`src/data/material-decision/calculations.ts`|UT：AT35；UI：可观察解释|UI：命名场景与对应明细|待实施|未执行|待确认/v2.0|
|AT36|方案§17|仓库/品牌权限受限用户导出 → 数据与字段不超授权，口径快照信息保留|W5|`src/data/material-decision/calculations.ts`|UT：AT36；UI：可观察解释|真实幂等/部分接受/服务端授权验收，原型仅演示|已阻塞|未执行|待确认/v2.0|
|AT37|方案§17|源日期1970或时区未知 → 日期标无效；关键时间配置未齐阻止正式口径发布|W2/W4|`src/data/material-decision/calculations.ts`：`validDate；validatePolicy`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；UT非法日期时区验证通过；发布/业务日期完整UI证据待补|待确认/v2.0|
|AT38|方案§17|按周汇总时周中缺料、周末到货 → 周内最低余额及首次缺口仍可见|W2/W4|`src/data/material-decision/calculations.ts`|UT：AT38；UI：可观察解释|UI：命名场景与对应明细|待实施|未执行|待确认/v2.0|
|AT39|方案§17|相同SPU某SKU超储、另一SKU缺料 → 两类风险均保留，不以SPU总量抵消|W2/W4|`src/data/material-decision/calculations.ts`|UT：AT39；UI：可观察解释|UI：命名场景与对应明细|待实施|未执行|待确认/v2.0|
|AT40|方案§17|同一事实在旧P1/P3展示库存不同 → 新域逐项展示纳入范围、状态、时间差异；未核实差异不声称根因已定位|W2/W4|`src/data/material-decision/calculations.ts`|UT：AT40；UI：可观察解释|UI：命名场景与对应明细|待实施|未执行|待确认/v2.0|

## 仓库治理补充门禁

|编号|来源|可判定结果|工作包|计划实现位置|自动化验证|页面/设备/生产验证|状态|证据|产品确认人/版本|
|---|---|---|---|---|---|---|---|---|---|---|
|GOV-001|AGENTS§5.3|每种可见物料有真实对应图片；缺图明示素材阻塞|W3|`src/pages/material-decision/views.ts`、`processing.ts`、`packaging.ts`|不得用占位提示代替图片验收|缩略图与识别同块；实际素材逐个核对|已阻塞|全部物料缺已核实对应实物图；当前只有缺图提示，大图素材验收未完成|待确认/v2.0|
|GOV-002|AGENTS§5.3|大图保比例，关闭遮罩Esc可用，失败态可见|W3|`src/pages/material-decision/views.ts`、`processing.ts`、`packaging.ts`|不得用占位提示代替图片验收|两管理端尺寸无溢出|已阻塞|全部物料缺已核实对应实物图；当前只有缺图提示，大图素材验收未完成|待确认/v2.0|
|GOV-003|AGENTS§5.1|轻交互局部更新，输入不整页重绘，反馈200ms内|W3|`events.ts`|UI输入连续性与反馈|滚动位置及闪烁实测|待实施|未执行|待确认/v2.0|
|GOV-004|AGENTS§5.2|标准列表复用统一组件，分页列设置冻结按路由保存|W3|`src/pages/material-decision/views.ts`：`renderBody`|相关UT/UI已运行，但不足完整证明此条|待补该条专项；非生产证据|已实现待验证|代码核对；标准组件及列隐藏持久化已测；分页冻结顺序完整验收待补|待确认/v2.0|
|GOV-005|AGENTS§7—8|当前工作树最终修改后完成专项、浏览器、构建治理与收据|W6|测试及审查记录待绑定|实际命令与退出码|命名路由设备截图及HEAD|待实施|未执行|待确认/v2.0|
|GOV-006|AGENTS§2、8|演示与生产、verified与delivered与accepted分别报告|W6|审查记录待绑定|交付证据核对|GitHub与产品接受回执各自记录|待实施|未执行|待确认/v2.0|

## 覆盖检查与阻塞

- 正向：§1—19均已登记；§17 AT01—AT40逐条保留。反向仅完成下列有证据条目的实现核对，全量反向追踪尚未完成。
- W5真实生产接入缺少接口、事件契约、数据权限和源系统验收身份；只能完成明确标记的模拟与人工关联入口。AT29、AT30、AT36生产结果必须保持阻塞，原型可另写演示证据。
- §18业务待确认项不能用Mock补全成事实；原型可演示降级，生产范围仍未确认。源预留与需求关联合同未确认阻塞正式计算启用，不阻塞算法演示。
- 真实素材是AGENTS硬门禁；库存SKU的真实对应图片如果无法取得，不得把页面按完成交付。当前素材未核查，后续逐项登记。
- 第16章后续算法扩展只登记边界与版本要求，本轮不可宣称预测平台、联合优化或生产增量服务已建成。性能3秒/15分钟等为目标，需要真实容量或接入证据。
- PDA、打印不属本子域七入口交付：各表页面验证均为管理Web；无新增PDA/打印任务，不得顺带修改源执行系统。
- 产品确认人、正式范围、正式数据时区与保留周期、各需求验证版本均待指定；助手验证不能替代产品接受。

## 2026-09-14 局部证据回填

主代理提供并由本次读取核对的日志：`output/material-decision-evidence/unit.log`（40个测试通过）、`output/material-decision-evidence/browser.log`（8组浏览器通过）。它们不是AT01—AT40全部通过：测试名含AT编号的若仅验证部分分支，保留待实施或已实现待验证。浏览器覆盖1366×768及其中一组1280×720；图像素材均阻塞。最终证据位置、HEAD/差异和最后修改时点由主代理收据补齐；实质代码变化使受影响证据失效。

加工与包材面板只验证独立Mock数量，不与全景库存或主供给链联动。数值行标已验证只代表该独立算法或面板的原子结果，不代表该业务端到端完成。

尚未完成的重要内容：完整供给范围/物权与按需求优先级分配、所有七页完整字段与经营指标、真实7日耗用、全规则优先级及批准排期、部分批次失败恢复、事件历史重算、加工包材与主库存联动、正式权限和生产接口、源实物对账、真实物料图和大图。仓库17条名称编码已存在，但两个成衣仓库区/库位数量未建模展示，RANGE-004/005仍待实施。当前30日演示默认与产品60日建议不同，应在评审中明确，不能冒称产品默认全部实现。

状态统计（本次回填）：已实现待验证 26；已阻塞 18；已验证 35；待实施 307，共386条。产品确认人仍待确认，因此“已验证”不是用户accepted回执。
