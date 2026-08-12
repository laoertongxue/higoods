# FCS 部位菲票手动建票与分纸打印需求追踪与交付矩阵

确认版本：`main@a9837eda`（本次实施基线）
产品确认人：用户
当前分支：`codex/fei-ticket-mock-title`
当前阶段：普通菲票 Mock 与特殊工艺标题已完成当前分支专项、页面和打印验证

| 编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面／打印验证 | 状态 | 证据 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MANUAL-001 | 总体设计 4.2、9.1 | 列表提供手动增加入口 | WP-03 | `fei-tickets.ts`：`renderPrintListPage`、`renderManualFeiTicketCreateDialog` | 纸张专项场景 1 | 列表入口、手动建票弹窗 | 已验证 | `fei-ticket-list-manual-entry-final.png`、`fei-ticket-manual-create-modal-final.png` |
| MANUAL-002 | 总体设计 5.1、9.1 | 唛架必须来自现有可用事实 | WP-03 | `fei-tickets.ts`：`initializeManualCreateSelection`；唛架方案事实源 | 纸张专项场景 1、2 | 弹窗只可选择现有唛架 | 已验证 | 验收唛架 `MKP-20260403-008` |
| MANUAL-003 | 总体设计 4.2、9.1 | 唛架成员带出生产单、裁片单、SPU、颜色和 SKU | WP-03 | `manual-fei-tickets.ts`：`resolveMarkerSource`、`buildManualTicketRecord` | 纸张专项场景 1 | 弹窗显示 `PO-202603-0003`、`SPU-2024-009`、White、SKU | 已验证 | `fei-ticket-manual-create-modal-final.png` |
| MANUAL-004 | 总体设计 5.3、9.2 | 手动建票不生成虚构铺布单 | WP-02 | `manual-fei-tickets.ts`：`buildManualTicketRecord` | 纸张专项场景 1 | 详情和模板显示“无铺布单” | 已验证 | 白／黄模板截图 |
| MANUAL-005 | 总体设计 5.2、9.2 | 按层数、尺码件数和单件部位片数计算 | WP-02 | `manual-fei-tickets.ts`：`createManualFeiTicketBatch` | 纸张专项场景 1、2 | 手动批次 16 张、2480 片，明细单位为片 | 已验证 | `fei-ticket-detail-white-tab-final.png` |
| MANUAL-006 | 总体设计 4.2、9.1 | 手动菲票刷新后保持 | WP-02 | `fei-tickets-storage.ts`；`read/persistManualFeiTicketStore` | 纸张专项场景 1 | 详情刷新后仍读取同一批次 | 已验证 | 浏览器存储与详情重载断言 |
| MANUAL-007 | 总体设计 4、5.11 | 手动来源进入列表、详情、打印和二维码 | WP-02 | `manual-fei-tickets.ts`；`fei-tickets.ts`；`label-print-template.ts` | 纸张专项场景 1、3 | 列表、详情、白／黄模板及二维码生产单一致 | 已验证 | 列表、详情、白／黄模板截图 |
| DETAIL-001 | 总体设计 5.4、9.4～9.5 | 详情按普通／特殊工艺分 Tab | WP-04 | `fei-tickets.ts`：`getDetailPaperColor`、`renderDetailPaperTabs` | 纸张专项场景 3、4 | 白纸 12 张、黄纸 4 张 | 已验证 | 两类 Tab 截图 |
| DETAIL-002 | 总体设计 4.3、9.4～9.5 | Tab 提示白色／黄色热敏纸 | WP-04 | `fei-tickets.ts`：`renderDetailPaperNotice` | 纸张专项场景 1、3 | 两类提示文案和颜色区分 | 已验证 | 两类 Tab 截图 |
| DETAIL-003 | 实施计划 WP-04、总体设计 9.9 | 支持勾选、全选、批量打印 | WP-04 | `fei-tickets.ts`：详情选择与打印事件 | 纸张专项场景 4 | 当前 Tab 多选及批量打印 | 已验证 | Playwright 选择断言 |
| DETAIL-004 | 总体设计 5.7、9.9 | 全部打印只处理当前 Tab | WP-04 | `fei-tickets.ts`：`requestDetailPrint` | 纸张专项场景 1、4 | 白纸 Tab 全部打印显示 12 张 | 已验证 | 白纸详情截图与预览断言 |
| DETAIL-005 | 实施计划 WP-04、总体设计 9.6 | 详情支持新增单张菲票 | WP-04 | `manual-fei-tickets.ts`：`appendManualFeiTicket`；详情弹窗 | 纸张专项场景 1 | 新增后提示“已新增未打印菲票” | 已验证 | Playwright 新增断言 |
| DETAIL-006 | 总体设计 5.9、9.6 | 未打印手动菲票可改量并记录原因 | WP-04 | `updateUnprintedManualFeiTicketQuantity`；改量弹窗 | 纸张专项场景 1 | 原因必填；数量、编号范围与二维码同步 | 已验证 | `fei-ticket-edit-reason-final.png` |
| DETAIL-007 | 总体设计 5.9、9.7 | 已打印或已锁定菲票不得覆盖历史 | WP-04 | `manual-fei-tickets.ts` 改量／删除门禁；详情动作渲染 | 纸张专项场景 1 | 首次打印后改量、删除入口消失 | 已验证 | Playwright 打印后锁定断言 |
| DETAIL-008 | 总体设计 5.9、9.7 | 仅未打印未锁定手动菲票可删除 | WP-04 | `deleteUnprintedManualFeiTicket` | 纸张专项场景 4 | 未打印手动票可删除，已打印票不可删 | 已验证 | Playwright 删除与锁定断言 |
| DETAIL-009 | 实施计划 WP-04、总体设计 9.8 | 支持手动标识、票号、部位筛选和分页 | WP-04 | `fei-tickets.ts`：详情过滤、重置与分页 | 纸张专项场景 4 | 筛选／重置／分页结果正确 | 已验证 | Playwright 场景 4 |
| DETAIL-010 | 总体设计 5.7、9.9 | Tab 切换清空跨纸勾选 | WP-04 | `fei-tickets.ts`：纸色 Tab 事件 | 纸张专项场景 4 | 切换 Tab 后旧选择清空 | 已验证 | Playwright 跨 Tab 断言 |
| CRAFT-001 | 总体设计 2、9.5 | 特殊工艺覆盖辅助工艺和特种工艺 | WP-01 | `generated-fei-tickets.ts`：`resolveFeiTicketSpecialCraftsForPart` | 纸张专项场景 3 | 页面显示“绣花／辅助工艺、打揽／辅助工艺”等实际工艺 | 已验证 | 黄纸详情与模板截图 |
| CRAFT-002 | 总体设计 5.4 | 特殊工艺按部位判断 | WP-01 | `resolveFeiTicketSpecialCraftsForPart`、`buildManualTicketRecord` | 纸张专项场景 3 | 同一手动批次拆为 12 白／4 黄 | 已验证 | 详情两类 Tab 计数 |
| CRAFT-003 | 总体设计 5.5 | 删除按序号轮换工艺的旧 Mock | WP-01 | `generated-fei-tickets.ts`：移除序号注入，改读部位工艺事实 | 纸张专项场景 3；静态差异审查 | 不适用（数据清理） | 已验证 | 无取模／轮换生成路径，黄票可追溯到部位 |
| CRAFT-004 | 总体设计 5.5 | 承接工厂来自有效工艺分配 | WP-01 | `getSpecialCraftReceiverFactory`、`buildManualTicketRecord` | 纸张专项场景 3 | 黄纸详情和模板显示实际承接工厂 | 已验证 | 黄纸截图 |
| CRAFT-005 | 总体设计 5.6、9.11 | 工艺存在但工厂缺失时阻断打印 | WP-05 | `fei-tickets.ts`、`buildFeiTicketLabelPrintDocument` | 纸张专项场景 5 | 缺工厂请求被阻断并给出原因 | 已验证 | Playwright 场景 5 |
| CRAFT-006 | 总体设计 2、3、9.15 | 捆条菲票保持独立链路 | WP-01 | `renderBindingStripFeiBusinessLabelItem`；原捆条路由 | 捆条流程专项通过 | 捆条模板／路由不改 | 已验证 | 18 条明细、17 张加工单、20 张唯一菲票 |
| MOCK-001 | 总体设计 2、5.13、9.16 | 系统演示数据稳定提供普通白纸菲票 | WP-01 | `generated-fei-tickets.ts`：`buildOrdinaryFeiTicketMockRecords` | 纸张专项场景 1：数量、属性、批次和页面逐项断言 | 12 张普通票、2 个生产单、2 个铺布批次、3 类部位、4 个尺码；列表与白纸详情可见 | 已验证 | `ordinary-mock-list.png`、`ordinary-mock-detail.png`、`ordinary-white-print.png` |
| PAPER-001 | 总体设计 4.3、9.4 | 普通菲票使用白色热敏纸 | WP-05 | `print-service.ts`；`print-template-registry.ts`；详情纸色投影 | 纸张专项场景 1 | 白色 Tab、白色确认、白色模板 | 已验证 | 白纸三类截图 |
| PAPER-002 | 总体设计 4.3、9.5 | 特殊工艺菲票使用黄色热敏纸 | WP-05 | 同上，`FEI_TICKET_YELLOW_THERMAL` | 纸张专项场景 3 | 黄色 Tab、黄色确认、黄色模板 | 已验证 | 黄纸详情与模板截图 |
| PAPER-003 | 总体设计 4.3 | 纸色和物理尺寸独立保存 | WP-05 | `PrintThermalPaperColor` 与 `PrintPaperType`；打印历史 | 纸张专项场景 1、3 | 纸色提示不改变标签尺寸 | 已验证 | 打印历史断言包含 `paperColor`、`labelSize` |
| PAPER-004 | 总体设计 5.8、9.10 | 打印前确认已装入对应纸张 | WP-05 | `fei-tickets.ts`：`renderDetailPrintConfirmation`；`print-preview.ts` | 纸张专项场景 1、3 | 白／黄纸均有二次确认 | 已验证 | 预览顶部装纸提示 |
| PAPER-005 | 总体设计 5.8、9.11 | 普通和特殊工艺不得混批 | WP-05 | `requestDetailPrint`、`buildFeiTicketLabelPrintDocument` | 纸张专项场景 5 | 混纸请求阻断 | 已验证 | Playwright 场景 5 |
| PAPER-006 | 总体设计 5.10、9.14 | 补打继承原纸张颜色 | WP-05 | `recordManualFeiTicketPrint`；补打确认与预览 | 纸张专项场景 1 | 白票补打仍要求白纸 | 已验证 | 补打确认／预览截图 |
| TEMPLATE-001 | 总体设计 2、9.12 | 普通模板删除特殊工艺整行 | WP-06 | `renderFeiTicketBusinessLabelItem` | 纸张专项场景 1 | 普通预览不存在工艺字段 | 已验证 | `fei-ticket-print-white-template-final.png` |
| TEMPLATE-002 | 总体设计 2、9.12 | 普通模板其他内容保持 | WP-06 | `buildFeiLabelItem`、`renderFeiTicketBusinessLabelItem` | 原菲票流程 2/2；组装专项通过 | 生产单、唛架、部位、尺码、SKU、数量、票号、二维码保留 | 已验证 | 白纸模板截图 |
| TEMPLATE-003 | 总体设计 2、5.12、9.13 | 特殊模板标题为“特殊工艺菲票——具体特殊工艺名称”，纸色不进入业务标题 | WP-06 | `label-print-template.ts`：`resolveFeiTicketSpecialCraftTitle`、`buildFeiLabelItem`、`renderFeiTicketBusinessLabelItem` | 纸张专项场景 3，首次打印与补打逐张标题断言 | 票面显示“特殊工艺菲票——烫画”；装纸提示仍显示黄色热敏纸，旧标题不存在 | 已验证 | `special-craft-title-print.png` |
| TEMPLATE-004 | 实施计划 WP-06、总体设计 9.13 | 长工艺和工厂名称换行不截断 | WP-06 | `print-styles.ts`：特殊标题和业务单元格自适应 | 纸张专项模板断言 | 多项工艺在单元格换行展示 | 已验证 | 黄纸模板截图 |
| TEMPLATE-005 | 总体设计 4.3 | 多张部位菲票仍使用热敏标签尺寸 | WP-06 | `buildBaseLabelDocument`：每票一张标签纸 | 纸张专项场景 1 | 12 张白票生成多张热敏标签，不改 A4 | 已验证 | `.print-label-paper` 数量断言 |
| TEMPLATE-006 | 总体设计 3、9.15 | 捆条及其它标签模板不受影响 | WP-06 | 捆条专用 `renderBindingStripFeiBusinessLabelItem` 保留 | 捆条流程专项；生产构建 | 相邻模板无本次纸色分流 | 已验证 | 捆条专项通过 |
| TEMPLATE-007 | 总体设计 2、5.11、9.13 | 每张黄色特殊工艺菲票独立展示非空生产单号（PO）和 SPU | WP-06 | `renderFeiTicketBusinessLabelItem`：黄色模板识别字段 | 纸张专项场景 3，逐张标签断言 | 黄票首次打印、批量打印及补打共用同一模板输出 | 已验证 | `fei-ticket-print-yellow-template-final.png`；所有黄票字段非空及黄票补打直达断言 |
| HISTORY-001 | 总体设计 2、5.10 | 打印记录保存纸色、模板、尺寸和来源范围 | WP-05 | `manualPrintHistory`、`recordManualFeiTicketPrint` | 纸张专项场景 1 | 单条详情显示打印历史 | 已验证 | `PRINT`／`REPRINT` 历史断言 |
| HISTORY-002 | 总体设计 5.9、9.6 | 修改数量保存原因、操作人和同步结果 | WP-04 | `updateUnprintedManualFeiTicketQuantity`、操作日志 | 纸张专项场景 1 | 单条详情显示“修改数量”和原因 | 已验证 | 改量原因截图与日志断言 |
| HISTORY-003 | 总体设计 5.9～5.10、9.7、9.14 | 删除和补打保留操作事实；既有作废状态／模板不被覆盖 | WP-04/WP-05 | `deleteUnprintedManualFeiTicket`、`recordManualFeiTicketPrint`；既有 `VOIDED` 投影 | 纸张专项场景 1、4；原菲票流程 2/2 | 删除／补打日志可查，作废模板相邻回归 | 已验证 | 操作日志、补打历史、原流程专项 |
| VERIFY-001 | 总体设计 8 | 菲票专项检查通过 | WP-07 | `tests/cutting-fei-ticket-manual-paper-routing.spec.ts`、既有专项 | 6/6 + 6 维组装 + 捆条专项 + 2/2 原流程 | 不适用（自动化） | 已验证 | 当前分支全部命令退出码 0 |
| VERIFY-002 | 总体设计 8 | 命名页面和打印场景通过 | WP-07 | Playwright 当前分支运行时 | 视觉证据脚本 1/1 | 普通 Mock 列表、普通详情、白纸预览、特殊工艺标题预览均已截图检查 | 已验证 | `/private/tmp/higoods-fei-ticket-mock-title/test-results/final-evidence/*.png` |
| VERIFY-003 | 总体设计 8 | 原型治理记录完整并通过检查 | WP-07 | `docs/prototype-review-records/2026-08-11-fcs-fei-ticket-manual-paper-routing.md` | 治理检查 `--all` 通过 | 不适用（治理） | 已验证 | 10 个用户可见文件、1 份关联记录 |
| VERIFY-004 | 总体设计 8 | 构建、CodeGraph 和任务收据闭环 | WP-07 | 项目级验证 | 构建通过；CodeGraph／收据受阻 | 局域网命名路由 200 | 已阻塞 | 隔离 worktree 未初始化 CodeGraph；收据失败于缺少 `pendingChanges`，待用户许可 `codegraph init -i` |

## 双向覆盖结果

- 正向追踪：总体设计第 1～9 节全部映射到上表原子需求；手动建票、详情维护、工艺识别、纸色、模板、历史和验证均有实现与证据。
- 反向追踪：本次 10 个受管源码文件、1 个专项测试、3 份产品文档和 1 份原型审查记录均能回到上述编号；没有发现越界的 PDA、真实后端、打印机驱动或捆条业务改造。
- 未关闭项：仅 `VERIFY-004`，原因不是实现或业务验收失败，而是隔离工作树缺少 CodeGraph 索引；初始化属于项目元数据写入，按仓库规则等待用户明确授权。
