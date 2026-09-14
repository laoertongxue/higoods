# 印花厂管理实施与交付矩阵

日期：2026-09-14。对应 [调整方案 v1.1](./2026-09-14-printing-factory-adjustment-plan.md)；用户确认的业务方案版本 v1.0，确认语句“OK，执行实施。”。代码验收人：Codex；最终产品接受人：用户，尚未给出实施后的接受回执。

验证基线 HEAD：`a8a9b5cf2e2506f54a573ff7ca647f7e52a9075e`，分支 `codex/printing-factory-alignment`，同工作树端口5188。代码最终差异以 `/tmp/printing-acceptance/task-receipt.json` 中内容哈希为准；不表示已提交 GitHub。

## 1. 实现路径和证据索引

表中 `printing/*.ts` 表示 `src/pages/process-factory/printing/*.ts`；`dyeing/*.ts` 表示 `src/pages/process-factory/dyeing/*.ts`；其他裸文件名表示 `src/data/fcs/` 下的实际文件。含 `src/` 的为仓库相对完整路径。所有实现均在当前应用被引用，未建立独立后端。

| 证据 | 实际执行或现场结果 | 输出位置 |
|---|---|---|
| A | `node --import tsx scripts/check-printing-factory-alignment.ts`，基础事实+完整闭环（亦被D/E导入执行） | `/tmp/printing-stock-final.log` |
| B | `node --import tsx scripts/check-printing-factory-ui.ts`，八列、四组、来源、CSV、单/双面模板及批量分页 | `/tmp/printing-ui-final.log` |
| C | `node --import tsx scripts/check-printing-version-boundaries.ts`，多版本分批、实测重量、零损耗、工序及变更边界、重复部分领料和非整数卷数阻断 | `/tmp/printing-version-final.log` |
| D | `node --import tsx scripts/check-printing-dispatch-pages.ts`，建单、分组、占用、扫码、交接、逐记录零/超收 | `/tmp/printing-dispatch-final.log` |
| E | `node --import tsx scripts/check-printing-stock-statistics.ts`，库存/备料、时间/单位、历史覆盖及待办 | `/tmp/printing-stock-final.log` |
| F | `node --import tsx scripts/check-printing-persistence.mts`，两进程冷读取 | `/tmp/printing-persist-final.log` |
| G | `node --import tsx scripts/check-printing-authority-cleanup.ts` 与 `scripts/check-printing-work-order-redesign.ts` | `/tmp/printing-authority-final.log`、`/tmp/printing-redesign-final.log` |
| H | `node --import tsx scripts/check-factory-material-receiving.ts`，空值/零、短超收、错厂SKU、单位/位置/幂等 | `/tmp/printing-receiving-final.log` |
| I | `node --import tsx scripts/check-factory-receiving-integration.ts`，染色/水溶/毛织共享接收和库存直接回归 | `/tmp/printing-integration-final.log` |
| J | `node --import tsx scripts/check-no-piece-printing-runtime.ts`，物料印花边界 | `/tmp/printing-no-piece-final.log` |
| S | 标准列表静态治理及 `npm run check:standard-list-page-template` 浏览器列拖动 | `/tmp/printing-list-static-final.log`、`/tmp/printing-standard-list-final.log` |
| N | 路由/构建/原型治理/CodeGraph，结果由任务收据绑定 | `/tmp/printing-acceptance/task-receipt.json` |

## 2. 浏览器与打印证据

全部为本地原型演示，线上仅在方案阶段只读核查。下表中的截图和文本在 `/tmp/printing-acceptance/`。不把自动化数据检查写作所有按钮均已人工点击。

| 编号 | 命名页面/设备 | 实际结果和证据 |
|---|---|---|
| B1 | `/fcs/craft/printing/work-orders`；1366×768 / 1280×720 | 八业务列+选择列，普通导出、更多筛选/收起、四段横线、列设置、查询；`list.txt`、`list-1280.png` |
| B2 | `/fcs/craft/printing/pending-receipts` | PH-001实收60/40，两次记录；接收后仍未开始，空值阻止；原卷PRINT-RAW-001/002，库位入账 |
| B3 | `/fcs/craft/printing/pending-handover`、`handover-documents`；1366/1280/1024 | SJ-20260914-1789365705945-1；2卷65，错扫码、重复扫码1/2、扫齐2/2无出库、实交65；HDR-INT000716001实收64，少1及说明；`handover-detail.txt`、`handover-detail-1024.png` |
| B4 | `/fcs/craft/printing/work-orders/PWO-PRINT-001` | 实际花型/打样确认、开工100、打印100、转印98、产出98损耗2；3条草稿填32/33/33；编辑取消、大图Esc及关闭按钮；四组时间和数量 |
| B5 | `/fcs/craft/printing/wait-process-warehouse`、`wait-handover-warehouse`、`statistics`、`dashboards` | 余卷33；已交卷消失；统计同值、48px摘要、筛选下钻5单；`warehouse-output.txt`、`warehouse-output-1366.png`、`statistics.txt`、`statistics-1280.png`、`dashboard.txt` |
| B6 | `/fcs/pda/factory-receipts`；390×844 | 本地F090管理员身份；明确零收保存FR-1789366830166-pr4mo，0卷/0Yard无正库存、继续接收；页面宽390；`pda-zero-receipt.txt`、`pda-zero-receipt-390.png` |
| B7 | 交出单打印及信息/确认单预览 | 交出A4横向预览、2卷32/33、目标/收货人、理论重量、4张实际对象图片；`handover-print.txt`、`handover-print-1024.png`。信息单A4纵向、5张图全部加载，保存`info-print.txt`、`info-print-1024.png`；批量确认2单2页9图已验。预览按纸张CSS分页，不是物理打印机出纸证明 |

## 3. 逐项交付

每行产品确认人/版本均为“用户 / v1.0”；代码/页面验证人均为Codex。该统一字段与本表按编号联查，不代表用户已接受最终版本。表中状态表示实现验收，历史未知和未确认工艺受方案§12、§17、§18明确约束。

| 需求编号 | 来源章节/原子需求 | 工作包 | 实际实现文件 | 自动化证据 | 页面/设备证据 | 当前状态 |
|---|---|---|---|---|---|---|
| OBJ-001 | §3.1：仅处理本次物料印花范围，保持既有技术体系 | WP1 | printing-task-domain.ts | A/J | B1：只出现加工物料，无裁片操作 | 已验证 |
| OBJ-002 | §3.3：一个加工单绑定确定的投入物料与输出要求 | WP1 | factory-receiving.ts; printing-task-domain.ts | A | B1/B2：固定同一 SKU；错 SKU 阻断 | 已验证 |
| OBJ-003 | §3.3：同一上游多批来源保留明细且组织只显示一次 | WP1 | printing/relations.ts; factory-receiving.ts | A | B1/B2：同一中央仓，60/40 两批，组织只展示一次；工厂多批沿用同一关系约束 | 已验证 |
| OBJ-004 | §3.3：需求来源、创建方式、补料标识独立且可并存 | WP1 | printing/presentation.ts; printing-task-domain.ts | B | B1/B4：需求编号、创建方式、补料独立 | 已验证 |
| OBJ-005 | §3.2—3.3：加工厂、生产厂、接收组织、接收人和操作身份不混用 | WP1 | factory-receiving-links.ts; printing/dispatch.ts | A/D/H | B2/B3/B6：收货员、下游接收人及目标组织分别显示 | 已验证 |
| NAV-001 | §4：三个独立新增入口可直达且旧入口读取同一数据 | WP4 | src/router/routes-fcs.ts; src/data/app-shell-config.ts | D/N | B1/B2/B3：命名路由与刷新；旧仓库/审核入口指向新页面 | 已验证 |
| UI-001 | §4：标准列表分页及列偏好按路由独立保存 | WP3 | printing/work-orders.ts; printing/dispatch.ts; printing/warehouse.ts | B/D/S | B1/B3/B5：标准列表、列设置、分页、按路由偏好 | 已验证 |
| UI-002 | §4：宽表内部滚动且操作列固定 | WP3 | printing/work-orders.ts; printing/dispatch.ts; printing/warehouse.ts | S | B1/B3/B5：1366/1280 表内滚动和固定操作列 | 已验证 |
| UI-003 | §4,13：输入及轻交互局部更新且反馈及时 | WP3 | src/main.ts; printing/events.ts; printing/dialogs.ts | B/D | B1/B3：输入不中断、弹层局部更新，扫码立即反馈 | 已验证 |
| LIST-001 | §5.1：印花厂页签与数量使用真实主数据和去重单数 | WP3 | printing/work-orders.ts | B | B1：工厂页签与 12 张初始单去重计数 | 已验证 |
| LIST-002 | §5.1：基础及更多筛选覆盖列出的印花条件 | WP3 | printing/work-orders.ts | B | B1：基础/更多筛选、展开/重置；静态字段契约 | 已验证 |
| LIST-003 | §5.1：综合查询包含正反花型、来源和实际单据编号 | WP3 | printing/work-orders.ts | B | B1：来源、花型/版本和单号组成查询对象 | 已验证 |
| LIST-004 | §5.1：筛选操作行始终位于全部条件之后 | WP3 | printing/work-orders.ts | B | B1：展开后按钮仍位于筛选条件下方 | 已验证 |
| LIST-005 | §5.1,10.4,21：只保留线上普通导出，移除两个额外专项导出 | WP5/ONLINE | printing/events.ts; printing/work-orders.ts | check-printing-factory-ui.ts | /tmp/printing-parity/list-final-1280.png；普通导出行列专项通过 | 已验证 |
| LIST-006 | §5.2：需求来源在加工单/商品列显著且有真实编号 | WP3 | printing/presentation.ts; printing/work-orders.ts | B | B1/B4：需求来源独立显著信息块，完整来源单号 | 已验证 |
| LIST-007 | §5.2：投入与上游列显示真实物料规格和来源组织 | WP3 | printing/relations.ts; printing/work-orders.ts | A/B | B1：真实投入 SKU、成分、幅宽、克重和上游 | 已验证 |
| LIST-008 | §5.2：要求列区分工艺、加工方式和适用参数 | WP3 | printing/relations.ts; printing/presentation.ts | B/C | B1/B4：工艺、印制方式、面别及适用参数 | 已验证 |
| LIST-009 | §5.2：双面花型有独立正式图、编号与版本 | WP3 | printing/dialogs.ts; printing-task-domain.ts | B/C | B4：双面各有正式图、编号、版本；缺资料阻止确认 | 已验证 |
| LIST-010 | §5.2：产出与下游列显示真实 SKU、组织和目标仓库 | WP3 | printing-task-domain.ts; printing/relations.ts | A/D | B1/B3：WH-FABRIC-001 实际主数据；历史目标缺失显式待核对 | 已验证 |
| TIME-001 | §5.3：单据创建段取各业务单据真实创建时间 | WP3 | printing/work-order-times.ts | B | B1/B4：单据创建段，原始缺失不造时间 | 已验证 |
| TIME-002 | §5.3：上游接收段区分待收生成、发出与各次实收 | WP3 | printing/work-order-times.ts; dyeing/pending-receipts.ts | A/B | B2/B4：来源创建/发出/首次实收/最近实收/2次 | 已验证 |
| TIME-003 | §5.3：生产段区分计划、开工、工序与整单完成 | WP3 | printing/work-order-times.ts; printing-task-domain.ts | B/C | B4：计划、实际开工、打印、转印、批次及整单时间分开 | 已验证 |
| TIME-004 | §5.3：交出段区分建单、扫齐、实际交出与下游实收 | WP4 | printing/work-order-times.ts; printing-task-domain.ts | D | B3/B4：13:01:45 建单、13:02:02 扫齐、13:02:03 实交、13:05:08 下游实收 | 已验证 |
| TIME-005 | §5.3：四段有横线且多批显示首次/最近/次数 | WP3 | printing/work-order-times.ts; printing/work-orders.ts | B | B1/B4：四段横线和多批次数 | 已验证 |
| QTY-001 | §5.4：数量按计划、上游接收、加工、下游交出四段显示 | WP3 | printing/presentation.ts | A/B | B1/B4：计划、上游接收、加工、交出四组 | 已验证 |
| QTY-002 | §8.3,11：不同单位分组，长度转换保留原值和精度 | WP1 | factory-receiving.ts; printing-statistics.ts; printing/dispatch.ts | D/E/H | B1/B3/B5：Yard/米/kg 分组；无跨单位合并排序 | 已验证 |
| QTY-003 | §7—8：打印、转印、双面不重复增加最终产出 | WP3 | printing-task-domain.ts; printing-statistics.ts | A/E | B4/B5：打印100、转印98只计合格产出98 | 已验证 |
| RCV-001 | §6.1：待接收由有效来源单及明细形成 | WP2 | printing-material-receipts.ts; factory-receiving-source-sync.ts | A/H | B2：来源001—004有效，未审核005不进入正常待收 | 已验证 |
| RCV-002 | §6.1：无有效来源不能以仓库总库存判为待接收 | WP2 | printing-task-domain.ts | A | B1/B2：有库存无本单来源不判为可收 | 已验证 |
| RCV-003 | §6.2：扫送货单后逐来源明细登记并可追溯 | WP2 | dyeing/pending-receipts.ts; factory-receiving.ts | H | B2：逐来源/原卷确认，送货单明细沿用共用组件 | 已验证 |
| RCV-004 | §6.2：实收按物料单位/包装登记，不统一强制卷数 | WP2 | factory-receiving-types.ts; dyeing/pending-receipts.ts | H/I | B6：PDA 按本厂身份接收；纱线净重/包装及辅料单位沿用已验证共用接收 | 已验证 |
| RCV-005 | §6.2：短收保留记录与未到部分，不自动结案 | WP2 | factory-receiving.ts | H | B2：共享接收短收和后续补到契约；入库按实收 | 已验证 |
| RCV-006 | §6.2：超收按实际入库且保留多收责任事实 | WP2 | factory-receiving.ts | H | B2：超收真实数量及多收原因；不改来源应收 | 已验证 |
| RCV-007 | §6.2：显式零收有记录无正库存，空白阻止提交 | WP2 | factory-receiving.ts; dyeing/pending-receipts.ts | H | B6：显式0卷/0Yard已保存；空值阻止；0不产生正库存 | 已验证 |
| RCV-008 | §6.2：错厂、错物料、重复交接入仓被阻止 | WP2 | factory-receiving-links.ts; factory-receiving.ts | A/H/I | B2/B6：本厂账号、SKU、原交接幂等约束 | 已验证 |
| RCV-009 | §6.3：备货先收后关联不会再次增加库存 | WP2 | factory-receiving-links.ts; printing-warehouse-view.ts | A/E | B5：收50后关联20，实物仍50、自由30，未产生第二张收货单 | 已验证 |
| RCV-010 | §6.3：本厂接收不记录开工，不再次扣上游库存 | WP2 | printing-task-domain.ts; factory-receiving-links.ts | A/I | B2/B4：收100后未开始；实际开工才产生用料100 | 已验证 |
| RCV-011 | §6.3：来源收货进度与计划备料缺口分别计算 | WP2 | printing-task-domain.ts; printing/presentation.ts | A/E | B1/B2：来源收齐与整单计划缺料分别显示 | 已验证 |
| PROD-001 | §7.1：已分厂等待花型不映射为待分配 | WP3 | printing-task-domain.ts | A/B | B1/B4：已分厂等待花型仍未开始 | 已验证 |
| PROD-002 | §7.1：细分生产环节按真实工艺适用性显示 | WP3 | printing-task-domain.ts; printing/dialogs.ts | C/B | B4：直喷样例无转印；热转印必须完成转印 | 已验证 |
| PROD-003 | §7.2：开工需真实备料和已确认适用花型版本 | WP3 | printing-task-domain.ts; printing/dialogs.ts | A/C | B4：缺料/缺花型阻止，确认实际版本后开工 | 已验证 |
| PROD-004 | §7.2：报工只增加本次实际工序且重复提交不叠加 | WP3 | printing-task-domain.ts | A/C | B4：工序逐步执行；重复同命令幂等，冲突命令阻止 | 已验证 |
| PROD-005 | §7.2：部分批次完成不等于整单全部完成 | WP3 | printing-task-domain.ts | C | B4：专项50/50分批，未整单完成前不自动完成 | 已验证 |
| PROD-006 | §7.2：实际卷数量有据，平均拆分结果只作草稿 | WP3 | printing-task-domain.ts; printing/dialogs.ts | A/C | B4：生成3条0数量草稿，逐卷输入32/33/33后才可建单/打印 | 已验证 |
| INV-001 | §8.1：备料占用与实际投入分开，只扣一次原料 | WP2 | factory-receiving-warehouse.ts; printing-task-domain.ts | A/E | B2/B5：备料不扣实物；实际用料100只扣一次 | 已验证 |
| INV-002 | §8.2：待交出仓与待交出列表使用同一产出事实 | WP4 | printing-warehouse-view.ts; printing/dispatch.ts | A/E/D | B3/B5：待交出仓余33与可建单33一致 | 已验证 |
| INV-003 | §8.3：损耗与在制分开，未完成部分不自动视为损耗 | WP3 | printing-task-domain.ts; printing-statistics.ts | C/E | B4/B5：在制不自动损耗，已确认损耗2，未知保持未知 | 已验证 |
| OUT-001 | §9.1：草稿产出也能进入卷码维护并看到阻断原因 | WP4 | printing/dispatch.ts; printing/dialogs.ts | D | B3/B4：未实测卷提示阻断并进入维护 | 已验证 |
| OUT-002 | §9.1：批量建单按厂、去向、仓库、单位分组 | WP4 | printing-task-domain.ts; printing/dispatch.ts | D | B3：建单预览分组按厂、接收组织、仓库和单位 | 已验证 |
| OUT-003 | §9.1：卷码不可重复占用，建单不可超过可用产出 | WP4 | printing-task-domain.ts | A/D | B3：重复占用/超过产出阻止 | 已验证 |
| OUT-004 | §9.1：分批建单与合入已有草稿保留剩余可用产出 | WP4 | printing-task-domain.ts; printing/dispatch.ts | D | B3/B5：先建65余33；草稿合入不重复入库 | 已验证 |
| OUT-005 | §9.2：单据数、加工单数、SKU 数、卷数分别统计 | WP4 | printing/dispatch.ts | D | B3：1张交出单/1加工单/1SKU/2卷/65Yard | 已验证 |
| OUT-006 | §9.3：建单和扫齐均不记实际交出、不扣实物库存 | WP4 | printing-task-domain.ts; printing/dispatch.ts | A/D | B3：扫齐2/2仍未实际交出，在厂98 | 已验证 |
| OUT-007 | §9.3：错扫/重复扫不计数，变更明细重新核对 | WP4 | printing-task-domain.ts; printing/dispatch.ts | D | B3：错码被拒；重复扫码仍1/2；修订重扫 | 已验证 |
| OUT-008 | §9.3：实际交出只扣本次并生成一份下游待接收 | WP4 | printing-task-domain.ts; pda-handover-events.ts | A/D/F | B3/B5：实交65只扣一次，生成HDR-INT000716001 | 已验证 |
| OUT-009 | §9.4：草稿移除/作废释放占用且确认留痕 | WP4 | printing-task-domain.ts; printing/dispatch.ts | A/D | B3：移除最后卷形成作废，保留原明细并释放占用 | 已验证 |
| OUT-010 | §9.4：已交出不能直接删除或覆盖实际交出数量 | WP4 | printing-task-domain.ts; printing/dispatch.ts | D | B3：已交出明细不可编辑/删除 | 已验证 |
| OUT-011 | §8.3,9.4：下游实收不重复扣本厂，短/超收独立表达 | WP4 | printing-task-domain.ts; factory-receiving-links.ts | A/D | B3/B5：实收64不再次扣库，少1有原因；专项多记录零/超收不自动分摊 | 已验证 |
| PAR-001 | §10.1：详情关联能打开真实来源、卷及交出记录 | WP3 | printing/work-order-detail.ts; printing/dispatch.ts | B/D | B3/B4：实际加工单、来源、交出记录可相互进入 | 已验证 |
| PAR-002 | §10.2：编辑展示需求来源，实际数量与时间默认只读 | WP3 | printing/dialogs.ts | B/C | B4：来源可见；数量时间只读；关闭编辑不写入 | 已验证 |
| PAR-003 | §10.2：改厂/改投入/改花型保留既有执行事实和版本 | WP3 | printing-task-domain.ts; printing/dialogs.ts | C/B | B4：版本变更只影响后续，旧批次与卷保留V1；已有在制禁止改要求 | 已验证 |
| PAR-004 | §10.2：取消须核对已有物料责任，不能删除在制历史 | WP3 | printing-task-domain.ts; printing/dialogs.ts | C | B4：有实收/用料/产出责任不能直接取消 | 已验证 |
| PAR-005 | §10.3,21：两种纸单按线上字段及版式；详细追溯留在列表/详情/编辑 | WP5/ONLINE | src/pages/print/templates/printing-sheet-template.ts | check-printing-online-parity.ts | /tmp/printing-parity/info-final-1280.png；确认单14行/信息单5行、单双面及补料预览 | 已验证 |
| PAR-006 | §10.3：条码和交出打印基于实际物理明细与单位 | WP5 | printing/dispatch.ts; printing/dialogs.ts | D/C | B7：交出打印32/33实际卷，理论重量标签；未实测卷不能打印 | 已验证 |
| PAR-007 | §10.3,21：批量去重、确认单A4每页两张，系统分页独立验收 | WP5/ONLINE | src/pages/print/templates/printing-sheet-template.ts | check-printing-online-parity.ts | 三单预览均为210×148.5mm且无内容溢出；系统打印因前台操作中断待验 | 已实现待验证 |
| PAR-008 | §10.4：0、未知、未发生、不适用在各表面一致 | WP5 | printing/presentation.ts; printing/events.ts; printing-statistics.ts | B/C/E | B1/B4/B5：0数值、尚未发生、不适用、历史未记录分开 | 已验证 |
| STAT-001 | §11.1：本厂实收与下游实收名称、取值明确不同 | WP5 | printing-statistics.ts; printing/statistics.ts | E | B5：本厂实收100与下游64分列 | 已验证 |
| STAT-002 | §11.1：今日、超期按业务时区及对应事件计算 | WP5 | printing-statistics.ts | E | B5：Jakarta 17:00UTC跨日；实际批次增量；无交期不超期 | 已验证 |
| STAT-003 | §11.1：历史缺失公开覆盖范围，不造数补平 | WP5 | printing-statistics.ts; printing/statistics.ts | E | B5：公开实收/完工缺失范围，不计入伪造每日趋势 | 已验证 |
| STAT-004 | §11.2：统计下钻保持筛选，大屏只展示有效待办 | WP5 | printing-statistics.ts; printing/statistics.ts; printing/dashboards.ts | E | B5：物料筛选下钻5单；历史待办进入详情；已关闭不出现 | 已验证 |
| IMG-001 | §12：所有适用对象都有真实对应素材 | WP1 | printing/presentation.ts; printing-task-domain.ts; printing/relations.ts | B/C | B1/B3/B4/B7：正常样例实际图片完整；历史缺图明确提示且不能开工 | 已验证 |
| IMG-002 | §12：大图、加载/失败与关闭方式可用 | WP3 | printing/events.ts; printing/presentation.ts | 不适用：视觉和交互项 | B1/B4：Esc及关闭按钮已验；最终1280宽大图可打开、按钮关闭后遮罩消失 | 已验证 |
| DATA-001 | §12：演示数据覆盖列出的状态、来源和物料边界 | WP1 | printing-task-domain.ts; printing-material-receipts.ts | A/C/D/H/I | B2/B3/B4/B5/B6：12类场景按§18边界，正常闭环+可操作演变+历史阻断；未确认非面料工艺不伪造 | 已验证 |
| DATA-002 | §12—13：冷刷新和重入保持已保存单据、卷与数量 | WP6 | printing-task-domain.ts; pda-handover-events.ts | F | B3/B6：冷进程100/98/65/64/33；刷新保留单据/实收与零收记录 | 已验证 |
| DEL-001 | §14—16：完成正向/反向追踪及适用验证才声明完成 | WP6 | 全部本任务文件 | A—N/任务收据 | 正向75条及反向文件归属；task-receipt.json为verified、无阻断 | 已验证 |

## 4. 正向与反向追踪

75个登记编号无重复、无遗漏，分别回到方案§3—§16。新增接收/生产/版本/卷码/交出/统计契约归入OBJ、RCV、PROD、INV、OUT、STAT；菜单及主事件分发归NAV/UI；模板归PAR；持久化修正归DATA；旧测试更新归DEL，不以保留旧错误断言为目标。

本轮未修改依赖、部署配置、公共列表框架和非相关业务页面。共用接收修改通过I验证染色/水溶/毛织相邻路径；没有把原型收货描述为线上业务发生。

## 5. 当前验收边界

- 两张正常演示单的物料/花型资料完整，其余历史样例不伪造未记录数量、时间、去向或图片。缺正式素材/未知责任时阻止开工或建单，可进入资料核对。
- 非面料的接收单位和包装受共享契约覆盖；未确认的非面料印花生产组合仍待业务确认。与原方案§17一致，不将该场景标成已获生产许可。
- 最终1280列表/统计、图片关闭与1024信息单/交出预览已验收；浏览器临时尺寸已恢复。任务收据为verified，CodeGraph同步退出0、待同步0，适用检查全部退出0。
- 本次没有真实接口、线下打印机或生产运输系统，也未提交/合并/推送GitHub。

## 工厂名单追加追踪

产品确认：用户 2026-09-14 截图及“把这些工厂都补进原型里”；原 75 项范围不变，追加 FAC 4 项。

| 需求编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化 | 页面/打印/设备 | 状态 | 证据 | 确认人/版本 |
|---|---|---|---|---|---|---|---|---|---|
| FAC-001 | 方案§19 | 截图11家工厂名称齐全，已有ID复用 | FAC | printing-factories.ts / PRINTING_FACTORIES | check-printing-factory-directory.ts | 1280×720加工单；无新增打印字段 | 已验证 | /tmp/printing-factory-directory.log | 用户追加截图；a8a9b5cf+本任务差异 |
| FAC-002 | 方案§19 | 8个页面使用完整名单，零数据可切换且按ID筛选 | FAC | printing/work-orders、dispatch、warehouse、statistics、dashboards.ts；printing-material-receipts.ts | 同上 | 8路由切换/筛选 | 已验证 | /tmp/printing-acceptance/factory-directory-browser.txt | 用户追加截图；a8a9b5cf+本任务差异 |
| FAC-003 | 方案§19 | 分配下拉及ID名称一致，错ID和再次分配阻断 | FAC | printing/dialogs、events.ts；printing-task-domain.ts / assignPrintingWorkOrder | 同上 | 当前渲染函数弹窗预览+下拉；提交使用专项，不涉及打印版式 | 已验证 | /tmp/printing-factory-directory.log | 用户追加截图；a8a9b5cf+本任务差异 |
| FAC-004 | 方案§19 | F090不重复，原有现场记录和数量保持 | FAC | printing-factories.ts / listPrintingFactoryOptions | 同上事实前后快照 | 切回测试工厂12条及已存接收记录 | 已验证 | /tmp/printing-acceptance/factory-directory-browser.txt | 用户追加截图；a8a9b5cf+本任务差异 |

## 各工厂测试数据追加追踪

产品确认：用户 2026-09-14 截图及“这些工厂都要补上测试数据”。在原 75 项、FAC 4 项基础上追加 DEMO 5 项。技术验证人 Codex；用户尚未接受最终页面。验证版本为 a8a9b5cf 加本任务最终差异，内容绑定同一任务收据。

| 需求编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化 | 页面/打印/设备 | 状态 | 证据 | 确认人/版本 |
|---|---|---|---|---|---|---|---|---|---|
| DEMO-001 | 方案§20 | 10厂各5单，唯一单/任务号，原F090 12单保留 | DEMO | printing-factory-demos.ts / buildPrintingFactoryDemoOrders；printing-task-domain.ts / seedDomain | check-printing-factory-demos.ts | 1280×720加工单10个厂标签各5，总62 | 已验证 | /tmp/printing-demos-final.log；/tmp/printing-acceptance/factory-demos-browser.json | 用户追加截图；本任务最终差异 |
| DEMO-002 | 方案§20 | 每厂5个可继续操作阶段，交出覆盖待收/短收/收齐 | DEMO | printing-factory-demos.ts / initializePrintingFactoryDemoProgress | 同上及check-printing-persistence.mts | FLOWER加工中工序填报保存并刷新，10厂交出单分别显示实际接收 | 已验证 | /tmp/printing-acceptance/factory-demo-detail.txt、factory-demo-dispatch.txt | 同上 |
| DEMO-003 | 方案§20 | 单物料单上游、需求及图片/版本/单位/时间/下游完整，明确模拟 | DEMO | printing-factory-demos.ts；printing/relations.ts | check-printing-factory-demos.ts、factory-ui | 列表25张对象图加载；信息单5张对象图及来源/数量/时间 | 已验证 | /tmp/printing-acceptance/factory-demos-flower-1280.png、factory-demo-print.txt、factory-demo-print-1280.png | 同上 |
| DEMO-004 | 方案§20 | 来源、实收、领料、产出卷、交接及库存统计一致 | DEMO | factory-internal-warehouse-locations.ts；factory-receiving.ts；printing-task-domain.ts；pda-handover-events.ts | demos、stock-statistics、dispatch-pages、factory-receiving-integration | FLOWER来源2卷100实收及本厂仓；10厂交出单数量；待加工库存按实际用料扣减 | 已验证 | /tmp/printing-demos-recovery-final.log；/tmp/printing-acceptance/factory-demo-receipt.txt、factory-demo-dispatch.txt、factory-demo-stock.txt | 同上 |
| DEMO-005 | 方案§20 | 冷启动保留后续操作，缺失初次数据按已存事实恢复且不重复扣库/交出 | DEMO | printing-task-domain.ts / seedDomain、runPrintProcessMutation；printing-factory-demos.ts / restoreDemoHandoverRecord；pda-handover-events.ts / isPrototypePrintHandoutHead | check-printing-persistence.mts：独立进程、原单事实、后续收货/工序、3种交接恢复、2厂领料恢复 | 页面重载后工序时间保留，交出实收和库存正确 | 已验证 | /tmp/printing-demos-recovery-final.log；/tmp/printing-acceptance/task-receipt.json | 同上 |

本次只为已确认工厂建立演示事实，未修改原始12单归属或统一补平历史缺项。新增代码均回到DEMO编号；名单仍使用FAC统一目录。早先FAC验收的空态是当时版本结果，当前10家已有用户要求的新测试单。


## 追加：线上单据对照修订（ONLINE-001～006）

来源、工作包、实现及验收逐条见[方案§21.1](./2026-09-14-printing-factory-adjustment-plan.md#211-本次实施与追踪)。最新用户的四项修订优先于本矩阵旧阶段 B7 的多章节流转卡与一单一页结论；旧截图只保留为历史，不作为当前两种纸单的证据。

- ONLINE-001～005：当前代码与命名页面已核对；上游原单直接显示并进入对应来源记录，普通导出、详情两种打印入口、图片大图及关闭均通过。
- ONLINE-006：单位与批量去重、三张半页预览通过；浏览器系统打印/PDF实际分页尚待最后验收。Chrome前台被其他操作切换，原生点击多次被工具中断，未将点击尝试记为打印成功。
- 新证据：/tmp/printing-parity/online-parity.log、ui-final.log、output-final.log、authority.log、typecheck-final.log、list-final-1280.png、upstream-source.txt、info-final-1280.png。
- 审查人Codex；产品事实依据为当前用户本轮截图和明确要求，尚无用户接受最终实现的回执。代码基线与本矩阵一致，当前内容由本轮任务收据绑定。
