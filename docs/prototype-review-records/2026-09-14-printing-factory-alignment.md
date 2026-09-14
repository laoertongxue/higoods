# 印花厂管理调整原型审查记录

## 1. 基本信息

| 项目 | 内容 |
|---|---|
| 日期 | 2026-09-14 |
| 需求 | 用户确认执行印花厂管理完整方案 v1.0；75项编号见交付矩阵 |
| 记录模式 | 完整产品审查 |
| 系统 | PFOS/FCS，直接复用工厂接收与PDA交接事实 |
| 分支和基线 | codex/printing-factory-alignment；a8a9b5cf2e2506f54a573ff7ca647f7e52a9075e + 本任务差异 |
| 服务 | 同一工作树Vite5188，http://192.168.0.17:5188 |
| 角色 | 计划/跟单、印花仓管、主管/操作员、下游接收人 |
| 设备 | 管理端1366×768、1280×720；交接/打印1024×768；PDA390×844 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：三个独立入口、八列加工单、需求来源、四组时间/数量、工序执行、卷码/实测重量、建单/扫码/实交/实收、仓库/统计/大屏和打印导出均调整；正常Mock补齐真实物料/花型，旧资料保持缺失提示。

使用`AGENTS.md`第4、5、7节当前基线。没有生产后端和真正鉴权/离线系统；所有操作为本地原型。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
|---|---|---|
| 角色、任务与页面模式 | 通过 | 管理列表用标准列表；待接收按本厂身份，交接分准备与实际交出；PDA使用既有小屏工作台 |
| 文案、状态、数量与单位 | 通过 | 接收不开始、工序不自动产出；0与未知分开；100→98→65→64→余33，少1有原因；混合单位不加总排序 |
| 扫码、真实图片与对象识别 | 有条件通过 | 正常两单图片完整、原卷可识别，错码/重复扫码不增加计数；历史缺图不冒充正常完整记录 |
| 防错、危险确认与主管兜底 | 通过 | 空值/错厂/SKU/无料/缺版本/超量/占用阻止；作废确认并留原明细；已实交不可改；最后补验0.5卷阻断 |
| 交接、跨端事实与异常追溯 | 通过 | 实收落在原HDR-INT000716001；短收不关闭、不二次扣库；重复和失败保存回退、冷启动均有专项 |
| 低分辨率、PDA、弱网与上传恢复 | 有条件通过 | 1280页宽无溢出、摘要48px；390PDA零收可用；保存失败回退有契约；未建设离线/上传队列和真实设备接入 |
| 命名路由、交互、图片大图与打印 | 通过 | 列表/详情/接收/两类仓/交出/统计/大屏已验；大图Esc和关闭按钮有效；A4纵向信息单与横向交出单预览可读 |

## 4. 问题标签

- 算不准
- 协作断裂
- 追溯不足

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
|---|---|---|---|---|
| 接收/加工/产出/交接互相推导造事实 | 算不准 | 仓管、主管、下游 | 分开真实动作，只保存实际领料、工序、批次和交接数量 | 无已知复现失败 |
| 草稿和扫描被当成实际交出 | 协作断裂 | 仓管和下游 | 草稿占用、扫描准备、实际出库、原记录实收分别登记 | 正常链路已验 |
| 历史单用假目标或缺少物料/花型/数量 | 追溯不足 | 跟单 | 正常样例用实际主数据；历史提示缺项并进入详情核对，不能造值补平 | 历史资料补齐仍需真实业务输入 |
| 大图按钮因遮罩在根节点外而不能关闭 | 点错风险 | 全部 | 遮罩独立关闭事件，实际按钮点击后消失 | 已复测 |
| 1280摘要挤压单位、混合单位排序无意义 | 视觉干扰 | 管理员 | 48px单行摘要可横向查看；数量按单位展示，取消混合单位数值排序 | 已复测 |
| 半卷可作为用料卷数提交 | 算不准 | 操作员 | 新增最小失败复现，数量保存必须为整数卷 | 专项重放通过 |

## 6. 最终结论

结论：有条件通过

正常印花演示闭环及已确认页面范围实现和验收完成。历史缺项及未确认的非面料印花路线按方案§12/§17/§18保留明确提示和防错，不把它们描述为生产能力完整。用户尚未验收最终页面；本轮没有GitHub提交或发布。最终技术状态以任务收据为准。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/factory-internal-warehouse-locations.ts`
- `src/data/fcs/factory-receiving-links.ts`
- `src/data/fcs/factory-receiving-source-sync.ts`
- `src/data/fcs/factory-receiving-types.ts`
- `src/data/fcs/factory-receiving-warehouse.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/printing-material-receipts.ts`
- `src/data/fcs/printing-factories.ts`
- `src/data/fcs/printing-factory-demos.ts`
- `src/data/fcs/printing-statistics.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/printing-warehouse-view.ts`
- `src/pages/print/templates/printing-work-order-template.ts`
- `src/pages/print/templates/printing-sheet-template.ts`
- `src/pages/print/printing-sheet-preview.ts`
- `src/data/fcs/print-template-registry.ts`
- `src/pages/process-factory/dyeing/pending-receipts.ts`
- `src/pages/process-factory/printing/dashboards.ts`
- `src/pages/process-factory/printing/dialogs.ts`
- `src/pages/process-factory/printing/dispatch.ts`
- `src/pages/process-factory/printing/events.ts`
- `src/pages/process-factory/printing/presentation.ts`
- `src/pages/process-factory/printing/relations.ts`
- `src/pages/process-factory/printing/statistics.ts`
- `src/pages/process-factory/printing/warehouse.ts`
- `src/pages/process-factory/printing/work-order-detail.ts`
- `src/pages/process-factory/printing/work-order-times.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/router/routes-fcs.ts`

主入口`src/main.ts`只增加当前印花路由的局部事件分发范围；受管改动均能回到[75项交付矩阵](../2026-09-14-printing-factory-delivery-matrix.md)。

### 页面路由

- `/fcs/craft/printing/work-orders`
- `/fcs/craft/printing/work-orders/PWO-PRINT-001`
- `/fcs/craft/printing/pending-receipts`
- `/fcs/craft/printing/pending-handover`
- `/fcs/craft/printing/handover-documents`
- `/fcs/craft/printing/wait-process-warehouse`
- `/fcs/craft/printing/wait-handover-warehouse`
- `/fcs/craft/printing/statistics`
- `/fcs/craft/printing/dashboards`
- `/fcs/pda/factory-receipts`
- `/fcs/print/preview?documentType=PRINTING_INFO_SHEET&sourceType=PRINTING_WORK_ORDER&sourceId=PWO-PRINT-001`

### 验证命令

- `node --import tsx scripts/check-printing-factory-alignment.ts`：通过，完整闭环被仓储/交出专项导入执行。
- `node --import tsx scripts/check-printing-version-boundaries.ts`：通过，最后增加非整数卷数失败复现并修复重放。
- `node --import tsx scripts/check-printing-factory-ui.ts`：通过，字段/版本/导出/单批打印模板。
- `node --import tsx scripts/check-printing-dispatch-pages.ts`：通过，草稿占用、扫码、实交及逐记录零/超收。
- `node --import tsx scripts/check-printing-stock-statistics.ts`：通过，库存/备料/时区/单位/历史待办。
- `node --import tsx scripts/check-printing-persistence.mts`：通过，两进程冷读取。
- `node --import tsx scripts/check-printing-authority-cleanup.ts`：通过。
- `node --import tsx scripts/check-printing-work-order-redesign.ts`：通过。
- `node --import tsx scripts/check-factory-material-receiving.ts`：通过，共享接收正常及边界。
- `node --import tsx scripts/check-factory-receiving-integration.ts`：通过，相邻染色/水溶/毛织事实回归。
- `node --import tsx scripts/check-no-piece-printing-runtime.ts`：通过。
- `npm run check:standard-list-page-template`：通过，真实Chromium列拖动；普通沙箱不能启动Chromium后，获自动审批在同一机器执行成功。
- `npm run build`：通过；最终收据将再次绑定构建结果。
- `npm run check:prototype-design-governance -- --all`：通过，最终任务收据要求并执行全工作区改动覆盖；默认暂存模式无受管差异，不能代替本结果。
- `npm run workflow:verify -- --output /tmp/printing-acceptance/task-receipt.json --task-boundary "印花厂管理方案75项实施及对应设计、矩阵、审查记录"`：通过，状态verified、blockers为空；包含路由、原型治理、标准列表、构建；CodeGraph同步退出0、待同步0。

### 真实图片验证

- 正常两单投入FAB-P200-WHITE使用`/materials/fei-ticket/white-poplin.png`；输出FAB-P200-BLUE-FLORAL及PT-BLUE-FLORAL-001 V1使用`/materials/fei-ticket/blue-white-print-cotton.png`。这是与实物对应的正式样布，同款双面分别保存身份，未用另一张无关图片冒充反面。
- 商品SPU-2024-017对应裤子正式图；列表、详情、收货、仓库、交出和打印均与名称/编号同块，正常信息单5张图全部加载（自然宽度1024/1448）。
- 大图保持比例，1280下不溢出，Esc、关闭按钮、遮罩事件均存在；实际Esc和关闭按钮已验证。图片加载中/失败有明示，失败可再次打开重载；网络故障未另行注入，历史缺图提示不能当成网络故障验收。
- 证据：`/tmp/printing-acceptance/list-1280.png`、`image-preview-1280.png`、`info-print-1024.png`、`handover-print-1024.png`、`warehouse-output-1366.png`、`pda-zero-receipt-390.png`。

### 例外

- 历史未记录的投入、花型、真实去向/卷明细不能凭空补齐；本次正常样例均完整，历史保留缺项、覆盖率与阻断。
- 非面料的接收和包装单位可用；历史纱线热转印组合、线上审核含义和运输独立身份尚待实际业务资料。遵循已确认方案的建议处理，没有新增未经确认的生产或强制结案规则。
- 打印验收为实际浏览器预览及纸张CSS，不代表物理打印机已出纸。原型保存失败回退经过专项，未建设真实弱网离线系统。

## 追加：工厂名单

按用户追加截图实施方案§19、FAC-001～004。此轮只修改工厂目录、选择/筛选/分配，其他75项仍是同一任务的已验收改动。沿用上文角色、页面、图片、自查与版本范围；新增名字不带虚构款式或物料，因此无新增图片素材。空工厂应显示空态，不能混入F090单据。名单中的新增本地标识不宣称为线上组织编号或正式资质。

专项：`node --import tsx scripts/check-printing-factory-directory.ts`；相邻回归：printing-factory-ui、printing-stock-statistics、printing-dispatch-pages。专项与相邻回归通过。1280×720 下加工单的 FLOWER/DANIS 空态、下拉与标签联动、F090 12条保留，待接收空态，两个交出页、两类仓、统计及大屏的11项选项均已实际查看。证据：`/tmp/printing-acceptance/factory-directory-browser.txt`、`factories-flower-1280.png`。分配弹窗用当前 renderPrintingDialog 生成临时页面验收选择与布局，临时页已移除；真实赋值/未知ID/再次分配在专项命令验证，未把临时预览声称为已有单据重分配成功。截图：`factory-assignment-render-1280.png`。最终任务收据路径沿用 `/tmp/printing-acceptance/task-receipt.json`，以本轮最终内容重新生成为准。

## 追加：各工厂测试数据

按方案§20和DEMO-001～005，10家业务工厂各5单，共增加50单；原F090 12单保留。状态覆盖待接收、已收待开工、加工中、待交出、已交出，下游分为待收、短收和收齐。工厂名称来自用户截图，新增编号、订单、库存和操作均为明确标注的原型测试事实，不表示真实工厂业务。

每单使用现有正式款式/物料/花型素材，单物料、单上游中央仓，保留需求来源、实际卷、工艺版本、人员及时间。本厂库位按已有组织或原型目录生成；没有编造产能或工厂资质。沿用上文角色、单位、图片、大图、危险操作和设备规则。

在当前分支和5188服务实际逐个核对10个标签各5单。FLOWER加工中单保存工序完成数量90，冷刷新后仍保留；列表加工领料100 Yard/2卷，待接收来源2卷100及入库位置对应。信息单预览有需求、5张对应对象图片、二维码、四组时间与数量。交出列表10厂分别显示实际98/108等数量以及0/短1/收齐，分页包含sipatax；待加工仓最终10条，每厂仅保留已收未领的1条，goto_global180、sipatax190，已经领料的单不再留在库存中。

验收修复：原先动态测试工厂交接头未被持久化范围纳入，导致冷刷新后只有加工单数量而无交接明细；新增固定工厂/任务身份校验和同源保存。中断补种造成的原始实收/领料遗漏，从已保存的固定测试单和操作记录恢复。单笔交接仅在原单、原卷、数量、时间唯一对应时恢复；已有记录不覆盖，不重放库存动作。冷进程检查包含待收/短收/收齐3种明细恢复、两家原始实收/领料恢复和后续用户操作保留。

专项：`check-printing-factory-demos.ts`、`check-printing-persistence.mts`；相邻检查：`check-printing-dispatch-pages.ts`、`check-printing-stock-statistics.ts`、`check-factory-receiving-integration.ts`。记录见 `/tmp/printing-demos-final.log`、`/tmp/printing-demos-recovery-final.log`、`/tmp/printing-demos-dispatch-final.log`、`/tmp/printing-demos-integration-final.log`。页面证据位于 `/tmp/printing-acceptance/` 的 `factory-demos-browser.json`、`factory-demos-flower-1280.png`、`factory-demo-detail.txt`、`factory-demo-receipt.txt`、`factory-demo-stock.txt`、`factory-demo-dispatch.txt`、`factory-demo-print.txt`、`factory-demo-print-1280.png`。

原型首次读取会初始化演示事实；针对新增量，仓库读取先按厂筛选再复制，单单读取只更新该单，已明确仓库供料/接收的单据不重复推断全局工序。原型没有新增真实后端或离线基础设施。最终技术验证由重新生成的 `/tmp/printing-acceptance/task-receipt.json` 绑定；本轮未提交或推送GitHub。


## 追加：上游明示与线上纸单（本轮当前结论）

需求ONLINE-001～006，对应方案§21、交付矩阵追加项。覆盖列表、详情、两种打印纸单及其路由加载；保留已有62张原型演示及用户存储。上游按同一组织直接列出原单编号、类型、状态、计划和实发；普通导出保留，两个额外导出入口及处理器移除。单张/批量确认单与信息单改为直接预览链接，不再将打开预览记为已经打印或修改库存/签認。

线上只读样本：YH26399确认单与信息单、YH27250双面补料确认单。确认单还原14行七列表、编辑/打印/转印签认格、Storage/Gudang/Remark、正里面图和补料横幅/角标；信息单还原5行表、输出SKU、PO、实际用量与卷数。两种表都保留本单二维码，图片使用该对象正式素材。没有事件的签字和时间不编造；长度精确按1 Yard=0.9144 Meter换算，非长度不冒充Meter。线上整数显示造成的精度损失不移植。

首次预览此前会加载其他工厂的通用打印依赖，现两种纸单独立加载，通用注册表外部接口保留。列表/详情进入实际预览已确认；无效单号明确提示重新选择。专项覆盖所有62条纸单字段、单双面、批量去重、长度精度/kg和预览不写入仓储。

当前现场验收：1280×720列表无主体横向溢出，原单001/002直接显示60/40 Yard；点001进入正确来源单据和接收记录。1366×768三张确认单均为210×148.5mm/14行，无内部高度溢出。信息单5行、商品图片大图和关闭通过；确认单正面大图与Esc关闭通过。相关正常对象图片实际加载。历史缺图片/数量仍保留原有资料缺项，不伪造历史事实。

自动化：printing-online-parity、printing-factory-ui、printing-output-documents、printing-authority-cleanup、typecheck通过；build通过（仅既有大chunk提示）。旧authority测试的正式需求唯一性限定正式12场景，新增工厂模拟场景仍由factory-demos专项验证固定任务/单号身份，未把正式域唯一性门禁删除。最终治理、CodeGraph同步和技术收据以`/tmp/printing-parity/task-receipt.json`为准。

证据目录：`/tmp/printing-parity/`；当前页面截图`list-final-1280.png`、`info-final-1280.png`，来源明细`upstream-source.txt`，专项日志`online-parity.log`、`ui-final.log`、`output-final.log`、`authority.log`、`typecheck-final.log`。

未关闭项：系统打印/PDF实际分页尚待验收。Chrome前台在其他操作中持续切换，原生打印点击被工具中断；内嵌浏览器只能确认纸单页面，不将按钮点击或CSS页高当作系统打印成功。PAR-007、ONLINE-006保持已实现待验证；此项未关闭前不声明本轮完整打印交付。未操作真实打印机、未提交/推送GitHub。

## 追加：两种打印纸单视觉优化

按用户本轮“内容、结构、功能不变”要求，仅调整 `src/pages/print/templates/printing-sheet-template.ts` 的 `sheetStyles()`。与本轮修改前文件逐字比较，函数外代码完全一致；14行确认单、5行信息单的字段、顺序、合并单元格、图片、二维码、签字格、备注和打印事件均保留。确认单依旧210×148.5mm、两张一页；信息单依旧单张分页。本轮不增加业务能力、状态、数据或菜单，不吸收前文其他实施工作。

视觉调整：统一字体与数字对齐，适当提高确认单字号；细化表格边框，以浅灰底区分标签和签认区域，突出单号、SKU及数量；均衡信息单列宽、内边距与留白，减少标签和编号的零碎换行。仅屏幕预览增加轻微纸张阴影，打印保留原有页型与分页规则。补料横幅及角标保留原文、位置和条件，仅调整样式；当前62张本地单据没有补料样本，未把该分支描述为本轮现场通过。

角色仍为管理端查看与现场纸单签认，沿用上文中文业务说明、现场单位、图片对应、防错与操作边界。原有正式商品/花型图片不替换；确认单双面花型、信息单商品缩略图实际加载，点击大图、关闭按钮及Esc关闭通过，弹窗关闭后无残留。无新增数量输入、危险动作或整页重绘；纯样式变更不另建状态测试。

当前版本：`codex/printing-factory-alignment`，基线HEAD `a8a9b5cf2e2506f54a573ff7ca647f7e52a9075e`，5188服务PID 25084工作目录为本仓库。命名路径为 `/fcs/print/preview` 的 `PRINTING_CONFIRMATION` 和 `PRINTING_INFO_SHEET`，样本PWO-PRINT-001/002。1366×768与1280×720真实浏览器预览已核对；单双面批量确认单均14行、宽793.70px/高561.26px，内部无高度溢出；信息单5行，页面主体无横向溢出。

本轮证据：`/tmp/printing-style/style-only.txt`（函数外逐字一致）、`parity.log`（现有62张单据字段/单双面/批量/单位/只读契约通过）、`confirmation-after-1366.png`、`confirmation-batch-1280.png`、`info-after-1366.png`、`info-after-1280.png`。尝试以 `--paths` 限定模板与本记录生成收据，但工具要求覆盖整个工作区的历史未提交差异，无法限定本轮；按AGENTS第7/8.1节不扩大吸收旧改动，因此未生成有效任务收据。本轮改用专项契约、逐字范围比较、页面验收、构建、治理检查与CodeGraph同步作为直接证据，日志保存在同一临时目录。前述系统打印/PDF实际分页待验项保持不变；本轮纸面预览通过不替代物理出纸或系统打印回执。未提交/推送GitHub。

## 追加：main 合并与 GitHub 发布核查

用户在上述视觉调整与待验说明后明确要求“本地合并进main，并推送至github”。本次发布范围为本任务完整印花厂调整、工厂名单和演示数据、上游明示、线上纸单及视觉优化，对应矩阵全部 OBJ/NAV/UI/LIST/TIME/QTY/RCV/PROD/INV/OUT/PAR/STAT/IMG/DATA/DEL、FAC、DEMO、ONLINE 需求。工作区文件集合与此前 `/tmp/printing-parity/task-receipt.json` 完整任务范围一致，无新增其他业务模块变更；本轮不再以纯样式范围生成收据，而对整个授权发布范围重新验证。

合并前本地 HEAD、main 与 fetch 后 origin/main 均为 `a8a9b5cf2e2506f54a573ff7ca647f7e52a9075e`，没有远端分叉。最终复核关注原单归属、实际接收与用料扣库、演示数据冷启动保存、交出与下游实收、路由及打印入口；沿用前述命名页面证据和最后样式修改后的纸单截图。最终技术收据输出 `/tmp/printing-main-release/task-receipt.json`，专项日志及提交文件清单位于同目录，以实际命令结果为准。系统打印/PDF实际分页待验项 PAR-007、ONLINE-006继续公开保留；推送授权不是对该项的验收回执，不声明物理出纸或Vercel部署已验证。提交及远端分支状态由 Git 命令和 GitHub API 单独确认。
