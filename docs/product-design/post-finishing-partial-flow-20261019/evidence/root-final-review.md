# 主代理最终任务差异审查（整合阶段）

日期：2026-10-20。基线为整合后的main ecc8af013b5f9d67f5fef14fe5b692483aada61d；初始核读基线4a0ce9ef的33个核心文件逐行清单保留在调整方案附录，未改写为新版本。对象是本任务全部运行源码、专项脚本、测试及其直接主入口/辅料交叉差异。此记录先记录静态判断，最终运行结果由后续证据及原子矩阵关闭；不是用户业务接受。

## 正向追踪

| 原子范围 | 差异与业务结果 | 核对点 |
| --- | --- | --- |
| PFN-001–006 | QC四项选择，固定相对顺序过滤；来源责任不覆盖实际选择；正数无项直接出货，零通过不建空单 | F/QC完成、冻结项目；QC工作台四项；旧脚本替换只涉及被新需求取代的烫包归类 |
| PFN-007–022/071/072 | 同父单的逐项SKU增量、实际责任与录入分别保存；主管订正保留原记录，不破坏后序和占用 | F进度、数量校验、append/correct；Web责任选择/主管入口；PDA当前身份；原整单setter及通用完成拒绝写入 |
| PFN-023–027 | 一父单一行，四项累计，0/不涉及/历史未知分开，查询与总数一致 | work-orders公共列表/分页；work-order-detail局部表单与refreshTask，不给工序建新批次或纸单 |
| PFN-028–043 | 显式多次交复检，创建即按逐SKU max(expected,actual)占用，退领不释放；一完成复检一出货，各自仓收 | F submit/create/complete/upsert/receive；首张内部ID延续、显示新序号，后续稳定ID；全加工未全部交完/实收时父未闭环；实际为0不完成 |
| PFN-044–052 | 库存、任务、详情、统计、追溯、父卡及具体出货打印读同一事实 | V一次同步快照；statistics实际F/各子单/实收；platform末项F；warehouse所有记录与流水；print-progress与两套模板；不引用通用演示仓替代成衣仓实收 |
| PFN-053–057 | 必要主从、日志、PPIC同PCS事务；失败保留原持久数据及表单；多标签核版本 | R分记录保存/同事务complete后发布、单份回滚、稳定operationId；读取不写种子；main真实blocked失败恢复及PDA未就绪处理器保护 |
| PFN-058–063 | 旧H/N分开，不伪造四项历史，未知分项主管核对；显式迁移、完整附件归档、冲突保护及新旧备份 | R批次转换/原源指纹/读回后清理、F历史承接及候选验证；新记录严格关联/条码/数量，合法旧零行和缺失历史WH/receipt保持未知；当前无正式E对象，按方案10的E=0边界 |
| PFN-064–068 | 独立内存示例、设备图片、性能与有效上游权限 | standalone无业务持久写；对应图片/缩放；性能包含IDB与DOM/图/字/绘制；单一恢复10秒例外；其余1秒；现场实体执行不由Mock代填 |
| PFN-069/070 | 轻量本地原型、完整追踪和发布 | 未增加依赖/后台/云库/通用状态机；72稳定编号与A01–A30未删；全部适用验证后才合并推送main与正式发布回读 |

## 反向差异核对及main整合

- F/R的新字段和读写都是上述逐项事实、多次下游及必要数据保护；没有额外引入加工批次、合单拆单、工序交接或排班。旧单号不被新迁移归一化，人员与历史时间不回填为当前账号。
- V、统计、平台、仓库与打印改动均直接消费父/子数量；数量不是把四项工作量相加当成衣。打印来源按具体出货ID冻结SKU、条码与数量；父卡按所有后续记录展示。
- PDA性能改动只缩短同步读取：primitive摘要、一次同步Map和指定来源过滤；无跨动作长期缓存、库存公式或权限变化。production-object-overview保留完整全局搜索，PROCESS链接仅构建原会被保留的类型。独立非空全对象等价证据与原共享SC基线失败分别保留，不冒称共享全套已通过。
- main新增辅料仓归属是有效现状。本期受管旧材料不再作为PCS第二可写源；混合旧包服装事实继续转换，受管原料只读归档保存来源指纹、Blob与引用。WLS随后独立归档读取原相同来源，后道恢复不改辅料库存；不声称跨数据库原子。
- 整合后的实际反例已定位到旧inline读取过早拒绝、归档scope末尾斜杠漏读；仅修历史引用收集和实际scope，不放宽新写入校验。原失败与绿色结果各有身份。
- 路由重复ensure由adapter统一读取一次；原材料只读保护每次核对共用当前生产身份Set，仍保护原事实，单对象fallback保留。没有缓存旧来源或假就绪。
- 新增测试和专项脚本检查上述规则；旧full/cross/role只替换已被本期需求取代的整单归类，保留回货、QC、授权、错误/重贴、库位和真实图片。main受管辅料使用新逐行和库位分支，旧非受管演示仅在其范围核验。
- 治理补充仅为新增五个精确测试登记实际运行器，先D1再consumer；未知测试继续阻断。证据输出位置可指定/tmp，不改断言、时限或收据完成标准。该变更有真实红色路由契约及绿色专项。
- docs计划/矩阵及审查不互相代替；历史失败、旧1秒恢复报告、旧资产PDF与新运行资产分别保留。没有删历史证据换通过，也没有把source hash追绑到从未运行的旧asset。

## 完成前仍须闭合

本记录静态核对未发现除已登记整合缺口外的确定性遗漏。eb1b阶段main I1–I3共4唯一集成例已有效通过，实际版本与限制见integration-closure；最终新增ecc8af01的直接依赖、UI02责任确认、正式性能、原full/cross、最终治理/收据及72条状态仍须按新版输出关闭；当前不宣称整体完成。最终源码清单与收据存放位置由矩阵和审查记录引用。合并推送及Production SHA回读仅在全部适用验收后执行。

## ecc 新依赖和最后功能分支的实际核对

- UI02移除假身份门槛，数量和状态前提仍有效；订正/历史核对本次明确选择实际主管，原责任、录入和QC限制不变。真实A01代登/未选主管/无原因/合法订正/占用后不可减量均通过。
- 原full的23唯一例（含一例15链cross）已按当前受影响分支分批跑完。cross15链完整汇总通过，QC39检查通过；最后PPIC源恢复两例核所有IDB业务add/put/delete/clear=0；列表四页查询/空/复位完整表内容及仓库overlay均通过。分批不能冒充一次23全绿，最终收据依旧要求完整组合。
- localStorage禁用的原真实QC失败在F/persist无条件重新读辅料归属。完整材料字节未变时本命令无材料写入，无须重读；有变动仍实时核对原managed baseline，未知来源继续拒绝。最小2unit有真实red/green，当前QC39与main原纯材料guard已通过。
- PFN045追加真实D1同库位100/100/800三来源DOM及持久ID，库存聚合1000/0/1000、抽屉三明细与来源均通过，不以存在页面冒充来源完整。
- 空材料短路仅移后计算，实测1226.5ms仍失败；后续profile明确重栈在F安装bridge。下一项保守候选覆盖seed/live及有效保存prep旧单号别名，独立审查识别并补齐别名边界。来源sticky失败/LS结构校验仍在候选之前；只省不可能属于本次材料的无关投影，不缓存身份。已有4集成和2main原非空/guard通过，新增候选unit、新资产与性能仍须绑定实际结果。

retained-checks/ecc-empty-material-green和candidate-ownership-green为上述两个源码版本的独立实际回放，不合并计数或将原慢结果改成通过。

## 第16节只读投影的整合复核

主代理逐行核对F的完整getter true分支保留原四项／SKU／登记clone及H/N/max占用表达式，primitive摘要只省不使用的明细复制。V全部读取字段逐项映射；PDA同render共享不跨render缓存。11个公开命令阶段的完整任务列表、单加工单、ID／No／来源点查及完整progress共1929647字节原／新deepEqual（SHA f8a4ae47f5db4b04b6867a79b5cac16f11db9dd96850acf1b051f6bd95787898），实际脚本、旧hook、原／新JSON、日志、当前源与manifest在retained-checks/task-projection-equivalence。数量摘要另5unit、18阶段及108组筛选隔离通过；不替代浏览器与性能。

SC专项保留首次缺8组盘扣中间仓记录的真实红证，首次后道来源构造捕获原四类upsert参数，普通入口按原序完整补齐。主代理补查reset和直接restore旧批次边界；专用来源getter只有F/V的正式来源适配消费者（CodeGraph callers及直接实现已核对），其未使用warehouseLinks时点差异不冒称整个source字节等价。正式输出、其他source字段及随后普通完整任务／全部仓仍须精确对照；原普通list／projectFinal和裁床函数体不改。新共享依赖进入范围类型、统一构建与最终浏览器／正式性能，不依旧版本通过状态替代。

## 第17节席位源与退役范围审查

主代理核对席位仅替换原完整列表find后读取的同一primitive，精确ID／code及数组顺序保留，原toPositiveInteger／fallback／sourceLabel未变；工厂load／upsert的完整规范化和能力冲突校验未改。原／新fresh公开输出包含41工厂、11评级、81查询身份、2592派单决策及532结算来源，共5148750字节deepEqual（SHA db18195f6d911b22dda5636ab0790b6f6f1dc72c242657fe7b59939af4aa37fc）；脚本、旧hook、JSON与源manifest在retained-checks/factory-seat-equivalence。此为语义对照，不把Node耗时充产品响应证据。

SC补充退役过滤严格复用原四套ownIds，不扩原退役谓词；active capture原地删除，避免finally继续追加旧local数组，deferred同步过滤，位置在原仓快照之前。真实WOOL隔离旧纸样元数据red导致8张退役任务的实体复活6/1/5/6，修复后同输入均0，原五对及新退役一对共12fresh全部通过；实际unit仍是1唯一例，不按子进程加总。后续范围类型、构建与浏览器／性能绑定新资产。

## 第18节同次读取的独立复核

R一次分组保持merged Map覆盖／删除／新增插入顺序，仍按种子Object.keys重建数组及标量items[0]，未知集合未新增，事务与rollback未改。F copyDetails=false仅在内部严格validator使用且同步只读，公开getter继续默认clone；V每child一行primitive保留状态／日期／张数／数量，完整WorkOrder仍读全记录。独立只读复核未发现确定遗漏。新summary unit原5＋新1共6通过，19个子单阶段／93过滤对比；主代理11状态1929647字节F/V旧新deepEqual。实际C3浏览器25负例全部拒绝且原数据不变、合法订正控制通过，见retained-checks/grouped-hydration-browser。源码新构建和正式性能继续按实际输出关闭，旧1024.8ms失败不改写。

## 第19节加工单列表辅料复用复核

主代理核对Map只存在于一次renderPostFinishingWorkOrdersPage调用，键为原精确productionOrderNo，首次读取仍在同一行构造时点，结果仅供只读列使用；没有跨渲染缓存、生产单别名合并、筛选提前或异常捕获。弹窗原读取不改。102张父单由公开回货/确认/QC命令建立，2张生产单；受控只读bridge的8种页面完整HTML原新1237587字节一致，SHA a6b5c97f157ef867bb62f8667f4a6f0fdddd0117f1a190101e44fb49dd03f2ee；原每次102调用，新每次2调用，来源变更下一次可见，失读继续抛出。实际脚本/输入构造/旧源/原新HTML/红绿断言在retained-checks/work-orders-readiness-equivalence与work-orders-readiness-before。受控bridge不证明真实WLS、浏览器持久或性能。原D10列表查询1898.3ms有效失败保留，新资产后按原完整终点重验。

## 第20节通用后道打印适配复核

loadPrintAdapter新增两种后道出货documentType专用分支，直接引用registry原四函数，原sourceType不匹配文字保持。渲染器接收本分支原builder同步构建的同一完整文档；其他分支/registry、后道独立持久ensure、图片绑定、toolbar/纸张/样式均未修改。22个公开领域来源的完整PrintDocument+HTML原新11865166字节一致（SHA95988686f93e2880c662cd026c25df2d60748272d613e93f8a4c3040c8fc8cb2），12错误来源及2缺失来源单拒绝；证据retained-checks/generic-print-adapter-equivalence。仍须实际新版generic冷载、内容/几何/PDF与最终完整组合/性能，不由Node原新等价关闭。

## 第21节交接选择器复核

按实际CPU将listHeadsSorted与listPostFinishingHeadsSorted的同步只读选择放到clone前；公开选择器仍采用同一纯字段谓词。readFormal、所有来源/简单裁片接收构造、原工厂可访问判断、taskIds、第一次lastRecord/completed时间排序、完成列表第二次completed时间排序和structuredClone保持。filter与原稳定纯时间排序在保留行上的次序相同；不写内部heads，不暴露引用，不加跨动作缓存。原完整无参getter不传predicate。公开命令11状态/187工厂组合/1914全量head，完整原新结果7333894字节一致（SHAe1e3df830742207385e2dbec4fc928a3571107b68ec9f381416e16792e1a0e0b），pickup/handout/byType逐一对照原全量getter筛选oracle、修改返回值不污染源，F090完整待办及计数也相同。retained-checks/handover-selector-equivalence保存脚本/原新JSON/源/日志/manifest；不以Node耗时或profile941.7替代正常cold1020.8失败。新实际校准及正式仍待执行。

第21节独立只读复核对照原source及当前diff，未发现排序/工厂范围/返回隔离阻断问题；private谓词只读primitive，build来源未裁剪。第22节属于collector适用性错误，精确diff只有POST_ORDER factory断言条件；方案5.6未要求给原父卡增工厂栏，原POST_ORDER metadata没有该栏。工厂不是印错值，而是该模板无此字段。原actual报错保留，不补造原DOM；其他identity/SKU/图片/分项/全部子单/可交/条码/geometry断言继续，出货及QC工厂断言均保持。生产asset不变、node syntax通过；后续新打印和正式样本另行验。

第23/24节继续核对extra QC采集适用性：固定QC行同时有其自身ID/No与下游post ID/No，expected改精确按type选择，不再OR优先取错。原pure fixture red/green、3未知ID拒绝在extra-print-qc-identity-before。QC根data-print-document-no与CODE128 bar值才是原打印单号呈现，原SVG没有单号正文；第24节按明确master/detail根精确匹配并保持真实barcode与productionNo正文核对，其他类型不变。两个模板的工厂、款、价格、6辅料图/5尺码及明细SKU列/已检量的其余断言已逐一核读。原invalid始终保留，无原body时不造DOM证据；新actual通过及正式520未执行前不关闭。产品asset仍stage21不变，harness b943e1e07f205da5b8ef20e444c4d558c2e1c60a6e3bc12bca1df30ef6515d93，manifest6f24d7db9b6a5c59ba0b6a723048831cf371f70b57d63fdccb9df2e09b85fa30。

## 第25节打印入口依赖复核

原正式第382个GENERIC_BARCODE100冷开1008.4ms有效失败，不因此前381个通过或新诊断935.3改写。100标签build实际4.502ms而采购顶层初始化分支更大，故未顺手改变SKU档案fallback。print-preview只移除三个仅FEI使用的顶层导入，延迟到原FEI动作/补打来源条件内；await严格短路，保存仍原同步callback、complete后才打印。新增import拒绝仍在原保存catch内，precheck自身拒绝仍位于render本地try前，独立审查无确定阻断但不声称所有加载错误都显示本地反馈。完整后道22文档/HTML 11865166字节及全部错误源等价，当前范围type0、build1335/1335、Vite23.68，独立review与日志在retained-checks/print-fei-entry-equivalence。实际固定D10正式采样及相邻FEI浏览器回归另行关闭。

## 第26节main打印入口范围复核

第25节真实1066.6ms失败及990.7诊断保留，CDP三个PMS模块均从main startPmsInitialization发起，print-preview晚499ms，请求证据与actual生成源在final-fei-entry-profile-generic1000。第25节FEI改动完全撤回，当前print-preview与print-fei-entry-before字节相同（main改动不改变模板），不把该历史尝试作为最终功能。main只在两个原postFinishingEntry的精确/fcs/print/preview判断内，将新出货单/条码documentType与原QC类型并列；无模糊sourceId或路径前缀扩展。sourceEffects非null的恢复条件、productionContext/PCS/部位票/裁床持久读取、PMS其他路径和后续导航均未修改。main scope type0（19个既有错误范围外）；完整build和实际打印校准/正式仍待结果。

第26节独立只读复核已完成：两个精确type数组仅新增原出货/条码，非null effects分支和后续导航未改变，无确定阻断。main类型0；1335/1335/build exit0、Vite22.97见post-print-main-entry-build。新校准1000条码779.9/PDF346.7、extra三cold630.0/611.9/606.0，内容/媒体几何/图片/字体均有效，完整actual assets没有三个采购模块。最终正式批次正在进行，不据校准关闭PFN067。

## 第27/28节范围及完整性复核

任务总览实际1214.5ms为有效失败。CPU readiness373.047（含adapter332.992/完整source308.910，内有DYE126/printing92）是主要额外分支，不将两轮trace约74全部当根因。WLS callback只新增原即时managed(no)核对；false返回undefined，F继续原调拨/冻结装扣子/旧责任判断，不是applicable:false。true继续原完整prepare/历史归档/当前调拨/实收；candidate原sticky/LS/库存完整性抛错保持。主代理147实际query原新25816字节精确等价（SHA83998f6586f5f60d1e96091eaf16a93d9da9a9d073a97c3a95098c349e0f94e5），实际21非空来源/保存No别名/liveNo/原Ffallback/unknown/空/损坏sticky恢复；独立只读无确定阻断，8身份unit全过。窄Node helper的空PCS来源夹具不证明浏览器事务或真仓操作。

主代理已逐行检查工具4文件diff，16MiB有界Git输出、32KiB长命令使用同冻结base完整worktree；正常短paths及逗号拒绝保持。真实临时Git仓3red→63针对性green，原始6916路径/6847docs完整覆盖、0排除/61byte命令，343全workflow green。原目录新增路径导致一次旧快照严格相等失败保留，不误当数据丢失。工具只影响检查执行，不进入产品bundle；相关源码和直接测试进入71文件source-manifest。

最终新统一build1335/1335/Vite22.91、WLS范围类型0。新manifest dc1cf7a7102d3047f77b863e22ddeab8cd8975c9f6467a1c7e74234437f0ffde，dist index50e3d3f169f274697c3efb575cba166dc98eb71da15c520aaa147f0685177c4e。当前真实校准/正式及最终51组合另以对应新报告关闭，不据静态/Node/构建代填性能。

## 第29节开发采集端点复核

原trace确认详情实际绘制早于控制端可见断言结算，不能按原控制端值追改通过。测试新observer在导航时钟0起算，原F/R/PCS全量读回、5笔持久记录逐条一致、图片decode/字体、两帧及同一连接详情的祖先可见性开始和最终核对全部纳入；控制端toBeVisible独立保留。独立审查首次指出缺少可见性，已修复并第二次静态关闭，源4ca8c90c。原同配置专项1通过，五保存74.1–89.1ms/五刷新597.9–614.5ms，见development-browser-endpoint-visible；诊断副本关闭trace/video仅诊断。门槛和canonical b943不改。新manifest e86032be3b9abb802fe3212f523c994d5b8b7cd4eaa2f4cd6339ec16631fc4cf，产品dist index50e3及全部1222资产与第27节相同；只B6对应证据失效/重验，最终51和100/520仍按实际结果关闭。

## 第30节共享辅料导航复核

原最终补充组17通过后，legacy辅料查询因订阅与外层同时prepare而production busy/sticky失败；保留完整trace/截图/video/17通过4未运行原结果。主代理核对两个实际错误堆栈、scan成功navigate及confirm成功refresh路径与appStore订阅，main helper仅扩精确共享handover/前或后非空materialOrderNo且真实路径变化。独立静态审查三调用、错误不导航、取消/权限/受管原局部替换无阻断，main新SHA8906f8744cef7d07fb6eac8f0c37cf20fd44d4502bb56666b5850873342af8f4。原失败角色单例同配置1/1通过，原数量/整单/图片/4库存行495PCS来源全保留，证据material-navigation-green；不是单动作1秒证据。类型范围0，新构建/最终51、核心正式100/520及相邻3×5性能仍各自关闭。

## 第31/32节夹具及完整导航边界复核

R5原goto仅等document load，page.evaluate早于WLS bridge安装；补实际辅料标题可见/原5卡片再原公开入库命令，原保护及所有覆盖/库存断言不删，最小1/1通过。其后补充组前21通过，最后管理员从共享handover进入自助回货同一双render错误，原trace在shared-self-return-navigation-before。main helper原正则及精确自助回货判断用于前/后任一；路径不变仍不能skip，materialOrderNo gate保持，处理器始终先执行。独立静态无阻断，原完整role8真实8/8通过（30.6秒），见shared-navigation-role-green；本次main SHA4c6ab992d6d122ca17dbd5321a126db32353da60ed78806c909522c3f7db929c。其余已有静态/领域原新等价不变；最新统一构建、最终51和核心100/520/追加25另按结果关闭。

## 第32节最终功能组合实际结果

最终main4c6ab992/source-manifest47dfd8b4/dist indexc36aad4a：构建1335/1335、main范围类型0（19旧错误范围外）；同一冻结源码partial6→补充22→原full/cross23连续全部通过，0失败/跳过/重试，51唯一。其中原23含15条跨端完整链；新增/补充28包含main I1–I4与M6/M7真实受阻升级恢复。实际日志/SHA/持久D1/截图与cross JSON在final-current-browser/summary.json，不继承旧功能运行。主代理已逐项复核72及A01–A30编号覆盖并沿用此前完整业务diff审查；新main/helper及B6/R5测试对应审查、红绿全部有独立版本证据。核心正式100/520、相邻25、PDF及治理/收据仍待分别闭合，当前不宣布完整交付。

## 最终证据映射只读复核

性能独占窗口内，现有1名独立只读审查核对72PFN、A01–A30与final-current-browser小JSON，未运行Node/浏览器/构建或新增取证。51=23原/28新增补充、38本任务unit/1335构建、19范围外旧类型错误、性能/PDF/治理/收据pending口径一致。发现矩阵将dc1/index50e3旧候选仍称最终、SC符号误写、开发旧端口43197未区分当前43915三处文字残留；主代理已修正历史身份、补第5节47df/c36及B6/R5/main两端绑定，并用CodeGraph精确核实SC当前符号listPostFinishingSpecialCraftTaskOrderSources:3037。只改文档，不使当前性能源/资产失效。方案的detached与第3节“当前问题”也明确为核读基线，本文冻结时发布尚待执行，避免历史事实冒充最新。

## 33. 实际PDF媒体与纸型采集修正

主代理未按旧report机器passed直接关闭PDF需求。实际Pypdf核读显示第32节PDF带屏幕工具栏，五类1000页数为1/42/112/2/108，而print媒体DOM检查虽正确，结束却显式screen覆盖后调用page.pdf。只改checkPrintPage恢复media:null，再校准1000通用条码：1000页，cold686.7ms/PDF604.6ms，但实际纸型842.88×595.92pt仍A4横向，不符合既有40×30mm CSS。第二处只补page.pdf的preferCSSPageSize:true。修正无产品源码/运行资产变化，不改变PDF计时起止、1秒、1000标签或来源。

当前源清单42371a41432433e33860a71a8401b5c3bcf7ec0782aa1337d7ccd041e9dd80ac，collector36685ba3face8530284be6a2411b093f7968b45034186c10ca047d6e33c90d14，index仍c36aad4a。第二轮校准cold694.2ms/PDF623.0ms，PDF1000页，实际113.04×84.96pt（约39.878×29.972mm，Chromium取整），主代理实际Poppler渲染首标签并查看条码、SKU、日期、SPU均完整且无工具栏。校准不替代50个正式PDF及全量质量。独立PDA代理静态核对Playwright null→CDP无媒体覆盖，最小两处修法成立；原470非PDF结果及51功能保留原身份与明确继承依据，旧50屏幕PDF不进入最终有效核心计数。

旧470非PDF的业务、动作、存储、分页和打印cold测量端点均在该媒体恢复之前或独立函数，不读取新增PDF选项。产品1222dist及另外70源码/验证文件未变；按EVIDENCE-01复用原47df/indexc36实际结果，保持原report、脚本及PDF字节不改。正式50、相邻25与extra3仍待真实完成；最终组合将逐family绑定两个实际报告，不能将旧report的整体passed等同于最终质量通过。

第33节实际正式补验已完成：新打印20家族100样本（50cold复验＋50实际PDF），0错误，全部内容/打印媒体几何有效，整体max803.0ms、PDFmax617.0ms。最终核心只取新50PDF替换旧50，50cold不重复计数。主代理对10类首轮PDF和当前7份消费者PDF共17文档1245页完成新取证：50份实际文件每页纸型/业务文本一致，唯一允许差为明确标记的实际打印时间；小标签100/1000页与每SKU20/200份完整，40×30mm纸型；全部A4页已渲染、逐页contact核版式，5款小标签和代表页放大核读。5真实照片、条码/序号、父卡三次复检/出货和4页布局均无截断/错图/工具栏。详见final-print-quality/actual-pdf-audit.json、root-visual-review.json与PNG/contacts。

导出QA本身曾把ContentStream布尔值误作内容存在性，资源比较也不能据相同外层流判五种标签；已改is not None并核递归资源、每页实际文字/纸型，原两次诊断保留在retained-checks/pdf-audit-stream-only-before。实际绘图资源精确相等未建立，明确不继承旧视觉或假称40份精确等图。业务文本只规范化“打印时间：实际年月日时分秒”，原始PDF和差异均保留；源业务创建/完成时间不规范化。该阶段最终质量采用实际本版内容/几何与新鲜渲染，extra3当时待完成；主代理后续已实际查看全部4页并通过，见本节最终收束及extra3-actual-audit.json。

最终收束：主代理独立回溯核心100家族/520样本的每一原始行/报告SHA，毫秒/通过/序次一致且无重复；相邻25原生持久proof全部有效；71源与1222dist当前全量SHA实核0差异。extra3实际4页已全部渲染并查看，父卡10复检/10出货、SKU表跨页/末行、QC图料/尺码/数量均完整，20代表PDF1249页质量已关闭。两项完整worktree治理实际exit0，日志retained-checks/final-governance，矩阵72条/A01–A30技术验证关闭。技术收据与main发布仍待执行，明确在冻结绑定文件后以独立交付记录报告实际状态。

最终独立文档/证据核对由web_partial_flow只读完成：72/30编号、51与38/1335口径、470＋50核心100/520、独立5/25、865/5818时限、20/1249及源47df→42371的仅采集器继承均一致。唯一发现为派生组合中的extra3 visualReview仍待及审查阶段待办表述，主代理已改为实际passed的extra3-actual-audit及其SHA，历史原始report/artifacts保持原样；该发现已关闭，无新增运行改动。

最终发布前只读敏感值扫描对实际任务差异4481文本文件/1239181335字节完成，环境密钥值及凭据特征匹配0；报告/tmp/post-finishing-partial-flow-20261019/pre-release-secret-scan-final.json。路径范围7945项全部落在已审源清单/README/architecture/四文档/专用证据目录，没有无关改动；最大单文件72734722字节，没有GitHub100MiB上限文件。原stash保留，主工作树main及GitHub main此时仍为ecc8af01。后续不再改绑定文件，先提交/收据，再合并推送并核验exact SHA发布。
