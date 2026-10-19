# 辅料仓四阶段逐项验收结果

> 2026-10-19，实施V1.2；当前结论：96条原子需求与49项AC的实现、功能及适用性能已验证。当前冻结差异的最终交付另以技术收据verified为准。技术核验人：Codex 主代理及具名专项代理，不代填用户产品接受。

基线 HEAD `4a0ce9ef5a30e8dec4537de1ff59159543902a25`，分支 `codex/accessory-warehouse-flow-20261019`，工作树 `/Users/laoer/.codex/worktrees/ca23/higoods`。运行只操作隔离本地浏览器上下文，没有测试站/生产数据库写入，没有提交、推送或部署。

## 功能证据边界

正常新业务无附件上传；完整UI备份恢复的files=0，非空Blob另由迁移和存储契约验证。新业务无静态记录删除入口，因而不新增删除功能；已有库存0覆盖、取消接收、失效清单和凭证版本均保留记录，刷新和恢复不得复活。款图依U9允许演示错配，所有款图仍需存在和加载；物料图对应性未豁免。

## AC逐项结果

| 编号 | 功能结果/具体边界 | 自动化入口 | 实际证据 | 设备及适用打印/PDA | 性能及整项状态 |
| --- | --- | --- | --- | --- | --- |
| AC01 | 三仓身份/启用/独立区位，基础仓库实际查询；demo identity与现场核定编码区分。 | `tests/browser-contracts/accessory-warehouse-stage1-ui.test.ts`；`tests/unit/accessory-warehouse-master.test.ts` | `output/playwright/accessory-warehouse/stage1/diagnostic-results.json`；`output/playwright/accessory-warehouse/stage1/gtp-filtered-export.csv`；`output/verification/accessory-warehouse-current-units.log` | 1366x768、1280x720、1024x768；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC02 | 每仓2区6位且18位实际可查看；位置lookup/归属/数量。 | `tests/browser-contracts/accessory-warehouse-stage1-ui.test.ts`；`tests/unit/accessory-warehouse-master.test.ts` | `output/playwright/accessory-warehouse/stage1/diagnostic-results.json`；`output/playwright/accessory-warehouse/stage1/gtp-filtered-export.csv`；`output/verification/accessory-warehouse-current-units.log` | 1366x768、1280x720、1024x768；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC03 | 两个准确名字/档案身份映射，未知/近似/缺档案/冲突不默认；待定分配主线。 | `tests/unit/accessory-warehouse-master.test.ts`；`tests/unit/accessory-warehouse-flow.test.ts` | `output/verification/accessory-warehouse-current-units.log`；`output/playwright/accessory-warehouse/diagnostic/contracts.log`；`output/verification/accessory-factory-link-unit.log` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC04 | 三仓分组顺序及所有新叶页路由已绑定；基础页/GTP/调拨/待收/库存/区位/两仓领料均由真实页面入口核验。 | `tests/browser-contracts/accessory-warehouse-stage1-ui.test.ts`；`tests/browser-contracts/accessory-transfer-ui.test.ts` | `output/playwright/accessory-warehouse/stage1/diagnostic-results.json`；`output/playwright/accessory-warehouse/stage1/gtp-filtered-export.csv`；`output/playwright/accessory-warehouse/stage2-transfer-ui/results.json` | stage1 1366/1280/1024、later transfer9 combinations、pickup/post1024; postPDA390；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC05 | 面料看板移到库存管理；原地址、默认入口、筛选重置、图片及刷新保留；页面与数据两文件和基线字节相同。原页面无导出动作，本次不为移动菜单新增导出。 | `tests/browser-contracts/accessory-retired-module.test.ts`；`tests/unit/accessory-warehouse-master.test.ts` | `output/verification/accessory-retired-module/results.json`；`output/verification/accessory-retired-module-test.log`；`output/playwright/accessory-warehouse/diagnostic/contracts.log` | 1366x768；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC06 | 五旧URL/旧render/handler/file检查与NotFound；FCS相邻其他工艺/原写保护；混单与历史资料保留。 | `tests/browser-contracts/accessory-retired-module.test.ts`；`tests/browser-contracts/accessory-fcs-readonly.test.ts` | `output/verification/accessory-retired-module/results.json`；`output/verification/accessory-retired-module-test.log`；`output/playwright/accessory-warehouse/fcs-readonly/results.json` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC07 | GTP查询/逐行实配/备注/记录/数量；写动作只在GTP，本仓不代三方领料。 | `tests/browser-contracts/accessory-warehouse-stage1-ui.test.ts`；`tests/browser-contracts/accessory-fcs-readonly.test.ts` | `output/playwright/accessory-warehouse/stage1/diagnostic-results.json`；`output/playwright/accessory-warehouse/stage1/gtp-filtered-export.csv`；`output/playwright/accessory-warehouse/fcs-readonly/results.json` | 1366x768、1280x720、1024x768；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC08 | 同源持久读取、刷新/独立页面/冷直达及FCS只读跟进，不靠旧页初始化。 | `tests/browser-contracts/accessory-warehouse-records.test.ts`；`tests/browser-contracts/accessory-fcs-readonly.test.ts` | `output/verification/accessory-current-records.log`；`output/playwright/accessory-warehouse/fcs-readonly/results.json`；`output/playwright/accessory-warehouse/stage1/diagnostic-results.json` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC09 | 各scope首次读取不复制静态记录，读取无业务command。 | `tests/browser-contracts/accessory-warehouse-records.test.ts`；`tests/browser-contracts/accessory-fcs-readonly.test.ts` | `output/verification/accessory-current-records.log`；`output/playwright/accessory-warehouse/fcs-readonly/results.json`；`output/playwright/accessory-warehouse/stage1/diagnostic-results.json` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC10 | 真实事务中止/故障注入，输入保留，同按钮/同command恢复，无假成功与半套。 | `tests/browser-contracts/accessory-warehouse-stage1-ui.test.ts`；`tests/browser-contracts/accessory-warehouse-records.test.ts` | `output/playwright/accessory-warehouse/stage1/diagnostic-results.json`；`output/playwright/accessory-warehouse/stage1/gtp-filtered-export.csv`；`output/verification/accessory-current-records.log` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC11 | 最终WLS递归图标注册及语义契约通过，14组、131项共145个实际SVG均有可见图形。 | `tests/unit/accessory-warehouse-master.test.ts`；`tests/unit/accessory-site-cutting-factories.test.ts` | `output/playwright/accessory-warehouse/diagnostic/contracts.log`；`output/playwright/accessory-warehouse/stage1/diagnostic-results.json`；`output/playwright/accessory-warehouse/stage1/gtp-filtered-export.csv` ；`output/playwright/accessory-warehouse/stage1/diagnostic-results.json` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC12 | 最终145节点图标、展开/收起/选中及局部列设置图标通过；135为早期树历史数字，不作为最终数量。 | `tests/browser-contracts/accessory-warehouse-stage1-ui.test.ts` | `output/playwright/accessory-warehouse/stage1/diagnostic-results.json`；`output/playwright/accessory-warehouse/stage1/gtp-filtered-export.csv`；`output/verification/accessory-warehouse-review/targeted-fix-recheck-2026-10-19.json` ；`output/verification/accessory-final-stage1-ui-2.log` | 1366x768；图标不构成业务PDA或打印场景 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC13 | 最后一行未齐不能完成，跨物料总量不能抵消；超量/无材料拒绝。 | `tests/browser-contracts/accessory-warehouse-stage1-ui.test.ts`；`tests/unit/accessory-warehouse-master.test.ts` | `output/playwright/accessory-warehouse/stage1/diagnostic-results.json`；`output/playwright/accessory-warehouse/stage1/gtp-filtered-export.csv`；`output/verification/accessory-warehouse-current-units.log` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC14 | F02主线最后配齐同事务唯一调拨/receipt，刷新/重复命令不重复；读取不造单。 | `tests/browser-contracts/accessory-upstream-transfer.test.ts`；`tests/unit/accessory-warehouse-master.test.ts` | `output/verification/accessory-upstream-transfer/results.json`；`output/verification/accessory-upstream-transfer/contracts.log`；`output/verification/accessory-warehouse-current-units.log` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC15 | 待定保留唯一调拨ID/无错误receipt，分配后同单补正确目的方。 | `tests/browser-contracts/accessory-upstream-transfer.test.ts`；`tests/unit/accessory-warehouse-factory-link.test.ts` | `output/verification/accessory-upstream-transfer/results.json`；`output/verification/accessory-upstream-transfer/contracts.log`；`output/verification/accessory-factory-link-unit.log` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC16 | 整单出GTP扣本单预留和实物形成在途；创建/实际出库时点分别保留，部分/待定阻断。 | `tests/browser-contracts/accessory-upstream-transfer.test.ts`；`tests/browser-contracts/accessory-transfer-ui.test.ts` | `output/verification/accessory-upstream-transfer/results.json`；`output/verification/accessory-upstream-transfer/contracts.log`；`output/playwright/accessory-warehouse/stage2-transfer-ui/results.json` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC17 | 共享实物/预留、来源版本竞争、另一单不能借用预留；失败原数据与输入保留。 | `tests/browser-contracts/accessory-warehouse-records.test.ts`；`tests/unit/accessory-warehouse-master.test.ts` | `output/verification/accessory-current-records.log`；`output/verification/accessory-warehouse-current-units.log`；`output/playwright/accessory-warehouse/stage2-transfer-ui/results.json` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC18 | 两仓实际一次收货上架、原receipt/transfer/stock/location共同回读；同位置聚合。 | `tests/browser-contracts/accessory-upstream-transfer.test.ts`；`tests/browser-contracts/accessory-transfer-ui.test.ts` | `output/verification/accessory-upstream-transfer/results.json`；`output/verification/accessory-upstream-transfer/contracts.log`；`output/playwright/accessory-warehouse/stage2-transfer-ui/results.json` | transferUI1366/1280/1024、actual-main1366；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC19 | 错误/缺位置/差量/未知源/过期receipt/停用他仓位置拒绝，无半套，改正可重试。 | `tests/browser-contracts/accessory-transfer-ui.test.ts`；`tests/unit/accessory-warehouse-master.test.ts` | `output/playwright/accessory-warehouse/stage2-transfer-ui/results.json`；`output/verification/accessory-warehouse-current-units.log` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC20 | 未发/已取消/不适用状态拒绝接收；幂等同内容重放无重复库存。 | `tests/unit/accessory-warehouse-master.test.ts`；`tests/unit/accessory-warehouse-flow.test.ts` | `output/verification/accessory-warehouse-current-units.log`；`output/verification/accessory-current-records.log`；`output/playwright/accessory-warehouse/stage2-transfer-ui/results.json` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC21 | S14末段记录U8采纳D1：整单差异阻断核对；Web/PDA真实差量不保存，无±5%规则。 | `tests/unit/accessory-warehouse-master.test.ts`；`tests/unit/accessory-warehouse-flow.test.ts` | `docs/product-design/2026-10-19-辅料仓业务调整方案.md`；`docs/test-records/2026-10-19-accessory-warehouse-acceptance-plan.md`；`docs/requirement-traceability/2026-10-19-accessory-warehouse-matrix.md` | ；post真实main390差量阻断；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC22 | 未分配/过期/部分分配不得虚构任务责任，按有效SKU分配建立当前领料范围；实际UI双任务建单。 | `tests/unit/accessory-warehouse-master.test.ts`；`tests/unit/accessory-warehouse-flow.test.ts` | `output/verification/accessory-warehouse-current-units.log`；`output/verification/accessory-warehouse-sewing/sewing-ui.json`；`output/verification/accessory-warehouse-sewing/mixed-scope.json` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC23 | 正式purpose/SKU/BOM分流、近似名称不反转；四类留车缝，拉链纽扣后道；单位和任务数量可追溯。 | `tests/unit/accessory-warehouse-master.test.ts`；`tests/unit/accessory-warehouse-flow.test.ts` | `output/verification/accessory-warehouse-current-units.log`；`output/verification/accessory-warehouse-material-assets/unit-contracts.log`；`public/materials/accessory-flow/sources.json` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC24 | 车缝+烫包40/60任务产生6类辅料领料，无后道单/receipt；含裁剪合并凭证保留原面料账，正式纸面7明细8图及二维码通过。 | `tests/unit/accessory-warehouse-master.test.ts`；`tests/unit/accessory-warehouse-flow.test.ts` | `output/verification/accessory-warehouse-current-units.log`；`output/verification/accessory-full-backup-ui/full-backup-ui.json`；`output/verification/accessory-full-backup-ui/sewing-iron-pickups.json` ；`output/verification/accessory-mixed-print-ui/fixture-fix-verification.json`；`output/verification/accessory-mixed-print-ui/source-consistency.json` | 1024x768、mixed PDA390x844；A4两页PDF已逐页检查；无物理打印机/扫码枪 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC25 | 40/60有效SKU分配不复制整单；失效/冲突/缺PPIC/任务版本/范围BOM错误拒绝；旧累计实交保留。 | `tests/unit/accessory-warehouse-master.test.ts`；`tests/unit/accessory-warehouse-flow.test.ts` | `output/verification/accessory-warehouse-current-units.log`；`output/verification/accessory-warehouse-sewing/sewing-ui.json`；`output/verification/accessory-warehouse-sewing/mixed-scope.json` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC26 | 实际分次7+5，交出事件/任务跟进共用；PPIC只读且domain拒写；应领实交差额分开。 | `tests/browser-contracts/accessory-warehouse-sewing.test.ts`；`tests/unit/accessory-warehouse-master.test.ts` | `output/verification/accessory-warehouse-sewing/sewing-ui.json`；`output/verification/accessory-warehouse-sewing/mixed-scope.json`；`output/verification/accessory-warehouse-sewing/legacy-slips-migration.json` | 1024x768；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC27 | 分次累计仅扣本次实物，另一任务不变；错仓/过版本/超量与借他单预留/重复命令均有契约。 | `tests/browser-contracts/accessory-warehouse-sewing.test.ts`；`tests/unit/accessory-warehouse-master.test.ts` | `output/verification/accessory-warehouse-sewing/sewing-ui.json`；`output/verification/accessory-warehouse-sewing/mixed-scope.json`；`output/verification/accessory-warehouse-sewing/legacy-slips-migration.json` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC28 | PPIC签发/补打V1/V2、改厂后版本单调递增；旧码与旧仓拒执行，实交不清零。已补正式纸面、图片、二维码、390局部横滚与实际PDA直达证据。 | `tests/browser-contracts/accessory-warehouse-sewing.test.ts`；`tests/unit/accessory-warehouse-master.test.ts` | `output/verification/accessory-warehouse-sewing/sewing-ui.json`；`output/verification/accessory-warehouse-sewing/mixed-scope.json`；`output/verification/accessory-warehouse-sewing/legacy-slips-migration.json` ；`output/verification/accessory-print-layout-ui/final-print-verification.json`；`output/verification/accessory-print-layout-ui/print-layout.json` | 1024x768、390x844；领料单2页PDF及二维码内容已核对；无物理硬件执行 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC29 | 实际车缝跟进页直达刷新显示同一交出事件/7与12张累计；task/assignment/warehouse identities保存。 | `tests/browser-contracts/accessory-warehouse-sewing.test.ts`；`tests/browser-contracts/accessory-warehouse-records.test.ts` | `output/verification/accessory-warehouse-sewing/sewing-ui.json`；`output/verification/accessory-warehouse-sewing/mixed-scope.json`；`output/verification/accessory-warehouse-sewing/legacy-slips-migration.json` | 1024x768；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC30 | 后道主单/receipt同源、四类排除；HILON任务创建及源仓实际整单发出有UI/预检。 新增Mahameru完整实际UI：40/60任务、四类排除、源仓整单出库、原后道Web实收上架、源仓状态及DLN40条/80粒库存直达和逐SKU守恒。 | `tests/unit/accessory-warehouse-master.test.ts`；`tests/unit/accessory-warehouse-flow.test.ts` | `output/verification/accessory-warehouse-current-units.log`；`output/verification/accessory-warehouse-sewing/sewing-ui.json`；`output/verification/accessory-warehouse-sewing/mixed-scope.json` ；`output/verification/accessory-final-boundaries-ui/2026-10-19T12-33-32-360Z/results.json` | Mahameru/postWeb1024x768；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC31 | 既有Web与PDA接收同一源transfer ID，same cutting DB事务保存transfer/receipt/stock/audit，PCS原字节未改；库存冷直达。 | `tests/browser-contracts/accessory-post-finishing.test.ts`；`tests/browser-contracts/accessory-warehouse-records.test.ts` | `output/playwright/accessory-warehouse/post-finishing/results.json`；`output/playwright/accessory-warehouse/post-finishing/final-contract-run.log`；`output/playwright/accessory-warehouse/post-finishing/freeze-manifest.json` ；`output/verification/accessory-final-post-fresh.log` | Web1024x768、PDA390x844；真实main390正常/只读/差量/abort输入保留/同command重试/刷新；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC32 | 相交旧PCS归档、Blob、stableID和原实际数量承接；不明映射阻断；原源readonly retainedOriginal，其他QC行字节未变；旧写/整包迁移拒绝。 | `tests/browser-contracts/accessory-post-finishing.test.ts`；`tests/browser-contracts/accessory-warehouse-sewing.test.ts` | `output/playwright/accessory-warehouse/post-finishing/results.json`；`output/playwright/accessory-warehouse/post-finishing/final-contract-run.log`；`output/playwright/accessory-warehouse/post-finishing/freeze-manifest.json` ；`output/verification/accessory-final-post-fresh.log` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC33 | 未出双向和改回：生产任务/来源快照、同一调拨目的方、旧receipt取消原因/新版本receipt同事务。 | `tests/browser-contracts/accessory-upstream-transfer.test.ts`；`tests/unit/accessory-warehouse-factory-link.test.ts` | `output/verification/accessory-upstream-transfer/results.json`；`output/verification/accessory-upstream-transfer/contracts.log`；`output/verification/accessory-factory-link-unit.log` | 1366x768；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC34 | 在途两方向保留原目的仓，原仓先收，再唯一仓间调拨/实际发出/新仓收，前后库存与在途时间线。 | `tests/browser-contracts/accessory-upstream-transfer.test.ts`；`tests/unit/accessory-warehouse-factory-link.test.ts` | `output/verification/accessory-upstream-transfer/results.json`；`output/verification/accessory-upstream-transfer/contracts.log`；`output/verification/accessory-factory-link-unit.log` | 1366x768；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC35 | 已入库两方向及回原仓，同业务日新身份，不改旧上架；两段库存守恒。 | `tests/browser-contracts/accessory-upstream-transfer.test.ts`；`tests/unit/accessory-warehouse-factory-link.test.ts` | `output/verification/accessory-upstream-transfer/results.json`；`output/verification/accessory-upstream-transfer/contracts.log`；`output/verification/accessory-factory-link-unit.log` | 1366x768；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC36 | 旧取消receipt/已失效版本阻断，已交三方/后道D3有纯契约；改厂后旧领料V1不可执行。 新增F10实际UI：价格吊牌真实实交7/余93，核对唯一enabled cut及current effective assignment；工作台改厂最终确认显示原整包阻断，全部实际DB各store前后相等，返回修改仍保留工厂和原因。 | `tests/browser-contracts/accessory-upstream-transfer.test.ts`；`tests/unit/accessory-warehouse-factory-link.test.ts` | `output/verification/accessory-upstream-transfer/results.json`；`output/verification/accessory-upstream-transfer/contracts.log`；`output/verification/accessory-factory-link-unit.log` ；`output/verification/accessory-final-boundaries-ui/2026-10-19T12-33-32-360Z/results.json` | F10workbench1366x768；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC37 | 打开失败不假空、超限类注入/事务abort失败不发布内存和半套，输入与实际重试可恢复。 | `tests/browser-contracts/accessory-warehouse-records.test.ts`；`tests/browser-contracts/accessory-fcs-readonly.test.ts` | `output/verification/accessory-current-records.log`；`output/playwright/accessory-warehouse/fcs-readonly/results.json`；`output/playwright/accessory-warehouse/stage1/diagnostic-results.json` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC38 | 三类范围显式迁移/归档、稳定ID、分批失败/清理失败续办、结构错误/附件缺失/旧标签来源竞争、原共享资料保留与退休写保护。 | `tests/browser-contracts/accessory-warehouse-migration.test.ts`；`tests/browser-contracts/accessory-warehouse-maintenance-ui.test.ts` | `output/verification/accessory-warehouse-migration/migration-contract.json`；`output/verification/accessory-warehouse-migration/conflict-and-attachment-restore.json`；`output/verification/accessory-warehouse-maintenance-ui/maintenance-ui.json` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC39 | 原页面/下游直达/刷新及双标签竞争通过；补充真实Web实收后关闭Chromium PID1261并确认退出，使用同私有profile新PID1329冷直达下游，10条/20粒库存与所有原始DB事实一致。 | `tests/browser-contracts/accessory-warehouse-records.test.ts`；`tests/browser-contracts/accessory-fcs-readonly.test.ts` ；`tests/browser-contracts/accessory-reopen-images-ui.test.ts` | `output/verification/accessory-current-records.log`；`output/playwright/accessory-warehouse/fcs-readonly/results.json`；`output/verification/accessory-upstream-transfer/results.json` ；`output/verification/accessory-read-images/2026-10-19T13-16-55-914Z/results.json` | 本地隔离Chromium实际进程退出重开，1366x768；无物理设备/真实后台主张 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC40 | 两页revision竞争、同内容重放/异内容拒绝，busy控件锁和导航保护、stablecommand实际重试。 | `tests/browser-contracts/accessory-warehouse-records.test.ts`；`tests/unit/accessory-warehouse-master.test.ts` | `output/verification/accessory-current-records.log`；`output/verification/accessory-warehouse-current-units.log`；`output/playwright/accessory-warehouse/stage1/diagnostic-results.json` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC41 | 逐SKU/单位守恒、共享余额、车缝分次/后道/双向改厂；保存0覆盖固定库存，不被默认种子复活。新范围无静态业务删除入口，删除标记的新增场景不适用；取消/作废保留记录。 | `tests/unit/accessory-warehouse-master.test.ts`；`tests/unit/accessory-warehouse-flow.test.ts` | `output/verification/accessory-warehouse-current-units.log`；`output/verification/accessory-upstream-transfer/results.json`；`output/verification/accessory-upstream-transfer/contracts.log` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC42 | 所有演示款图存在加载（U9允许款名错配）；六类物料正式图片来源与对象对应已核对。两仓领料6桌面组合、后道Web3组合及PDA390全部图片加载和大图Esc/关闭/遮罩；款/物料大图404→提示→重开恢复。PDA补同源款图后仍可整单实收。 | `tests/browser-contracts/accessory-warehouse-stage1-ui.test.ts`；`tests/unit/accessory-warehouse-stock-sources.test.ts` ；`tests/browser-contracts/accessory-reopen-images-ui.test.ts` | `output/playwright/accessory-warehouse/stage1/diagnostic-results.json`；`output/playwright/accessory-warehouse/stage1/gtp-filtered-export.csv`；`output/verification/accessory-warehouse-material-assets/unit-contracts.log` ；`output/verification/accessory-read-images/acceptance-gap-summary.json`；`output/verification/accessory-read-images/2026-10-19T13-17-25-427Z/results.json` | 1366x768、1280x720、1024x768；postPDA390x844；独立/合并纸面见AC43及打印专项。缩略图失败态源码与现有专项支持；本次新增404为大图。 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC43 | 筛选13行CSV完整导出（当页仅3行）；GTP配料凭证、PPIC独立与混合领料单均已实际生成PDF，核对物料图、逐行数量单位、版本、二维码与签字区；打印不改库存。 | `tests/browser-contracts/accessory-warehouse-stage1-ui.test.ts`；`tests/browser-contracts/accessory-warehouse-sewing.test.ts` | `output/playwright/accessory-warehouse/stage1/diagnostic-results.json`；`output/playwright/accessory-warehouse/stage1/gtp-filtered-export.csv`；`output/verification/accessory-warehouse-sewing/sewing-ui.json` ；`output/verification/accessory-print-layout-ui/final-print-verification.json`；`output/verification/accessory-mixed-print-ui/result.json` | 1366x768、1024x768、390x844；GTP1页6图，独立PPIC2页5图，mixed2页8图；实体打印机未测，不作为原型范围完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC44 | 本仓仓管/越仓/PPIC/domain guard与实际只读控件；post实际ROLE_VIEWER，明确仅原型身份演示，无真实鉴权承诺。 | `tests/unit/accessory-warehouse-master.test.ts`；`tests/unit/accessory-warehouse-flow.test.ts` | `output/verification/accessory-warehouse-current-units.log`；`output/playwright/accessory-warehouse/stage2-transfer-ui/results.json`；`output/verification/accessory-warehouse-sewing/sewing-ui.json` | ；post实际本厂ROLE_ADMIN与ROLE_VIEWER390；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC45 | F01 sea cutting、F02 sea cutting2、F03待定均为原生产模块固定输入，待定通过原工作台分配。反向核对无新增规则配置/伪判定器，未用KOL规则替代。 | `tests/unit/accessory-warehouse-master.test.ts`；`tests/unit/accessory-warehouse-flow.test.ts` | `output/verification/accessory-warehouse-current-units.log`；`output/verification/accessory-upstream-transfer/results.json`；`output/verification/accessory-upstream-transfer/contracts.log` | 1366x768；无独立PDA/打印动作 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC46 | 存在矩阵、调整方案、阶段进展与前期3项修复复查。；原证据覆盖审计保留项：最终完整任务diff正反追踪、全部菜单/路由/事件/Mock/测试对照、最终治理审查绑定由root完成；本映射不是新的代码review或产品接受。 |  | `output/verification/accessory-warehouse-review/targeted-fix-recheck-2026-10-19.json`；`docs/product-design/2026-10-19-辅料仓业务调整方案.md`；`docs/test-records/2026-10-19-accessory-warehouse-acceptance-plan.md` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC47 | 2actual-main契约：仅已保存已齐正常/待定2单，未齐和18默认不补；completion facts JSON不变、补建真实time/history；abort/同commandretry/重进幂等；原reservation可dispatch。 | `tests/browser-contracts/accessory-transfer-cutover-ui.test.ts`；`tests/unit/accessory-warehouse-factory-link.test.ts` | `output/playwright/accessory-warehouse/transfer-cutover/2026-10-19T12-18-18-838Z/results.json`；`output/playwright/accessory-warehouse/transfer-cutover/2026-10-19T12-18-18-838Z/before-cutover.json`；`output/playwright/accessory-warehouse/transfer-cutover/2026-10-19T12-18-18-838Z/after-cutover.json` | 1366x768；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC48 | 25域记录/13必要上游依赖/7命令经真实UI下载并在空环境恢复，值及版本/实交/后道库存等价；非空Blob另由隔离迁移契约证明，坏结构/引用/版本/冲突拒绝无损。正常新业务无上传，files=0；不主张非空附件UI流程。 | `tests/browser-contracts/accessory-full-backup-ui.test.ts`；`tests/browser-contracts/accessory-warehouse-migration.test.ts` | `output/verification/accessory-full-backup-ui/full-backup-ui.json`；`output/verification/accessory-full-backup-ui/sewing-iron-pickups.json`；`output/verification/accessory-full-backup-ui/frozen-checks.json` ；`output/verification/accessory-backup-semantic-guards.log` | 1366x768；新范围无静态删除入口；0覆盖及取消/作废版本恢复保留；恢复不代替纸面核验 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |
| AC49 | 方案明确中间阶段仅隔离演示，四阶段改派实际主链已有10条结果；各专项不声称真实生产/共享/发布。；原证据覆盖审计保留项：最终交付范围与剩余功能/设备/打印/性能由root汇总，未完成前不将本map当完整可写发布证明。 | `tests/browser-contracts/accessory-upstream-transfer.test.ts`；`tests/browser-contracts/accessory-warehouse-sewing.test.ts` | `docs/product-design/2026-10-19-辅料仓业务调整方案.md`；`docs/test-records/2026-10-19-accessory-warehouse-acceptance-plan.md`；`docs/requirement-traceability/2026-10-19-accessory-warehouse-matrix.md` | ；本用例无独立PDA完成条件；本用例无独立打印完成条件 | 已验证；实际对应性能、版本及复用范围见正式家族汇总 |

## AW到AC的反向绑定

<a id="aw-001"></a>

**AW-001**：仅纳入本生产单无需裁剪的辅料。关联 AC07,AC23；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-002"></a>

**AW-002**：不新增自动分配规则配置或判定器。关联 AC45；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-003"></a>

**AW-003**：提供裁剪工厂已确认sea cutting2的演示输入。关联 AC14,AC45；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-004"></a>

**AW-004**：提供裁剪工厂待定并后续分配的演示输入。关联 AC15,AC45；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-005"></a>

**AW-005**：HILON辅料仓身份唯一并启用。关联 AC01；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-006"></a>

**AW-006**：Mahameru辅料仓身份唯一并启用。关联 AC01；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-007"></a>

**AW-007**：GTP复用已有中央辅料仓身份。关联 AC01；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-008"></a>

**AW-008**：sea cutting档案身份映射HILON。关联 AC03；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-009"></a>

**AW-009**：sea cutting2档案身份映射Mahameru。关联 AC03；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-010"></a>

**AW-010**：未知或待定工厂不默认HILON。关联 AC03,AC15；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-011"></a>

**AW-011**：HILON库区归属及明细数量一致。关联 AC02；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-012"></a>

**AW-012**：Mahameru库区归属及明细数量一致。关联 AC02；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-013"></a>

**AW-013**：两仓库位实际可查且不串仓。关联 AC02；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-014"></a>

**AW-014**：库位启用和仓库归属参与收货校验。关联 AC19；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-015"></a>

**AW-015**：新三仓分组按指定顺序位于新中转仓之后。关联 AC04；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-016"></a>

**AW-016**：车缝配料迁到GTP唯一菜单及地址。关联 AC04,AC07；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-017"></a>

**AW-017**：面料看板移动到库存管理。关联 AC05；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-018"></a>

**AW-018**：面料看板原地址和默认入口保留。关联 AC05；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-019"></a>

**AW-019**：面料看板现有有效功能继续可用。关联 AC05；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-020"></a>

**AW-020**：保留功能可用后删除生产配料管理分组。关联 AC06；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-021"></a>

**AW-021**：五个旧生产配料路由退役且不可绕过执行。关联 AC06；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-022"></a>

**AW-022**：旧配料事件处理器和render导出移除。关联 AC06；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-023"></a>

**AW-023**：五合一旧文件及其它专用kind逻辑删除。关联 AC06；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-024"></a>

**AW-024**：FCS及其它真实消费者所需共用逻辑保留。关联 AC06；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-025"></a>

**AW-025**：历史报告和用户业务资料不因清代码删除。关联 AC06,AC38；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-026"></a>

**AW-026**：最终WLS每级节点均配置图标。关联 AC11；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-027"></a>

**AW-027**：最终WLS所有图标名均能被注册集合解析。关联 AC11；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-028"></a>

**AW-028**：全部可见WLS节点真实显示语义图标。关联 AC12；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-029"></a>

**AW-029**：图标调整后折叠展开及选中正常。关联 AC12；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-030"></a>

**AW-030**：GTP只保留配料，不直接完成两仓三方领料。关联 AC07；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-031"></a>

**AW-031**：GTP保留有效查询和本次配料登记。关联 AC07；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-032"></a>

**AW-032**：GTP保留有效备注及配料历史。关联 AC07,AC08；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-033"></a>

**AW-033**：GTP保留适用导出及配料打印。关联 AC43；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-034"></a>

**AW-034**：GTP迁移后配料事实按记录持久保存。关联 AC08；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-035"></a>

**AW-035**：固定演示数据读取不整批落盘。关联 AC09；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-036"></a>

**AW-036**：配齐逐行判断，不能跨物料抵消缺口。关联 AC13；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-037"></a>

**AW-037**：配齐自动创建唯一首次调拨。关联 AC14；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-038"></a>

**AW-038**：配齐但目的方待定时保留调拨身份。关联 AC15；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-039"></a>

**AW-039**：目的仓未定不生成错误待收且不出库。关联 AC15,AC16；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-040"></a>

**AW-040**：有效分配确定后补齐正确目的仓和预入库。关联 AC15；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-041"></a>

**AW-041**：创建调拨和实际出GTP分别留事实时点。关联 AC16；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-042"></a>

**AW-042**：GTP和普通仓间调拨均不分批。关联 AC16,AC30,AC35；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-043"></a>

**AW-043**：实际出库校验同源可用量并形成在途。关联 AC16,AC17；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-044"></a>

**AW-044**：两仓待收绑定原调拨及明细。关联 AC18；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-045"></a>

**AW-045**：收货与上架在同一次确认完成。关联 AC18；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-046"></a>

**AW-046**：收货后单据库存库位共同可读。关联 AC18,AC39；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-047"></a>

**AW-047**：未实际出库不能伪造目标仓接收。关联 AC20；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-048"></a>

**AW-048**：两仓名称使用车缝领料及后道调拨。关联 AC22,AC30；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-049"></a>

**AW-049**：未分配车缝任务不生成虚构领料责任。关联 AC22；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-050"></a>

**AW-050**：领料绑定当前有效任务及分配范围。关联 AC25,AC29；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-051"></a>

**AW-051**：仅车缝后道排除价格吊牌。关联 AC23；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-052"></a>

**AW-052**：仅车缝后道排除品牌吊牌。关联 AC23；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-053"></a>

**AW-053**：仅车缝后道排除吊粒。关联 AC23；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-054"></a>

**AW-054**：仅车缝后道排除车缝线。关联 AC23；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-055"></a>

**AW-055**：HILON和Mahameru分流/后道流程相同且不串仓。关联 AC23,AC30；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-056"></a>

**AW-056**：含烫包任务不误走仅车缝后道分流。关联 AC24；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-057"></a>

**AW-057**：更新领料清单时不重置已经实际交出的量。关联 AC25,AC27；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-058"></a>

**AW-058**：仓库确认实交，PPIC不代确认。关联 AC26,AC44；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-059"></a>

**AW-059**：应交实交差额分开并保留各自单位。关联 AC26,AC41；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-060"></a>

**AW-060**：领料与后道交出共用同一可用余额。关联 AC27,AC41；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-061"></a>

**AW-061**：旧领料版本不可执行且补打不重复计量。关联 AC28；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-062"></a>

**AW-062**：车缝任务直达能读到仓库实际领料记录。关联 AC29；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-063"></a>

**AW-063**：后道主调拨唯一关联源仓实际出库。关联 AC30；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-064"></a>

**AW-064**：后道现有Web/PDA接收同一源事实。关联 AC31；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-065"></a>

**AW-065**：旧吊牌吊粒宽泛识别不再生成新冲突结果。关联 AC23,AC32；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-066"></a>

**AW-066**：未出GTP改厂同步任务和调拨目的方。关联 AC33；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-067"></a>

**AW-067**：未出改厂取消旧预入库并记录原因。关联 AC33,AC36；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-068"></a>

**AW-068**：未出改厂在新仓形成唯一有效待收。关联 AC33；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-069"></a>

**AW-069**：在途改厂保留原仓先收货的顺序。关联 AC34；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-070"></a>

**AW-070**：原仓收后唯一生成后续仓间调拨安排。关联 AC34；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-071"></a>

**AW-071**：已入库改厂用新仓间调拨且保留原历史。关联 AC35；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-072"></a>

**AW-072**：两个改厂方向及改回原厂均使用正确身份。关联 AC35；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-073"></a>

**AW-073**：旧取消或过期接收单不得继续执行。关联 AC36；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-074"></a>

**AW-074**：必要任务与辅料结果同库同事务完成。关联 AC31,AC33,AC37；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-075"></a>

**AW-075**：打开失败不冒充空业务数据覆盖旧资料。关联 AC37；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-076"></a>

**AW-076**：保存超限或中止保留原数据及可恢复输入。关联 AC10,AC37；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-077"></a>

**AW-077**：同命令去重且异内容不可复用。关联 AC40；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-078"></a>

**AW-078**：多标签来源版本冲突被识别。关联 AC17,AC40；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-079"></a>

**AW-079**：迁移按稳定映射可中断续跑且不重不丢。关联 AC38；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-080"></a>

**AW-080**：迁移保留共用记录及必要附件引用。关联 AC32,AC38；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-081"></a>

**AW-081**：完成迁移后本范围旧写退出且不重复迁移。关联 AC38,AC39；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-082"></a>

**AW-082**：刷新重开与各下游直达读取一致。关联 AC08,AC29,AC31,AC39；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-083"></a>

**AW-083**：每款有款式图（允许演示错配），物料有对应图片。关联 AC42；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-084"></a>

**AW-084**：图片比例加载失败及大图关闭交互完整。关联 AC42；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-085"></a>

**AW-085**：受影响列表按公共骨架且指定视口无主体溢出。关联 AC04,AC07,AC18；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-086"></a>

**AW-086**：适用加载与每个新增动作完整响应不超1秒。关联 PF01～PF08及正式175家族；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-087"></a>

**AW-087**：完整需求正反向追踪且技术验证不冒充用户接受。关联 AC46；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-088"></a>

**AW-088**：普通整单实物差异处置先确定预期。关联 AC21；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-089"></a>

**AW-089**：四类排除使用可核对物料身份映射。关联 AC23；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-090"></a>

**AW-090**：已向三方或后道交出后改厂不重调原总量。关联 AC36；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-091"></a>

**AW-091**：分次领料沿用范围与整单调拨区分。关联 AC27；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-092"></a>

**AW-092**：缺失工厂演示档案与仓库编号补齐方式明确。关联 AC01,AC03；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-093"></a>

**AW-093**：同库适配不能满足时保留设计阻塞而不双写。关联 AC31,AC33,AC37；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-094"></a>

**AW-094**：已保存的阶段一配齐记录显式补建唯一调拨且不改原完成事实。关联 AC47；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-095"></a>

**AW-095**：本范围备份可完整隔离恢复且冲突不损原数据。关联 AC48；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

<a id="aw-096"></a>

**AW-096**：阶段二三未完成改派时仅隔离演示而非完整可写交付。关联 AC49；实际文件/自动化入口见原子矩阵本行，运行证据见上述AC表。状态：已验证。

## 最新补充证据（覆盖早期审计空位）

- 最终菜单：`output/playwright/accessory-warehouse/stage1/diagnostic-results.json`，14组、131项、145个实际SVG；`accessory-final-stage1-ui-2.log` 6/6。
- 打印/小屏/竞态：`output/verification/accessory-print-layout-ui/final-print-verification.json`、`gtp-print-await-guard.json`，2/2；GTP 1页6图6行，PPIC 2页、390局部滚动；实体打印机/扫码枪未测试。
- Mahameru后道及F10实际统一工作台阻断：`output/verification/accessory-final-boundaries-ui/2026-10-19T12-33-32-360Z/results.json`，2/2。
- 完整备份与含烫包：`output/verification/accessory-full-backup-ui/frozen-checks.json`，2/2加原4/4；恢复25本域+13依赖+7命令，files=0。
- 历史配齐补建：`output/playwright/accessory-warehouse/transfer-cutover/2026-10-19T12-18-18-838Z/results.json`，2/2。
- 最终主应用双向改厂全链：`output/verification/accessory-final-upstream-contracts.log`，10/10；结果目录由该轮`accessory-upstream-transfer/results.json`指定。
- 后道/PDA修复回归：`output/playwright/accessory-warehouse/post-finishing/fast-route-regression.json`，8/8；此前PDA冷入口缺必要部位票读取已修，不删失败记录。
- 工程完整构建：`output/verification/accessory-final-interactive-print-build.log`，1293单测通过；最后准确入口修复的Vite构建：`output/verification/accessory-final-canonical-print-build.log`。51个当前源文件检查0错、全域19个既有范围外错误，见`output/verification/accessory-final-51-types.log`；最终门禁仍须绑定全部冻结差异。

## 正式性能与阶段关闭

已按修复范围完成正式A、B、C并汇总为175家族、1120个验收样本，每族>=5，最大885.7000000476837ms。预检慢样本、采集错误、A五条慢样本与B一条慢样本保留原目录；只以修复后完整家族替代对应旧版本，不删失败或挑最快样本。逐项原始值、资产、脚本、来源批次及复用理由见`output/verification/accessory-performance/final-accepted-families.json`。

## 正式A时点及后续修复记录（保留历史结论）

后道最新新进程8/8通过见 `output/verification/accessory-final-post-fresh.log`。长驻开发服务的旧模块实例冲突失败保留在原日志，未当作产品通过或覆盖；以冻结源码新服务复验作为本项结论。

正式性能A保留 `output/verification/accessory-performance/formal-20261019-a/results.json`：118家族、780次有效采集，其中PPIC签发领料凭证预览5次超时（最大1798.6ms），其余117家族达标。本段为正式A时点结论；全量打印模板初始化长任务及准确入口重复读取已修复，最终补采结论另列。原有效超时不删除，不以平均值或最快样本代替最大值。

混合纸面旧夹具遗漏原工序来源，旧URL断言未发现错误页；该无有效终点的1032.4ms保留为采集无效，不能混同上述真实PPIC慢样本。修复夹具26条记录并增加正式纸面断言后，原mixed业务、正式PDF、SEW_IRON各1/1通过；详见 `output/verification/accessory-mixed-print-ui/fixture-fix-verification.json`。


## 最后功能缺口的修复与回归（正式补采前）

- FCS面辅料交出图片已接入真实main事件；overlay局部更新，Esc/关闭/焦点约束、404后重开和390宽度核验通过，查看期间业务写事务为0。证据：`output/verification/sewing-material-handover-images-ui/verification.json`。
- 旧后道转换单引用静态配料时，统一备份只补收实际缺失的准确原来源快照；不落库、不虚构配齐与出库。真实下载、空环境恢复非空Blob31字节、非空拒绝、严格缺引用拒绝通过，导出前后原记录相同。证据：`output/verification/accessory-backup-post-source/handoff.json`。
- 后道专页避免通用包装重复读取，原存储告警继续显示；8项相邻契约通过，日志：`output/verification/accessory-final-leaf-route-post.log`。
- 实际读取失败后，同路由“重新读取”原先只同步路由而不重读；已接到主体读取，新增真实main契约通过。records专项现为8/8，原审计记录不变，恢复期间写事务0。日志：`output/verification/accessory-final-records-ui-recovery.log`。
- 受管领料凭证使用已保存版本读取必要来源，普通/混合、冷直达、图片故障、打印等待与离开取消2/2通过，日志：`output/verification/accessory-final-canonical-print-ui.log`。裁片及旧来源保留原链。
- 以上只关闭功能缺口，性能仍须固定资产五次正式补采，不以预检或功能时长代替。历史慢样本和失败均保留在原目录。

主代理最终正反向核对覆盖57个运行文件/资产（含1个已删旧文件），均绑定稳定AW编号；实际清单、最后定向回查与必要支持变更说明见 `output/verification/accessory-final-bidirectional-review.json`。字面覆盖只证明映射齐全，不代替已列的功能及性能证据。


整组注册运行器在独立新服务回放19个专项文件，65/65通过（`output/verification/accessory-final-browser-registered-runner-2.log`）。其中mixed纸面按其固定dist契约运行，其余适用源入口由各自/共用fresh服务准备，不能统称全部为源码服务证据。为便于新工作树复跑，7份模拟初态固定为`tests/fixtures/accessory-warehouse/`；6份逐字节来自正式B已核验输入，cutover仅提取同一snapshot，来源及哈希见`output/verification/accessory-fixed-fixture-provenance.json`。读取初态不代表真实上游操作。收据运行器先构建再执行整组契约，不依赖旧dist；最终执行结果另以实际收据绑定。


## 最终冻结差异核验

- 验收版本AW-FINAL-20261019：运行差异`1797a085f2c7c4aadbc22c2a05713b52d79a5f30a8e07dd340bb4948c242c1fc`，固定预览index`68acccd9be1c455d060981a3f6a298a34ec57e3658d12972a8c6cc4e32ac7315`；逐文件SHA见`output/verification/accessory-final-runtime-manifest.json`。
- 功能整组65/65；收据运行器将以固定测试目录重放19个专项文件，其中mixed采用固定dist，原初态和关键断言保持。52现存源文件类型0错误；全域既有19个范围外错误仍单列。
- 正式A118家族780样本、B114家族775样本、C12家族60样本；最后C60/60通过。按完整最新实现家族汇总175项、1120验收样本，最大885.7000000476837ms。历史慢样本共6条，未删除；本轮预检另保留原结果。
- 范围完整的列表治理与产品治理已实际通过，分别见`output/verification/accessory-final-list-governance-2.log`、`output/verification/accessory-final-prototype-governance-2.log`。治理脚本53项精确路由/未知阻断契约通过：`output/verification/accessory-final-browser-routing-contract-3.log`。
- 最终技术收据位置：`output/verification/accessory-warehouse-task-receipt.json`。它绑定完整工作树差异、指令、实际命令退出码和CodeGraph同步；其状态由该文件实际结果判定。技术verified不代表用户接受、真实工厂执行或已发布。
