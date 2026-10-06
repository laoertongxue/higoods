# R1 物料、计量、编码与标准成本实施证据

日期：2026-10-05。工作树：`/Users/laoer/Documents/higoods`。分支：`main`，本轮开始 HEAD：`88324f65506f47c678b17d1b51879f8fd7c2488a`。这是未提交工作区的专项实现记录，非发布或整体验收结论。

本文件由材料工作包负责，覆盖 WP04/05/06 及明确授权的 BRIDGE-005、物料业务导入导出。基础配置、通用存储、总路由、技术包成本桥接由主代理/对应工作包接入；不修改总追踪矩阵。页面、打印和真实 IndexedDB 事务验收尚由主代理执行。因此以下需求统一保持“已实现待验证”；特殊未闭合范围另列，不能据单元测试将总矩阵置为已验证。

## 自动化执行

最后执行：`node --import tsx --test tests/pcs-r1-material*.test.ts`，51 项通过、0 项失败。六个专项文件：

- `tests/pcs-r1-material-rules.test.ts`：编码、规范 SKU、标准成本、计量、包装、审核、重读、设计改款桥接、上下游入口、复制、资料版本。
- `tests/pcs-r1-material-pattern-read.test.ts`：花型读取不触发种子/迁移业务写入。
- `tests/pcs-r1-material-plans.test.ts`：四工艺独立物料计划、准确前驱与版本、工厂/数量/日期、幂等/版本冲突、冻结快照、Blob 水合、按计划 ID 存储。
- `tests/pcs-r1-material-reference-check.test.ts`：修改主单位前核对 PMS 引用；未改单位跳过查询，已有引用/不可读取阻断，检查完成后才允许 PCS 写入。
- `tests/pcs-r1-material-review-regressions.test.ts`：3 mm 绳子结构化直径、旧尺寸文本兼容、非法尺寸阻断、逐项审核结果、单项事务完成/失败、主档及子 SKU 原子边界。
- `tests/pcs-r1-material-transfer.test.ts`：CSV 格式、整组校验、原子内存准备、确认阶段失败不半套发布、编码顺序、0 值、导出边界、图像引用、纯计算容量。

测试通过的“重读”是仓库缓存重置后从已登记快照读取；测试通过的“原子”是待提交批次准备与失败回滚。不将其宣称为真实浏览器 IndexedDB 事务完成、跨标签冲突或 Blob 刷新验收。

`npx tsc --noEmit --pretty false` 最近结果：材料负责文件和新增 FCS 计划页面没有诊断，四个 FCS 路由导出已接通；全仓当次仍报 `src/data/fcs/factory-receiving-source-sync.ts:20`、`src/data/pms/tmf-material-purchases.ts:813,824` 三处既有诊断。没有将本包无诊断表述为全仓编译通过。

## 原子需求对应

下表中 `archive repository` 指 `src/data/pcs-material-archive-repository.ts`；其余材料文件默认位于 `src/data/`，页面函数位于 `src/pages/pcs-material-archives.ts`。测试证据为上述专项中的测试标题前缀。

| 编号 | 需求 | 实现位置 | 已落实结果 | 专项/后续验证 |
| --- | --- | --- | --- | --- |
| MAT-001 | 五类列表提供共用主档和SKU视图 | `pcs-material-archives.ts: renderListPage / filteredRoots / filteredSkus` | 列表独立；主档与 SKU 视图共享同一仓库 | 五类列表、筛选、列设置、分页与视图切换待浏览器 |
| MAT-002 | 删除独立变种创建和维护入口 | `pcs-material-variant-repository.ts + pcs-material-archives.ts: relations` | 旧 Variant 只读投影；新增入口拒绝，树节点跳同一 SKU 详情 | CODE/MAT: previous target IDs and aliases |
| MAT-003 | 阶段技术变化保存在产出SKU有效规格 | `pcs-material-archive-repository.ts: normalizedEffectiveSpecs / createProcessedMaterialSku` | 产出有效规格独立；width 为单一有效幅宽；上道不变 | MAT-003/UOM: output width is one field |
| MAT-004 | 新审核SKU具备可识别资料 | `pcs-material-archive-repository.ts: setMaterialApproval；pcs-material-r1-seeds.ts` | 正式审核校验识别图和执行资料；演示工艺缺执行文件则保持草稿 | MAT-012: formal processed SKU；大图及真实识别效果待浏览器 |
| MAT-005 | 复制主档只复制资料与允许属性 | `pcs-material-archive-repository.ts: copyMaterialArchive` | 复制主档共用图片引用；新资料 ID，清空 SKU/审核/价格历史 | MAT: copied archive reuses file references |
| MAT-006 | 复制SKU必须有真实身份差异 | `pcs-material-archive-repository.ts: materialSkuIdentityFingerprint / createMaterialSkuRecord` | 身份去重忽略展示名；编辑包装不构成新规格 | MAT: copying a display name alone |
| MAT-007 | 条码打印使用SKU身份和真实图文 | `pcs-material-archives.ts: print-label / print-confirm` | 模板、SKU、数量选择后按稳定身份生成二维码；不写库存或状态 | 真实浏览器打印及二维码回读待验收 |
| MAT-008 | 染印绣烫物料加工产生新SKU | `pcs-material-archive-repository.ts: createProcessedMaterialSku；pcs-material-rules.ts` | 四工艺都有直接投入 SKU、产出 SKU 和定义；编码承接实际前驱 | CODE: direct predecessor；MAT/CODE: CSV stages |
| MAT-009 | 裁片压褶打揽不产生物料SKU | `pcs-material-rules.ts: buildProcessedMaterialCode` | 物料入口拒绝 CUT_PIECE/WOOL_PANEL/GARMENT；未改造裁片执行域 | CODE: direct predecessor；裁片压褶/打揽领域回归由主代理继续 |
| MAT-010 | 同目标返工不自动生成永久SKU | `pcs-material-archive-repository.ts: createProcessedMaterialSku / resolveMaterialSkuIdentity` | 已存在目标不能同身份重复新增；未添加返工建新 SKU 的动作 | CODE/MAT: previous target IDs；返工单原目标引用待跨域验收 |
| MAT-011 | 对象变化后同工艺可再次出现 | `pcs-material-rules.ts: buildProcessedMaterialCode` | 禁重范围是同一个物料对象；裁片等对象由其自身业务域承接 | 代码边界已落实；面料印花后裁片再印场景待跨域验收 |
| MAT-012 | 花型ID与执行文件分用途关联 | `pcs-material-pattern.ts；pcs-material-archive-repository.ts: reviseMaterialProcessAssets / setMaterialApproval` | 花型 ID/版次从花型库选取，识别图/展示图/执行稿分别关联；普通读取不播种 | MAT-012: pattern selection；MAT-012: formal processed SKU；MAT-012: registered file previews |
| MAT-013 | 资料小修与交付改变分开 | `pcs-material-archive-repository.ts: reviseMaterialProcessAssets；pcs-material-rules.ts` | 执行文件修订保留旧资料版本且不改 SKU；交付修订入码 R02 | MAT-013/CODE-005: execution-file corrections |
| MAT-014 | 加工建单不要求库存有量或接口成功 | `pcs-material-handoff.ts；fcs/material-process-plans.ts；process-work-orders/material-process-plans.ts` | 四工艺独立计划新建/草稿编辑/详情/列表；保存真实计划 ID、投入/目标/定义版本；不查库存、不虚构生产需求或裁片 | 7 项 MAT/FCS 专项通过；实际浏览器提交/刷新/耗时由主代理验收 |
| MAT-015 | 多基础规格使用实际前驱完整码 | `pcs-material-rules.ts: buildProcessedMaterialCode；archive repository` | 每个加工码完整保留前驱码，不退回根码拼接 | CODE: direct predecessor；MAT/CODE: CSV stages |
| CODE-001 | 单面A双面AB进入印花码 | `pcs-material-rules.ts: buildProcessedMaterialCode` | 单面 A、双面 AB，固定 YH | CODE: direct predecessor |
| CODE-002 | 渗透印有独立入码段 | `pcs-material-rules.ts: buildProcessedMaterialCode` | 渗透印 ST 独立编码段 | CODE: direct predecessor |
| CODE-003 | 烫画具有明确工艺编码段 | `pcs-material-rules.ts: buildProcessedMaterialCode` | 烫画 TH，并保留完整前驱 | CODE: direct predecessor |
| CODE-004 | 不同花双面保留正反顺序 | `pcs-material-rules.ts: buildProcessedMaterialCode` | 不同花 F/B 正反位置保留；反面缺失阻断 | CODE: direct predecessor |
| CODE-005 | 同花号交付变化有修订段 | `pcs-material-rules.ts；archive repository: reviseMaterialProcessAssets` | 资料版本与交付修订分别维护 | CODE: direct predecessor；MAT-013/CODE-005 |
| CODE-006 | 编码使用结构字段生成并保留规则版本 | `pcs-material-archive-types.ts: MaterialProcessDefinition；archive repository` | inputSkuId / processDefinitionId / codeRuleVersionId 为真实关联 | CODE/MAT: previous target IDs and aliases |
| CODE-007 | 旧码别名可查可扫码 | `archive repository: resolveMaterialSkuIdentity` | 旧 xPT 保存为同一 SKU 别名；不解析 X 找投入 | CODE/MAT: previous target IDs and aliases |
| CODE-008 | 生成码超长时禁止静默截断 | `pcs-material-rules.ts: checkedMaterialCode` | 超过 256 字符抛可纠正错误，不截断 | CODE: direct predecessor |
| CODE-009 | 不同Pantone体系同号不发生新编码冲突 | `pcs-material-rules.ts: buildProcessedMaterialCode` | TCX 默认；非 TCX 显式体系段 | CODE: direct predecessor；非默认体系页面候选待浏览器 |
| UOM-001 | 每物料SKU有且只有一个主单位 | `archive repository: create/updateMaterialSkuRecord；物料编辑页面` | SKU mainUnit 为唯一可写主单位；根级仅兼容投影 | UOM: fixed conversions；根/明细页面待浏览器 |
| UOM-002 | SKU详情有独立计量单位Tab | `pcs-material-archives.ts: renderUnits` | SKU 独立计量单位 Tab，显示单位、量纲、精度、关系、历史 | MAT: reload restores SKU identity；刷新直达待浏览器 |
| UOM-003 | 辅助关系使用1辅=X主的固定方向 | `pcs-material-rules.ts: validateMaterialRelation；renderUnits` | 1 辅 = X 主，X 正数，固定物理换算不可改 | UOM: fixed conversions；UOM/COST: CSV rejects nonpositive |
| UOM-004 | 跨量纲换算必须具备规格依据 | `pcs-material-rules.ts: validateMaterialRelation` | 跨量纲必须明确依据，不默认 1:1 | UOM: fixed conversions |
| UOM-005 | 批次实测不覆盖标准换算 | `archive repository: saveMaterialUnitRelation / freezeMaterialCostSnapshot` | 标准关系版本保留；不提供批次实测覆盖标准入口 | COST/UOM: new conversion version updates current descendants |
| UOM-006 | 包装含量和包装规格独立保存 | `archive repository: saveMaterialPackageSpec` | 同 SKU 多个独立包装及含量关系，可保留 100/600 PCS | UOM: two packages share SKU identity |
| UOM-007 | 纯包装变化不自动新增永久SKU | `archive repository: saveMaterialPackageSpec` | 包装调整新版本，不建新 SKU | MAT: processed siblings；MAT-003/UOM: output width |
| UOM-008 | 净重毛重与面料克重分属不同基准 | `pcs-material-archive-types.ts；renderPack / renderPackEditor` | 克重 g/m²、每主单位净重 KG、每包装毛重 KG 分开 | MAT-003/UOM: output width；字段位置待浏览器 |
| UOM-009 | 体积来源明确且未知不默填零 | `pcs-material-rules.ts: materialPackageVolume` | 尺寸计算/确认体积/未知有来源；未知 null | UOM: two packages share SKU identity |
| UOM-010 | 使用过的主单位锁定 | `archive repository: updateMaterialSkuRecord / saveMaterialUnitRelation` | 已审核或已使用主单位锁定；关系修订新 ID/版本 | UOM: fixed conversions；COST/UOM: new conversion version |
| COST-001 | 印花染色取消Asaya分价 | `archive types: MaterialStandardCostVersion；renderCost / renderCostEditor` | 共同标准成本，无 Asaya 分价字段 | GOV-027: business exports；标准成本页面待浏览器 |
| COST-002 | 标准采购成本人工维护 | `archive repository: saveMaterialStandardCost` | 只显式人工标准命令维护；实际采购不自动改标准 | COST: P + initial freight；成本与实际采购跨域回归待验收 |
| COST-003 | 默认人民币支持IDR和USD展示 | `archive repository: materialStandardCostDisplay；renderCost` | 默认 CNY/RMB，IDR/USD 只展示换算 | COST: zero is complete; null is missing; display rates |
| COST-004 | 缺展示汇率有明确反馈 | `archive repository: materialStandardCostDisplay` | 缺汇率返回未配置提示，不按 1 或 0 显示 | COST: zero is complete; null is missing; display rates |
| COST-005 | 全部标准价统一含税 | `archive types: MaterialStandardCostVersion；renderCostEditor；transfer` | 报价与综合标准统一含税 | COST: P + initial freight；表单/导出待浏览器 |
| COST-006 | 基础运输只累计一次 | `archive repository: calculateCost / prepareMaterialStandardCost` | 基础采购已含运输不再重复 T，链路只累计初次 T | COST: P + initial freight |
| COST-007 | 后段运输不进入公式 | `archive repository: prepareMaterialStandardCost；renderCostEditor` | 加工阶段拒绝新增运输字段 | COST: P + initial freight |
| COST-008 | 损耗缩率不进入本期物料公式 | `archive repository: calculateCost` | 公式不乘损耗/缩率 | COST: P + initial freight |
| COST-009 | 加工费按产出单位表达 | `archive repository: materialUnitFactorInSnapshot / calculateCost` | 每道按产出单位统一；源报价保留单位与归一依据 | COST/UOM: source currency and unit normalization |
| COST-010 | 辅材已含在加工费中 | `archive types / calculateCost / renderCostEditor` | 加工费含辅材，无重复辅材加项 | COST: P + initial freight |
| COST-011 | 不纳入一次性费和分摊 | `archive types / calculateCost / renderCostEditor` | 无开版、制网、打样摊销字段 | COST: P + initial freight |
| COST-012 | 未维护与真实零值不同 | `pcs-material-rules.ts: materialMoney；archive repository: calculateCost` | null 与 0 区分；上游缺价传递不完整 | COST: zero is complete; null is missing |
| COST-013 | 来源精度保留且统一末次舍入 | `pcs-material-rules.ts: decimal helpers；archive repository` | 原报价字符串保留，内部 8 位，展示 4 位 | COST/UOM: source currency；COST: preview normalizes |
| COST-014 | 上游变化自动更新所有依赖分支 | `archive repository: previewMaterialCostChangeInSnapshot / saveMaterialStandardCost` | 当前标准依赖递归重算所有分支，不追加下游复核 | COST: P + initial freight；PERF: 100 cost descendants |
| COST-015 | 展示汇率变化不触发成本重新生效 | `archive repository: materialStandardCostDisplay` | 展示汇率只影响结果展示，不产生成本版本 | COST: zero is complete; null is missing; display rates |
| COST-016 | 已确认已发布历史成本快照不被改写 | `archive repository: freezeMaterialCostSnapshot / readMaterialCostReference` | 冻结来源版本、单位系数与金额；BOM 接入由主代理负责 | COST: P + initial freight；已发布 BOM 页面/保存待主代理验收 |
| COST-017 | 未发布草稿读最新参考并显示变化 | `archive repository: readMaterialCostReference` | 草稿返回最新参考及 changed；普通读取不写 | COST: P + initial freight；read operations never persist；BOM 草稿待主代理验收 |
| BRIDGE-005 | 设计改款可连续染色再印花 | `pcs-design-revision-material-sku.ts；pcs-engineering-master-sampling.ts；pcs-independent-sampling.ts` | 移除染印互斥，目标经 canonical SKU 的实际前驱串联 | BRIDGE-005: one canonical target retains both dye and print |
| GOV-008 | 业务导入先预览再按主对象原子保存 | `pcs-material-transfer.ts；pcs-material-archives.ts: confirmMaterialTransfer` | 三种 CSV 模板、逐行预览、整组阻断、同命令原子保存通过组 | GOV-008 四条导入测试；真实 IndexedDB 中止/刷新待主代理 |
| GOV-027 | 业务导入导出不变成浏览器整库备份恢复 | `pcs-material-transfer.ts: exportMaterialBusinessRows` | 导出全部筛选业务对象，不含备份/恢复、供应商/库存；文件是引用 | GOV-027 两条业务导出/图像引用测试 |
| GOV-022（物料范围） | 批量动作显示选中数及逐项结果 | `archive repository: runMaterialApprovalBatch；pcs-material-archives.ts: runBatchApproval / renderMaterialApprovalBatchResults` | 每个选中对象独立等待 `runPcsRecordCommand` 完成；逐项显示编码、名称、成功/失败及原因；失败对象保持选中 | 四条 GOV-022 专项；实际浏览器逐项保存/刷新和耗时待主代理 |

## 存储和接口

- 唯一物料存储键：`higood-pcs-material-archive-store-v2`，schema v5。主键为：records.materialId、skuRecords.materialSkuId、usageRecords.usageId、logRecords.logId、processDefinitions.processDefinitionId、unitRelations.relationId、packages.packageSpecId、costVersions.costVersionId、assets.assetId。没有第二套可写 Variant 身份。
- 静态/水合接口：`getMaterialArchiveBaseline()`、`getMaterialArchiveStoreSnapshot()`、`resetMaterialArchiveCache()`。新增 R1 演示 ID 已交存储工作包登记独立演示版本清单，不在普通读取时整包落盘。
- 持久动作从页面 `await runPcsRecordCommand(...)` 执行，确认成功后更新页面。`withMaterialArchiveMutationBatch()` 仅准备同一次动作的多个主/子对象；它不另建数据库或绕过通用事务。
- 图片预览/附件由现有 PCS Blob 事务链负责。CSV 使用 `getPcsDurableFileReference()` / `resolvePcsFileReference()`，静态路径保留，已保存图片用文件 ID；临时 blob URL、data URL 和缺失文件引用拒绝。复制复用图片实体引用。
- 物料页已登记 `registerPcsUnsavedChanges`，取消/离开会释放 pendingFiles。Tab 切换不另加拦截，公共导航离开保护由主代理控制。
- `pcs-material-reference-check.ts` 在主单位实际变化时动态读取 PMS `hasMaterialPurchaseReference()`；采购草稿/历史记录已引用或引用不可读取时，不开始 PCS 写事务。单位未变化不查询 PMS；既有已审核/已用锁仍由仓库校验。PMS 与 PCS 分库，各自保存数量/单位快照，没有跨库双写或跨库原子性的承诺。

## 页面与可复验对象

- 五类列表：`/pcs/materials/fabric`、`accessory`、`yarn`、`consumable`、`parts`。列表使用标准列表壳；详情和编辑独立路由，SKU 详情为“规格 / 加工关系 / 加工计划 / 计量单位 / 标准成本 / 包装物流 / 资料 / 记录”八个 Tab。
- 基础例：物料 `material-r1-MAT-FB-00000001`，SKU `material-r1-MAT-FB-00000001-B01`；加工例 `material-r1-process-dye`、`material-r1-process-print`、`material-r1-process-double`、`material-r1-process-penetration`、`material-r1-process-embroidery`、`material-r1-process-heat`。
- 静态 P=5、T=1、染 F=.8、印 F=1.2，印后=8；基础 P 调为6，印后当前=9，冻结快照仍8。加工示例缺真正执行文件时保持草稿，不用识别图假冒生产文件以通过审核。
- 业务导入 / 导出位于每类列表，三种 CSV 为物料主档与 SKU、单位关系、标准成本。主档视图导出不会遗漏无 SKU 的主档；其行标为“无 SKU（待建立）”，重新导入新增 SKU 前须补齐基础规格。单位关系导出含历史，历史行不是免校验恢复命令。

## 性能测量接口

以下均为显式调用的纯准备入口，不会自动造浏览器业务数据：

```ts
import { createMaterialImportValidationCsv, createMaterialCostValidationSnapshot } from '/src/data/pcs-material-performance-fixtures.ts'
import { previewMaterialBusinessImport } from '/src/data/pcs-material-transfer.ts'
import { previewMaterialCostChangeInSnapshot } from '/src/data/pcs-material-archive-repository.ts'
const rows100 = previewMaterialBusinessImport('fabric', 'archives', createMaterialImportValidationCsv(100))
const rows1000 = previewMaterialBusinessImport('fabric', 'archives', createMaterialImportValidationCsv(1000))
const fixture = createMaterialCostValidationSnapshot(100)
const cost = previewMaterialCostChangeInSnapshot(fixture.snapshot, fixture.baseSkuId, { purchaseStandardCny: 6 })
```

最后 Node 单次诊断：100 行纯校验 6.92 ms；1000 行纯校验 54.24 ms；100 后代成本纯预览 2.70 ms。这些是本机 CPU 准备耗时，不含浏览器提交、事务 complete、UI 完整渲染，不能替代项目页面 <500 ms / 导航门禁。浏览器性能必须由主代理在实际服务版本按完整动作另测。

## 四工艺物料加工计划承接

主代理本轮明确授权的最小接收域调整：既有早期染印单要求生产需求、特殊工艺任务要求生产单，因此保留其原职责，新增同域“物料加工计划”来源。计划不是开工、收料、领料或完成事实；不会凭物料档案虚构生产需求、生产单、菲票或新的裁片 SKU。

- 数据：`src/data/fcs/material-process-plans.ts`，`higood-fcs-material-process-plans-v1`，`{version:1,plans:[]}` 空静态来源，按 `planId` 写记录。普通读取不产生计划。
- 页面：`src/pages/process-work-orders/material-process-plans.ts`。独立列表 `/fcs/process/material-plans`；独立新建 `/new`；详情 `/:planId`；草稿编辑 `/:planId/edit`。表单、详情均有计划信息/工艺资料 Tab，详情另有操作记录。
- 材料跳转：`materialProcessHandoffPath()` 的四工艺统一带入 `inputSkuId/outputSkuId/processDefinitionId/processVersionId`。直接投入来自定义，不允许用根坯布冒充染后前驱。
- 接收领域填写投入数量、产出数量、工厂、计划日期、负责人。草稿可留空；确认计划前校验正数、单位精度、日期、工厂对应工艺能力。工厂采用实际工厂档案；绣花复用 AUX-OP-EMBROIDERY，烫画复用 AUX-OP-HEAT-TRANSFER。
- 工厂选项显示真实 `Factory.name` 与 `Factory.code`，不使用会回退成编码的 `factoryShortName`；新增计划保存真实名称快照。染色示例为 `PT Prima Printing Center（ID-FAC-0002）`，增加专项核对名称/编码与主档一致。
- 保存后生成实际 `planId/planNo`，`getFcsMaterialProcessPlanReceipt()` 提供稳定详情引用。`listFcsMaterialProcessPlans({skuId})` 是档案加工计划 Tab 的只读来源，不把计划复制进物料档案。
- 计划保存当次投入/目标图片、主单位及版本、工艺/资料版本和共享文件引用。旧计划保持冻结版本；草稿编辑不可替换身份；已计划只读。`markMaterialSkuMainUnitUsed()` 在同一 `runPcsRecordCommand` 中锁定被引用单位。
- 页面所有持久动作等待通用事务成功才导航；未成功保留输入，重复保存幂等；注册公共离开保护。四个专业加工列表提供“物料加工计划”入口。
- 本包仅添加新 key/空 baseline 注册；bootstrap 性能优化随后由主代理接管，最终以其静态发布样本读入实现为准。

## 独立审查修复

- 绳子新建/编辑按 `categoryAttributes.diameter` 与版本化模板单位校验。`3` + `mm` 可保存和重读；显式 0、负数、非数值不能借旧 `widthText` 绕过校验。已有仅存 `widthText=直径 3 mm` 的档案保持可维护，不自动捏造新结构化数值；表单从直径生成兼容尺寸文本。织带继续读取结构化 `width`。
- 批量提交/审核拆为逐对象保存，主档及其待处理子 SKU 仍是一个原子动作。前一项失败不取消其他合法对象，只有保存 Promise 完成才标记“已保存”；失败对象显示具体原因并保持选中。列表提供“查看批量结果”入口，结果窗口可关闭。
- 上述新增专项的事务失败由可控 command seam 模拟回滚，并非浏览器 IndexedDB 故障验收；父代理仍需重放实际保存、刷新及失败结果。

## 尚未闭合的验收与接收域边界

1. PMS 实际采购草稿由存储工作包继续实施。材料按钮依旧进入真实 `/pms/material-purchase-orders`，不代该领域保存供应商或数量；其具体结果和证据由对应工作包记录。
2. 四工艺物料加工计划已实现并通过专项，但真实浏览器的保存完成、刷新直达、共享文件可查看、物料反查及完整动作耗时仍由主代理验收。不能用 Node 快照重读代替 IndexedDB 验收。
3. 裁片压褶/打揽、面料印后裁片再印、毛织多主料及实际返工单属于既有技术/生产对象。本包仅限定物料新 SKU 入口，不代表其全链已验收。
4. COST-016/017 对外提供冻结和实时参考接口；正式技术包/BOM 发布与草稿变化提示由主代理桥接并单独验证。
5. 五类列表 1366×768 / 1280×720、独立详情/编辑、Tab、刷新直达、真实图片大图可关闭、条码打印与回读、真实 IndexedDB 容量/失败/冲突/刷新、共享配置启停和持久化完整动作性能，均仍需主代理的命名页面证据。

上述未闭合项是交付边界记录，未以绿色专项测试代替页面、存储和整体业务验收。
