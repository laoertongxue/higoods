# PCS 档案调整历史矩阵与审查汇编

本文件只合并四份原历史记录，原需求编号、结果、失败、证据版本和接受边界保留。现行业务入口为[物料与商品档案现行需求](../product-requirements/物料与商品档案现行需求.md)。本汇编不是新一轮产品验收。


---

## 来源：materials-classification-processing-cleanup.md

[原始版本](https://github.com/laoertongxue/higoods/blob/e45ceac841b15aad352fbc0fda9274a35c44e01c/docs/materials-classification-processing-cleanup.md)；原文 SHA256：`47d7520553e0e0ece1e948f8c2af8c2a34f0858e5702c406412094d52b5e7b10`。

## 物料分类、加工方式与档案简化

本记录承接 2026-10-12 用户确认的前五项要求及两项补充。基线 c89009bb6c7189acb6370b1902347004c1052693，工作树 simple-materials-main-integration/higoods，分支 codex/material-classification-processing-cleanup，管理端验收 1366×768、1280×720。已完成当前原型实现及页面验收，技术验收不代替用户实际接受；未推送或发布。

### 需求与边界

R1 分类严格使用：面料 FA 下 SZ 梭织面料、ZZ 针织面料、LL 里料/衬布、MZ 毛织/羊毛面料、YH 印花/提花面料、GN 功能/特殊面料；辅料 TR 下 SN 缝纫/衬布类、BF 扣合类、LR 花边/蕾丝类、TB 织带/编带类、LB 标识类辅料、HD 五金、OT 其他类目；纱线 YR 下 NF 天然纤维纱线、CF 化学纤维纱线、BL 混纺纱线。耗材、配件无下级分类和属性模板。分类 ID 和业务编码对应同一当前配置；不能新建表外分类或通过导入绕过。

R2 染色必须选择 MJS 或 GTG，独立产出编码、加工定义和本道含税费用。R3 印花四种互斥方式：单面 A、渗透 CT、双面同花 AA、双面分花 AB；AB 明确两面花型和版本，不自动代填。综合成本沿用基础采购、基础运输及每道含税加工费计算，普通单位及包装换算保留。

R4 耗材、配件列表每个 SPU 一行，规格 SKU 列展示全部所属规格及识别、单位、费用信息。筛选、统计、分页、勾选、批量审核以主档为对象；审核确认列出实际待处理规格，主档通过后新增草稿规格仍可按本档提交。删除启停/归档、已保存规格复制、使用情况及更多操作弹窗，审核通过即满足简易物料可选条件。所有有效操作直接展示且可换行。未保存编辑表单保留复制一行便利，不复制业务历史。

R5 列表标题左侧，已选择项数、提交审核、审核通过、列设置及已有结果入口紧凑排列在右侧。

R6 辅料 BF 主档必填类型：机打/手缝，无默认值；保存、编辑、审核、导入校验一致；与孔式/脚式结构分开。旧档未登记类型如实显示待补，编辑时必须补齐，不猜填历史事实。

R7 面料、辅料、纱线的分类属性配置直接维护当前资料，删除模板版本管理、版本换算依据、使用情况；档案主档与 SKU 删除技术引用，删除复制主档。同步删除专用方法、状态、事件、Mock、测试和无用文件；保留真实 BOM/采购/加工引用、历史身份与金额快照、计量包装和成本历史、花型与执行稿记录、多标签保存冲突校验，不扩大删除技术资料模块自身发布功能。旧分类只作为有明确映射的只读输入转成新分类；不继续提供两套可写分类或版本框架。

### 实施计划和存储范围

WP1 分类及条件字段 → pcs-material-config / attributes / archive repository / config workspace → 固定目录和当前属性维护、旧值读取与 BF 必填 → 专项契约和分类编辑页面。

WP2 加工方式 → archive types / rules / repository / transfer / variant / seed / archive editor / material handoff → MJS/GTG、A/CT/AA/AB、身份费用及上下游快照 → 专项和真实加工页保存回读。

WP3 SPU 列表 → archive page/repository/simple transfer/reference consumers → SPU 查询分页、待审子规格及直接操作、移除简单启停逻辑 → 两个档案列表、审核、导出与下游选料。

WP4 删除 → config workspace/config/data consumers/archive page → 无版本维护或使用查询残留、保留历史字段单位与真实引用 → 删除扫描、编译、历史回读。

WP5 验收 → 受影响专项、生产构建、管理页面操作/性能/图片/打印/存储回读、两轮对抗审查 → 全条目通过、治理记录及技术收据。

业务对象：当前分类属性/单位/包装/编码配置、物料主档、规格、加工定义、费用及操作记录均复用 PCS 按记录 IndexedDB；静态演示直接读，表单未保存值仅内存，图片保留 Blob/File ID 原子关联。列表列偏好 localStorage 每键少于 12000 字符且失败采用默认值。共享配置键的记录 ID 调整只对本次分类配置，保留单位工艺等其他记录；旧资料不删除，普通读取不落整包种子。

### 原子需求矩阵

确认人：用户确认需求、Codex 技术验收；产品实际接受不由代理代签。下面全部来源于 R1～R7、存储及验收要求；工作包与证据按编号联查。

| 编号 | 来源 | 原子要求 | 工作包 | 实现位置 | 自动化 | 页面/性能及证据 | 状态 | 确认版本 |
|---|---|---|---|---|---|---|---|---|
| CAT-01 | R1 | FA 六类名称编码一致 | WP1 | src/data/pcs-material-config.ts：固定 16 类及旧分类读取映射；src/pages/pcs-config-workspace.ts；src/data/pcs-material-archive-repository.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/pcs-r1-config.test.ts | pages.json：config:kind-* / *:category；layout.json：旧档编辑直达；专项覆盖无法确定旧分类 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| CAT-02 | R1 | TR 七类名称编码一致 | WP1 | src/data/pcs-material-config.ts：固定 16 类及旧分类读取映射；src/pages/pcs-config-workspace.ts；src/data/pcs-material-archive-repository.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/pcs-r1-config.test.ts | pages.json：config:kind-* / *:category；layout.json：旧档编辑直达；专项覆盖无法确定旧分类 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| CAT-03 | R1 | YR 三类名称编码一致 | WP1 | src/data/pcs-material-config.ts：固定 16 类及旧分类读取映射；src/pages/pcs-config-workspace.ts；src/data/pcs-material-archive-repository.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/pcs-r1-config.test.ts | pages.json：config:kind-* / *:category；layout.json：旧档编辑直达；专项覆盖无法确定旧分类 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| CAT-04 | R1 | 不可新建表外类或跨类混用 | WP1 | src/data/pcs-material-config.ts：固定 16 类及旧分类读取映射；src/pages/pcs-config-workspace.ts；src/data/pcs-material-archive-repository.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/pcs-r1-config.test.ts | pages.json：config:kind-* / *:category；layout.json：旧档编辑直达；专项覆盖无法确定旧分类 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| CAT-05 | R1/R7 | 旧资料类别有确定映射、原编码引用保留 | WP1 | src/data/pcs-material-config.ts：固定 16 类及旧分类读取映射；src/pages/pcs-config-workspace.ts；src/data/pcs-material-archive-repository.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/pcs-r1-config.test.ts | pages.json：config:kind-* / *:category；layout.json：旧档编辑直达；专项覆盖无法确定旧分类 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| CAT-06 | R1 | 简易两类不恢复分类模板 | WP1 | src/data/pcs-material-config.ts：固定 16 类及旧分类读取映射；src/pages/pcs-config-workspace.ts；src/data/pcs-material-archive-repository.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/pcs-r1-config.test.ts | pages.json：config:kind-* / *:category；layout.json：旧档编辑直达；专项覆盖无法确定旧分类 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| FAST-01 | R6 | BF 显示机打/手缝必填、无默认 | WP1 | src/data/pcs-material-config.ts：installationType 固定枚举；src/data/pcs-material-archive-repository.ts：保存及审核校验；src/data/pcs-material-transfer.ts：同 SPU 导入一致性 | tests/unit/pcs-material-classification-cleanup.test.ts；tests/pcs-r1-material-transfer.test.ts | pages.json：BF:missing-type / BF:other-category / BF:save / BF:refresh；导入阻断专项 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| FAST-02 | R6 | 保存审核导入底层一致阻断缺失/非法值 | WP1 | src/data/pcs-material-config.ts：installationType 固定枚举；src/data/pcs-material-archive-repository.ts：保存及审核校验；src/data/pcs-material-transfer.ts：同 SPU 导入一致性 | tests/unit/pcs-material-classification-cleanup.test.ts；tests/pcs-r1-material-transfer.test.ts | pages.json：BF:missing-type / BF:other-category / BF:save / BF:refresh；导入阻断专项 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| FAST-03 | R6 | 非 BF 不要求该类型、结构孔式脚式不混用 | WP1 | src/data/pcs-material-config.ts：installationType 固定枚举；src/data/pcs-material-archive-repository.ts：保存及审核校验；src/data/pcs-material-transfer.ts：同 SPU 导入一致性 | tests/unit/pcs-material-classification-cleanup.test.ts；tests/pcs-r1-material-transfer.test.ts | pages.json：BF:missing-type / BF:other-category / BF:save / BF:refresh；导入阻断专项 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| DYE-01 | R2 | MJS/GTG 必选且非法方式阻断 | WP2 | src/data/pcs-material-rules.ts：buildProcessedMaterialCode；src/data/pcs-material-archive-repository.ts：加工定义及费用；src/pages/pcs-material-archives.ts：dyeMethod | tests/unit/pcs-material-process-modes.test.ts / pcs-material-process-roundtrip.test.ts | process.json：MJS/GTG 实际保存、独立费用及刷新；layout.json：FCS 来源及持久回读 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| DYE-02 | R2 | 同色不同染色生成不同身份和编码 | WP2 | src/data/pcs-material-rules.ts：buildProcessedMaterialCode；src/data/pcs-material-archive-repository.ts：加工定义及费用；src/pages/pcs-material-archives.ts：dyeMethod | tests/unit/pcs-material-process-modes.test.ts / pcs-material-process-roundtrip.test.ts | process.json：MJS/GTG 实际保存、独立费用及刷新；layout.json：FCS 来源及持久回读 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| DYE-03 | R2 | 不同方式独立含税费用并正确累加 | WP2 | src/data/pcs-material-rules.ts：buildProcessedMaterialCode；src/data/pcs-material-archive-repository.ts：加工定义及费用；src/pages/pcs-material-archives.ts：dyeMethod | tests/unit/pcs-material-process-modes.test.ts / pcs-material-process-roundtrip.test.ts | process.json：MJS/GTG 实际保存、独立费用及刷新；layout.json：FCS 来源及持久回读 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| PRINT-01 | R3 | 四种印花互斥精确名称/编码 | WP2 | src/data/pcs-material-rules.ts：buildProcessedMaterialCode；src/data/pcs-material-archive-repository.ts：两面花型版本校验；src/pages/pcs-material-archives.ts：printSide | tests/unit/pcs-material-process-modes.test.ts / pcs-material-process-roundtrip.test.ts | process.json：A/CT/AA/AB 实际保存、两花型版本及费用；pages.json：config:preview-* | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| PRINT-02 | R3 | A/CT 单花、AA 两面同花、AB 明确两花版本 | WP2 | src/data/pcs-material-rules.ts：buildProcessedMaterialCode；src/data/pcs-material-archive-repository.ts：两面花型版本校验；src/pages/pcs-material-archives.ts：printSide | tests/unit/pcs-material-process-modes.test.ts / pcs-material-process-roundtrip.test.ts | process.json：A/CT/AA/AB 实际保存、两花型版本及费用；pages.json：config:preview-* | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| PRINT-03 | R3 | 四方式编码独立并保留背面版本修订 | WP2 | src/data/pcs-material-rules.ts：buildProcessedMaterialCode；src/data/pcs-material-archive-repository.ts：两面花型版本校验；src/pages/pcs-material-archives.ts：printSide | tests/unit/pcs-material-process-modes.test.ts / pcs-material-process-roundtrip.test.ts | process.json：A/CT/AA/AB 实际保存、两花型版本及费用；pages.json：config:preview-* | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| PRINT-04 | R3 | 四方式费用分别维护累计无重复 | WP2 | src/data/pcs-material-rules.ts：buildProcessedMaterialCode；src/data/pcs-material-archive-repository.ts：两面花型版本校验；src/pages/pcs-material-archives.ts：printSide | tests/unit/pcs-material-process-modes.test.ts / pcs-material-process-roundtrip.test.ts | process.json：A/CT/AA/AB 实际保存、两花型版本及费用；pages.json：config:preview-* | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| PROC-01 | R2/R3 | 导入导出往返保存方式及两面信息 | WP2 | src/data/pcs-material-transfer.ts；src/data/pcs-material-variant-repository.ts；src/data/fcs/material-process-plans.ts；src/pages/process-work-orders/material-process-plans.ts | tests/unit/pcs-material-process-roundtrip.test.ts / pcs-material-static-source.test.ts；tests/pcs-simple-material-downstream.test.ts | process.json：import50:*，10 个 SPU / 50 规格全部导出及刷新；layout.json：purchase:* / FCS:* | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| PROC-02 | R2/R3 | 加工计划采购快照及旧变种消费者一致 | WP2 | src/data/pcs-material-transfer.ts；src/data/pcs-material-variant-repository.ts；src/data/fcs/material-process-plans.ts；src/pages/process-work-orders/material-process-plans.ts | tests/unit/pcs-material-process-roundtrip.test.ts / pcs-material-static-source.test.ts；tests/pcs-simple-material-downstream.test.ts | process.json：import50:*，10 个 SPU / 50 规格全部导出及刷新；layout.json：purchase:* / FCS:* | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| LIST-01 | R4 | 耗材每 SPU 一行 | WP3 | src/pages/pcs-material-archives.ts；src/data/pcs-material-archive-repository.ts：queryMaterialArchiveList / setMaterialApproval；src/data/pcs-simple-material-transfer.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/unit/pcs-simple-material-archives.test.ts / pcs-simple-dossier.test.ts | pages.json：parts:* / consumable:* 列表、新建、追加、批量审批及全部子 SKU 导出；layout.json：滚动与直接日志 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| LIST-02 | R4 | 配件每 SPU 一行 | WP3 | src/pages/pcs-material-archives.ts；src/data/pcs-material-archive-repository.ts：queryMaterialArchiveList / setMaterialApproval；src/data/pcs-simple-material-transfer.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/unit/pcs-simple-material-archives.test.ts / pcs-simple-dossier.test.ts | pages.json：parts:* / consumable:* 列表、新建、追加、批量审批及全部子 SKU 导出；layout.json：滚动与直接日志 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| LIST-03 | R4 | 规格列全部子 SKU 编码型号单位成本可见 | WP3 | src/pages/pcs-material-archives.ts；src/data/pcs-material-archive-repository.ts：queryMaterialArchiveList / setMaterialApproval；src/data/pcs-simple-material-transfer.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/unit/pcs-simple-material-archives.test.ts / pcs-simple-dossier.test.ts | pages.json：parts:* / consumable:* 列表、新建、追加、批量审批及全部子 SKU 导出；layout.json：滚动与直接日志 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| LIST-04 | R4 | SKU 搜索命中父 SPU，筛选统计分页同范围 | WP3 | src/pages/pcs-material-archives.ts；src/data/pcs-material-archive-repository.ts：queryMaterialArchiveList / setMaterialApproval；src/data/pcs-simple-material-transfer.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/unit/pcs-simple-material-archives.test.ts / pcs-simple-dossier.test.ts | pages.json：parts:* / consumable:* 列表、新建、追加、批量审批及全部子 SKU 导出；layout.json：滚动与直接日志 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| LIST-05 | R4 | 勾选按 SPU，审核覆盖该档实际待审规格 | WP3 | src/pages/pcs-material-archives.ts；src/data/pcs-material-archive-repository.ts：queryMaterialArchiveList / setMaterialApproval；src/data/pcs-simple-material-transfer.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/unit/pcs-simple-material-archives.test.ts / pcs-simple-dossier.test.ts | pages.json：parts:* / consumable:* 列表、新建、追加、批量审批及全部子 SKU 导出；layout.json：滚动与直接日志 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| LIST-06 | R4 | 已通过主档下新增规格可以提交审批 | WP3 | src/pages/pcs-material-archives.ts；src/data/pcs-material-archive-repository.ts：queryMaterialArchiveList / setMaterialApproval；src/data/pcs-simple-material-transfer.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/unit/pcs-simple-material-archives.test.ts / pcs-simple-dossier.test.ts | pages.json：parts:* / consumable:* 列表、新建、追加、批量审批及全部子 SKU 导出；layout.json：滚动与直接日志 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| LIST-07 | R4 | 有效操作直接展示，删除更多菜单 | WP3 | src/pages/pcs-material-archives.ts；src/data/pcs-material-archive-repository.ts：queryMaterialArchiveList / setMaterialApproval；src/data/pcs-simple-material-transfer.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/unit/pcs-simple-material-archives.test.ts / pcs-simple-dossier.test.ts | pages.json：parts:* / consumable:* 列表、新建、追加、批量审批及全部子 SKU 导出；layout.json：滚动与直接日志 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| LIST-08 | R4 | 删除简易启停归档及使用筛选 | WP3 | src/pages/pcs-material-archives.ts；src/data/pcs-material-archive-repository.ts：queryMaterialArchiveList / setMaterialApproval；src/data/pcs-simple-material-transfer.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/unit/pcs-simple-material-archives.test.ts / pcs-simple-dossier.test.ts | pages.json：parts:* / consumable:* 列表、新建、追加、批量审批及全部子 SKU 导出；layout.json：滚动与直接日志 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| LIST-09 | R4 | 简易审核可用与下游选料一致 | WP3 | src/pages/pcs-material-archives.ts；src/data/pcs-material-archive-repository.ts：queryMaterialArchiveList / setMaterialApproval；src/data/pcs-simple-material-transfer.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/unit/pcs-simple-material-archives.test.ts / pcs-simple-dossier.test.ts | pages.json：parts:* / consumable:* 列表、新建、追加、批量审批及全部子 SKU 导出；layout.json：滚动与直接日志 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| LIST-10 | R4/R7 | 删除业务复制规格/复制主档及专用逻辑 | WP3/WP4 | src/pages/pcs-material-archives.ts；src/data/pcs-material-archive-repository.ts：queryMaterialArchiveList / setMaterialApproval；src/data/pcs-simple-material-transfer.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/unit/pcs-simple-material-archives.test.ts / pcs-simple-dossier.test.ts | pages.json：parts:* / consumable:* 列表、新建、追加、批量审批及全部子 SKU 导出；layout.json：滚动与直接日志 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| LIST-11 | R5 | 标题左、选择与审核列设置紧凑靠右 | WP3 | src/pages/pcs-material-archives.ts；src/data/pcs-material-archive-repository.ts：queryMaterialArchiveList / setMaterialApproval；src/data/pcs-simple-material-transfer.ts | tests/unit/pcs-material-classification-cleanup.test.ts；tests/unit/pcs-simple-material-archives.test.ts / pcs-simple-dossier.test.ts | pages.json：parts:* / consumable:* 列表、新建、追加、批量审批及全部子 SKU 导出；layout.json：滚动与直接日志 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| DEL-01 | R7 | 分类属性直接保存当前配置不建版本 | WP4 | src/pages/pcs-config-workspace.ts；src/data/pcs-material-config.ts；src/pages/pcs-material-archives.ts；删除 src/data/pcs-material-technical-usage.ts | tests/unit/pcs-material-classification-cleanup.test.ts / pcs-simple-config-removal.test.ts；tests/pcs-r1-config-page.test.ts | pages.json：config:current-save / config:refresh，三个专业主档及 SKU 直达；删除扫描 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| DEL-02 | R7 | 删除版本换算依据和版本管理代码状态 | WP4 | src/pages/pcs-config-workspace.ts；src/data/pcs-material-config.ts；src/pages/pcs-material-archives.ts；删除 src/data/pcs-material-technical-usage.ts | tests/unit/pcs-material-classification-cleanup.test.ts / pcs-simple-config-removal.test.ts；tests/pcs-r1-config-page.test.ts | pages.json：config:current-save / config:refresh，三个专业主档及 SKU 直达；删除扫描 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| DEL-03 | R7 | 删除使用情况专用视图查询代码 | WP4 | src/pages/pcs-config-workspace.ts；src/data/pcs-material-config.ts；src/pages/pcs-material-archives.ts；删除 src/data/pcs-material-technical-usage.ts | tests/unit/pcs-material-classification-cleanup.test.ts / pcs-simple-config-removal.test.ts；tests/pcs-r1-config-page.test.ts | pages.json：config:current-save / config:refresh，三个专业主档及 SKU 直达；删除扫描 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| DEL-04 | R7 | 主档及 SKU 删除技术引用及专用查询 | WP4 | src/pages/pcs-config-workspace.ts；src/data/pcs-material-config.ts；src/pages/pcs-material-archives.ts；删除 src/data/pcs-material-technical-usage.ts | tests/unit/pcs-material-classification-cleanup.test.ts / pcs-simple-config-removal.test.ts；tests/pcs-r1-config-page.test.ts | pages.json：config:current-save / config:refresh，三个专业主档及 SKU 直达；删除扫描 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| KEEP-01 | R7 | 真实 BOM/采购/加工引用历史身份仍可读 | WP4 | src/data/pcs-material-reference-check.ts；src/data/pcs-material-archive-repository.ts；src/pages/pcs-material-archives.ts：materialTemplateForRecord；src/data/pcs-material-handoff.ts | tests/unit/tmf-material-references.test.ts / tmf-pcs-publish-adopt.test.ts；tests/pcs-material-cost-folding.test.ts；tests/unit/pcs-material-classification-cleanup.test.ts | pages.json：三种 units-tab；layout.json：历史1500mm主档与加工编辑、实际 PMS/FCS 草稿回读；TMF 专项 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| KEEP-02 | R7 | 单位包装普通換算及成本历史保留 | WP4 | src/data/pcs-material-reference-check.ts；src/data/pcs-material-archive-repository.ts；src/pages/pcs-material-archives.ts：materialTemplateForRecord；src/data/pcs-material-handoff.ts | tests/unit/tmf-material-references.test.ts / tmf-pcs-publish-adopt.test.ts；tests/pcs-material-cost-folding.test.ts；tests/unit/pcs-material-classification-cleanup.test.ts | pages.json：三种 units-tab；layout.json：历史1500mm主档与加工编辑、实际 PMS/FCS 草稿回读；TMF 专项 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| STORE-01 | 保存 | 共同动作按记录原子持久、刷新可读 | WP1/WP2/WP3 | src/data/pcs-record-codec.ts；src/data/pcs-record-static-versions.ts；src/data/pcs-material-archive-repository.ts / pcs-material-config.ts：现有原子操作入口 | tests/unit/pcs-simple-dossier.test.ts；实际 IndexedDB 故障/冲突及回读契约 | pages.json：quota-* / saved-reload，首次记录数 0；process.json：conflict:blocked-save / import50:refresh | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| STORE-02 | 保存 | 失败/冲突无虚假成功、首次读不落种子 | WP1/WP2/WP3 | src/data/pcs-record-codec.ts；src/data/pcs-record-static-versions.ts；src/data/pcs-material-archive-repository.ts / pcs-material-config.ts：现有原子操作入口 | tests/unit/pcs-simple-dossier.test.ts；实际 IndexedDB 故障/冲突及回读契约 | pages.json：quota-* / saved-reload，首次记录数 0；process.json：conflict:blocked-save / import50:refresh | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| UI-01 | 验收 | 两视口无主体横溢、图及打印可用 | WP5 | tests/browser-contracts/pcs-simple-materials.test.ts / pcs-material-layout-downstream.test.ts | 实际页面核验，自动断言主体无横溢、图片就绪及 QR 数量 | 两视口截图、scrolled 截图、耗材/配件打印 PDF 与图片大图，pages.json / layout.json | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| PERF-01 | 验收 | 每动作家族五个完整响应样本均 <=1000ms | WP5 | 三组浏览器契约；scripts/check-pcs-simple-browser-evidence.ts | scripts/check-pcs-simple-browser-evidence.ts：资产、源码、采样及各家族五轮 | acceptance.json 联查三个原始报告；每家族五个有效真实事件至完整响应样本 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| REVIEW-01 | 验收 | 第一轮逐项正反向对抗审查通过 | WP5 | docs/materials-classification-processing-review.md：逐项正反向追踪及反例关闭 | 人工语义逐项审查；自动检查不代替业务审查 | materials-classification-processing-review.md 逐项结论及最终证据复核 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |
| REVIEW-02 | 验收 | 第二轮逐项正反向对抗审查通过 | WP5 | docs/materials-classification-processing-review.md：逐项正反向追踪及反例关闭 | 人工语义逐项审查；自动检查不代替业务审查 | materials-classification-processing-review.md 逐项结论及最终证据复核 | 已验证 | 用户确认需求 / Codex 技术验收；运行源码 a88ba156e662，资产 d79f867f0f75 |

### 审查与证据

源码两轮逐项审查已闭合，最终三个页面报告在同一生产构建上通过。原始失败及过程日志独立保存，最终通过报告不能替代失败记录。证据归档目录为 `docs/verification-evidence/2026-10-12-material-classification/`，矩阵中报告文件及采样名称均相对该目录。

生成静态 JSON 是实际发布初始化来源；本轮仅修改物料 archive 键，其他模块原字符串逐字节保留，原主档、旧 SKU 编码及归属、单位包装、费用和真实引用保留。新增 GTG、AB 各一组静态示例。无正式花型库关联的 AB/CT/AA 示例如实保留为草稿及待补执行资料，不表示已经可以创建真实执行计划；用户新建 AB 必须选两个花型及版本。本次真实操作测试在独立浏览器环境使用两个有效授权示例花型，保存与刷新核对两面关联，没有在用户浏览器植入验收数据。

存储验收：PCS 业务仍在现有 `higood-pcs-records/records` 按记录写入；主档、规格、加工、成本、日志及图片引用同动作原子保存，事务 complete 后才显示成功。本轮未新增后台或维护工具。普通初始化只读取静态及已有覆盖，不写种子。仅列表偏好采用有界 localStorage，受限时回退默认；原型资料按当前浏览器及同源范围有效。


### 最终验收版本及结果

原子需求 41/41 已验证。工作树及分支见开头；HEAD 仍为基线，实际改动由验收清单绑定，不将基线 HEAD 冒充已合并提交。运行源码清单 SHA256 `a88ba156e6623a98156089780e7ee4873b3c75111f01118673f3dd1ad1a01fa4`；入口 bundle SHA256 `d79f867f0f75fce768b6e116251f33b8cb282ed4e6a1c43ef3d3350196637c79`；HTML SHA256 `b2efbbea490404a5a99fcc233b0af974a85775c9ca68197e69a5cc6148f119c8`。全部原始报告及测试契约哈希见 `../verification-evidence/2026-10-12-material-classification/acceptance.json`。

三个正式页面契约共 1335 个完整响应样本，267 个动作家族各 5 轮，最大 265.900ms；均 <=1000ms，errors=[]。1366×768、1280×720 都在同一桌面布局分支；五轮包含首次、刷新及适用窄视口边界。布局变体逐页核验，重复数据行不另算独立家族。首访、刷新、SPA、保存成功与故障分别命名，不合并平均。

`npm run build` 包含工程类型检查及 806 个 unit tests 全通过；完整 `npm run typecheck` 通过；相邻 8 个既有契约文件 60/60 通过。形式审查由技术收据再次验证任务边界，收据位置为 `/tmp/material-classification-final/task-receipt.json`；该文件在绑定范围外生成，结果另在交付回复登记。

页面实际覆盖：新建主档一次添加多个规格、Blob图片、失败保留输入及原记录、提交审核/审核通过、通过主档新增规格、SPU及SKU查询、列设置、滚动到底部及横向读表、日志、三张规格标签PDF；分类空选择、BF缺填/切换/保存回读；当前配置保存及六方式编码预览；六种加工实际分别保存费用并刷新；AB两面有效花型及版本、缺反面阻断；50行10主档/50SKU导入全部导出回读；跨标签冲突保留先保存数据；PMS采购草稿与FCS MJS计划保存刷新；历史1500mm主档技术与加工输入一致。

这些是单浏览器本地原型验收。PDA、真实数据库写入、远端生产任务和物理打印机不在本次变更范围；标签生成、打开打印页和PDF版式已验，不能据此声称已经出纸。没有改用户站点资料，也没有修改其他模块静态键。


---

## 来源：materials-classification-processing-review.md

[原始版本](https://github.com/laoertongxue/higoods/blob/e45ceac841b15aad352fbc0fda9274a35c44e01c/docs/materials-classification-processing-review.md)；原文 SHA256：`2b801e4c07a500e07f57759c693f614a7facb3f7a03386997dfed82664776d62`。

## 两轮逐项对抗式审查记录

审查范围：用户前五项及两项补充、41 条原子矩阵；基线 `c89009bb6c7189acb6370b1902347004c1052693`；分支 `codex/material-classification-processing-cleanup`。主审 Codex，独立只读审查代理 material_round1_review；主代理负责修改、页面及最终整合。没有修改用户浏览器数据或执行远端业务。

方法：两轮从需求逐条追踪到入口、处理器、保存、消费者和证据；反向从 diff、路由、Mock、测试返回需求编号，检查越界及删除残留。第一轮初检失败并定向复验，随后源码通过；第二轮重新逐项追踪发现相邻反例，再修复复核通过。下面只记录当时真实源码结果，最终页面证据另行合并关闭。

第一轮代理未独立核对 generated JSON 的新方式同步，也未运行正式浏览器；主代理现场发现后，第二轮专门核对实际静态初始化来源、相邻反例及最终资产证据，不把第二轮新增证明回填成首轮。

### 逐项记录

| 需求 | 第一轮收尾 | 第二轮收尾 | 最终页面/证据闭环 |
|---|---|---|---|
| CAT-01 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| CAT-02 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| CAT-03 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| CAT-04 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| CAT-05 | 未知旧纱线读取阻断及编辑猜填 NF，修复后保持待补、旧身份可读 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| CAT-06 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| FAST-01 | 未发现源码反例，入口和直接专项一致 | 固定 BF select 及机打/手缝契约 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| FAST-02 | 旧 BF 审批绕过必填、同 SPU 导入类型冲突，均加入底层校验 | BF 字段类型、归属、枚举、必填条件及绑定不可破坏 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| FAST-03 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| DYE-01 | 旧缺方式定义可进入 FCS，新动作统一阻断 | 当前配置读取投影固定规则，保留用户可维护字段 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| DYE-02 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| DYE-03 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| PRINT-01 | 旧 ST 说明及编码预览隐藏背面默认值删除 | 当前配置不再被静态旧 A/AB/ST 规则覆盖，配置可保存 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| PRINT-02 | 清空版本后自动代填、旧待审缺正面版本审批，修复并重放 | 真正 JSON 中 CT/AA 独立背面残留删除；共享门禁拒绝非 AB 背面 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| PRINT-03 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| PRINT-04 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| PROC-01 | BF 同组冲突及主代理发现规格N读回改名反例关闭 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| PROC-02 | 旧染色缺方式、旧印花缺版本进入新计划的旁路关闭 | 无有效花型的新增 AB 示例保持草稿/待补；FCS 展示四方式及染色方式 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| LIST-01 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| LIST-02 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| LIST-03 | 保留用户明确规格0/规格1，不再猜改共同名称 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| LIST-04 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| LIST-05 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| LIST-06 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| LIST-07 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| LIST-08 | 历史归档简易主档导入预览/执行口径统一 | 旧测试不再声明已验证已删除的归档操作 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| LIST-09 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| LIST-10 | copyCost 死分支及无用 SKU 弹窗状态删除 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| LIST-11 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| DEL-01 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| DEL-02 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| DEL-03 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| DEL-04 | 未发现源码反例，入口和直接专项一致 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| KEEP-01 | 未知旧分类隔离保护，不阻断真实关联读取 | 重新正反向追踪，未发现新源码反例 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| KEEP-02 | 详情采用 mm、配置写入前保全旧档采用单位 | 技术编辑及加工输入采用历史字段单位，1500 mm 不显示 cm | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| STORE-01 | 源码/过程审查；完整浏览器及最终资产证据当时待核 | 源码满足；最终构建报告及矩阵待主代理归档核对 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| STORE-02 | 源码/过程审查；完整浏览器及最终资产证据当时待核 | 源码满足；最终构建报告及矩阵待主代理归档核对 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| UI-01 | 源码/过程审查；完整浏览器及最终资产证据当时待核 | 源码满足；最终构建报告及矩阵待主代理归档核对 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| PERF-01 | 源码/过程审查；完整浏览器及最终资产证据当时待核 | 源码满足；最终构建报告及矩阵待主代理归档核对 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| REVIEW-01 | 源码/过程审查；完整浏览器及最终资产证据当时待核 | 源码满足；最终构建报告及矩阵待主代理归档核对 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |
| REVIEW-02 | 第一轮时未启动第二轮，未代签 | 源码满足；最终构建报告及矩阵待主代理归档核对 | 通过；对应矩阵实现/专项与最终 pages、process、layout 报告已联查 |

### 第一轮反例及关闭

| 反例 | 原失败 | 处理及复验 |
|---|---|---|
| R1-01 | 历史 BF 缺类型直接审核成功 | 根档与 SKU 审批均拒绝缺类型；FAST-02 专项 |
| R1-02 | 历史采用 1500 mm 详情显示 1500 cm | 详情使用采用字段标签单位；KEEP-02 专项 |
| R1-03/04 | 未知旧纱线阻断其他列表；相邻编辑默认 NF | 未知分类只读保留、编辑空选择及补分类引导；CAT-05 专项 |
| R1-05 | AB 留空代同花、旧 ST 说明 | 明确 AB 双花型版本，说明及当前编码枚举修正 |
| R1-06 | 单位配置保存丢失档案旧采用 mm | 所有相关配置写入前冻结已采用字段；配置后回读 mm |
| R1-07 | 旧归档主档导入预览可过、执行失败 | 简易审核即可用，退出旧启停归档门禁 |
| R1-08 | 缺染色方式仍能建 FCS 计划 | 来源和新动作共享必填校验；PROC-02 专项 |
| R1-09 | 编码预览隐藏背面 v1 导致 A/CT/AA 失败 | 默认清空且切换清理背面；实际页面四预览通过 |
| R1-10 | 同 BF SPU 两行机打/手缝静默保留首行 | 预览及执行拒绝同组类型冲突 |
| R1-11 | 复制已移除但 copyCost 和 SKU 弹窗死状态仍在 | 删除专用状态分支并扫描渲染入口 |
| R1-12/13 | 清空花型版本自动填最新；旧印花缺版本仍能审批 | 显式选择版本、空值保持空；审批校验真实关联且失败保持 PENDING |
| R1-SPEC-READ（主代理页面发现） | 规格0～规格4被读回为 SPU 名，整档编辑重复 | 删除猜填正则；明确型号重读/整档保存专项及50行页面重放 |

第一轮代理执行过的短专项分别为初期 12/12、修复后 18/18、审批受影响项 3/3、规格N最小回归 1/1。它们属于过程记录，不相加冒充独立覆盖，不代替最终 IndexedDB/browser 验收。独立内存用例中基础成本6、MJS加0.8得6.8、GTG加1.3得7.3。

当时已跟踪 diff hash（不含未跟踪文件，不是最终资产）：初检失败 `4c2672cfbc5dedbc3679bf3696bdef086b8cef189c11b8d17e48cf133753986b`；首轮收尾 `d0b1412ff2401b4b218fe997bfaf575f5aac7249902e06272e5dfe770bb20372`；规格N补查 `2d0362ae7656135d28959b0f2d9a1059ce90a45caf61c7b8c83dcb6aa540f101`。

### 第二轮反例及关闭

| 反例 | 原失败 | 处理及复验 |
|---|---|---|
| R2-01 | 真正静态 JSON 的 CT/AA 残留背面花型 | 只改物料静态键；去掉非 AB 背面，底层门禁一致拒绝 |
| R2-02 | 已存 process.segment 旧规则覆盖新枚举，配置编辑无法保存 | 固定规则读取投影，名称及启用等配置事实保留 |
| R2-03 | 历史档技术/加工编辑仍采用当前模板 cm | materialTemplateForRecord 统一采用字段；实际1500mm编辑及加工页面 |
| R2-04 | BF 属性可被配置改成 number/条件字段 | 固定类型、选项、归属和必填条件，拒绝单位/字典/不相关绑定 |
| R2-05 | 新增 AB 示例没有有效花型库关系却容易被当作有效来源 | 作为 DRAFT/NOT_ENABLED 待补示例，执行资料空；新计划门禁拒绝无有效关系，真实 AB 新建使用两种有效示例花型验收 |
| R2-06 | 下游旧测试成功文案仍宣称验证归档阻断 | 文案与实际操作保持一致，不保留已删除动作的虚假成功说明 |

第二轮完整41项源码正反向审查通过。实际静态初始化来源从 pcs-record-bootstrap 到 generated/pcs-record-baseline.json 已核对，其他静态键原字符串不变；原主档和旧身份保留。第二轮 delta 复核 hash `015f34e7d8464ca1e9885839e2b5ee9648fb937266c240848ee4e5b6f62a4abc` 也只是当时已跟踪源码身份。

### 最终证据复核

最终证据已经归档并由主代理和独立审查代理只读复核。全部41项闭环通过；第一轮和第二轮整体审查均通过，无尚未关闭的反例。技术验收不代签用户实际接受。

三个报告共同绑定最终HTML `b2efbbea490404a5a99fcc233b0af974a85775c9ca68197e69a5cc6148f119c8` 和入口 bundle `d79f867f0f75fce768b6e116251f33b8cb282ed4e6a1c43ef3d3350196637c79`；1289个源码文件逐项SHA与三个契约SHA全部一致。267家族各5轮、1335样本，无重复轮、无超时或浏览器异常；最大265.9ms。历史mm夹具双方1500及显式数值断言通过；AB静态示例待补草稿截图与新动作门禁一致。两视口、真实图片、大图、标签生成及PDF、实际PMS/FCS持久回读均纳入当前报告。

最后治理 delta：FCS原有多值页面声明修为list；检查器先严格验证当前合法list的完整标准组件契约，再返回，避免已经迁移的当前页面被错误历史声明阻断。当前无效声明、当前缺骨架仍拒绝；48个专项通过，两个当前范围治理命令通过。它没有改变运行语句或已验收资产，清单登记原页面源码聚合765c7890…和当前仅注释delta后的a88ba156…，技术收据再构建核对资产同一。聚合序列化计算口径见acceptance.json，不能用不同JSON空格格式算聚合后误判。

最终构建工程检查及806个单测通过、全量tsc通过、相邻8契约60/60通过。当前产品证据见 `../verification-evidence/2026-10-12-material-classification/acceptance.json`，治理记录见 `2026-10-12-material-classification-processing.md`；过程失败日志保留原身份，最终技术收据在绑定范围外 `/tmp/material-classification-final/task-receipt.json` 生成。


最终技术路由补查：八个旧目录node:test契约在首跑收据中未匹配专项，阻断技术状态升级；它们实际60/60已通过。补充八个明确文件名的node:test执行路由，新增路由契约证明每个文件生成对应执行命令且无unknownPaths；八个文件通过新路由实际执行的退出值由最终收据记录，其他未识别测试继续阻断；未修改产品或降低门禁。首跑收据保留原身份，最终收据重新生成。


---

## 来源：material-archive-tabs-cleanup.md

[原始版本](https://github.com/laoertongxue/higoods/blob/e45ceac841b15aad352fbc0fda9274a35c44e01c/docs/material-archive-tabs-cleanup.md)；原文 SHA256：`db6ca3ebf29c8a69fc5a20bd54090f2afc641a3eac6e5f2bca60e7dfa9d25a6b`。

## 基础物料档案页签与附件简化

用户本轮要求：删除面料、辅料、纱线SKU档案里的加工计划及对应代码；简化资料，把核心内容移回其他页签。

基线d4b7c34a2dd1aa69e454c5a0322aa4c25202af8f；工作树simple-materials-main-integration/higoods；分支codex/material-archive-tabs-cleanup；生产预览127.0.0.1:43222；管理端1366×768及1280×720。范围是三个专业物料的主档及SKU详情。工厂模块自身计划及已保存单据、加工SKU定义、计量成本包装和简单两类物料保留；没有删除用户附件实体或关联。

### 方案和计划

W1 档案只维护基础定义：删除计划页签、关联计划查询及渲染、创建计划按钮和事件、档案对FCS计划及跳转函数的依赖。保留FCS模块自身业务入口和既有计划来源解析。
W2 核心资料归位：主档基本资料维护通用图片/规格说明；SKU规格维护识别图片/规格说明；加工关系显示对应工艺的色样、投入/花型说明与执行文件。取消专业主档及SKU独立资料页签，旧附件按原所有者/用途可查阅，不猜迁存储或删除字节。
W3 表单按对象限制用途：基础仅识别图片/规格说明；染色仅确认色样/染色标准；印花、绣花、烫画只出现当前执行文件类型。名称可用文件名，历史资料版本收起；加工执行文件修订自动使用新版本，旧引用保留。附件与加工定义仍同一IndexedDB事务保存，失败保留输入；切换有未保存文件时提醒，禁止文件错存到其他主档/SKU。
W4 专项与验收：删除扫描、主档/基础/染色/印花等分支、原附件可读、Blob保存及刷新、工艺修订原子性/失败、两视口及每家族5样本性能；执行相关构建和治理收据。两轮对抗检查分别检查删除遗漏和附件保全/错误归属。

存储：静态演示直接读，用户文件仍原始Blob及fileId，assets/processDefinitions/logRecords同PCS记录事务；不新增业务localStorage，不整包写种子，不迁移或清空用户数据。

### 原子矩阵

确认人：用户确认范围，Codex技术验收；技术通过不代签用户接受。证据与状态在实际执行后填写。

|编号|来源|原子需求|工作包|实现位置|自动化|页面/性能证据|状态|确认版本|
|---|---|---|---|---|---|---|---|---|
|TAB-01|要求1|三个专业SKU无加工计划页签|W1|src/pages/pcs-material-archives.ts|删除/渲染专项|三类SKU直达|已验证|TAB-v1 · Codex技术验收|
|TAB-02|要求1|无创建计划按钮、事件、专用反查及FCS页面依赖|W1|同上|源码删除扫描|基础/加工SKU|已验证|TAB-v1 · Codex技术验收|
|TAB-03|要求2|专业主档无独立资料页签，图库及说明在基本资料|W2|同上|归位专项|三个主档|已验证|TAB-v1 · Codex技术验收|
|TAB-04|要求2|专业SKU无独立资料页签，识别和规格说明在规格|W2|同上|归位专项|三个SKU|已验证|TAB-v1 · Codex技术验收|
|TAB-05|要求2|加工附件在加工关系，按工艺限制上传选项|W2/W3|同上|角色专项|基础/染色/印花/绣花/烫画|已验证|TAB-v1 · Codex技术验收|
|TAB-06|要求2|旧八种用途附件按归属仍可读，不删除字节/关联|W2|同上|旧资料全用途覆盖|原附件直达/回读|已验证|TAB-v1 · Codex技术验收|
|TAB-07|保存|附件和执行定义同动作原子持久，刷新可读|W3|现有PCS事务+附件事件|保存及回读|Blob/版本刷新|已验证|TAB-v1 · Codex技术验收|
|TAB-08|保存|失败保留输入/旧记录，切换提醒及错归属阻断|W3|附件事件及输入处理|故障专项|失败/取消切换|已验证|TAB-v1 · Codex技术验收|
|TAB-09|保留|FCS自身计划、BOM采购、费用单位包装及简单物料不受删页签影响|W1/W2|既有消费者|相邻专项|计量/成本/简单两类邻接|已验证|TAB-v1 · Codex技术验收|
|TAB-10|验收|两视口布局、图片/附件及操作均可用|W4|详情片段|页面断言|1366×768/1280×720|已验证|TAB-v1 · Codex技术验收|
|TAB-11|验收|每家族5个完整响应样本均<=1000ms|W4|浏览器契约|原始采样|命名加载及动作|已验证|TAB-v1 · Codex技术验收|
|TAB-12|验收|两轮对抗检查与最终证据一致|W4|本记录审查段|正反向追踪|反例关闭|已验证|TAB-v1 · Codex技术验收|

### 审查及证据

验证版本 TAB-v1：基线 HEAD 不变，实际为未提交任务差异。页面源码 SHA256 `284b9595847f8c35725a769865b38c93242f33ba3dcd547756d60e8468e45983`；浏览器脚本 SHA256 `b2fc30941bc2705ab1079172d0f0af72bf7bc07144171d41edaf9ec2f93aab8e`；生产预览 index SHA256 `1fa0661a7554d1482256e0ec013992109c22948eca1c07ec7ee2dd6b038d83ae`。Chromium 149.0.7827.55，独立浏览器上下文，网络缓存禁用，上海时区；5轮，最后一轮1280×720，其余1366×768。用户浏览器数据未改。

证据索引：[原始浏览器结果](../verification-evidence/2026-10-12-material-archive-tabs/evidence.json)、[性能家族统计](../verification-evidence/2026-10-12-material-archive-tabs/performance-summary.json)。420个真实事件/加载样本，82个家族，每家族至少5个；最大243.2000000178814ms，全部<=1000ms。起点为导航开始或真实事件，完成包含目标内容、可视图片、字体、两帧绘制；保存另等待本次附件记录与Blob持久回读。三类主档与SKU分别保存并刷新；四类加工规格重复补充文件，旧资产和执行文件引用保留；染色写入失败时记录/Blob均不变，文件输入保留；切换取消/确认及样图大图开关通过。

自动化绑定：TAB-01～06/08由 `tests/unit/pcs-material-archive-tabs.test.ts` 的9项专项覆盖；TAB-01/03～08/10～11由 `tests/browser-contracts/pcs-material-archive-tabs.test.ts` 实际页面覆盖；TAB-09由 `tests/pcs-r1-material-plans.test.ts`、`tests/pcs-simple-material-downstream.test.ts`、`tests/unit/tmf-material-references.test.ts`、`tests/unit/pcs-material-process-roundtrip.test.ts` 及相邻单位/成本/包装与耗材配件页面覆盖。相关Node专项83项通过；构建815项单元检查及Vite构建通过。PDA、打印、导入导出本轮未修改，自动化保留边界核查，不重跑无关操作。

#### 第一轮逐项对抗审查

主代理从TAB-01～12正向检查实现，再从最终页签、编辑器、处理器反向对需求：计划页签、反查、创建按钮、事件、专用FCS导入全部删除；独立资料页签及通用渲染器删除。发现SKU编辑器还有旧资料分支，删除后重新运行类型检查及构建。附件保存必须绑定主档/SKU/当前用途，旧接口缺用途上下文不能绕过。复验通过。

#### 第二轮逐项对抗审查

主代理对旧八种资料用途逐项反查：每种恰好归入一个可读位置，主档不混入子SKU文件，读取不修改原始资产；失败前后持久记录与Blob一致、再次保存通过，执行文件修订保留旧版本。基础规格只两种内容，染色两种，印花/绣花/烫画单一执行文件；当前命名设备截图和性能通过。FCS既有计划的原文件与版本冻结、采购与BOM边界专项通过。

发现相邻计划测试沿用失效的演示花型ID及旧采购错误文案；仅修正测试夹具为花型库可引用的花型/版本并更新精确错误断言，未放宽业务守卫或修改FCS运行逻辑。原失败日志保存在 `/tmp/material-tabs-related.log`、`/tmp/material-tabs-related2.log`、`/tmp/material-tabs-related3.log`；修正后83项通过。浏览器采集器的首次读取范围与连续保存完成判断曾不准确，校准记录保留在 `output/playwright/material-archive-tabs-calibration*`，最终采集等待本次文件持久记录及DOM内容，不靠旧成功提示。

#### 文件与证据追踪补充

运行代码仅 `src/pages/pcs-material-archives.ts`：`renderArchiveAttachments`、`attachmentRoles`、`attachmentSection`、`nextExecutionRevision`、主档/SKU渲染及附件输入/保存处理。原型数据仓库、FCS计划、采购/BOM接口均沿用既有实现。专项运行器在 `scripts/workflow-governance/affected-checks.ts` 精确登记当前浏览器和相邻计划测试，未知测试不能用构建代替。

本次最终收据固定输出 `/tmp/material-archive-tabs-final/task-receipt.json`，按冻结的完整任务文件清单生成；收据自身不进入绑定差异。工具当前会再次执行登记的浏览器、治理和构建检查；这是收据工具的实际限制，未为复用证据顺带改造工具。技术通过不代表用户已接受界面，也不代表本轮已发布GitHub或Vercel。


---

## 来源：product-archive-technical-reference-cleanup.md

[原始版本](https://github.com/laoertongxue/higoods/blob/e45ceac841b15aad352fbc0fda9274a35c44e01c/docs/product-archive-technical-reference-cleanup.md)；原文 SHA256：`309c082e72a831ff6f8ad7137709550581d68179e93121a2fa3795fc42a4a68e`。

## 款式与规格档案技术引用删除

本轮来源：用户要求款式档案、规格档案删除截图中的技术引用，并删除专属代码。基线abc80b6a5716fb62b031dbdbd66f2c561a2b8b9c；分支codex/product-archive-technical-reference-cleanup；工作树simple-materials-main-integration/higoods；同树生产预览127.0.0.1:43222；管理端1366×768、1280×720。

### 范围、计划与关联

两页共用pcs-product-archives.ts。旧technicalTab反查技术版本和核价方案，并生成跳转链接；旧产品专项还要求技术引用存在。删除两页的引用浏览，不删除技术包和核价自身的业务数据、模块或有效关联，不删除档案的身份与生命周期防错。

- W1 删除两页technical页签、两个正文分支、technicalTab及专属查询导入；不留隐藏入口。
- W2 共享有效页签清单控制渲染与事件，旧/伪造页签不能重新打开已删除内容；修正冲突的历史断言。
- W3 在关联技术版本的演示款式及对应SKU上验证删除和原数据保全；验两个详情冷加载、刷新和保留页签，核对两个视口和完整响应。
- W4 两轮正反向审查、矩阵、治理与收据，文件冻结后输出收据，不改历史已发布记录。

存储：本轮仅减少只读查询，没有新增保存入口、格式或迁移；款式/SKU、技术版本、核价方案沿用原静态与IndexedDB来源，没有删除记录、Blob或关联。浏览器验收使用独立上下文，用户截图中的本地自建数据不作为可复制的演示种子。

### 原子矩阵

确认人：用户明确删除范围；Codex技术验收，不代签用户接受。

|编号|来源|原子要求|工作包|实现位置|自动化|页面/性能|状态|证据及版本|
|---|---|---|---|---|---|---|---|---|
|REF-01|用户要求|款式详情无技术引用页签及正文|W1|DETAIL_TABS/styleBody|产品专项|款式直达/刷新|已验证|REF-v1|
|REF-02|用户要求|规格详情无技术引用页签及正文|W1|DETAIL_TABS/skuBody|产品专项|SKU直达/刷新|已验证|REF-v1|
|REF-03|清洁代码|专属查询依赖、渲染函数、引用跳转代码删除|W1|pcs-product-archives.ts|源码删除断言|无隐藏引用区|已验证|REF-v1|
|REF-04|清洁代码|旧/伪造页签事件不重开已删除内容|W2|详情事件及渲染清单|旧事件注入|页面内容及选中态保持|已验证|REF-v1|
|REF-05|关联保全|技术包、核价自身关联及档案数据不因删除浏览而改动|W3|原仓库/命令未修改|BOM/生命周期/只读快照|技术包独立页面|已验证|REF-v1|
|REF-06|页面验收|保留页签、两个视口布局、图片可用|W3|原详情及页签正文|浏览器断言|1366×768/1280×720|已验证|REF-v1|
|REF-07|性能|受影响加载/刷新/切换每家族5样本<=1000ms|W3|浏览器契约|原始采样|内容/图片/字体/两帧完成|已验证|REF-v1|
|REF-08|交付|两轮逐项正反向审查及最终收据|W4|审查记录|治理与收据|不重复无关流程|已验证|REF-v1|

### 实质审查

第一轮：从两个详情页签走到正文、查询、跳转和事件。共享technicalTab及两条导入/两条分支删除；有效清单同时控制事件，旧事件不进入DOM更新。历史PROD-010还要求该页签，且沿用旧销售页签名称，已经同步到当前目标。原基线失败日志 `/tmp/product-tech-baseline.log` 保留；修改后29项通过。

第二轮：对关联技术版本的演示款式与其SKU执行冷加载、刷新、每个保留页签切换；两类旧technical事件在单元与真实页面均无法重开，页面内容和活动页签保持。源码没有technicalTab、引用区域文案、引用跳转及两条专属导入；只有原详情文件的只读浏览逻辑变化，仓库、命令、路由、技术版本与核价数据没有改动。技术包独立直达页面及工程BOM核价工作流通过；产品29项专项涵盖档案审批、引用防错、销售内容、包装和身份。正向8条与反向实际diff均一致，通过。

### 当前版本证据

REF-v1实际HEAD仍为基线加未提交差异；源码SHA256 `1edbb87db76860598712d56739692f529d4788c880f3038cc0ae7a96375263be`，浏览器脚本SHA256 `6f4ef95aceeabc14bf22bd67360b275b511b26e261acf2cf328d50d4913af139`，运行index SHA256 `29b3fa4cfa3c5784db8479d7f097030eb52d00515d8c55e659fe5eeae2d9a5f9`。Chromium149.0.7827.55，上海时区，禁用网络缓存；独立浏览器上下文。服务PID96414及cwd已核对为同一工作树。款式ID `style_demand_SPU_QC_001`、SKU ID `skuSeed_style_demand_SPU_QC_001_001` 是带真实演示关联的原型记录，非用户截图中自建记录。

[原始浏览器证据](../verification-evidence/2026-10-12-product-technical-reference/evidence.json)和[性能汇总](../verification-evidence/2026-10-12-product-technical-reference/performance-summary.json)覆盖REF-01～08。75样本、15家族，每家族5次，最大261.69999998807907ms，全部<=1000ms；四轮1366×768，一轮1280×720。导航/真实事件为起点，目标内容、可视实物图片、字体和两帧绘制为终点。新增保存、文件迁移、PDA、打印、导入导出均不适用，本轮未改这些动作或格式。

[款式页面](../verification-evidence/2026-10-12-product-technical-reference/style-1366.png)、[规格页面](../verification-evidence/2026-10-12-product-technical-reference/sku-1280.png)。REF-01～04自动化为 `tests/pcs-r1-product-rules.test.ts`；REF-05另绑定 `tests/pcs-engineering-bom-version-workflow.spec.ts` 和浏览器技术包直达；REF-06/07为当前浏览器契约；REF-08绑定两轮审查及最终收据。所有实现位置均为 `src/pages/pcs-product-archives.ts` 的DETAIL_TABS、styleBody、skuBody、renderDetail和页签事件；REF-05相关业务消费者未改。

构建815项单元检查及Vite构建通过；产品29项专项和BOM工作流通过。精确运行器路由测试通过，新浏览器和产品专项不使用构建代替运行。原失败日志与本轮日志存放 `/tmp/product-tech-*.log`，收据最终输出 `/tmp/product-technical-reference-final/task-receipt.json`，冻结文件后生成；工具会再次执行必要浏览器/构建检查，旧原始证据保留原版本。该技术交付不代表本轮已合并main或发布。
