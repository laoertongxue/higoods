# 工艺路线、加工任务与上下游交接续作审查记录

> 当前七单续验尚未通过：完整新单0张；后续实质修复使受影响的历史页面证据失效。下文前轮通过项仅保留为历史，当前范围、失败与新源专项见末尾续作记录。未取得真实PDA、完整图片及产品接受回执。

## 1. 基本信息

| 项目 | 内容 |
|---|---|
| 记录日期 | 2026-09-07 |
| 相关需求 / 任务 | 生产工艺路线与全阶段加工单增量迭代调整方案；GOV、ROUTE、EXEC、PREP、PROD、POST、CLEAN、TEST 共 101 条原子需求 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS、FCS、PFOS、WLS |
| 涉及页面路径 | 技术包版本工艺路线；准备/生产加工单详情；后道 Web、PDA、打印 |
| 端类型 | 管理端、主管端、员工执行端 |
| 主要角色与任务 | 跟单确认路线；工厂识别加工单与批次；后道登记、QC、处理、复核和成衣仓接收 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：路线对象与连线、加工单上下游追溯、后道 QC 分流和旧数据消费者发生变化；保持现有页面与专项单据承载体。
- 设计基线：AGENTS.md 第 4 节、第 5 节、第 7 节。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
|---|---|---|
| 角色、任务与页面模式 | 有条件通过 | 后道专用角色回归通过；逐工艺 PDA 验收进行中 |
| 文案、状态、数量与单位 | 有条件通过 | 专项数量契约通过；打印回归已分次通过，补料印花分批承接专项通过 |
| 扫码、真实图片与对象识别 | 有条件通过 | 后道与辅助工艺代表图像已执行；印花已纠正对象与图片来源，缺少准确图的记录明确阻塞，旧预览可打开不等于图片对应正确 |
| 防错、危险确认与主管兜底 | 有条件通过 | 路线未连接确认阻断、后道数量差异授权已验证 |
| 交接、跨端事实与异常追溯 | 有条件通过 | 正式来源与空项目 QC 缺口已修复并有专项；历史只读快照已验证，不猜测映射为当前任务 |
| 低分辨率、PDA、弱网与上传恢复 | 有条件通过 | 后道 Web/PDA 多分辨率已跑；逐工艺图像失败恢复继续验证 |
| 命名路由、交互、图片大图与打印 | 有条件通过 | 浏览器证据见续作日志，未宣称全部通过 |

## 4. 问题标签

- 追溯不足
- 协作断裂
- 点错风险

## 5. 主要问题与处理

详见 `docs/product-design/生产工艺路线与全阶段加工单续作交付证据.md` 的问题及补料承接登记；未闭环项保留状态，不以构建替代业务验收。

## 6. 最终结论

结论：有条件通过。当前为实施与验收进行中，尚不能宣称总体完整交付。没有 GitHub 发布或产品接受回执。

## 7. 受管文件与验证证据

- 当前分支：`codex/process-work-order-current-state-audit`
- 基线 HEAD：`77cd316a6bbf24dc3b45b0134d3ae7f06a0696c8`
- 证据：`output/verification/process-route-continuation/`；执行期完整日志：`/tmp/higoods-route-continuation/`。
- 最后实质修改后重新生成相关契约、浏览器证据与任务收据；尚未结束的检查不记通过。

### 受管文件

- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/generated-fei-tickets.ts`
- `src/data/fcs/cutting/transfer-bag-operations.ts`
- `src/data/fcs/dyeing-material-receipts.ts`
- `src/data/fcs/preparation-material-receipt-sources.ts`
- `src/data/fcs/printing-material-receipts.ts`
- `src/data/fcs/water-soluble-material-receipts.ts`
- `src/data/fcs/wool-domain/cutting-receipts.ts`
- `src/data/fcs/wool-task-domain.ts`
- `src/pages/process-factory/cutting/wait-handover-actions.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/process-factory/dyeing/water-soluble-orders.ts`
- `src/pages/process-factory/wool/handover-print.ts`

- `src/data/fcs/supplement-print-prerequisite.ts`

- `src/router/routes-fcs.ts`

- `src/data/fcs/retired-process-history.ts`
- `src/pages/retired-process-history.ts`
- `src/router/route-renderers-fcs.ts`

- `src/data/fcs/binding-process-pda-scan.ts`
- `src/data/fcs/cutting/cut-piece-orders.ts`
- `src/data/fcs/cutting/runtime-inputs.ts`
- `src/data/fcs/cutting/sewing-dispatch.ts`
- `src/data/fcs/cutting/storage/special-processes-storage.ts`
- `src/data/fcs/dye-work-order-online-domain.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/factory-mobile-todos.ts`
- `src/data/fcs/factory-mobile-warehouse.ts`
- `src/data/fcs/factory-onboarding-store.ts`
- `src/data/fcs/mobile-execution-task-index.ts`
- `src/data/fcs/page-adapters/long-tail-pages-adapter.ts`
- `src/data/fcs/page-adapters/process-prep-pages-adapter.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/pda-start-link.ts`
- `src/data/fcs/pda-task-mock-factory.ts`
- `src/data/fcs/platform-process-result-view.ts`
- `src/data/fcs/post-finishing-current-read-model.ts`
- `src/data/fcs/post-finishing-domain.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/post-finishing-outbound-orders.ts`
- `src/data/fcs/post-finishing-return-source-adapter.ts`
- `src/data/fcs/post-finishing-return-source-fact-bridge.ts`
- `src/data/fcs/post-process-route.ts`
- `src/data/fcs/pre-settlement-ledger-repository.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/printing-work-order-business.ts`
- `src/data/fcs/process-action-writeback-service.ts`
- `src/data/fcs/process-craft-dict.ts`
- `src/data/fcs/process-execution-writeback.ts`
- `src/data/fcs/process-mobile-task-binding.ts`
- `src/data/fcs/process-order-task-links.ts`
- `src/data/fcs/process-platform-status-adapter.ts`
- `src/data/fcs/process-quantity-labels.ts`
- `src/data/fcs/process-statistics-domain.ts`
- `src/data/fcs/process-tasks.ts`
- `src/data/fcs/process-warehouse-domain.ts`
- `src/data/fcs/process-warehouse-linkage-service.ts`
- `src/data/fcs/process-web-status-actions.ts`
- `src/data/fcs/process-work-order-domain.ts`
- `src/data/fcs/process-work-order-generation-key.ts`
- `src/data/fcs/production-artifact-generation.ts`
- `src/data/fcs/production-object-overview.ts`
- `src/data/fcs/production-order-tech-pack-runtime.ts`
- `src/data/fcs/production-process-snapshot-derivation.ts`
- `src/data/fcs/production-process-work-order-service.ts`
- `src/data/fcs/production-tech-pack-change-domain.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `src/data/fcs/quality-deduction-analysis.ts`
- `src/data/fcs/quality-deduction-shared-facts.ts`
- `src/data/fcs/return-inbound-quality-chain-facts.ts`
- `src/data/fcs/return-inbound-workflow.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/runtime-task-read-bridge.ts`
- `src/data/fcs/special-craft-dedicated-factories.ts`
- `src/data/fcs/special-craft-operations.ts`
- `src/data/fcs/special-craft-source-task-registry.ts`
- `src/data/fcs/special-craft-task-generation.ts`
- `src/data/fcs/special-craft-task-orders.ts`
- `src/data/fcs/store-domain-quality-seeds.ts`
- `src/data/fcs/store-domain-quality-types.ts`
- `src/data/fcs/store-domain-statement-source-adapter.ts`
- `src/data/fcs/task-print-cards.ts`
- `src/data/fcs/tech-packs.ts`
- `src/data/fcs/water-soluble-task-domain.ts`
- `src/data/fcs/wool-domain/store.ts`
- `src/data/pcs-sample-cost-review-pricing.ts`
- `src/data/pcs-tech-pack-review-diff.ts`
- `src/data/pcs-tech-pack-review.ts`
- `src/data/pcs-technical-data-fcs-adapter.ts`
- `src/data/pcs-technical-data-version-bootstrap.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/data/tech-pack-process-route.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/pages/dye-print-orders.ts`
- `src/pages/fcs-production-tech-pack-snapshot.ts`
- `src/pages/garment-spu-replacements.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-exec.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/pda-handover.ts`
- `src/pages/pda-kol-goto-exec.ts`
- `src/pages/pda-post-finishing-flow.ts`
- `src/pages/pda-sewing-self-return.ts`
- `src/pages/pda-task-receive.ts`
- `src/pages/pda-warehouse-inbound-records.ts`
- `src/pages/pda-warehouse-outbound-records.ts`
- `src/pages/pda-warehouse-wait-handover.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/print/templates/post-finishing-outbound-template.ts`
- `src/pages/print/templates/post-finishing-qc-print-template.ts`
- `src/pages/print/templates/post-finishing-route-card-template.ts`
- `src/pages/print/templates/printing-work-order-template.ts`
- `src/pages/print/templates/task-delivery-card-template.ts`
- `src/pages/process-dye-orders.ts`
- `src/pages/process-factory/accessory/lace/work-order-detail.ts`
- `src/pages/process-factory/cutting/binding-strip-order-types.ts`
- `src/pages/process-factory/cutting/binding-strip-orders.ts`
- `src/pages/process-factory/cutting/cut-orders-model.ts`
- `src/pages/process-factory/cutting/cut-orders.ts`
- `src/pages/process-factory/cutting/cutting-summary-checks.ts`
- `src/pages/process-factory/cutting/cutting-summary.ts`
- `src/pages/process-factory/cutting/fei-tickets.ts`
- `src/pages/process-factory/cutting/marker-plan-projection.ts`
- `src/pages/process-factory/cutting/runtime-projections.ts`
- `src/pages/process-factory/cutting/special-processes-domain.ts`
- `src/pages/process-factory/cutting/special-processes-model.ts`
- `src/pages/process-factory/cutting/special-processes-projection.ts`
- `src/pages/process-factory/cutting/special-processes.ts`
- `src/pages/process-factory/cutting/summary-model.ts`
- `src/pages/process-factory/dyeing/dye-orders.ts`
- `src/pages/process-factory/dyeing/shared.ts`
- `src/pages/process-factory/dyeing/work-order-detail.ts`
- `src/pages/process-factory/dyeing/work-order-overlays.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/post-finishing/audit-records.ts`
- `src/pages/process-factory/post-finishing/events.ts`
- `src/pages/process-factory/post-finishing/full-flow-print.ts`
- `src/pages/process-factory/post-finishing/outbound-orders.ts`
- `src/pages/process-factory/post-finishing/qc-orders.ts`
- `src/pages/process-factory/post-finishing/qc-workbench.ts`
- `src/pages/process-factory/post-finishing/recheck-orders.ts`
- `src/pages/process-factory/post-finishing/statistics.ts`
- `src/pages/process-factory/post-finishing/tasks.ts`
- `src/pages/process-factory/post-finishing/warehouse.ts`
- `src/pages/process-factory/post-finishing/work-order-detail.ts`
- `src/pages/process-factory/post-finishing/work-orders.ts`
- `src/pages/process-factory/printing/dashboards.ts`
- `src/pages/process-factory/printing/dialogs.ts`
- `src/pages/process-factory/printing/events.ts`
- `src/pages/process-factory/printing/pending-review.ts`
- `src/pages/process-factory/printing/shared.ts`
- `src/pages/process-factory/printing/statistics.ts`
- `src/pages/process-factory/printing/work-order-detail.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/pages/process-factory/special-craft/task-detail.ts`
- `src/pages/process-factory/special-craft/warehouse.ts`
- `src/pages/process-factory/wool/work-order-detail.ts`
- `src/pages/process-order-task-relations.ts`
- `src/pages/process-print-orders.ts`
- `src/pages/process-water-soluble-orders.ts`
- `src/pages/production-craft-dict.ts`
- `src/pages/production/context.ts`
- `src/pages/production/detail-domain.ts`
- `src/pages/production/events.ts`
- `src/pages/progress-board/task-domain.ts`
- `src/pages/qc-records/actions.ts`
- `src/pages/qc-records/fact-view.ts`
- `src/pages/tech-pack/bom-domain.ts`
- `src/pages/tech-pack/bom-process-linkage.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/core.ts`
- `src/pages/tech-pack/events.ts`
- `src/pages/tech-pack/process-domain.ts`
- `src/pages/tech-pack/process-route-logicflow.ts`
- `src/pages/workbench.ts`

### 页面路由

- `/pcs/products/styles/style_seed_project_018/technical-data/tdv_seed_project_018_review_skip_demo`
- `/fcs/craft/post-finishing/work-orders`
- `/fcs/craft/post-finishing/qc-workbench`
- `/fcs/pda/post-finishing/return-confirm`
- `/fcs/pda/warehouse/wait-process`
- `/fcs/print/preview`

### 验证命令

- `node --import tsx scripts/check-tech-pack-process-route.ts`：通过
- `node --import tsx scripts/check-post-finishing-current-read-model.ts`：通过
- `node --import tsx scripts/check-post-finishing-full-flow.ts`：通过
- `npm run typecheck:engineering`：通过，范围外保留 10 项既有类型错误
- `npx playwright test tests/post-finishing-full-flow.spec.ts tests/post-finishing-pda-role-boundary.spec.ts tests/print-service-post-route-card.spec.ts`：失败，第二轮 27/28，剩余打印旧文案已修正待重跑
- `npx playwright test tests/aux-special-accessory-per-craft-full-flow.spec.ts`：失败，已修复身份字段与详情展开测试，单浏览器负载重跑进行中

### 真实图片验证

- 前轮执行过图片预览和打印；本轮发现部分印花图与实际来源不符，已撤去冒用图片并记录缺失。不得沿用前轮预览通过结论证明准确性。
- 原型图片读取当前对象资源，未新增网络占位图。

### 例外

- 逐单验收和最终矩阵追踪未结束，不作总体完成声明。

## 续作最终验证补充（历史兼容补齐中）

主代理已经实际验证：工艺路线拖拽确认与刷新保存（1366/1024）；20类辅助/特种/捆条/花边代表页面及图片；后道/PDA/打印30项场景（最终批跑29通过、1导航竞态，修正页面就绪等待后1/1复跑通过）；旧出货只读页与多批次状态2/2；后道追溯专项；物料替换正式命令及新派生加工单回归。

最新构建 `build-latest.log` 退出0；保留大块资源告警，未做额外拆包。上述是当前原型验证，不是生产业务已发生或GitHub交付。

完整证据与未闭环项统一保存在 `docs/product-design/生产工艺路线与全阶段加工单续作交付证据.md` 和 `output/verification/process-route-continuation/`。旧裁片/旧染印历史只读兼容、多分支图及最终收据仍待本轮收口；不能提前写完整接受。

### 历史兼容与路线图最终补充

历史只读页面3条命名入口已在1280×720打开，原铺布/回货明细可读且无横向溢出；完整15条数据逐字段等于基线快照，旧ID/单号查询及当前事实隔离专项通过。原图和旧染印单位未存在于源档案，明确显示缺失，作为历史素材例外保留，不能将这些档案宣称图片验收完成。

路线图4 BOM/9节点/8边在1366×768、1024×768适配后全图可见，无重叠；中文分支编号让同名工序可辨识。治理全量检查已通过。最终结论仍为有条件通过：技术结果以最后收据为准，101条矩阵未闭环业务/现场与历史素材仍保持待验，不声明完整产品接受。

### 补料印花分批承接

`src/data/fcs/supplement-print-prerequisite.ts` 按真实交出数量判断承接，不依赖人工完单或全部计划齐套；无交出、单位不一致、数量差异保持阻断。对应原方案分批交接要求；`supplement-final.log` 为当前专项证据。

### 水溶列表与素材边界

列表和详情按生产单、技术包版本、BOM ID/物料编码查图，同块显示对象标识。PO081/087/088现有通用白T、宽幅布样和文字SVG与对象不符，明确显示缺图。缺失SPU-TSHIRT-081款式原图、MAT-WATER-ONLY-081的12毫米花边原图；在补齐前图片硬门禁不通过，不能将本页完整交付。最终浏览器记录见`water-images-browser.log`。

印染入口和合并染色最终浏览器5/5通过（`preparation-entry-rerun.log`）；印花下游全接收后人工完单场景1/1通过（`printing-manual-final.log`）。

水溶详情及列设置Esc关闭：`src/main.ts` 对已经局部关闭的水溶页面跳过整页render，保留列表节点和滚动位置；其余页面沿用现有关闭行为。最终验证以修复后`water-images-browser.log`和任务收据为准。

水溶局部更新最终专项：`water-input-final.log` 1/1，筛选22.1ms；`water-escape-final.log` 1/1。1366/1280列表无溢出、列偏好/分页与缺图说明见`water-images-browser.log`。准确原图缺失仍是图片验收阻塞。

## 整体验收追加变更（本轮）

原子 EXEC-008～012、PREP-001～003、PROD-003、POST-020/024、CLEAN-008：准备工序按原交出记录累计实际接收；印花三来源完整进入原页面并保留历史进度，缺失历史数量通过明确补录而不伪造条码；部位毛织实际入裁床后与布料同袋交出，并按真实任务分配自动接收；后道订正先校验全SKU和当前主管，取消不改事实；统计按实际单据与唯一来源回算；旧后道schema一次迁移。

主要风险均按对应专项和当前入口验证。真实水溶、部分印花、毛织部位与历史准确图片仍缺素材；真实PDA 19项另列，不能用桌面小屏替代。原型模块内状态不构成真实后端业务持久化。

### 冻结版本后道最终结果

`post-all-stable.log` 30/30、`post-15-stable.log` 15条回货至待交出责任链全部通过，均在当前工作树43178真实执行。后者最终成衣仓接收数为0，是有意保留独立收货责任；成衣仓实际确认入口另验，不把出货单生成当实收完成。新增统计与主管订正浏览器2/2通过；相关原子专项保留失败→修复证据。

## 本轮最终边界与证据（优先于上方历史过程）

后道外部成衣仓遵循原方案§7.13数据边界，不新增WLS或后道PDA收货页面。POST-014/021已补仓库角色/非空身份校验；43180实际浏览器加载原边界：QC拒绝且全账不变、错单拒绝、仓库实收100件、重复不增量，重开原出货详情一致。见higoods-post-warehouse-acceptance.md。15条责任链没有收货，因此保持15链与独立实收证据分别说明。

准备原HO跨PDA/PFOS两次接收、水溶正常分批、染色三来源，印花完整5场及最后历史补录/条码0005→0006/CSV12条回归，毛织实际装袋入库交出403片均已完成。最新完整tsc为0错误，早期类型错误和失败批跑仅保留历史；CodeGraph最新。完整反向文件表final-reverse-acceptance.json逐文件回到原子需求。

真实PDA19项、准确图片与历史单位、历史阶段独立提交仍不能用本地测试关闭；最终总体结论为未完整验收。技术检查以最终task-receipt.json为准，产品确认人和确认版本尚待正式接受，未发布GitHub。

最终整包首次毛织分页用例初始化失败，独立原样复现4.1秒通过；测试在首次异步路由尚未就绪时替换夹具并触发popstate，现增加真实PDA根节点就绪等待，保留全部五类事实/分页/草稿/局部更新断言。失败收据与复现日志保留，最终重新执行整包，不以单次复跑代替全套结果。

## 七张新需求重放（本轮新增，尚未完整通过）

E2E-001～016、GOV-004、PREP-012：新增订单动态读取冻结BOM，显式初始原料输入沿用原配料记录扣量；首次任务生成不依赖其自身加工后的库存。原物料检查仍显示缺口，配料、领料及下游HO门禁继续独立。生产单详情新增管理角色人工完成并二次确认，取消不改事实。

涉及 `src/data/fcs/production-orders.ts`、`src/pages/production/context.ts`、`src/pages/production/events.ts`、`src/pages/production/detail-domain.ts`、`src/pages/production/orders-domain.ts`、`src/data/fcs/cutting/production-material-prep.ts`、`src/data/fcs/cutting/cutting-runtime-event-ledger.ts`、`src/data/fcs/production-process-snapshot-derivation.ts`。修正3%损耗计算、米与Yard原单位保真、既有配料通知事件重读；不新增采购/库存事件账。

当前仅专项已执行，命名页面重放进行中；不得引用之前收据替代本轮结果。管理1366×768、1280×720、员工1024×768、PDA浏览器390小屏，设备实机仍未替代。新输入图片未经对应验证，准确图片门禁不通过。初始商品/工程/技术资料与原料只为原型输入，后续需求转单、加工和交收必须逐步操作到终点。

新需求首次转单后还复现 `garment-spu-replacement` 旧演示初始化因目标SKU停用而抛错。根因：`src/data/pcs-sku-archive-repository.ts` 以当前款式排序生成旧SKU启停状态，新增款式使旧身份变化。现在仅初始演示索引固定为原始款式顺序，实际SKU记录不被重新设状态；新增款式使用稳定初始值。`check-new-style-sku-seed-stability.ts` 按原SKU主ID验证启停与条码不因插入款式改变，原成衣替换核心检查通过。仍须最终浏览器重放证明详情可打开。

### 七单实操追加修复

需求E2E-003/004/005/012/013：五类配料页与shared.ts、production-material-prep.ts按表单实际数量、姓名、日期和备注保存，多明细原子校验；拣货/暂存/确认记录实际输入人员、取消不写。详情补同一任务生成预览，物料摘要不再声称染印已回仓。`scripts/check-material-prep-form-save.ts`实际工作区专项通过；原43183现场暴露失败并已归档，修改后页面尚待重放。未宣称全部verified。新输入图片缺失仍不通过；裁片接收后PDA执行衔接另行收口。

### 七单继续实操：新裁片来源、接收数量及回货附件

需求 E2E-004/005/006/008/010/012/013/014：本轮只沿七张新需求及相邻防错收口。受管文件包括 `src/data/fcs/cutting/order-progress.ts`、`src/data/fcs/cutting/runtime-inputs.ts`、`src/data/fcs/cutting/generated-cut-orders.ts`、`src/data/fcs/cutting/cutting-task-routing.ts`、`src/data/fcs/cutting/pda-cutting-task-source.ts`、`src/data/fcs/pda-cutting-execution-source.ts`、`src/pages/pda-cutting-task-detail.ts`、`src/pages/process-factory/cutting/marker-plan.ts`、`src/data/fcs/cutting/material-ledger.ts`、`src/data/fcs/cutting/spreading-material-readiness.ts`、`src/pages/process-factory/cutting/cut-orders-model.ts`、`src/runtime/fcs/cutting/pickup-management-runtime.ts`、`src/pages/pda-sewing-self-return.ts`、五类 `src/pages/material-prep/` 页面、`src/data/fcs/cutting/production-material-prep.ts` 与 `src/data/fcs/production-orders.ts`。

- 新正式订单动态进入裁片/唛架来源；按精确 BOM 与 occurrence 绑定根任务，读取有效执行子任务承接方。冲突不选首项，合并裁剪车缝烫包不产生独立裁剪 PDA 来源。
- 同一需求 SKU 在同一物料/纸样多个部位映射中仅计一次成衣需求，部位明细仍保留。冷加载新增订单不会合成演示配料、接收、铺布或完成。
- 唛架与铺布余额改读当前原配料/原接收，原单位保留。已保存旧记录仅在原 pickup、prepLine、allocation 数量单位完全可证时读回原量，不改原账、不补库存。
- 关闭的未确认配料记录不得继续拣货、暂存或确认；已确认记录仍按原流程接收。新增/继续配料按钮按关闭状态约束。
- 回货上传保持文件输入和数量/姓名 DOM，局部更新附件预览，避免 input 重绘清空 File。390×844 实际新单已上传并登记三笔 3/3/4 件回货；独立验证也检查四处 DOM 身份保持。

当前现场：服务43186同工作树，管理1366×768、PDA浏览器390×844。新单源与派单已在唛架页重放；后续数量/余额修复和单位异常仍待最后版本再重放。毛织三笔回货已点数和送检，QC责任错误已发现并停止提交，待业务策略确认；两张KOL任务/生产单人工完成及仓库写回已重开核对。各版本日志以 `output/verification/seven-demand-acceptance/` 为准，未把旧证据当最后改动后通过。

图片：新款式/新原料缺准确原图，旧通用样图/SVG不能代表真实对象；原型操作截图仅用于附件功能验证，不替代素材门禁。真实PDA、准确图片、大图/打印整体验收仍未闭合。本段不是总体交付回执，尚不宣称 verified/delivered/accepted。

我方裁床入口补充：`src/data/fcs/factory-mock-data.ts` 新增独立原型裁床厂（仅裁片能力），`src/data/fcs/store-domain-pda.ts` 复用原生成器建立账号角色，`cutting-task-routing.ts` 识别其我方执行身份；不开放F090进入业务候选，历史测试厂路径不改。E2E-004/005，`scripts/check-own-cutting-dispatch-source.ts`专项通过，43189页面重放中。`cutting-runtime-event-ledger.ts`同步保留“套”单位；接收全部行预检后才写流水，避免重试分支出现前行成功后行失败。

### 七单继续验收：唛架、铺布和任务明细（2026-09-07 18:25）

新增直接受管文件：`src/data/fcs/task-detail-rows.ts`、`src/pages/production/context.ts`、`src/pages/production/detail-domain.ts`、`src/data/fcs/cutting/spreading-differences.ts`、`src/pages/process-factory/cutting/marker-spreading-projection.ts`、`src/pages/process-factory/cutting/marker-spreading-model.ts`、`src/pages/process-factory/cutting/marker-spreading.ts`。另调整 `scripts/check-wool-fact-workflow.ts` 的同名部位夹具，按 artifact 明确绑定选择正式纸样，原身份和数量断言保留。

这是用户可见数量/归属修复：PO104 面料明细去除重复纸样来源，由24.72件修正为12.36米，任务10件保持；混合单位分组汇总；辅耗BOM不参与主对象交集。唛架普通/对折普通每层3+2按两层得到6+4，不把总需求再乘层数，XL不被乘号解析改为L。铺布消耗采用原卷公式每层长度×层数+布头+布尾，本例7.12米，12.36米原卷余5.24米；铺布理论产出不写成实际裁剪。新铺布详情不再将7条3月旧演示差异和别床实际事件挂到当前单。

自动化：实际归档数量/BOM范围、CASE01印花水溶染色裁剪来源、混合单位、同名毛织部位、唛架每层、耗料守恒、存储重开和差异身份专项通过；工程类型0错误，CodeGraph同步完成且无待同步。证据见 `output/verification/seven-demand-acceptance/seven-flow-43194/` 及该轮后续归档。

运行时：43190原页面已经新需求转单、拆解、配料、实际我方派单/PDA接单/接收、确认并重开MKP-20260907-001、打开PB-MKP-20260907-001-ACCEPT-104-A1、实际开始铺布；卷录入复现问题后未提交铺布完成。当前43194关闭HMR/监听，从原始上游输入重新转单和拆解进行修复后重放；43190是修改前失败及定位证据，不冒称最终通过。1366×768 Web，PDA仍为浏览器模拟；不替代19项真实设备门禁。图片/纸样缺失、原型占位图片、打印和最终全流程未关闭，产品接受人及接受版本待完整证据后确认，当前不能整体交付。

## 七单继续验收：备料来源和铺布输入性能

适用原需求追踪：新需求备料来源、任务工艺/BOM身份、现场数量与交互防错、Web/PDA交接。受管文件为 `src/data/fcs/cutting/production-material-prep.ts` 和 `src/pages/process-factory/cutting/marker-spreading.ts`。备料优先使用原正式加工产物关联同一生产单/版本/BOM/工艺 occurrence，水溶任务独立识别，保留已合并水溶染色的正式单归属。迁移读取在单次调用内复用当前订单映射，仍实时重读后续新操作。卷录入仅局部刷新原计算结果和提醒，不重建输入控件；未开始铺布的拒绝输入恢复原值，保存/完成仍走原业务验证。

类型检查 `/tmp/seven-types-local-input.log` 退出0。来源/迁移一致性专项及新动作重读证据归档中；浏览器性能回归另建独立上下文，不计入新需求验收数。当前43194完成铺布的原页面事实为用量7.12米、余5.24米、实裁0，PDA已识别正式派单执行任务及对应PB单。图片仍缺准确素材，真实PDA门禁未通过。本节状态为已实现待验证，不宣称整体通过。

### 裁剪后卷记录时间追溯修复

需求关联PROD-001、TEST-005/006；`src/data/fcs/pda-cutting-execution-source.ts::buildSpreadingRecords`优先读取原卷`occurredAt`，旧记录缺失时保留原fallback。实际43194开始裁剪使卷显示时间变化的失败现场已归档；最小专项先失败后通过，证明后续session更新不改变卷录入时间。当前命名PDA页面为旧源，最终页面复验待新源，不标记已验证。

### 七单新增修复映射

- EXEC-004/008、PREP-006、TEST-005：production-artifact-generation损耗公式遵循PCS小数定义；process-order-task-links裁片关系改成衣数量件；material-prep/shared及5类列表按真实单位汇总库存。当前三个专项/tsc通过，CASE01新服务复验中。
- PROD-004、POST-006：production-artifact-generation保留冻结显式POST/IRON_PACK三方责任TASK，三处筛选一致；不生成我方后道单、不扩展其它动态POST。候选实际冻结专项通过，根代理已应用，当前新单合并页面待验。
- PROD-001、EXEC-012、TEST-005：generated-fei-tickets不再按全局序号套旧高低层示例；事件来源读取准确PB实铺、成衣SKU及同色尺码部位组。six票40片/2层专项先失败后通过，编号相邻专项通过；真实打印与装袋待新源。generated-cut-orders删无归属图片fallback及编码SVG，缺准确图仍阻塞。
- GOV-006、TEST-006：marker-spreading-projection复用同次快照；utils不生成未消费视图。最终输入2～15.1ms、保存重开数据一致，但初载61.647秒、重开68.340秒不达标，未关闭性能门禁。

以上无提交/推送/整体验收声明。相关旧证据仅保留历史事实，当前状态已实现待验证。

### 当前续验补充：原料身份与合并承接方

- 印花投入改为读取正式加工单的准确物料 SKU，消除拼接 `-white` 导致真实投入拒收；当前源码专项通过，CASE01 工厂原页面复验待完成。
- PDA 待接单卡片及确认统一读取任务单位，不再把 6.3 米显示为件；当前专项覆盖米、件、公斤与单位覆盖，真实设备仍未验收。
- 配料按 BOM 首消费节点找到源任务后，沿同生产单且双向有效的合并关系绑定承接任务。CASE03 实际归档反例修复通过，单向、跨单、停用关系拒绝，独立裁床保持；尚未将已配确认认定为三方实收。
- 共享工作区当前为 `codex/ppic-20260907`，HEAD `77cd316a6bbf24dc3b45b0134d3ae7f06a0696c8`；本次未切换分支或提交。43210 服务根目录仍为当前工作树。已加载浏览器模块与后续新补丁的差异分别记录，不将其混为同一版本证据。
- 状态仍为已实现待验证；未满足五单全流程或总体交付门禁。

### 正式新单刷新修复（当前源）

正式需求转生产单成功后仅保存新增单及完整冻结快照；静态演示单不覆盖。原任务拆解、主工厂登记、人工完成及页面离开时保留已登记新单当前事实。恢复后按原需求和合并来源需求识别已有单，列表、详情及正式生成命令防止重复转单。保存失败契约验证原内存回滚、旧存储不变、失败单号不残留；损坏和不完整记录不加载。

负责位置：production-orders.ts、production/demand-domain.ts、production/context.ts；关联原需求 GOV-004、TEST-002 与 E2E 新单完整性。当前源 /tmp/seven-persistence-current.log 通过；CASE01 新浏览器刷新证据待回收。此修复不创建或补写加工、仓库、PDA 历史，不能用丢失会话恢复来替代重新验收。

### 印花交接读取性能修复

printing-task-domain.ts 的 syncDerivedWorkflow 每次调用读取一次当前交接列表，在本次同步内匹配单据；不跨动作缓存，不改变数量、状态、图片或写入入口。12 条加工单业务字段与旧源一致（运行 updatedAt 排除）；毛织读取 7→1，正式印花原料 SKU 专项再次通过。当前类型及 CodeGraph sync 已通过。因实际43210浏览器已加载旧模块，其内存错误仍不能当作已修复的页面证据，保留已实现待验证。

### 正式印花/染色加工定义刷新修复

原生产单增加仅定义身份记录（原加工单号、来源键、冻结来源快照），随正式创建末尾保存。印花/染色域冷读仅匹配同生产单、版本、工艺 occurrence、路线对象与 BOM 唯一分支，从原注册器恢复原编号定义；不补写已接收、已加工、已完成数量。创建事务回滚同步移除本轮定义身份。缺旧身份记录不猜编号。

当前源码两个独立 Node 进程通过：正式创建→冷读原ID保留，PRINT 12.36 米、DYE 8.4 米、现场完成0；错PO/版本/工艺/物料拒绝，重复读无重复身份。证据 /tmp/seven-definition-current-{write,read}.log，浏览器 CASE01新源复验仍进行中。仍为已实现待验证。

### 新正式单接收草稿增量修复

负责 material-request-drafts.ts 与 production/events.ts 原打开入口。旧静态草稿保持；新正式单显式打开时从已确认配料、准确 BOM、有效首消费承接任务形成建议，已创建接收需求不改写。确认重新检查任务生效、工厂、物料、单位、sourceDataIssue 和已配数量；不允许把未配量或理论上游产出当实收。原恢复建议仍读当前事实。

当前源码完整依赖契约（无替换事实查询）通过：原任务生成→合并→分配→配料四动作→草稿确认→WarehouseIssue，12.36米/ID-F014，已发0；无初始化递归，缺单位时原子拒绝。顶部summary纯读约0.05ms；显式打开508ms，性能仍待收口。浏览器CASE03在独立43218新源进行，尚未声明已发/已收。当前类型与CodeGraph sync通过。

### 铺布汇总重复读取修复及失败浏览器回执

marker-spreading.ts 同次页面数据计算共用已归一化铺布store和库存账；spreading-material-readiness.ts 支持接收同次当前账本，独立调用仍重新读取。四张铺布单汇总修改前后所有字段完全相等。原始projection的store尚未归一化，不能直接当页面store；对比发现该差异后已纠正，最终精确相等。当前源码专项数据读取9→1、库存账26→7，25.44秒→7.11秒，仍不代表通过页面性能门禁。

43216原PB按钮采样344秒、60秒点击超时，主要热点为毛织cloneStore。页面随后曾到spreading-detail，未开始铺布；连续失控占约3GB内存，已停止本任务该隔离浏览器并归档。本轮技术修复之后需再跑受影响页面，不能沿用该失败采样作为通过。

warehouse-material-execution.ts 对新正式需求只汇总准确sourcePrepLineId的CONFIRMED配料记录，原seed比例不变。当前源实际命令链专项12.36米已配、缺0、已发0；撤销确认后重读0，恢复后12.36。仓管实际交付与接收头门禁继续修复，未宣称已交付。

### 原仓库交付、原HO与裁剪数量时间续作

本批负责原需求EXEC-004/008/009/012、PROD-001/002/004、TEST-002/005及对应E2E条目。受管文件：`src/data/fcs/pda-handover-events.ts`、`src/data/fcs/warehouse-material-execution.ts`、`src/data/fcs/material-request-drafts.ts`、`src/pages/production/orders-domain.ts`、`src/pages/progress-material.ts`、`src/data/fcs/printing-task-domain.ts`、`src/pages/pda-handover-detail.ts`、`src/pages/pda-cutting-spreading.ts`、`src/pages/process-factory/cutting/marker-spreading.ts`（按实际仓库路径核对）。

仓管只读默认、原型仓管角色选择、实际交付人/数量及二次确认形成原交付事实；精确原Issue链接和目标工厂校验，PKR只等待实际工厂接收，不伪造实收。CASE03当前43220原页面交付12.36米与取消、0/超量阻断已观察，PDA卡顿未实收。混合单位及部分交付余量继续留待覆盖；原型角色选择不是后端鉴权。

PRINT交出在原HO成功后才更新条码与已交；所选条码长度必须等于本次数量且交收人不空。原HO接收投影与重复门禁专项通过；旧已交但无HO不补造。WATER使用已完成未交余额，确认时重新核对余额及身份。上述新源浏览器交收仍待复验。

PDA裁剪不再覆盖原领料数量，实际耗用保留独立；使用设备本地年月日时分，两个时区专项通过。铺布详情同次读取复用前后HTML完全一致，读取减少但耗时仍超标。本批状态为已实现待验证；准确素材、真实PDA、全流程和200ms门禁未完成。技术证据统一位于`output/verification/seven-demand-acceptance/continuation-contracts/`，不得替代现场回执。

`src/pages/pda-handover.ts` 原调度仅在所选工厂实际存在特殊工艺加工单时执行特殊工艺初始化，保留原流程与首次去重；无单/后道不调度，有单首次调度、重复不重复契约通过。完整原模块CASE03的ID-F014无特殊工艺单，原先仍触发初始化，造成额外耗时；这说明可去除无关工作，不足以认定全部卡顿根因已解决。铺布库存映射也去除被完全覆盖的第二次基础账读取，全部汇总字段前后精确相同。当前批类型检查与CodeGraph同步通过（continuation-contracts/seven-types-final-batch.log、seven-codegraph-final-batch.log）。最新43222从上游原动作再验CASE02，尚未到终点。

### 21:35后：发料重复迁移与染色页签

43222原配料、接单、接收12.36米和10件唛架确认均执行；交给铺布后等待PB按钮30秒超时，浏览器占约2.9GB内存/100%CPU。已归档并关闭本任务隔离浏览器，未开始铺布，不计完整验收。不会继续重复开整轮，先技术样本复现关键耗时。

`src/data/fcs/cutting/production-material-prep.ts` 新增只读已落盘CONFIRMED记录；`src/data/fcs/warehouse-material-execution.ts` 按准确sourcePrepLineId、物料和单位汇总，不触发整store历史迁移。缺失/坏JSON/错单位按0处理；旧seed比例不变。当前源原交付→原工厂接收12.36与身份/数量/重复门禁专项通过；四个铺布汇总字段前后完全一致。当前类型及CodeGraph同步通过，新七单性能和页面复验待闭合。

`src/pages/process-factory/dyeing/work-order-detail.ts` 局部页签和差异链接保留原:id详情路由，避免列表?dyeOrderId再拼?tab导致错误ID。8页签及差异参数专项通过，未变公共列表链接。CASE01原PDA已接收4.2米、原排缸VAT-F090-01后状态WAIT_WATER_SOLUBLE；此前未排缸不展示水溶节点符合现有顺序，不能据此删除或跳过水溶。原页面排缸局部刷新与水溶动作仍继续核验。

补充定位：通用待交出仓“菲票装袋”实际取全列表第一任务，并非代码字面硬编码旧ID；在新任务现场表现为旧演示任务入口。扫码候选是否跨任务及标题归属仍待一并验证，本轮未改该入口。

### 配料单位读取与原染色继续

production-material-prep.ts 的 getPrepLineUnit 对新正式单只按完整prepOrderId/冻结版本/BOM分支匹配单位，避免为单个单位全量派生任务；原seed、无匹配的旧回退保持，匹配BOM但单位空仍显示待确认。当前源77个归档配料/全部冻结BOM/错单错版本分支的单位输出与旧源逐项完全相等，类型通过。七单技术样本列表12.41秒、详情13.03秒，均真实含指定PB并返回；仍不能视为200ms页面门禁通过。

未应用无收益的PDA多层快照候选；也未把跨动作缓存snapshot里的库存账直接给当前页面复用，避免扩大数量陈旧风险。继续核验剩余热点。

CASE01染色原路径已在首批4.2米完成水溶、主管按实际继续、操作员开始/完成染色；完成后卡片被局部刷新移除，后处理入口消失，正在修原卡片切换。原已加工事实保留，不重做染色、不补造后处理。

### 22时：同次染色列表读取修复与恢复原验收

受管`src/data/fcs/dyeing-task-domain.ts`每次派生同步读取一次当前交接列表；`src/data/fcs/process-work-order-domain.ts`染色列表一次取得原单/复核/交接/配方，映射每张单不再重跑整域同步，独立详情getter仍实时读取。当前源包括正式ACCEPT-RAW-01-03新染色单的17单，首次/重复/原分配动作后全部字段与旧源精确一致，毛织事实读取420→1；未跨动作缓存，不改动作账。

配料listCurrentMaterialPrepOrders同次懒读裁片来源，38→1；当前源37单158行4状态全部字段与旧源一致，库存、配料和分配技术反例改变后立即重读。

七单归档Node技术样本当前列表1.98秒、详情1.95秒。独立浏览器技术样本列表首次15.83秒、原“查看详情”2.36秒，详情heap约163MB，能完整返回。第一次技术浏览器等待PB按钮超时系定位器不符：真实列表为行内“查看详情”，随后实际正文确认列表已渲染；未把该超时伪称业务卡死或通过。所有归档注入仅性能回归，绝不计原始需求验收数量。

PDA染色完成后恢复原后处理卡，并将后处理开始按钮接回原正式开始命令；当前操作者/同厂岗位/在线守卫保留，开始和完成均局部刷新。当前两项专项与类型通过。旧43214原Web也只有完成脱水，实际提交4.2米被“请先开始脱水”阻断，postNodes与HO仍空；已归档不补造。

当前类型与CodeGraph已通过；真实设备/准确图片/200ms门禁仍未通过。现在以新源原上游动作重跑43226 CASE01、43228 CASE03、43230 CASE02。0张完整新单的总体结论保持，直到实际各自终点和证据收口。


### 2026-09-07 22:30 续作：原裁剪完成与新增门禁修复

当前分支 `codex/ppic-20260907`，HEAD `77cd316a6bbf24dc3b45b0134d3ae7f06a0696c8`。完整新单闭环仍为 **0**。

- CASE02 / 43230：保留原浏览器现场恢复同源服务，未恢复或注入业务状态。原 12.36 米领料、10 件排料、7.12 米铺布，经过原操作工登录、开始裁剪、零数量阻断和完成裁剪；当前原事实生成 6 张菲票，S：前6/后6/袖12片，XL：前4/后4/袖8片。正在原菲票装袋。原始证据 `output/verification/seven-demand-acceptance/seven-cut-r30-43230/`。
- CASE03 / 43228：原仓库交付及工厂实收12.36米；开始生产提示成功但未保存的缺陷已定位到修改读模型副本。已修复合并任务写原任务事实、精确区分后道任务身份，提交后重读成功才提示。当前实际 private 页面函数契约通过，浏览器重新执行尚未完成。PDA交接时间改读本地时间。
- CASE01 / 43226：原PRINT两次交出6米/6.36米确实生成原HO记录，但服务中断导致页面丢失后，执行内存事实未保留；旧日志不能作为当前接收依据。WH-TRANSFER原接收身份/入口仍缺，未用demoRole冒充。
- 水溶被无关旧毛织缺纸样阻断：准备单关系按当前生产单限定毛织读取，本单缺纸样仍阻断，无参全局行为保留。三文件候选已应用，当前契约与TypeScript检查通过，原水溶页面复验中。
- 原裁剪视图仍存在已裁剪但部分状态显示待开工、库存实际耗用未闭环等缺口，不把裁剪提交成功等同整单通过。19项实机PDA及准确图片外部门禁仍未闭合。


### 2026-09-07 原装袋前置与冷加载污染修复

- CASE02 六张原菲票经原Web完成打编号；PDA原按钮错误读取按钮行而非表单，已改为读取包含输入的表单区域，当前实际handler契约通过。原浏览器仍旧模块，PDA修后页面验收待重开，Web完成不替代PDA通过。编号时间仍存在UTC显示缺口。
- 原袋扫码前两张成功、袖片提示找不到，根因为打印演示seed把新单前两张伪造已打印。已限定打印seed到initialProductionOrderIds，完整归档域失败复现2条假打印→修后0条，原seed记录逐字段不变。当前原浏览器四张待打印已通过原纸色确认进入预览并点打印；无实体打印机证据。预览图已保存，出现长编号底部裁切、部位数量统一4个及图片缺失，打印验收未通过。未把原seed两张视作实际打印。
- 冷加载字典演示种子不得污染新需求：production-artifact-generation按initialProductionOrderIds限定，原111条seed映射保持，新CASE03恢复精确CUT/SEW/IRON三任务。
- 建快照缺图不再自动合成SVG色卡：删除合成函数，保留准确既有图片来源；已有历史持久化SVG不据此认定真实素材，素材门禁保持阻塞。
- PDA执行页三处毛织数量/类型读取限定真实WOOL任务，保留本单缺料错误，避免DYE/WATER/PRINT等被无关旧毛织卡死。
- CASE01 原水溶已接收、完成、原HO交出3米，WH-TRANSFER未接收；原DYE Web已接收4.2米并排缸，待水溶节点。均不计完整订单。

本轮相关契约、TypeScript与CodeGraph已通过；原浏览器旧模块与当前源的差异仍按具体路径记录，未宣称整体verified/delivered/accepted。


### 2026-09-07 23时：首打与原中转接收入口

新增受管路径：`src/pages/wls-inbound.ts`、`src/router/routes.ts`、`src/router/route-renderers.ts`、`src/main-handlers/fcs-handlers.ts`、`src/pages/print/print-preview.ts`、`src/pages/process-factory/cutting/fei-tickets.ts`。原有本任务打印/追溯/中转袋模型与RETURN交接修改见七单验收记录。

- 需求：EXEC-007/008/010/011、GOV-004下WH-001～006，已同步总体设计§4.3.1和WP-06。
- WLS角色：管理/主管查看中转区域原批次；默认只读，原型中转收货员与姓名明确选择。该原型不构成真实仓库鉴权。
- 页面：既有菜单 `/wls/inbound` 对应标准列表，复用现有列设置、排序、冻结和分页；输入、弹窗、提交反馈局部更新，未改全局菜单。
- 业务：仅原HANDOUT且目标WH-TRANSFER记录；原数量/单位/提交责任保留，非有限、负数、超量、错仓、已收、作废、分次任务已收、缺身份/原因均阻断。保存前重读，保存后按原recordId核对实收/姓名/时间，不一致不得提示成功。
- 图片：原HO未提供可验证的加工产物准确图片，每条物料标识同块明确缺图，不借用无关原料或凭证图；缩略图、大图及素材完整性仍已阻塞，页面不可按完整交付。
- 技术：当前源TypeScript已通过；WLS16项拒绝、并发变化、重复点击一次命令和写后重读反例通过。标准列表及原浏览器1366×768/1024×768、差异接收、200ms响应尚以实际后续结果为准，不用契约替代。
- 版本：旧CASE01 SPA不包含新增路由，旧3米/4.2米原HO只保留归档，不手工注入页面或恢复下游数据；当前源新会话原流程重验。
- 首打：统一预览只记录当前选择菲票，保留实际产出标识；分批2+4与重复无增量契约通过。原打印预览存在编号裁切、部位数量错误和图片缺失，未通过打印验收。

本节所有新增页面证据未闭环前保持已实现待验证；全方案仍0张完整新单，不声明完整交付。


### 原正式合并任务结束与数量责任续修

受管`src/data/fcs/pda-handover-events.ts`、`src/pages/pda-handover-detail.ts`、`src/data/fcs/warehouse-material-execution.ts`：新正式合并RETURN按原任务接收方，扫描精确SKU并保留色码/登录操作人，按SKU剩余承接量限制，计划摘要保持10件。原缺SKU旧批次不补造归属，继续交出前明确阻断。

仓库实收完成与工厂加工结束分开：先收齐仍需工厂明确结束，先工厂结束仍待原仓库逐批实收；原头保留各自动作时间，不从任务更新时间猜造完成。当前两顺序专项及TypeScript通过。CASE03第六次原UI已明确工厂结束、任务DONE，而仓库尚未收货仍OPEN/0件，正在原WLS续验；不得并入第五次旧模块的10件收货。

`src/pages/process-factory/cutting/fei-tickets-model.ts`首打/补打同步原printStatus，与原status一致；原页面六张首打已保存事实中发现旧WAIT_PRINT冲突后追加该修复，类型通过，补打实操仍待验。

## 2026-09-08 续作当前增量（仍未总体验收）

- EXEC-007/008/010：新正式单裁片来源与实际产出承接现有放行矩阵。`src/data/fcs/cutting/generated-cut-release.ts` 按冻结 BOM 分支/纸样部位/原 SKU 计划组装原实际裁剪数量；`cut-piece-release.ts` 与原放行页接入。CASE02 原页面读取 40 片换算 S6/XL4；缺部位、缺 BOM 分支、重复来源和外单不能补足。新目标使用实际确认时刻。
- 放行关闭/恢复在首次读之前也必须同步来源；冻结后迟到产出保持待处理，恢复纳入后改为已处理；新增/撤去原产出使已确认版本需要复核。原历史 Mock 检查与原可用量检查已通过，隔离原事实契约和独立审查修后契约已通过。
- 原 Web 入仓成功后锁定已保存表单，保留关闭动作并说明下一笔重新打开，解决修改下一袋却被旧防重复锁吞掉。CASE02 原 S24/XL16 两条入仓事件均已核对，旧时间显示问题仍开放；此锁定修后原页面尚待验。
- POST-014/021/025：`src/pages/wls-finished-inbound.ts`、原路由/事件和 WLS 菜单增加独立成衣仓收货入口；只读默认、原型成衣仓身份与姓名、逐 SKU 原实际数量、差异原动态授权、保存前重读及写后唯一收货记录核实。原 WH-TRANSFER 收货范围保持独立。
- CASE03 原 FCK-PO2026030105-01 在同源正常新标签自然读取原保存记录，原 UI 成衣仓收货 S6/XL4 后唯一 PF-WH-RCPT-000002，收货人为 Siti，原回货单已完成。原取消保持存储不变、只读禁用、正常刷新后实收保留有证据。生产单仍待分配，合并任务开工/完成未可靠持久化，不能计完整单。
- 当前图片来源仍只用原对象字段；准确物料/部分历史图片缺失未通过；19 项真实 PDA 设备门禁未完成。当前浏览器 PDA、隔离技术契约和真实设备验收分别记录。
- 命名证据目录：`output/verification/seven-demand-acceptance/continuation-20260908/` 与 `seven-cut-r36-43236/`；各子场景原日志继续追加。未对其他工作区变更创建全量收据，未提交、推送或宣称远端交付。

### 2026-09-08 00:50 同源刷新验收及原动作保存修复

本轮新增受管范围：runtime-process-tasks.ts原Map同步提交与执行命令、production-orders.ts原任务实际开工推进生产执行、pda-handover-events.ts原合并交出记录及工厂完成独立保存、warehouse-material-execution.ts原RETURN枚举正式任务；dyeing-task-domain.ts/dyeing-material-receipts.ts原染色动作正常保存及失败回退；special-craft-task-orders.ts演示补齐只使用初始生产单。

当前分支codex/ppic-20260907，HEAD77cd316a6bbf24dc3b45b0134d3ae7f06a0696c8加工作区。原任务/HO同步候选逐段主审后整合；当前实际源码专项runtime-storage-current、runtime-ho-failure-current、runtime-ho-cold-current通过，冷读同两原记录SKU6/4和双方人员时间，工厂结束与仓收时间独立；保存失败不留下DONE或实收。原DYE域当前源码contract通过正常保存、匹配原冻结来源冷读、拒写回退及坏存储阻断。均为技术契约，不计原UI全流程。

原CASE02正常新标签现场复现10个无来源演示特殊任务；演示补齐范围修复后正常新标签实际仅3原CUT/SEW/IRON任务，special-demo-scope契约失败2对1后通过；没有删除原始真实动作或恢复夹具。新任务仍须原分配/接收/开工。适用原子编号MASTER-001、TASK-001、EXEC-004/008/010/011、GOV-004、TEST-001及E2E-003/012，具体整体原矩阵继续保持未闭环状态。

入仓成功表单锁定、原PDA当前登录人员、本地日期时间以及染色实收只读原收货批次的相关源码已整合。当前类型检查和相关专项按实际日志归档；尚未用最后补丁重验的页面均为已实现待验证。画像缺失/原打印版式/19项实机继续阻塞，不把普通浏览器390小屏称为实机。完整新单仍0，未宣称总体verified、delivered或accepted。

### 01:25 原单保存与任务交接责任修复

本轮相关受管文件：`effective-task-assignments.ts`、`unified-dispatch-workbench.ts`、`material-request-drafts.ts`、`pda-handover-events.ts`、`pda-handover-detail.ts`、`production/events.ts`、`cutting/transfer-bag-handover-mock.ts`、`wait-handover-actions.ts`、`pda-cutting-transfer-bag-repack.ts`。仅认领本轮原有效分配/LLXQ/PDA接收保存、任务PPIC候选与生产单完成本地时间修改，不认领这些文件内其他既有差异。

原任务PPIC来自有效分配或明确责任移交；不存在时无候选并阻断，移除虚构Ayu/Budi。任务、工厂和人员在交接时一起校验。原记录保存失败反馈且撤回本次动作；技术专项不替代当前页面动作、图片与设备验证。

原LLXQ完整模块实际命令失败/冷加载专项、任务PPIC候选隔离专项、Web中转袋专项、类型检查通过。旧任务基础专项2/3任务断言仍失败，未掩盖。CASE03旧原完成时间不重写，CASE02旧浏览器分配事实不导入新标签。完整通过0单，详见七单验收记录本轮条目；原页面、准确图片和19项设备门禁待闭合。

01:36追加：原染色两批各4.2米已WLS实收，但页面无人工完成入口，原状态FULL_HANDOVER与命令WAIT_MANUAL_COMPLETION不一致。修复`dyeing-task-domain.ts`以原实收记录投影待人工状态，具名人工确认后才写COMPLETED和原人时；`pda-exec-detail.ts`补本厂操作员二次确认按钮及局部反馈。技术契约用原两批记录覆盖未具名/缺接收事实/差异/重复和保存失败回滚；初次运行含旧before断言的脚本在当前已修源报Missing expected exception，另执行仅当前源的相同业务断言全部通过，不将该脚本报错隐去。原页面当前同源刷新后验收继续。

同轮`pda-cutting-task-detail.ts`原开工时间改为localDateTimeText，与实际页面01:34开工、01:36裁剪事实一致；未更改历史时间。独立CUT整体任务开工/人工结束仍缺，原单床完成不当整体DONE。

01:44原六张菲票预览：`generated-fei-tickets.ts`只修实际裁剪事件输出行的本票部位用量与SKU（4/4/4错误改1/1/2，本票只自身SKU）；`print-styles.ts`只缩紧普通非捆条菲票标题/单元格以保留100×100毫米边界。原票号019～024、片数6/6/12/4/4/8及原事件ID不变。前置数量契约复现4/4/4失败，修后通过；固定打印版式专项、类型通过。当前原43246自然刷新六张预览均无底部溢出，截图print-preview-six-fixed.png已目视核对；二维码173模块密度及真机可扫仍待设备验证，未宣称实机打印通过。

### 02:00 原 CUT 人工结束与 KOL 原动作保存

`pda-cutting-task-detail.ts`将原床次开工与原任务IN_PROGRESS同步保存，失败撤回床次事件和任务；全部床次完成后仍需本厂具名操作员二次确认整体完成。`pda-cutting-execution-source.ts`将全部床次完成但未人工完成显示为待人工完成；不从旧床次事件补写任务开工。当前命令防错专项、真实事件账回退专项、类型检查通过；43248新需求原UI正在复验，旧43246开工遗漏证据不回填。

`kol-goto-pda-domain.ts`保存原KOL任务执行字段、原领料批次及其仓库行、固定总价流水；`pda-handover-events.ts`在原交出保存范围纳入严格匹配任务/生产单/工厂的正式KOL头。领料、交出、人工完成先同步保存，两份存储任何一份失败均回退本次原动作；坏JSON阻断且不覆盖。不改变冻结定义，不根据生产单COMPLETED反推，不导入下游验收夹具。

主代理应用候选后实际当前源run-kol-persist、--cold、partial、broken全部通过，包含6个保存失败反例、正常2批6+4、独立模块冷读、分批继续及坏存储保留。npx tsc --noEmit通过；codegraph sync/status已执行且索引最新。以上是技术证据；CASE06新轮原UI仍待复验，旧43244刷新丢失保留为失败。旧KOL物料图片专项和原任务数量专项仍有失败，未删除断言，整体未验收。

### 02:18 交出原页面复验与相邻缺口

43246当前源原页面确认两袋6张40片交出：交出人Siti、原有效任务PPIC周敏；空姓名原按钮阻断且事件账字节不变，填名后原交出成功，两条原交出和车缝自动IN_PROGRESS冷读保持。修正`wait-handover-dialogs.ts`固定角色伪当前姓名与`wait-handover-actions.ts`空姓名门禁；Web中转袋专项、类型通过。tsx CLI曾因本机IPC权限报EPERM，改用node --import tsx执行相同原专项通过，未绕过断言。

本次又复现交出时间使用UTC字符串冒充本地、车缝自动开工未推进PO仍WAIT_ASSIGNMENT。`transfer-bag-operations.ts`仅原整袋交出默认时间使用已有localDateTimeText，`runtime-process-tasks.ts`首次自动开工沿原事务推进生产执行。专项先失败0次推进对期望1，修后覆盖首次原时间/人、分批不重开。旧43246错误时间不重写，不作为新修复全流程证据；当前新43248单留待原交接重放。

CASE06原UI已在43250最终冷读通过；CASE07缺BOM单位原记录保留、3执行动作阻断，已知单位矛盾仍拒绝。CASE03追加装扣子和CASE05仅车缝强制后道均缺准确扣子资料，另CASE05主体布颜色映射缺口。具体证据在seven-kol-final-43250及case03-post-and-case05-source-review，不能据两条已跑通链路宣布至少5单全验收。

### 02:28 批量交出保存失败回退

主代理最终高风险审查发现`submitWaitHandoverTaskBatch`原临时预演不能防止实际第二袋保存失败留下第一袋及车缝开工。最小失败契约复现原ledger被第一袋替换，随后在`wait-handover-runtime.ts`复用原runRuntimeTaskAction包住实际批次，并在失败时恢复原事件账；不创建第二事实源。当前受控保存接口契约验证第二袋写失败、最终任务写失败均恢复账与任务，正常重试两袋成功，原Web专项通过。该接口契约不是物理设备或真实浏览器故障注入证明；43248原页面继续复验。

类型检查最后复跑发现共享工作区`src/main.ts:326`无关退裁片处理器参数数量不匹配（传2、定义1）；本轮未修改该无关调用。前一轮类型成功不可当最终全项目通过；任务收据/整体verified仍不声明。整个工作区还存在其他任务差异，不将其吸收到本任务收据。

### 后道追加装扣子辅料状态的窄修复

`post-finishing-full-flow.ts:getPostFinishingMaterialReadiness`不再仅因正式新单/三方已承接烫包而宣称调拨不适用；读取本生产单已完成QC冻结的装扣子项目，有该项目就明确需要调拨，无原调拨单显示尚未形成。只读状态不新增调拨/耗料数量，不用历史示例纽扣补正式BOM，不将空项目或其他单的调拨借来。历史示例已存在调拨范围保留。

最小契约先复现正式追加装扣子false，修后为true且与当前原调拨状态关联；空项目、跨单隔离通过。准确BOM至原调拨申请/实际备料/消耗适配仍待完成，POST-017保持实施中，不能把这处状态修正算完整辅料流程。

默认check:prototype-design-governance已执行，结果为staged无受管文件；由于本任务未暂存，不能将该结果当整个脏工作区治理通过。当前仍只认领本轮明确受管差异，不运行吸收其他任务修改的全量收据。

### 2026-09-08 02:47 水溶原动作保存续验

受管文件：src/data/fcs/water-soluble-task-domain.ts、src/data/fcs/pda-handover-events.ts。原执行动作同步保存并按正式来源核对冷读；保存失败共同回退原执行与交出，原演示种子仅限初始单。本地时间只用于新动作，不改写历史。

当前受控模块检查/tmp/check-water-persistence-current.cjs通过原两批、人员时间、冷读和存储失败回滚；原水溶专项check-water-soluble-process.ts在577数量6000对1050失败待定位，修后原页面未完成。款式/物料图片、大图、实机与打印门禁保持开放。当前独立npx tsc --noEmit退出0，旧main.ts类型阻塞不再复现。不据此关闭总体交付。

### 02:53 水溶累计补做防回退

新增受管文件src/data/fcs/dyeing-task-domain.ts，仅在completeDyeWaterSolubleNode累计量计算后阻断低于既有累计量；主管继续补做不能减少已记录产出。scripts/check-water-soluble-process.ts原失败断言1247保留，修后完整专项通过。该脚本另纠正4处损耗小数输入、按方案§7.11 POST-001保留烫包任务分配唯一性。对应原子GOV-004/PREP-003及EXEC数量交接边界；原UI补做场景尚未重放，不声明页面已验证。

### 02:58 新生产单及拆解日志本地时间

原43256和43254均复现创建/GENERATE在本地凌晨显示前日18时。只修改src/pages/production/context.ts的toTimestamp调用现有localDateTimeText，覆盖原生成生产单与拆解写入时间，不批量改写历史。CodeGraph影响核对限定该文件的toTimestamp使用者；同名技术包/配料函数未改。当前函数受控检查跨日00:00及02:51通过；后续原新建/拆解页面修后重放仍待验。对应GOV-004/EXEC-012人时证据。

### 03:06 原印花执行与交出保存

受管文件src/data/fcs/printing-task-domain.ts和src/data/fcs/pda-handover-events.ts。原加工单、节点、卷、人工结束与原交接同步保存；正式来源按已存生产单印花定义/冻结BOM occurrence校验，损坏或错来源阻断，失败共同回退原内存及存储。新动作本地时间，历史不回写。未新增下游事实导入或第二数量账。原43240两批现场刷新丢失保留；主代理审阅候选580行后已应用。

当前源码真实模块write检查通过6/6.36两批卷、交出/实收、人工完成以及保存失败回退；新Node冷读/错来源检查继续，原43256修后PRINT重放尚未开始。需求PREP-001、EXEC-004/012、GOV-004保持适用验证边界，准确图片/设备/最终全链仍待验。

### 03:11 当前技术验证结果

PRINT候选应用后，当前源码write/cold/bad-json/bad-source/HO错来源检查全部退出0；原两批卷/原交接/人工完成逐字段冷读，错误来源与保存失败保持原字节。npm run build退出0，工程类型检查、15项测试与打包通过（仍有大chunk警告）。这些结果不替代原型性能、准确图片、实机或完整新单验收。共享无关差异仍在，未生成吸收全工作区的交付收据。

### 03:26 染色PDA分批确认、人员和取消

当前src/pages/pda-exec-detail.ts已应用两份审阅后的最小候选：交出确认号绑定原加工批次/包装节点与原交出进度，同次重复仍幂等，后续批次及部分交出不复用整单确认号；五个后处理完成节点前后核对原账号/厂别/岗位/在线并记录当前姓名；数量及包装两个后续提示取消立即退出，非法数量交原正数校验，不用计划量兜底。旧历史不回填。当前受控原服务确认机制、原角色校验与27个取消/数量契约通过；原43256第二批交出继续待新源重放，五节点正常完成新姓名仍待原新操作。上一build先于这次实质修改，不作为最终版本通过。

### 2026-09-08 03:40 最新验证补充

PRINT持久化、染色累计数量、生产时间、PDA分批确认键/操作人/取消防错的最后修改后，最新 npm build（含类型检查及15项工程测试）退出0，见 output/verification/seven-demand-acceptance/continuation-20260908/final-current-build.log。分块体积警告保留，未宣称性能通过。43256染色第二批原交出/中转实收/人工完单及最终冷读相等见67-dye-cold.log；旧后处理人员和UTC记录没有改写，新增操作人/取消场景的真实页面复验仍待补齐。无关工作区差异未纳入任务收据。

### 2026-09-08 03:51 原全流程新缺口与修复边界

需求POST-002：R54原任务详情链接只显示3条旧种子。最小修复复用现有listPostFinishingTasks，禁止页面另复制正式来源/回货聚合；原筛选、分页、记录弹窗、重量、图片、来源跳转保留，计划量/版本/售卖类型读实际视图。必须在R54同源刷新原任务列表核对6批原回货、6张QC和10件，资料图片缺失继续不通过。原PO已人工完成与完整冷读由主代理核对，业务链3条，整体验收0单。

需求EXEC-008/TEST-005：CASE01原CUT接收误取原PREP整单3种原料27.06米，已取消未提交。实际冻结CUT只主料且前置PRINT，另两花边到SEW。修复依次为：原需求/确认命令禁止错误PREP消费；按准确PO/版本/BOM/前置occurrence读取原PRINT的WLS实收批次；用原领取事务记录真实实收来源取用并防重复、回滚、冷读。第一步仅防错阻断，不得宣称加工产出已能领取，更不得用HO编号塞入prepRecordId冒充配料来源。直接首工序CUT保持已有合法PREP原路径；不扩展无关库存框架，不伪造花边按SKU耗用比例。

### 2026-09-08 原接收第一步防错已实施

production-material-prep.ts 的正式原PREP消费守卫已按原PO/冻结版本/BOM唯一首CUT校验，原确认命令和基础append均重核；当前CASE01带PRINT前置不能继续从原PREP领取，两花边不进CUT。130-cut-guard-current.log为同43256重启服务后原page.reload的实际页面与零pickup记录证据。只证明错误接收被关闭，尚未证明印花产出可以领取；后续原HO实收来源接入进行中。

当前实际源码防错专项、pickup-node-domain、post-finishing-current-read-model、post-finishing-full-flow、list-page-governance:static均通过。pickup-important-regressions在“历史分组当前承载事实”配料数量场景失败；仅关闭本次两守卫的内存加载对照仍同点同错误，见technical-contracts/pickup-important-before-guard.log，不是本次门禁引起。没有修改该历史业务或跳过失败计绿灯。完整构建仍待当前最后修改后重新执行，先前final-current-build.log不覆盖本次列表及接收门禁。

### 后道正式任务页面查询与筛选修复

原R54查询按钮点击后不导航：main提交统一preventDefault，而dispatchFcsPageSubmit缺该表单。当前在既有tasks原表单添加精确标识，原FCS提交分发仅该路由/表单接handlePostFinishingTasksSubmit；使用现有navigate保留taskId与每页条数、重置第1页，避免main二次整页渲染。重量开关同样使用原navigate保留当前筛选；关键字新增实际技术包版本匹配。未修改main提交体系，未添加通用表单框架。当前tsc --noEmit退出0（/tmp/seven-current-typecheck.log），最终原页面点击/回车/重量开关复验进行中。

### 2026-09-08 04:26 CASE01 原印花产出已由裁床实际接收

同分支、HEAD、43256原浏览器；实际原接收按钮于04:22:46接收12.36米、2卷，落位HiGood裁床厂A-R01-L01-P01。原pickupRecord.prepRecordId为空，printReceiptSources逐批保留原HO、原实收6/6.36米、原0001/0002条码、PO/冻结版本/BOM/直接前置及目标CUT，不冒充原PREP。134-cut-print-cold.log中原接收/原仓库流水刷新前后原字节完全相等，CASE01从待接收列表消失；137-marker-search.log原唛架选择页该CUT可用余额12.36米，花边未混入。此为原型原动作证据，不是实机或图片验收。

实现范围：production-material-prep、pickup-node-domain、pickup-demand-domain、pickup-management-runtime、pickup-management-projection；候选已由主代理审查合入当前工作区。仅明确唯一CUT←PRINT同BOM路线，其他DYE/WATER→CUT、多候选及未明确工厂不推导。跨目标占用扣同原实收余额，过期/错BOM/单位拒绝；原存储及流水双保存故障、重复session、实收差异由当前函数专项验证。退料暂阻断，不能假退回原料PREP。

另发现接收页面把印花实收称为配料单/虚拟托盘，已按显式来源字段修正标题与来源位置，原查询、列、按钮保留；此文案修改后的同源重启页面复验待执行。唛架界面的物料仍显示计划原料SKU，137仅证明目标CUT可用数量，不作为实际物料图片或SKU展示验收。整链仍3条、完整验收0张。

### 2026-09-08 04:32 最终源码原接收/原上游核验

143-cut-print-history-current.log：重启同源服务后原CASE01历史显示印花交接实收、实际输出SKU、累计12.36米/本轮0米/剩余0米；1366宽度无页面横向溢出，原接收序列化与134逐字节相等。144截图为滚动到实际CASE01卡片，143未滚动截图只包含旧单，不作为该新单视觉证据。144接收记录抽屉脚本误等dialog超时，尚不算抽屉通过。147原PRINT/HO头/两批实收与116原事实JSON完全相等，裁床接收没有改写原产出与原交接事实。

原唛架MKP-20260908-001已通过原按钮确认，145同源重启后的原页面重新打开仍10件（S6/L4）、普通铺布7.12米+捆条4米，总11.12米；原型排版输入已备注，不是工厂纸样验收。140首次脚本误用其他单XL字段超时，未提交；141按本单实际L字段修正后继续原UI。完整链计数仍3，完整验收0。

### 2026-09-08 04:45 CASE01 原两卷铺布完成，保留新缺口

原唛架确认时已建立PB-MKP-20260908-001-ACCEPT-103-A1，149原页面显示已生成；148脚本等待“选中”超时，未生成第二张。150原详情可用12.36米，152开始铺布。原0001/0002卷标签6/6.36米分别录入单层3.5米、头尾各0.03米，实际用量各3.56米。159原保存草稿保留两卷人员按层姓名与当前记录时间，162原完成铺布进入待裁剪，实际裁剪数量仍0，不能把铺布理论10件当已裁数量。

新发现：160原输入已保留人员姓名/层1–1，但旧warning仍按session.operators判缺少人员；实际Web填写保存到roll.operatorLayerRows，不等于旧PDA换班事件。161原“同步回写”准确提示没有工厂端PDA记录，没有为此注入或伪造PDA执行。该提示一致性仍待修正；资料图片及铺布显示计划原料SKU问题仍待收口。尚不能把本单计为整链成功。

### 2026-09-08 05:06 铺布人员与两阶段时间修复

PROD-001/EXEC-012/TEST-005：原161人员已有按层记录却被旧session.operators警告；buildSpreadingWarningMessages现识别有效原Web按层姓名/层数，不合成PDA换班事件。原172裁剪10件已保存，但铺布开始04:49晚于结束04:43；createSpreadingDraftFromMarker重建漏保留两阶段时间/裁剪状态/日志，syncWebSpreadingStage还会覆盖铺布负责人。现保留原两阶段字段/日志/更新时间，裁剪同步保留铺布负责人、裁床。受管文件新增src/pages/process-factory/cutting/marker-spreading-model.ts、src/pages/pda-cutting-spreading.ts；来源范围不变，无新业务动作/时间来源。原错误历史不直接改写，正向新起始场景仍待验证。

失败复现与当前实际函数专项已归档technical-contracts，空姓名/缺层数/越界仍提示，PDA裁剪不覆盖原铺布字段。最后修改后build退出0（类型+15项工程测试+Vite）；CodeGraph同步/状态无待同步。173同源服务重启后原接收抽屉明确显示HO两批6/6.36米/原两条码；1280×720主页面无横向溢出，接收原字节等于134、原裁剪/流水字节等于172。当前修复不代表新时间场景已被原UI证实。

### 2026-09-08 05:40 原 CASE01 裁片到独立车缝补验

版本仍为codex/ppic-20260907 / 77cd316a6bbf24dc3b45b0134d3ae7f06a0696c8，同工作树43256，无本小段新增src修改。EXEC-008/010/012、PROD-001、TEST-005证据见七单文档05:40记录及七单目录176、184–206。原编号防错→恢复、装袋、两库位入仓、目标S6/L4、放行V1、派单1200 IDR/件、原五步交出两袋40片已实际执行。206袋/裁床账刷新逐字节相等，205原车缝自动接收开工日志，不宣称三方另有手动接收。

原型默认放行人王敏、派单人陈琳和自动接单均按原页面/日志注明，不能变成真实现场身份。179–181无头浏览器原打印记录不构成物理打印通过。209确认原车缝配料没有本单加工后水溶/染色花边投入承接；原首次消费配料不能替代下一节点发料，全单不关闭。206只读袋master.currentStatus仍为IDLE，与交出页面“待回收”须进一步联查原周期/事件投影；这里不据单一master状态判通过，也不宣称已修复该展示一致性。

### 2026-09-08 06:10 独立车缝原交出补漏（PROD-004、EXEC-008/010/011、POST-001/002、TEST-005）

受管文件pda-handover-events.ts只增加正式独立SEW逐SKU/持久化/人工完成与冻结后道接收方分支；pda-handover-detail.ts只修工厂已交完/后道待实收的紧凑页提示与可用动作。其他工作区既有差异未纳入本次改动。事实与当前UI回执为七单目录217失败→218冷丢失→220零记录→221原6/4→222人工完成→225冷读相等→226最终页面与原facts相等。原图见226，已目视核对390×844；对象真实图片和现场凭证仍未验收，未伪装成工厂实拍。

专项见technical-contracts/check-case01-sew-return.ts及case01-sew-technical-current/cold、case01-sew-merged-regression日志；最终type及CodeGraph日志带final，完整构建归档final-current-build.log。仅当前链技术/页面补验，不提升101主矩阵状态，不宣称全流程或物理设备通过。多域原历史事实及原三条链仍须按受影响范围联查；无关工作区未隔离，未运行全量任务收据。
