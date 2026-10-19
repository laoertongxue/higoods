# 辅料仓四阶段完整产品审查记录

依据 [AGENTS.md](../../AGENTS.md) 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01；本记录只记录本任务实际结果，不新增治理规则。

## 基本信息

- 日期：2026-10-19
- 任务 / 需求编号：辅料中央仓与HILON、Mahameru四阶段迁移，AW-001～AW-096，AC01～AC49
- 验证人：Codex 主代理；独立审查 phase_plan_review，仓库/图像专项 warehouse_master，导航/纸面/打印诊断 wls_icons_navigation。技术核验不代替用户产品接受。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：迁移并删除WLS生产配料管理；新增三仓业务入口、整单调拨/接收上架、按车缝任务领料及后道接收；接入原裁剪分配改厂动作；改变本范围业务事实的持久归属及旧资料迁移；补齐WLS图标和直接消费页面图片/纸面。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 需求与实现双向覆盖 | 通过 | 96条实现/49项功能、175个性能家族与58个运行文件及资产正反向绑定；完整清单见最终双向核对。工具门禁另以实际结果判定。 |
| 三仓及唯一工厂身份 | 通过 | AC01～03；stage1 diagnostic-results、master/site-cutting-factories单测；sea cutting及sea cutting2使用独立档案，不用名称近似或默认HILON。 |
| 新菜单及全部图标 | 通过 | 最终14组131项145个实际SVG；output/playwright/accessory-warehouse/stage1/diagnostic-results.json。 |
| 保留功能与旧模块完整退役 | 通过 | 旧allocation文件/五路由/事件删除，旧URL实际404；面料看板两文件字节未改，迁到库存管理，原页面无导出能力。accessory-retired-module.test.ts。 |
| 本范围存储共同成功与失败恢复 | 通过 | records 7契约；GTP/两仓/车缝/后道实际事务中止、回读、原命令重试、冲突；保存complete之后才发布状态。AC08～10、37～40。 |
| 数量、单位与库存守恒 | 通过 | source/flow/stock/task-scope单测及upstream 10；同SKU/库位/单位共用实物与预留；0覆盖保留，不跨单位相加。 |
| GTP自动建单与整单出收 | 通过 | 配齐末行同事务唯一调拨，待定先建稳定身份；创建与实际出库分开；普通仓实收差量整单阻断。AC13～21、47。 |
| 任务范围及两仓车缝领料 | 通过 | 40/60 SKU有效任务、四类排除、部分/混合责任阻断、分次实交；同一任务账读取。AC22～29、Maha边界UI。 |
| 后道Web接收及原源保护 | 通过 | 8项后道契约；同一source transfer ID进入既有页，同库原子保存，PCS原辅料只读保留，不跨库顺序双写。 |
| PDA权限与接收 | 通过 | 390真实main、viewer/非本厂阻断、差量/abort/重试/刷新；本轮补生产单款图后实际接收仍成功。 |
| 裁剪改厂全部时序 | 通过 | 实际上游工作台10契约；双向未出/在途原仓先收/已收后转/改回原仓；F10已交出后阻断且全DB不变。 |
| 旧资料显式迁移 | 通过 | 三类迁移中断续办、核对后清本范围；共用原资料和附件保留；后道保留retainedOriginal。读取本身不迁移。AC38、47。 |
| 备份与隔离恢复 | 通过 | UI25域记录+13必要依赖+7命令值等价；非空Blob独立迁移契约；坏语义备份事务前拒绝。新业务无附件上传，正常UI files=0。 |
| 真实浏览器进程关闭重开 | 通过 | accessory-read-images/2026-10-19T13-16-55-914Z/results.json：PID1261退出，PID1329同profile冷直达库存，所有DB值一致。 |
| 图片来源与对象识别 | 通过 | 六物料来源及ATTRIBUTION，U9仅豁免演示款名错配；款图全部存在加载；PDA补图。AC42、public/materials/accessory-flow/sources.json。 |
| 大图、失败与适用设备 | 通过 | 两仓领料6桌面组合、后道Web3组合/PDA390，大图关闭/Esc/遮罩及404恢复；read-images/acceptance-gap-summary.json。 |
| 打印与二维码输出 | 通过 | GTP1页6图、独立领料2页5图、mixed2页8图；实际原生按钮、PDF逐页检查、7行混合单位及扫码路由。print-layout-ui、mixed-print-ui证据。 |
| 打印依赖拆分相邻影响 | 通过 | 1293单测、PPIC模板4项、原打印脚本和真实普通/混合纸面；纯builder拆分前后已核对，renderer随后按本轮图片需求增加交互属性，不能声称最终整份renderer字节相同；旧来源动态回原链。 |
| 适用加载与动作性能 | 通过 | 正式A/B/C按修复范围汇总175家族、1120个有效验收样本，各族至少5次，最大885.7000000476837ms；原A预览、B别厂PDA及预检慢样本完整保留，不择快、不取平均。 |
| 物理工厂/扫码枪/打印机 | 不适用 | 本任务为免登录单浏览器原型；二维码路由、电子PDF及浏览器布局已验，不主张物理设备或现场执行。 |
| 发布 | 不适用 | 当前任务未要求提交、推送或部署；本地技术交付与发布状态分开。 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `public/materials/accessory-flow/ATTRIBUTION.md`
- `public/materials/accessory-flow/brand-tag.jpg`
- `public/materials/accessory-flow/price-tag.jpg`
- `public/materials/accessory-flow/sources.json`
- `public/materials/accessory-flow/tag-fastener.png`
- `src/data/app-shell-config.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/factory-mock-data.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/production-context-actions.ts`
- `src/data/fcs/production-demands.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/sewing-material-handover.ts`
- `src/data/fcs/sewing-pickup-slips.ts`
- `src/data/pcs-production-demand-tech-pack-seeds.ts`
- `src/data/wls/accessory-warehouse-commands.ts`
- `src/data/wls/accessory-warehouse-demo.ts`
- `src/data/wls/accessory-warehouse-factory-link.ts`
- `src/data/wls/accessory-warehouse-flow.ts`
- `src/data/wls/accessory-warehouse-master.ts`
- `src/data/wls/accessory-warehouse-migration.ts`
- `src/data/wls/accessory-warehouse-post-finishing.ts`
- `src/data/wls/accessory-warehouse-records.ts`
- `src/data/wls/accessory-warehouse-sewing.ts`
- `src/data/wls/accessory-warehouse-sources.ts`
- `src/data/wls/accessory-warehouse-stock-sources.ts`
- `src/data/wls/accessory-warehouse-stock.ts`
- `src/data/wls/accessory-warehouse-task-scope.ts`
- `src/data/wls/accessory-warehouse-transfer-cutover.ts`
- `src/data/wls/accessory-warehouse-upstream-fixtures.ts`
- `src/main-handlers/wls-page-handlers.ts`
- `src/main.ts`
- `src/pages/fcs/material-prep/accessory-preparation-readonly.ts`
- `src/pages/fcs/material-prep/sewing.ts`
- `src/pages/pda-accessory-post-access.ts`
- `src/pages/pda-handover.ts`
- `src/pages/print/print-preview.ts`
- `src/pages/print/templates/material-slip-layout.ts`
- `src/pages/print/templates/material-slip-template.ts`
- `src/pages/print/templates/ppic-pickup-slip-template.ts`
- `src/pages/process-factory/post-finishing/material-transfers.ts`
- `src/pages/sewing-outsourcing/material-handover.ts`
- `src/pages/sewing-outsourcing/tasks.ts`
- `src/pages/unified-dispatch-workbench.ts`
- `src/pages/wls/accessory-warehouses/gtp-preparation.ts`
- `src/pages/wls/accessory-warehouses/locations.ts`
- `src/pages/wls/accessory-warehouses/pickups.ts`
- `src/pages/wls/accessory-warehouses/shared.ts`
- `src/pages/wls/accessory-warehouses/transfers.ts`
- `src/pages/wls/finished/basic-warehouse.ts`
- `src/pages/wls/finished/basic-zone-location.ts`
- `src/pages/wls/production-prep/allocation.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-accessory-warehouses.ts`
- `src/router/routes-wls.ts`
- `src/router/routes.ts`

### 页面证据

- 版本：分支 `codex/accessory-warehouse-flow-20261019`；基线/当前HEAD `4a0ce9ef5a30e8dec4537de1ff59159543902a25`；工作树 `/Users/laoer/.codex/worktrees/ca23/higoods`；未提交运行差异摘要 `1797a085f2c7c4aadbc22c2a05713b52d79a5f30a8e07dd340bb4948c242c1fc`，逐文件基线与当前SHA见 `output/verification/accessory-final-runtime-manifest.json`。新生产构建index SHA `68acccd9be1c455d060981a3f6a298a34ec57e3658d12972a8c6cc4e32ac7315`，服务 `http://127.0.0.1:43250`。源码诊断服务各记录保留当时端口/哈希；未变直接依赖的功能证据按EVIDENCE-01复用，未改标为新运行。
- 证据：完整逐项入口、动作、设备和原始位置见 `docs/test-records/2026-10-19-accessory-warehouse-acceptance-results.md`；1366×768、1280×720、1024×768及PDA390×844；正常/边界、来源去向、单位、持久回读与图片/打印分别有直接证据。最终实际主应用上游10项，Maha/F10两项，后道8项，阶段一6项，打印2项及mixed1项；各自原日志保留，不把历史有失败的聚合日志冒称全通过。

### 性能结论

- 结论：通过
- 依据：`output/verification/accessory-performance/final-accepted-families.json`逐家族列出原始值、最大值、脚本和资产版本。175家族、1120个验收样本，最大885.7000000476837ms，阈值<=1000ms。A/B/C原始报告共1615样本，保留旧失败；按实现变化选完整最新家族，不选最小值。C固定新资产60/60通过，重复所有直接受影响后道PDA及相邻分支；A/B未改变的分支依EVIDENCE-01复用，原因逐项记于汇总。浏览器冷启动与其它新context初访分开命名；仓储1024、管理1366、PDA390，Asia/Jakarta。

### 验证命令

- `npm run build`：通过
- `node scripts/check-typescript-scope.mjs <本任务52个当前源文件>`：通过
- `git diff --check`：通过

完整构建日志 `output/verification/accessory-final-interactive-print-build.log`：工程类型门禁、1293单测及Vite构建通过；源码52范围0错误，全量既有19个范围外类型错误仍保留。命名browser契约的实际命令/退出值见各结果记录。最后准确入口与工厂阻断的Vite构建见`output/verification/accessory-final-pda-access-ready-build.log`，功能19文件65/65见`output/verification/accessory-final-browser-registered-runner-2.log`。最终列表/产品治理与技术收据在文档冻结后统一执行，其结果单独绑定，不以本产品审查记录冒充工具通过。

### 例外

- U9：演示款图允许与款名错配，必须每款有图且可加载；物料图对应性、加载/大图/失败态未豁免。
- 仓库/工厂新增编号是独立本地演示档案，不冒充现场核定编码；自动选厂规则配置明确不做，固定已确认sea cutting2与待定输入沿原分配办理。
- 正常新业务无上传附件，UI完整备份files=0；非空Blob按既有迁移/存储恢复契约验收，未新增附件维护平台。新范围无静态业务删除入口；0覆盖、取消接收和作废版本均保存，不清用户资料。


### 最后定向回查

`phase_plan_review`在同一轮审查中只读回查读取恢复、后道准确叶入口、受管凭证已保存版本入口，未发现阻断项。必要部位票/来源读取、storageNotice、真实version/sourceType及原权限不被绕过。记录见`output/verification/accessory-final-bidirectional-review.json`。这是修复回查，不冒称第二轮完整对抗审查。

本轮技术收据原路由未登记新增浏览器契约，不能仅靠构建标记verified。补充精确文件及共用夹具的运行器映射，由临时fresh源码服务逐文件顺序执行；未知测试仍为阻断。工具修改只服务本任务契约运行，不改变产品行为。

PDA最后工厂阻断只搬出原判断和原模板；先完成必要部位票，再读取原runtime，不绕过登录/本厂/仓管职责。定向审查未发现阻断项。测试初态固定为7份受版本控制的模拟资料；收据映射19个精确浏览器文件及其夹具，先构建再顺序执行，未知测试仍阻断。


最终范围治理已实际通过：列表14个变化页、产品审查全部53个TS路径（含1删除），日志`output/verification/accessory-final-list-governance-2.log`与`output/verification/accessory-final-prototype-governance-2.log`。52现存源文件0类型错误，日志`output/verification/accessory-final-52-types.log`。当前运行差异和资产以本记录版本栏为准；完整技术收据另读取实际结果。
