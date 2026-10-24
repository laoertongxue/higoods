# 质检管理合并 main 集成审查

依据：[AGENTS.md](../../AGENTS.md) 当前项目规则；继承已确认质检需求及main发布要求。

## 基本信息

- 日期：2026-10-23
- 任务 / 需求编号：376条质检原子需求继承原方案；本轮仅增加M01～M08合并发布验证，不新增辅料或财务业务需求。
- 验证人：Codex主代理 /root，原型技术核验，不代替用户业务接受。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：T4共享事实/打印/库存合并，叠加T5明确授权合并本地main并推送GitHub main。

## 继承范围、对象和计划

原质检业务、调整方案、实施计划及376条原子矩阵仍有效；原r34x完整52项工作流、376条、830个常规性能样本及18份PDF保留原版本。质量任务原223条路径经逐字节核对后形成`ccdedbdf`。本轮原main为`6f4775510f0d2fcfe4583db0d80bfe20b60e7719`，比原基线增加3个提交：QC发货紧急参考、辅料Mock、裁剪改厂Mock。本轮保留其历史和有效功能，辅料无新增要求。

执行顺序：核对既有验收内容→明确路径提交→合并并保留main3个提交→处理冲突及同源数量/打印→专项契约→受影响性能/纸面与当前完整工作流→提交合并→干净本地main快进→正常推送→Actions/HTTPS版本、页面及资源核验。禁止重写共享历史和覆盖其他工作树资料。

业务对象仍使用原PCS记录/附件及原库存记录；无新库或业务快照。QC读视图保留全部物理消费者关联的QC，紧急参考使用已准备事实及单记录revision核对，避免为显示星级重复恢复无关归档标准。成衣库存以原库存质检的实时批次为基线，叠加唯一来源的生产回货实收；送检下架、待上架和瑕疵不得恢复成可售。直接出货保留冻结目标仓、实际发出/实收；紧急参考按正常放行量含未抽随批放行计算，复检仅作为已存历史读取，绝不恢复新建/执行入口。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 原验收版本与提交 | 通过 | `premerge-verified-boundary.json`逐字节核对223路径，原52项verified证据保留 |
| 九处冲突语义 | 通过 | 保留原质检固定标准和取消复检；保留main紧急参考/供货去向/规则；旧复检写命令不恢复 |
| 供给数量、分批与仓收不重复 | 通过 | `integration-100-green.log`原102项，数量补验`physical-total-green.log`26项（真实接收100+40只合并一次及总实物数/排序一致）；新增100件正常放行含70未抽，40/20两次直接出货、待出货和40实收共100的最小契约先失败再通过 |
| 打印刷新与图片门禁 | 通过 | `priority-browser-r2.json`原页面实际加载、坏图不打印、恢复后原按钮重试；`priority-print-merged.png`，保留原双签/固定标准/图码就绪 |
| 原生存储与附件 | 通过 | `native-merged.log`47项，包含库存新读取范围不回写旧值/版本、共同事务、附件及冲突恢复。全部原页面和跨端另由最终工作流再验，未生成不视为存在 |
| 性能与纸面 | 通过 | `merged-print-acceptance.json`6族30次（最高1097.2ms，3次超过1秒，均≤会话确认的2秒），`merged-final-evidence.json`46族230次（受影响实时库存15次重新实测，最高708.2ms，其余215次保留原版本）；实际6份PDF30页逐页查看，原版本原值保留 |
| 发布边界 | 不适用 | 本表为推送前代码审查，M08和执行计划仍为待实施；最终发布记录核对完整SHA/Actions run/HTTPS manifest/页面与资源后才记成功 |

## 最终结论

结论：通过

此处为合并代码及已有专项审查通过；整体验证与发布尚未完成，实际工作流、性能、纸面和Production结果另由`output/qc-main-publication-20261023/`的原始证据及最终发布记录决定。任何失败须修复后继续，不以本审查替代收据或发布回执。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/post-finishing-qc-entry.ts`
- `src/data/fcs/post-finishing-qc-shipping-priority-runtime.ts`
- `src/data/fcs/post-finishing-qc-shipping-supply.ts`
- `src/data/fcs/post-finishing-records.ts`
- `src/data/pcs-legacy-qc-demo-materials.ts`
- `scripts/verification/quality-inventory-performance.mjs`
- `src/main.ts`
- `src/pages/print/print-preview.ts`
- `src/pages/print/templates/post-finishing-qc-print-template.ts`
- `src/pages/process-factory/post-finishing/full-flow-print.ts`
- `src/pages/process-factory/post-finishing/qc-orders.ts`
- `src/pages/wls/finished/stock-realtime.ts`
- `tests/quality-management-rules.spec.ts`
- `tests/post-finishing-pda-role-boundary.spec.ts`
- `tests/post-finishing-full-flow.spec.ts`
- `tests/browser-contracts/post-quality-storage.test.ts`
- `tests/unit/post-finishing-accessory-read-mode.test.ts`
- `tests/unit/legacy-three-qc-material-bindings.test.ts`
- `tests/unit/post-finishing-qc-priority-print.test.ts`
- `tests/unit/post-finishing-qc-shipping-behavior.test.ts`
- `tests/unit/post-finishing-qc-shipping-integration.test.ts`
- `tests/unit/post-finishing-qc-shipping-runtime.test.ts`
- `tests/unit/post-finishing-qc-shipping-supply.test.ts`
- `tests/unit/warehouse-stock-single-read.test.ts`
- `tests/workflow-governance/affected-checks.test.ts`
- `docs/prototype-review-records/2026-10-22-quality-management.md`
- `docs/prototype-review-records/2026-10-23-quality-main-integration.md`

### 页面证据

- 版本：本工作树`ccdedbdf`及未提交合并增量；main基线`6f477551`，原43585预览保留，不充作合并版本。
- 证据：`output/qc-main-publication-20261023/priority-browser-r2.json`及`priority-print-merged.png`，1024×768实际页面；命名管理尺寸及PDA随完整套件检查。

### 性能结论

- 结论：通过
- 依据：用户已确认功能优先且不超过2秒，本次新增main集成按该上限复验；打印6族30次、库存46族230次均有效且不超2秒。原r34x的常规1秒结果保留其原版本。本轮打印3次超过1秒（最高1097.2ms）完整列入超过1秒清单，不声称合并版本全部≤1秒。
- 固定资产：`merged-runtime-r2.json`（108源码/资源路径，固定预览43626）；原纸面实际解码证据仅用于未变的编码器，不冒称新实物打印验收。

### 验证命令

- `npm run typecheck:engineering`：通过
- `node --import tsx --test tests/unit/post-finishing-qc-shipping-*.test.ts tests/unit/post-finishing-qc-priority-print.test.ts tests/unit/warehouse-stock-single-read.test.ts`：通过
- `CUTTING_E2E_PORT=43624 PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test tests/quality-management-rules.spec.ts --grep=main合并兼容 --workers=1 --reporter=json`：通过

### 合并验证原子矩阵

| 编号 | 原子结果 | 实现/证据 | 状态 |
| --- | --- | --- | --- |
| M01 | 已验收223路径按原字节提交，不混入其他工作 | premerge-verified-boundary.json / ccdedbdf | 已验证 |
| M02 | main原3个提交完整保留且不恢复复检节点 | 两个父历史及最终merge tree | 已实现待验证 |
| M03 | 正常放行、分次直接出货及实收不重复供给 | shipping-supply / priority-green-r3.log | 已验证 |
| M04 | 紧急参考刷新先于输出，坏图仍阻断且可重试 | qc-print-template / priority-browser-r2.json | 已验证 |
| M05 | 库存质检下架/待上架使用同一库存事实且不重复叠加生产实收 | shipping-priority-runtime / 实际库存完整UI及原1000SKU+15参考库存精确总数 | 已实现待验证 |
| M06 | 原共同事务、附件、版本/CAS、备份/恢复及跨端不回归 | 原生及75/6/24/23完整套件 | 已实现待验证 |
| M07 | 合并版本受影响性能和纸面有原始证据 | merged-print-acceptance.json / merged-final-evidence.json / print-pdf-review/inventory.json | 已验证 |
| M08 | 本地/远端/API main与Production SHA/run完全一致 | 最终发布记录 | 待实施 |

### 验收工具差异说明

库存首轮因调用缺少显式预览地址未采集；第二轮页面已正常显示，但旧断言误把main原15条只读参考库存排除在总数外而超时。`inventory-count-probe.log`确认实际1015条。工具改为从原4000批次的仓库/SKU及main固定参考来源推导精确去重总数，保留1000SKU、24SKU送检、所有数量/图像/事务终点及5次采样。原失败保留，不改成0ms或通过。参考库存不转成可送检批次。

冻结后的完整工作流输出位置：`output/qc-main-publication-20261023/merged-task-receipt.json`；M02/M05/M06最终状态及M08发布完成状态在同目录`release-report.md`和`release-result.json`写后登记。冻结文件不预填尚未执行的结果；这些最终回执与本审查共同构成合并交付记录。

## 例外

- 用户在本会话明确“性能暂时2s以内、优先实现功能”。本轮main集成新增打印样本按2秒上限判定；原1秒目标及3个新慢样本保留，不修改项目默认门槛，不声称全路径已低于1秒。

### 冻结后发现的数量边界与收口

主代理完整差异审查发现：同仓同SKU原库存100件叠加真实后道实收40件时，正常量已140但总实物数仍100。已停止首轮工作流，`workflow-r1-interrupted.json`和原日志保留；真实领域命令契约先失败后通过，库存总数与排序改为同一实际数量。当前26项相邻契约通过，`physical-total-ui.json/png`为隔离实际页面核对，不代表真实入仓。

源比较`quantity-fix-source-reuse-proof.json`确认仅只读库存合并函数和总库存排序表达式变化；打印所有相关函数、模板/标准/编码器不变，原6份30页/30次保持原版本复用。库存冷开/刷新/SPA各5次用新固定43626实测，最高708.2ms；其余43族215次保留原身份。部分采集器仍保留diagnostic/full-false原身份，组成证据仅验证实际选择的3族，不冒称该部分工具全量通过。当前最终收据重新运行至指定路径，冻结后不修改受管文件。

### main既有样例及旧回放定位修订

r2完整收据实际65项中63项退出0，2个浏览器聚合命令因4个旧定位假设失败，原文件保留`merged-task-receipt-r2-failed.json`、`merged-browser-2.json`、`merged-browser-3.json`及`r2-failure-artifacts/`。其中旧PDA假定待入库只有5单，main已有H05/M05使实际7单；全部对象为旧5加main6，共11；原001回货已不能假定出现在第一页，且“列表第一条”可能是受控AW单，禁止交给旧整单写入口。

只修验收定位：精确核对7张待办及H05/M05单号、001接收后6张；11条全量中仍保留5条旧单/6条main单，持久层仍只保存本次001覆盖；原4行库存按001来源单筛选；旧只读详情通过已有查询准确找001；旧整单回归明确使用非受控001，不调用AW受控单。原厂物料和新main业务均不改写。4个原失败用例在43627独立服务实际重放均通过，0跳过/0重试，见`four-fixture-cases-r3.json`（31.0秒）。

固定候选提交后以原main为基线重新运行完整收据；适用范围是相对main的全部质检任务差异，未改变的main辅料Mock专项保留r2真实退出0。现有收据工具不支持复用执行结果，仍执行它要求的全部当前门禁；最终状态写在同目录发布回执，不把r2失败改称通过。此修订只有测试/记录变化，108项运行源码和既有性能/纸面结果不变。
