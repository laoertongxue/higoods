# 全项目演示门槛与资料维护入口清理

## 范围、继承与阶段

来源：2026-10-20 用户要求“再全面检查…统一清理，Mock 数据直接展示，已实现的功能直接开放，同时保留必要的业务校验”。继承 AGENTS.md UI-02、STORE-01～05 及上一轮 GTP 成果；起始基准 ecc8af013b5f9d67f5fef14fe5b692483aada61d；合并 main 新提交后基准为 6169496a675799802faee12b274eda39f196247d。T4 跨模块清理，先扫描分类，再实现、专项页面/契约、固定构建性能与最终收据；用户既有 main 合并发布要求继续有效，部署状态另记。

检查全部 src、index.html 的中文控件文案、英文角色/模式键、URL/DOM 参数、维护渲染入口、路由与事件消费者。历史需求、旧审查和历史证据不批量改写；“Mock”“演示数据”事实说明、规则试算场景、实际岗位/账号、业务来源筛选不因包含关键词删除。

## 目标与边界

去掉自选只读/仓管身份、URL/DOM 演示角色和正常业务页的技术维护入口。必要实际操作人、仓属/工厂、状态、数量单位、差异原因/凭证、主管确认、已登录 PDA 的角色和有效性、动态差异授权保留。用户记录、附件、版本与审计不清空，失败不得假成功。

真实旧记录导致的专用恢复仅在实际检测到旧源时提供；无旧数据不显示、不作为 Mock 首读前置。页面上去掉容量/备份/恢复/清理入口不删除底层保护接口。PCS 沿用 EXCEPTION-01，不新增维护UI。

## 实施顺序与事实源

1. 全量检索产品源码、静态脚本/HTML，按真实账号、业务岗位、旧资料恢复、外部回执和伪角色门槛分类；原历史报告与历史驱动保持版本身份。
2. 删除伪角色控件、URL/DOM解析、维护渲染文件与事件分支；普通新浏览器直接进入业务。物料进度主表同时迁至已有标准骨架，不改其详情、原11字段、汇总范围及业务补充区。
3. 原先依赖身份选择的收货、批版转为实际人员和责任确认。普通收货保留仓管角色；超收必须实际主管、原差异资料和二次确认；实际收货人与主管分开记录。批版提交绑定本轮领取人稳定ID和姓名，PPIC动作绑定原任务冻结PPIC。
4. 正常/边界/取消/存储故障/伪造旧事件分别核验，固定构建性能及设备验证；最后整理记录、冻结文件、技术收据、本地main合并、GitHub推送及Caddy发布核验。

| 对象 | 静态/记录源 | 读写入口与关联 | 旧项/本次范围 |
| --- | --- | --- | --- |
| 通用交接及仓库实交 | 既有pda-handover-events / 原正式记录 | PDA明细、物料进度登记实际交付 | 只删fake role；普通静态Mock维持原会话边界，正式来源原守卫不变 |
| LACE实收 | lace-factory-domain既有内存runtime | confirmLaceReceipt → receipt/交出状态/采购SKU与日志 | receivedBy独立保存实际收货人，原主管字段保存超收确认；未扩建持久化层 |
| TMF基础实收 | tmf-material-purchases原操作库 | receiveTmfBaseProduction → 原operation、采购、批次与库存 | 同一原动作增加receivedBy；补齐原production section遗漏的lots字段；本次收货UI等待原事务complete，其他旧提交和自动种子未整体整改 |
| 批版领取及建议 | 原生产来源记录库 | saveProductionSourceUiAction → 样衣状态/建议版本/PPIC反馈 | 去activeRole，命令ID关联实际领取人；保留状态与意见校验 |
| 洗水、后道、换片布 | 原静态记录及原记录库 | 各列表、原业务动作；真实旧源/读取故障恢复 | 删除常驻备份/导入/容量工具；真实失败保留资料，未清空用户数据 |
| 入驻附件 | 原表单内存与原入驻提交 | 实际文件控件 → identityFile元信息 | 删除虚构文件按钮，原文件选择及必填校验保留；不声称新增附件存储能力 |
| 物料列表偏好 | localStorage路由偏好 | /fcs/progress/material:pageSize | 仅10/20/50；不保存当前页或整包业务；异常用默认10 |

## 原子矩阵

来源均为本页“范围、继承与阶段”用户要求（FF-01～29）。确认人：用户确认范围；Codex负责技术核验，不代填用户产品接受。起始基准ecc8af013b5f9d67f5fef14fe5b692483aada61d；整合基准6169496a675799802faee12b274eda39f196247d；实现与证据绑定本轮文件哈希，合并只变提交号时按EVIDENCE-01复用。

| 需求编号 | 原子需求 | 工作包/实际文件或符号 | 自动化验证 | 页面/设备/性能证据位置或不适用理由 | 状态 | 确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- |
| FF-01 | 全产品源码与public脚本/HTML完成扫描分类 | src/index/public；source-inventory | 1405份src/index（含CSS及JSON）与24份public，精确fake gate残留0 | source-inventory.json；历史驱动按版本保留 | 已验证 | Codex/本轮哈希 |
| FF-02 | 12处工具栏及7处动态/弹窗演示身份说明移除 | webbing工具栏/动态弹窗及PMS端头采购表单 | tmf-labels.json、role-business-ui.json及dynamic-identity-display-cleanup.json精确差异 | 纯说明不改变事件/初始化成本，复用原控件行为并做本轮布局观察 | 已验证 | 同上 |
| FF-03 | 交接不再读取URL demoRole | 删除action-permissions；pda-handover-detail | prototype-role-cleanup：URL污染仍直接操作 | role-tests/results.json；固定构建见performance | 已验证 | 同上 |
| FF-04 | 交接不再读取DOM data-demo-role | 同上 | DOM污染无效、负数量阻断 | 同上；保留真实工厂与账号校验 | 已验证 | 同上 |
| FF-05 | 物料实交无需切换只读/仓管 | progress-material handleAction | 实交人、超配量、缺工厂均阻断，原数据不改变 | role-tests/results.json；原未派厂Mock是边界，不冒充成功发料 | 已验证 | 同上 |
| FF-06 | 入驻无虚构身份证快捷入口 | pda-onboarding | 真文件选择回显，空必填继续阻断；旧夹具精确迁移契约 | role-tests/results.json | 已验证 | 同上 |
| FF-07 | 洗水无常驻本地资料工具 | washing/work-orders，删除storage-tools | 旧事件无副作用、新浏览器静态可见 | storage-tests/results.json | 已验证 | 同上 |
| FF-08 | 后道审计无常驻导入导出 | audit-records/storage-notice/main委派 | 原导入/导出事件不处理、不写/不下载 | storage-tests/results.json | 已验证 | 同上 |
| FF-09 | 后道真实旧源/读取错误仍可恢复 | storage-notice及既有记录库 | 取消/事务故障保留原源，成功读回后才清理；读取故障重试 | 同上；正常新浏览器不显示恢复 | 已验证 | 同上 |
| FF-10 | 换片布无本机数据弹窗或handler | replacement-fabric-fei-tickets；删除data-tools | 真实业务列表可达、死入口退役 | storage-tests/results.json | 已验证 | 同上 |
| FF-11 | 换片布真实旧资料交由既有恢复 | needsSourceRecovery/production-context-recovery | 首次及后出现旧源均不覆盖，真实确认后读回 | 同上；不改既有统一恢复主体 | 已验证 | 同上 |
| FF-12 | LACE不用全局身份选择 | wls-accessory-receipts | 普通、少收、多收原因/凭证/主管责任场景 | business-responsibility/results.json | 已验证 | 同上 |
| FF-13 | TMF首读实现已审查并区分UI门槛与存储旧债 | tmf-base-demo/main/原tmf记录路径 | tmf-storage-audit.json、tmf-static-first-read-findings.json | 已无人工种子/角色开关；自动种子依赖存储风险保留，未声称全站静态存储整改 | 已验证 | 同上 |
| FF-14 | 旧控件和事件无可执行旁路 | 删除模块、main精确恢复委派 | 维护伪造事件、死模块不存在、显式消费者清单 | storage-tests/results.json；source-inventory.json | 已验证 | 同上 |
| FF-15 | 真实PDA/工厂/动态授权边界保留 | getWaterHandoverAccess/canPdaFactoryAccessHandoverHead及原后道授权 | 当前真实权限专项及源码语义审查 | real-pda-boundaries-summary.json；独立审查明确守卫保留 | 已验证 | 同上 |
| FF-16 | 本次受影响设备布局与必要图片可用 | 命名业务入口 | 26份固定构建截图，1366×768/1280×720/1024×768及PDA390×844无主体溢出；可见图片均decode成功 | progress-list-integration.json；performance-final-r2原始截图与布局 | 已验证 | 同上 |
| FF-17 | 性能/治理/构建/最终收据闭环 | 本轮明确测试/脚本/记录 | 冻结前产品性能已通过；最终收据按63条明确路径执行，结果另记不参与绑定的交付记录 | performance-final-evidence.json；task-receipt.json；delivery.json补齐本行最终状态 | 已实现待验证 | 同上 |
| FF-18 | 批版动作按状态直接开放 | sample-approval-suggestions | 实名领取及勾选，原领取责任、结构化意见、PPIC反馈 | business-responsibility/results.json | 已验证 | 同上 |
| FF-19 | TMF基础实收不设角色选择 | semi-finished-orders | 原实际交出硬上限、计划不扩、超收真实主管二次确认 | business-responsibility/results.json | 已验证 | 同上 |
| FF-20 | 收货人与主管分别形成责任事实 | 两收货UI；ConfirmLaceReceiptCommand/receiveTmfBaseProduction | LACE2条领域契约、TMF OVR、浏览器双人检查，TMFIDB刷新回读 | receipt-responsibility-fix.json；LACE原内存范围明确 | 已验证 | 同上 |
| FF-21 | 裁床日报不被URL隐藏Mock | cutting-daily-production-report | 默认与includeDemoData=0结果一致 | role-tests/results.json | 已验证 | 同上 |
| FF-22 | 物料主表保留11列、全量统计和筛选并分页 | renderMaterialListView/已有标准组件 | 三项当前浏览器契约、页码与路由偏好 | progress-list-integration/preservation.json；未改baseline | 已验证 | 同上 |
| FF-23 | 无用后道演示模式常量退役 | post-finishing-full-flow | CodeGraph唯一声明且无消费者，删除死常量，原账号名单守卫不动 | source-inventory.json；源码/构建；无新增可操作模式 | 已验证 | 同上 |
| FF-24 | 物料字段原生点击不消费、首次查询不加载整套FCS处理器 | main专用分派；progress-material事件类型边界/既有内容区刷新 | progress-material-event-boundary、真实键盘2产生input/change并持久偏好20，5有效样本 | query-pda-profiles；performance-final-r2 | 已验证 | Codex/本轮哈希 |
| FF-25 | 日报仅生成实际展示派生、精确入口跳过无关采购且完整结果不变 | runtime-projections/report-model；craft-read-entry；marker两个类型签名 | 15组同源结果、4旧报告JSON哈希、下一快照更新；有保存effects完整await、失败重试；改前后完整显示文本SHA相同 | cutting-daily-projection-fix.json；daily-entry-display-equivalence.json；performance-final-r2冷/刷新/站内5轮均<=608ms | 已验证 | 同上 |
| FF-26 | PDA编号链接用所需类型当前候选、无跨动作缓存 | production-object-overview/getProductionObjectLinkIndex；PDA render帧 | 四类全候选/关联/歧义/未知对比7/7；帧finally清理 | pda-links-green-r2.log；performance-final-r2三家族5轮均<=922ms；原cold慢样本保留 | 已验证 | 同上 |
| FF-27 | 本次实收仅在原事务完整保存后成功，批次/采购/交出/操作共同保留 | tmf-material-purchases原production section补lots；原生IDB同库 | business-responsibility：写事务故障输入/原数量不变；刷新库存12米；performance实际保存读回 | 原遗漏失败见performance-tmf-calibration-r2；browser-complete-final、performance-final-r2原生保存/刷新回读；旧singleton的lots也正确读取 | 已验证 | Codex/本轮哈希 |
| FF-28 | 旧实收记录缺失库存批次时不凭计划重建或续收 | receiveTmfBaseProduction既有来源守卫 | tmf-missing-lot-red→tmf-lot-green，原采购/交出/操作/旧源均不变 | 数量守卫不适用新页面，原弹窗显示实际缺失原因 | 已验证 | 同上 |
| FF-29 | 收货资料已变化时拒绝覆盖较新记录 | 原四section在同一个write事务核对observed | browser-complete-final：外部新备注保留，库存/采购仍0，表单输入保留；实际刷新hydrate后收货保留新备注 | 冲突明确提示刷新后重开；tmf-confirmed-save-review闭环；无自动重试/覆盖 | 已验证 | Codex/本轮哈希 |

## 验证口径与异常记录

证据根目录：output/verification/prototype-full-function-cleanup/。源码/harness测试只证明其命名场景；正式性能使用固定dist，冷访问、刷新、站内切换和实际点击分别采样，至少5次，每个有效样本均<=1000ms才通过。实际用户阅读/输入时间不计，提交后系统响应及适用保存回读计入。

首次旧onboarding33项回放（开发服务存在HMR）15通过、9失败、9串行后续未运行；保留onboarding.log，不作当前通过依据。旧水溶Task9三项在fresh服务中均在新页面动作之前失败：旧fixture误用handoverQty或伪造来源收料，与当前领域规则不符，记录于browser-final-r2.log。不为通过旧驱动放松产品规则。旧7份浏览器文件仅替换废弃快捷按钮或URL，prototype-retired-role-fixtures精确字节契约拒绝其余改动；当前直接文件选择与权限边界由本轮独立专项覆盖，不声称旧全流程已通过。

初次独立审查发现LACE/TMF主管覆盖实际收货人的两个P2，已按FF-20修复，原审查者定向复核关闭，见independent-review.json。根代理继续负责完整diff、最终集成与发布。

非范围：真实工厂执行/物理设备、生产数据库写入、真实鉴权服务、全站存储重构、无关模块改版或旧验收脚本重新认证。必要真实旧资料恢复保留；没有清空用户数据。技术验证不代替用户正式接受。

最终技术收据预定 task-receipt.json；提交及Production结果在独立delivery.json记录，避免收据自我绑定变化。

## main 集成记录

保留main的89da9256、3540514b、6169496a三个提交，覆盖后道逐项加工/多次复检、PPIC日报依赖加载及newpda图片优化。本轮与其交叉的7份文件逐处核对；3处冲突保留后道汇总新依赖、真实读取失败恢复、单次渲染处理及PROCESS_DOC精确读取，再叠加本轮退役维护和扩展类型候选。恢复专项原“2次导航”断言按main的防重绘改为0，同时保留迁移结果、用户记录与故障保护所有断言；其他原功能测试未弱化。原性能资产已被main依赖变化替代，合并后重新构建并正式采样。

补充扫描：7处动态操作身份/弹窗文案仅删除被动身份说明（含一处错误的会话来源说明），原操作actor、历史事实、字段及校验完全不改。覆盖semi-finished-orders、output-stock、pending-receipts、version-replan-dialog、work-order-detail、production-demand-dialog与PMS端头采购表单，哈希和精确替换见dynamic-identity-display-cleanup.json。

直接存储补修：实际原生IDB回读发现原splitTmfStateIntoSections漏lots，已在同一既有production section保存该数组，无新增数据库/存储键或事实源。旧记录若有实收而无库存批次，续收明确阻断、保留原源，不倒推或伪造库存。已有完整批次正常读取；44项TMF契约通过，实际刷新验证及最终技术收据另记。

收货保存接口：receiveTmfBaseProduction新增可选waitForSave（默认false保留现有内部Mock调用）；实际收货UI传true并等待。该分支在原4个section同一个事务中核对本次观察值、写入，complete后才发布state；失败不写localStorage，不关闭表单。短事务期间拒绝并行TMF提交，其他旧提交路径保持原行为。无新增存储库、键、队列或通用引擎；只约束本次收货及其直接记录。

固定构建补测：第一次完整5轮保留performance-final(285个有效样本)，CDR有两个冷样本1082.7/1141.5ms未通过；其余数据未缩小。另一个物料下拉箭头问题经空白原生select对照证实为macOS无头采集交互限制；改为原生focus+数字键2，真实keydown/input/change与偏好20均成立，不为采集修改产品交互。CDR在既有精确read-entry中排除无关采购初始化；读取PCS/FCS和已有effects的完整await规则保留，19个相关单元通过。旧/新页面完整读数与最终5轮补测另记。

最终入驻性能调整记录：第二次正式5轮63家族/315有效样本，仅入驻刷新一次1164.3ms失败，其余62家族全部通过；原始失败保留。直接提前renderer方案在浏览器暴露共享处理器的部位票依赖后撤回，performance-onboarding-fixed仅作为失败定位，不用于验收。最终仅在原PMS初始化条件对精确入驻地址排除；PCS/FCS、部位票、来源effects、原router与PDA处理器准备完整保留。10项精确入口契约通过，onboarding-pms-only-red为有效旧行为失败。独立复核已撤回旧方案结论并绑定最终最小修改。

最终性能证据：performance-final-evidence.json合并保留版本的58家族/290样本和入驻最小修改后的5家族/25样本，共63家族/315有效样本，每家族5次，最大921.5ms。复用依据为最后仅变更精确入驻地址的PMS-start条件，其他路径/数据/动作与采集器未修改；不把早期样本重新标为新资产执行。入驻单独5轮最大528.3ms、无采集错误；真实必填阻断与文件选择均计入。旧慢样本和已撤方案失败继续保留。26张固定构建布局记录无主体溢出，可见图片decode成功；主代理抽查8张关键页面（含1280/1024/PDA）确认入口清理及操作可见。

记录冻结约定：本文件的FF-17为冻结时状态；最终技术检查、收据以及全部原子条目的最终状态在不参与收据自身绑定的output/verification/prototype-full-function-cleanup/delivery.json登记，并引用本矩阵稳定编号。最终收据未通过前不合并发布；没有产品接受回执时不代填accepted。

列表核验补充：WLS辅料收货原来已使用标准表格与分页；外层分类的动态三元式无法被现行静态追踪器证明。仅改成5个等价明确分支，wls-category-equivalence.json逐分类执行实际函数并证明输出/调用模式相同，没有更改表格、分页、事件、初始化或数据。列表门禁按全部63路径通过，不修改治理基线。该等价整理不使原WLS/TMF性能行为证据失效；最终20+1浏览器契约再次覆盖相应分类。
