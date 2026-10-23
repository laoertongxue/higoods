# C04 印花：当前业务审查及中央 PDA 实施范围

继承完整PDA拆分目标与requirements-plan-matrix，阶段为实施前/实施中；目标不是只做印花。初始审查基准caa7b286；当前推进基准a1000e14及任务差异；main的水溶、印花、实际接收与交接直接来源核对后再验证。UI继承public/newpda/dye-print-wash-flow.js等V34参考；业务公式和真实关联遵循当前Web，不能照搬其假角色、假批次或米数。

当前原生只读证据c04-print-baseline.log：69单，只有F090和FAC-FLOWER已关联中央工厂及真实现有账号，合29单；其他目录工厂没有相应主数据/账号，不能伪造。首次读取前后localStorage业务键及PCS记录均0。未登录时不得写；实际账号/工厂/订单不符需拒绝，不呈现身份限制说明卡。

| 对象 | 当前Web事实 | 新PDA动作/保留 | 直接源码 |
|---|---|---|---|
| 来料 | 真实审核/实际发出的来源、同单同投入SKU及同上游；面料逐原卷Yard和实际物位，通用数量接收已停用 | 接收Tab单独点收，一笔一原卷；上游/批次/SKU/图/单位，原卷重复拒绝，实际物位沿注册资料 | printing-material-receipts、factory-receiving |
| 花型/试样 | 当前花型版本和图片须齐备，打样在花型核对之后；设计改款目标SKU有自身资料前置，不重复花型/米样核对 | 核对实际图与版本，不新增审批/权限提示或管理资料编辑 | recordPrintingProductionStage / getPrintingWorkflowFacts |
| 领料 | 实际领用不能超实收余量；实际用料行扣减源卷，一次实际命令；不是商业接单/竞价动作 | 领料投入，不出现商业开工/接单按钮；保留生产资料前置，不自动代接单 | startPrintingProduction |
| 印制/转印 | 工序开始先于完成，当前需求版本的累计量不能倒退；转印只适用实际热转印且不能超过印制完成 | 同单内短表单；源数据按版本累计，不能改成V34演示的虚构单批公式 | recordPrintingProductionStage |
| 最终产出 | API接收累计完成/卷数，本批增量与新增卷数必须正，实际用料不能重扣；最终量不能超实际印制/转印，损耗选填但结束加工需核算 | 员工录本次新增产出/卷数，系统合成累计；保留源损耗/在制校验；原卷记录零数量草稿不得当实物 | completePrintingWorkOrder |
| 实物卷码 | 本单固定产出SKU、原单位；卷实测可由主数量/米/实重按既有规则换算；实际确认、有效规格及打印后才可交 | 真实卷码及标签，编辑当前卷不串值；不把lengthY内部名解释为所有单都Yard | updatePrintingRollBarcode / isPrintingRollReadyForDispatch |
| 交出 | 同工厂、同唯一接收方/接收仓、同单位可合单；全卷扫描齐后正式交；现行印花不要求染色运输三项 | 执行Tab单内发起/逐卷/确认交出/查看实收；不凭空增加司机车型车牌 | validateDispatchLines / confirmPrintingDispatch |
| 洗水 | 面料卷保留实际手感判断及洗水门禁，不同流向不能混成原下游已实收 | 对应实际判断与洗水交接逐项接入，不绕过、不生成假手感 | assertFabricWashingRelease / fabric-washing |
| 完单 | 全交出且独立收方实际全部接收、无未确认差异才可人工完成 | 明确后果一次确认，实际完成后只读数量；不以发方代收 | completePrintWorkOrderDocument |
| 仓管 | 实收行/真实物位、实际领用行、按卷实际产出/待出库位置及收发记录；未知历史量不能捏造 | 只读库区库位/记录和当前真实必要操作，具体按源工序；不套通用查询/盘点 | printing-warehouse-view |

数据边界：复用现有PCS库的共同工艺行集合/命令事务，不建新数据库/整模块快照。普通印花行、receiving领用/接收、交接及幂等结果须同事务；设计改款/洗水已归属记录沿原owner，不双写。首次静态基线必须原生验证，不能把69张静态单当首笔用户修改落盘。源域缓存print/receiving/PDA和失败恢复沿现有注册钩子；实收为独立接收方事实。旧资料显式迁移仍属于全目标待完成内容。

按依赖实施：先审查/最小正常边界 → 原生一笔保存/失败/冷回读及实际账号 → 独立print-model/view/page接收/执行 → 原卷及合单交出/洗水/独立实收 → 实际两仓 → 中印连续填写/按键/换人 → 对应正常、边界、失败恢复和性能。每阶段记录实际文件、证据、状态，不预填完整交付。

## C04.02 首笔保存失败证据与修复边界

接入前隔离原生检查c04-print-first-command.log：只对PWO-PRINT-001核对花型，却持久化258条记录，其中184条印花行、57张原单（包括未操作单）；旧业务localStorage键仍0。共同事务的print初始基线取空旧键，且runPrintProcessMutation为所有静态单刷新交接头元信息，因此未改静态数据被当成变化。该证据不涉及用户已有数据或线上工厂操作。

修复限定为：复用现有只读快照注册，印花读基线与实际保存使用同一个序列化投影（保持原洗水归属排除）；共同命令只比较实际行差异。原域只刷新确实改变的加工单对应交接头，不为一次动作持久化全部未变演示头。按记录恢复时，仅已经归属新共同账且与当前静态冻结身份完全一致的原单，允许未变化的任务/空节点从已有静态上下文读取；未知外来记录仍要求完整持久引用，身份/工厂/SKU/单位/来源校验不放宽。先重放原失败，再补冷页/失败/稳定重试及直接相邻染色/水溶/特殊工艺。

行基线修正后c04-print-first-command-row-baseline.log仅1张印花原单，但共40行；c04-print-first-command-diagnostic.log查明另外38条为通用保存的辅助工艺仓储投影，另1命令。它们没有本次印花动作归属。按当前动作边界在既有共同命令增加明确process记录范围：印花只捕获其print/receiving/PDA相关缓存及实际共同账，不捕获/写辅助工艺订单、仓储、tickets等域；既有C08调用保持原craft范围。不是新增存储引擎，不改变这些域本身规则。新printing-records入口必须明确使用该范围，按实际原单身份/交出单参与行作版本保护；设计改款/洗水记录仍沿现有owner，不能以该范围冒称迁移或所有混合owner合单已完成。

进一步行分组c04-print-production-row-groups.log确认：原生接25Yard、领10、印制9、转印8、最终产出8以及实际开始/完成人、失败回滚、稳定重试、冷读已经通过；144行中还有66来源、37接收、28领用，主要是只读印花演示资料被共同接收旧键空基线误采用。FactoryReceiving已有只读快照注册，本轮共同命令改为对所有已注册的现有键使用其当前只读基线，未注册键仍读取原源；不新增快照存储、不删除静态资料。初始领用检查脚本误读不存在的use.qty，已修正为实际use.lines按原单位求和，原collector日志保留，实际未发生重复领用。


## C04.02 直接来源与原生回读

所有快照注册取当前只读基线后，c04-print-production-receiving-baseline.log冷页失败：新实收找不到未落盘的印花演示来源，不能把无效回读当作成功。共同命令对本次变化的接收、领用、分配、送货行补齐直接引用的接收/来源文档；未修改且没有本次直接引用的演示记录不采用。没有修改来源编号、SKU、数量或库位校验，也没有删旧资料。

c04-print-production-direct-references.log重放通过：25 Yard实收、10实际领用、印制9、转印8、最终产出8及1个未测量零数量卷草稿；领料一次；开始/完成人分别F090_admin/F090_operator；伪造账号、超转印产出拒绝；原生quota失败无半套记录；稳定重试不重复；新冷页读回25/10/8/1。16条实际记录包括1来源、1实收、1领用、1印花单、1节点组、1任务及10命令/版本元数据。localStorage业务键0，未复制其他印花单或接收演示集合。

相邻原生回归：c06-central-water-model-contract-c04-receiving-baseline.log（水溶实收4+6、投入10/产出8、实际人及失败恢复）；central-dye-receipt-contract-c04-receiving-baseline.log（12.5 Yard两次分别折算11.43米，Web同源回读22.86）；c04-special-adjacent-all-sku.log（实收6/加工4/交3，独立实收0，quota回滚/冷读通过）。最初special-records-contract-c04-receiving-baseline.log使用旧脚本只传第一个SKU，缺其他实际SKU，失败保留；本轮仅修正隔离采集脚本补齐所有实际SKU，未改变生产校验。

## C04.03～05 新页面接入阶段

独立新增print-page/print-view/print-ui，复用共同账号、frame和数字输入，不引旧PDA模板。新路径/fcs/pda/central/print/{receive|execute|warehouse}及单据详情；entry按工序懒加载。接收单独处理原来料/原卷/实际物位；加工页同单内花型、试样、实际投入、印制、适用转印、最终产出。本次新增由当前累计量合成原Web输入，损耗仍是本次值，不重复用料。原生零数量卷草稿只显示未测量状态，尚未当作库存或可交实物。当前产出/实收视图先只读；卷标签、正式交出、洗水、完单、所有材料分支、仓管下架及完整性能仍待实施/验证，不能据此宣称印花完成。

小屏初查把原卷只有一个时的下拉删为原卷码，扫码按钮并入当前实物卡；减少重复SKU并保留上游/原单/批次。已选物位在同单下一笔保留，已有下一笔草稿的物位不覆盖；不同实物各自内存草稿，未保存不承诺关页恢复。首轮错扫发现已翻译错误被通用错误器误报未保存；修正为确定的错扫/登录错误码映射，原始失败c04-print-ui-continuity.log保留，后续重放单独记录。


## 当前Web共同命令、旧动作绑定与回归定位

当前Web的events/dispatch原有runDesignRevisionFcsCommand入口已按真实印花原单/任务/交出单参与行识别后接printing-records；前缀仅是懒加载预筛，实际不存在的ID、工厂和SKU不能获得印花归属。进入识别前先读部位票，不以空记录绕过原保护；首次失败c04-print-web-stale-action-diagnostic.log保留。central-execution-record-bridge补识别已归属印花businessView中的真实交出单和实际handoverRecordId，引用的工厂/人/其他订单不取得所有权。

c04-print-web-stale-action-settled-red.log实际复现：Web确认花型后，PDA旧“确认花型一致”按钮误提交了SAMPLE。主按钮现绑定显示时的动作/版本及接收实物，在异步读取后比对；对象、状态或按钮节点已变则不提交。c04-print-web-stale-action-current.log通过：Web已完成ARTWORK，PDA旧按钮只提示变化，SAMPLE仍false，实际动作只有1条，不自动代办下一工序。旧ready-red曾在命令完成前过早采集，不能当通过证据；后续采集等待真正反馈与最终状态。

标准构建首次c04-print-standard-build.log和独立c04-print-full-unit.log均1387项中失败1项：设计改款印花完单后的交出头未完成。隔离当前其他来源、仅替换HEAD版printing域通过；old-mutation版本通过，删快照投影版本不通过，排除错误根因。诊断c04-design-print-metadata-diagnostic.log显示真实PWO-PRINT-AUTO-000001原单已manuallyCompleted且任务已改，交出头仍是旧缓存；旧代码依靠无关演示头upsert顺带清缓存。本轮在原印花动作之后显式invalidatePdaHandoverHeadCache，只略过未改且非真实创建/正式/设计改款的固定演示头，真实业务保持原同步。全退回旧循环虽可完单，但c04-print-production-original-loop.log会带入35条无关历史，未采用该方案。最终c04-design-print-handover-explicit-invalidation.log完单专项通过，c04-print-production-explicit-invalidation.log仍仅16条直接关联记录，数量25/10/8冷读一致。

当前c04-print-current-build.log通过完整npm run build：engineering入口与范围类型检查、1388项单元全通过、Vite构建28.83秒。之前全范围npx tsc仍有19项既存范围外错误，该命令不能标通过；标准工程门禁与全量tsc记录各保留自己的范围。当前版本仍有Vite大块提示，没有为消除提示修改无关依赖或全站构建配置。

当前c04-print-ui-continuity-current.log：真实320×640和320×480、两笔实收合22.5 Yard、投入10/印制9/转印8/产出8、语言保持数值与库位、错扫恢复/返回/清空/换人和独立空草稿检查通过；无pageerror。输入底边385<主按钮559（640高），296.5<399（480高）。新增包装数随原对象区分卷和其他包装，损耗标原投入单位。

c04-print-ui-recovery-current.log：quota失败保留实际2的填写且未扣料；恢复后真实领用2。下一笔3已保存但原生getAll回读故障时，字段锁住、语言切换仍锁住，只留重新读取恢复；恢复后实收25/实际领用5、用料2和3各一次，不重复。最初recovery.log在前一错误提示尚存时采集过早，settled版本又误假定记录枚举顺序等于操作顺序，原采集失败保留；当前脚本等aria-busy真实完成并按实际用料集合判定。

当前实际文件绑定：C04.01/03印花原单/来料/账号来自print-model的listCentralPrintFacts/centralPrintIncoming/saveCentralPrintReceipt；C04.04/05由print-ui.printProductionInput合成原累计，经print-page.productionInput/saveCentralPrintProduction和printing-task-domain.executeCentralPrintingProduction调用原Web函数；C04.11当前显示意图/独立草稿/失败恢复绑定print-page的refreshFooter/handleCentralPrintEvent/commit，数字语言沿共同解析器。仓位/收发只读视图来自printing-warehouse-view；当前产出卷还不能编辑或交出。正式标签/合单交出/洗水/完单PDA入口与其全分支、跨owner合单、完整任务收据/发布仍待完成。


## 当前详情读取与性能验证版本

首轮c04-print-production-performance.log包含跨文档performance.now相减的负导航值，不能用于性能通过；其他外部操作耗时亦保留。改为实际pointerdown、观察真实DOM变化或保存aria-busy完成、可见图片/内容就绪及两帧后，c04-print-production-browser-event-performance.log仍有超1000ms：打开执行最高1513.3、花型1337.2、实际投入1335.1、印制完成1324.4、转印完成1314.5、最终产出1343.6；接收下一笔有1001.4。功能五轮均数量22.5/10/8 Yard、实际人F090_admin、无pageerror，但不能据此声称响应通过。

c04-print-detail-read-diagnostic.log对照确认详情每次调用centralPrintFact都重新读取/推导整厂29单再find，本单原生定向读结果完全一致，五次原读取7.3～7.9ms，定向读0.1～0.2ms。新模型详情改用既有getPrintingWorkOrderById/current workflow/current stage；无单据编号直接返回undefined，详情来料也只取该单，不缓存数量、不改变源公式/保存/版本。列表继续用原全量读取，避免以性能为由丢记录。central-pda-print-detail-read.test全29真实中央单、工厂边界、所有有来料单的原物理行逐一相等通过；不是改显示精度或减少校验。

当前四项原生/页面重放均通过：c04-print-ui-continuity-scoped-read.log、c04-print-ui-recovery-scoped-read.log、c04-print-web-stale-action-scoped-read.log、c04-print-production-row-groups-scoped-read.log；冷页直接关联仍16条，实际人物与数量保持。c04-print-family-navigation.log从辅助特种、染色、水溶的实际菜单进入新印花页，保持原账号/工厂/模块，无商业动作或角色限制卡、横向溢出及pageerror。

当前最新c04-print-scoped-read-build.log通过完整标准构建：1390单元全通过、Vite23.11秒；此前1388通过属于上一个实现身份。最终五轮响应另记c04-print-production-scoped-read-performance及对应源码/资产manifest。全范围tsc19项既存错误与整任务governance历史失败仍各自保留，未把新局部构建改称整目标通过。


当前生产构建五轮c04-print-production-scoped-read-performance.log及summary通过：19个采集家族各5样本（其中cold-cliObserved独立保留，18个实际响应家族均≤1000ms），无pageerror。接收冷页浏览器paint最高385.5ms、执行导航316.8ms、仓管导航332.8ms；语言/保留库位32.2ms；接收首笔208.3ms/下一笔98.5ms；花型241.8ms、试样122ms、投入132.5ms、印制开始117.8/完成127.9ms、转印开始119.4/完成125.2ms、最终产出126.1ms；产出查看65.1、实收查看49.1、仓管记录31.9ms。五轮实际原生回读接收22.5/用10/产出8 Yard且各动作F090_admin一致。环境为当前本地生产构建Chromium、320×640、Asia/Jakarta；不冒称实拍PDA硬件性能或现场员工验收。旧超过1秒样本和错误跨文档计时原始记录全部保留。

源码/资产冻结位置c04-print-core-scoped-read-runtime-manifest.json；阶段完整任务差异与证据冻结位置c04-print-core-scoped-read-freeze.json及其tar包。该冻结只绑定当前实现和技术记录；全目标仍active，C04剩余标签/交出/洗水/完单入口与其他工序、第三方拆分、迁移和发布均沿各自原子矩阵继续，不由局部通过关闭。

## C04.06 实物卷与标签阶段范围（实施中）

继承完整拆分目标和C04.06，不以本阶段替代交出/洗水/完单。当前Web源已逐一核读updatePrintingRollBarcode、isPrintablePrintingRoll/getPrintingRollDispatchBlockReason、assertPrintingRollEditable、markPrintingRollBarcodesPrinted及printing-work-order-template。卷主数量lengthY实际上沿原output.qtyUnit；Fabric/花边/织带有克重/幅宽、实际米数/理论重量换算，实称重量保留ACTUAL；非面料kg只称重时保留3位，其他原主数量2位。所有卷合计（含既交）不能超过累计产出+.01；占用、既交、既入库/上架不得改。固定产出SKU不可换。

原正式标签为LABEL_100_60，包含原卷Code128和PRINTING_OUTPUT_ROLL的原workOrderId/barcodeId/outputSku二维码；本阶段新PDA标签保留原物理身份和100×60，使用真实产出图与中印文案，不把条码翻译或重生成演示编号。按需修改规格，库区库位不手填/捏造，沿原已存warehouseName。保留实际/理论重量区别，kg不当卷长，原图/单位/规格改变时打开的标签须重新核对；新UID仅扩展既有卷/操作/打印历史，不建新事实仓。

发现原source更新已打印卷时不撤销printedAt/by，打印门禁可误认为旧标签仍有效。先隔离原生复现后按C04.06的打印失效要求修复；修改打印内容（数量、规格、批号、仓名、备注、重量来源）须重新打印，普通无改保存不误清原打印。既有真实/历史单不全量重置，无管理身份提示。保存与确认打印沿当前printing-records/PCS同事务和稳定命令，不写业务localStorage。

依赖顺序：原生旧标签失效最小失败 → 原source实称/打印UID与失效修复 → 独立print-output-model/print-roll-ui/print-label及同单产出面板 → 真Code128/QR与100×60页面检查 → 多卷/余量/错值/占用/失败/稳定重试/冷读及每家族5样本。正式交出、运输（原印花不要求染色运输三项）、洗水、下游独立实收及完单仍按C04.07～10继续，不能在本阶段套通用交接。


C04.06当前走查：c04-print-roll-continuity.log多卷6.25/1.75 Yard、原单位/米数分别续填、中印数字、实称1.235kg、错扫/加工产出往返/清空/退出，无串值/空草稿；c04-print-roll-recovery.log保存quota保留6，旧标签打开后被另一真实账号改5则拒绝旧确认，4的已保存回读失败锁定及稳定重试，冷页恰好3次真实编辑且量8/用10不变。c04-print-label-layout.log真实Code128与QR的原身份未变，实际产出图，屏幕294宽无溢出；print媒体100×60mm、纸内无元素溢出；320×480输入底296.5、主按钮顶412/底468，ENT仅聚焦主按钮。print调用在隔离浏览器模拟请求，不冒称纸张/打印机/现场验收。

原生兼容补查c04-print-label-web-actor-red.log复现：PDA标打印后，Web无UID重印保留旧PDA用户UID。markPrintingRollBarcodesPrinted现在在没有实际UID入参时清掉旧printedByUserId，仅保留此次Web原姓名和原历史；有当前中央账号则记实际UID。green.log通过，不将未知Web UID冒认前一PDA人。实称/规格按当前source保留，BOM原物料不要求面料克重/幅宽、不把未称重说成已计算理论重量；件/米/重量的原数量语义不改。

首次实际材料分支c04-print-roll-native-materials.log：面料米单位及长原SKU标签检查已过，BOM历史单PWO-PRINT-007补码被原source的historicalRollQuantitiesUnknown拒绝，UI仍出现补码按钮且泛化成产出错误，采集超时不能算通过。本边界继续修正为沿原历史缺失事实只读，不虚构历史卷数、不把已交历史量当新卷；缺失记录不从PDA补录管理数据。


C04.06修正后的实际材料走查c04-print-roll-native-materials-final.log通过：原PWO-PRINT-005在米单位按本卷113.72保存，保留实际红色面料图和原长SKU，100×60标签纸内无溢出；PWO-PRINT-007历史缺卷数只展示原事实，不再有补码入口；PWO-PRINT-008原完工BOM包装可查看124.8m标签，未要求面料规格，标签中不编造0kg理论重量，无加工/打印确认动作。对应两条源边界单元已加入central-pda-print-roll-input.test。c04-print-roll-reserved-batch.log：原生真实草稿占用卷后拒绝改量且持久行不变，作废后释放；原Web批量克重改210后撤销旧打印及UID，不能以旧标签进入交出。

当前c04-print-roll-final-build.log完整npm run build通过1395项单元及Vite23.30秒。c04-print-roll-final-full-typecheck.log全范围tsc仍19项范围外错误，与上版错误内容一致，比较记录c04-print-roll-typecheck-comparison.json；不把该命令标通过。主整任务governance未因局部构建而改判；最终收据、完整拆分、迁移、发布待后续。

当前生产构建c04-print-roll-final-production-performance.log/summary：38采集家族中1个独立CLI观察，37个实际响应家族各5样本共185，全≤1000ms，页面错误0。冷接收411.3ms、打开执行318.8ms、仓管331ms；卷编辑49.1、输入限额32.5、展开规格49.3、切语言35、返回续填32.6、quota失败101.4、首卷保存118.5、新码并打开138.1、第二卷保存108.6；真实Code128/QR/图片就绪标签82.7、标签切语言82.6、打印请求32.6、打印确认115.9；历史缺卷数入口315.7/产出65.1、完工入口329.4/产出65.2/只读标签98.9ms。输入家族起点包含实际input/change事件，鼠标动作pointerdown，保存到原生提交与回读、内容/图片/QR和两帧；导航按各自timeOrigin。五轮实际原生22.5/10/8 Yard、两卷6和2、实际人F090_admin、仅首卷确认打印，localStorage仅有4096上限偏好键。

范围仍为本地生产预览Chromium、320×640、Asia/Jakarta；320×480功能另记。打印调用仅隔离QA模拟请求，不能冒称打印机/纸张或工厂现场接受。当前已测动作不覆盖正式交出、洗水及完工，也不替代C04.12剩余差异分支的采样；量单位/草稿/空值/错误恢复的未改实现沿其原证据和适用范围继承，不把旧证据改写成新发生。

C04.07接续前代码核查：CodeGraph trace确认confirmPrintingDispatch→handoverPrintingOutput→createFactoryHandoverRecord；原实际流程为同厂/同唯一收方及接收仓/同单位整卷合单、逐卷核对后实际交出，面料还需真实洗水判断。当前文档/scan/交出仅原姓名，handover没有中央印花UID入口；后续须沿现有原单/文档/扫码/交出及独立实收补实际账号，不能伪造旧全局会话或用水溶身份替代。runPrintingRecordCommand按任一目标选择设计改款或洗水owner，混合来源合单的原子保存/稳定重试尚不能认定完成；须原生正常/失败/冷回读核实后再接PDA，不用隐藏业务或顺序双写冒充共同事务。未改动本阶段之外的正式交出/洗水源逻辑。


## C04.07 正式交出接入阶段（实施中）

继承完整两端拆分与原印花Web流程，先补实际中央账号的建单/合单/逐卷扫码/交出/移除/作废记录，再接同单产出面板中的草稿、逐卷核对和实收查看。不加入运输三项，不使用旧全局PDA会话，不替代收方确认；真实洗水判断沿现有WashingActor现场判断职责和原单/卷身份执行，不能用静态读取豁免完成交出。

普通/设计改款/洗水已采用记录的混合合单属于此项明确范围，不通过隐藏来源、限制合并或顺序提交两套事务来缩小目标。现有design-revision ownership会沿合并行扩展归属，已有中央/洗水overlay仍可能保护原行；混合owner的一次提交、失败、稳定重试及冷读必须先有实际证据。当前先沿不变归属核查原生actor协议与真实业务校验，并保留混合owner未完成状态；不将单一来源成功冒称全部合单完成。


### C04.07 当前实际账号与判断保存归属证据

c04-print-dispatch-actor-red.log复现原建单/扫码没有用户UID；新增central-printing-actor仅复用原实际工厂/账号判断，避免共享PDA交接模块静态依赖整印花域。原assertCentralPrintingActor保持导出和含义。原create/merge/scan/confirm/void/remove增加可选实际账号及操作记录UID，旧Web无新入参仍按原路径；原单、工厂、姓名均核对，当前流程不依赖旧全局登录或水溶角色。真实创建UID、首次扫码UID和交出UID分别保留，重扫不改首次扫码责任。shared createFactoryHandoverRecord增加独立centralPrintingActor及实际printingTaskId，保留原单位/整卷量/收方责任，不伪造历史UID。

最初原型交接头只有processBusinessCode=PRINT而无sourceDocId，新actor校验过度要求sourceDocId导致拒绝；head-diagnostic证据说明后，改为核实际taskId，正式头有sourceDocId时额外核原单，工厂/账号/姓名继续严格检查。c04-print-dispatch-washing-actor-task-bound.log原生无需洗水后交出8 Yard、收0和不同创建/扫码/交出UID通过，但并不据此认定存储闭环。

c04-print-dispatch-cold-owner-red.log进一步显示同一印花单在washing过程行和central过程行各有一份，量分别0与8。该脚本后续动态导入可能形成开发模块实例差异，不据此声称全部数据结果；将washing/repository/handover统一纳入Vite编译的同一隔离harness后，c04-print-dispatch-cold-owner-canonical.log仍在实际runWashingRecordCommand交出中因归属/回退保护失败，证明须修复真实交叉入口。原始collector和真实失败各保留身份。

修复限定：已有中央行时adoptPrint只核该原行版本，不再复制印花/接收资料到洗水行；ensureWashingRecords读当前中央记录，guardWashingLedger将真实中央记录id/expectedVersion传入既有PCS事务。普通已归属中央的印花操作继续走原中央writer，现有设计改款/洗水owner不靠这条分支擅自迁移。没有新数据库、业务localStorage、顺序双写或假接收。

c04-print-dispatch-cold-owner-central-guard.log与c04-print-dispatch-native-recovery.log当前通过：实收25/用10/产出8 Yard，原卷实测/真标签后创建、逐卷、真实NO_WASH判断再交8；建单/交出F090_operator、扫码F090_admin，shared实际交出记录UID为F090_operator，独立收0。伪造姓名、扫错、未扫齐、无真实判断均拒绝且未写半套；判断quota和交出quota失败回滚、同operationId重试均不重复。判断事务实际读取中央版本guard（由原生IDB readwrite get观测），不是只检查函数返回。新冷页首次直达/随后读实际状态均8/8/0 Yard，创建/扫码/交出UID一致；该原印花单只1条中央可写行。只证明此实际普通来源/无需洗水分支，不把一次来源当作全部跨owner合单证明。

当前完整c04-print-dispatch-owner-build.log通过1397项单元、Vite23.21秒；新增central-pda-print-actor.test验证实际管理员与操作员均可记录职责、外厂/伪造账号拒绝，未加角色限制UI。全范围tsc19项与上一版错误消息完全相同、仍失败；对照c04-print-dispatch-owner-typecheck-comparison.json。37实际响应家族五轮185样本均≤1000ms、最高冷页405.5ms、页面错误0，c04-print-dispatch-owner-core-performance及summary；此项重放只覆盖当前已接入的接收/加工/卷/标签/仓管读及历史/完工只读，尚未接入的交出UI不冒称已验。

### C04.08 需洗水送洗的修复前失败（保留原阶段身份）

c04-print-washing-send-owner.log实际真实WASH/柔软手感判断可生成洗水单，但随后SEND在同一原卷8 Yard/F090实际账号下被“收发记录须通过对应业务动作保存”保护拒绝，持久行未变、原印花owner仍1。原因边界：送洗还必须生成实际给GTG的接收来源并更新当前中央原卷；原洗水writer不能独自写这部分已归属中央的事实。这不是可忽略的提示，也不能以取消判断、假NO_WASH、隐藏需洗水、绕过owner或两个独立事务代替正确送洗。后续须使该真实动作的洗水记录、接收来源与原印花变更同库同事务，各自保持原归属，补失败/并发/稳定重试/冷页/直接上下游，再接完整PDA流程。当前尚未实施合并保存修复，不预填证据。

本阶段未接入单内交出页面、全部多单混合owner、需洗后回卷或人工完成；原完整目标、旧资料显式迁移、第三方拆分与最终两个菜单/发布继续active。源与证据冻结绑定c04-print-dispatch-owner-runtime-manifest及freeze，不运行整目标完成收据，不发布中间状态。


## C04.08 已有中央印花单的送洗同事务修复计划（实施中）

继承C04.07全部范围与需洗水SEND原生失败，不缩小为NO_WASH。直接修改central-execution-record-bridge与fabric-washing-repository：同步业务动作期间两方共享当前过程原始值，但洗水writer跳过已归属中央的行；从实际中央版本提取这些行的变化，与洗水单/动作/接收来源共同调用一次既有commitPcsRecords。原中央行仍用原集合/id/版本，洗水及新送洗来源仍由现有洗水记录负责，不迁移存量归属、不新增数据库/整包快照/队列/顺序提交。

所有读取版本约束与写入版本约束同事务，重复guard不叠加；提交前失败恢复现有缓存hook，提交后必须重新读回中央与洗水状态并通知相应入口。明确区分未保存与已经保存但回读未更新，稳定确认号重试不得重复送洗或扣料。先重放真实WASH/SEND，再验quota/读回故障、稳定重试、冷页、独立染厂实收及数量单位，保留原NO_WASH与其他工序直接回归。现有cache hook已包含handover，复用既有恢复，不复制另一套PDA事实或预建通用存储引擎；跨设计改款等owner仍沿原矩阵继续，不能以本修复冒称全部合单完成。


送洗联合事务首个原生生命周期已通过至洗后交出：三类记录由同一原生IDBTransaction提交，写洗水单/来源失败均整笔回滚，染厂实收的已提交读回故障有明确已保存提示且重试不重复；原印花仍8/8/8 Yard、实际投入10，洗后最终下游未收0且禁止完单。该采集中listFactoryMaterialUses(washingOrderId)返回空，已由当前factory-receiving.ts确认该查询漏了既有washingOrderId条件，实际recordWashingMaterialUsage本来已保存。本轮只补该只读归属过滤并以真实单据/冷读确认领用一次8 Yard，不改扣料算法、不补造领用记录。factory-receiving.ts纳入此动作直接查询范围。


## C04.08 同单触摸判断与送洗页面计划（2026-10-21，实施中）

在既有产出面板内增加触摸判断/送洗短操作，不增加新主导航。直接读取原生批次、卷、判断、洗水单；按实际批次多卷选择，保留本人且未交出前完整原组纠正条件。送洗由实际扫码选择卷，支持原Code128和原PRINTING_OUTPUT_ROLL二维码；不从展示条码自动补扫。原厂实际账号记录判断/交出人，GTG与最终下游实收分别只读，不在原厂代确认。中印按钮与固定手感枚举分别显示、保存值不翻译。

负责print-washing-model/view、print-page、print-output-view；原submitWashingCommand只增加可选同步核验回调，在其原事务配方内核当前账号、工厂、单据与可见版本，旧Web未传回调保持原行为。已有联合保存、稳定operationId和已保存但回读未更新恢复直接复用；返回/切语言保留本账号本单输入，退出丢弃。没有通用异常原因/数量解释、岗位权限卡或旧全局会话。先验当前普通来源的真实UI与相邻Web回读，不把该分支冒充多owner合单、最终洗水端或全部PDA完成。

C04.08新UI故障复现：c04-print-washing-ui-recovery-clear-wait.log在实际SEND已提交后阻断records.getAll，原洗水reader正确报无法读取，但print-page的commit finally再次用frame读取该资料，抛错并停留aria-busy=true。此为真实页面恢复缺陷，不能用此前原生SEND成功或QA等待扩大掩盖。修复限于新print-page：未读回时保留当前DOM和内存输入，只更新反馈、已保存/重新读取主按钮及控件锁定；不再重读业务资料来画恢复态。读取成功后使用原稳定确认号核对，不重复送洗。只读恢复失败同样保持页面，不自动提交未保存填写。期间语言和导航锁定，先恢复本单资料；不增业务快照或后台自动重试。

C04.08生产校准又复现真实跨动作遗漏：补充产出卷addPrintingRollBarcode没有batchId，原getWashingSources按实际批次筛卷，因此产出6+2 Yard只有第一卷6被触摸页读到。原始calibration.log保留；不是通过减少为一卷规避。修复边界为既有native卷元数据与当前PDA新增/续填：唯一实际批次自动关联，多批PDA明确选批；已归属卷不可改归属，已有无批次卷经明确保存选择归属。继续保留原总产出余量、单位、打印失效、占用不可改与实际手感判断门禁，不重算数量或补造生产批次。旧Web无新参数的唯一批次自动得到同一修复；旧Web多批无明确选择的缺口仍登记，后续交出整体验收继续，不静默猜最后一批。

C04.08批次生产校准c04-print-washing-batch-production-calibration.log进一步发现连续作业真实问题：首批交出后返回加工，之前自动建立而从未填写的INPUT草稿仍带旧版本，新录下一批1 Yard被错误CHANGED挡住。保留该失败；不删输入/冲突守卫。修复仅在空数量/卷数/损耗且印机仍为初始默认时，重取当前版本与默认印机，更新未用确认号；有任何实质输入或手动印机变更仍按旧版本保护。默认印机与当前事实变化分开记，不将空草稿当作用户未保存内容。真实两批追加、返回续填和交完继续下一批纳入后续校准/五轮回放。


## C04.08 当前实现与定向证据（2026-10-21，完整目标仍实施中）

新增print-washing-model/view，沿原生getWashingSources/readWashingState和submitWashingCommand：执行→同单产出内完成真实触摸判断、固定手感选择、按批多卷及实际扫码送GTG；无需洗水沿原门禁保存，不假定无需洗水。实际批次和卷身份不翻译，显示名称隐藏CENTRAL-PRINT内部UUID。原判定人未交出前按完整原组纠正，原厂不代GTG或最终接收方实收。送洗支持原Code128和PRINTING_OUTPUT_ROLL二维码，核原单/卷/SKU，错扫/重扫不清当前选择，数量取实际所扫卷，不再手输。每个账号/工厂/单/批次或送洗单分别保留内存填写，清空无业务写入，返回/切语言保留，退出弃掉全部本人草稿。底部交给GTG带本次数量，分交后聚焦剩余实物扫码，全部交完不留空主按钮。

联合存储直接改central-execution-record-bridge/fabric-washing-repository，当前中央原行与洗水单/动作/接收来源一次PCS事务提交，原行不复制为洗水owner。factory-receiving仅补已有washingOrderId使用记录查询。新增原生submitWashingCommand可选同步核验回调，原Web不传保持原路径；新PDA在配方中核实际账号、工厂、当前可见版本，稳定确认号沿原仓库去重。未保存与已提交但未读回分别处理，新PDA的后者保留当前DOM/输入并锁定，只能重新读取，不用旧值或重画异常来假装成功。

当前正常/边界证据：c04-print-washing-joint-native-lifecycle-usage.log实际25实收/10投入/8产出，联合SEND三类集合由一个原生IDBTransaction提交；洗水单/来源quota均无半套；GTG实收8、实际领用仅一次8、产出8、按原方交出，最终接收0则禁止完单。冷页量/用料一致。c04-print-washing-joint-concurrent-roll-fixed.log另一页把原卷改7后拒绝旧8的SEND，保留7/未打印/交0/来源0；其首个collector错误是只匹配变化/版本未匹配“修改”，真实拒绝和原日志保留。当前旧无需洗水证据沿未改变分支复用，不重标新版本。

真实UI：c04-print-washing-ui-functional-navigation-fixed.log与c04-print-washing-ui-web-receipt.log完成ID/中文往返、原手感值不变、320×480输入及8 Yard底钮同时可见、错码/原QR/重复码/返回/失败续填、实际创建与发送UID。首个换人脚本误走接收页的错误保留，修正真实导航后通过；换人不继承扫描和纠正能力。原Web洗水详情实际登记GTG8后，PDA实收视图显示GTG8、最终0，冷页同值；原Web此测试属于原型Web操作人，不当作现场员工签收。实际人员名按既有centralFormalName显示，印尼语不混排中文管理身份。

真实读回故障：c04-print-washing-ui-recovery-clear-wait.log保留保存中卡住的红证据；修复后的c04-print-washing-ui-recovery-render-fixed.log完成已保存读回失败的锁定/重新读取/稳定重试，不重复交出，并继续Web实际接收与PDA冷读。首个clear测试在异步处理尚未完成就判失败，DOM已清为0；clear-wait collector等待真实按钮禁用后才进入存储故障，和真实卡住缺陷分开记录。

多批与旧卷归属：c04-print-multi-batch-wrapper-message-fixed.log完整真实两批8+1 Yard/投入11/损耗2，旧Web未关联卷经PDA明确选择批次保存、新补卷经两批选择、语言往返保留选择、两批触摸草稿互不覆盖、退出有真实未提交确认而换人无旧值。已有卷换批被原子拒绝、持久行不变；首个collector误要求错误等于PRINT_wrongBatch，但原仓库会包裹业务错误，诊断证明已拒绝且rowsSame，修正采集并补现有printError已知标记翻译。原补卷漏batchId造成产出6+2只见6的生产校准失败保留；native单批自动归属，多批由新PDA明确选择，已关联卷不可改；旧Web多批无选择的未关联卷仍可由新PDA明确补归属，未擅自猜最后一批。

连续追加：c04-print-washing-batch-production-calibration.log空INPUT草稿旧版本导致交完返回不能录下一批的失败保留；修复仅刷新从未填写的数量/卷数/损耗与原默认印机，实质草稿仍守旧版本。c04-print-washing-batch-empty-draft-dev.log真实先交6再交2后继续投入/印制/转印/新增第二批1，冷事实22.5实收/11用/9产出/8交出/0GTG接收、四卷6/2/0.5/0.5，原单位Yard与实际账号不变。开发诊断计时不作生产正式响应证据。

最终本阶段构建c04-print-washing-continuation-build.log：1400项单元通过，Vite22.59秒。全量tsc仍为19个相同范围外错误，无本阶段文件错误；exactSame=true见c04-print-washing-continuation-typecheck-comparison.json。当前运行资产/103任务代码测试文件指纹见c04-print-washing-continuation-runtime-manifest.json；正式生产预览响应c04-print-washing-continuation-production-performance及summary另记实际结果。旧build/校准/源码/资产身份保留，不覆盖失败。

仍未完成：正式印花交出UI、混合普通/设计改款/洗水owner合单、洗水端新PDA完整操作及最终回方/人工完成、其余工序、两端最终菜单、旧资料显式迁移与整目标治理/收据/发布。既有性能和整目标“不通过”结论不因此改为整体通过；此次无提交、推送、发布、实际打印机或真实工厂业务。

正式响应结果：c04-print-washing-continuation-production-performance-summary.json通过59实际响应家族×5=295样本，最高364ms、pageerror为0；服务48340固定生产资产、320×640、Asia/Jakarta。包括当前接收/加工/卷/标签/判断/送洗/6+2分交、跨回加工新增第二批、多批选卷与返回、实收/仓管只读、历史未知及完工只读。每轮持久回读22.5实收/11用/9产出/8交/0GTG收，四卷6/2/0.5/0.5 Yard；业务localStorage无新项，仅既有有界偏好。开发校准与外部CLI观察不混入正式295样本；相邻旧未变分支沿原身份复用。旧未归属卷补批次有实际功能证据，其专用五样本、更多混合owner及后续洗水端响应仍随整体矩阵完成，不以59家族代替全目标验证。


## C04.07 正式交出PDA实施计划（2026-10-21）

本轮继承完整拆分目标与前阶段冻结，不缩小同厂/同目标组织仓/同单位的多单、多卷及多存储归属合单。先接原createPrintingDispatch/scan/confirm/remove/void及实际独立实收，不复制Web列表/宽表/运输字段。产出内增加正式交出短面板：实际扫码首卷时，在同一个原业务命令中建草稿并记录此次真实扫码；后续兼容卷同事务合入并登记此次扫描。此为真实扫码触发准备动作，不从展示条码自动补扫、不自动交出。正式交出仍以扫齐的实际单据、下游/目标仓、原单位数量和当前账号明确确认，保留原触摸/NO_WASH门禁与收方独立实收。

同单进入已有草稿/交出记录；支持实际原QR/Code128、扫错保输入、重复扫不补新责任、返回/语言/换人。移除或作废原有持久草稿保留对象/数量/释放占用的明确确认，原生UID与历史明细不抹除。来源、SKU和单据分块清晰显示，无手填交出人/接收方或额外通用说明卡。新增print-dispatch-model/view并接print-page/output/receipt，当前各存储writer直接复用；不通过隐藏设计改款/洗水owner来回避真实混合问题。先实际原生与UI验证，并发现/修复必要混合保存，未完成前保持C04.07实施中。


### C04.07 多单实际归属边界修复计划（2026-10-21，实施中）

c04-print-dispatch-mixed-washing-receipt-red.log实际普通单原卷8 Yard与已真实送洗首卷的备货来源余下卷50 Yard合单，原普通单保持中央owner、备货来源保持洗水owner；表面交58，但仅查得8的正式HDR。当前固定洗水印花演示头没有被原runPrintProcessMutation关联PRINT_WORK_ORDER身份，共同交接保存过滤将其丢弃。只认现有六类固定完整身份、原taskId及F090，不按任意前缀放行；原正常/正式生产/设计改款来源保护继续。修复原单动作的绑定与交接头验证，不在新PDA造另一份实收。

同一混合动作沿原runWashingRecordCommand联合事务保留各自owner；增加仅印花调用的可选命令结果/版本保护，使用既有共同命令集合与稳定确认号，在同一次PCS事务提交，用于提交后回读失败的原结果恢复，不让重试重新执行扫码或交出。旧洗水调用不传该参数保持原路径。先验红证据、混合保存quota/冷读/实际收方与稳定重试，再接实际小屏UI。更广的设计改款混合仍属于当前阶段，不以本修复标记全部完成。

本轮前两个构造采集的问题单独保留：强制洗水writer执行首笔来料不是当前实际Web入口，不能当作真实正常路径；仅对未修改的洗水固定种子做NO_WASH后并未产生原单owner，不能冒称已采用洗水记录。改用真实WASH判断→发送第一卷50到GTG→余卷NO_WASH的实际路径后，已确认两个owner及上述HDR缺失。首次handFeel误传SOFT而非原枚举柔软手感被正确拒绝，修正采集值，不改业务枚举或校验。


## C04.07 正式交出UI与普通/洗水联合来源：当前实现及证据

新增print-dispatch-model/view，接入print-page/output-view：同单产出打开交出，第一笔真实扫码同命令创建原草稿并登记实际扫描，后续同厂/唯一下游组织及目标仓/原单位的兼容卷同命令合入。扫描原Code128或PRINTING_OUTPUT_ROLL原单/卷/SKU二维码；扫错、重复、已交出、规格/标签未齐、占用和关闭保护保留。草稿原创建UID、首次扫码UID和最后交出UID分别保留。移除/作废只对原草稿，取消无写入；移除保留卷需按原规则重扫完成本次核对，作废留原历史但释放实物。底部交出按钮明确原单位本次数量，已交完和已作废只读。各账号/工厂/原单/交出单的未提交扫码分别隔离，清空只清输入，返回/语言续填，退出不把已保存的业务草稿当成未保存表单。

原生触摸判断及送洗门禁未取消；原厂不代收方实收。SENT保存原卷快照只补当前真实HDR引用，与Web同义；VOID无实收引用，防止作废后的同卷再交出污染旧草稿记录。本张单按真实唯一HDR求实收，不用整单累计替代。

实际UI证据c04-print-dispatch-ui-recovery-void.log：320×480输入及主按钮可见、ID/中文、原QR、错扫/重复、返回、设备换人、6+2分交、移除取消/重扫、作废取消/释放、quota/已提交读回失败锁定和稳定重读均通过；创建/首次扫描管理员与交出操作员UID分别保留。Web只接第一张6后，PDA第一张实收6、后张待收0，整单6。首次collector的重复变量/旧模块缓存/错误CSS选择器失败原件保留，与已修复的缺HDR引用实际缺陷分开。

真正不同owner通过现有业务构造：PWO-PRINT-001实收25/用10/产出8；固定备货来源先WASH判断并实际SEND首卷50到GTG，余下第二卷50做NO_WASH后和普通单合58给GKP。c04-print-dispatch-mixed-receipt-red及stable-red分别保留原HDR丢失和重复已存merge被PD_changed拒绝的失败。本轮补固定十二身份及原task/F090核对、原动作绑定PRINT_WORK_ORDER，保留正式来源验证；不按任意前缀或显示名称放行。原runWashingRecordCommand仅印花调用传可选命令结果/版本标记，共用既有命令集合，和原两个owner一次PCS事务保存；旧洗水调用不传保持原路径。

c04-print-dispatch-mixed-recovery-web-cold.log：三种集合分别quota均无半套，三类记录由同一个IDBTransaction提交；merge和confirm相同确认号重试不增加行；提交后getAll失败明确已保存，恢复重读不重复交出。两个原单各保持唯一原owner，58由两笔HDR8+50组成，实际UID保留。新冷页同值；Web分别原型登记8和50实收，冷页本单实收58，不把此前给GTG的50当本单实收。此Web操作是隔离原型数据测试，不是现场签收。

原Web直达交出单通过routes-fcs同步render绕过原洗水read准备，导致已持久HDR在Web显示历史关联待补齐。c04-print-dispatch-mixed-web-diagnostic.log复现，routes-fcs的两个直接交出入口现在复用既有withWashingRecords；mixed-web-cold-route-fixed与mixed-recovery-web-cold均实际Web登记/冷读通过。该直接读取修复无保存和普通初始化落种子。

c04-print-dispatch-concurrent-source-records-guard.log在真实records读完成前暂停合入，另一页将50改49并使标签失效，旧扫码被PD_wrongScan拒绝，原草稿仍仅第一卷、49/未打印被保留；现有读取/版本防错成立，未因假设并发问题另建守卫引擎。最初并发collector未限定records对象仓库，保留为单独诊断。

本阶段初版标准build1403单元、Vite23.66秒通过，tsc19原消息exactSame=true仍整体失败。正式生产预览c04-print-dispatch-production-labels-fixed-summary.json覆盖54家族×5=270样本、最高362.1ms、pageerror0，原生22.5实收/10用/8产/8交/下游0 Yard，每轮SENT6、VOID2、SENT2。首次生产采集只打印第一卷，第二卷正确被挡住，保留原日志；补实际第二卷标签预览/打印确认再运行，没有改业务标签校验。打印请求仅浏览器隔离模拟，不代表真机出纸。运行身份c04-print-dispatch-ui-runtime-manifest，108任务代码测试文件/1282资源，不改写成之后版本。

末轮发现PD_changed已有正确阻断，但feedback只识别PW_changed等旧标记，页面要求重新读取却无按钮。stale-reread-red.log真实另一设备合2后旧6按钮复现；本轮只补该标记的原重新读取动作，并对当前共同/洗水记录强制读回。stale-reread-fixed.log保持无写入、当前8 Yard显示与确认、收方待收0通过。新构建/响应单列reread版本，前54家族的正常/扫码/移除/作废/已提交重读等未改路径保留原身份复用，不能冒称重新发生或把两版样本相加当覆盖。

本阶段主代理反向审查11个代码/测试文件，差异见c04-print-dispatch-ui-stage.diff；最初collector对旧归档未包含的原先未改文件误当全新增，保留first-collector.diff，正确差异对这类文件取冻结HEAD原文，实际457行。当前阶段之外的设计改款与其他owner完整合单、最终完单/洗水端、其他工序/第三方、迁移/最终菜单/整目标治理和发布均仍未完成，不生成完整目标完成收据、不标goal complete。


C04.07当前reread版本已完成标准build：1403单元全通过、Vite22.67秒，完整tsc19原消息完全一致（仍失败，不归为本阶段错误）。正式生产预览c04-print-dispatch-reread-production-performance-summary.json通过36响应家族×5=180样本、最高402.5ms、pageerror0；包括真实第二台PDA合2后的旧6按钮拒绝、无写入、可用重新读取、最新8量与明确确认后才交8，独立收0、实际两次扫描。新恢复三个家族最高分别54.3ms、70.2ms、154.2ms。未改的原54家族仍保持初版270样本原身份，两版重叠家族不相加冒称新增覆盖；其正常/移除/作废/提交后恢复契约未变，原证据按EVIDENCE-01保留。

当前运行身份c04-print-dispatch-reread-runtime-manifest：108任务代码测试文件、1282资产，复核均无哈希差异；CodeGraph已同步4444文件。相对上阶段最终审查差异462行/11文件见reread-stage.diff，范围比初版仅新增PD_changed提示的原重读入口与真实记录强制读取。完整任务文件及本阶段原始证据归档见c04-print-dispatch-reread-freeze.json。当前专项是进展记录，设计改款等完整混合、完单/新洗水端、其他工序与第三方、迁移/菜单/整目标收据和发布均继续，不作为完整目标通过或用户接受。


## C04.07 设计改款原来源与完单接续计划（2026-10-21，实施中）

继承完整目标及上一轮115文件冻结，不把普通/洗水合单通过当成设计改款通过。当前Web新设计改款按目标物料SKU冻结花型（并非全部仍要求旧专业成果附件）；来源、BOM、目标SKU/原坯SKU、真实图、唯一最终工厂与收料位置均沿真实生成接口。隔离原生请求使用当前固定来源已有的最终F090/收料位置与真实物料图，通过原ensureProcessWorkOrders生成真实新加工单编号，并由Web原分配/接单、实际仓库发20和审核准备，PDA原实收20/用10/印制8/产出8/实卷打印；没有在PDA补商业接单或自动放行。原始语法、未审核来料不在eligible列表、错选零量无批次占位卷的collector分别保留，修正采集顺序及按实际产出批次选卷，不修改业务校验。

当前native-batch-selected.log成功执行后却显示同一真实设计改款原单在PCS和washing过程行各一份；此为实际缺陷，不能据局部返回passed认定交接已完成。adoptPrint只识别中央owner而未识别原PCS行，因此真实NO_WASH判断复制了原单、任务和节点。先在现有PCS存储hook暴露原规范行的当前版本/稳定id，实际判断只guard该原行，不采用第二份；guard同现有PCS事务提交，读版本仍由现有runtime维护。旧无owner的普通来源及中央已采用来源保持原分支，不迁移或删除现有资料、不新增数据库。随后真实冷页/版本冲突/失败与实际合单必须继续验证。已存在双份的历史资料不在普通读取中擅自清理，按原迁移范围另行处理。

同轮实际前置核查：未在Web接单的设计改款可先实收20，但原native INPUT拒绝，旧中央页面仍可选领料。仅按原始DesignRevision INPUT前置隐藏这一不可用动作，并显示简短当前准备状态；不得泛化为人员身份限制或影响已开始后的其他加工动作，也不增加中央商业接单入口。上游准备完成后恢复原领料。原目标中的设计改款多owner合单、完整洗水端、完工和最终整目标仍实施中，不预填实现证据。


### C04.07 不同原归属合单的一次提交计划（实施前/实施中）

judge-owner-guard.log已证明设计改款20/10/8、NO_WASH仍唯一PCS原行，实际IDB readwrite读取该原行版本，原行值/版本未变，冷页同一判断；不是复制后恰好相等。central-merge-red.log再复现实际普通来源50与真实生成的设计改款8同厂/同最终工厂位置/Yard合入被中央保护挡住，持久数据不变，草稿仍原一卷50。不能取消合单、换成通用页面或采用两份原单避开。

直接改printing-records并新增printing-joint-records：仅当真实目标涉及设计改款，复用原PCS命令；同步业务配方仍写既有四个过程键，限定的临时印花写入上下文保存完整工作值，同时对PCS投影排除已有中央/洗水owner行。PCS原行仍由原codec位置/附件/事务处理。已归属其他现有集合的实际变化带其原id/版本，以原PCS命令的可选附加puts/guards在同一次commitPcsRecords提交；新且未被PCS归属的直接相关行进入现有中央过程集合。没有新数据库、双写、第二次提交、自动迁移/清理、队列或通用状态引擎。

PCS命令接口仅补此实际联写所需的显式行数组、稳定intent与提交后读取范围；附件仍经原transformFiles、引用校验及同库files事务，失败/冲突恢复原缓存；提交后读失败明确已保存而不回滚已持久事实。事务后按原共同/洗水读取入口读真实结果，使用既有命令结果行防重试生成另一张单号。普通未涉及设计改款调用不传此选项保持原路径。修改包含pcs-record-runtime、design-revision-pcs-storage、fabric-washing-storage-bridge，须有真实正常/边界、quota/冲突、稳定重试/读回、冷读、Web收方及原PCS/中央/洗水相邻回归；未获得相应证据前C04.07/C04.12保持实施中。

### C04.07 设计改款原记录、混合交出及接续实证

本阶段实际修改：printing-joint-records仅在目标含实际设计改款单时接入原PCS命令，原PCS、中央、洗水三类过程行保留各自id/collection/version；附加行及原命令结果同一次IDB事务提交。新增getDesignRevisionLedgerGuard/Rows只读取既有规范行与当前版本；runPcsRecordCommand的可选联写参数不改变其他调用。新印花路由、明确重新读取及已提交动作重试可刷新PCS；有实际填写的提交保留原过期版本阻断，不把读取变成自动提交。

实际送洗另外发现SEND仍复制PCS原单，因此fabric-washing-repository在原联合事务里更新已存在PCS行，保留原position/data、附件id及版本，洗水行不再采用第二份。原runtime附件解析将已加载PCS blob URL映回原文件；洗水来源快照也复用该id，避免同一图生成wash-file副本。相关联写完成后重新读取PCS并通知其他标签。原普通中央/洗水分支保持，未授权清理历史重复行；遇到多个owner明确阻断，不静默覆盖。

中央覆盖守卫还存在真实误判：底层PCS原文没有中央覆盖行，原守卫把这一缺少与合并视图里的未变中央行相比，导致普通单加工后新建设计改款失败并报告回退未核实。现在与中央实际owner行作语义比较；修改、删除或恢复已删除行仍拒绝。central-pda-print-owner-boundary单元红绿及三来源脚本中“普通原单先保存、随后原PCS生成设计单”覆盖这一顺序，没有换顺序避开。

证据均在output/playwright/pda-factory-split，保留各原始失败版本：

- c04-print-design-joint-quota-stable-cold：普通50＋真实设计8同组一次交出58；三类写入失败无半套、稳定重试不增交接、冷页20实收/10投入/8产出/8交出与独立收方0。
- c04-print-design-final-factory-receipt-cold：真实HANDOUT来源由原Web确认接收命令登记8，冷页原单实收8、合单实收仅8，另一原单50仍未收。printingCommandOrders对此来源返回空，但原设计改款来源解析正确走PCS；未因推测另加路由或绕过接收。
- c04-print-design-wash-owner-red实际显示两个owner；fixed只剩原PCS。full-lifecycle初版错选零量占位卷被原扫码校验拒绝，roll-selected版本按实际卷走完整送洗、染厂收8/用8/产8/交回8，最终下游仍未收且洗水不能完单。PCS、洗水主单、实际来源一次事务；三类quota回滚、提交后读取故障、同号重试和错误下游阻断、冷页均通过。adjacent-ordinary-wash-lifecycle原普通25/10/8及GTG链路通过。
- c04-print-design-triple-owner-recovery-web-cold首先暴露上述原覆盖守卫问题；修复后boundary-fixed被PD_wrongScan正确拒绝。scan-diagnostic/real-group-inventory确认其中设计单回F090、另两单回GKP，确实不同目标，不能硬合。triple-real-matching-target改选实际同组的生产来源50、真实设计8、补料来源第二卷50，108一次提交；PCS/中央/洗水过程行和命令结果四类quota均无半套，已提交但读回失败可恢复，同号确认不增HDR；三笔Web独立实收后冷页50/8/50一致，各原单owner未变。补料第一卷真实另送GTG50，未算入这张交出单。
- c04-print-design-actual-peer-source-guard原采集器暂停IDB success导致等待超时，不能作为并发通过证据。actual-peer-commit-guard改在原PCS序列化等待处暂停、尚未开启写事务；另一页实际把设计卷8改7并使打印失效，原合单被原记录版本守卫拒绝，草稿保持一卷50，设计卷7及唯一PCS owner保留。
- c04-print-design-wash-attachment-identity早版owner通过但显示同一真实PNG两份文件，附件验收实际失败。identity-fixed仅原文件QA-C04-REAL-PATTERN-PNG，2666204字节，持久业务无data/blob URL；不把文件数量错误藏在局部passed内。cold初版采集器错取不存在的source.output，后续以原source.rootSource的专业附件读取验证。
- c04-print-design-web-ready-ui早版返回仍显示旧准备状态；refresh-ui版本在320×480印尼语页面核实Web准备完成后返回扫码即可进入原领料动作，没有新增中央接单入口。新production-ui-performance真实生产dist五轮20类100样本全通过，最高430.5ms，20/10/8/8/收方0且唯一PCS。pending/confirm两张320×480截图已人工核读，印尼语换行与8 Yard底部主按钮可见。

标准build记录c04-print-design-owner-build：1406单元全通过、Vite22.75秒、退出0；完整tsc仍19个与上一冻结版本相同的范围外错误，未称全量类型通过。当前生产预览相邻36类180样本最高360.7ms、页面错误0，数据与操作脚本原样重放；其复制采集器environment.build沿用了旧文字，原日志不改，summary显式说明实际运行当前dist，资产身份绑定本阶段manifest，不以旧标签冒称原构建。两组重叠动作不累加成全目标覆盖。

本轮完成的是设计改款原归属、混合交出、对应接收及直接送洗原事务核验，C04.07/08/12保持实施中。C04.09印花人工完单入口、完整中央洗水端、其余工序/第三方、迁移/最终菜单、整任务治理/收据/发布继续，未生成整目标完成收据，未更改测试站数据库。

## C04.09 印花人工完单接入计划（实施前）

范围继承完整目标；上一轮原记录阶段是进展，未关闭本项。当前completePrintWorkOrderDocument要求全部产出已交、下游累计实收不少于交出、diff/objection为0，收齐仍不自动完单；Web另填实际完成人。中央PDA复用原判定和命令，以当前真实账号作为完成人，不增加角色提示、商业开工或另一套数量规则。

实施：在原印花域提供同一只读完单判定，原命令复用；可选中央actor保留实际UID并校验其工厂/姓名，不改变旧Web传实际姓名的调用。新增print-completion-model调用现有三来源统一writer，绑定当前数量/状态版本及稳定确认号。执行页的实收查看及无加工动作的页面在满足原条件后提供完单；一张底部确认层展示本单、产出/交出/实收及“完单后只能查看”，不重复确认、不手填账号。取消/返回/切语言不写，提交失败保留、已存读失败继续原稳定重试。

验证：原生未交/部分交出/未实收/分次及多笔实收、当前未决差异、同号重试、quota/读失败、冷入口、伪造账号/异厂/旧版本；普通/设计改款/洗水原归属及原Web命令直接相邻；320×480中印UI、取消无写、完成后接收/加工/改卷/交出不可操作、单内实收仍可查看。按实际变化分组记录每家族5次完整响应；只有相应证据确认后补实际结果，不预填通过。C04.09状态实施中，其余范围继续。

### C04.09 实现与当前技术验证

原域getPrintingDocumentCompletion与completePrintWorkOrderDocument共用printingDocumentCanComplete，原Web数量条件不变。完单actor是可选第三参数：新PDA校验当前原生工厂/账号/姓名并登记manuallyCompletedByUserId及操作日志UID；旧Web实际姓名输入仍可用，不推测其历史UID。projection增加可选字段，旧分厂/接收重置同清此字段；未新增存储键、迁移或第二个可写事实源。

print-completion-model经现有printing-records和设计改款联写保存，绑定当前数量/状态/差异版本及稳定确认号。print-page在实收视图（及无其他加工动作的页面）满足原条件后显示完单主按钮。确认层展示实际产出图、SKU、原单号及产出/交出/实收原单位，说明完成后只能查看；当前账号直接登记，无手填完成人、角色限制或通用数量异常面板。一次最终确认，取消不写；ENT聚焦明确确认按钮。完成后清理本账号本单的内存填写，保留别单；接收、加工、改卷、送洗/交出不可继续，标签/实收保留查看。无UID的旧Web完单显示其原实际姓名，不虚构关联账号，不因印尼语隐藏历史责任人。

以下均为隔离浏览器原生演示操作证据，不代表工厂现场操作或用户接受，目录output/playwright/pda-factory-split：

- completion-unit-red为尚未提供getter的真实失败；unit-model 5项通过，初始0产出不可完单、实际账号/姓名/工厂守卫及原打印前置未放宽。首个native脚本变量重名的collector错误保留，collector-fixed走真实生成设计单、20来料/10投入/8产出、实际交出8，实收3不可完单、补齐8才可；quota失败无半套，错账号/旧版本无写，实际操作工完单UID/日志、同号去重及冷页一致；完成后原加工、加卷、改卷、交出拒绝。
- completion-two-batches-native是实际6＋2两次交出/两笔HDR：第一笔全收6时整单仍未完成，第二笔实际收2后累计8才允许。completion-original-objection-guard实收8但原未决异议1，原Web与新PDA命令均拒绝，记录不变，未增加PDA异议输入。
- completion-committed-read-recovery在原PCS事务complete后阻断读取，明确已保存；恢复与同号重试不再写记录/日志，完单时间和人不变。原Web与新端共同的单据状态仍由原命令更新。
- completion-ordinary-web-real-washing-owner：原普通Web加工产出300全交全收，以旧实际姓名参数正常完单，不补UID；真实WASH判断、SEND300和GTG实际接收300后的原印花单由当前账号完单，原washing过程行归属保持。**原印花完单不等于洗水完单**，GTG洗水单仍未完成；遵循当前Web交接责任，未擅自要求洗水最终下游收到后才能结束原印花。早版ordinary-web-washing-owner只做NO_WASH却假定已取得washing owner，原测试期望错误保留，改用实际SEND/RECEIVE建立所测归属。
- completion-small-screen-ent-ui核实320×480印尼语/中文确认、实际图和8 Yard、取消/ESC不写、清空未提交层后切语言不写、ENT最终确认、完成后只读和退出无空草稿。首版collector在加工视图等待实收页按钮超时；另一版尝试穿过遮罩点顶部语言也超时，均保留，未用force点击掩盖。实际取消后切语言；关闭按钮采用取消/Batal。completion-legacy-name-ui核实旧Web手填的实际姓名在印尼语只读页仍显示；姓名是业务原文，非未翻译的UI文案。
- completion-peer-finisher-ui：另一页实际管理员先完单，当前操作工旧确认被阻断；重新读取为首次完单人，只一条签署日志，不覆盖为第二人。当前production peer五轮也走两台PDA实际页面（各自真实账号偏好，不伪造旧session），相同责任通过。

标准completion-build 1408单元全通过、Vite22.80秒；最后仅完善通用阻断短句/移除未用字典键及旧姓名显示兜底，业务规则/动作/路由不变，保留原构建身份并用final-vite-build重建最终资产。完整类型检查沿用19条范围外失败，不冒称全量通过。production-collector-fixed的12响应家族各5次、60样本最高394.3ms、错误0；peer-production-performance的2家族各5次、10样本最高117.2ms、错误0。冷/刷新、实收切换、开确认/取消、中印、quota拒绝、已存读失败/恢复、完成后查看与真实另一设备先完单/旧页重读分别计量；新阶段完整响应不以函数返回或按钮变化作为完成。末轮T2文案未改变这些已采样分支及完成条件，原样本保留其原资产身份，最终manifest另绑最终字节，不改原日志或冒称重新采样。

本项C04.09技术核验通过，完整拆分目标仍未完成。后续首先接中央洗水单自身的接收/加工/交回/最终实收/完单及现场角色切换，再继续其余中央工序、三方、迁移/菜单和完整目标收据/发布。没有清理用户或历史业务数据，没有测试站写入，没有提交或发布中间业务版本。

末轮连续作业新增反例（此前结果保持原版本）：completion-hardware-return-red暂停真实PCS提交前的序列化等待，按浏览器硬件Back两次返回另一单，原单正确完单但回调把当前另一单切为实收视图。问题在新完单done回调使用了全局当前ui()，非数量或责任串单。本项状态暂回已实现待验证；直接捕获确认时的本单Ui引用，清理仍按本单scope，避免后台结果修改当前别单。继续以另一实际加工单原生接收25/准备花型试样、界面输入3,5但不提交，验证Back续填；自然不暂停的完整响应另测，不把人工等待时长冒充运行性能。

hardware-return-fixed已保留B单3,5且A实际签署正确。首轮自然生产返回五次182.5～200.5ms、表单全保留，但每次均有部位票“正在保存或迁移”pageerror，仍判失败。当前中央路由每次Back都重新发起同一个无参数部位票读取，两次渲染准备重叠触发原读锁；不是完单在写部位票。routes-central-pda仅合并中央入口正在进行的同一次PCS/部位票准备读取，完成或失败后清空promise，后续导航仍重新读。原保存/迁移锁及错误继续保留，不改PartTicket读写器、不跳过事实源、不建设重试队列；补自然五轮和直接中央工序入口核验后再关闭本项。


### C04.09 连续返回最终修正与验证（read-sharing 版本）

上一段路由共用读取的根因假设不完整：return-route-production-performance仍每轮报错。stack诊断确认路由读取还会与保存后ensureSpecialCraftRecords强制读回重叠。删除路由部位票准备会导致warehouse-runtime模块首次导入时“尚未读取”并空页；source-error-diagnostic保留该失败，路由已恢复原顺序，未交付这一无效实现。

最终只在part-ticket-records.hydratePartTicketRecords中让相同输入的正在进行读取共用一个promise；不同snapshot仍拒绝，保存/迁移期间仍拒绝，读取失败清除可用状态且之后可显式重读。未改记录、保存事务、迁移规则或数量；不是跨动作队列或持久缓存。新增part-ticket-read-continuity单元先红后绿，28项直接相关单元通过；原生浏览器两个无参数读取只发起一次getAll、不同snapshot拒绝、records/revision不变且写入0。中央路由最终与上阶段字节一致。

完整read-sharing-build：1409单元通过、Vite22.17秒、退出0；当前完整tsc仍19条，和return-typecheck原输出完全一致。正式生产预览read-sharing-production-performance五次自然确认→Back两次→另一真实单可交互/图片就绪/3,5续填，最高215.9ms，页面错误0；read-sharing-entry-performance四个工序各冷入口/切语言8家族40样本最高466.1ms，页面错误0，320×480无横向溢出。入口校准与正式采样分别保留，早期失败不覆盖。

完成命令、三归属同事务和数量条件未因最后只读并发修正而变化，原生quota/提交后读失败/稳定重试/冷读、多HDR6＋2、未决异议、原Web实际姓名、另一设备先签署和中印ENT证据按原版本复用。final-production-performance 12家族60样本最高394.5ms、final-peer-production-performance 2家族10样本最高116.8ms均为捕获本单Ui及只读并发修正前版本，保留原身份；新返回分支和受影响冷读取/语言分支由本次样本补齐，不把不同版本重叠样本相加冒称覆盖。

主代理最终审查本阶段10个代码/测试文件及3份记录，完整差异绑定c04-print-completion-stage.diff；完单回调只改确认时本单Ui，其他单草稿保留；新字段可选、原Web姓名不变，只有原getter和同一predicate判定，实际当前UID进入原单/操作日志。C04.09恢复已验证，指代理技术验证；C04.07/08/10/11/12及完整拆分仍实施中，不等同用户接受、整体交付或发布。当前源码/资产与阶段增量见c04-print-completion-freeze.json，后续洗水阶段单独记录。


## C04.10～13 继续实施范围（a1000当前代码审查，未预填结果）

本段承接完整拆分及既有印花各阶段。当前原Web getPrintingWarehouseView逐实际接收行/领用行、确认产出包装及原交接记录投影，当前PDA renderPrintWarehouse仍把库位放进Web式“全部”下拉，直接铺物料列表。该实现尚不足以作为真实库区库位验收。

- 待加工仓：读取原工厂真实库区→货架→库位，含空库位/停用状态；物料严格按warehouseId/areaName/shelfNo/locationNo组合显示，不能遗漏货架导致同名库位串位。每实际接收行只出现一次，领用扣原接收余量，不按加工单重复造库存。物料图使用该实际投入SKU。
- 待交出仓：原Web按quantityConfirmed的真实包装展示，保留物理waitHandoverQty、草稿预占reservedQty与availableQty区别。当前原包装仅有warehouseName/outboundArea显示事实，不含真实货架/库位ID，不能把outboundArea冒充具体库位。原记录未定位的包装独立显示“未记录库位”及真实原位置文字；注册库位仍可查看，不把这些包装塞进默认空位。未测量草稿、未定位汇总与实际包装分开，不能把未知量伪报0库存。
- 接收/领用/交出记录：保留准确来源单、SKU、原数量单位、实际经手人/时间与直接下游；发出数量和真实收方实收/未收分别展示。只读关联原接收记录及原handoverRecord，不能用加工单ID充当下游工厂ID、不能按角色推断真实人、不能由发方代实收。
- PDA：固定库区库位/接收记录/交出记录三入口，领用作为接收记录内原有记录视图；就地展开库区/库位，不加管理表格、搜索筛选表单或通用盘点。每组首15条，按当前筛选结果继续查看，空组有简短结果；中印切换保留准确位置ID及原单位，返回详情后仍在同一物位。无仓管写入、新记录、新库或本地业务快照。
- 原Web印花实际投入与加工累计按两位取舍，本轮不照搬染色的不限小数输入，也不更改native单位。先验证真实来源/物位/预占与实收，再检查320×480按键、语言、返回、换人及相关五次响应。
- C04.13为C03共享owner选择的必要相邻修正：真实历史第二笔不因命令结果target误选共同账，精确原ledger/state.workOrders/id继续原owner。普通/PCS/历史、合单与独立实收需要直接相邻回归，不把当前染色通过推广为印花全部通过。

实现目标：print-model只读按真实原单关联，print-view仓管布局和print-page局部物位交互；原Web projection/仓库模型/数量/存储保持业务来源，不新增仓管接收、加工或交出动作。实施及证据待补，完整任务仍未完成。


原Web页面补读：printing/warehouse.ts当前包含逐卷实际长度/原位置、投入卷原码打印，以及pending-receipts?view=stock备料关联入口。故前述“仓管只读”仅限定这一次物位/记录显示补齐，不能冒称仓管所有实际操作都已完成；原码打印和备料关联按其原动作/实际责任及共享余量门禁另行接续，不在新仓管中虚构通用领用/盘点。原待交出建单预占与物理库存必须区别；接收行下每个卷的实际位置优先于父接收行位置。


### C04.14 真实物位与记录（只读显示阶段，a1000任务差异）

当前新增print-warehouse-model读取原Web仓储投影、实际工厂库区货架库位和接收/领用/实收记录。父接收行下分卷优先原卷实际warehouseId/locationId；旧卷未记录位置时独立显示，不继承父位置。待交出按物理waitHandoverQty展示，reserved/available单独呈现；只记录库区的原产出卷不伪造库位。原getPrintingWarehouseView及库存写入没有改动。

原生c04-original-multiroll-fixture通过原PCS设计改款生成→分派→原Web接单→原仓实际两卷发料/审核→PDA接收→实际领料2：两卷各10 Yard，同笔实收放不同真实库位，原卷实际余量8/10，读前后原生记录字节相同。该演示前置通过原API建立，不表示中央PDA增加接单/审批。c04-warehouse-trusted-small-ui在生产构建320×480实际点击库区/库位、查看8/10、双向语言切换、接收/领用/交出记录，保留准确位置与原单位，全部读取业务put为0、pageerror为0、无横向溢出。c04-warehouse-physical-small-ui早期脚本以DOM click调用定位库位及弱选中断言，仅作为早期诊断；以trusted命名的实际Playwright点击和精确选中类核对为准。两个脚本截图独立命名，未覆盖。当前只读版本来源/资产见c04-warehouse-readonly-version.json，不扩大为原码打印/备料分配/整阶段完成。

C04.15扫码反例已用同一真实卷码、另一有效来源复现：c04-scan-next-source-fixture由原登记API建立下一来料；c04-next-source-scan-red实际PDA误报旧卷已收，挡住下一有效来料。源登记规则并不禁止跨来源同码，不能新增全局卷码唯一性。实现只把识别改为实际remainingRolls优先；多个有效来源（即使同一单）必须展示原来源单/批次供选择，不再取第一条；选中后重新核对当前实际来源，原单/来源行/卷码组成的草稿身份不变。新central-pda-print-scan三项契约及接收/两仓相邻共11项通过，生产扫码与恢复还待后续实际走查，不预填完成。


C04.16反例及实现：c04-print-cold-entry-red在真实records.getAll失败后空页并抛PCS读取错误；新入口沿染色同一准备顺序，为印花捕获导入前PCS/部位票读取失败，保留真实账号/工厂、切语言、退出和唯一底部重读，不新增保存后备。c04-print-cold-entry-source-fixed首次开发服务冷载入8秒load等待超时，未到达断言；c04-print-cold-entry-source-settled改为DOM就绪并沿原20秒等待，开发源码分支已通过，不把该重采样冒称性能。原染色入口需直接相邻回归。

c04-photo-keyboard-red实际按Tab后焦点离开图片弹层到body；只在现有弹层增加Tab/Shift+Tab循环、F1不穿透及关闭回到原触发按钮，图片说明改用当前实际图片alt，避免仓管图被叫作另一投入SKU。c04-photo-keyboard-source-fixed开发源码分支通过，生产重建后仍需走查；实际OS原生select/扫码枪不冒称已验。

c04-third-preference-red为三方ID-F021旧偏好进入中央印花仓管，模型正确阻断PRINT_centralOnly但入口未筛选导致空页。入口选择只接受当前主数据active中央工厂，合法空中央工厂保持原ID，过期/三方偏好跳过，仍按当前真实可用中央主数据选初始账号。没有在正常页面增加身份限制提示、没有放开模型/命令的真实账号及工厂校验。新增emptyCentral/third候选单元，生产实际切换待验。

继续发现的未闭合项C04.17：原Web的unlocatedOutputByUnit是“实际完工量减已确认包装量”，不是确定库位库存，不能混进已确认实物卷；新物位视图当前未展示这组待整理产出，也不能据此宣称0库存/全部仓管完成。下一步按原单及原单位展示可识别待整理产出，再接实际原卷码打印和备料分配；不更改原累计量/包装确认条件。


### C04.17 待整理产出及原卷标签实施（未关闭整阶段）

原生c04-pending-output-fixture从原设计改款实收/领料接续实际印制、最终产出1.5 Yard及零数量卷草稿；c04-pending-output-red已复现原物位视图漏掉待整理量。新增pendingOutput沿原Web同一“产出减已确认包装”数量，按实际原单/目标SKU及原单位展示，独立于实物卷/真实库位，不把未知卷数量当0库存。c04-pending-output-fixed在生产构建可识别实际1,5 Yard，入口直达该单产出视图；分页/继续查看单独计数，不联动扩大别组。

原投入卷标签新增print-input-label，按实际接收行和原卷精确key读取，100×70mm及原CODE128保持原Web含义，实收量/当前剩余量分别标明，实际图片/SKU/来源/物位同一对象。仓管就地预览、请求打印/重印；没有产出标签“确认已打印”动作，不写打印状态、领用、接收、库存或操作日志。c04-input-label-small-ui生产320×480实际图片/原码/10实收与8在仓/双语/两个打印请求/关闭回库位通过，button可见，业务put0；打印调用仅在测试中替换iframe内window.print观察请求，不冒称物理打印或现场验收。c04-input-label-image-recovery实际原图请求失败时打印禁用，原图恢复后可再预览打印，未换假图且业务put0。截图独立文件c04-input-label-small-ui-id.png已主代理查看。

最初strict types新增两条quantity可能未知诊断，未隐式用0代替；明确有限正数量才能打印后，c04-input-label-type-comparison回到原19项完全一致。输入/实际两仓/扫码相关14项单元通过；未声称完整TypeScript通过或本轮已重跑全量单元。

C04.17过期标签反例c04-input-label-peer-fixture通过原API多领1 Yard生成7在仓的真实提交后记录，再由隔离同源第二页明确搬运原提交字节（不模拟后端、不把搬运视作真实工厂操作）。c04-input-label-peer-change发现只读页缓存仍允许打印8 Yard旧标签，业务写入0但显示失真。该fixture未发送原PCS跨标签通知，专门覆盖通知不可用边界，不能说它就是完整原生第二页命令。修正仅在原卷打印前显式重读原PCS/共同账/洗水归属，比较原卷身份/实收/在仓/原单位/位置/图/SKU/来源签名；等待期间换人、切语言或离开弹层不再打印旧对象。变更或读失败关闭预览并显示可见重读提示，不写回任何事实。修正后的生产实际复核待补，不能预填通过。

响应证据保留版本身份：c04-warehouse-five-errors-performance原版本55样本中冷启动1135/1188/1122ms，错误0但门禁未过，不能删除或并入通过样本。冷读明细显示原生getAll约0～1.9ms；后续CPU采样c04-cold-warehouse-cpu-diagnostic在新待整理/原码版本根节点444.9ms、两帧487ms，未证明此前波动的唯一根因。该新版本c04-pending-label-five-performance 11家族五轮55样本均≤662ms、页面错误0、0业务put，冷页583/526/662/491/513ms；只证明该版本范围，后续显式重读/扫码新分支仍须单独验，不将功能补齐说成已经证明了性能波动根因。


原卷打印显式重读后：c04-input-label-peer-fresh在通知缺失的原提交记录搬运场景识别8→7，打印请求0、旧预览关闭、实际7 Yard和印尼语重读提示可见，打印页业务put0。c04-input-label-fresh-small-ui初次重采样在第二次异步重读尚未结束就断言打印次数而失败，不能说通过；改为等待每次实际iframe打印调用及两帧，c04-input-label-fresh-five-ui生产5次81/100/98/101/100ms，均实际请求打印并保持原库存、原单位、中印切换、照片及按钮可见，业务put0、pageerror0。截图采用新的fresh-five文件名，不覆盖此前版本。

C04.18新增反例c04-source-document-scan-red：同一原生加工单两个有效来源，先在OTHER来源填2，回列表扫描NEXT原来源单号，旧实现仍选OTHER；selected实际值为QA-C04-OTHER-SOURCE|QA-C04-OTHER-LINE。修正仅接收Tab的原来源码分支：按source.id/documentNo/batchNo保留原行，唯一有效来源直接选择，多个有效行只列原来源/实际SKU/批次，不合并成同一个加工单按钮；无可接收来料不跳至另一来源。选择时重新核对当前剩余，原草稿仍按账号/工厂/原单/来源行/原卷隔离。正常加工单号查询及执行分支沿原行为，不顺手新增执行扫码业务。新独立原来源身份契约及生产续填走查待记录。


C04.18最终当前构建：15项直接单元及engineering渐进检查通过。c04-source-document-batch-settled生产走查来源单号精确选中NEXT、同一批次两个有效源保留原行选择、OTHER与NEXT各自2/3,5续填、已收原来源码拒绝且不偷偷替换当前来源、清空后换语言/退出不出现空草稿确认，业务put0。首版batch-fixed在选择弹层尚未完成关闭时立刻F1，按现有防穿透规则不启动扫码，采集脚本等待扫描框而超时；原失败保留，settled明确等待本次弹层动作完成再按F1，未更改产品规则。c04-source-identity-roll-adjacent当前构建重放卷码歧义、返回、清空、换语言、实际换人、扫错重扫通过。

C04.19当前Web复核发现接收确认差异：原Web pending-receipts save调用confirmFactoryMaterialReceipt，除了实收还核对原上游交出、打印投入SKU/状态、当前真实经手人，并按实际接收合计确认原交出实收。中央印花和染色仅prepare/savePrepared，缺这层业务行为。c04-print-receipt-anchor-red原生同一来源及输入（明确构造原交出引用不存在的边界，不是合法工厂业务）原Web拒绝“原交出记录无法定位”且0写，而中央印花保存了接收记录。不能把直接保存实收当作交接责任已闭环；在requirements-plan-matrix登记C04.19/C03.49后优先接回原确认API，并验证不同owner/失败原子性和真实独立实收。原有合法仓库发料场景证据仍有其范围，不能推广为所有上游工厂交出。

## C04.19～22 接收确认、备料分配与连续来源（a1000 + continuity）

原Web的confirmFactoryMaterialReceipt已在原印花/染色命令事务内调用，保留返回void接口；没有绕过prepare、原状态/投入SKU或实际账号。`c04-print-receipt-anchor-confirm`对原交出引用缺失边界，Web及新PDA均拒绝且记录字节不变。`c04-receipt-confirm-original-multiroll`与`c04-receipt-confirm-dye-two-batch`保留原合法来源分支。

合法跨工序使用当前Web实际design-revision-process-work-order-adapter/port，不用同一通用输入硬套两单：先建DYE原白织带→蓝织带，再建PRINT蓝织带→目标印花织带，各自真实对应图片、原米单位；通过原分派及Web接单建立演示前置，不在中央PDA增加接单。`c04-original-port-dye-print-partial-native`及`c04-original-port-receipt-observed-atomic-cold`：源厂ID-F003_admin两批各投入5、产出4，四笔各交2米，收厂F090_admin每笔分两次各收1米。发出/实收各8米，八条原实收保留独立实际账号/时间，原料余10米，按原完单条件完成。冷页两单各只有一个原owner，没有拷贝加工单。五个实际参与集合逐项注入quota均整笔回滚；成功涉及接收、上游实收、版本/命令的五集合处于同一个原生IDBTransaction。提交后getAll失败有明确已保存，重读同号不再写；源上游实收由原交接头账负责，不伪造另一条加工记录。

保留无效夹具及排除：Print→Print来源违背当前唯一上游；手写STOCK新单的错误生成/冷读不支持；原PCS直接保存已由共同账拥有的来源被原guard拒绝。没有为通过夹具放宽规则或修改通用STOCK创建。早期故障脚本注入不参与本动作的DYE workOrders集合，hit=false且真实接收成功，只是注入目标错误；当前observed故障以实际五参与集合逐一命中。不是曾发现真实事务回滚失效。旧CLI会话过期及未安装chromium通道的失败保留；新专有会话pda-split-c04使用本机Chrome155，未安装浏览器、未操作用户IAB。

备料沿当前Web pending-receipts/stock，实收单位分配本厂同SKU、同上游、未关闭的目标；保留原纱线优先毛织规则。新增print-preparation-model/view和本页短表单，仅选加工单、填本次数量，原接收数量不再入库。`c04-original-preparation-allocation-exact`：8 Yard分2.5/5.5，余0，原接收数保持2，目标累计实收20→28；伪造人/0/负/超量/旧来源版本拒绝，quota无写、提交后读失败同号恢复、冷页原值一致。初版native只匹配中文“变化”，实际PRINT_sourceChanged被正确拒绝却被collector误判为接受，原日志保留，修正的是断言范围。

未绑定加工单的真实PRINT来源另在接收Tab按原来源/原卷点收为备料。原印花固定联合保存适配只扩展无单source标记及其必要直接来源引用：旧PCS/共同账/洗水owner原集合/id/version保留，无第二库存源；原静态未修改全集不采用。`c04-stock-receipt-fault-cold-native`收两个4 Yard原卷再分配，三参与集合各自quota无半笔，已提交后读失败可恢复、接收/分配同号均不重复；`c04-stock-same-roll-race`两原生页同卷竞争一胜一冲突，冷页仅1笔8 Yard、实际F090_admin。接收前置仍原confirm，包括真实账号及原上游引用；没有预填实收或假定整单接收。

真实小屏反例/修复：初版备料Footer出现后遮住数量，且两处返回；保留c04-preparation-small-ui失败，修正只保留一个返回，底栏改变时保持正在填写控件在主按钮上方。`c04-next-source-bin-red`同单OTHER收完10 Yard后，NEXT继承OTHER库位；完成回调现在按捕获的原scope/source/roll生成确有余量的下一卷草稿，只沿用该来源库位，不调用当前路由草稿给另一来源搬运位置。切语言回到当前scope最后填写字段，原数字值/原位置不改、换人清理。仓管选择视图也随明确退出清理，不把前一人的备料面板留给新登录账号。

`c04-next-source-bin-fixed`、`c04-continuity-preparation-ui`、`c04-continuity-next-roll-ui`当前生产构建320×480通过：不同来源不串库位，同来源下一卷数量空/原库位保留，语言后数量仍可见，中印原单位相同，已收卷重扫拒绝，全部分配后无旧数/主保存，实际换人后读原保存事实，无脏空草稿退出提示；截图continuity两张主代理已核查前置版本，最终截图须单独查看后登记。`c04-stock-committed-recovery-small-ui`实际提交后读失败保留本笔，恢复后原接收只写一次（3次原生put），继续原第二卷；`c04-stock-back-at-commit-small-ui`由真实原生事务complete触发浏览器返回，后续重新扫第二卷仍是原来源/原库位、无旧数量或假草稿。

当前`c04-continuous-stock-five-performance`17家族各5次85样本全≤520ms，pageerror0，覆盖冷接收、原卷扫码、选库位、填数量、双向语言、返回续填、两次真实4 Yard实收、仓管和实际2.5 Yard分配。每轮新隔离原生数据库，原图和两帧就绪；不是物理PDA/现场验收。c04-stock-final-units完整1637条通过，engineering范围0错误/全量既有19项仍保留；连续作业仅改本页状态/焦点后engineering再次通过，Vite continuity26.30秒，源码250/资源1331绑定c04-continuity-version及source/asset-manifest。当前仓管相邻五轮及本阶段正式冻结继续补；全目标其他工序/三方/旧路由、迁移、X10/X11和最终审查未关闭，不发布。

当前仓管相邻五轮`c04-continuity-warehouse-five-performance`11家族55次通过，最慢490ms，实际库位/实收/领用/交出记录/双向语言/两仓原照片和两帧，业务put0、pageerror0，无横溢。最终continuity-preparation-id与continuity-next-roll-id截图已主代理查看：原目标加工单/2,5 Yard数量框和主按钮同屏，下一原卷4 Yard的输入/按钮同屏，没有中印混排。最终目标仍未关闭。
