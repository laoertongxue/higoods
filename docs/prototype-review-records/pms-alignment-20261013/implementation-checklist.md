# 采购管理实施清单（V16 实施与验收记录）

本清单记录9组菜单、21页已实施本地功能，以及6个完整删除对象。加载验收315条已通过，后续原币、拆合/复制、持久关联和备份门禁已有实际操作及独立回读；31个实际业务case已有分批直接复验通过证据；保留原失败，不称同一完整batch通过。最终机械收据尚待生成。测试站/正式站没有执行最终业务写入，本地IndexedDB保存不代表真实采购、仓库、物流、财务或工厂业务发生。

806条是按钮、子动作、状态、候选、表单及观察分支数，不是806个独立按钮；6条具体来源不适用保持。root当前矩阵登记800条技术已验证、6条不适用，具体证据在矩阵与索引；技术验证不冒充用户产品接受，最终机械收据待生成。

## 菜单与共同界面改进

采购菜单按以下9组顺序排列，30项菜单由9个分组和21个页面组成，每项保留可识别SVG图标与文字。有效原型页面地址与线上地址分别记录，避免把原型重命名地址误称为线上地址。

管理列表沿用项目标准组件：业务标题与主操作、查询卡片、与查询范围一致的统计、独立列表卡片和分页。高频查询在前，更多条件在同一卡片展开；查询、重置、导出在操作区，导出覆盖全部筛选结果。宽表在自身容器内滚动，适用列管理保留显示、顺序、冻结和每页条数偏好。抽屉、弹窗、行展开、图片、批量菜单和表单内联动局部更新；失败保留输入、明确未保存，等待期间避免重复点击。需要识别实物的商品、SKU和物料使用对应来源图片，保留大图、关闭、Esc、加载失败与重试。

固定演示数据直接读取，不因首次访问或刷新整包落盘；用户记录按动作提交至IndexedDB，主单、关联结果、附件引用和操作记录须在同一事务完成后发布。重复提交使用稳定操作标识；改内容重试、版本冲突和失败不能用旧回执冒充新保存。各页面独立读取持久覆盖，不要求先进入上游页面。以下21个列表默认均为两页，用户新增记录与用户保存的每页偏好不受“两页Mock”限制。

## 1. 采购建议

**01 商品采购建议** — `/pms/purchase-suggestions`

- 功能：SPU/SKU/名称检索，商品类型、首翻单、是否做货、建议数量范围、状态查询和重置；SKU明细、SKU/SPU两类导出；设置是否需要做货；选择SKU并生成采购单，供应商、区域、仓库、收件资料、采购员、日期及数量填写，首单/紧急等字段，批量填充、全选/清空、重置和金额汇总。
- 结果与防错：建议与生成采购单及日志共同保存，列表、详情和采购单下游可回读；负数、小数、空SKU等阻断。建议数量本身不是已确认的采购上限，超过建议值不自动按非法数量拒绝。SKU详情用抽屉承载，保持来源商品和图片对应。
- Mock：8条，默认每页5条，2页；存量采购快照和用户覆盖保留。

**02 KOL采购需求** — `/pms/kol-demands`

- 功能：SPU搜索并载入对应多SKU，各SKU申请数量；店铺、申请人、申请时间、备注、热销/货位等字段；草稿与提交，详情；审核、驳回、备注及批量操作；逐SKU登记入库；检索模式、三组多选候选、日期查询、全选/清空、重置及两类导出。
- 结果与防错：需求及真实本地SKU样衣库存、日志同事务；入库不超过剩余待收数量；刷新后需求和KOL库存读取一致。无候选、无匹配SKU和空选有明确结果。
- Mock：6条，默认每页5条，2页。

## 2. 商品采购

**03 商品采购单** — `/pms/product-purchase-orders`

- 功能：通用新增及样衣、达人寄样、做货、烫画、成衣五类新增，完整编辑与重新分配数量；详情及状态联动；采购员、售卖类型、采购类型、备注、快递、模板等单条与批量操作；审核/驳回、复制、拆分/合并、转类、重开、质检、扫码入库、普通出库；关联面辅料需求和售后、日志及出入库记录。条码按实际SKU、条码与填写数量生成Code128电子预览，选择/重置不制造实体打印事实。采购单及SKU导出包含币种、原币单价/金额和确实已有的汇率字段，不臆造汇率或换算结果。
- 结果与防错：采购单与建议、备货、面辅料需求、售后按动作关联；商品入出库有本地SKU+仓库余额和明细事实，普通出库不超过已入库可用量。样衣入出库同步KOL库存，出库不扣除锁定占用；相关记录和日志共同完成后才显示保存成功。合并校验币种和汇率一致，差异整次阻断；合作商、平台下单、工单等6条边界见下表，不能把入口提示当建单成功。
- Mock：12条，默认每页10条，2页；合法PCS来源用于新增，存量采购快照可读。

**04 备货列表** — `/pms/reorder`

- 功能：新增款、查款、防重复；常规备货数量、是否备货标记、备注；排序、日期、备货款等查询；SKU分配数量、供应商选择、生成采购单与关联追踪；销量/销售额图表及日期搜索；导出、分页和重置。
- 结果与防错：备货变更与新采购单同事务，保存、刷新和采购单直达可核对来源及SKU数量。图表使用已有演示销售事实。产品及SKU使用合法PCS图源和已核对的对应关系；原12款中未匹配素材的旧身份不能用通用衬衫图冒充。
- Mock：12条，默认每页10条，2页；用户覆盖不由新静态演示数据替换。

**05 商品采购售后** — `/pms/product-purchase-order-aftersales`

- 功能：来源采购单与售后详情、处理日志；收件人/买手多选、来源、状态等查询；单条/批量发起和处理，原因、地址、运单、备注、状态字段；关联来源采购单、导出、分页和重置。
- 结果与防错：售后及采购单关联共同保存；状态禁止、空选、无匹配来源和终结记录受保护。源站某次来源查询返回0条，不作为详情成功；本地演示使用确实存在的来源单。
- Mock：11条，默认每页10条，2页。

## 3. 面辅料采购

**06 面辅料需求分析** — `/pms/material-requirements`

- 功能：需求/SKU详情、编辑、数量、物料替换、供应商/采购员/备注、实际价确认、驳回，印花染色工艺及工厂；六类批量操作及空选门禁；面料、原料、物料、辅料采购与补采/备货分支；创建/关联面辅料采购单，物流单号、运单批量入库、数量文件预览；采购地区多选、类型、首单、KOL小单、关联采购单、日期、状态等筛选；图片、关联单直达、导出和分页。
- 结果与防错：来源商品采购单、当前已发布PCS BOM与采购物料快照形成需求；新建或关联面辅料采购单时，需求、采购单和存在的来源商品采购单材料状态共同保存。不同单位分别汇总；无合法库存事实显示待核/未提供，不把缺来源当实际0。
- Mock：默认2页；保留旧需求采购快照和用户覆盖。固定演示不自动写入。

**07 面辅料采购单** — `/pms/material-purchase-orders`

- 功能：面/辅料新建与完整编辑、区域、重量/体积、采购量及实际价、供应商/采购员、裁片/印花工厂、染色费用、补采原因、备注、商家下单/到货、批量快递和辅料预添加快递；复制、分类、驳回、日志；国内签收、到货、抽检、合格/瑕疵处理、明确登记本地库存；细码文件、物流凭证与附件；采购单、明细、结算、原料入库四类筛选范围导出；来源SPU、入库数量详情、图片、日期/多选/状态/排序/分页。
- 结果与防错：合格与瑕疵数量守恒，超过剩余数量阻断；新增采购保留表单所选币种；需求下推先读取关联PPO持久覆盖；复制清理旧驳回/关闭原因和采购/到货日期。只有明确保存的本地入库事实进入库存读表，静态“已入库”状态不自动造入库量。合格和瑕疵分仓展示，只有合格量冲抵采购需求。转原料为明确本地采购分类，保留SKU、单位及历史，不能称实物库存已转移。
- 子清单：条码/细码列表默认2页，批量修改、补充、删除、导入、清空、日期/数量/状态查询、单条/批量Code128预览与导出；条码下架到待出库区保存区域、人员与时间，仓库实物数量不因此减少。
- Mock：采购单列表默认2页；条码子列表6条、默认每页5条、2页。用户采购单和细码覆盖按记录保留。

**08 面辅料采购跟踪** — `/pms/material-purchase-tracking`

- 功能：采购/物流跟踪、单条和批量签收、签收日期，单条和批量转运、批次、原箱模式、重置、运单复制；渠道搜索/多选/全选/清空、日期、三类状态、分页；来源采购单和关联货运批次直达。
- 结果与防错：签收以剩余数量为边界，转运写入存在的头程批次和货箱；采购跟踪、货箱明细与日志共同保存，超量或无合法目标阻断，后续头程及采购单可独立回读。
- Mock：默认2页；未签收、待转运及已转运具有可区分事实。

**09 面辅料采购时效** — `/pms/fitting-timeliness`

- 功能：首单/翻单切换，位置、状态、日期、查询、重置、导出，已有记录的时间编辑。
- 结果与防错：演示时效使用关联MO静态物料快照、当前状态和用户覆盖；实际确认、发货或实到时间不能派生计划或预计时间。测试站首单/翻单均空，行编辑无样本，导出未收到下载回执；这些源站边界独立保留，本地已有时间保存/刷新以及SKU列冻结/取消冻结诊断，源站无样本身份保留；当前版本接受仍由root确认。
- Mock：静态13条、默认2页；物料图与代码使用关联MO同一静态快照，用户覆盖保留；V4/V9/V11时间与列偏好证据保留各自版本，V12最终接受另记。

## 4. 面辅料供应商确认

**10 面辅料供应商确认单** — `/pms/material-supplier-confirmations`

- 功能：同步符合条件的采购单，查询、日期/人员/标签筛选、导出；只读详情、编辑、卷数/数量/包裹及发货资料、日志；保存草稿、保存并确认、供应商确认；生成卷标签二维码、单条/批量标签电子预览。
- 结果与防错：确认主单与关联面辅料采购单确认状态同事务；修改已确认数量会同时撤销关联确认，已到货/入库/关闭不允许再编辑。最终确认在已有抽屉内说明数量与后果，未保存的输入及标签预览保留。电子预览不增加“实体已打印”次数。
- Mock：6条，默认每页5条，2页。

## 5. 头程物流

**11 头程物流** — `/pms/first-leg-shipments`

- 功能：新增/编辑批次、货运类型、预计送达日、费用和重置、交货与状态；新增/编辑货箱、换箱号、换批次、物料换箱、长宽高/重量、汇总、备注、标识关键词、展开；面辅料/测款文件导入、同步货箱、条码电子预览；明细、装箱单、装箱明细、本土做货数量及成衣商品明细导出；封箱、空箱删除、查询、重置和分页。
- 结果与防错：换箱和跨批次移动保持来源、数量及箱明细一致；非空箱不能删除，封箱后相关编辑受保护。已交货、头程中、到仓等是本地登记事实，不表述为外部物流回执。本土做货导出仅引用已有关联的印尼做货采购单及计划SKU量，不宣称工厂已生产。
- Mock：默认2页；批次/货箱详情有相关记录，选料候选另按页展示。

## 6. 库存查询

**12 原料仓库存查询** — `/pms/material-inventory`

- 功能：SKU/SPU/名称、仓库、类型与库存排序，查询、清除、分页；库存来源、日志/流水、在仓条码、最新盘点单、图片大图及本地采购入库明细。
- 结果与边界：只读既有WLS事实和已明确登记的本地MPO入库量；精确SKU+仓库+单位匹配，混合单位分别显示。未提供的锁定、在途和可用量不造0；无条码/盘点/流水事实显示真实空结果。条码移到待出库区保留数量。此前无需求的补货、调整、伪采购/伪工艺写入入口已经退出。
- Mock：当前WLS只读basis12条（6SKU各2仓），默认每页10条，2页；用户本地MPO入库另行叠加。WLS行沿用WLS图源，明确本地入库行使用采购物料快照；不能称独立静态库存10条或相同来源，不写WLS。

## 7. 采购对账

**13 面辅料采购请款** — `/pms/material-payment-requests`

- 功能：新增、详情、可编辑状态的请款修改、申请付款、部分付款、请款/付款记录、日志；供应商与关联采购资料、附件选择/继续上传/预览；查询、无结果、重置、导出和分页。
- 结果与防错：请款、付款明细、附件Blob与必要引用/日志同事务；部分付款计算未付余额，超过余额阻断；已完成记录受状态限制。刷新可读取实际本地金额、附件字节和历史，不能称银行或外部财务支付成功。
- Mock：默认2页。

**14 物流费用请款** — `/pms/logistics-payment-requests`

- 功能：新建、详情、未请款/已申请记录编辑、申请和部分付款、请款/付款记录及日志、附件、状态查询、重置、导出和分页。
- 结果与防错：关联物流来源和本地费用事实，余额与状态限制一致；金额/历史/附件共同保存，可独立回读，避免主单保存而附件失败。无真实物流来源不虚构费用。
- Mock：默认2页。

## 8. KOL样衣申请

**15 KOL库存** — `/pms/kol-sample-stock`

- 功能：查询SKU、批量锁定、按比例填充、勾选清零、单条锁定修改、批量释放、生成样品池链接、查询/重置及分页。
- 结果与防错：锁定池、已占用及可用量分别计算；锁定不超过实有库存，释放不侵占已有申请；样衣采购收发与此库存同事务一致，相关锁定变化留操作记录。空选和超量有明确反馈。
- Mock：默认2页；合法PCS SKU及对应图片用于新增样衣库存。

**16 手动寄样申请** — `/pms/kol-sample-apply`

- 功能：状态查询、重置、查看申请、审核通过、驳回及关联借出单；来自样品池的SKU、申请量与收件资料可追溯。
- 结果与防错：申请及占用量、审核/驳回和借出关联记录按本地动作保存；申请超可用量阻断，驳回释放对应占用。借出是本地样衣关联记录，不能冒充真实仓库寄样或外部运单。
- Mock：默认2页。

**17 对外样品池链接** — `/pms/kol-sample-link`

- 功能：状态查询、重置、访问和复制链接、修改、作废及关联申请；可在本地链接入口选SKU并提交演示申请。
- 结果与防错：链接关联库存与申请，作废后不能继续使用；本地同源分享地址可演示，不能宣传成跨浏览器/设备共享库存服务。申请、链接引用和占用变化须一致回读。
- Mock：默认2页。

**18 锁定操作记录** — `/pms/kol-sample-stock/lock-log`

- 功能：查询、重置、操作类型候选、关联申请检索、分页和操作追踪。
- 结果与边界：读取锁定、释放、样衣出库导致的必要池变更日志；人员、时间、数量、来源保持业务可识别，日志不提供另一个可改库存入口。
- Mock：默认2页。

## 9. 基础资料

**19 商品供应商管理** — `/pms/suppliers`

- 功能：新增草稿/保存并启用、详情、完整编辑、联系人/结算/地址/自由城市、等级等字段和候选；启用/停用、待审核通过/驳回及原因；条件查询、重置、导出、日志和分页。
- 结果与防错：单供应商及操作记录按动作保存；启用/停用明确后果，失败保留输入；现有身份和供货/采购引用不因显示或新短编号改变。
- Mock：13条，默认每页10条，2页。

**20 供应商供货档案** — `/pms/supplier-supply-archives`

- 功能：新增、详情、编辑、复制到其他供应商、启用/停用；完整供货、包装数量/单位、费用与默认物流商/渠道资料；模板下载、文件选择、导入预览/清空、批量导入、导出及查询/分页。
- 结果与防错：物料仅选当前合法PCS身份和对应图片；重复档案/非法来源阻断，复制保留关系，批量导入整批原子完成。物流商改变后渠道选项依所属物流商联动。供应商/物料历史快照和用户覆盖保留。
- Mock：12条，默认每页10条，2页。

**21 头程物流商管理** — `/pms/first-leg-carriers`

- 功能：物流商新增、只读详情、完整编辑、启停；所属渠道新增、只读详情、编辑、启停和公司切换；运输/计费方式、重量体积、集装箱、价格、清关税费、派送、范围、时效区间等字段；条件查询、统计、重置和分页。
- 结果与防错：物流商/渠道各自记录和日志按动作保存，最短时效不大于最长时效，集装箱等相关必填保持联动；关闭未保存表单有保护。当前V16筛选物流商后统计为1商、2渠道、1启用，与列表同范围；切换陆港同步CH-CN-0005/0006及USD，见最终补证。
- Mock：6条，默认每页5条，2页。

## 六个对象完整删除

已授权删除：面辅料列表、成衣列表、样衣列表、仓库管理、单位管理、BOM/样板管理。实施报告登记了对应菜单、路由、页面、处理器、专属数据/Mock、旧存储访问和当前消费者的退休，不止隐藏菜单。材料、成衣/样衣选款、仓库/单位引用、BOM展开改用本次仍需的PCS/WLS来源和已冻结采购快照。

对象分别退役：面辅料为material-archives页面/materials数据；成衣与样衣共用product-skus页面/数据，分别绑定renderPmsGarmentSkusPage/renderPmsSampleSkusPage；仓库为warehouses，单位为units；BOM为bom-templates与bom-detail页面/数据，旧inventory-monitor入口同时退出。精确deleted paths、旧地址、基线符号及当前消费者见PMS-RM-01～06与cleanup /retirementAudit；源码退休及当前消费者整改已实施，最终治理记录由root登记。历史证据保留原版本身份；退休业务入口不自动授权清空用户浏览器既存数据。旧用户采购/供货快照保持可读，普通访问不暗中迁移或复活旧写入口。


V12 manifest 登记的14个独立删除路径如下。成衣/样衣分别退出但共用同两文件，数量不重复计算；旧库存监控及其专用测试为一并退出的遗留入口。

| 删除对象 | 独立删除路径 |
| --- | --- |
| 面辅料列表 | `src/pages/pms/material-archives.ts`；`src/data/pms/materials.ts` |
| 成衣列表 | `src/pages/pms/product-skus.ts`；`src/data/pms/product-skus.ts`（与样衣共用） |
| 样衣列表 | 同上两路径；独立样衣渲染/菜单/地址同时退役 |
| 仓库管理 | `src/pages/pms/warehouses.ts`；`src/data/pms/warehouses.ts` |
| 单位管理 | `src/pages/pms/units.ts`；`src/data/pms/units.ts` |
| BOM/样板管理及详情 | `src/pages/pms/bom-templates.ts`；`src/pages/pms/bom-detail.ts`；`src/data/pms/bom-templates.ts`；`src/data/pms/bom-detail.ts` |
| 旧库存监控及专用测试 | `src/data/pms/inventory-monitor.ts`；`tests/unit/pms-inventory-monitor.test.ts` |

## 源站六条具体边界

| 源记录ID | 原型实际入口 | 实施边界与原因 |
| --- | --- | --- |
| PMS-TEST-CORE-PPO-ROW-PARTNER | 商品采购单行“设置合作商”／boundary-partner | 源表单实际显示“暂无可选合作商”，没有合法可选合同；本地提示同样明确，无虚构关联或成功。 |
| PMS-TEST-CORE-PPO-BULK-PARTNER | 已选批量“设置合作商”／boundary-partner | 已选记录实际仍无候选；无选时的门禁另属已实现行为，不能统称整个批量入口未实现。 |
| PMS-TEST-CORE-PPO-ROW-ONECLICK | “一键下单”／boundary-oneclick | 源站店小秘一键下单仅显示待对接；本地不声称已建平台订单。 |
| PMS-TEST-CORE-PPO-ROW-MATSAMPLE | “面辅料样衣”／boundary-materialsample | 源站待对接，没有可用保存表单；本地不声称已创建样衣业务记录。 |
| PMS-TEST-CORE-PPO-ROW-TAILPARTNER | “设置尾部烫包质检合作商”／boundary-tail | 源站待对接，没有合法候选；本地不虚构质检合作商绑定。 |
| PMS-TEST-CORE-PPO-ROW-WORKORDER | “创建工单”／boundary-workorder | 源站仅待对接，无可读建单合同，不能据提示推定FCS生产工单字段或合法消费者；本地不生成虚构工单。 |

以上六条不适用有具体来源与原型入口。源站已显示可用表单的采购、物流、请款、KOL及关联动作仍在本地实施范围，不能以“真实后端未接”为由跳过本地可完成的对象创建、保存与回读。

## Excel、附件与打印边界

当前共用 `parsePmsExcelRows` 已补普通 BIFF8 二进制 `.xls`、OOXML `.xlsx`（含日期）、HTML `.xls` 与 CSV/分隔文本读取，五个页面的六项导入能力为供货档案、需求实际采购量、需求累计实到、采购快递、细码、头程装箱。新增格式合同见 [真实 XLS 最终报告](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-real-xls-final-report-20261014.json)，SHA `de7fd381ff7107acfac515986d307a6c11218eb061920af7395f78c0aaa70d1d`；报告记录 10/10 窄测试及 34 个真实 fixture 与独立 xlrd 的内容同值。accept 扩展名仍不证明文件内容，页面列、合法对象和数量校验仍生效。格式能力不包括密码解密、BIFF2–5、宏/图表/对话表导入、公式重算或任意工作表选择；只读首个普通工作表及已保存公式缓存，无法读取的值不造数。

V11 原始 [XLS 六能力记录](/tmp/pms-final-ui-20261013/formal-v11-5350-imports-current.json)（SHA `d847b25ffeb33c3dd58fe3a1bc3bad1357e8f408587a73e1efb4eaaf3aa17bf2`）包含各能力五次有效保存。供货每批 20 条、重复阻断五次；需求四条物料数量和累计实到分别记录；原 CGF-0004 已有物流 800，尝试累计 801 正确阻断五次，新 CGF-0007 导入编号 2–6 有五次有效回读，编号 1 错误 store 采集无效保留。细码每批两条、头程每批两 SKU，父单 `persistentRows=1` 不等于一条条码或一 SKU。

[V11 XLSX 供货与追加记录](/tmp/pms-final-ui-20261013/formal-v11-xlsx-archive-imports.json)（SHA `9a8e24b6f522bd796669524af98d18197878c9da20b7874dce3588b92f7e0f1e`，尾部 XLSX 序列 `/143`–`/155`）保留每批 20 条；第 1 批实际保存但终点采集无效，第 2–6 批为五个有效保存，最终用户供货档案覆盖 220 条。该文件镜像之前数组前缀，不能把复制引用当新增独立样本。旧 HTML `.xls` 的实际字节身份和报告 SHA 不变，新 BIFF8 实现替代旧版本“未实现二进制 XLS”的当前能力口径；这些文件只在本地原型导入，没有提交到测试站或正式站。

附件实体保存原始Blob，JSON仅存引用及必要元数据；复制不凭文件名重复造字节。电子条码/二维码与打印预览不表述为物理打印完成，不改变打印计数或实体出入库。浏览器导出入口与文件实际下载需各自验收，原站错误页、无下载回执或保存窗口取消不能算导出成功。

## 当前版本与已完成的验收范围

当前产品冻结为 **V16**，源摘要 `3279d61646e0e47bd4be447eb2e26e3ed2c92758ddc508f61f51a58d3f232c28`，105项源码/删除、1004项资产，本地预览5392。[V16 manifest](/tmp/pms-final-production-v16-manifest.json) SHA `061037d01d9d752b20b8c1eaa0e33a26300f5a0d0e04bdb910590d1d4043e915`；逐项路径/SHA、原版本与复用解释见 [最终证据索引](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/final-evidence-index.json)。这不是Git提交、推送或Vercel发布回执。

已完成 **21页 × 首次访问／SPA／刷新 × 每家族5次＝315条加载验收**，最大 **895.2ms**；1366×768与1280×720记录、30项菜单SVG及主体无横向溢出由 [最终加载覆盖报告](/tmp/pms-final-ui-20261013/final-loading-coverage-report-20261014.json) 确认。原V12 MPO刷新1150.1ms失败保留，V13七张真实首屏图并行请求后有15条受影响页复测；其他20页使用原版本未变依赖及报告明确的复用依据，不重标为V16重新运行。

原V12六项P2审查及其4822差异保持原身份。六P2源码修复、后续PPO复制执行事实清理、FLS新增表单重置与币种说明已实施；后续V13/V14原始与回读补充实际结果，不回写旧审查为新版本审查。数据/记录身份未变时复用原链，短编号仅改变保存提示显示，不改变ID或读写。

后续实际功能证据已补：V13原币USD/IDR采购及独立回读、混币/汇率合并门禁、持久父PPO直达需求下推、驳回MPO复制；V14正常合并/拆分各5次与旧质检/审核/重开事实复制清理5次，均保留原始操作及独立读回版本。V13备份25案例为5完整恢复、缺文件/归属/元数据/内嵌文件地址四类各5阻断，5个Blob的ABC原字节已独立读回；旧V11导出文件、XLS/XLSX及其真实格式身份继续保留。具体索引不把父单persistRows当细码/SKU数，也不把镜像数组当新样本。

V16追加补证：头程新增表单重置[五个实际样本](/tmp/pms-final-ui-20261013/formal-v16-FLS-reset.json)均通过，最大54.6ms且外壳保留；[物流商切换](/tmp/pms-final-ui-20261013/v16-carrier-company-switch.txt)读取陆港两渠道与USD，[筛选统计](/tmp/pms-final-ui-20261013/v16-carrier-company-filter-statistics.txt)为1商/2渠道/1启用。真正的[终结编辑门禁](/tmp/pms-final-ui-20261013/v16-confirmed-terminal-guard.txt)是已确认CONF3关联CGF5实到60后拒绝保存草稿，原确认保留；旧误命名v16-confirm-terminal-guard.txt属于CONF1未确认单合法编辑保存，不能作为阻断证明。[原生CSV内容](/tmp/pms-final-ui-20261013/v16-native-csv-content-report.json)核对商品采购12行和面辅料采购8行，均跨两页、无操作列；以实际文件rows/header为准。商品采购建议1366与面辅料采购1280两张最终截图已由root视读，原图身份见索引。

<!-- FINAL_SUITE_STATUS_START -->
**31个实际业务case已通过技术验收，采用分批直接复验**：V16首批20个、供应商/确认单/KOL三个单case各1个、剩余批前三个、拆合与批量状态复验2个、最后批2个、物流R3最后1个，合计31。具体日志、原case标题和六份spec最新SHA见[最终证据索引](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/final-evidence-index.json)。[原31批次](/tmp/pms-final-local-browser-v16-20261014.log)的20通过/3失败/8未运行、后续失败与额外shutdown错误均保留；这不是同一完整批次31通过，没有跳过有效case。后续只修UI测试步骤或expected排序，V16产品源码不变；[物流R3](/tmp/pms-settlement-repair-v16-r3-20261014.log)最终1通过（3.7s）。root[功能关闭报告](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/final-evidence/final-functional-closure.json)记录技术接受，未冒充用户产品接受。

root已将806条追踪记录登记为**800已验证、6不适用**；806是观察与原子记录，不是806个独立测试。最终[任务收据](/tmp/pms-final-receipt-20261014/task-receipt.json)尚待生成，本清单不预填结果。V13完整构建865/865保留历史版本，PPO复制事实增量10/10另有真实日志；V16现有Vite构建不称最终全量866已运行。
<!-- FINAL_SUITE_STATUS_END -->

旧V2/V10有效慢样本、误标为V12的V11原始记录、空[]与版本更正均保留，不作为新版本成功。原V12独立审查仍是原审查；后续业务回读和V16资产身份分别绑定。

## 6 项 P2 修复与本地资料证据

独立审查所读的完整任务差异是 [pms-final-independent-reviewed-20261014.diff](/tmp/pms-final-independent-reviewed-20261014.diff)，SHA `4822fb8132a0ccd0c3268ecc838496c653cbefd9bc56b0f287c68aabd3afc60e`；它保留该次审查版本身份，不能由后续文档更新冒称当前源码 diff 或产品接受。

| 编号 | 已记录的源码修复 | 证据与当前接受边界 |
| --- | --- | --- |
| PMS-FINAL-REV-01 | 采购目录入口仅加载直接依赖的 6 个 PCS 集合，避免无范围读取 FCS | 目录限定直接依赖已实现，加载/关联实际回读范围见最终索引 |
| PMS-FINAL-REV-02 | 商品采购合并前校验币种和汇率一致性 | 合并契约日志9/9；V13混币/汇率阻断及独立回读、V14正常合并/拆分各5次和31case直接复验已补 |
| PMS-FINAL-REV-03 | 需求单次/批量下推前读取关联 PPO 持久覆盖，再准备同事务候选 | MPO owner 新增/已编辑父单、版本和中止边界含在 27/27 |
| PMS-FINAL-REV-04 | 新增 MPO 将表单所选 USD/IDR 币种写入候选 | 原币金额保存/独立重读及V16实际CSV内容已核对，不臆造汇率 |
| PMS-FINAL-REV-05 | 复制 MPO 清理驳回/关闭原因及旧采购/到货日期 | 保留原单与复制日志，副本可合法推进；含在 27/27 |
| PMS-FINAL-REV-06 | 备份恢复核验业务附件实体/归属/元数据并拒绝内嵌 data/Base64/临时 blob 地址 | 引用契约日志 10/10；后续V13五正常/二十异常及独立Blob读回已补，见最终索引 |

本地资料复用共享入口：估算、完整备份/恢复、附件字节与引用、无引用清理及指定范围重置。保存和恢复共同成功的记录/Blob/引用/日志以事务 complete 为准，错误文件、同 operationId 改内容、版本或记录冲突不得假报成功。退休 6 对象的旧物理资料没有清空授权，普通读取不暗中迁移、不复活旧写入口；本地同源资料不能宣传为多用户/设备共享或自动云恢复。

V11 [选好后选坏清除旧候选](/tmp/pms-final-ui-20261013/formal-v11-backup-invalid-cleared.json) 的 `backup-select-good/bad-1..5`、[相同记录恢复去重](/tmp/pms-final-ui-20261013/formal-v11-backup-dedup.json) 的 `backup-restore-identical-1..5` 与 [冲突不保存](/tmp/pms-final-ui-20261013/formal-v11-backup-conflict.json) 的 `backup-restore-conflict-1..5` 分别已有五次原始记录；`backup-restore-normal-1` 读取错误仓库导致采集无效保留，不改称正常恢复已接受。后续V13附件引用/归属门禁已有25案例及ABC字节独立读回，见最终索引。

[V11 完整备份生成记录](/tmp/pms-final-ui-20261013/formal-v11-backup-generation-complete.json) 的 `/157`–`/161` 即 `backup-generate-heavy-complete-2..6`，生成 Blob 为 394231B，时间分别 145.3/127.3/64.0/47.0/160.5ms。实际原生下载 [backup-2](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-2.higood-pms)、[backup-3](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-3.higood-pms)、[backup-4](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-4.higood-pms)、[backup-5](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-5.higood-pms)、[backup-6](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-6.higood-pms) 均为 394231B；存在文件与生成时延不单独证明其全部记录/附件恢复闭环。

| 原生备份文件 | 字节数 | SHA256（实际文件） |
| --- | ---: | --- |
| [actual-pms-heavy-backup-2.higood-pms](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-2.higood-pms) | 394231 | `e3969c2f97754422056fc69f4849c247bae145518d365daa6ed9fd989e8f9233` |
| [actual-pms-heavy-backup-3.higood-pms](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-3.higood-pms) | 394231 | `e9b7434bd63016906ac4c04d421f3858e9a678fd1332ac7c8b36c594d26f3bc6` |
| [actual-pms-heavy-backup-4.higood-pms](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-4.higood-pms) | 394231 | `41d8af1dc02eb42f93ad61442c02b75721de851345520c71b8759d1b6a90af30` |
| [actual-pms-heavy-backup-5.higood-pms](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-5.higood-pms) | 394231 | `454aee3e133034b33e5497b3b32506871958a3f5051b92de705b4aa1094f63ea` |
| [actual-pms-heavy-backup-6.higood-pms](/tmp/pms-final-downloads-20261013/actual-pms-heavy-backup-6.higood-pms) | 394231 | `c76509cadf3118a152750a52a0368a334228c351f28782712c07650d91246a5e` |


[V11时效列冻结记录](/tmp/pms-final-ui-20261013/formal-v11-fitting-freeze.json) 的 `fit-freeze-SKU-1..5` 与 `fit-unfreeze-SKU-1..5` 为各五次记录；保存后绿色10:04时间刷新显示另按其原始时效记录核对，不从计划/预计时间推导实际时间。所有读取、保存、迁移/恢复证据仅说明单浏览器同源本地演示，不代表实际仓库、外部采购/财务/物流或工厂生产。

## 尚需最终收口的项目

- 31个实际case已分批直接复验收口；保留旧失败、测试步骤修订和运行版本，不再把初批未运行当当前遗漏。
- root已更新800已验证/6不适用的矩阵及正式审查记录；最终治理收据仍待生成，未生成结果不预填。
- 原版本证据按具体未变依赖/处理器复用，受影响路径采用后续实测；不承诺真实外部平台、工厂、银行或跨设备云同步。

## 资料位置

- [冻结功能清单](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/source-checklist.md)
- [806条需求矩阵](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/requirements-matrix.json)
- [核心5页实施绑定](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-core-implementation.json)
- [基础资料与完整删除](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-cleanup-implementation.json)
- [面辅料、物流、请款与KOL实施绑定](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-material-ops-implementation.json)
- [供应商确认与库存](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-confirmation-inventory-implementation.json)
- [细码与条码](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-mpo-barcode-implementation.json)
- [V16产品冻结manifest](/tmp/pms-final-production-v16-manifest.json)
- [正式审查记录](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/2026-10-14-pms-procurement-alignment.md)
- [最终证据索引](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/final-evidence-index.json)
- [315条加载验收报告](/tmp/pms-final-ui-20261013/final-loading-coverage-report-20261014.json)
- [V12历史manifest](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-final-production-v12-manifest.json)
- [真实V12原始页面记录](/tmp/pms-final-ui-20261013/formal-v12-5360-actual.json)
- [V11原始XLS记录](/tmp/pms-final-ui-20261013/formal-v11-5350-imports-current.json)
- [V11原始XLSX、恢复、时效追加记录](/tmp/pms-final-ui-20261013/formal-v11-xlsx-archive-imports.json)
- [性能计划](/tmp/pms-performance-plan-20261013.json)

## 前次实施绑定修订（历史版本）

计划、矩阵与本清单同步；原冻结source、5份owner报告和旧/tmp草稿不覆盖。806编号、800待验证/6不适用保持，报告实际JSON Pointer、已有ID或明确家族引用、原诊断版本与SHA逐项保留。六个具体源站待对接/无候选边界不扩大，该次共用解析器尚无真正binary OLE/BIFF能力，旧错误能力断言由当时字节核查纠正；后续真实BIFF8实现已补，当前能力以本稿新版段及de7fd381报告为准。库存当前export的12条口径纠正旧草稿10条；时效计划/实际语义由V4专项关闭。最终接受root填写，本次文档修订不能称全部通过。


### 早期 Excel 样本字节纠正（历史身份，2026-10-14）

在真实BIFF8实现之前，“供货档案支持真正二进制XLS”是错误断言，当时已撤回；后续新增实现有独立报告和本地UI证据，不改变以下旧文件身份。以下为任务本地诊断文件的实际字节身份，不是测试站上传成功回执。代码消费者分别为供货档案handlePmsSupplyArchivesEvent、需求readMreqUpload、采购快递handleImportFile、条码readImport与头程handlePmsFirstLegShipmentsEvent，共用parsePmsExcelRows。

| 模块/文件 | 大小 | 前16字节（十六进制） | 实际格式及证据边界 |
| --- | ---: | --- | --- |
| 供货档案 [supply-import-valid.xls](/tmp/higoods-pms-cleanup-local-verification-20261013/supply-import-valid.xls) | 460 | `3c68746d6c3e3c686561643e3c6d6574` | HTML表格内容，文件名.xls，非OLE/BIFF |
| 供货重复保护 [supply-import-duplicate.xls](/tmp/higoods-pms-cleanup-local-verification-20261013/supply-import-duplicate.xls) | 456 | `3c68746d6c3e3c686561643e3c6d6574` | HTML表格内容，文件名.xls，非OLE/BIFF |
| 供货档案 [supply-import-valid.xlsx](/tmp/higoods-pms-cleanup-local-verification-20261013/supply-import-valid.xlsx) | 2726 | `504b030414000000000026ae4d5d1c74` | OOXML XLSX（ZIP内workbook/sheet1结构） |
| 条码细码 [barcode-import-valid.xls](/tmp/higoods-pms-cleanup-local-verification-20261013/barcode-import-valid.xls) | 202 | `3c68746d6c3e3c6d6574612063686172` | HTML表格内容，文件名.xls，非OLE/BIFF |
| 采购快递 [logistics-template-valid.xls](/tmp/higoods-pms-material-ops-local-20261013/logistics-template-valid.xls) | 437 | `3c68746d6c3e3c7461626c653e3c7472` | HTML表格内容，文件名.xls，非OLE/BIFF |
| 采购快递 [logistics-valid-complete.xlsx](/tmp/higoods-pms-material-ops-local-20261013/logistics-valid-complete.xlsx) | 1664 | `504b030414000000080014ad4d5d1c74` | OOXML XLSX（ZIP内workbook/sheet1结构） |
| 需求数量 [mreq-quantity-valid.xls](/tmp/higoods-pms-material-ops-local-20261013/mreq-quantity-valid.xls) | 144 | `3c68746d6c3e3c7461626c653e3c7472` | HTML表格内容，文件名.xls，非OLE/BIFF |
| 需求入库 [mreq-inbound-valid.xls](/tmp/higoods-pms-material-ops-local-20261013/mreq-inbound-valid.xls) | 147 | `3c68746d6c3e3c7461626c653e3c7472` | HTML表格内容，文件名.xls，非OLE/BIFF |
| 签名拒绝测试样本 [legacy-binary.xls](/tmp/higoods-pms-material-ops-local-20261013/legacy-binary.xls) | 512 | `d0cf11e0a1b11ae10000000000000000` | 仅OLE签名测试样本，未证明有效完整BIFF工作簿 |

OOXML样本ZIP含xl/workbook.xml、xl/worksheets/sheet1.xml及[Content_Types].xml；PK头本身不足以确认Excel，因此已同时核对成员。legacy-binary.xls只有OLE签名，其余504字节均为0，不是已验证的有效完整BIFF工作簿；该拒绝诊断不能推广为所有合法旧XLS的实际测试。当时头程页只有共用解析器代码而没有独立成功样本字节；后续V11已有真实BIFF8两SKU导入，引用当前文件能力段，不把旧HTML样本改称BIFF8。文件SHA及逐需求纠正见矩阵importFormatCorrection与文件格式纠正；历史owner报告不改，不能继续作为binary能力证明。


## 本轮报告归档与交付边界

| 原始报告（按原字节归档） | SHA256 | 本轮用途 |
| --- | --- | --- |
| [pms-final-production-v12-manifest.json](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-final-production-v12-manifest.json) | `37ec37583ee7338c92e9ccde6551d9885886073e2a8dd3fdf55e0b886fe19c93` | V12 源/删除与资产身份，101 项源码/删除、1003 项资产；不代表页面接受 |
| [pms-final-independent-review-20261014.json](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-final-independent-review-20261014.json) | `5c7f0b27c88ca3d9c05255d41f38e8d10380be289f99311bd433a86f6ad4a5ed` | 6 项 P2 源码修复复核；独立性限制和旧 diff 身份保留 |
| [pms-material-review-fixes-20261014.json](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-material-review-fixes-20261014.json) | `023a81bbf6b3b01927cd8aa0f0f55d2c66439b0b1b68a15b80603baa77037ac5` | MPO 直达读取、币种、复制重置的 3 项修复及 27/27 窄回归 |
| [pms-real-xls-final-report-20261014.json](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-real-xls-final-report-20261014.json) | `de7fd381ff7107acfac515986d307a6c11218eb061920af7395f78c0aaa70d1d` | BIFF8/OOXML/HTML/CSV 格式合同与 10/10、34 fixture 独立内容比对 |
| [pms-mislabeled-v12-on-v11-correction-20261014.json](/Users/laoer/.codex/worktrees/7eaf/higoods/docs/prototype-review-records/pms-alignment-20261013/pms-mislabeled-v12-on-v11-correction-20261014.json) | `e3014c8978942a1ed0f5d7bfb9e75d92a0ce70ce31a4485f42481f2fdd6f51d9` | 误标 V12 样本实际属于 V11/5350 的更正；不改旧 raw 身份 |

本轮只更改实施计划、本清单与final-evidence-index.json；矩阵由root更新，冻结source/owner原始文件保持原身份。21页功能已按9组列出、固定basis默认两页和六对象完整删除继续适用；用户导入220条供货档案等演示覆盖不受“两页Mock”数量限制。315条加载PERF结果已记录；分批31case及当前矩阵技术状态已绑定；root继续完成最终治理与收据。本次未提交、推送或部署，也没有测试站/正式站数据库或真实工厂写入。


## 最后工程收口

首轮最终收据已实际得到全工程866/866单测与31个页面case单批通过；机器未verified的固定菜单路由/测试映射阻断保留于final-evidence/first-workflow-receipt-implemented.json。已补锁定日志精确路由，15样本最大488ms；治理文件补对应专项，不改产品流程、不跳未知测试。当前V17资产与源哈希见final-evidence/final-production-v17-manifest.json，早先V16证据保持原身份。第二轮最终收据预定位置为/tmp/pms-final-receipt-r2-20261014/task-receipt.json，冻结后生成，未预填其状态。
