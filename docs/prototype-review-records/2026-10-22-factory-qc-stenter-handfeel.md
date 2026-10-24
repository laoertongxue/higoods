# 印花QC单、染厂QC单与定型机手感单实施审查记录

依据 `AGENTS.md` 的T4、TRACE-01、STORE-01～05、LIST-01、IMAGE-01、PERF-01、EVIDENCE-01；需求V2/U06十项确认，U07「执行」授权。本记录只关闭本地原型技术范围，旧洗水历史审查/原始证据保留各自版本身份。

## 基本信息

- 日期：2026-10-22
- 任务 / 需求编号：RQ-001～RQ-060、ATM-001～ATM-135、AC-001～AC-048；印花QC/染厂QC/定型机手感
- 验证人：Codex主代理（技术确认）；用户及工厂现场接受未执行

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：新增逐卷质检和整单手感，来源首批最终实物触发；共享来源按必要记录同事务保存；旧洗水活跃代码/资料/格式/路由/Mock/专属测试退役，直接Web/PDA/打印/技术资料/库存消费者切换。保持Vite/TypeScript字符串页面及浏览器原型边界，无发布。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 来源条件、同一QC及后续补卷 | 通过 | E11九阶段45样本，实际印花/染色PACK/水溶/改非染厂补建、16实报/1登记/补15同单；单元覆盖未知/染厂/最终节点负例及唯一性 |
| 每卷质检内容、完成锁与照片 | 通过 | E10实际两同名原Blob、三个独立结果、有差异仍完成、只读/陈旧页拒绝；DB底层同版本写/删及字节guard的原版本合同保留，最终1505条含当前锁定合同 |
| 整单决定与GTG | 通过 | 四目标/实际触摸/处理决定独立；无目标仍可建单、加工前补；任一实际交出后仅记录；未判断/未检/缺图不阻交出；同单追加及GTG显式CONTINUE均实际验证 |
| 上下游、同厂与库存数量 | 通过 | E10真实ID-F002→GTG→F090及差异实收；E11真实GTG内部360Yard、六原卷、创建无收发，转入扣原阶段、接收再增待加工；收用产交收各自保存，无虚构运输和双记 |
| 保存、事务及恢复 | 通过 | E12十五UI阶段75样本，打开/配额/中止/提交后读失败/旧来源不可读/真实blocked/恢复；原输入、记录和Blob SHA保持，无localStorage业务后备 |
| 附件引用与回收 | 通过 | JPEG/PNG/WebP原Blob，同库提交；同名不同ID不串卷，完成引用不可变。公共GC API5次各2666204字节、重复0，仅回收无引用文件，仍引用/完成照片保持 |
| 旧业务退役与共享保护 | 通过 | E13四真实旧路由页面未找到，无新单重定向/旧写；旧备份实际validator负例；旧技术节点/BOM/成本及85旧时效单精确删除，163邻居和完整1505回归通过，必要原始/共享事实保留 |
| 标准列表、设备及局部交互 | 通过 | 两QC列表同列已检/应检并可进入卷详情；1366/1280/1024与PDA390，分页/筛选/列管理、键盘/焦点/离开提醒、局部更新和完成只读均有实际记录 |
| 实物图片、大图和打印 | 通过 | E10对应静态物料图及真实File/Blob上传；图片加载/失败、大图Esc等交互；20份实际产品PDF，30卷单2页/卷标10页，原始PNG及目视记录保留。上传验证素材不冒称现场拍摄 |
| 完整响应性能 | 通过 | E10/E11/E12共97阶段485有效UI样本，每阶段5；全部≤1000ms，最大884.3ms。冷/刷新/站内/失败/重试/取消分开，原始旧慢值和失败不删除 |
| 最终正反追踪与范围 | 通过 | 60RQ/135ATM/48AC稳定唯一；127已验证/8明确不适用；正向需求→实际位置/证据，反向菜单/路由/Mock/读写/删除/测试→需求。受管清单覆盖本任务全部差异；无无关工作被纳入 |
| 技术与现场接受/发布分别记录 | 通过 | AC-048实际现场接受未执行、无代填确认人；尚未提交/推送/部署。技术收据仅证明绑定的机器检查，其实际状态独立读取 |

## 最终结论

结论：通过

结论限于本次已授权的本地原型技术实施及验收；不是工厂现场、实体打印机/扫码硬件、生产系统或多人共享接受。矩阵完成127条产品/执行原子，8条不适用为原文档阶段六条、无复制入口和未建QC/手感业务备份界面；没有以“不适用”跳过实物质检/交出/GTG/旧数据保护。

## 变更覆盖与验证

### 受管文件

下列清单包含已删除对象、新增/修改运行代码、测试、采集器及五份方案；基准HEAD为6f4775510f0d2fcfe4583db0d80bfe20b60e7719。删除的旧专属文件可由该Git版本恢复；历史审查和原始证据不冒称当前需求。

- `docs/acceptance-plans/2026-10-22-印花QC单染厂QC单与定型机手感单验收方案.md`
- `docs/implementation-plans/2026-10-22-印花QC单染厂QC单与定型机手感单实施计划.md`
- `docs/product-design/2026-10-22-印花QC单染厂QC单与定型机手感单调整方案.md`
- `docs/product-design/post-print-fabric-washing/atomic-requirements.md`
- `docs/product-design/post-print-fabric-washing/gtg-routing-and-processing-layout-v1.3.md`
- `docs/product-design/post-print-fabric-washing/implementation-plan.md`
- `docs/product-design/post-print-fabric-washing/list-entry-and-washing-name-v1.2.md`
- `docs/product-design/post-print-fabric-washing/requirements.md`
- `docs/product-design/post-print-fabric-washing/upstream-downstream-review.md`
- `docs/product-requirements/2026-10-22-印花QC单染厂QC单与定型机手感单需求方案.md`
- `docs/prototype-review-records/2026-10-22-factory-qc-stenter-handfeel.md`
- `docs/requirement-traceability/2026-10-22-印花QC单染厂QC单与定型机手感单需求原子矩阵.md`
- `scripts/check-post-print-fabric-washing-edges.mjs`
- `scripts/check-post-print-fabric-washing-ui.mjs`
- `scripts/check-post-print-fabric-washing.mjs`
- `scripts/check-printing-washing-entry.mjs`
- `scripts/check-prototype-full-function-performance.mjs`
- `scripts/check-washing-detail-tabs.mjs`
- `scripts/check-washing-draft-route.mjs`
- `scripts/check-washing-gtg-direct-consumers.mjs`
- `scripts/check-washing-gtg-ui.mjs`
- `scripts/verification/factory-qc-browser.mjs`
- `scripts/verification/factory-qc-fault-preview.mjs`
- `scripts/verification/factory-qc-preview.mjs`
- `scripts/verification/factory-qc-retired-routes-preview.mjs`
- `scripts/verification/factory-qc-source-preview.mjs`
- `src/components/actual-stenter-handfeel-route.ts`
- `src/components/actual-washing-route.ts`
- `src/data/app-shell-config.ts`
- `src/data/fcs/design-revision-pcs-command.ts`
- `src/data/fcs/design-revision-pcs-storage.ts`
- `src/data/fcs/dyeing-quantity-facts.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/dyeing-warehouse-view.ts`
- `src/data/fcs/fabric-washing-gates.ts`
- `src/data/fcs/fabric-washing-maintenance.ts`
- `src/data/fcs/fabric-washing-mock.ts`
- `src/data/fcs/fabric-washing-model.ts`
- `src/data/fcs/fabric-washing-repository.ts`
- `src/data/fcs/fabric-washing-storage-bridge.ts`
- `src/data/fcs/fabric-washing-views.ts`
- `src/data/fcs/fabric-washing.ts`
- `src/data/fcs/factory-internal-warehouse.ts`
- `src/data/fcs/factory-process-storage.ts`
- `src/data/fcs/factory-qc-model.ts`
- `src/data/fcs/factory-qc-recipient.ts`
- `src/data/fcs/factory-qc-records.ts`
- `src/data/fcs/factory-qc-views.ts`
- `src/data/fcs/factory-qc.ts`
- `src/data/fcs/factory-receiving-types.ts`
- `src/data/fcs/factory-receiving-warehouse.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/data/fcs/legacy-washing-removal.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/printing-factory-demos.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/process-action-writeback-service.ts`
- `src/data/fcs/process-order-task-link-core.ts`
- `src/data/fcs/production-artifact-generation.ts`
- `src/data/fcs/production-context-records.ts`
- `src/data/fcs/stenter-handfeel.ts`
- `src/data/fcs/tech-packs.ts`
- `src/data/fcs/water-soluble-output.ts`
- `src/data/fcs/water-soluble-task-domain.ts`
- `src/data/generated/pcs-record-baseline.json`
- `src/data/pcs-record-db.ts`
- `src/data/pcs-technical-data-demo-projection.ts`
- `src/data/production-timing/fixtures.json`
- `src/data/production-timing/source.ts`
- `src/data/tech-pack-process-route.ts`
- `src/main.ts`
- `src/pages/fcs-production-tech-pack-snapshot.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-handover.ts`
- `src/pages/pda-warehouse-shared.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/print/printing-sheet-preview.ts`
- `src/pages/print/templates/printing-sheet-template.ts`
- `src/pages/process-factory/dyeing/events.ts`
- `src/pages/process-factory/dyeing/pending-receipts.ts`
- `src/pages/process-factory/dyeing/recipient-dialog.ts`
- `src/pages/process-factory/dyeing/stenter-handfeel/execution-dialog.ts`
- `src/pages/process-factory/dyeing/stenter-handfeel/presentation.ts`
- `src/pages/process-factory/dyeing/stenter-handfeel/work-orders.ts`
- `src/pages/process-factory/dyeing/warehouse.ts`
- `src/pages/process-factory/dyeing/washing/detail-views.ts`
- `src/pages/process-factory/dyeing/washing/execution-dialog.ts`
- `src/pages/process-factory/dyeing/washing/order-presentation.ts`
- `src/pages/process-factory/dyeing/washing/work-orders.ts`
- `src/pages/process-factory/dyeing/water-soluble-orders.ts`
- `src/pages/process-factory/dyeing/work-order-detail.ts`
- `src/pages/process-factory/printing/dialogs.ts`
- `src/pages/process-factory/printing/events.ts`
- `src/pages/process-factory/printing/relations.ts`
- `src/pages/process-factory/printing/work-order-detail.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/pages/process-factory/shared/factory-qc.ts`
- `src/pages/process-water-soluble-orders.ts`
- `src/pages/production/detail-domain.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/process-domain.ts`
- `src/pages/wls-inbound.ts`
- `src/pages/wls/raw/inbound-list.ts`
- `src/pages/wls/raw/stenter-handfeel-stock.ts`
- `src/pages/wls/raw/washing-stock.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes-pcs.ts`
- `src/router/routes-pda.ts`
- `src/router/routes-wls.ts`
- `src/router/routes.ts`
- `tests/browser-contracts/prototype-maintenance-entrypoints.test.ts`
- `tests/unit/craft-detail-read-boundary.test.ts`
- `tests/unit/craft-entry-initialization.test.ts`
- `tests/unit/craft-route-preload.test.ts`
- `tests/unit/dye-recipient-change.test.ts`
- `tests/unit/dyeing-handfeel-quantity-facts.test.ts`
- `tests/unit/dyeing-warehouse-single-read.test.ts`
- `tests/unit/fabric-washing-maintenance.test.ts`
- `tests/unit/fabric-washing-route-codec.test.ts`
- `tests/unit/fabric-washing-views.test.ts`
- `tests/unit/fabric-washing.test.ts`
- `tests/unit/factory-qc-lazy-static-read.test.ts`
- `tests/unit/factory-qc-page-recovery.test.ts`
- `tests/unit/factory-qc-recipient.test.ts`
- `tests/unit/factory-qc-reported-roll-count.test.ts`
- `tests/unit/factory-qc-reported-roll-display.test.ts`
- `tests/unit/factory-qc-source-command-scope.test.ts`
- `tests/unit/factory-qc-source-file-reference.test.ts`
- `tests/unit/factory-qc-triggers.test.ts`
- `tests/unit/factory-qc.test.ts`
- `tests/unit/fcs-design-revision-result-readiness.test.ts`
- `tests/unit/legacy-washing-removal.test.ts`
- `tests/unit/pcs-material-static-source.test.ts`
- `tests/unit/pda-sewing-detail-canonical-task.test.ts`
- `tests/unit/production-context-hydration-concurrency.test.ts`
- `tests/unit/production-timing-full-flow-fixtures.test.ts`
- `tests/unit/production-timing-scenarios.test.ts`
- `tests/unit/production-timing-source-detail.test.ts`
- `tests/unit/retired-process-route.test.ts`
- `tests/unit/special-craft-scoped-relations.test.ts`
- `tests/unit/stenter-handfeel.test.ts`
- `tests/unit/stenter-pda-render-boundary.test.ts`
- `tests/unit/washing-execution-dialog.test.ts`
- `tests/unit/washing-factory-warehouse-overview.test.ts`
- `tests/unit/water-soluble-command-entry.test.ts`
- `vite.config.ts`

### 页面证据

- 版本：工作树 /Users/laoer/.codex/worktrees/941b/higoods，分支codex/factory-qc-stenter-handfeel，基准HEAD 6f4775510f0d2fcfe4583db0d80bfe20b60e7719 加本任务差异；固定生产预览 http://127.0.0.1:43222；asset14 index SHA256 4cd3863a03f10909fc9d879ca6b5e32c0c7eb276159a08b4feb33b20622d89e4，JS/CSS摘要70a4b7b8b4f35692f29f49230bb029c5225c9e3b6b4b2dd04f2d3b7ed2637892。最终完整构建后与采集前manifest逐项一致。Chromium桌面1366×768/1280×720/1024×768、PDA390×844；浏览器/CPU/缓存/fixture和起止条件在各报告中。任务完整差异/指令/CodeGraph绑定以冻结后独立收据为准。
- 证据：E10 output/playwright/factory-qc-preview-formal-asset14/results.json（365样本、40功能case、20PDF、同目录visual-review.json/原collector）；E11 factory-qc-source-formal-asset14/results.json（45样本及相邻完整链，含实际GTG内部）；E12 factory-qc-fault-formal-asset14/results.json（75UI及API5）；E13 factory-qc-retired-routes-asset14/results.json（4旧地址）；后三目录同在output/playwright。E14 output/verification/factory-qc-20261022/logs/higoods-qc-build-final6.log与higoods-qc-scope-final14.log。按AC的实际阶段、专项及语义补充见output/verification/factory-qc-20261022/acceptance-evidence.json。

### 性能结论

- 结论：通过
- 依据：主73×5=365，来源/维护/内部9×5=45，故障15×5=75，共485；每个命名member或family/phase均5次，全部有效值≤1000ms，最大884.3ms。另15次仓库首次导航最大439.7ms及10次大图交互均满足门槛，GC API5单列0.5～0.9ms。确认/点击至事务complete、持久回读、实际页面/图/字体与绘制完整终点，不能用函数返回或空DOM代替。资产一致、零浏览器异常/开发源码请求；原始每值/最大值/脚本hash与环境在E10～E12。独立水溶1512米缺卷明细时有QC头和待补状态，没有造卷或冒称完成检查。

### 验证命令

- `npm run build`：通过
- `node scripts/check-typescript-scope.mjs src/data/fcs/factory-process-storage.ts src/data/fcs/factory-qc-records.ts`：通过
- `node scripts/verification/factory-qc-preview.mjs --run --trials 5 --output output/playwright/factory-qc-preview-formal-asset14`：通过
- `node scripts/verification/factory-qc-source-preview.mjs --run --trials 5 --output output/playwright/factory-qc-source-formal-asset14`：通过
- `node scripts/verification/factory-qc-fault-preview.mjs --run --trials 5 --output output/playwright/factory-qc-fault-formal-asset14`：通过
- `node --check scripts/verification/factory-qc-retired-routes-preview.mjs && node scripts/verification/factory-qc-retired-routes-preview.mjs`：通过

最终完整build为1505/1505，Vite28.37秒；全部70个当前改动源文件范围检查0错误，完整typecheck保留19个范围外既有错误，不声称全量typecheck通过。专项、前失败/后修复及早期构建日志归档在output/verification/factory-qc-20261022/logs。最终治理/标准列表/路由和受影响检查由冻结后workflow:verify执行，收据位置output/verification/factory-qc-20261022/task-receipt.json；机器状态以该文件实际结果为准，本文不预写verified。工具对6个已删旧测试分别触发全量单元回退及强制完整build的重复检查如实保留，不修改检查器或绕过必需检查。

### 例外

- 无产品规则或性能例外。全量19个既有TypeScript错误与额外旧脚本缺陷分别记录，当前所改70源文件为零。未提供新QC/手感业务备份/恢复界面，不承诺清浏览器数据可恢复；测试站数据库未访问。

## 正反向语义审查

正向逐条核对60RQ及135ATM：首个最终实物批次/明确非染厂、同QC补卷、真实16/1/15口径、每卷原照片和三个结果、完成不可改、交出独立、整单决定/四目标/无目标待补、任何部分实际交出后不新建、GTG同/跨厂真实收用产交收、阶段QC不递归、CONTINUE保留旧COMPLETE、旧业务定向删除和共享原事实保留。反向检查本清单中的菜单/路由/页面/处理器、五必要来源键与各集合、附件/版本/操作ID、Mock、技术路线/BOM/成本/时效、Web/PDA/打印/库存及新旧测试均有本任务需求归属；没有改依赖或升级框架，没有借旧门禁恢复QC前置。

独立核心审查一次及主代理后续全任务审查中的问题均已修复；文档旁路只核对追踪和语义，不冒称第二次独立代码审查。当前实际色差/触摸/物料结果可有差异而完成，整体没有通过/不通过或自动扣款。用户确认的两处原笔误按染厂语义落定。

## 失败证据与修复版本

| 原版本或诊断 | 实际问题与当前处理 |
| --- | --- |
| 早期构建1443/1465及静态退役 | 扩大覆盖出现26项回归，准确删除旧技术/时效对象并更新有效合同；163直接邻居及最终1505通过 |
| 资产7～9的校准 | 冷PDA/仓库/小PDF等出现1112/1103.2及1252～1572ms等有效慢值，原始目录保留；按需静态QC、普通并发只读合并、仓库三次事实→一次、新手感PDA按需加载，未放宽合法防错 |
| 资产9～10的恢复与CONTINUE | 打开失败无法重读、提交后读失败提示覆盖、旧已实收卷误计阶段；实际函数红/绿合同和当前故障75及CONTINUE5验证恢复 |
| 资产11来源维护 | 无DYE当前baseline导致无关AUTO静态文件引用入事务并正确拒绝；精确只读serializer限制改变行，真实文件校验未放宽 |
| 资产12来源完成 | nativeWAIT_HANDOVER/940/16已提交，冷/热页仍PACKING；首次有界重建少vatSchedules/formulas，补五数组结构，不采用无关排缸/配方。静态COLOR附件按原地址/ID补静态归属，缺失用户Blob仍拒绝 |
| 资产13、14 | 13来源30/故障75原样保留。14追加业务语言caption与GTG同厂3阶段；全部主365/来源45/故障75最终在14重验，未改旧结果冒称新版本 |
| GTG首轮新collector | 弹窗已关闭后等待不存在error locator造成默认30秒，目录factory-qc-source-internal-calibration-asset14保留并标collector-invalid；即时DOM读取后v2校准3项、正式各5通过，不把采集错误填0或解释成产品通过 |
| final4构建 | 1498/1499，旧PDA AST harness缺normalizePathname依赖；装载真实函数后9/9，final5及最终1505通过，未改业务规则迎合测试 |

以上原始目录均在output/playwright相应版本路径，开发合同五家族及DB底层guard、旧源冲突/技术资料保留记录在factory-qc-contracts各时间目录。开发服务43221只用于领域/IDB诊断，不并入43222固定资产性能；未变DB完成锁等事实保留原版本适用性，最终受影响UI全部重验。

## 额外既有脚本与范围外限制

额外运行的check:tech-pack-process-route首先在旧文字「BOM物料并行」断言失败，基准HEAD独立archive也失败；诊断旧fixture继续触发已存在的测款/纸样/发布确认与图片门槛。所有诊断性script改动已撤回，该脚本与HEAD逐字相同，本次没有放宽业务校验来迎合它，且未把它列为通过。相关原日志在本任务logs归档；当前退役拓扑与精确静态保护由本任务新专项/163邻居及最终build验证。该脚本属于额外既有问题，未纳入未获授权的共享fixture重构。

## 交付与接受记录

本地技术成果：本任务工作树、五份方案/矩阵及E10～E15原始记录。冻结任务文件后生成独立收据，不在本绑定文档里回填其机器状态避免自变更；实际状态看task-receipt.json。现场业务接受、实体设备测试、提交/推送/部署均未发生。若后续要求发布，另按同SHA构建与目标环境回执执行，不以本次原型证据代填。
