# 面辅料采购单线上功能对齐：需求、实施与追踪

日期：2026-10-14；基线：`3e6412f25bd389985ca1a2045280eff2220f622b`；工作树：`/Users/laoer/.codex/worktrees/7eaf/higoods`；确认来源：用户本会话截图、功能对齐要求及“开始执行吧”。这是本轮增量记录，不覆盖 2026-10-13 的冻结核查与历史验收报告。

## 范围与阶段

第一阶段补齐面辅料采购单在线上已有的功能及本动作必要的需求分析、物流、库存、确认、对账与请款读取。第一阶段逐项验证后才实施委托加工。当前不预建加工链、工厂交接、后端、鉴权、云库、维护工具或新框架，不恢复已删除模块、店小秘下单和本地资料弹窗。沿用现有路由、标准列表、图片、附件和本地原子保存。

测试站 `http://test_manage.higood.ai/pms/material_purchase_order/index` 始终只读：只打开表单、查询、预览和观察门禁；最终业务提交、直接写按钮、上传、删除、转换及打印写回不得执行。保存成功与失败、持久回读、数量和库存验证在本地隔离原型完成。新独立 Chrome 会话已由用户登录，避免占用其他 AI 的 Chrome。

基线原型主单是单 SKU，一组数量/单价。本轮改为主单加 SKU 明细；计划量、实际采购量、商家到货、物流/转运和入库分别有来源。新 SKU 明细是数量/单价唯一可写源，旧字段只能作兼容读取投影；旧单只读映射一行，读取不迁移/写种子。单 SKU 现有 PCS 来源及单位快照、TMF 特定来源守卫保留。输入缺失、单位/SKU错配、重复、版本冲突和保存失败必须保持未保存输入、不发布半套数据。

已见线上案例：7822 单 SKU 面料、计划 11111 与计划卷数 111；7806 两 SKU、计划 300 与实际采购 2000、商家到货 1500；7815 计划 1248 与条码总量 1250。这些页面值要求分开数量口径，不证明所有超量提交都合法；合法上限核对表单和有效规则，不把计划量盲目当实物上限。

## 核查证据与继承

- 本轮原始页面与表单：`output/playwright/mpo-parity-20261014/`，仅本轮实际工具结果可标为本轮现场已确认。
- 用户截图：本会话提供的新建面料采购、多 SKU 列表、顶部 19 操作及行内 12 操作。
- 历史测试站核查只保留原身份：`docs/prototype-review-records/pms-alignment-20261013/inventory/material-checkpoint-recovery.json` 与 `inventory-test-material-tail.json`。它们证明已打开的表单/门禁，未执行最终业务写入；旧“通过”记录不自动作为当前完整对齐证据。
- 当前源码事实由主单数据/页面、条码子页面与直接上下游确认。CodeGraph 已初始化，基线工作区干净。

## 业务对象与保存边界

| 对象 | 当前/目标来源 | 写入入口 | 直接读取/关联 | 旧项与验收 |
|---|---|---|---|---|
| 主单与SKU明细 | 静态基线 + `pmsMaterialPurchaseOrderDeltas` 单记录 | create/update/价格确认/数量/下单/驳回 | 列表、详情、需求关联、复制、导出与请款 | 旧单受控一行；新 lines 不接受旧总数二次写入 |
| 物流及SKU装运明细 | `pmsPurchaseTracking` 逐记录 | 单/批量添加、补录、修改、导入与删除标记 | 采购详情、采购跟踪、头程及运单入库 | 保留原运单身份；不能把批量入库替换成状态批改 |
| 细码 | 所属采购单记录内的逐SKU细码 | 已有条码模块提交 | 查询、打印、导入导出及入库关联 | 旧4列模板只用于单SKU；新模板明确SKU；打印不能串图/单位 |
| 入库 | 所属采购单的实际入库记录 | 本地实际确认入库动作 | 原料库存、需求余额、入库导出 | 单位/SKU/仓库正确且不重复；普通状态不等于入库事实 |
| 采购附件 | 同库 `pmsAttachments` Blob + 引用 | 现有上传/删除 | 预览、详情、合法引用 | 事务 complete；复制不带执行凭证；不得误删被引用文件 |
| 操作事实 | `pmsOperationLogs` | 与动作同事务 | 单单日志/详情 | 无假成功；取消无业务写入 |

## 工作包与依赖

| 工作包 | 目标 | 负责文件/符号 | 修改与验证 | 完成条件 |
|---|---|---|---|---|
| P0 | 逐按钮核清表单、状态、来源与子动作 | 测试站 UI；本轮核查证据 | 正常与边界/空选/关闭；不执行最终提交 | 清单有实际证据，未知项如实保留 |
| P1 | 多SKU、数量、价格状态、旧单读取 | `src/data/pms/material-purchase-orders.ts`、`canonical-purchase-references.ts`、`material-purchase-lines.ts` | 同库原子保存；单价确认、复制清事实；memory-IDB契约 | 旧单与特殊来源不回归，多SKU回读正确 |
| P2 | 主列表、建单、行内与批量操作 | `src/pages/pms/material-purchase-orders.ts`、`material-purchase-order-parity.ts` | 标准列表；SPU载入SKU；局部抽屉更新；表单取消/错误输入保留 | 功能可达、对象/单位明确，无空按钮 |
| P3 | 物流、运单入库及必要下游 | 主单业务/页面、需求分析、采购跟踪、库存、头程、供应确认、对账及请款的直接消费者 | 明确SKU与费用来源；原子提交与下游直达 | 数量、库存、金额、单据关系一致 |
| P4 | 条码/细码与打印 | `src/pages/pms/material-purchase-barcodes.ts`、已有业务保存入口 | 按SKU选择/校验/导入/标签；复用已存在条码页面 | 不串SKU、图片、单位；多SKU与旧模板均有契约 |
| P5 | 功能、布局、性能与交付清单 | 本任务测试、审查记录和矩阵 | 必要构建后冻结资产；1366/1280管理页面；实际输出与回读；等价家族5样本 | 逐项有证据，无未说明失败/阻塞；再生成任务技术收据 |

主代理负责测试站、主页面、下游、完整diff和最终验收；两个独立实现者分别独占 P1 数据文件/对应契约，以及 P4 条码页面/对应契约，不并行写同一文件。重型构建和正式性能测量串行。

## 实现与证据版本

需求确认人：用户；需求确认版本：本会话 2026-10-14“开始执行”。下表技术核验人统一为 Codex，主代理整合；没有用户产品接受记录，不填写“用户已验收”。本轮只有普通采购功能对齐，委托加工、工厂加工链和交接仍属下一阶段。

- **V1**：基线 HEAD `3e6412f25bd389985ca1a2045280eff2220f622b` 加未提交工作树实现；以 `output/playwright/mpo-parity-20261014/v1-frozen/environment.json` 中逐文件 SHA256 和资源清单哈希绑定，不能仅凭 HEAD 证明变更版。服务 `http://127.0.0.1:43965`，Vite production preview；管理设备 1366×768、1280×720。
- V1 构建记录 `/tmp/mpo-parity-final-build-20261014.log`：914 项单元通过及 Vite 构建通过；全量类型检查的既有错误另列在V2记录，不以构建成功代替全量类型无错误。专项新增契约为 L26、C7、B8、P4，共45项；下列测试名称对应具体结果，不用914总数替代逐项覆盖。
- V1 生产页面记录 `/tmp/mpo-production-browser-calibration.log`：下述 E1～E3 三项通过；`/tmp/mpo-production-performance.log`：E1完整流程五轮通过。已有性能文件仅作为V1阶段原始采集，当时ALIGN-46尚未结案；最终由V2新增操作家族采集闭合，不将V1提前冒称完整验收。
- **V2冻结构建与本轮技术验证完成**：环境仍为同工作树与本机生产预览；`output/playwright/mpo-parity-20261014/environment.json` 标版本V2，并保存新的逐文件SHA256/资源清单。`/tmp/mpo-parity-build-v2.log` 为915单元通过及构建通过；`/tmp/mpo-cost-contract-valid.log` 的5项打印/费用币种契约通过。`/tmp/mpo-typecheck-v2.log` 全量仍有13项已有PCS类型错误，本次11项变更src无新增错误；不冒称全工程类型错误为0。
- V2主页面E1～E4在生产预览各重复五轮，`/tmp/mpo-browser-performance-v2.log` 共20项通过（1.4分钟）。E4实际保存并读取批量采购员/备注/区域/供应商、裁片/印花工厂、印染工艺/染色费、物料/辅料采购、分类转换、复制、驳回及20行快递CSV；E1/E2已实际验证同SPU再次载入保留SKU输入。后续针对物流、行内字段和条码补验结果见下列记录；最终46条均按实际入口、共用路径、独立契约及适用设备证据技术闭合。V1原始结果已保存在 `output/playwright/mpo-parity-20261014/v1-frozen/`，不得冒称后续修改的验收。
- V2首次主页面原始采集为385个样本/51家族，最大599.5ms。随后发现“文件导入解析与预览”的5个旧样本起点来自前一点击，已判采集无效并排除；原始数组保留。主代理追加首组含瑕疵处理五轮、行内完整功能回放及真实file input起点的五循环，产品源码/构建资源仍为冻结V2。最终主页面579有效样本/56家族、条码55样本/11家族，合计634有效样本/67家族，每家族不少于五个，主页面最大617.1ms、条码最大166.9ms，均无>1000ms。
- 最终性能选择规则位于C/final-performance-summary.json：原始performance-105末份数组排除5个无效解析起点，380样本；C/final-adjacent-v2/performance-41-{0..4}.json取成功首组155样本；C/final-operations-v2/performance-150-0.json取真实最终五循环44样本，共579。原始performance-41/78/90/105是同worker累计前缀，已核对前缀一致，不能重复计数；失败case106数组不参与通过统计。运行脚本快照保存在C/scripts/，后续脚本变化不能篡改前一轮结果。
- 补验先出现两项夹具错误：补录装运2却填写实采0，被合法数量守卫阻断；另一处误将deleted:true持久删除标记期待为物理删行。修正夹具后C/final-fields-calibration-b.log实际完整字段/物流功能1项通过，C/final-operations-v2.log最终五内部循环1项通过（13.0秒）；C/adjacent-with-invalid-fixture.log和原raw失败视频/截图保留。这些修正没有修改已冻结产品源码，不把失败样本写成性能通过。

V2条码专项E5正式回放已通过：`CB/result.json`为passed，55个有效样本/11家族、每家族五个，最大166.9ms、浏览器错误0。`CB/source-asset-verification.json`核验运行源码与冻结V2、浏览器JS/CSS与实际构建文件一致；`CB/version.json`独立绑定本次脚本SHA256。页面覆盖真实多SKU导入、编辑/批改、下架/删除、重复和错SKU/错单位/实物上限阻断、标签HTML下载及刷新，不虚构打印或库存写回。

线上只读清单为 `docs/prototype-review-records/mpo-parity-20261014/online-readonly-checklist.md`（机器索引在同轮output目录）。35主入口、19行内子项及25查询/分页项已列清。2026-10-13冻结证据只证明当时表单/守卫，2026-10-14实际只读原始证据另列；没有测试站业务保存证据。

### 文件与测试索引

| 简称 | 实际文件/对象 |
|---|---|
| D | `src/data/pms/material-purchase-orders.ts`：主单、物流、库存、附件及原子动作 |
| L | `src/data/pms/material-purchase-lines.ts`：SKU唯一事实及主单显示投影 |
| P | `src/pages/pms/material-purchase-orders.ts`：标准列表、过滤/统计、详情、文件导入与入口整合 |
| X | `src/pages/pms/material-purchase-order-parity.ts`：SPU/SKU表单、批量/行操作、成本/执行事实、导出/打印 |
| B | `src/pages/pms/material-purchase-barcodes.ts`：细码子列表、校验/导入/标签 |
| R | `src/data/pms/canonical-purchase-references.ts`：读取已有PCS物料/商品/仓库身份 |
| U-L | `tests/unit/pms-material-purchase-lines.test.ts`；逐项名称见矩阵，V1为26项 |
| U-C | `tests/unit/pms-material-purchase-consumers-parity.test.ts`；需求余额、库存条码、请款、对账和供应确认，V1为7项 |
| U-B | `tests/unit/pms-material-purchase-barcodes-parity.test.ts`；多SKU细码归属/模板/累计量/标签，V1为8项 |
| U-P | `tests/unit/pms-material-purchase-print-parity.test.ts`；逐SKU导出/金额/单位/图片；V1为4项，V2为5项，新增「成本数据按实采价计算，跨币种费用分别展示，不把RMB费用加到IDR货款」 |
| E1 | `tests/material-purchase-order-online-parity.spec.ts`：`多SKU采购：实采、物流、抽检凭证、分SKU入库、刷新、导出和打印` |
| E2 | 同文件：`表单图片预览保持输入，取消与保存中止无写入，1366/1280布局不溢出` |
| E3 | 同文件：`主入口与条件动作可达，查询排序及两页演示保持` |
| E4 | 同文件：`其余对齐操作：批量字段、分类建单、复制转换驳回与20行文件导入`；V2五轮通过 |
| E5 | `tests/material-purchase-barcode-online-parity.spec.ts`：`面辅料多 SKU 条码：全部动作、持久回读与真实交互性能`；V2正式回放1项通过，内部各家族五轮 |
| E6 | `tests/material-purchase-order-online-parity.spec.ts`：`物流相邻动作与文件事件最终采样：五个有效循环`；V2正式1项通过；编辑/补录/修改/删除/真实文件输入各五循环，最后刷新 |
| E1+ / E4+ | 相同命名流程的后续脚本版本：E1追加瑕疵处理五轮通过；E4追加主单使用类型/专用SPU/补采/重量体积及物流动作的完整功能回放1项通过；脚本副本与原始结果分版本保留 |
| N1 | `output/playwright/mpo-parity-20261014/v1-frozen/`：V1环境、flow-persisted、实际CSV、页面PNG和性能原始采集 |
| N | `output/playwright/mpo-parity-20261014/`：V2环境及后续实际CSV/PNG；只读测试站快照另标“线上”，不能混用N1验V2 |
| C | `docs/prototype-review-records/mpo-parity-20261014/evidence/`：主代理保存的V2环境、20份性能原始数组、汇总、实际CSV/PNG及browser/typecheck/cost日志；与N原始证据相同版本 |
| NB | `output/playwright/mpo-barcode-parity-20261014/acceptance-barcode-1791970910401/`：E5正式V2条码回放的version/result、55原始样本、持久单、真实xls/CSV/打印HTML及页面PNG |
| CB | `docs/prototype-review-records/mpo-parity-20261014/evidence/barcodes/`：E5正式结果、原始样本、资产核验、持久单、CSV、打印HTML与PNG的保留副本；真实xls输入及模板下载保留在NB |
| CA | `C/final-adjacent-v2/`：含瑕疵处理的E1+成功五轮与原始输出；case106失败采集保留但不计通过 |
| CF | `C/final-operations-v2/`：E6真实五循环performance-150-0、独立环境和最终物流刷新PNG；完整成功日志C/final-operations-v2.log |

### 原子需求矩阵

状态描述当前交付版本；“V1通过”仅指已冻结的前一验证版本。E1～E4均已绑定V2实际生产预览结果。实际入口、共用正常/边界提交路径和独立业务契约共同判定等价成员；不为每个原子要求新建独立测试，也不宣称遍历全部输入组合。未知选品人没有事实时返回未记录，不编造人员或新字典。源码与单元契约已实现，不代表缺少生产页提交/回读的按钮已经完整验证。PDA无本轮入口变更；远端写入按SAFE-01不适用；打印只验证电子预览与实际输出，不伪称实体打印或工厂使用。

| 编号 | 来源 | 原子需求 | 包 | 实际文件/符号 | 自动化验证名称 | 页面/打印/性能证据及限制 | 状态 | 证据位置/版本 |
|---|---|---|---|---|---|---|---|---|
| ALIGN-01 | 顶部截图 | 批量设置采购员可保存回读 | P2 | D.batchUpdatePmsMaterialPurchaseOrders；X.handleMpoParityEvent(field/buyerName) | E3空选守卫；E4「其余对齐操作」采购员实际保存/IDB回读 | V2批量入口选单设置李采购并持久回读；范围为本地隔离普通采购 | 已验证 | E4；N/additional-actions.png；/tmp/mpo-browser-performance-v2.log；V2；线上ALIGN-01 |
| ALIGN-02 | 顶部截图 | 批量驳回保存原因并形成明确状态/限制 | P1/P2 | D.rejectPmsMaterialPurchaseOrders；X.field/rejectedReason | U-L「分类转换与驳回保存明确结果，物料采购没有冒充原料采购」；E3批量空选；E4单单驳回 | V2批量空选守卫与单单驳回实际回读，二者进入相同rejectedReason提交动作；批量逐对象守卫与原子失败契约核验，不声称单独实测多单页面驳回 | 已验证 | U-L；E3/E4；C/browser-v2.log；V2；线上ALIGN-02 |
| ALIGN-03 | 顶部截图 | 批量添加快递保留订单及SKU归属 | P3 | D.batchAddPmsMaterialLogistics；resolveLogisticsPurchaseLine；X.logistics | U-L「同运单多SKU按归属保存，补录可重复运单但重试去重，实采与装运量同事务」；E1 | V2双SKU物流实际保存/IDB回读，实际量110/220，运费12只记一次；跨订单原子/错误守卫由U-L验证 | 已验证 | N/flow-persisted.json；E1；U-L；V2 |
| ALIGN-04 | 顶部截图 | 批量补录快递与添加行为有正确区别 | P3 | D.prepareImportPmsMaterialLogistics(mode=supplement)；X.logisticsMode | U-L同运单合法补录/去重/累计下限；E3入口；E4+/E6实际补录保存回读 | V2五循环从批量补录入口保存装运2/累计实采100并回读；同运单合法补录与稳定operationId去重由契约验证，实采0错误输入被守卫阻断的夹具证据保留 | 已验证 | U-L；C/final-fields-calibration-b.log；CF/performance-150-0.json；C/final-operations-v2.log；V2 |
| ALIGN-05 | 顶部截图 | 批量确认价格更新实际价格与确认结果 | P1/P2 | D.batchConfirmPmsMaterialPurchasePrices；preparePmsMaterialPurchasePriceConfirmation；X.price | U-L「批量逐单逐SKU确认价一次提交，任一行错误不确认前面的单据」；E1 | V2批量选单价格表单可达；共用价格提交在已入库单3→3.2且库存不变；逐单逐SKU批量原子/错误契约通过，不声称每个数量组合实测 | 已验证 | E1/E3；C/export-结算单.csv；U-L；V2 |
| ALIGN-06 | 顶部截图 | 批量备注保存回读 | P2 | D.batchUpdatePmsMaterialPurchaseOrders(remark)；X.field | E4批量备注实际保存/IDB回读；E2事务中止保留原数据/输入 | V2批量备注成功持久回读；同一动作真实事务中止时原数据不变、输入保留 | 已验证 | E2/E4；N/form-1280.png；V2 |
| ALIGN-07 | 顶部截图 | 批量采购区域使用统一有效选项 | P2 | D.batchUpdatePmsMaterialPurchaseOrders(purchaseRegion)；X.renderForm | E3通用字段入口；E4批量区域实际保存/IDB回读 | V2使用印尼选项后持久回读purchaseRegion=印尼；CN/ID按既有国内/印尼口径映射 | 已验证 | E4；N/additional-actions.png；V2；线上ALIGN-07 |
| ALIGN-08 | 顶部截图 | 批量下单保存下单事实与时间 | P1/P2 | D.markPmsMaterialPurchaseOrdersPlaced；X.placed确认 | U-L「实采可超过计划，商家到货与入库不混同，累计事实不得减少」；E1 | V2实际确认已下单，后续实采/入库使用此事实；稳定operationId去重由专项契约核验 | 已验证 | E1；U-L；V2 |
| ALIGN-09 | 顶部截图 | 批量供应商使用已有身份而非任意文字 | P1/P2 | X.supplierSelect/listPmsSuppliers；D.batchUpdatePmsMaterialPurchaseOrders(supplierName) | E4批量供应商实际选择SUP-2026-0001后保存/IDB回读；E3空选 | V2只选已有有效供应商身份，保存名称投影可回读；不把任意文字当新增供应商 | 已验证 | E4；N/additional-actions.png；V2；线上ALIGN-09 |
| ALIGN-10 | 顶部截图 | 运单批量入库关联实际SKU入库事实 | P3 | D.inboundPmsMaterialPurchaseLogistics；pmsMaterialPurchaseInboundAvailability；X.inbound | U-L「删除未执行物流保存标记并刷新不复活；运单入库必须有实际来源且双重限量」「运单批量入库任一行错误或事务中止时，库存、单据和运单均不半套保存」；E1 | V2按两运单SKU入110/220；正常109+220、瑕疵1，总330；刷新持久回读一致 | 已验证 | N/flow-persisted.json；N/export-原料入库.csv；V2 |
| ALIGN-11 | 顶部截图 | 顶部修改物流入口有记录选择与合法修改 | P3 | X.logistics-select/logistics；D.updatePmsMaterialLogistics | U-L「物流编辑同次提高实采与装运先用候选实采校验，非法合计不半套修改」；E3入口；E4+/E6实际编辑 | V2从顶部修改物流选真实记录，每轮修改运单号后持久回读；数量/卷数/候选实采守卫由独立契约验证，保留完整SKU归属 | 已验证 | U-L；C/final-fields-calibration-b.log；CF/performance-150-0.json；C/final-operations-v2.log；V2；线上04只读查询仍无有值样本 |
| ALIGN-12 | 建单截图 | 面料采购按SPU选择多个SKU并填数量/卷数/价格 | P1/P2 | X.skuInputTable/renderSkuInputRows/load-skus；D.createPmsMaterialPurchaseOrder | U-L「SPU的多SKU以对应真实图片、计划卷数及价格共同保存，重复创建只返回原记录」「新建SKU重量体积共同保存，非法值不生成采购单」；E1/E2 | V2选CNIDML360两SKU、100/200Yard、1/2卷、重量体积实际保存；同SPU再次载入后数量100仍在；校验错误不写入 | 已验证 | N/flow-persisted.json；N/form-1280.png；E1/E2；V2 |
| ALIGN-13 | 顶部截图 | 物料采购有正确入口与分类 | P1/P2 | P.renderInner（物料采购按钮）；X.new(kind=物料)；D.createPmsMaterialPurchaseOrder | U-L「分类转换与驳回保存明确结果，物料采购没有冒充原料采购」；E4实际建单/回读 | V2物料按钮真实建单，SKU数量10/价格2，持久分类为物料 | 已验证 | E4；N/additional-actions.png；V2；线上ALIGN-13 |
| ALIGN-14 | 顶部截图 | 辅料采购支持对应SPU/SKU建单字段 | P1/P2 | P.renderInner（辅料采购按钮）；X.new(kind=辅料)；D.createPmsMaterialPurchaseOrder | U-L建单/类型守卫；既有pms-material-ops原币辅料创建契约；E4实际建单 | V2辅料SPU/SKU真实建单，数量10/价格2，持久分类为辅料；线上专用SPU历史必填差异仍在只读清单，不自建未确认规则 | 已验证 | E4；N/additional-actions.png；V2；线上ALIGN-14 |
| ALIGN-15 | 顶部截图 | 快递文件按模板校验预览并共同保存 | P3 | P.downloadTemplate/mapImportRows/handleImportFile；D.importPmsMaterialLogistics/validatePmsLogisticsImportRow | 既有pms-material-ops存储失败契约；U-L物流契约；E4真实20行CSV上传/预览/提交 | V2真实文件解析20行、提交20条独立SKU物流后刷新；解析功能结果通过，旧解析性能起点无效另列ALIGN-46，线上不上传 | 已验证 | E4；/tmp/mpo-browser-performance-v2.log；V2；线上ALIGN-15 |
| ALIGN-16 | 顶部截图 | 采购明细导出覆盖全部筛选SKU | P2 | P.exportRows(filteredRows)；X.buildMpoParityExport(订单明细) | U-P「采购明细导出逐SKU，保留各单位与数量，不能取聚合头0值」；E1实际download | V2实际下载双SKU，不含操作列，使用全部筛选结果；线上导出曾被客户端拦截，不能声称复刻其文件结构 | 已验证 | N/export-订单明细.csv；U-P/E1；V2 |
| ALIGN-17 | 顶部截图 | 采购单导出正确汇总数量与金额 | P2 | X.buildMpoParityExport(订单)；pmsMaterialPurchaseQuantityGroups | U-P「订单导出按单位分组，不相加不同单位；空筛选不生成行」；E1 | V2实际订单CSV；不同单位不相加，空结果不生成文件由契约核验 | 已验证 | N/export-订单.csv；U-P/E1；V2 |
| ALIGN-18 | 顶部截图 | 结算导出使用正确实采/价格及适用费用 | P3 | X.buildMpoParityExport(结算单)；data/pms/reconciliations.ts.pmsMaterialPurchaseActualSettlementAmount | U-P「结算明细使用实采，未确认价格显示待确认，不能冒充计划结算」；U-C对账/计划预付；E1 | V2实际CSV按实采110/220与已确认价计算；物流12/凭证25只记首行一次；币种契约明确跨币种分列，不把RMB加到IDR货款 | 已验证 | N/export-结算单.csv；U-P/U-C/E1；/tmp/mpo-cost-contract-valid.log；V2 |
| ALIGN-19 | 顶部截图 | 入库导出按实际SKU入库记录取数 | P3 | D.listPmsMaterialPurchaseInventoryPostings；X.buildMpoParityExport(原料入库) | U-L多SKU库存读/ID去重；E1实际download | V2正常/瑕疵逐posting、SKU、单位、仓库及时间实际输出 | 已验证 | N/export-原料入库.csv；N/flow-persisted.json；V2 |
| ALIGN-20 | 行内截图 | 详情显示完整主单、多SKU、来源与结果 | P2 | P.renderDetailOverlay；X.renderMpoSkuTable/renderMpoExecutionFacts/renderMpoCostSummary | E1详情回读抽检/凭证/双SKU；E3入口；V2 U-P「成本数据按实采价计算，跨币种费用分别展示，不把RMB费用加到IDR货款」 | V2刷新后显示SKU抽检、空差2%、转运费用25及对应照片；成本币种由五项专项契约验证，实际详情图片全部解码 | 已验证 | N/flow-detail-1366.png；N/flow-persisted.json；E1；/tmp/mpo-cost-contract-valid.log；V2 |
| ALIGN-21 | 行内截图 | 单单驳回有入口及明确结果 | P2 | X.reject/field；D.rejectPmsMaterialPurchaseOrders | U-L分类/驳回契约；E4实际单单驳回 | V2从行菜单驳回复制单，保存供应方无法交付原因并持久回读；已有入库禁止驳回由契约核验 | 已验证 | E4；/tmp/mpo-browser-performance-v2.log；V2；线上ALIGN-21 |
| ALIGN-22 | 行内截图 | 单单SKU实际价可确认/修改且标记正确 | P1/P2 | D.confirmPmsMaterialPurchasePrices；X.price | U-L「普通采购已入库后仅专用价格可修改，不改变数量、库存或履约状态」；E1 | V2已入库后实际价3→3.2，持久履约状态与库存完全不变；专项来源守卫保持 | 已验证 | E1；N/export-结算单.csv；U-L；V2 |
| ALIGN-23 | 行内截图 | 染色费用有独立入口与费用结果 | P2/P3 | X.dye/field(dyeFee)；D.batchUpdatePmsMaterialPurchaseOrders；X.buildMpoParityExport | U-P逐SKU费用只记一次；E4行菜单实际染色费保存/IDB回读 | V2行菜单设置染色费用20并持久回读；费用RMB显示与导出规则由U-P验证 | 已验证 | E4；N/additional-actions.png；U-P；V2；线上ALIGN-23 |
| ALIGN-24 | 行内截图 | 单单采购备注直接可达并回读 | P2 | X.note/field(remark)；D.batchUpdatePmsMaterialPurchaseOrders | E2单备注事务失败保留输入/原数据；E4同一备注动作成功保存回读 | V2单单入口可达，失败输入保留；共用备注保存成功的持久结果来自批量入口E4 | 已验证 | E2/E4；/tmp/mpo-browser-performance-v2.log；V2 |
| ALIGN-25 | 行内截图 | 日志直接可达并对应本单事实 | P2 | D.listPmsMaterialPurchaseLogs/logPurchaseEdit；X.logs | U-L建单/复制日志唯一；E3日志入口 | V2日志抽屉可达，日志与动作同事务保存及唯一性由U-L验证；页面未逐条断言每个日志值 | 已验证 | U-L；E3；/tmp/mpo-browser-performance-v2.log；V2；线上ALIGN-25 |
| ALIGN-26 | 行内截图 | 打印采购详情包含正确SKU图片与数量价格 | P2 | X.buildMpoPurchasePrintHtml；P.print-order | U-P「打印逐SKU对应图片、计划与实际量，预览不改变任何业务事实」；E1 popup | V2电子打印实际预览双SKU两行，对应图片全部解码；未宣称实体打印 | 已验证 | N/print-purchase.png；U-P/E1；V2 |
| ALIGN-27 | 行内截图 | 抽检字段、适用状态与数量结果正确 | P1/P2 | D.inspectPmsMaterialPurchaseOrder；X.quality/renderMpoExecutionFacts | U-L「抽检照片与报告同事务，瑕疵只进入对应SKU且移动库存守恒」「抽检结论与选中SKU合格瑕疵数量矛盾时不保存报告」；E1 | V2抽查10、合格9、瑕疵1、长度100/98、空差2%，Blob与所属SKU共同保存并刷新回读；结论矛盾阻断契约通过 | 已验证 | N/flow-persisted.json；N/flow-detail-1366.png；U-L/E1；V2 |
| ALIGN-28 | 行内截图 | 复制带计划SKU而不带执行/确认/物流事实 | P1/P2 | D.copyPmsMaterialPurchaseOrder；X.copy确认 | U-L「复制多SKU清除执行与确认事实，SKU计划、价格及复制来源保留」；E4实际复制 | V2实际复制两SKU后实采均0/价格未确认并刷新直达；清细码/附件/入库/质检/凭证由完整数据契约验证 | 已验证 | E4；U-L；/tmp/mpo-browser-performance-v2.log；V2；线上ALIGN-28 |
| ALIGN-29 | 行内截图 | 物流凭证入口及文件持久回读正确 | P2 | D.addPmsMaterialPurchaseAttachments/readPmsMaterialPurchaseAttachment；X.attachment/renderMpoExecutionFacts | U-L「转运凭证多图片与单份日期费用共同保存，失败不留下附件或凭证事实」；E1 | V2两张Blob、转运日期2026-10-14/费用25与引用共同保存；刷新详情能读取照片，失败/专项来源阻断由契约验证 | 已验证 | N/flow-persisted.json；N/flow-detail-1366.png；U-L/E1；V2 |
| ALIGN-30 | 行内截图 | 细码按SKU导入并明确模板/错误行 | P4 | B.parseMpoBarcodeImportRows/readImport；D.saveMpoDetailBarcodes | U-B模板/累计量守卫；E5真实五组两SKUxls导入、预览/持久回读及错SKU/错单位阻断 | V2真实5列模板下载含所属SKU/单位；五组文件逐SKU导入保存，非法行与重复编码不写入；旧4列单SKU兼容由U-B验证 | 已验证 | U-B；NB/downloaded-template.xls；NB/import-0..4.xls；NB/invalid-sku-unit.xls；CB/durable-order.json；V2 |
| ALIGN-31 | 行内截图/冻结核查 | 打印明细进入既有条码列表与子动作 | P4 | B.renderMpoBarcodeOverlay/renderLedger/handleMpoBarcodeEvent；P.open-barcodes | U-B既有动作保留/单位分组；E5查询、补码、单改/批改、分页、删除、下架、导入、筛选导出与刷新 | V2真实条码子页面全部动作与回读，初次未知实采允许合法超计划；登记实际量后超实物上限阻断；下架不扣库存、打印预览不写打印时间 | 已验证 | CB/ledger-1366.png；CB/ledger-1280.png；CB/filtered-export.csv；CB/durable-order.json；CB/quantity-guard.png；V2 |
| ALIGN-32 | 条件行操作 | 条码标签图片、SKU、单位与单码数量对应 | P4 | B.renderMpoBarcodePrintLabel/renderPrint；D.saveMpoDetailBarcodes | U-B「标签打印绑定本行图片、规格、数量与单位，预览不登记打印或库存」；E5实际预览及下载打印HTML | V2单码/批选标签实际SKU图片、数量2及本行单位；下载HTML含可读SKU、SVG条码、真实图片；页面解码/渲染通过，未执行实体打印或虚构打印时间 | 已验证 | CB/single-print-preview.png；CB/print-0..4.html；CB/downloaded-print-render.png；CB/durable-order.json；V2 |
| ALIGN-33 | 条件行操作 | 转原料保留身份且影响正确分类 | P1/P2 | D.convertPmsMaterialPurchaseType(kind=原料)；X.convert-raw确认 | U-L「分类转换与驳回保存明确结果，物料采购没有冒充原料采购」；E4实际转换 | V2转原料确认后持久分类为原料，保留SKU/单位/数量；不照搬线上白胚合并矛盾 | 已验证 | U-L；E4；V2；线上ALIGN-33冲突说明 |
| ALIGN-34 | 条件行操作 | 转辅料有适用入口与正确分类 | P1/P2 | D.convertPmsMaterialPurchaseType(kind=辅料)；X.convert-accessory确认 | U-L分类转换契约；E4实际原料转辅料 | V2原料→辅料确认后持久分类为辅料；线上完整确认未知保留在只读清单 | 已验证 | U-L；E4；V2；线上ALIGN-34 |
| ALIGN-35 | 条件行操作 | 瑕疵处理保留普通采购能力及正确数量库存 | P1/P2/P3 | D.disposePmsMaterialPurchaseDefects；X.defect；data/pms/material-inventory.ts | U-L「抽检照片与报告同事务，瑕疵只进入对应SKU且移动库存守恒」；E1+实际已入库瑕疵处理 | V2已入库单第二SKU登记瑕疵1并持久回读defectDisposals，库存总量保持330；进入瑕疵仓的守恒与不同SKU隔离由契约验证 | 已验证 | U-L；CA/performance-41-{0..4}.json；C/adjacent-with-invalid-fixture.log成功首组；V2 |
| ALIGN-36 | 列表截图 | 所有已见检索、筛选、日期、时效与排序有正确结果 | P2 | P.filteredRows/renderFilters/orderDates；X.lookup | E1非首SKU及入库日期；E3关键词候选/排序/重置 | V2非首SKU查询、入库日期、检索候选、排序、重置/两页实证；已审查每类筛选/日期/时效读取同一filteredRows，复用已命名页面正常与边界查询路径。无事实的选品人/日期不伪造，未遍历每个组合 | 已验证 | P.filteredRows/filterValue/orderDates；E1/E3；C/list-1366.png；V2；线上完整查询表 |
| ALIGN-37 | 列表截图 | 计划、到货、入库统计与查询同范围并明确单位 | P2 | P.renderStats(filteredRows)；L.pmsMaterialPurchaseQuantityGroups | U-L「不同单位保持按单位分组，不把Yard与M相加或通过主单反写多SKU」；E1查询 | V2查询/重置走同一filteredRows并同步列表/统计；统计按lines单位分组由U-L核验，共用页面路径通过，不声称逐值遍历全部筛选组合 | 已验证 | P.renderStats/filteredRows；U-L；E1/E3；C/list-1366.png；V2 |
| ALIGN-38 | 列表截图 | 来源单、物料SPU/SKU、图片及必要档案可追溯 | P1/P2 | R.listPurchaseMaterialReferences；X.materialLink/renderMpoSkuSummary；P.order/source链接 | U-C「需求关联识别非首 SKU，价格确认按对应行同事务保存，失败两边都不发布」；E1图片 | 当前源采购/PCS物料链接及正式身份保留，经已完成源码审查；SKU关系/对应图由契约与V2实际列表详情校验。本次读取改造不要求重测未改的独立PCS档案页；线上零结果不推断丢数据 | 已验证 | R/P/X；U-C；E1/E3；C/flow-detail-1366.png；V2；线上ALIGN-38a/b |
| ALIGN-39 | 行内信息 | 使用类型、区域、采购数量、人员、供应商、工厂、重量体积与补采原因可正确编辑 | P1/P2 | X.renderForm/field/new/edit；D.updatePmsMaterialPurchaseOrder/updatePmsMaterialPurchaseLines/batchUpdatePmsMaterialPurchaseOrders | U-L主单/SKU共同保存、非法值/失败契约；E1/E2/E4及E4+/E6全部相关字段提交 | V2建单/编辑重量体积、同SPU再次载入、采购员/区域/供应商/备注、工厂/印染/染色费、使用类型/专用SPU/补采原因实际保存回读；数量和商家到货共用SKU动作单独回读。正常/边界及失败保持由契约和E2覆盖 | 已验证 | U-L；C/final-fields-calibration-b.log；CF/performance-150-0.json；C/additional-actions.png；C/flow-persisted.json；V2；线上ALIGN-39a..m |
| ALIGN-40 | 列表截图 | 物流展开、渠道/箱号/费用/批次与编辑删除复制可达 | P2/P3 | P.logistics列/details；X.logistics-select/delete-logistics；D.updatePmsMaterialLogistics/deletePmsMaterialLogistics | U-L物流编辑/删除/双重限量；E3选择入口；E4+/E6实际修改删除并刷新 | V2真实物流修改/删除五循环；删除保存标记，刷新列表不复活；渠道/包装/箱号/批次展示和共用复制动作经最终源码审查，已有数据契约及命名页面共同核验，不要求每个显示字段另建测试 | 已验证 | U-L；C/final-fields-calibration-b.log；CF/final-logistics-readback.png；CF/performance-150-0.json；C/final-operations-v2.log；V2；线上ALIGN-40a..d |
| ALIGN-41 | 已确认方案 | 新主单lines为唯一可写SKU数量与价格源 | P1 | L.getPmsMaterialPurchaseOrderLines/syncPmsMaterialPurchaseLineProjection；D动作 | U-L多单位、主单反写拒绝、逐行价确认；U-C全部SKU金额/归属 | V2浏览器主单两SKU实际事实与显示投影、单位、库存回读；旧映射/反写拒绝与下游全部SKU由专项契约验证，首次不落种子 | 已验证 | U-L/U-C；N/flow-persisted.json；V2 |
| ALIGN-42 | AGENTS STORE | 保存共同成功且失败不发布半套数据 | P1/P3/P4 | D.commitPurchase；idb-storage.ts.pmsCommitRecords；D附件/入库/条码 | U-L批量失败/事务中止/版本冲突/重复；E2真实IDB事务中止 | V2真实IDB事务中止时原数据不变/输入保留；Blob与owner同事务，完成才发布；批量/版本冲突/重复由契约核验。E5细码非法/重复不写入及成功刷新回读，沿用同一原子提交路径 | 已验证 | U-L/U-B；E2/E5；C/form-1280.png；CB/durable-order.json；V2 |
| ALIGN-43 | AGENTS STORE | 刷新/重开/下游直达回读一致，无读取时业务写入 | P1/P3 | D.hydratePmsMaterialPurchaseOrdersFromIdb；material-inventory/material-requirements/supplier-confirmations/payment-requests/reconciliations直接消费者 | U-L旧单读取不落盘/重开；U-C七项；E1刷新 | V2主单刷新实物、附件引用及库存一致；读取失败/恢复与直接消费者通过七项契约；不冒称全站各页面验收 | 已验证 | U-L/U-C；E1/E4；N/flow-persisted.json；V2 |
| ALIGN-44 | 既有契约 | PCS草稿与单位快照、TMF专用来源不回归 | P1/P3 | D.editableOrdinaryPurchase/isTmfPurchaseOwner/PCS附件守卫；P.renderPcsPurchaseWorkspace | U-L「批量任一来源受限或保存中止均不发布半套数据，旧PCS/TMF限制仍在」「PCS及TMF通用附件增删阻断，事务失败前不污染外部草稿或留下Blob」 | 普通入口在数据层拒绝PCS/TMF的量/价/附件写入，批量半套与Blob污染守卫契约通过；V2普通页面共用入口可达。未改的PCS独立工作页不纳入重复页面验收，不宣称专项业务完成 | 已验证 | D专项守卫；U-L；E3；V2构建相关既有契约 |
| ALIGN-45 | AGENTS UI/IMAGE | 管理设备、图片、键盘、局部更新可用 | P2/P4/P5 | P/X/B标准列表/局部overlay；shared.ts图片预览 | E2实际预览/Esc/输入保留/1280无主体溢出；E1原图；E3列表 | V2管理设备1366/1280无主体溢出，原图/Esc/失败输入/同SPU再载入通过；条码列表/标签/下载打印图片解码及两种管理尺寸通过。菜单portal不被表格裁切；PDA无本轮变更 | 已验证 | C/list-1366.png；C/form-1280.png；C/print-purchase.png；CB/ledger-1366.png；CB/ledger-1280.png；CB/downloaded-print-render.png；V2 |
| ALIGN-46 | AGENTS PERF | 适用加载及新增动作完整响应<=1000ms | P5 | 生产预览冻结资产；tests/material-purchase-order-online-parity.spec.ts.measured | E1～E4五轮、E1+五轮、E4+功能回放、E6五内部循环、E5各家族五循环 | V2主页面579有效样本/56家族max617.1ms；条码55/11max166.9ms；合计634/67，每家族≥5，无>1000ms。排除无效旧文件起点及失败夹具数组，保存原始/失败证据；本机生产预览，不声称远端生产性能 | 已验证 | C/final-performance-summary.json；C原始performance-105末份；CA/performance-41-{0..4}.json；CF/performance-150-0.json；CB/raw-performance.json；C/scripts；V2 |

### 实际实现的继承与范围

- 新主单与SKU嵌入单记录，未新增通用引擎/框架/后端。既有单只读映射一行；首次读取不落种子。价格确认与计划编辑不同，普通改单价清确认；已入库只允许专用价格动作，不解锁数量/库存。
- 装运身份为采购单+SKU+运单，补录允许同运单；稳定operationId防重复提交。实际采购量至少覆盖本SKU有效装运、到货、入库及细码；删物流只保存标记，已签收/进头程/入库不能删除。运单入库同时受运单余量与SKU实物来源余量限制。
- 图片/抽检/转运凭证用原Blob与业务引用同库同事务，复制清执行附件和事实；保存失败保持输入。正常与瑕疵库存仍属同一SKU总量，分仓不增减总实物。
- 需求关联按SKU+单位；供应确认拆到采购行且全行确认才确认主单；请款保留已有计划预付口径；结算按实际数量和已确认价格，不把计划金额当已结算货款。
- 保持既有路由、菜单、页面模板与标准列表能力；8张静态演示单、每页5条，两页即可。P0只读线上没有任何最终业务写入；本轮不实现委托加工，不恢复六个删除模块、店小秘下单、本地资料弹窗。

### 独立审查修复与技术闭合

只读审查曾指出实采低于装运、物流编辑输入未传、候选实采校验时序、保存中可关闭、离开提醒未接、建单重量体积丢失、入库日期漏新posting、已入库不能改价、多SKU抽检/凭证无回读、费用导出遗漏、检索排序遗漏及抽检结论矛盾。对应源码已修，新增最小契约绑定U-L后七项；V1生产流程覆盖其中正常路径。V2重新冻结后E1～E4五轮、条码E5、含瑕疵处理E1+五轮、完整字段E4+回放及物流/文件E6五循环均实际通过；46条在上述明确范围内技术闭合。测试站未知字段/矛盾文本仍保留只读清单的来源限制，不把本地通过冒称远端写入或用户接受。

## 验证策略与完成边界

复用现有 Node memory-IDB 与 Playwright 本地设施，先最小失败契约再修复。覆盖多SKU不同价格与单位、实采区别于计划、部分商家到货/入库、运单分配与重复、复制清事实、附件回读、失败/冲突/重复提交、特殊来源。导入导出用几十至几百行代表，不建上千行压力数据。功能核验与性能家族分别记录；构建及正式浏览器测量串行，资产冻结后不边测边改。

本轮用户明确“开始执行”，尚未要求本轮新增提交的发布。本轮46条原子需求已技术验证；技术核验人为Codex，用户尚未作产品接受确认，亦没有本轮发布回执。最终交付分别说明实现、技术验证、产品接受与发布状态，不以历史main推送冒称本轮发布完成。

## 技术收据路由增量

最终收据发现两份新浏览器专项未登记运行器，因此先保留implemented阻断记录，再于P5/ALIGN-46登记精确测试集合到 `scripts/workflow-governance/affected-checks.ts`，使用已有独立Vite预览和Playwright执行两份实际脚本；`tests/workflow-governance/affected-checks.test.ts`验证两专项被执行、未知相邻测试仍阻断。该工具增量不改变采购产品或验证标准，不新建测试框架；先失败契约、修改、专项回归通过，最终收据继续执行完整治理契约。
