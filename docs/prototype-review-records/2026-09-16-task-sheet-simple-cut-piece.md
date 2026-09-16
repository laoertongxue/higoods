# 任务单打印与简易裁片交出总体审查记录

## 1. 基本信息

- 日期：2026-09-16；记录模式：完整产品审查。
- 范围：总体方案 S01—S15、WP01—WP09、148 条追踪需求。
- 分支：`codex/task-sheets-simple-cut-piece-handover-20260916`。
- 基线：`1749a918e1e65bde6dd0285491f5d6b3cb915f8f`；当前任务未提交差异，工作树 `/Users/laoer/.codex/worktrees/ec9a/higoods`。
- 服务：同工作树 Vite `http://127.0.0.1:4175`，关闭热更新及文件监听；实质变动后重启再验。
- 角色：管理端任务分配；裁床仓管 Web/PDA 交出；PPIC 查看任务/欠片；三方车缝工厂查看已接收记录。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：增加有效分配任务单、独立任务码、线上结构生产确认单、Web/PDA 简易交出及工厂已接收投影，改变打印、图片、Mock、路由、数量和旧裁片入口。
- 基线：AGENTS.md 第 4、5、7 节；用户确认仓库确认即 PPIC 和工厂接收；三合一仍领面辅料。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色与任务 | 通过 | 仓管登录身份/仓库范围校验，错误角色实际 Web/PDA 阻断。 |
| 数量与事实 | 通过 | 首批700、补裁200、另一工厂独立范围已验；历史40+本批60累计100且全台账不重复已过专项和页面回归。 |
| 扫码及真实图片 | 通过 | 实际 PDF 光栅条码/二维码解码成功；真实效果图与物料对应；最终5份各2页PDF、10页逐页人工及码解码通过。 |
| 防错与恢复 | 通过 | 保存失败保留内容且无事实，重试成功；并发一成一拒；扫码不自动交出。 |
| 跨端与追溯 | 通过 | 单一本地事件投影工厂已接收；下游独立页面验收与主交出测试分别记录；PPIC页面700片实交、200片欠片和同纸码打印已验。 |
| 低分辨率 | 通过 | Web1024/1366、PDA360/390，根页面无横向溢出，确认按钮可达。 |
| 打印线上字段 | 通过 | CONF-010已按用户最新要求保留原文并直译；实际PDF文字及分页复验通过，不虚构服装属性。 |

## 4. 问题标签

`算不准`、`追溯不足`、`缺扫码识别`、`视觉干扰`、`协作断裂`。

## 5. 主要问题与处理

| 问题 | 处理 | 当前结果 |
| --- | --- | --- |
| 仅生产单码无法确定工厂任务 | 有效分配身份与版本任务码 | 数据专项、重打、PDF解码通过 |
| 无袋现场无法交出 | 独立简易交出，共用识别与提交 | 两批、失败恢复、并发浏览器通过 |
| 缺少历史累计 | 冻结以前实交并区分本单与任务累计 | 37条冻结累计专项及页面复验通过 |
| 辅料跨页错误表头 | 独立辅料table/thead | 最终10页PDF逐页通过 |
| 线上两个字段语境不符 | 用户要求按印尼语直译，保留原文 | 原文与译文已实际PDF核查 |
| 页面首个动作受通用处理器拖延 | 命名页面直接加载自身事件处理器 | 工作台及PPIC主流程通过，额外边界最终8例49.6秒通过 |

## 6. 最终结论

结论：通过

148条原子需求的本地原型实现与证据已逐项核对。最终项目级状态以 `output/verification/task-sheet-final/task-receipt.json` 为准：只有 state=verified 且全部检查通过才发布本地验证结论；未声明 delivered/accepted。物理打印机与实体PDA扫码未执行，模拟浏览器与PDF解码不能代替现场证据。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/generated-fei-tickets.ts`
- `src/data/fcs/cutting/handover-orders.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/sewing-dispatch.ts`
- `src/data/fcs/cutting/special-craft-fei-ticket-flow.ts`
- `src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts`
- `src/data/fcs/cutting/simple-cut-piece-handover.ts`
- `src/data/fcs/cutting/transfer-bag-operations.ts`
- `src/data/fcs/dispatch-task-sheet.ts`
- `src/data/fcs/effective-task-assignments.ts`
- `src/data/fcs/factory-internal-warehouse.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/print-service.ts`
- `src/data/fcs/print-template-registry.ts`
- `src/data/fcs/process-work-order-domain.ts`
- `src/data/fcs/production-confirmation.ts`
- `src/data/fcs/production-demands.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `src/data/fcs/production-tech-pack-snapshot-types.ts`
- `src/data/fcs/sewing-cut-piece-responsibility.ts`
- `src/data/fcs/sewing-outsourcing-responsibility.ts`
- `src/data/fcs/sewing-pickup-slips.ts`
- `src/main-handlers/pda-handlers.ts`
- `src/pages/pda-cutting-simple-cut-piece-handover.ts`
- `src/pages/pda-cutting-wait-handover-actions.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/pda-handover.ts`
- `src/pages/pda-warehouse-wait-handover.ts`
- `src/pages/print/print-preview.ts`
- `src/pages/print/print-styles.ts`
- `src/pages/print/templates/dispatch-task-sheet-template.ts`
- `src/pages/print/templates/production-material-confirmation-template.ts`
- `src/pages/process-factory/cutting/handover-orders.ts`
- `src/pages/process-factory/cutting/wait-handover-actions.ts`
- `src/pages/process-factory/cutting/wait-handover-dialogs.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/sewing-outsourcing/cut-piece-handover.ts`
- `src/pages/sewing-outsourcing/tasks.ts`
- `src/pages/simple-cut-piece-handover-ui.ts`
- `src/pages/unified-dispatch-workbench.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-pda.ts`
- `src/router/routes.ts`

### 页面路由

- `/fcs/dispatch/workbench?keyword=PO-DEMO-`
- `/fcs/print/preview?documentType=DISPATCH_TASK_SHEET`
- `/fcs/production/orders/PO-DEMO-SIMPLE-0916/confirmation-print`
- `/fcs/craft/cutting/warehouse-management/wait-handover`
- `/fcs/pda/cutting/simple-cut-piece-handover`
- `/fcs/craft/cutting/handover-orders`
- `/fcs/craft/cutting/handover-records/<本次记录>`
- `/fcs/pda/handover?tab=received`
- `/fcs/pda/handover/RECEIPT-<本次记录>`
- `/fcs/sewing-outsourcing/tasks`
- `/fcs/sewing-outsourcing/cut-piece-handover`

### 验证命令

- `node --import tsx scripts/check-simple-cut-piece-handover-integration.ts`：通过；持久化失败/重试、两批、即时接收、冷读责任、旧码失效。
- `node --import tsx scripts/check-dispatch-task-sheet.ts`：通过；身份/范围/版本/重打。
- `node --import tsx scripts/check-production-confirmation-online-parity.ts`：通过；来源单位与精度、六区块、数据合计；包含用户最新确认的印尼语忠实直译。
- `npx playwright test tests/simple-cut-piece-handover.spec.ts`：通过；最终3例56.8秒，同源双标签、Web/PDA主流程及实际中转袋/特殊工艺往返。
- `npx playwright test tests/task-sheet-workbench.spec.ts`：通过；最终2例25秒，1366/1280、灰态、真实打印跳转与范围、重复打印无事实。
- `npx playwright test tests/task-sheet-print.spec.ts`：通过；最终1例2.7分钟，5份各2页PDF，10页目视与码解码通过。
- `npx playwright test tests/task-sheet-ppic.spec.ts`：通过；与接收页合计最终8例49.6秒，包含查询同码打印、旧码上下文缺失、图片失败恢复和存储读取失败。
- `npm run build`：通过；101项测试及Vite构建；最终重跑结果随任务收据保存。
- `npx tsc --noEmit`：失败；57项在基线既存PCS工程主单文件，不修改他人模块；本任务engineering类型检查通过。
- `npm run check:prototype-design-governance`：通过；默认暂存范围无变更。另显式审核完整本任务工作区 `-- --all` 最终范围随任务收据重新执行，包含新增工艺来源文件和 routes.ts。
- `npm run workflow:verify`：失败（前轮审查记录结果文案未满足格式，已修正）；最终门禁结果见 `output/verification/task-sheet-final/task-receipt.json` 和 workflow.log；本记录冻结后生成，不以文档声明代替退出结果。

### 真实图片验证

- 素材来源与对象关系：`public/production-confirmation-demo/sources.json` 和 `docs/product-design/assets/` 清单；灰色拉链卫衣与雾霾灰拉链/罗纹正式效果图、对应纸样图和本地CAD附件。
- 已目视复核 `output/verification/task-sheet-simple-cut-piece-handover/screenshots/web-1024-first-batch.png`、`pda-360-scanned-not-confirmed.png`：对象编码与图片同块；确认按钮可触达，主页面无宽表横溢。
- 图失败/重试、大图关闭、打印前图片/码门禁见打印测试和主流程测试。不同模块证据不互相冒充。

### 例外

- CONF-010 按用户“印尼语翻译即可”的最新口径完成；“那是宪法吗？”仅为直译，不推断服装属性。
- CodeGraph 已获用户授权初始化；已同步且待同步0，最终收据再次检查。
- 实体打印机与扫码枪/PDA未现场执行，单列现场待验。
- 原型localStorage仅同源浏览器共享；未实现或声称真实跨设备后台事务。
- 原工作树其他分支未操作，本任务不修复既存PCS类型错误。

### 最终审查说明

本次正向逐项核对S01—S15和148个编号，反向核对所有任务源文件、测试与文档，数量和角色口径保持用户确认。性能修改限实际调用链的重复查询，未改其他工作树或PCS模块。动态特殊工艺关联仅追加真实完裁票绑定，保留旧裁床工艺流和历史状态。新增PDA入口导致原七入口契约变为八入口；测试同步新增唯一简易入口和路由断言，没有移除旧入口回归。

接收查询Storage错误仅在只读投影转换为显式readError；PDA显示恢复提示，交出/库存资格仍严格失败，专项证明零写入。

末轮接收存储故障发现顶栏待办也会读取同账本，已在接收页提前展示恢复提示，避免假报零待办。直达PPIC页的独立路由初始化已补齐。两项最后修复后的8例真实浏览器复验全部通过。
