# 成衣出库单线上对齐

依据：[AGENTS.md](../../AGENTS.md) 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01。

## 范围、需求与实施计划

本任务为 T3 行为调整，继承当前 AGENTS.md。参照为 2026-10-20 只读查看的 `https://manage.higood.ai/wls/warehouse_order_manage/index` 及详情；目标为 `/wls/finished/outbound-orders`。用户重复填写的原型链接按所附管理系统页面解析。只调整本页、直接数据、面单和专项测试；菜单、公共组件、其它仓储流程、依赖和发布配置不在范围内。

线上现场已核对全部状态入口、查询、列表、清除、详情产品和日志。线上写动作只观察入口，未执行取消打单、批量出库、打印或重新下载。原型的前三条样本保留截图编号和对应图片，另有 42 条 DEMO 边界记录；全部统计由这 45 条样本计算，不复制线上百万计数、私人收件信息或真实物流凭证。原型保存仅影响本浏览器。

实施顺序为静态对象和筛选契约 → 标准列表 → 详情及图片 → 本地面单和适用动作 → 契约、浏览器、设备和性能验证 → 完整任务差异审查。页面继续使用 Vanilla TypeScript 字符串模板及已有标准列表、表格、分页和图片预览，不改变路由注册接口。

变更确认：用户在本次会话明确指出取消后的订单应为“已取消”。据此撤销此前返回“拣货完成”的推断。现有“取消打单”入口保留线上名称，确认框明确告知出库单将标记为已取消并停止后续打印与出库；保存取消时间，保留历史打印次数、打印时间和日志。出库动作只登记本页演示事实，不推定其它模块库存扣减或实际物流已经发生。

以下条目的验证人为 Codex，版本为本记录“页面证据”绑定的最终工作树版本。用户只确认上述状态规则，未代填产品接受结论。

| 编号 | 原子结果及来源 | 实际实现 | 直接证据 | 状态 |
| --- | --- | --- | --- | --- |
| OB-01 | 线上单号、SPU、SKU 分别搜索 | `filterFinishedOutboundOrders`、`filtersHtml`、`applyFilters` | 专项单测、`ui-verified.log` | 已验证 |
| OB-02 | 线上仓库、平台、面单、现货/预售查询 | 同上 | 专项单测、`ui-verified.log` | 已验证 |
| OB-03 | 线上一票一件/多件、KOL、库存查询 | 同上；多件依据总件数，有货要求每行库存充足，未知不冒充充足 | 专项单测、`ui-verified.log` | 已验证 |
| OB-04 | 三组日期和四类时间排序；非法日期、反向区间阻断 | `inDateRange`、`filterFinishedOutboundOrders`、`applyFilters` | 日期/分钟边界单测、`ui-verified.log` | 已验证 |
| OB-05 | 全部及七种状态的数量随当前查询同步，包括已取消 | `OUTBOUND_STATUSES`、`statusTabs` | 单测、`perf-interactions-candidate.log`、`cancelled-functional.log` | 已验证 |
| OB-06 | 线上九列及商品图/SKU/数量、库存和阶段时间 | `columns`、`productsHtml`、`copyLine` | 三尺寸截图、`ui-verified.log` | 已验证 |
| OB-07 | 移除原型原有的履约/复核/生成拣货及全局假日志等不符入口 | 本页完整替换；详情仅读取本单真实演示日志，三条参照单无日志时显示暂无日志 | 最终源码审查、`ui-verified.log` | 已验证 |
| OB-08 | 默认15条、页码跳转；保留原有列设置，必需列不可隐藏、操作列右固定 | `pagingHtml`、`preferences`、`overlayHtml`、事件处理器 | `ui-verified.log`、`candidate-smoke.log`、列操作性能样本 | 已验证 |
| OB-09 | 基础信息、订单产品和订单日志；详情直达及刷新 | `detailHtml`、`detailPanel`、`loadFinishedOutboundOrders` | `ui-verified.log`、`cancelled-functional.log` | 已验证 |
| OB-10 | 三张商品图准确对应，加载/失败、大图关闭按钮/遮罩/Esc | `thumbnail`、已有图片预览事件 | `verified-image-preview.png`、`ui-verified.log`、`recovery-final-resume.log`、`perf-media-storage-errors.log` | 已验证 |
| OB-11 | 复制、按平台/状态提供面单下载和打印；已有面单查看不写业务 | `rowActions`、`download`、`createOutboundWaybillPdf`、本页事件处理器 | `candidate-smoke.log`、`perf-writes-cancelled.log`、`verified-waybill-1.png`及PDF文本回读 | 已验证 |
| OB-12 | 已打单取消后已取消；勾选批量出库；事务、去重、版本冲突及失败恢复 | `applyFinishedOutboundAction`、`saveFinishedOutboundAction`、`openConfirmation`、`perform` | 14项单测、`contracts-cancelled.log`、`cancelled-functional.log`、`perf-recovery-cancelled.log` | 已验证 |
| OB-13 | 命名尺寸不横溢，宽表内部滚动，局部更新，完整响应<=1000ms | 本页渲染/局部更新；无公共组件改动 | 三尺寸截图、42家族210样本，见性能表 | 已验证 |

## 存储边界

| 对象 | 静态源 / 对象仓库 | 读写入口 | 关联动作、旧项及验收 |
| --- | --- | --- | --- |
| 出库单样本 | `FINISHED_OUTBOUND_SEED`，版本2026-10-20-v1 | 静态直接读取 | 普通首次读取后业务库记录及操作均为0；不整包落种子 |
| 用户操作覆盖及本单日志 | IndexedDB `higood-finished-outbound-v1` / `records`，keyPath=id | `loadFinishedOutboundOrders` / `saveFinishedOutboundAction` | 按受影响单保存，静态记录叠加覆盖；同事务保存记录与操作收据；complete后发布结果 |
| 幂等操作收据 | 同库 `operations`，keyPath=id | 同上 | 稳定操作标识；失败后同标识重试；双击只保存一次；过期版本拒绝覆盖 |
| 列偏好 | localStorage `/wls/finished/outbound-orders:online-columns-v1` | `preferences` / `persistPreferences` | 只存本页列集合内的显示、顺序、冻结及页大小，最大10列和9种页大小，有界；默认15条，不存页码和排序；读失败回默认，写失败保留当前界面操作 |
| 面单文件 | 当前样本临时 PDF Blob | `download` / 打印预览 | 下载/预览后释放临时URL；没有用户附件持久化或复制字节 |

旧页面仅有列偏好和内存演示数据，无本页旧持久业务源。旧列偏好键不再读取，不清除用户资料，不引入业务迁移、维护弹窗或后备 localStorage。其它页仓储数据和附件不在本动作读写范围。浏览器原生 IndexedDB 验证了首次无业务写入、非法批次零写入、容量不足和事务中止无半套成功、重试、版本冲突及同标识去重。取消后的状态、时间、打印历史、日志经过刷新和新页面详情直达回读。

## 基本信息

- 日期：2026-10-20
- 任务 / 需求编号：OB-01～OB-13 成衣出库单线上对齐
- 验证人：Codex

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：查询、状态、列表字段、详情及本地操作改变，只影响命名成衣出库单页；未改变公共组件、全局菜单或发布流程

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 页面及查询 | 通过 | `ui-verified.log`：7类下拉、单号/SKU、日期、排序、分页、详情及刷新；无结果/清除见交互性能脚本和单测 |
| 数量与状态 | 通过 | 出库数量按明细合计，单SKU多件按多件拣货；取消后已打单减1、已取消加1，打印历史保留；`unit-final.log`、`cancelled-functional.log` |
| 保存与持久回读 | 通过 | `contracts-cancelled.log`、`cancelled-functional.log`：事务、去重、故障、刷新/新窗直达回读；读取失败不冒充空数据或假成功 |
| 恢复与偏好 | 通过 | `perf-recovery-cancelled.log`、`perf-media-storage-errors.log`：打开失败、容量失败、冲突和恢复分别验证；本页偏好key禁止读/写不阻断业务 |
| 设备与布局 | 通过 | 1366×768、1280×720、1024×768，主体宽度不超视口，宽表在内部滚动；`ui-verified.log`、`cancelled-functional.log`及对应截图 |
| 图片 | 通过 | 来源为线上管理列表的 `file.higood.id` 商品图；三个文件分别对应 FADSS2610168888-sameasphoto-m、ASYSA26100755-coffee-l、CHCKL26101020-army-green-l，DEMO复用相同SKU和对应图，未用占位冒充；`ui-verified.log`、`recovery-final-resume.log`、图片错误5样本及大图截图 |
| 面单/打印 | 通过 | 实际下载PDF和打印预览窗口；PDFium渲染与文本回读核对DEMO-004、两条SKU、3+2=5件及版式。只证明演示PDF生成和打印登记，不声称物理打印、承运商面单或线上履约发生 |
| 性能 | 通过 | 42家族每组5次，最大919.8ms；保留原1049.7ms失败并追加修复后复测，详见性能表 |
| 审查 | 通过 | 主代理检查全部本任务源码、数据、测试、图片及diff；同一独立审查代理复核交互恢复、拖动及最终取消/读取失败修正，未发现新增必修问题；其初次指出的勾选、日期、保存后按钮及失败恢复问题已修复并实测 |
| PDA | 不适用 | 本次只调整管理端成衣出库单，不改变PDA或实物交接流程 |
| 附件迁移/回收及备份 | 不适用 | 无用户附件、旧持久业务源或删除/复制附件动作；临时面单不持久化，不扩建维护能力 |

## 最终结论

结论：通过

上述结论为本任务本地原型的技术与产品行为验证。发布未要求、未推送、未部署；用户产品接受不由代理代填。线上数据和物流系统始终只读。

## 变更覆盖与验证

### 受管文件

- `src/pages/wls/finished/outbound-orders.ts`
- `src/pages/wls/finished/outbound-waybill.ts`
- `src/data/wls/finished-outbound-orders.ts`
- `tests/unit/finished-outbound-orders.test.ts`
- `public/images/wls-outbound/FADSS2610168888-sameasphoto.webp`
- `public/images/wls-outbound/ASYSA26100755-coffee.webp`
- `public/images/wls-outbound/CHCKL26101020-army-green.webp`

### 页面证据

- 版本：工作树 `/Users/laoer/.codex/worktrees/29a1/higoods`，detached HEAD `6169496a675799802faee12b274eda39f196247d` 加本任务未提交差异。最终源码/测试/图片聚合SHA256为 `2ef8c785738b9e498d8de32150ecf637d1b0150d754ae91ed282c86cb5682d87`；逐文件哈希及资产清单在 `output/playwright/outbound-online-parity/version-verified.json`，报告自身及完整任务差异由最终收据绑定。
- 运行资产：`npx vite build --outDir /tmp/higoods-outbound-parity-cancelled-20261020 --emptyOutDir`；产物聚合SHA256为 `757d1c79179f5ff7a6fda2df9ea5167c5c6340c49bb33af9b3292c0b90f44b73`，index SHA256 `eb2d797bef1537657868f902e754fb0a8e10b0d3e3754ea6d55b31eedc9c83f1`。本地生产预览 `http://127.0.0.1:43323/wls/finished/outbound-orders`，Node26.8.2、npm11.19.1、Chrome155.0.8059.85、Asia/Shanghai，无CPU/网络降速。
- 数据及缓存：45条静态记录、默认15条，查询/列/页大小边界性能代表可渲染全部45条；三张本地真实对应商品图。只用独立浏览器上下文和临时空数据，不清理用户浏览器数据；冷首次5样本各启新Chrome进程，刷新和站内切换另测。
- 证据：本节文件均位于 `output/playwright/outbound-online-parity/`。最终 `ui-verified.log`、`cancelled-functional.log`、`contracts-cancelled.log` 和性能日志含实际结果；`verified-fresh-list-1366.png`、`verified-fresh-list-1280.png`、`verified-fresh-list-1024.png`、各自right图、`verified-reference-detail-1366.png`、`verified-image-preview.png`、`cancelled-detail-1366.png`及`verified-waybill-1.png`为页面或文件渲染证据。PDF文本为`verified-waybill-text.txt`。
- 复用依据：`version.json` 保留原候选版本身份与43322产物。仅复用其21组交互性能和拖动/已有面单只读检查；候选后变化仅为取消后继状态/时间/确认文案、初次读取就绪门禁及读失败局部反馈，筛选、分页、列设置、图片、复制及确认打开/返回的算法与DOM结果未变。取消、初始化、详情变化、保存及失败恢复已在43323最终资产重测；未将旧证据改标新版本。
- 历史问题处理：原UI采集器居中点击图片遮罩被图片拦截，改点露出角落；布局采集器误选外层无溢出容器，改核对实际内层滚动区；两个失败原日志保留，完整查询/详情/三种图片关闭/布局已由`ui-verified.log`重新完成。真实首次同步读取失败早于挂载及drop分支缺失已修正，已有面单查看不再写入打印事实。一次构建因系统ENFILE失败，清理本任务闲置浏览器上下文后新构建成功，原日志`build-verified.log`保留。
- 范围外环境实验：额外将整个window.localStorage访问器禁止时，既有生产来源迁移保护拦截了命名页挂载，见`media-error-root.log`；该情况不当成本页性能有效样本。正式偏好故障测试精确作用于本页key，未改动其它模块的迁移保护，不声称已修复全站禁止localStorage的行为。
- 技术检查边界：当前全量TypeScript仍有19个范围外既有错误，本次三个运行文件的渐进检查为0错误；未改动无关文件。完整构建及其既有工程检查曾通过1349项单测，最终专项14项重测通过；最终收据工具会按现有路由再次运行必需构建，工具不支持复用前次构建结果。
- 技术收据位置：`/tmp/higoods-outbound-online-parity-task-receipt.json`。该文件独立输出并绑定冻结后的8个任务文件、HEAD、指令、检查退出值及CodeGraph状态；收据状态以实际文件为准，不能代替本节页面验证或发布/用户接受。

### 性能结论

- 结论：通过
- 依据：`performance-summary.json`汇集42家族210个有效原始样本及最大值，表中按ms保留一位小数，原始JSON保留浮点原值。正常样本终点包含目标内容、数量、必要图片及字体、两次rAF；写操作追加事务complete后独立原生IndexedDB回读，下载包含文件可读，打印包含PDF窗口load。导航从performance.timeOrigin，交互从原生点击/输入/变更事件捕获；用户阅读确认不计，确认后重新起算。
- 家族依据：45条查询/清除分别覆盖查询类型共享的同一筛选渲染链；空结果、状态及非法日期分开。前后翻页与跳页均进入同一分页局部更新，按15条代表；页大小以全部45条为最重代表。列开/关/显示/冻结/拖动/恢复分开，图片开/关分开，产品/日志Tab分开。取消与出库、6单批量规模、所有写动作、容量失败/重试、首读失败/恢复、版本冲突/重读分别计样。本页偏好读/写故障与图片失败也单列，不将错误或冷/热样本混合平均。
- 首次及历史失败：候选版首读失败提示有效样本为1049.7、876.9、641.6、622.5、700.5ms，第一项超过1000ms；原`perf-recovery.log`保留。修复失败时整表重画后，`perf-recovery-cancelled.log`追加5样本，最大512.2ms。未删除或平均掩盖旧失败。浏览器进程启动耗时独立保留在加载日志，未混入页面导航响应。

| 家族 | 五次原始样本（ms） | 最大值（ms） | 原始日志 / 版本 |
| --- | --- | --- | --- |
| cold | 536.5 / 524.5 / 511.2 / 513.1 / 550.9 | 550.9 | `perf-load-cancelled.log` / verified |
| refresh | 412.6 / 420.8 / 418.6 / 414.4 / 415.3 | 420.8 | `perf-load-cancelled.log` / verified |
| detailEntry | 81.8 / 65.2 / 65.9 / 64.8 / 65.3 | 81.8 | `perf-load-cancelled.log` / verified |
| listReturn | 65.2 / 65.5 / 63.0 / 61.6 / 63.3 | 65.5 | `perf-load-cancelled.log` / verified |
| query45 | 89.2 / 83.4 / 79.5 / 82.2 / 79.3 | 89.2 | `perf-interactions-candidate.log` / candidate |
| emptyQuery | 30.4 / 75.4 / 30.9 / 31.8 / 46.4 | 75.4 | `perf-interactions-candidate.log` / candidate |
| clear45 | 79.4 / 81.2 / 82.1 / 105.0 / 107.1 | 107.1 | `perf-interactions-candidate.log` / candidate |
| status | 43.9 / 47.7 / 43.1 / 58.7 / 58.1 | 58.7 | `perf-interactions-candidate.log` / candidate |
| dateValidation | 50.7 / 41.6 / 107.6 / 31.6 / 32.3 | 107.6 | `perf-interactions-candidate.log` / candidate |
| pagination | 147.5 / 89.2 / 46.6 / 47.3 / 68.3 | 147.5 | `perf-interactions-candidate.log` / candidate |
| pageSize45 | 89.7 / 77.8 / 75.3 / 179.0 / 88.0 | 179.0 | `perf-interactions-candidate.log` / candidate |
| columnsOpen | 40.6 / 47.3 / 33.0 / 33.3 / 44.8 | 47.3 | `perf-interactions-candidate.log` / candidate |
| columnsClose | 89.0 / 30.7 / 30.3 / 29.8 / 46.2 | 89.0 | `perf-interactions-candidate.log` / candidate |
| columnVisibility | 47.3 / 919.8 / 67.8 / 45.8 / 47.9 | 919.8 | `perf-interactions-candidate.log` / candidate |
| columnFreeze | 86.8 / 51.6 / 63.9 / 64.3 / 85.5 | 86.8 | `perf-interactions-candidate.log` / candidate |
| columnOrder | 58.6 / 164.2 / 64.1 / 87.2 / 65.1 | 164.2 | `perf-interactions-candidate.log` / candidate |
| columnsRestore | 275.5 / 99.4 / 69.2 / 78.8 / 104.4 | 275.5 | `perf-interactions-candidate.log` / candidate |
| imageOpen | 29.8 / 32.5 / 54.6 / 32.5 / 31.1 | 54.6 | `perf-interactions-candidate.log` / candidate |
| imageClose | 40.6 / 71.5 / 45.1 / 31.4 / 33.2 | 71.5 | `perf-interactions-candidate.log` / candidate |
| detailLogs | 33.5 / 32.1 / 62.7 / 63.5 / 69.8 | 69.8 | `perf-interactions-candidate.log` / candidate |
| detailProducts | 93.5 / 44.6 / 163.0 / 53.0 / 31.9 | 163.0 | `perf-interactions-candidate.log` / candidate |
| copy | 44.0 / 32.4 / 28.3 / 30.3 / 31.6 | 44.0 | `perf-interactions-candidate.log` / candidate |
| selectRow | 106.2 / 29.7 / 59.1 / 29.2 / 33.6 | 106.2 | `perf-interactions-candidate.log` / candidate |
| confirmOpen | 45.2 / 31.6 / 32.9 / 43.6 / 30.6 | 45.2 | `perf-interactions-candidate.log` / candidate |
| confirmReturn | 30.6 / 44.5 / 32.2 / 31.0 / 34.5 | 44.5 | `perf-interactions-candidate.log` / candidate |
| downloadLabel | 65.8 / 49.5 / 49.3 / 48.4 / 48.1 | 65.8 | `perf-writes-cancelled.log` / verified |
| print | 115.1 / 110.4 / 93.1 / 92.7 / 93.0 | 115.1 | `perf-writes-cancelled.log` / verified |
| viewLabel | 42.6 / 43.1 / 43.0 / 42.1 / 43.1 | 43.1 | `perf-writes-cancelled.log` / verified |
| existingLabelDownload | 49.0 / 49.5 / 49.5 / 49.6 / 49.6 | 49.6 | `perf-writes-cancelled.log` / verified |
| cancelSave | 49.3 / 49.8 / 48.7 / 48.9 / 48.6 | 49.8 | `perf-writes-cancelled.log` / verified |
| batchSave6Orders | 49.3 / 49.3 / 49.2 / 49.2 / 49.3 | 49.3 | `perf-writes-cancelled.log` / verified |
| selectPage6 | 65.5 / 49.0 / 65.2 / 65.1 / 65.3 | 65.5 | `perf-recovery-cancelled.log` / verified |
| inputPaint | 33.8 / 28.7 / 28.9 / 29.4 / 27.8 | 33.8 | `perf-recovery-cancelled.log` / verified |
| quotaSaveFailure | 65.2 / 65.4 / 65.6 / 65.3 / 65.2 | 65.6 | `perf-recovery-cancelled.log` / verified |
| quotaRetrySaved | 49.3 / 49.4 / 49.2 / 48.9 / 49.1 | 49.4 | `perf-recovery-cancelled.log` / verified |
| openFailureVisible | 512.2 / 503.1 / 503.9 / 503.0 / 506.3 | 512.2 | `perf-recovery-cancelled.log` / verified |
| openRecovery | 65.7 / 64.9 / 66.3 / 64.6 / 65.4 | 66.3 | `perf-recovery-cancelled.log` / verified |
| versionConflictVisible | 66.0 / 65.2 / 64.7 / 64.8 / 65.5 | 66.0 | `perf-recovery-cancelled.log` / verified |
| versionConflictReload | 65.1 / 64.7 / 64.5 / 64.5 / 65.8 | 65.8 | `perf-recovery-cancelled.log` / verified |
| imageFailureVisible | 585.3 / 617.9 / 595.0 / 550.3 / 552.6 | 617.9 | `perf-media-storage-errors.log` / verified |
| preferenceReadFailureDefault | 513.2 / 500.7 / 504.1 / 500.1 / 528.1 | 528.1 | `perf-media-storage-errors.log` / verified |
| preferenceWriteFailureRetainsUi | 98.0 / 63.7 / 65.8 / 65.5 / 65.5 | 98.0 | `perf-media-storage-errors.log` / verified |

### 验证命令

- `node --import tsx --test tests/unit/finished-outbound-orders.test.ts`：通过
- `node scripts/check-typescript-scope.mjs src/pages/wls/finished/outbound-orders.ts src/pages/wls/finished/outbound-waybill.ts src/data/wls/finished-outbound-orders.ts`：通过
- `npx vite build --outDir /tmp/higoods-outbound-parity-cancelled-20261020 --emptyOutDir`：通过
- `git diff --check`：通过
- `playwright-cli --session outbound-parity run-code <ui-verified.js / cancelled-functional.js / contracts-cancelled.js / 对应性能脚本>`：通过

- `npm run check:list-page-governance -- --scope worktree --paths src/pages/wls/finished/outbound-orders.ts,src/pages/wls/finished/outbound-waybill.ts,src/data/wls/finished-outbound-orders.ts,tests/unit/finished-outbound-orders.test.ts,public/images/wls-outbound/FADSS2610168888-sameasphoto.webp,public/images/wls-outbound/ASYSA26100755-coffee.webp,public/images/wls-outbound/CHCKL26101020-army-green.webp,docs/prototype-review-records/2026-10-20-finished-outbound-online-parity.md`：通过

### 例外

- 无

CodeGraph初始化经用户本次会话明确授权，随后同步成功；4371文件，pending为0，worktreeMismatch为null，证据为`codegraph-final-status.json`。本次无性能例外，无线上写操作。
