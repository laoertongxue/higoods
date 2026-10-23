# 中央 / 三方工厂 PDA 拆分实施记录

本文件保留基础阶段记录的原范围与原结论；后续C08阶段在文末单列。早期“框架尚未接通”“本轮不写业务”的表述仅属于该基础阶段，不能作为当前代码现状或本次完整拆分的完成证据。整体仍在实施，结论仍为不通过。

依据 AGENTS.md 的 SCOPE-02、TRACE-01、REVIEW-01、PERF-01、EVIDENCE-01。

## 基本信息

- 日期：2026-10-20
- 任务 / 需求编号：PDA-FACTORY-SPLIT；完整编号及计划见 docs/product-design/pda-factory-split/requirements-plan-matrix.md
- 验证人：Codex 主代理；目标保持 active，技术检查不代替用户接受

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：T4。已识别三方/卫星车缝的接单/执行过滤、禁入直链和事件检查发生变化；新写中央框架组件尚未接通业务路由。当前是完整拆分的实施中间版本，不能以部分测试或组件预览证明目标完成。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
|---|---|---|
| 三种车缝纯范围判定 | 通过 | pda-experience-scope.test.ts：正规单、别名、固定合并工序、缺工序/多工序/冲突元数据、退役源、非TASK等边界 |
| 实际工厂列表非空检查 | 通过 | 17家三方/卫星车缝资料，现有2笔车缝仍可见；不以清空列表通过 |
| 三方仓管与工艺直链 | 通过 | 实际ID-F021管理员登录，warehouse、wait-process、washing、wool/pending-receipts四条直链回exec，底栏无仓管；读取前守卫及事件守卫分别存在 |
| 全部扫码/详情/交接/结算范围 | 不通过 | 尚未逐项接通最终三方端；WP4及S12/X11保持实施中，不把当前四条直链核验推广为全覆盖 |
| 中央独立框架 | 通过 | 新frame.ts仅依赖utils.ts；组件只有接收/执行/仓管，含账号、语言、退出、返回及主按钮；无旧PDA页面依赖 |
| 中央真实业务入口与逐工序闭环 | 不通过 | WP2/WP3待继续，组件尚未注册主路由；两个菜单暂未替换为未完成业务入口 |
| 小屏及印尼语框架 | 通过 | 320×640、360×640组件预览，长工序名换行，按钮≥44px、底栏可见；本项不是业务页面/真机验收 |
| 原数量/状态 | 通过 | pda-factory-task-projection及pda-receive-preparation-scope保留基准记录身份、数量与状态；本轮不写业务数量 |
| 保存/附件/数据库 | 不适用 | 本轮只新增边界判断与UI框架，无新增业务持久化、附件、数据库连接；后续命令仍须原子保存验证 |
| 图片 | 不适用 | 框架组件不承担实物识别，本轮不改实物图；各业务卡片真实图片仍在X10待实施，不能借此豁免 |
| 原加载边界 | 通过 | 初次全量检查检出3项：main静态依赖进入craft pack，及两项路由函数测试依赖缺失。路由判断已移入无依赖的pda-experience-paths；测试注入真实纯函数，未放宽原断言；17项专项复测通过 |
| 完整构建/治理/性能/目标审计 | 不通过 | 整体实施尚未完成。首次npm run build失败记录保留；修正后npm exec vite build已通过；最终workflow收据、完整设备/性能、矩阵闭环须继续执行 |

## 最终结论

结论：不通过

这是实施中的问题/证据记录，不是完成回执。不提交main、不发布此中间版本，也不关闭目标。

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/binding-process-command-scope.ts`
- `src/data/fcs/binding-process-records.ts`
- `src/data/fcs/binding-process-warehouse-linkage-service.ts`
- `src/pages/process-factory/cutting/binding-strip-orders.ts`
- `src/pages/process-factory/cutting/binding-strip-order-types.ts`
- `src/pages/process-factory/cutting/special-processes.ts`
- `src/pages/central-pda/binding-model.ts`
- `src/pages/central-pda/binding-view.ts`
- `src/pages/central-pda/binding-page.ts`
- `src/pages/print/print-preview.ts`
- `src/router/routes-pda.ts`
- `tests/unit/central-pda-binding.test.ts`
- `tests/unit/central-pda-special-scan.test.ts`
- `docs/product-design/pda-factory-split/binding-source-audit.md`
- `docs/product-design/pda-factory-split/special-current-source-audit.md`

- `src/pages/central-pda/print-material-view.ts`
- `src/pages/central-pda/print-warehouse-model.ts`
- `src/pages/central-pda/print-warehouse-view.ts`
- `src/pages/central-pda/print-input-label.ts`
- `src/pages/central-pda/print-scan.ts`
- `src/pages/central-pda/print-preparation-model.ts`
- `src/pages/central-pda/print-preparation-view.ts`
- `tests/unit/central-pda-print-warehouse.test.ts`
- `tests/unit/central-pda-print-scan.test.ts`
- `scripts/check-water-soluble-pages.ts`
- `src/data/fcs/cutting/cutting-event-migration.ts`
- `src/data/fcs/cutting/cutting-event-repository.ts`
- `src/data/fcs/cutting/cutting-event-scope.ts`
- `src/data/fcs/cutting/cutting-pickup-command.ts`
- `src/data/fcs/cutting/cutting-pickup-footprint-command.ts`
- `src/data/fcs/cutting/cutting-pickup-records.ts`
- `src/data/fcs/cutting/cutting-record-repository.ts`
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/cutting-spreading-command.ts`
- `src/data/fcs/cutting/part-ticket-records.ts`
- `src/data/fcs/cutting/pickup-node-domain.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/replacement-fabric-repository.ts`
- `src/data/fcs/cutting/spreading-length.ts`
- `src/data/fcs/cutting/spreading-material-allocation.ts`
- `src/data/fcs/cutting/spreading-material-consumption.ts`
- `src/data/fcs/cutting/spreading-material-readiness.ts`
- `src/data/fcs/cutting/spreading-material-records.ts`
- `src/data/fcs/cutting/warehouse-layout-record-contract.ts`
- `src/data/fcs/cutting/warehouse-layout-records.ts`
- `src/data/fcs/dye-execution-snapshot.ts`
- `src/data/fcs/dyeing-records.ts`
- `src/data/fcs/fabric-washing-model.ts`
- `src/data/fcs/factory-receiving-links.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/printing-joint-records.ts`
- `src/data/fcs/process-output-types.ts`
- `src/data/fcs/water-soluble-output.ts`
- `src/data/pcs-record-runtime.ts`
- `src/pages/central-pda/cutting-execution-view.ts`
- `src/pages/central-pda/dye-completion-model.ts`
- `src/pages/central-pda/dye-model.ts`
- `src/pages/central-pda/dye-output-label.ts`
- `src/pages/central-pda/dye-output-model.ts`
- `src/pages/central-pda/dye-output-text.ts`
- `src/pages/central-pda/dye-output-view.ts`
- `src/pages/central-pda/dye-ui.ts`
- `src/pages/central-pda/dye-warehouse-model.ts`
- `src/pages/central-pda/dye-warehouse-view.ts`
- `src/pages/central-pda/dye-yarn-model.ts`
- `src/pages/central-pda/dye-yarn-view.ts`
- `src/pages/central-pda/print-completion-model.ts`
- `src/pages/central-pda/print-completion-view.ts`
- `src/pages/central-pda/session.ts`
- `src/pages/central-pda/washing-model.ts`
- `src/pages/central-pda/washing-page.ts`
- `src/pages/central-pda/washing-print.ts`
- `src/pages/central-pda/washing-ui.ts`
- `src/pages/central-pda/washing-view.ts`
- `src/pages/central-pda/washing-warehouse.ts`
- `src/pages/central-pda/water-label.ts`
- `src/pages/central-pda/water-model.ts`
- `src/pages/central-pda/water-output-model.ts`
- `src/pages/central-pda/water-ui.ts`
- `src/pages/central-pda/water-view.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/process-factory/cutting/marker-spreading-model.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/process-factory/cutting/warehouse-location-layout-store.ts`
- `src/pages/process-factory/dyeing/dispatch-print.ts`
- `src/pages/process-factory/dyeing/output-documents.ts`
- `src/pages/process-factory/dyeing/washing/execution-dialog.ts`
- `src/pages/process-factory/dyeing/yarn-shipments.ts`
- `src/pages/production-context-recovery.ts`
- `tests/unit/central-pda-cutting-event-scope.test.ts`
- `tests/unit/central-pda-cutting-footprint.test.ts`
- `tests/unit/central-pda-cutting-layout-read.test.ts`
- `tests/unit/central-pda-cutting-layout-records.test.ts`
- `tests/unit/central-pda-cutting-pickup-read.test.ts`
- `tests/unit/central-pda-cutting-readiness-units.test.ts`
- `tests/unit/central-pda-cutting-replacement-write-scope.test.ts`
- `tests/unit/central-pda-cutting-spreading-allocation.test.ts`
- `tests/unit/central-pda-cutting-spreading-command.test.ts`
- `tests/unit/central-pda-cutting-spreading-records.test.ts`
- `tests/unit/central-pda-dye-input.test.ts`
- `tests/unit/central-pda-dye-record-target.test.ts`
- `tests/unit/central-pda-print-completion.test.ts`
- `tests/unit/central-pda-print-design-owner.test.ts`
- `tests/unit/central-pda-print-owner-boundary.test.ts`
- `tests/unit/central-pda-washing-input.test.ts`
- `tests/unit/central-pda-washing-print.test.ts`
- `tests/unit/central-pda-water-completion-input.test.ts`
- `tests/unit/craft-entry-initialization.test.ts`
- `tests/unit/dye-execution-snapshot.test.ts`
- `tests/unit/dye-known-early-readback.test.ts`
- `tests/unit/dye-print-joined-ledger-stage.test.ts`
- `tests/unit/part-ticket-read-continuity.test.ts`

- `scripts/check-wool-craft-warehouse.ts`
- `scripts/check-wool-warehouse-local-interactions.ts`
- `scripts/fixtures/wool-warehouse-local-interactions.html`
- `src/data/fcs/wool-domain/commands.ts`
- `src/pages/central-pda/special-warehouse-history.ts`
- `src/pages/central-pda/wool-stock-operation-model.ts`
- `src/pages/central-pda/wool-stock-operation-view.ts`
- `src/pages/process-factory/wool/warehouse.ts`
- `tests/unit/central-pda-wool-stock-operation.test.ts`
- `tests/unit/central-pda-wool-warehouse-history.test.ts`
- `tests/unit/wool-stock-render-structure.test.ts`

- `tests/unit/pda-sewing-detail-canonical-task.test.ts`

- `src/data/fcs/production-context-records.ts`
- `tests/unit/production-context-read-concurrency.test.ts`

- `src/pages/pda-third-party-scope.ts`
- `src/pages/pda-handover.ts`
- `src/pages/pda-handover-detail.ts`
- `tests/unit/third-party-pda-handover-scope.test.ts`

- `src/pages/central-pda/wool-control-model.ts`
- `src/pages/central-pda/wool-control-view.ts`
- `src/data/fcs/wool-domain/machine-associations.ts`
- `tests/unit/central-pda-wool-control.test.ts`

- `src/pages/central-pda/wool-warehouse-model.ts`
- `src/pages/central-pda/wool-warehouse-page.ts`
- `tests/unit/central-pda-wool-warehouse.test.ts`

- `src/pages/central-pda/wool-craft-model.ts`
- `src/pages/central-pda/wool-craft-page.ts`
- `tests/unit/central-pda-wool-craft.test.ts`

- `src/data/fcs/wool-domain/handover-code.ts`
- `src/pages/central-pda/operation-label.ts`
- `src/pages/central-pda/special-model.ts`
- `src/pages/central-pda/wool-handover-model.ts`
- `src/pages/central-pda/wool-handover-view.ts`
- `tests/unit/central-pda-wool-handover.test.ts`

- `src/data/fcs/wool-domain/command-order-scope.ts`
- `src/data/fcs/wool-domain/store.ts`
- `src/pages/central-pda/wool-execution-view.ts`
- `src/pages/central-pda/wool-model.ts`
- `src/pages/central-pda/wool-page.ts`
- `src/pages/central-pda/wool-ui.ts`
- `tests/unit/central-pda-wool-receiving.test.ts`
- `tests/unit/central-pda-wool-report.test.ts`

- `src/pages/central-pda/cutting-handover-model.ts`
- `src/pages/central-pda/cutting-handover-view.ts`
- `tests/unit/central-pda-cutting-handover.test.ts`
- `src/data/fcs/cutting/simple-cut-piece-handover.ts`
- `src/data/fcs/cutting/replacement-fabric-event-validation.ts`
- `src/pages/simple-cut-piece-handover-ui.ts`

- `src/data/fcs/cutting/release-ticket-print-state.ts`
- `src/data/fcs/cutting/cut-piece-release-facts.ts`
- `src/data/fcs/cutting/generated-cut-release.ts`
- `src/pages/process-factory/cutting/fei-tickets.ts`
- `tests/unit/cut-piece-release-print-state.test.ts`

- `src/data/app-shell-config.ts`
- `tests/unit/pda-split-menu.test.ts`

- `src/pages/process-factory/cutting/pickup-management-list.ts`
- `src/pages/central-pda/cutting-page.ts`
- `src/pages/central-pda/cutting-spreading-model.ts`
- `src/pages/central-pda/cutting-spreading-view.ts`
- `src/data/pcs-style-archive-repository.ts`
- `src/data/pms/canonical-purchase-references.ts`
- `tests/unit/pcs-style-tech-pack-reference.test.ts`

- `src/pages/central-pda/print-dispatch-model.ts`
- `src/pages/central-pda/print-dispatch-view.ts`
- `src/data/fcs/printing-factories.ts`
- `src/router/routes-fcs.ts`
- `tests/unit/central-pda-print-dispatch.test.ts`

- `src/data/fcs/central-printing-actor.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/data/fcs/fabric-washing.ts`
- `src/data/fcs/fabric-washing-repository.ts`
- `tests/unit/central-pda-print-actor.test.ts`

- `src/pages/central-pda/print-output-model.ts`
- `src/pages/central-pda/print-roll-ui.ts`
- `src/pages/central-pda/print-output-view.ts`
- `src/pages/central-pda/print-washing-model.ts`
- `src/pages/central-pda/print-washing-view.ts`
- `tests/unit/central-pda-print-washing-input.test.ts`
- `src/pages/central-pda/print-label.ts`
- `tests/unit/central-pda-print-roll-input.test.ts`

- `tests/unit/central-pda-print-detail-read.test.ts`

- `tests/unit/central-pda-print-record-target.test.ts`

- `src/data/fcs/printing-records.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/pages/central-pda/print-model.ts`
- `src/pages/central-pda/print-ui.ts`
- `src/pages/central-pda/print-view.ts`
- `src/pages/central-pda/print-page.ts`
- `tests/unit/central-pda-print-input.test.ts`

- `tests/unit/central-pda-water-pause-continuation.test.ts`

- `src/pages/central-pda/entry.ts`
- `src/pages/central-pda/water-page.ts`
- `src/pages/central-pda/water-warehouse-model.ts`
- `src/pages/central-pda/water-warehouse-view.ts`
- `tests/unit/central-pda-water-warehouse.test.ts`

- `src/data/fcs/pda-experience-scope.ts`
- `src/router/pda-experience-paths.ts`
- `src/data/fcs/mobile-execution-task-index.ts`
- `src/data/fcs/pda-receive-scope.ts`
- `src/pages/pda-runtime.ts`
- `src/pages/pda-shell.ts`
- `src/pages/central-pda/frame.ts`
- `src/main-handlers/pda-handlers.ts`
- `src/main.ts`
- `tests/unit/pda-experience-scope.test.ts`
- `tests/unit/central-pda-frame.test.ts`

- `src/pages/central-pda/dye-water-model.ts`
- `src/pages/central-pda/dye-water-view.ts`
- `src/pages/central-pda/dye-page.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `tests/unit/central-pda-dye-water-input.test.ts`

- `src/data/fcs/water-soluble-task-domain.ts`
- `src/data/fcs/central-execution-record-bridge.ts`
- `src/data/fcs/fabric-washing-storage-bridge.ts`
- `src/data/fcs/special-craft-records.ts`
- `tests/unit/central-pda-water-ledger-identity.test.ts`
- `src/data/fcs/water-soluble-records.ts`
- `src/pages/process-water-soluble-orders.ts`
- `src/pages/process-factory/dyeing/water-soluble-orders.ts`
- `src/pages/process-factory/dyeing/water-output-barcode.ts`
- `tests/unit/central-pda-water-record-target.test.ts`
- `tests/unit/central-pda-dispatch-record-target.test.ts`

- `src/pages/central-pda/lace-model.ts`
- `src/data/fcs/lace-factory-records.ts`
- `src/data/fcs/lace-factory-domain.ts`
- `tests/unit/central-pda-lace-records.test.ts`
- `tests/unit/central-pda-lace-model.test.ts`
- `docs/product-design/pda-factory-split/accessory-current-source-audit.md`

### 页面证据

- 版本：codex/pda-factory-split；基准6169496a675799802faee12b274eda39f196247d；工作树publish-newpda-v34/higoods；源码哈希在output/playwright/pda-factory-split/source-hashes.json。
- 服务：同工作树Vite开发服务127.0.0.1:48339。Chrome headed，Asia/Shanghai；原三方账号实际登录核对四条直链。中央为独立框架组件预览，320/360×640。
- 证据：output/playwright/pda-factory-split/browser-phase1.json、browser-phase1.log、frame-icons-probe.log与对应截图；phase1-first-build.log保留首次失败；phase1-repair-tests.log保留17项当前专项结果。

### 性能结论

- 结论：不通过
- 依据：尚未完成本任务所有新业务入口，未进行当前业务版本的PERF-01采样。开发服务页面可操作、组件布局及函数测试均不替代1秒门禁。

### 验证命令

- `node --import tsx --test tests/unit/pda-experience-scope.test.ts tests/unit/central-pda-frame.test.ts tests/unit/pda-factory-task-projection.test.ts tests/unit/pda-receive-preparation-scope.test.ts`：通过
- `node --import tsx --test tests/unit/craft-startup-chunks.test.ts tests/unit/pda-sewing-detail-canonical-task.test.ts tests/unit/pda-experience-scope.test.ts tests/unit/central-pda-frame.test.ts`：通过
- `npm run typecheck:entrypoints`：通过
- `npm run build`：失败
- `npm exec vite build`：通过
- `npm run workflow:verify`：未运行
- `npm run check:prototype-design-governance`：未运行

### 例外

- 无。整体未完成，不使用例外或过往参考稿证据关闭门禁。

## C08 普通辅助/特种加工单阶段（2026-10-20）

继承同一6169496a基准、同一工作树和分支；参考V34仍只作为界面依据。本阶段实现了新中央页面的实际业务入口及16类当前加工单的领域适配，不含裁床、毛织、染印洗、水溶、捆条、后整、织带/花边或三方完整闭环的交付。两个菜单仍待最终替换，旧资料处理与全部直接下游读取仍待完成。

### 实现与责任

- 新页面独立使用frame/page/special-model/warehouse/ui；不复制旧PDA页面。主入口在旧三方守卫之前准备中央记录，事件直接使用已载入的中央模块，避免切页后扫码落入上一页。局部模式切换只更新内容、标题和实际底部按钮，接收页没有加工/交出或自动库位输入。
- 当前完工规则依代码处理：有加工产出可完工；完工后可交出已加工余量，不能再接收、加工。盘扣全部投入菲票接收前不提供加工填报。原始件、片、张、米、条、个分别保留；BOM投入与产出分开，未选SKU本次补0。
- 采用同库按记录事务保存，原子组含加工单、库存、收发/交接、幂等结果及必要的旧共同账覆盖。保存前/失败时恢复相关缓存；只捕获本动作需要的已注册缓存所有者，普通空记录读取不做回滚快照或无效恢复。提交后以数据库回读发布；读取失败不抹掉已提交事实。同一确认号重试不重复。
- 旧共同账不被无差别清理；当前仍未完成旧片段转换、旧页写入退休和全部下游冷入口。以上原子契约通过不等于STORE迁移整体完成。

### 验证（技术验证，不是用户/现场接受）

| 对象 | 结果 | 直接证据 |
|---|---|---|
| 当前16类工序领域动作、单位及完工后余量 | 通过 | central-special-operations-cache-safety.log，16个实际来源均跑接收/加工/完工/剩余交出，保留对方独立实收0 |
| 320×640连续作业与换人责任 | 通过 | central-page-contract-read-boundary.log：6/4/3，换人再交1，两个账号分别交3/1；输入框501～559px、主按钮572～628px，无横向溢出 |
| 失败/返回/语言/清空及Web冷入口回读 | 通过 | 同脚本：原生IndexedDB配额失败保留输入；提交后读回失败重试不重复；Web独立入口6/4/4；无空草稿、上一笔成功提示残留或页面异常 |
| 跨页冲突及同确认号重试 | 通过 | special-records-cross-tab-read-boundary.log：旧页没收到广播仍拒绝旧版本；最终数量5、动作2；同确认号返回原操作编号 |
| 账号普通读取及缓存范围 | 通过 | central-account-frame-tests.log、central-cache-boundary-adjacent.log（37项）；原账号名称/密码/停用事实保留，普通读取不写种子；不捕获或重载无关缓存，原无参调用语义保留 |
| 当前构建与单元测试 | 通过 | central-stage-build-read-boundary.log：1,345项单测，Vite构建成功；原两项异步入口断言/调用错误的失败记录保留，修复后未放宽业务断言 |
| 全量类型基线 | 未通过全量、范围内通过 | central-typecheck-continuity.log：全量已有19项范围外错误，所选中央/特殊工艺文件0错误；不把渐进范围检查说成全项目无错误 |
| 加载/保存性能 | 当前4家族通过，完整范围未完成 | continuity版本有4家族各5样本通过；缓存边界版本冷入口首样本1310ms失败，保留central-production-performance-cache-safety.log。read-boundary版本相同环境追加5样本：冷页最大508ms、切语言95ms、执行页119ms、接收提交243ms，见central-production-performance-read-boundary.log；其他动作/工序家族仍未覆盖 |
| 旧资料、下游冷入口、全部工序、最终菜单、治理/收据、发布 | 不通过 | 完整矩阵仍有待实施项，不用本阶段证明全部拆分已完成 |

### 性能范围及失败处理

生产预览127.0.0.1:48340；Chrome进程已启动，每样本新上下文、空应用记录/HTTP缓存，320×640、Asia/Jakarta、实际最大9笔工序队列，完成条件包含可见图片、可交互内容与两次绘制；保存还包括IndexedDB持久结果回读。先前910ms、后续1310ms分别绑定不同源码阶段，不选择最快环境覆盖失败。原始日志和脚本均在output/playwright/pda-factory-split，完整阶段哈希需在源码冻结后更新。

### 本阶段受管文件

除前文基础阶段文件，新增/修改下列直接相关文件：

- `src/data/fcs/special-craft-records.ts`
- `src/data/fcs/design-revision-pcs-storage.ts`
- `src/data/fcs/design-revision-pcs-command.ts`
- `src/data/fcs/fabric-washing-storage-bridge.ts`
- `src/data/fcs/cutting/special-craft-fei-ticket-flow.ts`
- `src/data/fcs/special-craft-task-orders.ts`
- `src/data/fcs/store-domain-pda.ts`
- `src/pages/central-pda/page.ts`
- `src/pages/central-pda/special-model.ts`
- `src/pages/central-pda/warehouse.ts`
- `src/pages/central-pda/ui.ts`
- `src/router/routes-central-pda.ts`
- `src/router/routes.ts`
- `src/icons/shell-icons.ts`
- `src/pages/process-factory/special-craft/task-orders.ts`
- `src/pages/process-factory/special-craft/task-detail.ts`
- `src/pages/process-factory/special-craft/warehouse.ts`
- `tests/unit/central-pda-account-read.test.ts`
- `tests/unit/central-pda-cache-boundary.test.ts`
- `tests/unit/craft-batch-read.test.ts`
- `tests/unit/seam-embroidery-unification.test.ts`

补充静态门禁：`central-list-governance-static.log`保留首次缺少PDA页面类型声明的失败；只补充`@page-pattern: pda`注释后，`central-list-governance-static-repair.log`通过，检查4个变化页面。注释不改变运行语义、数量、初始化和资产，不因该注释重做业务/性能采样。全量原型治理和workflow收据仍未运行，不用静态列表门禁代替。

本阶段结论：实施中，整体不通过。未提交main、未发布此中间业务版本，目标继续active。

## 主分支同步后的独立复核（caa7b286）

最新主分支角色/维护入口更新已快进到本任务分支。35个任务文件中33个完全恢复，main和车缝入口测试自动合并后逐差异审查，保留新主分支的去角色门槛、独立页面事件及准备边界，也保留本任务中央独立路由/事件和三方工序限制；没有未解决冲突或遗漏文件。备份身份、原源码/资产哈希与恢复检查已记入需求矩阵。

- 当前新构建：`central-main-caa-build.log`，退出0，1355项单测通过，Vite构建通过。
- 当前实际浏览器：`central-page-contract-main-caa.log`，退出0；接收6/加工4/交出3，换实际员工账号再交1，Web冷入口回读6/4/4，责任分别3/1、对方实收均0；原生配额及提交后读回失败恢复、中印切换、清空、返回和空草稿核验通过。
- 上游完整功能相邻契约：`main-caa-full-function-contracts.log`，`check-prototype-full-function-browser-contracts.ts`退出0；5个明确浏览器契约文件及车缝实际PDA执行→交接列表→交接明细→实收预览→Web任务详情回放通过。该回放使用ID-F021现有车缝任务，不以无数据空列表通过；它不替代本目标全部三种车缝及旧路由归属审计。
- 旧版本的16工序契约、跨页和性能证据保留原版本身份。同步修改了入口与关联依赖，当前基准完整性能、下游及其余家族仍需后续验证，不把旧性能记录升级成当前全通过。
- 已请求在Codex侧栏打开本地中央新页面（工具返回queued）；可访问127.0.0.1:48339/fcs/pda/central/execute。它仍只证明当前C08业务实现；最终菜单替换、全部中央工序、三方完整边界、存量资料及全链路发布均未完成。

## 染色接收与分批加工阶段（caa7b286 + physical-stage工作差异）

本阶段推进C03及X03/X05/X06/X07/X08/X09，继承全部未完成项，不以局部通过代替完整两端拆分。新增染色页、事实适配、独立中印文案、共用设备会话和取消过期路由；共同记录的轻量冷读入口供染色/印花Web使用。正常接收保留上游、来源行、原卷、Yard和实际物位；加工按当前实际批次六节点执行，先前样衣/打样/排缸事实由既有Web命令在测试准备阶段办理，未在PDA读取时静默推进。

| 检查对象 | 本阶段实际结果 | 原始证据（output/playwright/pda-factory-split） |
|---|---|---|
| 面料原卷接收、分批/重扫/单位和责任 | 通过普通染色正常/阻断；12.5 Yard=11.43m | central-dye-receipt-contract-web-confirmed.log、central-dye-physical-resume-contract.log |
| 同单两卷与多单交替、库位/印尼语/返回续填、换人 | 通过；不同原卷不共用库位草稿 | central-dye-physical-resume-contract.log |
| 六加工步骤、二批次及开始/完成分人 | 通过现行节点前置、数量、历史及具名责任 | central-dye-processing-contract-ready-sample.log、central-dye-processing-physical-stage.log |
| 原生配额失败/提交后读回失败 | 原数量和输入保留，重读不重复扣料、不留隐藏已保存草稿 | central-dye-processing-physical-stage.log |
| 首次染色模块延迟加载时返回原工序 | 通过原页面实际接收及原生记录责任回读 | central-family-back-race-contract-native-readback.log |
| 旧C08页面及跨页冲突/同确认号 | 已重新回放，通过；不同交出人独立责任及Web回读仍保持 | central-page-contract-physical-stage.log、special-records-cross-tab-dye-bridge.log |
| 构建/直接入口/静态页面治理 | 1358项单测、构建、6个变化页面静态门禁通过；范围类型0错误 | central-dye-stage-physical-build.log、central-dye-stage-physical-governance.log、central-dye-physical-resume-typecheck.log |
| 染色7家族性能，各5样本 | 全通过，最高442ms，含可见图片/两帧及保存原生回读 | central-dye-production-performance-physical.log |
| 出卷/标签/运输/纱线交出、完整两仓和实收闭环、其他材料、其余中央工序、完整迁移/最终菜单/三方归属/发布 | 未完成，整体仍不通过 | requirements-plan-matrix.md完整矩阵及C03补充表 |

保留初次构建1356/1358（两项mock未支持新增冷读准备）、静态入口类型声明缺失、早期路由观察脚本失败和各次性能原始记录。原断言未删；调整测试依赖以覆盖真实新模块边界及精确读取顺序。最后仅声明静态页面类型的变化有发射JavaScript等价记录，但此后运行行为又有更新，因此以physical-stage新构建和新性能为准。

所有证据为本机隔离浏览器及现行静态/本地记录，不是测试站数据库写入或工厂现场验收。完整目标继续active，阶段代码未提交、未发布。

最终C08性能追加：`central-production-performance-physical.log`四家族5次通过（408/67/117/184ms最大），与本轮染色7家族分别保留，未覆盖全部中央模块。普通TRANSFER面料收卷案例不代表上游HANDOUT回写已完成；已补C03.22未完成项。实际页面证据按320×640浏览器回放，不宣称实拍PDA硬件现场验收。


## 普通染色产出卷、标签与交出（output-stage，完整目标继续active）

当前基准caa7b286及本任务未提交差异；参考V34发布与本业务实现分别记录。新增产出卷model/view/text/label，染色原单内切换加工/产出卷/实收；系统生成卷码，按原单位录数量及实称kg，原位维护缸号/尺寸。实际条码选择不伪造扫描；同厂多原单可合入草稿，各行保留加工单、产出SKU/图、原单位和实际去向。运输三字段同页填写，最后一次明确确认交出。当前Web规则不改为“库存重量可代替卷长”。

| 本阶段对象 | 当前实际结果 | 原始证据（output/playwright/pda-factory-split） |
|---|---|---|
| 普通出卷、编辑撤销打印、占用阻断、同确认号/原子失败 | 通过实际原生命令；10 Yard交出后余350、对方0 | central-dye-output-model-revision-contract.log、central-dye-output-guards-contract.log |
| 320×640印尼语多单/多卷续填、打印预览/取消/结果、错扫/重扫、运输与分批交出、清空/切语言/换人 | 当前最终源码回放通过；12.5 Yard、2.123kg；两卷分别保留输入 | central-dye-output-ui-contract-output-final.log、central-dye-output-readback-ui-contract-output-final.log |
| 创建人、扫码人、实际发方及独立接收 | admin建草稿，operator扫及交出；原生事实与实收页各自具名，收方未操作仍0 | central-dye-output-actor-ui-contract-output-final.log |
| 图像与可交状态 | 对应产出图失败阻断并可重读；已打印500 Yard而实物可交360 Yard时不显示发起交出，不误标可交 | central-dye-output-photo-status-contract-output-final.log |
| 保存过程中返回另一工序 | 两个方向都使用原账号保存，已返回页面不被旧回调覆盖或带入上一笔提示 | central-output-save-back-race-contract-output-final.log、central-special-save-back-race-native-record.log |
| 原染色六节点及二批次、实际故障恢复 | 当前源码重新回放通过，保留10投入/8包装、下一批2和历史1 | central-dye-processing-page-contract-output-final.log |
| C08原闭环与Web冷入口 | 再次实际接收6/加工4/交3；换人再交1；原生持久及Web页面明确显示6/4/4、两位发方3/1和对方0 | central-page-contract-output-native.log |
| 构建及范围检查 | 1358项单测、Vite构建通过；新中央及直接领域范围0类型错误，全量19项既有范围外错误保留；6个变化页面静态门禁通过 | central-dye-output-final-build.log、central-dye-output-final-current-typecheck.log、central-dye-output-final-static-governance.log |
| 最终生产预览性能 | 48340、320×640、Asia/Jakarta、各样本新上下文/空HTTP缓存，22家族各5次全≤1000ms；保存包含原生读回、图片和两帧 | output-final-performance-suite.log及下述三份原始采样 |

最终性能分组最大值（ms）：

- 新产出11家族：原单冷页471、产出切换233、出卷保存576、备交位置保存467、真实标签预览283、打印结果474、建交出单617、逐卷扫描627、最终交出750、实收切换167、语言167。`central-dye-output-production-performance-final.log`。
- 原染色7家族：接收冷页461、执行冷页449、仓管冷页422、语言117、接收保存464、加工保存466、实收切换158。`central-dye-production-performance-final-output.log`。
- C08四家族：接收冷页421、语言67、站内执行100、接收保存194。`central-special-production-performance-final-output.log`。

保存与打印测试在本机隔离浏览器办理，不是现场PDA硬件或物理打印验收。浏览器打印函数替身只用于验证调用及人工确认时点，真实Code128、图、单位与纸张布局由当前标签渲染；没有声称纸张已经实际打印。

保留早期反例及边界：旧染色dispatch脚本在本工作树和main fc3283f6都于旧接收调用被同一设计改款事务守卫拒绝，仍未通过；不放宽守卫、不删断言。延迟测试初版把回调送到失效事务外导致InvalidStateError，诊断版仅定位；最终在原生读请求事件内恢复并等待写事务complete。另一早期断言从所有记录误选幂等结果，已限定operationRecords。C08旧观察脚本直接导入另一个Vite模块实例，读到内存0而页面/持久记录为6；保留失败日志，最终改为原生同事务结果及实际Web可见6/4断言，未削弱原数量/责任断言。

49个运行/测试文件与1266个构建文件在最后浏览器与性能验证后校验保持相同。源码和资产冻结为`source-hashes-dye-output-stage.json`，追加记录后的清单为`source-hashes-dye-output-stage-final-record.json`；文档可以更新记录，但不将旧运行证据改标为其他代码。独立完整目标仍不通过：纱线、连续辅料及普通辅料完整分支、原design-revision/washing归属、两仓全查询、下游正向实收/人工完单、剩余中央工序、三方全部组合、旧路由与完整迁移、最终菜单、main交付和发布都未关闭。本阶段未提交main、未发布中间业务版。


## 纱线整单称重、累计标签与独立实收（yarn-stage）

继承完整拆分及C03，不把普通染色纱线闭环扩成全部中央工序或全部旧归属完成。新增dye-yarn-model/view，现行整单码YARN:染色单号不变；毛重和三管型是输入，未用管型无需填0，pcs/管重/净重自动汇总，毛重额度与净重库存各自校验。实际伙伴无拉丁名称时显示其真实业务代码（WOOL-OWN-001），不把内部厂标识当厂名；接收账号保留保存记录的实际登录标识。上下游责任和原单位不改变。

实际失败契约发现原ensureSeededHandoverRecord返回所有批次ID：第二笔新纱线来源此前仍关联首条，新增actor不能覆盖旧记录。当前按本次新增ID建立来源并登记当前操作人，Web与新PDA共用按真实交出时间/正式序号稳定排序的来源读取。不同原生ID顺序或同时间交出不改变历史累计版本。原错误历史未自动清理/重写，仍需C03.19迁移；本段不宣布其完成。

| 当前对象 | 结果 | 原始证据（output/playwright/pda-factory-split） |
|---|---|---|
| 两次15kg、各10宝塔管、每次净13.79kg；实际具名、独立记录、余量 | 通过；最终毛重/净重余量均0，原生写失败无半笔、同确认号无重复 | central-dye-yarn-model-contract-yarn-stage.log |
| 9.999/10/10.001kg阈值、三管重、0/非法管数/管重及可交净重边界、同时间版本顺序 | 通过，按现行克精度归零；原始浮点尾数不当作可交实物 | 同上；原模型versions日志保留浮点尾数反例 |
| 实际320×640印尼语多单称重、条码续填、视图往返、切语言、返回/退出换人、提交后回读恢复 | 通过；第一笔15.001kg净13.791、第二笔14.999kg净13.789；未用管型空白，自动筒数，字段与主按钮不遮挡 | central-dye-yarn-ui-contract-yarn-stage.log |
| 累计版本1/2及跨页新增后旧“最新累计”打印 | 历史1不被改写；另页新增1kg纸管1个后，旧最新标签不打印，更新到净14.728kg才允许调用打印 | central-dye-yarn-label-stale-contract.log |
| 收方独立确认、重复确认去重、原单与逐次实收查看、账号与中印/时间 | 通过既有Web命令办理12.79/13.79kg，分别回写001/002原记录；源发12:30/31，收12:40/41，Asia/Jakarta；PDA两视图读取同一真实单据账号和kg | central-dye-yarn-recipient-ui-contract-jakarta.log |
| 同步责任入口后面料相邻路径 | 两笔不同发方不互相覆盖、两单草稿/扫描/占用/作废、实际页面换人交出通过 | central-dye-output-guards-yarn-regression-yarn-stage.log、central-dye-output-actor-ui-contract-yarn-stage.log |
| 原染色六步骤、C08完整6/4/3与换人再交1、Web冷读6/4/4 | 当前回放通过，不用旧内存实例当持久结果 | central-dye-processing-page-contract-yarn-stage.log、central-page-contract-yarn-final.log |
| 构建/类型/静态治理 | 1359项单测和Vite通过；直接范围0类型错误，全量19项范围外错误保留；7个变化页静态门禁通过 | central-dye-yarn-recipient-build.log、central-dye-yarn-recipient-typecheck.log、central-dye-yarn-static-governance.log |
| 当前性能 | 本地48340、320×640、Asia/Jakarta、各新上下文/空HTTP缓存、可见控制/图片/两帧、写后原生读回；31家族各5次共155次全部≤1000ms | central-dye-yarn-production-performance-raf.log、yarn-adjacent-performance-suite.log |

9类纱线最大值ms：冷原单724、称重页378、自动计算435、语言334、保存566、标签预览486、打印调用/重读381、历史版本299、实收视图200。相邻面料11类最大818、原染色7类最大946、C08四类最大895。均为本机样本，不是现场PDA/网络/打印机验收。

保留首轮cold1072/1096ms失败及完整profile。profile的按钮在427～624ms出现、图片请求约6～12ms，页面可见且有焦点，但selector等待返回1007～1104ms；依据该证据把同一可见控制的观察改为帧轮询，图片、两帧、样本数及1000ms标准保留。没有调低门槛、丢弃旧样本或反复采样直到“看起来快”。首轮实收ISO时间格式被原Web严格回写拒绝；改用现行本地时间字符串。默认非印尼时区的初次UI观察单独保留，最终显式Asia/Jakarta并核对发/收先后。新页面使用localDateTimeText，语言切换不重置业务时间。

本阶段运行/测试52个文件及1266个构建资产在冻结后保持相同；source-hashes-dye-yarn-stage.json与追加本记录的source-hashes-dye-yarn-stage-final-record.json绑定版本。任务源码归档可在基准caa7b286上恢复，不把旧截图固定文件名的最新覆盖结果称作旧阶段原始图；本轮最后C08截图单独保存在yarn-stage-final-evidence目录。

整体仍实施中、不通过。普通纱线的现有Web接收命令和新染色PDA查看闭环已核查，不代表新毛织PDA接收已实现。染色其他材料、完整两仓、人工完单、水溶及其余中央工序、原owner/错误历史迁移、三方全部组合、旧路由和最终菜单仍未关闭；旧dispatch验收脚本基线失败保留。未合并main、未发布中间业务版，完整目标继续active。

### 继续进展：染色人工完单及普通染色两仓

完整目标仍active。当前基准caa7b286，main仍fc3283f6；本阶段没有合并、推送或发布中间业务版。C03.21已在普通染色纱线场景跑通具名人工完单，新PDA与Web共用逐笔独立实收及所有PACK批次产出条件。普通两仓读取相同实际库存源和物位；不同材料/旧owner完整覆盖仍未关闭。

| 核查 | 当前结果 | output/playwright/pda-factory-split证据 |
|---|---|---|
| 无交出、只收一笔、第二笔未收、完整实收、异厂/旧页、空间失败、重试 | 通过；2×13.79kg完整实收后才可完单，同号无重复，具名operator完单，Web已完成 | central-dye-completion-contract.log |
| 实际UI取消、实收视图直接完单、写失败、已提交回读失败、恢复/冷读 | 通过；单一最终确认及单一底部恢复按钮，原生主单COMPLETED/实际账号/时间 | central-dye-completion-ui-contract-final.log、central-dye-completion-visual-contract.log |
| 少收与0产出 | 通过；26.58/27.58kg无完单入口，0产出不可完单 | central-dye-completion-short-contract.log |
| 原卷/两物位、两批投入12m与包装10m、原单位扣用 | 通过普通面料：余量按实际卷/位置，Yard与m各自显示，无虚构产出库位 | central-dye-warehouse-small-screen-contract.log、central-dye-warehouse-actual-stock-visual-contract.log |
| 来料编号正反顺序诊断 | 实际用料对应卷改变，源记录余量保持相符；未擅自改成FIFO | central-dye-warehouse-cache-diagnostic.log、central-dye-warehouse-cache-reversed-diagnostic.log |
| 320×640、印尼语、选库位后数量可见、真实照片 | 页签无孤字，选位后余量可见，切语言保留位置，图片放大/Esc和原单钻取通过 | completion-warehouse-stage-evidence/*small-screen.png；central-dye-warehouse-small-screen-contract.log |
| 当前构建/类型/静态治理 | 1359/1359单测+Vite通过；直接范围0错误、全量19既有问题保留；7变动页通过 | central-dye-completion-warehouse-small-screen-build.log / -typecheck.log / -governance.log |
| 当前性能 | 15家族各5次，75次全部≤1000ms；最大721ms | central-dye-completion-warehouse-performance-small-screen.log |

性能终点含实际可见控制、必要图片/两帧绘制；保存、取消含原生持久回读。环境：本地生产预览48340、320×640、Asia/Jakarta、暖浏览器进程，各空HTTP上下文；数据库为隔离的真实命令结果复制夹具。完整原始数值、脚本、早期失败和诊断均保留；不是实机或用户接受。

早期取消性能脚本误选历史/派生状态，随机来料顺序脚本误把第一卷当成必选卷，修正观察条件但不变数量、单位与位置校验。热更新多实例风险通过冻结/重启本任务开发服务隔离；没有因此随意修改共享库存。保留一个未单独确认根因的早期投影差异日志，继续在C03.19旧owner/迁移中覆盖。旧版本源按事先冻结SHA验证可恢复，dye-completion-warehouse-before-small-screen-sources.tar.gz保存59个精确源文件；当前阶段绑定source-hashes-dye-completion-warehouse-small-screen-stage.json，最终记录另绑定final-record清单，不改旧证据版本。

主代理已核对本阶段字段、公式、入口、具名责任和最终直接差异：没有新增代确认、原因面板、权限提示或其他工序操作。普通实收完单和本轮两仓技术证据不替代其他材料、混合owner、历史错误关联迁移、水溶、其余中央工序、三方全部组合、旧路由及最终菜单的验收。整体仍实施中，不生成宣称完整交付的最终收据；完整任务关闭前按RECEIPT-01执行。


## C03.45～49 同厂前置水溶（water-stage）

本阶段继承完整 PDA 拆分，不代替 C06 独立水溶。实现与当前 Web 源事实见 `docs/product-design/pda-factory-split/dye-water-source-audit.md`。基准仍为 caa7b286；本地 main fc3283f6 新增的 8 个成衣出库文件不涉及染色/水溶直接代码，本阶段未混入该差异，最终整合仍须复核。

### 水溶阶段负责文件

- `src/pages/central-pda/dye-water-model.ts`
- `src/pages/central-pda/dye-water-view.ts`
- `src/pages/central-pda/dye-page.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `tests/unit/central-pda-dye-water-input.test.ts`

### 实现、业务与责任审查

前置水溶在原单加工区只显示当前动作，不增加中间交出。开始沿用实收/样衣/投入确认/排缸条件，本批实际投入由原账推导；完成填写本批累计，保留原单位、累计下限、本批投入上限及现行条件触发的本批说明。补做保留完成数，按实际转染色限制后续投入，返工明确全单水溶完成数清零的后果。三个决定只设一次最终确认，取消无写。

新页面不修改旧角色会话、不加岗位选择或权限提示；使用真实账号与工厂记录开始/完成/决定。共享记录保留两端交替操作的原开始人与完成人，暂停决定记录修改前节点及实际数量，不伪造历史缺失的 UID。未保存输入按实际账号/工厂/单/批/阶段留在内存；原单往返和中印切换保留值，清空/退出统一删除。已经提交但回读失败只取回原操作结果，锁定清空与改写，只有一个恢复主按钮；保存错误提示滚到内容区可见位置，没有改变原子事务规则。

### 页面、原生记录与相邻验证

| 对象 | 结论 | 当前直接证据 |
|---|---|---|
| 10米实收、本批累计、暂停/补做及合法上限 | 通过 | central-dye-water-model-contract-v3-water-final.log；输入3单测；异厂、11>10、无必需说明、8.5<8.6阻断，保存失败恢复；没有绕过现Web校验 |
| 小屏连续作业和交出 | 通过 | central-dye-water-recovery-visible-ui-contract.log：320×640/Asia-Jakarta；8.6→9→返工→换人9.5；六节点后真实逐卷打印结果/扫码/运输交出9.5，收方未操作仍0；Web execution冷入口读9.5 |
| 保存已提交、回读失败 | 通过 | 同上及water-stage-evidence/readback-recovery-visible-id.png；只一个重新读取，原输入/清空不可改，恢复无第二笔；提示/底栏可见 |
| Web与中央换人责任 | 通过 | central-dye-water-cross-surface-contract.log：中央admin开始→Web operator完成，Web operator开始→中央admin完成；两个决定各一条、前次完成人快照保留 |
| 同阶段冲突 | 通过 | central-dye-water-same-phase-conflict-contract.log：水溶中新增接收、阶段均COMPLETE但修订不同；旧页拒绝且无半笔，读新修订后保存8m |
| 两批、两张来源及实际余量 | 通过 | optional-batch-ui-contract.log：旧可染3、新实收10为Lot2；先染旧3后新水溶7，余量7。multiple-sources-contract.log：两张同上游来源，领用5+3+2及另5分属两个接收，不超各自实收；累计水溶15、染色/包装15，原未耗5 |
| 印尼语、历史与真实图 | 通过 | history-production-performance.log：历史三次决定、开始/完成人及9.5/9/8.6m无中印混排；white-water-soluble-lace-12-15mm.jpg对应物料可放大/Esc关闭；water-stage-evidence/history-id.png、next-water-batch-id.png |
| 普通染色/共享恢复提示相邻路径 | 通过 | central-dye-processing-page-contract-water-final.log：六节点、配额/提交后读回、返回续填；输入367～425px、底钮572～628px。central-dye-output-readback-ui-contract-water-final.log：两实物卷草稿独立、提交后回读不重复 |
| 构建/类型 | 通过 | central-dye-water-visible-final-build.log：1362单测通过、Vite23.51s；central-dye-water-visible-typecheck.log范围0、全量19项范围外既有错误；git diff --check通过 |

### 性能结论（本阶段通过）

本地生产预览127.0.0.1:48340，构建central-dye-water-visible-final-build；Chrome、320×640、Asia/Jakarta。浏览器进程热态，各冷页面样本使用新上下文/空HTTP缓存，明确不是浏览器进程冷启动。实际造数保留原4368m计划、对应上游/图片，来源20m、实收10m或10+10m；受测输入167/188记录，三决定历史177记录。真实事件起点至数量/状态/必要图片可用和两帧绘制，保存另读原生canonical原单；不把历史快照当当前事实。

| 原始日志 | 家族/样本 | 最大值 | 结论 |
|---|---|---|---|
| central-dye-water-production-performance-ready.log | 21/105 | 892ms | 通过 |
| central-dye-water-recovery-production-performance.log | 7/35 | 831ms | 通过 |
| central-dye-water-next-batch-production-performance.log | 7/35 | 816ms | 通过 |
| central-dye-water-history-production-performance.log | 2/10 | 67ms | 通过 |

合计37家族185样本全部≤1000ms，不使用平均数隐藏慢值。保存、取消、失败、回读取回、冷入口、语言、清空、退出/下一人登录、新增批切换分别计量；历史展开/收起单独计量。初始collector误要求首次渲染必须有aria-busy=false，而初始无该属性；该次没有取得有效终点、没有样本，不算慢业务样本。修改为实际“非busy”并保持所有图片/原生回读/绘制条件后重测，原日志保留。早期Web默认base视图没有9.5而超时，修正为代码真实execution视图，不因该采集问题修改业务。

### 冻结及未完成范围

主代理已审查本阶段实际函数/模板/事件差异、上游/下游、原始数量和责任，不增加通用数量不符/权限面板，不伪造角色或中间交出。58个运行/测试文件及1265构建文件绑定source-hashes-dye-water-runtime-stage.json，后续文档另绑定final-record清单及源归档。前置水溶本轮技术验证不替代独立水溶、其他材料/旧owner/上游HANDOUT回写、全部中央工序、三方组合、旧入口迁移和最终菜单。完整目标仍实施中，整体结论仍不通过；本阶段没有合并main或发布业务中间版。最终完整交付前按RECEIPT-01生成技术收据，不用本阶段记录冒称整体收据。

阶段列表静态治理通过（worktree，7页）。完整prototype治理未通过：先修正本次追加的重复小节名，随后检查器拒绝基础阶段保留的“npm run build：失败”等历史未完成命令；原失败与结构修正后日志均保留。本文是明确未关闭的阶段历史，不将旧命令改成当前通过或放宽检查器。完整目标结束时须按有效源/资产证据整理独立终审及历史归档，再运行全任务治理与最终收据；本阶段的单元/构建/功能/性能技术结果不冒称全任务治理已通过。

独立C06已另行审查源码及只读基线，7个当前记录均为米（待分配/加工中/暂停及4个产出单），只读期间无localStorage写入；其完成规则不同于前置水溶，且有独立旧账和独立正式交出/对方实收。细化到C06.02～14，均保持待实施，未启动新独立页面保存或旧账迁移。


## C06.02～04 独立水溶保存基座（实施中）

本阶段在前置水溶water-stage冻结之后继续，旧58运行文件/1265资产/185样本保留其原版本身份。实际新改动为water-soluble-task-domain、central-execution-record-bridge、fabric-washing-storage-bridge、special-craft-records及2项ledger身份单测；不启用尚未实现的新独立水溶界面。

隔离失败契约standalone-water-persistence-gap-contract.log确认：共同命令提交虽成功，水溶却写到旧localStorage六单；当原生事务中止，原卷80仍变70。修复后通过现有门面和共同记录桥接入水溶单独键，原洗水四键未扩大；水溶缓存参与失败回滚/冷回读，根orders采用原waterOrderId作为稳定身份。事务前以当前静态/旧账比较基线，六张静态演示不整包落盘，实际只保存变更的原单。

standalone-water-persistence-first-fix-contract.log：成功数量70、1条水溶+1条命令，旧key未写；原生事务中止数量80、0条水溶/命令、旧key未写。standalone-water-persistence-cold-replay-contract.log：新JS上下文读70，采用后旧直接改写60被拒，重试原操作不执行recipe/不重复日志（4保持4），原单仍1条；旧key为空。以上是原生浏览器命令验证，没有真实工厂写入。

c06-storage-first-build.log全量1364单测与Vite25.55s通过；c06-storage-first-scope.log直接4文件类型0错误、全量19项范围外既有错误。由于改变共同保存调用方，本阶段追加重新验证前置水溶37家族及C08相邻操作，原始日志以-c06-adjacent另存，未将旧185样本改标新版本。全部结果尚须绑定当前源及资产；不以构建代替独立水溶新UI的功能和性能。

尚未完成：旧记录显式迁移/退出、Web/旧PDA所有消费者的共同保存接入、真实账号字段、新独立接收/执行/仓管、交出/分批实收/完单及新UI性能。C06.02～04保持实施中，C06其他条目待实施；整体治理、最终收据、其余工序、最终菜单、main和发布仍未关闭。


C06保存基座追加结果：standalone-water-legacy-readback-canonical-contract-c06-adjacent.log验证旧源6单/75米保持原字节，提交70后原生complete再注入读取失败，恢复与同号重试仅保留1条水溶记录、日志4→5，新JS上下文70。早期collector未命中第二次读，以及把准备阶段缓存日志数当原生旧日志数的诊断保留；修正采集依据为原生complete和保留的旧字节，没有修改业务或弱化数量断言。

相邻回归：central-dye-processing-page-contract-c06-adjacent.log六节点、两批量及配额/提交后读回/返回草稿通过；central-special-cache-safety-c06-adjacent.log的16类实际工序全部通过接收/加工/完工/剩余交出，原件/片/米/条/张/个单位及独立收方0保留。本轮复用了历史cache-safety日志内保存的完整隔离脚本并单列新脚本，未把缺失的旧脚本文件当作已执行。

| C06共同保存后的相邻原始性能日志 | 家族/样本 | 最大值 | 结论 |
|---|---|---|---|
| central-dye-water-production-performance-ready-c06-adjacent.log | 21/105 | 810ms | 通过 |
| central-dye-water-recovery-production-performance-c06-adjacent.log | 7/35 | 618ms | 通过 |
| central-dye-water-next-batch-production-performance-c06-adjacent.log | 7/35 | 745ms | 通过 |
| central-dye-water-history-production-performance-c06-adjacent.log | 2/10 | 67ms | 通过 |
| central-special-production-performance-c06-labelled.log | 4/20 | 349ms | 通过 |

合计41家族205样本均≤1000ms，最大810ms；环境沿实际本地生产预览48340/c06-storage-first-build、320×640/Asia-Jakarta，每次冷页面新HTTP上下文、实际照片/交互、两帧绘制，保存包含原生回读。C08首次复用的脚本仍写旧build标签，原日志保留；仅修正collector标签并另采4家族20样本，正式结果使用-labelled日志，未改旧原始值。此为共同保存的相邻证据，不代替尚未实现的独立水溶新UI性能。

CodeGraph显式sync119变化文件（44新增/72修改/3移除），8.7s完成，MCP状态4409文件且可查询新getWashingLedgerSnapshot；没有把同步前旧签名当成当前新增接口。当前60个运行/测试文件及1265资产绑定source-hashes-c06-storage-runtime-stage.json；最终文档清单与归档另存。C06整体和完整PDA拆分仍实施中，未合并、未发布、未生成完整任务通过收据。

## C06 原 Web 保存消费者及共同记录行级回读阶段

范围承接 C06.02～04，关联 C03.50；整个中央/三方拆分继续实施，C06新独立页面、显式旧源迁移、其余工序及最终菜单/交付仍未完成。本阶段未合并main或发布中间业务版本。

新增实际水溶身份/共同命令，原Web分厂、加工/暂停、卷码/打印、合单/扫卷/运输/交出/作废，以及旧PDA动作和创建交出头改为等待共同保存完成。异步之前捕获实际输入和页面/弹层，控制在途重复提交，失败保留字段和确认号，离开或重新打开不把旧结果写到新弹层。旧Web/旧PDA角色规则不变，没有通过改全局账号来调用中央动作。

主代理审查相邻染色Web后补齐已采用原单内部交出单/记录身份，不能把工厂名、人员名或别单引用当作所有权。首次基线为空会把静态初始化算作修改的缺陷，通过共用序列化、先初始化只读基线再捕获回滚修复；行级回读沿合法原任务/节点及完整空集合，原身份/工厂/单位/来源校验仍保留。早期109行、仅序列化仍108行、未完整上下文导致CHANGED/前置未回读的失败日志均保留，没有把它们改成通过。

### C06 消费者阶段的当前业务证据

- `c06-web-consumers-row-overlay.log`：分厂、1000米正常分批完成、卷65米；配额失败保留选择/填写与旧事实，冷读/旧标签内容变化阻断通过。
- `c06-water-dispatch-final-current-time.log`：实际Web两单合交120/90米、各自下游CUTTING-PO-202603-081/087、余量120/90、发方交出时收方均0；原交接入口由Dewi独立确认第一单120，第二单仍0。错/重复卷码、三运输项、取消无写、冷读通过。早期固定16:00收货在现场时钟越过后被合法拦住，collector改用同浏览器当前本地时间，未放宽时间校验。
- `c06-dye-web-dispatch-row-overlay.log`：首次卷到Web正式交出保留12.5 Yard，实际染色5行全部属于本原单；没有整批保存未改演示。
- `c06-dye-processing-row-overlay.log`：320×640投10/出8、下一批再投2、余量12.86→10.86 m；加工/实收返回续填、配额失败及提交后读回恢复通过，输入/底部按钮无重叠。
- `c06-special-cache-row-overlay.log`：当前16单工序原生接收/加工/完工/剩余交出，各原输入/输出单位保留。
- `c06-water-storage-row-overlay.log`：水溶正常80→70仅1原单+1命令；原生中止仍80且零业务行/命令，旧localStorage未写。
- `c06-row-overlay-final-build.log`：1369单测通过、Vite29.00s成功；`c06-row-overlay-unit.log`的7专项通过；`c06-row-overlay-final-typecheck.log`直接11文件0错误，全量19项范围外错误未隐去。

### C06 消费者阶段的性能结论：不通过

冻结源码/资产见 `source-hashes-c06-row-overlay-runtime.json`（69个运行/测试/脚本文件、1272资产），本阶段按当前生产预览48340重新采样，不改标旧205样本。

| 当前日志 | 家族/样本 | 最大值 | 结论 |
|---|---|---|---|
| c06-web-production-performance-frozen.log | 7/35 | 916ms | 通过 |
| central-dye-water-performance-row-overlay.log | 21/105 | 874ms | 通过 |
| central-dye-water-recovery-row-overlay.log | 7/35 | 867ms | 通过 |
| central-dye-water-next-batch-row-overlay.log | 7/35 | 1054ms | 不通过 |
| central-dye-water-history-row-overlay.log | 2/10 | 68ms | 通过 |
| central-special-performance-row-overlay.log | 4/20 | 409ms | 通过 |

合计48家族240样本，`coldOptionalWaterDye`第2/3样本1054/1008ms超出原1000ms门槛；47家族通过，不能以238个样本或平均数宣称整体通过。Web采样1366×768，其余320×640；Asia/Jakarta，每轮新浏览器上下文/空HTTP缓存；页面实际输入/状态/照片、原生保存回读和两帧绘制作为终点。`c06-row-overlay-performance-summary.json`保留全部统计。后续`c06-cold-page-cpu-profile.log`仅为一次含CPU采样开销的诊断（823ms），不替代原失败样本，也不证明已优化通过；目前没有据此盲加缓存或改阈值，冷入口性能继续处理。

### C06 消费者阶段的工具边界和交付状态

Node旧页面checker的首次PFOS渲染缺原生IndexedDB，在干净main fc3283f6同断言复现，保留main-fc3283f6-water-pages-baseline.log；仅把同步事件调用改成await，未删/弱化原断言。列表静态治理在管理列表/旧角色卡片双入口的water-soluble-orders.ts判定失败，c06-web-list-governance-corrected.log保留；完整旧历史审查治理仍未关闭。完整收据未生成，整体结论仍不通过。

CodeGraph sync15变化文件（新增3/修改12）并MCP确认currentDyeExecutionSnapshot新符号。冻结后源/资产复核无变化；主main和最初4832工作树仍干净。运行及最终文档/原始证据另行归档，不能用本阶段功能通过冒充全目标或实际工厂验收。


## C06 新中央独立水溶页面阶段（整体任务仍未通过）

本阶段新增独立水溶接收、加工/暂停处理、卷标签、合单/逐卷扫码、运输交出、实收、本批/整单查看、实际完单及两仓只读入口。实际工厂/账号及原水溶数量规则保留；中央新界面没有接单/竞价/商业开工，没有角色限制说明卡，也没有新增通用数量不符/提前结束解释页。原Web/旧PDA使用原会话，新中央记录实际操作UID且不改旧全局登录。实现、数据边界、正常/边界证据及未完成项详见 standalone-water-source-audit 新中央页面阶段。

固定版本：HEAD caa7b286bde449c12f226c7434072b1fe8f7221c 加当前任务差异，分支 codex/pda-factory-split，工作树 publish-newpda-v34/higoods。源/资产清单 `source-hashes-c06-central-water-ui-runtime.json` 绑定77运行/测试/脚本文件、1274构建资源。构建 `c06-central-water-ui-build.log` 1374项单测通过、Vite25.02秒；当前范围类型错误0，范围外既有19项未消除；git diff --check通过。CodeGraph sync16变化文件（新增7、修改9）。

固定生产预览48340、320×640、Asia/Jakarta、暖浏览器进程且每次新上下文/空HTTP缓存。受控来源10米（原仓元信息取当前WH-JKT-01），分次4.125+5.875、投入10、累计完成8.5、逐卷/扫码/交出，米的数量语义不变。标签用真实Code128及对应花边图；隔离调用中拦截浏览器print，不表示物理打印成功。每次保存均等实际IndexedDB记录可读，终点包括页面/所需图片就绪和两帧绘制。

`c06-central-water-ui-performance.log` / summary.json 正式22家族110样本全部<=1000ms：冷接收515、选库位后语言255、分次接收386、最后一笔306、热订单213、实际投入234、数量阻断50、返回续填112、累计完成367、新卷表单117、卷保存及标签284、发起打印52、打印结果登记200、建交出单316、错扫335、卷扫描233、配额失败235、原确认号重试交出651、实收查看166、本批切换84、无草稿退出84、下一员工登录120（以上为ms最大值）。页面错误0。最初校准登录终点只等待始终存在的导航，误判账号尚未变更；修正为等实际账号后重新校准，原失败保留；正式采样没有替换慢值或降低门槛。

直接相邻回归：`c06-central-water-ui-dye-dispatch-regression.log` 原12.5Yard、扫码/运输/交出保留、只存5条本单变化；`c06-central-water-ui-dye-processing-regression.log` 投10/出8及第二次投2、余12.86→10.86m、失败保留/提交后回读恢复、320×640输入和底部按钮可见；`c06-central-water-ui-special-regression.log` 16当前辅助/特种/盘扣/花朵单工序各保留本来片/件/米/张/个/条单位及1条剩余、对方未实收。上述为相邻业务回归，不冒称覆盖全部工序或全部性能。

当前22家族通过不覆盖全部水溶分支。显式旧源迁移、旧卷/已交历史下返工、多窗口合单占用及恢复、全部仓储来源/分配投影、暂停/完单等剩余动作家族性能仍待验证；原Web列表治理失败及C03.49冷加载1054/1008ms有效失败仍未关闭。完整中央/三方拆分、其余工序和最终菜单尚未完成，不生成整体通过收据、不合并、不发布本阶段半成品。既有公开V34设计稿未被改变，测试站数据库和用户浏览器资料均未触及。


### C06.15 后续补充：多窗口同一卷占用修复

实际原生失败 `c06-water-multitab-reservation-one-gate.log`：两个草稿同时持久占用同一DEMO2-R1。修复增加每个实际参与水溶原单的轻量命令版本集合，与原业务/命令同一PCS事务保存，不复制实物数量或原单快照。`c06-water-multitab-reservation-guarded.log` 首笔成功、另一笔版本冲突，只有1份占用；`c06-water-multitab-ui-guard-reload.log` 真实双页面扫码、失败留卷码/印尼语冲突提示、重新读取后留输入及阻断已占用卷，均通过。完整来源范围单测新增1条，guarded-build共1375项全通过。

最终仅修正两处冲突文案匹配的范围内界面后，`c06-central-water-guarded-assets-build.log` Vite25.76秒；对应业务/测试字节未变，继承1375单测结果并用真实双页面确认文案。当前类型检查范围0、全量既有19项未变。当前冻结清单 source-hashes-c06-central-water-guarded-runtime.json，77运行文件/1274资源；运行源码归档501291字节，SHA256 236ffbaba5ee3f7d33e9468abfc866776696bf6aedc7f9507532aad35c6a283c。

当前同样22家族110样本全部≤1000ms，最大978ms（冷接收），其余各家族≤392ms，错误0。保留初版110样本和651ms初版最大值及所有collector失败，未覆盖原记录或挑选快值。当前22家族仍不包含单独并发冲突/恢复五样本、全部暂停/完单/仓管及迁移；C06.15已实现待验证，完整任务不通过。仓管交出记录的空摘要/嵌套详情选择器已列入下一轮具体整改；C03.49有效超限依然未关闭。


修复后直接回归追加：`c06-central-water-output-guarded-contract.log` 不同创建/扫码/交出人、对方仅第一单60米实收、旧会话不变、原生配额回滚、作废释放均通过；同一操作号再次确认没有推进任何命令版本标记，仅3张实际变化原单落账。`c06-central-water-guarded-special-regression.log` 16实际单工序、`c06-central-water-guarded-dye-dispatch.log` 12.5Yard与5条变化记录、`c06-central-water-guarded-dye-processing.log` 分批/余量/输入和主按钮/失败恢复均通过。当前main仍fc3283f6286e943e66d2b0c7f91cab88571b85ae，本次核对的水溶/接收/交接直接来源相对本任务基准无新增主分支差异。


### C06.16 仓管 / C06.17 连续按键与提示 / S03.01 惰性入口（局部实施补充）

本轮受管及直接相关文件：

- `src/pages/central-pda/entry.ts`
- `src/pages/central-pda/water-page.ts`
- `src/pages/central-pda/water-warehouse-model.ts`
- `src/pages/central-pda/water-warehouse-view.ts`
- `tests/unit/central-pda-water-warehouse.test.ts`

仓管改为真实只读库区/库位、逐笔接收记录及逐行交出记录。原公共来料10米分配4/6后，一单投入4、另收3，库存分别为原库位3米和另一单6米；不把公共10米重复计库存。15次1米分批收货保留15条原记录，按同实物维度汇总15米；17条记录15→17续看无重复/漏行。真实停止库位仍能查历史库存，未将内存registry配置冒称刷新后持久；没有产出物位的实际卷显示“未记录库位”，不编造A01。真实交出120/90米保留各原单/下游，独立收方只第一行实收30米；仓管只读不提供加工/接收/交出写按钮。返回库位视图保留同仓选择，切仓/换账号仍清掉。

功能证据 `c06-water-warehouse-partial-stock-and-records.log`、照片 `c06-water-warehouse-position-320.png`：320×640中印语言，页面宽320、滚动宽320，无页面错误。照片使用对应花边实图，实际放大/Esc关闭由后续生产预览同一图片路径验证；不冒称实拍PDA硬件测试。14条水溶仓管/数量/身份专项通过，21条入口/框架/仓管专项通过。当前类型范围0错误，全量19项既有范围外错误保留。

`c06-water-keyboard-ime-gap.log` 的输入法确认误交120米已修复并在 `c06-water-keyboard-context-final.log` 重放通过。F1聚焦当前卷码且大图内不改底层任务，运输Enter逐项前进、车牌Enter聚焦底部按钮，实际对按钮Enter才交出；不加重复确认。`c06-water-feedback-residual.log` 验证下一笔清旧提示、纠正错码清旧错误、真实提交中显示当前保存状态。`c06-water-committed-readback-recovery-current.log` 验证原生提交完成后回读失败、原卷码锁定保留、切语言不解锁、重新读取同操作号后仍只有1条扫描及原guard版本2。它们是隔离浏览器真实域/原生数据库证据，不是物理交出或收货。

当前源码/资产冻结 `source-hashes-c06-central-lazy-entry-runtime.json`（80文件、1276资源）、归档 `c06-central-lazy-entry-runtime.tar.gz`（504443字节，SHA256 2ab79ee984d1edb0da3a289a8277b9f7f3f3df117de5904000792a99dfe09cf0），Vite构建23.99秒。公共入口只改三个业务页面加载时机、保留现有序列/当前路由保护和事件分派；当前三工序冷页/按键正式补验后另行登记。主线1375单测仍保留其guarded版本身份，不将本轮21+14专项写成全量重跑。

性能首轮保守CLI冷仓管5样本1152/742/779/1188/635ms，惰性入口后1088/571/1193/748/781ms；有效观测完整保留，没有挑快值。两批11个站内家族各5样本全部≤509ms。页面CPU诊断没有证明唯一慢函数，未新增缓存。追加浏览器导航至真实库位/必需图片及两帧绘制时间，同时保留CLI观测；同次第5样本浏览器624.7000000476837ms、CLI1142ms，证明该次有工具观测延迟。`c06-water-warehouse-browser-paint-diagnostic.log` 的实际绘制五样本最大705ms，站内55样本最大504ms；不把这一证据反推C03.49旧版本已通过。冷样本口径、环境、完整值及变化原因详见standalone-water-source-audit，最终正式状态待本轮范围治理及三工序入口复核后登记。

已公开V34参考 `public/newpda/index.html` 及water-binding-flow.js与HTTPS显式文件字节一致；目录 `/newpda/` 当前回落主SPA。仅记录具体发布入口问题，未发布本业务中间版本、未改用户浏览器资料或测试站数据库。整体结论仍不通过；旧资料迁移、其他水溶边界、其他中央工序、三方全范围与最终菜单/发布继续按完整矩阵推进。


### C06.18/19：继续加工的既交数量与卷长输入守恒

当前实际域错误经原生记录重现：已有完成1034、交出/独立实收100，暂停后继续将handed清零，可交从934误增1034。已仅调整继续加工分支保留已有handed；原未交三种决定保持原语义。2条最小契约先1失败/1通过，修复后连同直接数量/身份/仓管共16项通过；原生重放与独立新页面冷读都保留1034/100/100/934及原交接。不会由该修复追认已交后RETURN_FOR_REWORK安全，该边界仍未关闭。

新卷或改卷立即沿原卷合计上限给出当前语言阻断，不增加上限/单位换算，保存端仍完整校验。已交卷不再次占用可分卷量、编辑当前卷排除其旧量；两个原80米卷的80.01阻断/80恢复/语言/退出无假草稿通过。原脚本等待此前不存在的即时提示而timeout，未实际发生超额保存，失败日志保留。

当前构建 `c06-water-remaining-guard-assets-build.log` Vite23.18秒；81运行/测试文件、1276资源绑定source-hashes-c06-water-remaining-guard-runtime.json；运行源码归档505074字节，SHA256 cdbea59cad3187c30af2ffe70661d61a7ddd0ff777f73d7f5a5ac7d8da4ed6f9。`c06-water-pause-continuation-remaining-performance.log` / summary：7家族35样本全部≤335ms，当前余量934.01被阻断、934米原卷/标签/正式交出及历史实收100/新934待收保持，页面错误0。此前仓管/键盘/加载证据保持其惰性入口原版本；本轮只移动继续分支的handed赋值和卷表单限量，不据此改写此前冷/热资源哈希。未受影响的物位查询、角色/语言及共享命令接口可沿EVIDENCE-01复用已列原始证据，不称重新执行全套。

范围治理实际执行两次，首次指出漏列文件已补，第二次仍拒绝原基础记录中保留的npm run build失败及完整目标未完成项。保留该工具未通过状态，不删除失败、不放宽检查器。当前局部仍是已实现待验证，完整目标未完成、未合并main、未发布业务中间版。当前main仍fc3283f6286e943e66d2b0c7f91cab88571b85ae，水溶/接收/交接直接来源相对本分支基准未新增差异。


C06.19追加当前正式性能 `c06-water-roll-edit-remaining-performance.log` / summary：原两卷80/80米，改第一卷80.01立即阻断、无效Enter原生记录不变、切语言保持上限、恢复80可保存且退出无空草稿，5家族25样本均≤167ms，页面错误0。与C06.18七家族35样本合计12家族60样本，实际分批/既有卷/独立实收事实均保留；不替代其余工序或完整迁移验证。


## C04 印花接入进行中（2026-10-20）

继承整任务初始失败及当前“不通过”结论，不把局部原生成功当作完整目标通过。源审查与原子状态见printing-source-audit与requirements-plan-matrix的C04.01～12。新接收/加工及当前只读实收/仓位已接代码，正在实际320px中印连续作业验证；尚未接完标签、正式交出/洗水/完单和Web共用命令，尚未本轮生产构建与性能验证，不声称已发布。

普通印花原生直接依赖/失败/重试/冷页证据c04-print-production-direct-references.log；共享存储基线调整的染色、水溶、辅助特种相邻回归证据均见源审查。旧脚本缺少完整SKU、旧错扫错误翻译等失败均按原身份保留。当前最终全任务收据、最终完整diff审查与用户接受仍待完成。


### C04 当前接收/加工技术验证补记

完整npm run build已通过（c04-print-current-build.log，1388单元全通过，Vite28.83秒）。此前1387中设计改款印花完单失败已保留，不以删断言或放宽同步规则处理；显式刷新交出头缓存并保留真实单原同步后，完单专项及16条直接持久行同时通过。完整源码审查范围见printing-source-audit，不冒称印花交出、洗水、标签与完单PDA已经接完。

c04-print-ui-continuity-current.log、c04-print-ui-recovery-current.log、c04-print-web-stale-action-current.log覆盖本阶段320小屏、真实账号/多原卷/中印数字、失败和提交后回读故障恢复、旧按钮不自动代确认下一工序。原采集过早或枚举顺序假设失败亦保留；这些脚本问题未通过改生产校验掩盖。生产构建五轮响应测量另记；整任务最终结论仍沿未完成，不更改为整体通过。


### C04 定向详情读取版本

当前单据读取调用既有原生getPrintingWorkOrderById，未再每次推导整厂29单。29真实单与全量投影、各物理来料逐一相等及工厂边界通过；全部页面/失败恢复/旧按钮/原生16条写入重放见printing-source-audit的scoped-read证据。当前完整npm run build（c04-print-scoped-read-build.log）1390项全通过，Vite23.11秒。辅助特种/染色/水溶实际入口导航保留账号/工厂通过。首轮错误计时及正确事件计时中发现的真实超1000ms样本均未删，不冒称它们已通过；当前优化版本五轮测量另记。

全范围tsc仍19项既存范围外错误；c04-print-core-governance.log仍因本整任务记录保留初始npm run build失败而不通过。当前追加构建结果不删除历史失败或未执行项，也不能替代剩余模块、迁移、最终整体审查和发布。本阶段不运行整任务完成收据，不将局部PDA功能当作完整拆分交付。


C04当前定向详情生产构建五轮响应通过：见c04-print-production-scoped-read-performance.log/summary，18个实际响应家族各5样本均≤1000ms，接收冷页385.5ms、执行导航316.8ms、保存最多241.8ms；19采集家族中的CLI观察单独保留，功能五轮原生22.5/10/8 Yard及实际操作人一致。源码/资产与证据冻结见c04-print-core-scoped-read-runtime-manifest.json、c04-print-core-scoped-read-freeze.json；本整任务结论仍未完成、未发布，技术记录不等于用户接受。


## C04.06 卷计量、标签及直接相邻保护（实施阶段记录）

本轮实际绑定print-output-model的原生卷读/保存/打印同事务、print-roll-ui的原单位/米/实称解析、print-output-view及print-page同单短表单、print-label的原100×60 Code128/QR和产出图。删除旧只读renderPrintOutput与重复图片摘要，无新数据仓、角色限制卡、通用数量差异/超计划/提前结束入口。

原始失败与新证据见printing-source-audit.md：旧打印标记失效及Web重印UID各有原生红绿复现；历史BOM缺卷数首次边界失败保留，当前隐藏不支持的补码及原完工只读已过。多卷/语言/错扫/返回/清空、quota/回读失败锁定/稳定重试、占用/作废释放、Web批量规格使旧标签失效、实际米单位/长SKU/真实图、100×60纸内布局及320×480输入主按钮均有各自技术记录。

当前完整build1395全通过，Vite23.30秒；全范围tsc的19既存错误仍失败且消息与前版一致。当前生产构建37实际家族×5共185样本≤1000ms，最高冷页411.3ms，页面错误0；浏览器print请求模拟不代表纸张/打印机或现场验收。源码资产版本由c04-print-roll-final-runtime-manifest.json绑定；未完成的正式交出、洗水、完工、其他模块及第三方、旧资料迁移、最终菜单与发布沿原矩阵继续，本整任务结论仍不通过/未完成，不跑完成收据、不发布中间版本。


## C04.07～08 交出实际责任与无需洗水判断归属（阶段记录，未完整交付）

相对C04.06源码归档的8个运行/测试文件差异见c04-print-dispatch-owner-stage.diff，主代理逐项核读；新增独立账号叶模块、不引整印花域进入共享PDA，所有UID字段可选以保留旧Web调用，未补造历史账号。原型交接头task绑定与正式头sourceDocId分别核实，不放松原工厂/整卷/唯一收方/洗水门禁。

真实普通来源/NO_WASH的原生建单→扫码→现场判断→交出及冷页8/8/0 Yard已过；不同实际人、伪造账号、错扫/未扫齐/缺判断、quota/稳定重试、同事务版本guard及唯一原单行见c04-print-dispatch-native-recovery.log。洗水判断保留已有中央印花原归属；两份不一致原单和开发collector实例问题的失败原件保留，不能用后续通过涂改前证据。

当前标准build1397全单元通过、Vite23.21秒，完整tsc仍19项既存范围外错误；生产预览现有37响应家族185样本最高405.5ms，无pageerror。新交出UI尚未接入，不据此称其PDA页面或真机已验。

需洗水SEND仍被原单/接收资料归属保护阻断，持久行未变，见c04-print-washing-send-owner.log；必须继续实现同事务协作写入并验证，不能绕过保护或隐藏分支。本整任务仍不通过/未完成，其他工序、第三方、迁移、最终菜单和发布均保留原目标；不提交main、不发中间版、不标goal complete。


## C04.08 印花送洗联合事务、同单PDA与连续作业（2026-10-21阶段记录）

沿用完整目标“不通过/未完成”。新增print-washing-model/view及单元；直接源修改、真实红绿失败及反向范围核对见printing-source-audit当前实施节，不把原生API或开发诊断当作生产全链验收。当前1400单元与Vite22.59秒构建通过；全tsc与前阶段19个错误完全相同，无本阶段错误，仍不声称全类型检查通过。

主代理核对本阶段相对C04.07冻结的实际差异：联合writer仅转交四个实际洗水过程键，水溶仍被中央拦截；同一PCS事务保原owner/版本/失败回滚，提交后读回失败不回滚已存事实；factory-receiving只补既有washingOrderId查询。新PDA实际账号回调不影响旧Web无回调调用；扫码不从显示内容补造，单位取原卷。批次选择仅用真实生产批次，不新增批次、不改已关联卷，元数据变化令旧标签失效。空加工草稿自动刷新只适用于没有实际填写且印机仍为最初默认的场景，不绕开有输入的版本守卫。

真实原型验收包括320×480/640、ID/中文、原QR及Code128、错扫/重扫、分交6+2、真实WebGTG8与最终下游0、失败/重读/退出换人、两批8+1及旧未关联卷补归属。保存中卡住、补卷遗漏、空INPUT旧版本三项真实缺陷均先留红证据再修，采集器提前检查/错误导航/包装错误消息的诊断分别留存。新页面没有权限卡、通用数量不符/提前结束/超计划/异常原因/数量解释入口。

源码与运行资产固定在c04-print-washing-continuation-runtime-manifest，本阶段正式59响应家族/295样本、最高364ms、pageerror为0，结果由performance-summary登记，尚缺的分支/整目标仍在矩阵保留。没有最终目标收据、合并、推送、发布或用户接受；当前局部技术证据不能替代未完成的正式交出、多owner、完整洗水端及其他工序和两端菜单。

C04.08最终阶段资产冻结：c04-print-washing-continuation-runtime-manifest.json绑定103任务代码测试文件/1282构建资产；完整任务文件与本阶段证据各自归档，索引和SHA256见c04-print-washing-continuation-freeze.json。该阶段归档不是完整目标技术收据。原始失败不删除，整目标仍不通过、未交付、未发布；未改测试站数据库。


## C04.07 正式交出UI与跨普通/洗水来源（2026-10-21阶段记录）

完整目标仍实施中/不通过。本阶段11个代码测试文件实际差异和主代理审查绑定c04-print-dispatch-ui-stage.diff，范围为原生扫码触发草稿/合入、单内短面板、实际创建/首次扫码/交出UID、同单实收，不新增管理权限说明、运输项或通用异常原因。原生完整触摸/规格/打印/唯一目标/原单位/分批/库存/关闭规则保留，最终数量确认一次、移除/作废保留后果确认。

普通单6+2、设备换人、移除重扫、作废释放、失败续填/已提交恢复的真实UI；普通与实际送洗后余卷的两owner58合单、三处quota/同一事务/稳定重试/冷读/真实Web8+50；并发改49挡旧扫均有原生及页面证据，详见printing-source-audit。固定洗水来源交接头漏存、跨owner重试和Web直达漏读均由实际失败记录定位修复；不删历史错误或以假数据放行。

初版build1403单元/23.66秒，完整tsc19相同错误；54响应家族270样本最高362.1ms、页面错误0，版本仍绑定c04-print-dispatch-ui-runtime-manifest，不改标最新。末轮PD_changed恢复按钮缺失另有stale-reread红绿；两行局部修复的新build/性能另记reread版本，保留未改正常分支原身份依据，不以构建替代设备/行为检查。设计改款等完整混合、印花最终完单、新洗水端、其他工序/第三方、迁移/菜单/最终治理/收据/发布继续；此阶段不发布中间业务版。


C04.07当前reread版本已完成标准build：1403单元全通过、Vite22.67秒，完整tsc19原消息完全一致（仍失败，不归为本阶段错误）。正式生产预览c04-print-dispatch-reread-production-performance-summary.json通过36响应家族×5=180样本、最高402.5ms、pageerror0；包括真实第二台PDA合2后的旧6按钮拒绝、无写入、可用重新读取、最新8量与明确确认后才交8，独立收0、实际两次扫描。新恢复三个家族最高分别54.3ms、70.2ms、154.2ms。未改的原54家族仍保持初版270样本原身份，两版重叠家族不相加冒称新增覆盖；其正常/移除/作废/提交后恢复契约未变，原证据按EVIDENCE-01保留。

当前运行身份c04-print-dispatch-reread-runtime-manifest：108任务代码测试文件、1282资产，复核均无哈希差异；CodeGraph已同步4444文件。相对上阶段最终审查差异462行/11文件见reread-stage.diff，范围比初版仅新增PD_changed提示的原重读入口与真实记录强制读取。完整任务文件及本阶段原始证据归档见c04-print-dispatch-reread-freeze.json。当前专项是进展记录，设计改款等完整混合、完单/新洗水端、其他工序与第三方、迁移/菜单/整目标收据和发布均继续，不作为完整目标通过或用户接受。

## C04.07 设计改款原归属、三类来源实际合单与送洗（阶段记录）

本阶段实现及原始红绿、采集器错误与业务错误的区分，逐项见printing-source-audit末节；不改写上阶段身份。当前新增printing-joint-records，原PCS命令仅补本次明确联写选项。PCS、中央、洗水原过程行保持原id/版本，同一次原IDB事务保存；判断不采用第二份原单，送洗沿原PCS行写回；专业附件保持原文件id而非重复wash-file。中央覆盖守卫允许保留实际未变行，仍拒绝改量、删行或恢复删除行。

主代理核查当前相对reread冻结的运行、测试及文档差异，覆盖四键限定上下文、同步配方/失败清理、原codec/position/附件引用、事务complete、已有命令结果/稳定重试、保存后读失败、源版本/实际账号和UI显示意图。没有新增数据库、旧源清理、商业接单、角色提示或第二套可写原单。历史已有重复原归属仍阻断，不在普通读取中删除。

实际证据：普通50＋真实生成设计8为58，设计HANDOUT通过原Web工厂接收后冷页只收8；实际同组生产50＋设计8＋补料第二卷50为108，四集合quota无半套、同事务、提交后重读恢复及重复确认无增量，三笔Web独立实收后冷读50/8/50。另一页改设计卷7使旧操作失败，草稿保留50、原卷7未打印及唯一PCS。设计送洗实际生命周期至GTG交回8，最终收方0且不能完单；普通路径原25/10/8回归通过。原始跨GKP/F090组错扫是正确阻断，未改下游凑合单；早期附件owner passed不代表两份文件通过，实际缺陷已修复为一个原PNG文件。

当前标准build1406项单元通过、Vite22.75秒、退出0。完整tsc19条与上阶段原消息一致，仍为失败而非全量通过。生产预览320×480设计改款20家族100样本最高430.5ms，320×640普通相邻36家族180样本最高360.7ms，均页面错误0；脚本及真实结果见c04-print-design-*-performance-summary。相邻采集器旧build文字保留并在summary说明，实际资产绑定当前manifest。仅上述阶段技术核验通过；当前完整目标仍不通过、未交付、未发布，C04.09完单及完整中央洗水/其余工序/三方/迁移菜单/最终审查与发布继续。

## C04.09 印花完单与只读（阶段技术核验）

实现/原子状态及正常、未实收/未决异议、多笔6＋2、真实责任/三类原归属、quota/已提交读失败、稳定重试、冷读、另一设备先签署、320×480中印/ENT/取消与无空草稿见printing-source-audit C04.09末节及同阶段completion原始脚本/日志。getter与原Web命令共用同一既有条件；新PDA用当前账号，无手填身份，旧Web姓名与未知UID保持原事实。当前原印花可在GTG实际接收本次实物后完单，洗水单继续独立处理，未改为两者必须同时完成。完成后新端业务只读，实收/图/单据仍可查看。

本项标准构建1408单元通过、Vite22.80秒；末轮仅T2短句/历史责任姓名兜底，最终资产另有final-vite-build，原行为证据保持原版本。主代理核读本阶段实际完整差异，确认无数量公式、旧Web姓名调用、存储键/迁移/静态种子、第三方或无关工序扩改；新增UID可选，来源/保存失败及实收仍由原账负责。完整tsc仍19条既存范围外失败。生产预览12家族60样本最高394.3ms，另一设备先完单/重读2家族10样本最高117.2ms，错误0。原collector变量/引号错误、错入口等待、遮罩点击及NO_WASH归属错误均保留，未修改业务守卫迁就测试。

C04.09已验证仅指本项代理技术结果；整目标仍不通过、未交付、未发布。中央洗水单完整新端、其他工序、三方、迁移/最终菜单及整目标审查/收据/发布继续，不生成完整目标完成回执。


C04.09末轮连续作业追加：原硬件Back反例保留，完单回调改为捕获确认时本单Ui；同输入部位票读取共用正在进行的结果，原保存/迁移/不同snapshot锁不变。路由共用准备仍报错、直接删除准备导致冷模块空页，两次无效方案均保留在日志，最终路由回到上阶段字节，未以忽略pageerror通过。当前read-sharing完整build1409单元/Vite22.17秒通过；tsc19条原文未变。自然生产返回另一单五次3,5保留、A实际签署正确，最高215.9ms，页面错误0；4工序冷入口/切语言8家族40样本最高466.1ms，原生并发读取1次getAll且不写，320×480无溢出。

完成命令及数量/责任契约未受最后只读修正影响，原专项证据保持其版本；新读取/返回家族追加当前证据，不重复全量业务或重标旧资产。主代理核对本阶段10个代码/测试文件与3份记录，差异及运行身份见c04-print-completion-stage.diff和freeze.json。仅C04.09技术项已验证；全目标仍不通过、未交付、未发布。下一步中央洗水自身流程，其他中央工序、三方、迁移/菜单及最终治理/收据/发布继续。


## C05 中央洗水主流程接入（实施中）

当前范围与逐项核查见washing-source-audit C05.01～10，仍继承整个拆分目标。新增washing-model/page/view/ui/warehouse及独立wash路由，frame和entry按实际family分派；四个中央工序选择器增加洗水直达。原Web资格纯函数移入fabric-washing-model并原名重导出，无条件改变。新PDA无商业接单/开工、身份提示或通用异常表单；投入洗水仍是已接收实际卷的原加工动作。

原生命令28相关单元、真实两卷分批/重包/独立实收/完单及Quota/重复/冷读已通过。实际UI修复扫码后同步失焦change回填旧码、数值失焦替换主按钮导致点击失效、旧成功提示未清；保留所有失败/诊断。生产main-flow完整构建1415单元/Vite22.93秒通过，末轮布局/签署显示/本单内存清理后的main-layout Vite22.47秒通过，当前完整tsc19条原文未变。

当前main-layout生产预览320×480印尼语主流程30家族195样本、每家族至少5个有效样本、最高439.7ms、页面错误0。五轮均实收49.5/50、产出/最终实收49.75/50；10条原actions分别登记GTG操作工加工/交回、F090_admin独立实收、当前GTG_admin完单。顶部当前真实单号、实收页短标签与签署人/时间可读；来源、原卷/重包码、手感、原单位保留。主代理已核对本阶段15个代码/测试文件和3份记录，当前diff/资产/失败日志见c05-washing-main-flow-freeze。

C05仍实施中，以上是主流程技术进展。标签打印、仓管专项、其他源归属/原仓库、不同交回批次、提交后读取失败及并发、完整退出换人和相应响应仍未完成。完整目标仍不通过、未交付、未发布，不生成或声称完整技术收据通过；其他中央工序、第三方、迁移/最终菜单和正式发布继续。


## C05.04 原整单打印与保存后恢复（阶段技术核验）

具体原子结果、真实红绿及范围见washing-source-audit C05.04末节。修复PRINT仅改两个打印标记却误挡原物理续填；增加原全单范围的中印单据/真实卷码预览和A4，保留原码、重包码、物料图、来源去向与原单位。原PRINT只表示预览生成，实际浏览器打印调用独立，不增加已经打印确认或虚构纸张回执。

已保存但回读失败曾使恢复上下文被渲染覆盖、只显示正在保存；当前保留原操作号/回调与原输入，恢复只写一次。Quota前失败不留半套，实际OUTPUT同样49.75/50与原新卷码不变。两个真实生产PDA页交替时，另一页交出使旧预览拒绝，原接收方仍独立实收。当前原主流程版本证据保持身份，不把本项新增当作所有旧家族已重测。

标准构建1420单元/Vite22.11秒通过；最后按钮宽度/恢复布局Vite25.75秒通过。完整tsc19条与前阶段原文一致，本次范围0新增。生产320×480、Asia/Jakarta印尼语11响应家族130有效样本，每类至少5，最高114.8ms、页面错误0。补充中文预览及中印切换数值/原新卷码保持，实际恢复提示和整行底部按钮均在可见区。主代理审查6个代码/测试文件，记录实际diff/资产/脚本/失败日志于c05-washing-print-freeze.json。纸面人工核读仅为内容/布局，真实工厂打印与用户接受均未声称。

仅C05.04本项代理技术已验证；C05整体继续，仓管、完整来源/责任、不同交回批次、连续作业/换人及其他中央工序、三方、迁移/菜单/最终治理/收据/正式发布仍未完成。完整目标仍不通过、未交付、未发布。


## C05.07 仓管物位与收发记录专项（未关闭完整洗水）

仓管接收记录已从原真实接收明细补原卷、原单位/实收、上游、实际库区货架库位；交回记录补实际下游独立接收责任。只读查看不新增接收/交回操作。实际49.5/50两卷中投入第一卷后库存仅剩第二卷50；真实产49.75/重包后待交回未伪造新位置，交出后移除，F090_admin实际收49.75后双方账一致且第二卷未受影响。源与责任均沿当前原命令/记录。

三张实际印花来源各6卷、原命令准备18卷产出，旧资产只显示15且无继续入口；当前查看更多可见全部18，原日志/码/量保留。固定warehouse构建Vite22.26秒、52相关单元通过、完整tsc19条原文不变。生产320×480、Asia/Jakarta，另一正式场景18卷已接收投入、一卷独立最终实收/本厂17待交回，10家族50有效样本最高277.4ms、pageerror0；查看/语言/记录及最终物位均使用当前资产，纸面/原打印证据保持上一版身份。

主代理已核读本阶段2个代码文件的只读差异，没有改变原单/数量/保存、主执行页、权限或路由。当前源码/资产、审查差异和原始红绿/截图绑定c05-washing-warehouse-freeze.json。C05.07因停止/异常实际库存状态与印尼状态语义仍继续实施；C05完整来源/两次交接/连续作业和其他中央工序/三方/迁移菜单/整目标收据/正式发布均未关闭，完整目标仍不通过、未交付、未发布。


### 上游fc3283同步（仅版本接续）

主分支新增fc3283成衣出库线上页面/取消状态、3张图片及专项记录/测试，共8文件，与本任务135个文件无交叉。已先冻结warehouse任务与证据，直接ff-only从caa7b286同步到fc3283；无stash、冲突或覆盖，逐文件SHA256确认135项全部保留。机器记录为c05-washing-after-main-fc3283.json，原print/warehouse资产与证据仍保留caa7b286身份，不改标本次新HEAD，也不以PDA专项宣称WLS验收。新的正式页面验证再绑定实际构建，未改直接事实的既有证据依EVIDENCE-01保留，不因仅SHA变化重做全量业务。完整拆分仍未完成/未发布。


## C05 连续作业与完整来源阶段技术核验

当前fc3283、continuity-final-build：1435单元及标准构建通过，Vite22.55秒；完整tsc19条既有范围外消息逐字不变，本范围0新增。当前生产320×480、Asia/Jakarta，71家族470样本各至少5、最大442.5ms、页面错误0。原始反例和校准保留，未以平均值或后来快样本掩盖失败。

本阶段补实收/仓储新读、空新批次修订、只读实际量、下一单/保存后扫码焦点、退出同义按钮，以及读取失败与页面/账号/明确清空生命周期保护。真实两交回批49.75/50、独立实收40/50、整单90和完单只读由原Web新页同事实回读。六类原示例36卷及真正PCS生成印花单8 Yard分别验证；工厂不冒充仓库，原仓库自由文本位置不冒称主档。停止恢复用原Web真实动作，库存仍在但不可执行。两真实页面竞争只一方成功，稳定重试不重复。输出保存前/提交后读失败均保留值、无半笔或重复；打印/重包/旧预览相邻回归通过，未声称物理纸张测试。

当前差异相对warehouse冻结为5代码/测试及3记录；原洗水/PCS/共同命令实现未变。主代理审查了实际差异、原子结果与新读/恢复影响，未将印花先完单误当洗水完单，没有新增通用异常/权限提示/自设产出上限。详见washing-source-audit末节逐项表及c05-washing-continuity-final-freeze.json，旧资产证据保持原阶段身份。

C05.01～09为本项代理技术验证；C05整体待最终拆分审查/收据。整个目标仍不通过、未交付、未发布，未获用户接受。下一阶段裁床先核查当前两仓、真实对象和存储归属，再写独立中央页面；不套用洗水或旧PDA页面。


## C01 裁床实施前源码/页面基线

原Web两仓1280×720隔离上下文可打开、pageerror0；待加工首次读写一笔4571字节v3物位布局，未见IDB put。源码确认load会读时删除旧key和重写/初始化布局；待加工接收/加工接收/回收三类不在当前managed事件集合。基线passed仅页面可读，不表示存储合规。待交出以当前菲票/袋周期/分配及原自动车缝接收事实为准，不能搬用洗水独立点收，也不能用聚合平均卷投影冒充扫码源。新增cutting-source-audit登记18项计划，均待实施；本阶段没有修改裁床运行代码、旧数据或新增PDA页面。整个拆分仍未交付、未发布。

C01.03后续起步：纯读readWarehouseLayoutSnapshot和四项数据保护契约通过，实际原页面factory0035库位，不生成普通仓库的假裁床编码；完整tsc仍19条范围外原消息，本项0新增。新函数尚未被新页采用，原load与旧源迁移未整改，C01整体继续实施；C05冻结保留其原源/资产/文档身份。未构建/发布包含该helper的新产品版本。


## C01.04a 事件接管基础（仍在实施）

central-v3区分旧v2的范围，五类待加工物理事实加入原记录基座；原Web三动作走同库事件命令，零数量仅原一次提示。八相关单元、完整1443单元/构建通过，Vite23.10秒；完整tsc原19条范围外消息不变。隔离原生浏览器QA历史101条迁移的正常、第二批失败、源清理失败重试及目标冲突保留均通过；同号新3.75 Yard命令仅一笔、无静态整包落盘。原Web表单12.5/2.5/1.25 yard及源入仓关联、刷新冷读通过，旧事件键0写，页面错误0；不冒称正式工厂来源筛选或真实现场交易。PCS真实生成8 Yard印花/洗水/独立实收/完单相邻回归保持同一owner。

最初测试入口缺已有部位票初始化、表单提示采集过早的失败均保留并修正验证入口，不以其解释或放松产品门禁。当前只是事件基础，实际配料接收会话/位置调整旧写入还须共同适配，布局配置仍旧源；响应五样本和新PDA未验，不关闭C01.04a或整体C01，整个目标仍不通过、未交付、未发布。详见cutting-source-audit末节及本阶段冻结记录。


### C01.04b 当前v3库位记录接续（局部实施证据，整体未通过）

当前/历史共同保存及原Web实际维护在1280×720核验：新增库区/6库位、顺序调整、非法输入、历史写失败保留与重试、生成中取消和刷新；原布局键写0次。原生隔离10情况、两页同版本竞争及第三页冷读、v3显式迁移和旧v2保留通过。初次事务取消暴露重复abort，保留initial日志并在fixed消除页面错误；没有降低阻断。新4契约加原8专项通过，完整1447单元、Vite22.95s，19条既有范围外类型消息不变。证据为output/playwright/pda-factory-split/c01-layout-*，精确前缀与阶段边界见cutting-source-audit当前追加节。无正式性能样本；旧版本准确迁移、损坏资料恢复、真实配料会话/事件共同保存、新裁床PDA及完整拆分均未完成，整体审查不通过，不生成最终收据或发布。


C01.04b响应追加：首次生产采样待加工库位图最大1080ms失败，原30样本保留。仅修复未选Tab隐藏HTML构造，25组渲染输出一致及原收发/实际维护重放通过；重建1447单元/Vite23.67s。相同48340/1280×720/Asia-Jakarta空上下文新30样本六类各5个全部≤1000ms：待加工首次/编辑/保存967/114/143ms，待交出479/83/146ms；实际记录回读/绘制/字体图片及原23/34位置，页面错误0。命名证据c01-layout-lazy-production-samples，当前版本c01-layout-lazy-map-version.json。仅这六类响应局部通过，旧版/损坏恢复、其他动作、新PDA及拆分仍未完成，整体不通过，不生成最终收据或发布。


## C01.04c 当前节点接收的阶段审查补充（2026-10-21）

模式：完整产品审查的局部阶段，整体结论仍不通过/目标继续实施。本补充继承原拆分范围与矩阵，不覆盖旧阶段身份。对象为原Web `/fcs/craft/cutting/pickup-management/{incomplete,history}`及原待加工仓三动作的直接相邻依赖，1280×720、Asia/Jakarta、隔离浏览器/原生IndexedDB；无测试数据库连接、无用户数据清理。新中央裁床PDA尚未做，不能拿Web图证明PDA小屏或物理按键验收。

已审查当前接收新增三组逐条事实与IN事件的同库事务，原节点全部物料/原单位及现有前置不变；普通读不写，非登记组变化拒绝，原旧日志/坏源不覆盖；原Web提交中禁重复，失败保留人/仓/位，同号重试和双页竞争不重复数量/明细，冷页读取同一责任。16原生场景、9种备份损坏拒绝、实际连续两单180/1386 yard、相邻12.5/2.5/1.25 yard收/加工接收/回收及PCS8 Yard洗水owner链均通过对应专项。损坏前置曾被原reader吞错的失败已保留并修复预检，不引入新PDA差异表单或权限说明。

本轮负责文件：`src/data/fcs/cutting/{cutting-pickup-command,cutting-pickup-records,cutting-event-repository,cutting-record-repository,production-material-prep,replacement-fabric-repository}.ts`，`src/data/fcs/production-context-records.ts`，`src/runtime/fcs/cutting/pickup-management-runtime.ts`，`src/pages/process-factory/cutting/pickup-management-list.ts`，两项新增单元文件。这些为C01记录/来源/原Web共同保存的必要依赖，不改测试站。事件/布局文件之前C01a/b改动保留各自证据身份，本补充不是对整个任务完整diff的最终审查。

构建`c01-pickup-preflight-build.log`1451通过/Vite23.29s；全量`c01-pickup-preflight-typecheck.log`19条既有范围外错误，不能声称全量通过。当前代码/资产见`c01-pickup-receipt-version.json`，功能证据前缀见cutting-source-audit末节；命名响应按后续生产采样另列。旧八组实际来源/历史/日志及相关消费者仍未完整迁移、布局旧版本/坏配置恢复待办，新裁床PDA与其余拆分未完成，整体不关闭、未推送或发布；技术结果不冒称现场接受。


C01.04c命名响应补充：c01-pickup-production-paint-samples在生产预览、1280×720/Jakarta、原1386 yard源每家族5次，导航/真实pointerdown至必要图片/字体/两帧绘制，保存包含持久读回，共7家族35条最大929.4ms，页面错误和旧业务键写0。原viewport控制端计时35条最大1131ms不通过原样保留；三次同时观察证明浏览器约901～911ms完成而控制端1025～1121ms才回报，新采集保留独立控制端值，不把原值重标，不冒称改源码获得加速。详细版本、环境、采集失败和原值在cutting-source-audit末节；没有扩大到新PDA或所有C01性能。本轮sync补齐11文件，CodeGraph新命令与Web引用查询已确认。整体拆分仍不通过/实施中，未生成完整目标最终收据、未发布。


## C01.04c.5a 存放范围局部审查（2026-10-21）

模式仍为完整目标产品审查的阶段补充，整体不通过/实施中。负责文件为新增cutting-pickup-footprint-command、central-pda-cutting-footprint.test及pickup-node-domain/production-material-prep/cutting-pickup-records、pda-warehouse-wait-process必要适配；不放开已被三方范围守卫拒绝的旧裁床仓管路由，不把旧PDA界面复制成新中央。共同命令保留原接收责任、原量及每个原单位，调整账号/位置/余量另记，三组必要变更及逐单位ADJUST同事务，失败输入/同号重试及迟到回调保护已接线。

九原生模式、七备份损坏拒绝、双页不同/同号两种竞争及冷读通过；清零后二次零量失去仓范围的红记录保留并以原IN仓修复，原接收16模式相邻通过。1454单元/Vite23.53s通过，19条原范围外类型消息不变。生产48340/1280×720/Jakarta原接收七家族各五次，浏览器实际绘制/持久回读端点最大985.3ms；控制端冷首笔1038ms单列，不冒称原控制端所有值过门槛。版本/脚本/具体数字见cutting-source-audit末节及c01-footprint-version。

当前共同命令可用的事实契约与旧组件接线不等于新中央操作页完成。新调整页适用小屏/印尼语/按键/正式响应、真实多单位来源/工厂任务范围和实际接收账号绑定、旧资料源及历史/日志/附件迁移仍未完成，c.5a保持已实现待验证，完整C01与PDA拆分不关闭。未生成完整目标最终收据、未连接测试数据库、未改用户资料、未推送/部署，技术验证不冒充现场接受。


## C01 新中央接收/仓管页面的局部审查（2026-10-21）

模式：完整目标产品审查的阶段补充。实际新入口/fcs/pda/central/cut/{receive,execute,warehouse}；独立新页面，无旧PDA页面模板依赖。execute当前只显示真实分配来源，不能把它报为裁床执行/交出已完成；菜单替换和完整目标继续实施，整体结论仍不通过。

本轮新增受管文件：

- `src/data/fcs/cutting/central-cutting-source.ts`
- `src/pages/central-pda/cutting-model.ts`
- `src/pages/central-pda/cutting-page.ts`
- `src/pages/central-pda/cutting-view.ts`
- `src/pages/central-pda/cutting-ui.ts`
- `tests/unit/central-pda-cutting-source.test.ts`

本轮必要直接改动沿已登记cutting-pickup-command/records/footprint-command、pickup-node-domain、production-material-prep、pickup-management-runtime、cutting-event-repository、原Web pickup-management-list、warehouse-location-map及其当前单元；路由/分派为central-pda entry/frame/page及routes-central-pda。可选来源/UID对原Web未注解输入保持原行为；只追加所见快照核对，未提供通用手填数量、差异理由、审批/角色提示或商业接单/开工。

检查通过的局部：实际CUT任务/生产单/物料/当前工厂唯一归属，原180 yard与裁剪米分开、当前source图、账号/IN/会话同库且失败无半套；双小屏连续/翻译/返回/扫错/quota/退出换人，实际原流程新10 yard接续，原仓二维码、冲突重新读取和已保存读失败恢复。回放发现失焦丢点击、同秒调整覆盖及库位旧余量、F1误触/焦点不可见，均保留红/修复直接证据；实际键盘Enter一接收，未冒称物理PDA验收。

1459完整单元和构建通过，最终资产22.40s；19原范围外类型消息身份不变，本任务无新增。原存放调整9模式/7损坏拒绝原投影冷读相邻通过。新18个生产命名家族及原Web7个相邻家族以最终key样本另列；全部其他UI分支和全源/历史迁移没有据此关闭。证据、当前源码/资产绑定及阶段freeze见cutting-source-audit末节。未连接测试数据库，未改用户资料，未提交/推送/部署，未生成完整目标最终技术收据；本记录不把局部通过冒称全部拆分已验证。

C01当前命名响应补充：最终key资产下新PDA18家族90样本，最大584ms，原Web7家族35样本最大930.3ms，真实绘制/必要图/字体及持久结果包含在终点。纯T2只读执行用料单位标签随后准确化，中/印页面已核对，数据及接收/仓管行为不变，按既有复用规则保留前资产测量身份，最终label资产与受控文案diff单列。未覆盖的清零/多库位UI、其他新动作性能、全源及旧历史问题仍实施中，整体不通过。详见cutting-source-audit末节。

## C01.06 加工领料与回收入仓的阶段审查（2026-10-21）

模式为完整产品审查的局部补充，整体结论仍不通过，任务继续实施。新中央执行单内沿实际已确认床次/铺布单及实际入仓来源领料，回收入仓沿原领用记录。没有用旧PDA页面模板，没有商业接单/竞价/开工，也没有通用数量差异、提前结束、超计划或角色权限提示。本节不把新领料/回收当完成铺布、裁剪、交出及实收已接全。

本轮受管文件及直接责任：

- `src/data/fcs/cutting/cutting-quantity-unit.ts`、`spreading-material-readiness.ts`：已知长度读取换算/不可换算阻断，原事件单位不改。
- `src/data/fcs/cutting/cutting-process-material.ts`、`cutting-runtime-event-ledger.ts`：实际入仓→实际PB OUT、原领用→回仓IN，当前量/原单位/账号/范围/稳定确认号。
- `src/data/fcs/cutting/cutting-material-record-links.ts`、`cutting-record-repository.ts`、`cutting-event-repository.ts`：新领用和回仓的原批/单位/实际人/床次关联在提交、读取及恢复中核对，未覆盖旧资料；不冒称完整旧源已迁移。
- `src/pages/central-pda/cutting-execution-model.ts`、`cutting-execution-view.ts`：全床归属、实际落盘入仓来源、物位去重及各批次操作，排除未落盘的示例库存；按来源自动带位置/用途。
- `src/pages/central-pda/cutting-page.ts`、`cutting-model.ts`、`cutting-view.ts`、`cutting-ui.ts`：中/印小屏、逐批/动作草稿、返回续填、扫码/F1/Enter、清空/退出；区分原接收与实余量，回收图沿原来源。
- `src/pages/process-factory/cutting/warehouse-location-map.ts`：同刻ADJUST前后的OUT按既有账本时序，不按原时间字符串。
- `tests/unit/central-pda-cutting-material-movement.test.ts`、`central-pda-cutting-readiness-units.test.ts`：数量/单位/状态/来源/责任、原始量不变及恢复关联契约。

已取得的局部证据：四项单位和三项动作准备契约、实际180领50后原批130/回10独立批/同内容重试只一笔；quota未保存保留记录，旧源/错人/超量拒绝；两库位同批不重复计量、实际新增10 yard交替、耗完批不再供新领用、回收20再领5后原批130+回收15合计145；原接收账号保留。320×480中印、Enter、返回续填、清空/语言/退出、回仓位选择和余量分批回读通过。原/新命令来源读回、测试和截图均为隔离浏览器原型核验，不代表工厂实机或业务接受。

正式响应：20新家族100样本中，初次/刷新1122.3/1255.4ms未通过，失败原值保留。移除重复物位计算并在单次同步读取中共用现有来源读帧（不跨动作缓存）后，受影响7家族35样本均≤1000ms，首次985.8、刷新697.4、领用保存532.1、回仓保存482.2ms；其他未改输入/按键/语言等13家族保留原测身份。新接收/仓管相邻18家族90样本均通过，最大795.5ms。原Web接收相邻7家族35样本，首次1068.4ms未通过，其余≤869.4ms；复制采集脚本的source/version元数据仍指旧key版本，实际请求当前48340资产，需在后续版本记录中说明，不能冒称新代码对原Web整体已通过。后续恢复关联守卫另变保存/读回，最终构建及其适用验证另列，旧通过不改标新版本。

完整1466单元/Vite26.50s来自新增恢复校验前版本，读取优化资产36.81s，不能拿旧1466直接称后续新校验全量通过。恢复校验五专项中原夹具缺真实IN库位前置的红记录保留，补足夹具后通过；新类型守卫的23条可空诊断已修复函数声明，最终全量类型恢复为19条既有范围外错误，无新增，整体全量类型仍未通过。新校验全量构建正在执行，不预填结果。

未关闭：原Web首次性能、恢复守卫后的最终资产保存响应及全部适用分支、实际耗用/原卷/完成铺布与裁剪、两种交出/实收、旧八组/历史/日志/附件和旧布局恢复、其他工序及三方、最终菜单/门禁/发布。当前无外部阻塞，未提交/推送/部署中间业务版本，完整目标继续实施中。

本轮最后补充：新恢复守卫后的完整1468单元/Vite27.50s通过；五种真实坏备份在restore入口拒绝且本库不变，正常多批回收再领保留原人/单位；最终生产新链七家族35次均≤1000ms，最大766.8ms，保存包含持久读回。CodeGraph 16文件同步、无pending。原Web首次1068.4ms及完整裁床执行/交出/实收与旧源等保持未完成，整体结论仍不通过/目标继续，未生成最终workflow回执或发布。当前源码/资产及原失败/通过版本按阶段冻结c01-process-material-freeze分别保留，不重标旧证据。

## C01.07～08 逐卷铺布、裁剪及连续填写的阶段审查（2026-10-21）

整体结论继续不通过/实施中，不是完整裁床、两套PDA或发布接受。新增独立小屏实际PB动作及共享数量/源/保存守卫；主代理核过当前新增command、allocation/consumption/records、独立model/view和页面接线，原readiness、原model重建保留和part-ticket共同保存变化。正向从已领料、逐卷、层段交接、米公式、完成/只读、失败/重试、双语和换人映射到上述文件；反向核未增加商业接单/竞价/开工、权限面板或通用差异放行。长度函数原样抽出并保留model导出，未改分包配置，防止记录读取依赖整个菲票块。

13专项和最终完整1481单元通过，生产构建35.23s，全量类型仍原19条；本轮开发连续/原生/坏备份与生产21家族105样本通过，最大914.5ms。正常PB20件/45.6米被原菲票流程分成16票，四个部位实例分别20片；18件实际不足分支不冒充20件，沿原Web未复核守卫不出票。首次生产空白及原采集脚本错误均保留，修复后boot无pageerror。详见cutting-source-audit的本轮实现/最终节及命名原始证据。

本轮原Web相邻数量/责任/重试正确，但性能三类不通过：首次1429.4、打开节点1015、历史导航1037.2ms，其余四类均≤1000ms；不能以新PDA、构建或收据替代。当前另有提交后/读回前另端改卷导致其他待填草稿重绑的交错边界需复现；其他多床/多物料/SKU/原卷、两种交出/实收、历史/旧布局、其他工序/三方/最终入口仍待。没有最终workflow收据、提交或发布。当前阶段仅冻结可恢复进展，不关闭整体。

## 提交后并发保护、读取与两个菜单的接续审查（2026-10-21）

本阶段主代理核对当前完整相关diff：改卷返回比较值只在内存，不进入持久命令；另端插入更新时旧草稿不自动重绑，显式重读保留输入，正常多卷续填不增加确认。当前已报提示显示米/层、层数和件数，不把片/件或yard改为米；印尼语小数仅显示变化。PMS仅按原正式款式版本指针取发布物料；54款式前后输出一致。原接收列表同次同步读/事件复用当前源与节点，不跨异步或后续事件缓存。15专项及最终1484单元/Vite33.75s通过，全量类型仍原19条。

菜单正向三入口及三方执行实际点击、反向路径合同和源diff审查均通过，生产截图已目视核对。四入口各5条最大314ms；相邻21个实际铺布/裁剪/按键/双语/换人家族105条最大754.5ms，沿各自menu/peer-read资产身份保留。菜单采样末段与隔离来源诊断CLI存在时段交叠，记录真实条件，不声明机器独占。开发功能记录、错误资产访问、印尼等待诊断和原始慢样本均保留；原Web首次1304.9/历史1029.6ms仍失败，不能以新PDA通过覆盖。

整体结论仍不通过。两菜单不代表中央全部工序或三方完整入驻/扫码/单据/交接/结算已闭环；裁片交出当前正在核对真实首次打印、放行与分配前置，未造下游或绕过业务校验。材料接收旧专项字面断言和总体原型治理仍未通过，最终workflow未生成，没有提交、推送或发布当前业务中间版。

## C01.12a 实际票首次打印到放行来源的局部审查

主代理核对新增纯状态投影与两个现有读取/原命令接线：显示演示打印项不能抵扣本次实际票，正式打印状态须生产单/裁片/PB/产出/SKU色码/物料/部位实例/QR/片数同源；作废不复活，不改变原装袋/工艺/齐套/分配校验。没有新增表、普通读取写种子、权限提示或通用异常面板。三项合同及原有效装袋脚本通过，实际16票/80片、20件/45.6米保持，刷新回读和读取零写入；稳定确认重放16，新确认再打印0，不重复作业或物量。此为隔离原型命令证据，不是工厂打印机或现场验收。

最终1487单元及Vite24.81s通过，完整类型19条既有错误仍未通过。当前生产打印源冷进五条最大1034ms不通过（另1012/1010.6ms），刷新五条最大774.5ms通过；诊断样本不替换正式失败。fei-tickets列表专项静态检查退出1，当前历史页面未完整用标准骨架/表格/分页，首打行为改变不能援引纯文字历史例外；这与前轮pickup列表结构检查是不同对象。整体原型/材料专项/类型及未完成工序、真实交出前置仍未通过，不声称verified交付或最终workflow。无中间提交、推送、部署，原4832工作树仍clean于5ac7c58…；恢复冻结c01-peer-menu-print-freeze仅保留当前进展。

## C01.12b 任务单裁片交出的阶段审查（2026-10-21）

本段只审查新中央执行中的简易任务裁片交出及其直接共享保存/提示调用方，整袋交出、自然新生产单完整前置、其他中央工序与完整三方闭环均未关闭，整体仍不通过。当前实现/来源与继承边界见cutting-source-audit的C01.12b。原始1153.2ms首开、聚焦版本相邻1088.7/1164ms慢值不删除，也不把Node环境跳过native校验的旧脚本当作账户/HPB证据。

语义复核已核对新model/view、cutting-page与父冻结差异、原simple-cut-piece-handover及replacement-fabric-event-validation/cutting-event-repository、受影响的原Web提示。新中央界面独立，真实原任务/下游/图/整票量和5 Yard分开；原当前仓管确认即实收的责任不变。数量、账户、状态、打印、归属、占用和来源指纹校验仍沿当前原模块；新增引用不伪造会话或管理员。无Web宽表、角色卡、数量不符/提前结束解释面板、手填交出数或第二个收方确认。

功能证据：c01-handout-ui-lazy-read27项连续操作；native-boundaries-current-role八项拒绝且0交出/0HPB；final-guard-fixed最终事务拒绝0/0；web-committed-feedback原窗口故障重试只保留1事件/1HPB。后两类模型/命令/校验源在最终按需加载调整中未变化，保留原证据身份；当前页面入口另经最终资产正式检查。完整1491单元、生产构建33.34s；全量类型仍19项既有错误不称通过。所有验证是本机原型/浏览器证据，不是现场接受。

本阶段最终产物与证据预计固定在output/playwright/pda-factory-split/c01-handout-progress-freeze.json；仅在真实归档/回读完成后该路径才是有效冻结。未运行完整目标的最终workflow收据，既有治理/类型/旧Web性能失败未覆盖为绿色；不提交、推送、部署中间业务代码，不关闭目标。

最终正式采样见cutting-source-audit的C01.12b末节及c01-handout-lazy-version三组JSON：60家族300样本功能/回读均正确，但交出刷新1319.2ms、铺布首开1285.5ms、铺布刷新1197.9ms、接收首开1046.6ms失败（共5个有效慢样本）。性能结论：不通过；相应需求未完成。矩阵未改为已验证，整体不通过。源/资产清单绑定195/1304文件；本轮归档只证明实施进展和保留的问题，未生成最终完成收据，也未提交/推送/部署。


## C02 毛织纱线接收阶段（2026-10-21，实施中）

范围继承完整拆分C02及wool-source-audit的C02.01～08。本段是新的接收阶段技术记录，不覆盖前面各阶段版本，也不关闭整体矩阵。当前工序为原横机/缝盘两阶段，新增PDA接收复用原kg/克去皮、原来源和实际接收事实；执行页当前只有只读原阶段单，仓管当前只有接收记录，C02.03～05尚未实施。

负责文件（相对本隔离工作树）：

- src/pages/central-pda/wool-model.ts、wool-page.ts、wool-ui.ts：新独立读写适配、接收页及中印文案。
- src/pages/central-pda/entry.ts、frame.ts、page.ts；src/router/routes-central-pda.ts：毛织最小入口和本页自身读取恢复。
- src/data/fcs/factory-receiving-links.ts：可选实际账号引用；原会话调用保持原厂校验。
- src/data/fcs/wool-domain/store.ts：原Web与新PDA共同接收按sourceId的同事务版本保护；不新增第二份实收/库存。
- src/data/fcs/design-revision-pcs-command.ts：实际来源指向毛织时，通用接收调用进入同一毛织保存入口。
- src/data/pcs-record-runtime.ts：既有追加写事务支持本动作的已提交后读回错误文案，带真实committed标记；印花原文案保留。
- tests/unit/central-pda-wool-receiving.test.ts；docs/product-design/pda-factory-split/wool-source-audit.md、requirements-plan-matrix.md及本记录。

### 发现、修正与当前证据

| 检查 | 当前结论 | 证据与边界 |
|---|---|---|
| 旧三方会话干扰中央毛织 | 已复现并修正 | old-session-boundary-red/fixed；新中央实际账号接收1kg，旧三方会话字节不变；伪造姓名/错厂拒绝，原无显式账号调用仍依原会话校验 |
| 同一来源并发超收 | 已复现并修正指定来源追加路径 | receiving-race-red冷读41kg（原25kg）；fixed、web-central-receiving-race只允许两笔20kg之一保存，已收21/余4。保护标记与实收同PCS事务，失败原子回滚，不依赖广播或内存锁 |
| 冲突后的连续作业 | 指定流程通过 | ui-race-recovery：320印尼语原20kg输入保留，直接给重读，4kg余量不自动篡改原输入，改4后总25；实收人与原位置保留 |
| 原生失败、稳定重试及库存派生 | 指定接收通过 | native-receiving-guards：9.876+1kg；两笔实收、两笔派生流、10876g一致；Quota失败无半笔，稳定确认不重复 |
| 真实提交后页面读回失败 | 指定流程通过 | ui-committed-recovery：原生complete后注入只读故障，页面明确已保存，输入禁改；重读只有1kg/一次原生写，无空草稿 |
| 首次读取失败 | 已复现并修正当前毛织入口 | cold-read-failure-red/diagnostic保留加载骨架/未处理拒绝证据；production-cold-read-recovery在当前构建出现明确印尼语重读按钮，恢复后实际来货可读，不误写成未保存/已有输入 |
| 两批续填、语言、F1、扫错及换人 | 指定流程通过 | ui-recovery-account-guards和production-receiving；第一员工11kg、第二员工1kg、刷新余13kg，各自实际身份保存，无旧PDA会话；照片可放大遮罩关闭，320无横向溢出/底钮可见 |
| 新PDA与实际原Web共同事实 | 指定接收通过 | production-web-joint-samples的5轮真实页面：PDA1kg→Web余24，Web再1kg→PDA余23；原生两责任人和一个版本2标记一致，不把当前Web原有接收人替换成中央账号 |
| 响应 | 本阶段已命名接收家族通过 | production-serial-samples18×5=90，最大235ms/确认119ms；production-web-joint-samples6×5=30，最大185ms/Web保存101ms。只覆盖表内动作，不代表全毛织/裁床/整站响应通过 |
| 首轮采样条件 | 不用于阈值验收 | production-samples的90条虽通过，但启动时索引未结束；condition-review标明不可用，完整原始记录保留；后续正式串行轮独立记录 |
| 单元/类型/构建 | 局部技术检查通过，整体类型未通过 | 全量1497通过，发生在最后首次读取入口/文案修正前；最后受影响范围33项与实际当前构建页面另验通过。Vite23.74s通过。完整tsc19条与C01冻结逐条相同，不称全量类型通过 |

当前源码和构建身份见c02-wool-receiving-version.json（201运行/测试文件、1305资产）；其详细SHA256及每个JSON/日志/截图在本阶段不可覆盖的进展包中绑定。CodeGraph已同步本工作树；未经本轮修改的原4832工作树继续保留。没有连接测试数据库。

本阶段语义审查：逐项从接收入口反查原prepare/confirm与PCS保存，保留上游、批次、kg净重/整数片、实际物位和原操作者；显式账号分支不删除原调用边界；来源版本标记只在真实接收改变时写入，普通读取不写种子/标记；已提交失败不冒称未保存；默认管理员界面没有岗位权限说明。没有将毛织自动内部衔接重新做成一次员工接收/交出。尚未提供C02加工/两仓/最终回货操作闭环，本段不能证明它们完成。

本轮结论仍为**实施中，整体不通过**。未关闭：C02部位片及原外发链、加工与自动内部衔接、两仓/备料/领退、机器/完单、其余并发/旧源边界；C01此前四个加载家族慢样本、整袋及普通新生产路径；其余中央/三方、最终迁移/治理/收据、发布和用户接受。未提交、推送或部署此中间业务版本，目标保持active。


## C02加工填报与原生按键进展审查（2026-10-21）

继承C02及X01～09。当前只完成逐SKU填报、原自动衔接/实收查看和本轮恢复/按键修正的实施范围，不关闭完整毛织或整体目标。当前204源码/测试清单7acab60b1a0c3f252aace81b4c784eb502a3734e8c39134dbff21794e5ff29a8、1308资产清单8f7bd4bdfe3be6dfa072c94eb05d1387828ae38146d770e3094a7b5237c0ba17，实际服务48339开发/48340生产预览，320×480/Asia-Jakarta，Web1366×768；无实机操作接受，未连测试站数据库。

本阶段受管差异：

- `src/data/fcs/wool-domain/command-order-scope.ts`
- `src/data/fcs/wool-domain/store.ts`
- `src/pages/central-pda/wool-execution-view.ts`
- `src/pages/central-pda/wool-model.ts`
- `src/pages/central-pda/wool-page.ts`
- `src/pages/central-pda/wool-ui.ts`
- `tests/unit/central-pda-wool-receiving.test.ts`
- `tests/unit/central-pda-wool-report.test.ts`

语义审查：按实际SKU判断外工艺/自动缝盘，件与片不互换；原操作人/独立实收保留，无假0；默认厂只用于首次无明确选择，明确选择不被暗改。runWoolRecordCommand只保护实际staged写入事实所属加工单，原生加工额度/完成先后/接收竞争和不同单据分别验证，未推定机器/共享库存或旧版本并发已解决。草稿只在内存，普通读取和四规格选择不写业务种子；未新增云服务或业务localStorage。姓名和正式图片使用原资料，未虚构译名或素材，当前缩略图放大/关闭及最终三张320截图均核验。

关键失败及修复：按键red/diagnostic复现保存按钮获焦后Escape导致3件误保存；最终忽略委派keydown动作，原生click与本地字段键盘处理各司其职。输入新笔时局部更新清掉上一笔保存提示，自动聚焦显示整个label。最终原生Enter只写一次7件，下一笔3件返回可续；包括错码、分规格/单据、清空/切语、账号实际换人和事务成功后只读失败恢复。其他中央模块按键路径仍待独立核对。

验证：1503全量单测对最终未改模型/存储依赖复用，最终15相关契约/构建31.22s/CodeGraph通过；完整tsc仍19条同基线，退出2。当前6组共400有效样本/80家族功能通过，79响应家族通过；Web报告cold第4样本1067ms未过1000ms门禁，保留原始数值，原因未定位。原失败、旧版身份、采集器错误及可见图片终点修正均分别记录，未用旧样本冒充当前通过。

结论仍为不通过：完整C02未完成，1067ms响应、手动交出与外工艺回货、两仓/领退料/设备/完单及整体其他条目继续。当前阶段冻结output/playwright/pda-factory-split/c02-wool-report-progress-freeze.json；不是最终收据，未提交/推送/部署/用户接受。


本阶段原型治理检查实际未通过：首轮缺少初始“受管文件”段的明确列名，已补齐；covered轮覆盖11路径后，解析到本记录基础阶段保留的`npm run build`失败，继续退出1。原失败未改写成通过，当前整体结论也仍不通过；这不是新的业务保存失败，也未运行最终workflow收据。不把局部400样本/构建通过冒充完整治理通过。两份原始governance日志与退出值均保留在本阶段证据中。


## C02.03a 手动交出与本笔实收查看的阶段审查（2026-10-21）

当前实施和证据详见wool-source-audit末节及矩阵C02.03a.1～7；相对父冻结12个运行/测试文件变化，受管路径已补齐。当前209源码/测试、1309资产版本为c02-wool-handover-actor-fixed-version，源码清单98969bdee2ad30d75df842cf1f426912f9f1ed9792f9831ceb6077587a981c1d，资产清单a0a0bae003f10466a3020821688366d3cbe1022bc01d75e1329b483c7dee1a68。

- 通过（本轮命名范围）：件/片分离、实际下游、实际收方分批2+1、未知与明确0、加工/交出草稿隔离、错误扫码/旧批只读/本笔全部切换、两真实账号、稳定重试与原子回退/并发、实际原Web二维码SVG及款图。下游新中央工艺PDA尚未接通，不以原命令/原Web通过代替它。
- 通过（本轮修正）：仅横机要求其来纱；缝盘按全部所需部位真实回货容量。重复读回失败保留已提交锁定，恢复不重交；已提交输入退出不假报未提交。最后23相关契约、生产20故障场景确认一次native提交。
- 通过（本轮UI）：320×480印尼语当前实物/单位、全部输入框和明确数量/下游的两行主按钮；生产PNG已查看。frame未传context168种HTML相同；原特殊工艺翻译字典/函数纯移动且其余字节相同。当前默认未知接收人名称不编造翻译，按严格来源关联显示原实际账号。
- 当前检查：本阶段早先1511全量单测通过；最后只读接收账号补丁后23相关契约通过，未冒称全量重跑。Vite23.94s通过，完整类型检查仍19条相同诊断、未通过；CodeGraph同步结束后正式采样。785有效样本/157家族各5条最大975ms通过；85有效前缀和另70尾段有明确采集器终点修正，五个原超时保留、不当作0ms或产品失败刷掉。
- 不通过（完整任务）：C02工艺厂新PDA/两仓领退纱/设备/完单、其余中央/三方和旧消费者迁移仍未完成；父版1067ms及C01旧加载失败未诊断，不用当前快值覆盖。原治理仍含基础阶段真实失败，本阶段不生成最终workflow回执、不改写历史为通过。

结论仍为不通过。技术确认人Codex；进展包c02-wool-handover-progress-freeze，不是用户接受或交付。不提交、推送或部署中间业务版，原4832工作树继续保留。未连接测试数据库。

本阶段最终范围治理已实际运行，覆盖12个运行/测试差异及本审查记录共13路径；退出1，仍因基础阶段验证段的`npm run build：失败`不属于现工具允许的“通过/不适用”枚举。原始失败不改成通过或不适用；当前governance日志/退出值已保存。git diff --check退出0。最终治理和整个目标仍未通过，未运行最终workflow回执。


## C02.03b 毛织片工艺单独立接线审查（2026-10-21）

整体结论仍不通过/完整任务未完成；本段继承原完整范围，不把原Web业务或现场行为当已实现业务能力。负责9文件见wool-source-audit末节及source-review-map：新wool-craft-model/page/7契约、entry、frame仅类型、routes-central-pda、special-model/page显式入口、warehouse实际taskId/部位SKU源图只读定位。主代理已核当前3新增文件及6修改文件的父版本哈希字节差异；普通工艺写法未放开毛织源，原执行/原实收命令及同库事务继续。

接收页仅原实际来批点收，默认物位不露；原片/potong与横机件/pcs不换算成另一事实。加工/交出草稿独立，原上下游及实际确认人可读；原100片计划和150%填报上限区分，实际下游100片收齐后才能完工，未回齐其他部位仍不可缝盘。保存按键blur丢click、最新实收未刷新、16笔接收只有15笔无更多、首次读失败无恢复、明确退出后被旧读错误挡住五个实质问题均有红证据与当前回放；原生race、Quota原子中止及稳定重试未另造库存。只读姓名关联限实际工厂，有接收ID时按ID，不猜跨厂同名人。

最终UI补丁前完整1518/1518及npm run build通过；最终26相关契约、Vite27.44s（命令总耗时28.33s）通过；完整tsc仍同19错误，不通过。当前source-manifest 3fdde507885a87e9803de58c5cd49df050efaf2087c06269a7f2bdefa135bfac，asset-manifest 2ca52b3e70a59525d2e6f13fc7b14c1c3c9e0082750eaed1cc565e5af28a45cd；最终生产预览320×480/Jakarta，当前独立outgoing/location/complete PNG人工查看。真实图仅继承原工单styleImageUrl，X10全量对应仍未关闭；不是工厂/真机驱动接受。

生产原始500样本中，495条有效归属99家族、各5条、最大979ms，功能/持久结果正确。原记录组1017ms仍在原JSON；该点击家族整组5条缺少前次刷新就绪起点，已逐条另记不用于命名点击门禁。诊断捕获0目标时已开始计时，不能据此证明历史1017产品已修复；无产品变更后另测真正页面刷新5条最大869ms、就绪目标点击5条最大138ms。全部条件、排除整组而非仅慢值的原因见login-fixed-endpoint-review；原父Web1067和C01失败不改标。最终模型/存储未改而复用1518的边界有记录，不假称最后UI补丁后再次全跑。

读写中物理返回/跨路由的异步作用域、工艺仓管跨来源聚合、毛织本厂领退纱/备料/机器/完单、旧源和其余模块等继续；完整任务/治理/收据尚未完成。没有提交、推送或发布中间版，没有测试数据库连接。原4832保持，技术确认人Codex。

本阶段原型治理实际覆盖9个运行/测试差异及审查记录共10路径，仍退出1：基础阶段保留的`npm run build：失败`不属于工具允许的通过/不适用枚举。原失败及所有后续成功构建分别保留，不改写历史或放宽工具；当前治理日志/退出值已保存。git diff --check退出0，原4832 clean、HEAD 5ac7c58cbc657925541a4d2868512c2b4ad17f65。未运行最终workflow回执。


## C02.04 本厂纱线两仓、备料分配与领退纱的阶段审查（2026-10-21）

继承 c02-wool-craft-progress-freeze，SHA256 01b371562cb2ca65fdf9ab503bfba4b2e0a97bee46a131575b082877ab2b1c88。整个拆分目标仍未完成，本节不替代上文历史版本，不将原Web本地业务操作说成工厂实操。主代理负责并核对本阶段相对父版9个运行/测试文件：新增wool-warehouse-model/page与直接契约，entry/frame显式独立路由/事件，factory-receiving-links可选实际allocator，wool-domain/store共享明细原子版本保护，wool-handover-model仅收窄只读账号关联参数，以及原handover契约补实际收方断言。

业务事实仍是原FactoryReceipt/ReceivingAllocation/WoolYarnIssue/Return/WoolWarehouseFlow，原PCS同库原事务；页面草稿只在内存。接收还在接收，原加工/交出/实收还在执行；仓管沿真实配置两仓、具体物位、未分配备料、领用和余纱退回。kg有限正数及原精度、单/SKU/批次/物位、零库存可退、跨物位原累计上限、分配不重增库存及实际经手人保持原逻辑。未新增后端、鉴权、业务localStorage快照或通用盘点；Web已有移库/调整尚未适配，不声称两仓全部完成。

已保存真实旧设备会话误挡、1+7+7超分15kg、回退后换人迟到失败恢复旧草稿三个产品失败；当前明确实际actor，新增原生同明细分配ID集合/expectedVersion guard，丢弃代次阻断旧恢复。实际两个意图均到原提交屏障后只有1+7保存，余2；单独漏通知场景内存旧分配但原生guard已新，旧10kg拒绝，重读后9kg可分，未用内存锁或同步双写冒充保护。Quota原子回退、稳定重试与提交后读失败恢复均有直接证据。

本轮进一步修正仓管交出记录漏实际接收人/时间/待收余量、读取初始数量而非原有效数量、历史演示经手人中印混排、裁片/成衣默认物位显示同名、翻译丢失部位序号。只读投影复用原有效数量与精确原批/部位/工艺/接收厂匹配的实际账号关系；未知与明确0区分，不在仓管代接收，不增补数量不符或例外处理表单。原默认纱线/裁片/成衣三位置分别显示；真实物理库区/货架/库位及空位置保留。图仍来自原纱线实物图/款式参考图，X10正式全对象对应仍未完成。

最终 location-fixed 源码215文件清单 dc098199fcc0d7edbc77e47476307dbf96420bc2f9e8a8ef082aa446867b8cfe，1316资产清单 c6bbee1c49200fc413b3dc2a65ea700c1f28912dcff6137fff122b6101f2c72d。最终1525/1525全单元、engineering与Vite27.72s通过；此前37直接契约已通过，最终全类型仍原19条、无新增/删除，退出2。没有把tsc写成通过。源码同步后才开展最终320×480/Jakarta/印尼语真实点击采样，最终实测数字见本节末尾，不用旧版证据替代。

旧local版835样本/167家族各5最大955ms的证据仍绑定旧a455ad4e/0145149f，不改标最终资产。其后真实原Web实收后的刷新单轮1050ms超过阈值，保留未解释；原父1067及C01加载慢家族未关闭。原刷新后误等交出框和原生Row信封解码错误属于采集器错误，原失败文件保留，后续终点按真实页面状态分开记录，不删除或把它们当0ms。

整体结论继续不通过；机器/本厂完单、移库/调整、其他毛织及工艺仓管聚合、其余中央/三方/旧入口迁移、图片、历史性能、完整治理与最终收据继续。无测试站数据库连接，无提交、推送或中间部署。技术核对人为Codex，不代填用户接受。


最终生产预览 `c02-wool-stock-location-fixed-production-summary.json`：六组1040有效样本/208命名家族、每家族5条，最大679ms，功能/原生回读与本轮命名响应通过。分别为部位片与原Web实收/仓管205（最高617ms）、本仓分配领退/页内连续作业180（378ms）、原生写/读故障恢复165（243ms）、原接收90（428ms）、原填报175（431ms）、后续真实工艺225（679ms）。全部来自同一最终源码/构建的实际点击，图片需加载且完成绘制；没有运行构建/索引与正式采样相互争抢的检查。单轮校准和额外图片定位回放不计入1040，不拼接旧local版835。原1050ms刷新、父1067与C01历史失败保留未关闭。

主代理按父清单哈希恢复6个已有文件原字节，加3个新增文件，共9个运行/测试差异做语义审查，最终source-review-map/parent-diff与原父字节留档。共享变更限实际allocator、同接收明细分配保护、原只读实收账号关联函数参数；原units/数量/工序动作/责任/同事务边界未替换成新业务事实。正向对照C02.04.01～08，反向核对entry事件/新model/page/原命令及测试，新增默认位置和部位识别分别登记，不因本轮通过缩减原完整目标。

最终320×480领用输入/固定主按钮、库位首屏、工艺交出三张生产PNG已目视检查，额外实际Q / 第2片余4片图片单独记录并已目视核对；这些是浏览器原型检查，不是真机按键驱动或印尼员工现场接受。图片仍继承原资料，X10未关闭。本厂机器/完单、已有Web移库/调整、跨来源整厂历史聚合、共享机器及旧写入并发、其他中央/三方、历史性能、最终治理/收据/发布继续；无提交/推送/中间部署。


本阶段原型治理实际运行覆盖9个运行/测试差异及3份需求/审查文档共12路径，退出1；仍是基础记录中真实 `npm run build：失败` 不属于现工具允许的通过/不适用枚举。没有将失败改写成不适用或放宽检查器。日志/退出值保留，git diff --check退出0；原4832 clean，HEAD 5ac7c58cbc657925541a4d2868512c2b4ad17f65。未生成最终workflow回执。阶段进展按 c02-wool-stock-progress-freeze 单独封存；此封存不会把整个拆分或历史失败标为完成。


## 2026-10-22 毛织独立完单与整组机器接续

C02.05.01～07实际六文件差异与原Web规则见wool-control-source-audit及current-source-review-map。原计划/直接下游实收/整组快照/占用转移确认未放宽；当前实际账号记责任，完单与横机整组解除同库，成功后只读；缝盘不解除横机。稳定原机器操作日志只在可选新命令号调用时保存请求和原结果，不抢回后续已转移/释放机器，原Web无参数语义保留。

真实当前工程类型检查、1529单元、原stock-machine及Vite通过；完整类型仍相同19条原诊断未通过。生产预览320×480/Asia Jakarta，106家族530样本均≤1000ms，最大640ms，覆盖新控制动作/错误恢复及相邻接收、加工、分批交出/实收查看；原始红绿、采集错误和旧有效慢样本保留。quota初期全投影比较受4张只读派生TASKGEN单影响，最终原生records全库中止前后完全一致，不掩盖存储失败。

真实按键/浏览器Back、换人及晚到失败、旧事实确认、转移来源变化、已保存锁定、全/部分机器解除及直接收方99/100门禁均有隔离证据；两张320小屏中印确认截图已查看。原型数据不代表物理工厂操作/真机接受。当前文件已纳入受管清单，旧历史build失败与整体结论不改为通过；不生成最终完成收据，不推送发布。整个拆分仍实施中，下一步继续当前工序未闭合分支及三方范围。


## 2026-10-22 三方交接/通用任务边界与KOL底栏

S12.01～03及S13.01：实际三方账号能看到外厂水溶1134/1512米接收按钮及独立裁片180片交出，已在详情/列表和实际事件加入当前厂与原任务冻结三工序范围；上游裁片信息沿真实车缝任务保留。原生注入异厂头后PCS及旧storage均不变；真实登录两笔本厂任务和原交接保留，其他旧查询工艺入口无业务动作。KOL当前也属THIRD_SEWING，旧例外优先导致仓管菜单仍在；新三方优先判断去除仓管，原Web KOL与结算角色条件不改。

实际7文件完整差异绑定s12-third-party-scope-final-source-review-map（准确毛织控制冻结/基准HEAD）；8专项/最终1532单元/工程类型/Vite通过，完整类型仍原19条不通过。开发采集错误、真实原始漏洞和旧有效慢样本都保留，正式当前版本性能另记录。不是完整三方、中印/按键/真实车缝三模式生命周期或旧入口退役验收；具体未闭合分支见third-party-source-audit。无中间推送或发布，整任务结论不改为通过。


## cold-fixed 三方连续返回/冷入口与共同只读来源复核

实际新增修正：原共同生产来源仅合并正在进行的同一只读hydrate，不排队保存或迁移；实际原生故障两读同错、一次读取、恢复0写且全行不变。main.render在等待内容后先取消过期渲染，避免旧冷重定向抢先加载未初始化处理器；正常目标仍先准备资料。三方不允许仅支持辅助/捆条的双段执行路径，三种车缝单段不变。完整12文件差异及hash恢复绑定cold-fixed-source-review-map，旧生产失败和AST夹具错误全部保留，不以重试原样采样掩盖。

当前工程类型、1537单元、Vite通过，完整类型同19条原错误；生产320×480三账号和相邻毛织、1366×768原GTP/HILON读取共50家族250样本功能通过，但KOL登录1060/1048ms使1家族性能未通过，整体性能不通过。普通最高934、卫星909、毛织556、原WLS387ms。WLS前版要求未滚动lazy远屏图全部加载是无效采集，实际视口诊断后改采必要可见图，未更改产品图或减少源记录。仍非完整三方/剩余中央/图库X10、真机或用户接受；历史治理结论保持不通过，不发布中间版本，不生成最终完成收据。


## C02.06 毛织仓储剩余功能与连续作业技术收口（2026-10-22）

以原 Web 两仓命令为准，实际物位移库、默认位0库存调整、公共位置按端点转出/转回均接入同一原子命令和实际PDA账号；库存操作没有替代或增加加工实绩。修复原默认位调整误合并实际物位数量、部位片不被识别为库存对象及物位转移硬编码kg的问题，保留停用/本厂/不同目标/余量/整数/必填原因与原稳定确认号。原Web保存期间固定确认时快照并锁定重复操作，原手填操作者仍保留，不把它冒称PDA自动账号。

普通和毛织工艺仓读取原事实、分批、下游和实际责任，未登记实收保持未知；补齐旧纱线/部位片记录，混合时间按真实时间排序。小屏修正目标第一次点选被失焦重绘吞掉、重扫后的旧scan内存值、返回丢仓类别/库位及0默认库存不能再打开；库存和SKU候选每批15条。实际SKU41个纯文字候选先红，现有对应图片、单位/物位/批次/单号，并可看图返回、在候选切语言、F1回可见扫码框；图片只复用原对象素材，款式参考明确标识。

stocktime构建12个命名采集器316家族1580次全部通过，最大915ms；覆盖接收/分配/领退/报告/部位工艺/交出与实收/机器与完单及原Web相邻。随后只修改wool-warehouse-page候选UI，candidate-bounded三采集器85家族425次通过；compact仅去重复SKU及空批次分隔符，9家族45次通过、最大100ms。两次源差异均仅该页，其余234个源文件哈希完全不变，未把旧采样改名为新版本。最终原生中止/冷读/稳定重试/实际并发及三类页面写后回读恢复通过。

compact工程类型、1547单元、Vite及两个受影响Web页面列表静态检查通过；完整类型仍相同19条原错误，无新增/删除，不称全量类型通过。原毛织事实综合专项在stocktime通过，domain/命令/检查器源哈希至compact未变，按SCOPE-02复用。19个实际变化源逐文件与14个准确父源/5个新源审查，原测试断言保留，纯模板检查与真正异步入口浏览器检查分开。当前索引已同步。真实320×480中印/候选/转移截图已查看，浏览器隔离动作不等于物理工厂或用户接受。

该阶段闭合C02.06自身功能与技术核验；旧入口全面归属、全任务图像审查、其他中央及三方全部生命周期、全局治理/收据及现场接受仍属于后续共享项，整拆分结论仍未通过。不提交、推送或发布中间版本，不生成最终完成收据。


## C03 染色及必要印花owner相邻修正追加（a1000，阶段技术核验）

当前源码/原Web规则已确认：20处源差异及各自用途见c03-final-source-review；详细原生错误、定位、未放宽的规则和修正见dye-output-source-audit。真实早期单缓存读回、历史连续第二笔归属、按稳定ID核验原记录等价、同单下一批显示、图片门禁/性能合并、当前真实空队列工厂/账号均有原失败及正向证据。未删除原错误记录或自动清理冲突数据。

1627项全量单元通过、当前工程类型检查通过、Vite最终编译通过。全量tsc仍同19条既有范围外错误。49家族245样本、最大885ms归属final-continuity；最后两处工厂显示回退仅按actual factory.code替代内部ID，exact source-equivalence及最终五次空队列/换人/语言/0写入证明有效，五次冷页最大410ms。C02毛织共享入口当前相邻9家族45次通过，原毛织完整证据保留旧版本。

当前320×480原单位/真实图/字段焦点/扫错/重扫/返回、两类提交恢复及独立收方事实已技术核验。原三ownerDye合单保持每行原下游/原单位，四种原生Quota/已提交读失败/稳定重试不丢不重；Print源不同下游拒绝零写入、普通/历史58Yard合法合单及独立Web实收已相邻验证。浏览器和Mock检查不是现场工厂或物理PDA/扫码枪/打印机接受。

部分keyboard截图克隆曾复用coalesced名称，已按最新runner时段/哈希独立复制当前图；不能将被覆盖文件名再当旧版本视觉证据。记录见c03-current-screenshot-provenance；原JSON/native断言证据未改。

本段仅收口C03阶段技术结果，完整拆分仍不通过；其他中央工序、第三方三个车缝组合、全任务X10/X11/治理/最终收据继续。不提交、推送或发布中间版本。

## C04接收/仓管连续作业局部收口（a1000 + continuity）

范围与实际编号C04.14～22及C03.49，见printing-source-audit与requirements-plan-matrix新增逐项证据表；整体结论仍不通过，其他工序、三方、迁移/旧入口和最终全目标验收尚未关闭。没有任务中间提交、推送或发布；没有连接测试站数据库。

主代理当前审查：新Print备料读写/视图、原固定联合事务的source直接引用及命令版本标记、已分派Print/Dye接收原confirm接口、原卷来源身份与同源下一卷回调、当前数量/单位/焦点、退出清理。旧owner按原集合/id/version继续使用，接收/上游实收/相关命令原子，不另存库存；分配只用原实收单位的未分配量与原目标规则，不重复入库；没有商业接单/审批/身份限制卡、通用盘点或新后端。原三类owner/材料及其余任务的完整结论仍须逐项接续。

当前实际证据：原DYE→PRINT四次2米交出/八次1米独立实收及原生五集合一事务、逐集合中止/提交后读取失败/稳定重试/冷读；Print未关联备料原生三集合中止及两页同卷争抢一胜一拒；8 Yard分配2.5/5.5、未分配0且接收数不变；320×480来源/卷/单位/焦点/续填/真实换人/恢复无假草稿。连续17家族85次≤520ms，仓管11家族55次≤490ms，错误0，后者0业务put。完整1637单元通过，engineering范围0、全量既有19条仍不通过，最后仅当前页焦点/回调后engineering再次通过、Vite26.30秒。版本c04-continuity-source/asset-manifest；阶段增量冻结另附，不将当前结果挪给其他版本。

失败记录保留：原confirm引用缺失真实旧PDA接受、OTHER来源完成后把库位搬给NEXT、Footer遮数量、图片键盘/冷入口及过期标签均保留其各自原版本。夹具错走Print→Print、错误STOCK创建、错误故障注入集合、语言/登录导航等采集断言错误也按证据身份保留；未为通过采集而改放行或清理业务数据。当前两张continuity最终截图已查看，物理PDA/真实工厂与产品接受尚未宣称。

## C06.20 实际交出后恢复加工（2026-10-22）

主代理审查原水溶暂停域、卷dispatchId正式交出时序、中央事实/页面/翻译、原生持久及实际两批实收，局部修复已验证；整体仍不通过。源路径、需求与证据见standalone-water-source-audit末节和矩阵C06.20a～c。已有交出拒绝清空、0写；继续加工保留1034/100/934，实际两批100+934分别实收，完单实际UID/时间保留、稳定重试0写、冷页一致。当前完整1639单元通过、engineering范围0且全量19既有问题仍在、正式Vite构建26.82秒。320×480印尼语输入/主按钮及换人、返回、语言真实浏览器操作通过并查看截图；27家族135样本均≤920ms，错误0。没有实机员工验收或发布。冻结c06-rework-guard-progress另附实际源/资产和证据哈希。

继续核查已复现C06.21缺失上游引用的接收绕过，原Web拒绝而当前PDA误收5米，属于下一直接修复，不能以本阶段已有正常接收测试宣称所有来源通过。显式迁移、其他中央/三方工序和完整总验仍未收口；没有连接测试数据库、提交、推送或发布。


### C06.21 / C06.22 当前接收与连续作业结果（2026-10-22）

水溶接收现沿原Web `confirmFactoryMaterialReceipt` 确认，原本单/账号预校验和共同事务保持；缺失原交出引用时Web/PDA同拒绝、0写，不以受控来源冒充真实跨工序正向链。原确认模块在事务前异步加载，事务内仍同步执行。`c06-receipt-lazy-confirm-cold-actors`证明受控10米来源4/6分批、实际两员工、三参与集合逐一事务失败后字节不变、稳定重试0写、独立冷读10米接收及10米投入。旧collector误以冷读记录顺序代表业务顺序的失败保留，按实际UID/数量核验，未修改产品规则。

接收错误原先在小屏上方不可见；现在只在失败时滚动到真实提示，数量/库位保留。`c06-frame-read-error-small-ui`、`c06-frame-read-alert-visibility`在320×480验证印尼语、返回/切语言续填、退出换人空表；错误y138高98，底部主按钮y412高56，0写。没有弹出额外确认层。

同一次同步frame内复用原单读取，finally即释放；不跨事件、await、保存、账号或工厂缓存。`c06-frame-read-multitab-ui-guard-reload`原生两页竞争同一卷只有1次占用成功，失败页保留扫码，重新读取后仍拒绝已占用卷。正常22家族110样本`c06-frame-read-five-performance`最大970ms，0页面错误，涵盖4.125/5.875米分批、投入、卷/标签、打印请求及确认、交出、错码、事务失败/重试、实收视图、退出真实换人。印尼语不改变原单位或独立收方责任。

此前static-confirm、lazy-confirm、visible-confirm的真实超时和CPU诊断全部保留，不追认原版本通过；当前结果绑定`c06-frame-read-source-manifest.json`及asset-manifest。C06.21/22局部技术验证不关闭显式旧源迁移、全部原上游接收来源、其他工序和最终治理收口，不发布中间版本。


## C06.23 显式旧水溶迁移局部核验，整体仍未完成

当前6f477+legacy-final，原旧水溶逐单校验/复制/读回/核对回执/定向清理及当前未包装旧写阻断；共用其他工序旧账不清理。原生8路径、独立冷读、320×480实际印尼语恢复入口及未确认拒绝/成功重新加载均通过。main中央入口原未await导致异步恢复未捕获，原小屏和诊断失败保留，补await后同场景通过。23直接、1647全单元、范围类型0/全量19既有、Vite28.78秒；普通22家族110样本≤910ms、恢复3家族15样本≤465ms，0页面错误。准确源码/资产及delta冻结见c06-legacy-final-progress，不冒称其余工序/三方/全共享旧源已完成；没有提交推送部署。


## C07 捆条及C08连续作业接续（6f477 + binding/qr，进行中）

原Web捆条原单仅内存保存，原冷读反例保留；现Web/PDA/打印共同读取按记录原子保存的原单、规格、两仓/交接及原实际操作记录。C07的实际数量/并发/独立收方/图片打印/连续返回，和C08原纸码、空工厂账号、已提交回读失败锁定及硬键盘均已实施并有局部验证。业务源、影响、原单关系和原子矩阵分别见binding-source-audit、special-current-source-audit及requirements-plan-matrix的C07/C08.21～24，不复制旧PDA模板。

捆条当前Web原输入/产出均米、宽度cm，按规格比例授权，交出按整单，短裁完单按原备注；已完成仍可交余量。多规格.75接收/.10产出，分.04/.06交出后保持原已完成；实际后续员工UID进入原动作和交接，收方独立确认不会由发方代填。真实两类集合配额失败无半套、同单两页1成功1冲突、不同单同时成功；原仓ID全局序号碰撞反例保留，新增记录改原单稳定ID；稳定重试不重复写。独立原收方.1m冷读、原电子打印卡、原纸码和旧入口重定向已实测。原共享process-only捕获遗漏的反例也保留并修复，未放宽收方判断。

C07原生及页面证据：c07-binding-native-record-first、faults-and-parallel-stable-ids/same-order、continuity-small-ui-locators、web-save-native-cold、committed-readback-retry、qr-receipt-print-original-actor、pending-back-ui、receive-history-pagination。后者通过实际16次.01m接收证明15条首屏/继续加载16条；保存中设备返回只清理对应单据，不把提示带往下一笔。320×480截图与各源/单位都在同名证据目录，未声称物理打印或现场验收。

C08原接收页无法识别Web纸码、无该工序任务的中央账号被拒、已提交回读失败仍可改数和键盘登录/扫码后焦点问题分别保留反例。修复后16当前单一工序各自原纸码/原投入产出单位/上游/无加工交出或库位选择，空工厂实际DYE-GOTO-GLOBAL_operator不采用外厂任务；恢复时锁定6件，切语言/返回/清空均不能改，重新读取直接恢复下一笔，原生仍6件。实际操作员键盘6收/4加工/3交出，3条原动作均本人UID，对方实收0；数量框y249～307，主按钮y412～468，320×480无溢出和中印混排。c08-keyboard-continuous-focus、c08-committed-input-read-complete、c08-single-operation-qr-empty-factory。未有其他当前对象/单位来源的分支不伪造测试单冒称全覆盖。

c07-binding-continuity-build是上一个稳定产品版本的1656全单测+Vite通过；本次最后新3项扫码/空厂及原9项捆条共12专项单测通过。当前新小屏控制器字节仍需最后范围类型、生产构建及正式性能。c07-binding-production-calibration仅1轮38家族校准正确，运行时同机QC测量尚未结束、且不是最后资产，明确不作为五样本性能通过；正式计划在c07-binding-performance-plan.md。当前整体结论仍不通过：C07正式性能/最终旧消费者，C08全独立下游/迁移、剩余中央工序、三方及最终治理未关闭。没有提交推送部署。


### 本轮 C07 固定采样 / C08 空工厂定点整改 / C09 花边基础

C07 38家族190样本≤466ms、0页面错误，已查看320×480 ID仓管截图；源码/资产绑定c07-binding-current-progress-freeze，原功能故障/冷读沿用原身份，X11旧入口最终清理仍开放。C08 30家族150样本的空工厂刷新1033/1017ms不通过；已定位并减少工厂菜单构造不需要的毛织接收投影，7直接契约及范围0通过，固定新资产复验待补。实际查看ID数量框/底部禁用按钮、工作余量与账号可见，未宣称物理PDA验收。

C09 新花边逐记录和中央模型只是实施基础，尚无产品页面/原Web共同入口接通。原生Yard 20/8/7、余12、配额回滚与独立冷读通过；4模型契约及3记录契约通过，原Web校验不改。整体仍不通过，继续实施，不提交/推送/发布。

## C09 花边接通与织带接收/逐记录存储（2026-10-22，整体仍不通过）

### 本阶段影响判定

- 记录模式：完整产品审查（T4）。改变花边/织带页面读取、PMS 织带存储粒度与保存时点；新增中央织带接收入口。
- 完整目标仍 active；本记录不替代 C09.05～08、其他中央工序、三方、迁移、最终治理或发布。

### 本阶段自查

| 检查项 | 结论 | 证据 / 边界 |
|---|---|---|
| 花边逐实体保存、命令去重、独立收方 | 通过局部 | c09-lace-native-record-atomic-harness-fixed：配额失败原单仍待接收、0 行、重试不重复；20/8/12/7、22 行、冷读一致。原双实例 harness 失败保留 |
| 花边中央四动作、320×480、中印、换人 | 通过局部 | c09-central-lace-small-continuity-visible-rerun；原 Web 冷读 c09-lace-original-web-record-ui-rerun |
| 花边启动壳层 | 通过 | 路由改为惰性加载；craft-startup-chunks 通过；1667 单测与 Vite 构建通过 |
| 织带逐记录存储 | 通过局部 | 新 pmsTmfRecords 行覆盖旧只读 section；旧标签写入拒绝；配额失败 0 行、同号重试不重复、冷读一致（c09-webbing-record-contract） |
| 织带中央接收（直接来料/端头辅材） | 通过局部 | c09-webbing-receive-contract-production：320×480，5 米接收、原生行、刷新 5/15、印尼语无混排、无溢出、退出换人不带草稿；中央弹层事件已改挂应用根 |
| 中央接收与原 Web 同一事实 | 通过局部 | c09-webbing-web-cross-surface：中央 5 米→Web 冷入口显示“本厂实收 5 米”、列表“部分接收”；c09-webbing-web-write-cross-surface：Web 2 米→刷新与中央执行页同读 2 米；旧 section 均未写 |
| 退出草稿与换人 | 通过局部 | 未提交 3 米时退出显示放弃确认；放弃后登录 FAC-TMF_operator，上一账号草稿不可见 |
| 织带 Web 详情冷入口 | 通过 | 详情渲染前等待已存记录，不再清空内存报“加工单不存在”；1366×768 实际打开 TMF-WO-MOCK-001 |
| 染色/印花回料接收 | 未通过完整 | 页面已按原交出路由到 receiveTmfPrint/DyeMaterial；无实际交出来源回放，C09.04 保持实施中 |
| C09.05～08 截断/打头/装包/交出/退回/分类 | 未实施 | 页面执行/仓管只读，不显示假入口 |
| 物理 PDA、现场、完整迁移、最终治理/收据 | 未通过 | 仅本机 Chromium/生产构建 |

### 性能

生产预览 127.0.0.1:48340，320×480，Asia/Jakarta，各样本新上下文，列表/详情/保存均含可见内容、图片、两帧；保存另读原生持久结果。`c09-webbing-receive-performance`：列表冷页最大 409ms、打开接收 151ms、保存 100ms，5 样本全部 ≤1000ms，页面错误 0。该证据只覆盖这三个家族，不代表 C09.05～08 或其他工序。

### 本阶段验证命令

- `npm run build`：通过（1667 单测、Vite 构建）；最终 `c09-webbing-overlay-build2.log`。
- `npx tsc --noEmit`：本次新增/直接文件 0 错误；全量仍有 19 项既有范围外错误，未称全量通过。
- `node --import tsx --test tests/unit/tmf-*.test.ts`：88/88 通过；`c09-webbing-foundation-tmf-unit.log`。
- `node --import tsx --test tests/unit/craft-startup-chunks.test.ts`：通过。

### C09 本阶段受管文件

- `src/data/pms/idb-storage.ts`
- `src/data/pms/tmf-material-purchases.ts`
- `src/data/fcs/tmf-base-demo.ts`
- `src/pages/central-pda/webbing-model.ts`
- `src/pages/central-pda/webbing-view.ts`
- `src/pages/central-pda/webbing-page.ts`
- `src/pages/central-pda/entry.ts`
- `src/pages/central-pda/frame.ts`
- `src/pages/central-pda/page.ts`
- `src/pages/central-pda/lace-page.ts`
- `src/router/lace-records-loader.ts`
- `src/router/routes.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes-central-pda.ts`
- `src/router/routes-tmf-webbing.ts`
- `src/main.ts`
- `src/pages/process-factory/accessory/webbing/work-order-detail.ts`
- `tests/unit/tmf-legacy-migration.test.ts`
- `docs/product-design/pda-factory-split/requirements-plan-matrix.md`
- `docs/product-design/pda-factory-split/accessory-current-source-audit.md`
- `docs/product-design/pda-factory-split/requirements-plan-matrix.md`

### 本阶段治理结果

- `npm run check:prototype-design-governance -- --scope worktree --paths …` 退出 1。检查器读取本文件基础阶段的“`npm run build`：失败”历史命令并判为当前验证未通过；未改写历史、未放宽检查器。本次新增源文件的构建、单测、直接浏览器契约和性能结果分别有原始证据；完整治理与最终收据仍不通过。

### 本阶段结论

结论：不通过（实施中间版本）。花边局部完成不关闭 C09；织带接收仅直接来料/端头辅材通过，染印回料及 C09.05～08 未完成；完整拆分、合规治理、技术收据与发布均未完成。未提交 main、未推送、未部署。

## C09.05～07 织带截断/装包/交出/余料退回（2026-10-22，整体仍不通过）

继承 C09.04 的逐记录存储与中央织带页，新增执行动作，全部等待原 TMF 逐记录事务完成后才显示成功。未新增审批、权限提示或后台角色。

### 本阶段执行结果

| 对象 | 结果 | 原始证据 |
|---|---|---|
| 非打头截断：40条/500mm、原批余额、原生产出 | 通过 | c09-webbing-execution-contract-production |
| 装包40条、实物包号、整包交出40条 | 通过；1包1笔交出，发方未代收 | 同上 |
| 连续余料退回5+2.5米、截断10条，余额归零 | 通过；不超实收、不把已截断退回 | c09-webbing-return-contract-production |
| 生产性能：截断/装包/交出/退回各5样本 | 通过；最大101/97/93/95ms | c09-webbing-execution-performance |
| 打头、辅材退回、半成品重量账、独立仓管实收、子包拆分、C09.08 | 未实施或未回放 | 页面不提供未接通入口 |
| 构建/单测 | 通过；1667项、Vite构建 | c09-webbing-execution-build.log |

页面路径 `/fcs/pda/central/webbing/{receive|execute|warehouse}`；执行页只在原命令实际可执行时显示动作。物理 PDA、打印标签、现场接受未验证。整体目标、剩余中央工序、三方、旧入口迁移、治理/收据与发布仍不通过。

## C09.05 打头与端头辅材（2026-10-22，本阶段仍不通过）

按新 STORE-04，本次织带旧演示 section 可在版本切换时定向清空重建，不要求迁移或兼容；当前保留的只读 section 基线不再作为长期兼容要求。演示 Mock 为 MOCK-005 生成端头辅材仓库实收、仓库交付出及工厂实收，未改变原 BOM/需求/数量规则。

| 对象 | 结果 | 证据 |
|---|---|---|
| 打头10根/600mm、金属端头2端、耗用20个、goodPieces10 | 通过 | c09-webbing-tip-contract-production |
| 打头保存5样本 | 通过；最大156ms | c09-webbing-tip-performance |
| 塑料/硅胶端头、错头/不良、辅材退回、称重/并发 | 未验证 | 页面不提供未接通入口 |
| 构建/单测 | 通过；1667项、Vite构建 | c09-webbing-tip-build.log |

页面只显示原命令可执行的动作；物理端头、实机与现场未验收。整体目标仍不通过。

## C09.07～08 端头辅材退回与工序显示（2026-10-22，整体仍不通过）

按新 STORE-04，织带旧演示 section 可定向清空重建，不要求迁移；本阶段没有扩展旧数据兼容。

| 对象 | 结果 | 证据 |
|---|---|---|
| 端头辅材退回5个、原因、原生退料单 | 通过 | c09-webbing-tip-return-contract-production |
| 端头辅材退回5样本 | 通过；最大115ms | c09-webbing-tip-return-performance |
| 工序选择「辅料/其他工序」分组，织带/花边归辅料，原身份不变 | 通过局部；盘扣/花朵按工厂实际可得工序显示 | c09-webbing-operation-menu-320x480.png |
| 半成品基础原料重量账、塑料/硅胶端头实际耗用、TMF无任务时的盘扣/花朵入口 | 未完成 | 不显示虚构操作 |
| 构建/单测 | 通过；1667项、Vite构建；typecheck:engineering 范围内0 | c09-webbing-tip-return-build-final.log、-unit.log、-typecheck-engineering.log |

端头辅材退回和工序分组是本机技术验证，不是物理PDA、现场或用户接受；其他中央工序、三方、旧入口、完整治理与发布仍未完成。

## C09.05/C09.07 端头分支与半成品原料账（2026-10-23，整体仍不通过）

| 对象 | 结果 | 证据 |
|---|---|---|
| 塑料端头20个、硅胶0.5kg、错长整批不良 | 通过；3条打头、1条不良、原因保留 | c09-webbing-tip-variants-contract-production |
| 硅胶打头保存5样本 | 通过；最大133ms | c09-webbing-silicone-tip-performance |
| 半成品原料只读账：kg/在库/耗用/报废/退回，半成品产出米分列 | 通过；320×480无溢出 | c09-webbing-base-ledger-contract、截图 |
| 原料生产/领用/耗用/退回的PDA操作 | 不适用/未实施；由原Web半成品页办理 | 不显示第二套操作入口 |
| 构建/单测 | 通过；1667项、Vite构建 | c09-webbing-base-tip-variants-build.log |

盘扣/花朵在TMF无任务时仍不提供虚构入口；其他中央工序、三方、旧入口、治理/收据与发布未完成。整体目标不通过。

## C10 后整首阶段只读（2026-10-23，整体仍不通过）

按新 STORE-04，后整演示数据由领域模块加载时生成，不做旧数据迁移。本阶段只接后整回货到实收查看，不写回货确认、QC、后道加工或出库。

| 对象 | 结果 | 证据 |
|---|---|---|
| ID-F002 3笔待确认回货、逐SKU登记100、后道实收记录 | 通过只读 | c10-post-receipt-contract-production |
| 已送检回货确认100、实收100、QC/出库查看 | 通过只读 | 同上 |
| 扫错恢复、印尼语无混排、320×480 | 通过 | 同上及截图 |
| 回货确认/QC/加工/出库写操作、两仓、三方登记归属 | 未实施 | 页面不提供写入口 |
| 构建/单测 | 通过；1667项、Vite构建 | c10-post-read-build.log |

性能未采信：当前机器负载约29，页面读响应不作为五样本通过证据。页面只读，不能替代后整业务完成；其他中央工序、三方、X11、治理/收据与发布仍未完成。

## C10 后整回货确认（2026-10-23，整体仍不通过）

用户确认后道工厂现有管理员承担主管动作；按实际账号 ID/姓名映射「后道回货确认人员」，操作工只读，不新增角色选择器。确认仍走原 `confirmPostFinishingFactoryReturn` 与 `runPostFinishingCommand` 同库保存。

| 对象 | 结果 | 证据 |
|---|---|---|
| 正常100/100确认、刷新保持、后道实收待送检、质检任务 | 通过 | c10-post-confirm-contract |
| 一次点数90触发二次点数，最终确认100 | 通过 | 同上 |
| 二次仍90时差异待授权，仅阻断提示、无确认按钮 | 通过 | 同上 |
| 确认保存/刷新5样本 | 通过；最大93/134ms | c10-post-confirm-performance |
| 动态授权码、QC、加工、复核、出库写操作 | 未实施 | 不显示未接通的写入口 |
| 构建/单测 | 通过；1667项、Vite构建 | c10-post-confirm-build2.log |

页面只读与确认写均限于实际后道工厂；其他中央工序、三方、X11、治理/收据与发布仍未完成。

## C10 后整差异动态授权（2026-10-23，整体仍不通过）

差异待授权页只接受授权人提供的动态码，不生成/展示授权码；原模块校验授权人、30秒时段、6位码、一次性使用及差异指纹，失败保留差异待授权和原表单。

| 对象 | 结果 | 证据 |
|---|---|---|
| 90/90差异→无效码拒绝且保留表单 | 通过 | c10-post-authorization-contract-production |
| 有效PFAUTH码确认→已确认待送检、确认170、刷新保持 | 通过 | 同上 |
| 授权确认5样本 | 通过；最大93ms | c10-post-authorization-performance |
| 构建/单测 | 通过；1667项、Vite构建 | c10-post-authorization-build.log |
| QC/加工/复核/出库写操作、两仓 | 未实施 | 不显示未接通入口 |

授权码的物理扫描与现场30秒时限未验收；其他中央工序、三方、X11、治理/收据与发布仍未完成。


## C10 后整送检与 QC 领取（2026-10-23，整体仍不通过）

| 对象 | 结果 | 证据 |
|---|---|---|
| 确认后送检出库→待质检→领取→质检中，刷新保持 | 通过 | c10-post-qc-handoff-contract |
| 送检/领取各5样本 | 通过；最大均100ms | c10-post-qc-handoff-performance |
| QC结果/返工/完成、加工/复核、出库/仓库实收、两仓 | 未实施 | 不显示未接通入口 |
| 构建/单测 | 通过；1667项、Vite构建 | c10-post-qc-handoff-build.log |

送检使用实际账号，QC领取映射操作工=质检员、管理员=QC主管；未新增角色选择器。其他中央工序、三方、X11、治理/发布仍未完成。


## C10 后整 QC 全部合格完成（2026-10-23，整体仍不通过）

| 对象 | 结果 | 证据 |
|---|---|---|
| 全部合格无后道项目→质检完成+出库单待仓库接收 | 通过 | c10-post-qc-complete-contract |
| 选择熨烫→质检完成+后道任务待后道、无出库单，刷新保持 | 通过 | 同上 |
| 全部合格/含后道项目各5样本 | 通过；最大101/94ms | c10-post-qc-complete-performance |
| 不良/返工/质检差异授权、加工/复核、出库接收/仓库实收、两仓 | 未实施 | 不显示未接通入口 |
| 构建/单测 | 通过；1667项、Vite构建 | c10-post-qc-complete-build.log |

QC完成仅覆盖全部合格分支；其他中央工序、三方、X11、治理/收据与发布仍未完成。


## C10 后整 QC 不良/返工/差异授权（2026-10-23，整体仍不通过）

| 对象 | 结果 | 证据 |
|---|---|---|
| 不良18/2+系统瑕疵原因、返工19/1+工厂/原因、差异18+动态授权 | 通过 | c10-post-qc-results-contract |
| 不良/差异各5样本 | 通过；最大98/102ms | c10-post-qc-results-performance |
| 后道加工/交复检、复检、出库接收/仓库实收、两仓 | 未实施 | 不显示未接通入口 |
| 构建/单测 | 通过；1667项、Vite构建 | c10-post-qc-results-build.log |

QC 结果分支已完成本机技术验证；后整剩余链路、其他中央工序、三方、X11、治理/发布仍未完成。


## C10 后整加工→复检→出库→仓库实收（2026-10-23，正常全量路径）

| 对象 | 结果 | 证据 |
|---|---|---|
| 四个后道加工项登记→交复检→领取→5 SKU扫码→复检完成→出库→仓库实收，刷新保持 | 通过 | c10-post-full-chain-contract |
| 加工/交复检/领取/复检完成/仓库实收各5样本 | 通过；最大278/63/69/42/96ms | c10-post-full-chain-performance |
| 待加工仓/待交出仓两仓记录 | 通过只读；交出后已交出 | 同上 |
| 部分数量/分批、条码错误重贴、复检/收货差异授权、两仓移库调整 | 未验证 | 不显示未接通入口 |
| 构建/单测 | 通过；1667项、Vite构建 | c10-post-full-chain-build.log |

正常全量路径完成本机技术验证；其他中央工序、三方、X11、治理/收据与发布仍未完成，整体目标不通过。

## C10 后整 V34 缺口补齐（2026-10-23，本机技术核验）

| 对象 | 结果 | 证据 |
|---|---|---|
| 公共机车缝回货：扫来源、逐码剩余/数量、送货人/电话/照片、待后道确认、最近记录、刷新、废弃、退出保护 | 通过 | v34-post-new-features-contract（A/A2） |
| 后道独立点收；部分后道逐码+剩余+未处理原因+刷新 | 通过 | 同上（A/B）；v34-partial-post.png |
| 复检数量差异动态授权→95件出库/入仓；错码→换标→复扫正确 | 通过 | 同上（C/D）；v34-recheck-difference.png |
| 出库实收差异无授权阻断、授权后98件；QC不良照片落结果与不良记录 | 通过 | 同上（G/F） |
| 两仓按SKU汇总+移动记录；印尼语状态无中文残留 | 通过 | 同上（E）；v34-warehouse-id.png |
| 8场景×5样本 | 通过；最大241/65/109/87/171/72/73/70ms | v34-post-new-features-performance.json |
| 单测/构建/工程类型范围 | 通过；1667项、Vite、范围0错误 | unit2/build3/engineering日志 |
| 物理扫码/断电、真实设备/人员接受、两仓手工移库 | 未验证/无原命令未提供 | 不宣称通过 |

本段只关闭 V34 后整页面与直接业务边界；其他中央工序、三方、X11、治理/收据与发布仍未完成，整体目标不通过。
