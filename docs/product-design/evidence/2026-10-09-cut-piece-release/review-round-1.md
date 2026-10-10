# 第一轮逐项对抗审查结果

**结论：88 / 88 通过。** 本地原型实现验证，不声明远端发布或用户最终接受。

| 需求 | 主动反例 | 结果 | 证据 |
| --- | --- | --- | --- |
| SCOPE-001 | 把原型扩展为真实云端多用户库存或改无关模块 | 通过 | storage-browser.json, migration-browser.json, backup-restore-browser.json |
| MENU-001 | 遍历树同时在裁后处理和仓库出现放行菜单 | 通过 | ui-browser.json |
| MENU-002 | 直接输入旧放行URL，不先访问任何上游 | 通过 | ui-browser.json |
| SOURCE-001 | 已裁100但票未装袋，不能直接得C/K100 | 通过 | receipt-browser.json, ui-browser.json, storage-browser.json |
| SOURCE-002 | 手动唛架票无铺布但有效装袋，不能漏入或造铺布号 | 通过 | receipt-browser.json, ui-browser.json, storage-browser.json |
| SOURCE-003 | 同票ID错票号、错成衣色码、不同BOM、错左右实例 | 通过 | receipt-browser.json, ui-browser.json, storage-browser.json |
| SOURCE-004 | 同票连续换袋、交出后再读，不能多计或使累计K减去交出 | 通过 | receipt-browser.json, ui-browser.json, storage-browser.json |
| VALID-001 | 给单票剔除3片，检查是否错误暴露局部数量入口 | 通过 | receipt-browser.json, ui-browser.json, storage-browser.json |
| VALID-002 | 整票不可用后原袋及后续交出不能借旧状态通过 | 通过 | receipt-browser.json, ui-browser.json, storage-browser.json |
| VALID-003 | 不可用后恢复，原打印100/旧A100/旧交出80不能被重写 | 通过 | receipt-browser.json, ui-browser.json, storage-browser.json |
| BAG-001 | 普通票和绣花票同袋，扫描和提交都拒绝 | 通过 | receipt-browser.json, ui-browser.json, storage-browser.json |
| BAG-002 | 烫画→绣花与绣花→烫画同袋，不能仅比工艺名集合 | 通过 | receipt-browser.json, ui-browser.json, storage-browser.json |
| BAG-003 | 同票第二袋、重试、旧cycle实物占用不能再累加 | 通过 | receipt-browser.json, ui-browser.json, storage-browser.json |
| CRAFT-001 | 前片需工艺而后片无需，不能成衣级无差别套用 | 通过 | receipt-browser.json, ui-browser.json, ordinary-final-v48.json |
| CRAFT-002 | 3道顺序100→95→90→80，不能截成2道 | 通过 | receipt-browser.json, ui-browser.json, ordinary-final-v48.json |
| CRAFT-003 | 第一回仓95后尚需绣花，K不能95 | 通过 | receipt-browser.json, ui-browser.json, supplement-browser.json |
| CRAFT-004 | 最后加工68但未回裁床仓，P68/E0 | 通过 | receipt-browser.json, ui-browser.json, supplement-browser.json |
| CRAFT-005 | 未加工退回或旧实收缺完成依据，P保留而E不得计入 | 通过 | receipt-browser.json, ui-browser.json, supplement-browser.json |
| CRAFT-006 | 部位要求缺失，不能当普通票或默认单耗1 | 通过 | receipt-browser.json, ui-browser.json, supplement-browser.json |
| CRAFT-007 | 100片3道不能展示需300/已240片 | 通过 | receipt-browser.json, ui-browser.json, dispatch-browser.json |
| CRAFT-008 | 区分待加工、待回仓、已最终回仓和数量差异 | 通过 | receipt-browser.json, ui-browser.json, dispatch-browser.json |
| RECEIPT-001 | 60/40两票实际58/35，逐票记录不能60/40 | 通过 | receipt-browser.json, ui-browser.json, dispatch-browser.json |
| RECEIPT-002 | 输入总93或比例分摊，拒绝把缺明细当完整实收 | 通过 | receipt-browser.json, ui-browser.json, dispatch-browser.json |
| RECEIPT-003 | 烫画来源被选成绣花、错承接厂、错票或cycle | 通过 | receipt-browser.json, ui-browser.json, dispatch-browser.json |
| RECEIPT-004 | 空白、负数、NaN、小数、超安全整数和显式零 | 通过 | receipt-browser.json, ui-browser.json, dispatch-browser.json |
| RECEIPT-005 | 应回60实收61拒绝；58或0必须填写差异说明 | 通过 | receipt-browser.json, ui-browser.json, dispatch-browser.json |
| RECEIPT-006 | 原90更正89再重试，不能相加179或多建版本 | 通过 | receipt-browser.json, ui-browser.json, storage-browser.json |
| RECEIPT-007 | Web回仓后PDA直达及反向回读相同逐票实收 | 通过 | receipt-browser.json, dispatch-browser.json, supplement-browser.json |
| QTY-001 | 已装袋100等待工艺：C100/K0不能混同 | 通过 | ui-browser.json, supplement-browser.json, receipt-browser.json |
| QTY-002 | 95片单耗2只得47件 | 通过 | ui-browser.json, supplement-browser.json, receipt-browser.json |
| QTY-003 | 前/后/袖与主辅材料按短板取min，不跨Black/White | 通过 | ui-browser.json, supplement-browser.json, receipt-browser.json |
| QTY-004 | 左100右0不能拿左200补右 | 通过 | receipt-browser.json, ui-browser.json, storage-browser.json |
| QTY-005 | 无SKU、已知零、缺资料null不能全渲染0 | 通过 | ui-browser.json, supplement-browser.json, receipt-browser.json |
| QTY-006 | P100/E0等待工艺时不能自动开补裁100 | 通过 | ui-browser.json, supplement-browser.json, receipt-browser.json |
| TARGET-001 | 同色码材料C100/C90只能选候选，禁止自由写95 | 通过 | ui-browser.json, supplement-browser.json, receipt-browser.json |
| TARGET-002 | 保存T100后实物90刷新仍T100 | 通过 | ui-browser.json, dispatch-browser.json, storage-browser.json |
| TARGET-003 | 重选选90取消仍旧T，确认才新快照 | 通过 | ui-browser.json, dispatch-browser.json, storage-browser.json |
| RELEASE-001 | K90/T100人工A100并原因可风险放行 | 通过 | ui-browser.json, dispatch-browser.json, storage-browser.json |
| RELEASE-002 | R10无原因拒绝，不能靠勾选风险豁免 | 通过 | ui-browser.json, dispatch-browser.json, storage-browser.json |
| RELEASE-003 | O80时申请A79，拒绝并定位色码 | 通过 | ui-browser.json, dispatch-browser.json, storage-browser.json |
| RELEASE-004 | T100申请A101，有风险原因仍拒绝 | 通过 | ui-browser.json, dispatch-browser.json, storage-browser.json |
| RELEASE-005 | 已有A100后K90重开沿用100，不自动改90 | 通过 | ui-browser.json, dispatch-browser.json, storage-browser.json |
| CHANGE-001 | K变化不会让既有A失效或变成未确认 | 通过 | ui-browser.json, dispatch-browser.json, storage-browser.json |
| CHANGE-002 | 确认时R0/currentR10；后来K恢复currentR0历史不变 | 通过 | ui-browser.json, dispatch-browser.json, storage-browser.json |
| CHANGE-003 | 已有O80下降K70不能改任务或自动取消 | 通过 | ui-browser.json, dispatch-browser.json, storage-browser.json |
| CHANGE-004 | 同事实反复读不新增矩阵；只列真实差异色码 | 通过 | ui-browser.json, dispatch-browser.json, storage-browser.json |
| CHANGE-005 | 三次整票变更、刷新后维持A，必须保存最新basis的新版本 | 通过 | ui-browser.json, dispatch-browser.json, storage-browser.json |
| PAGE-001 | 两色多码目标矩阵有独立颜色行和升序列 | 通过 | ui-browser.json, dispatch-browser.json, list-responsive-v47.json |
| PAGE-002 | 确认放行矩阵轴与目标一致且编辑对应色码 | 通过 | ui-browser.json, dispatch-browser.json, list-responsive-v47.json |
| PAGE-003 | 2XL/XXL/3XL、数码和自定义不能用字典排序猜大小 | 通过 | ui-browser.json, dispatch-browser.json, list-responsive-v47.json |
| PAGE-004 | 点数量不能误开抽屉；超量/空白错误定位格坐标 | 通过 | ui-browser.json, dispatch-browser.json, list-responsive-v47.json |
| PAGE-005 | 三道同票特殊量唯一、末道实收、待处理与差异分开 | 通过 | ui-browser.json, dispatch-browser.json, list-responsive-v47.json |
| PAGE-006 | Black/M点详情不能拿Red/L数据 | 通过 | ui-browser.json, dispatch-browser.json, list-responsive-v47.json |
| PAGE-007 | 抽屉展示原票、袋cycle、部位、各阶段厂/实收/人时间 | 通过 | ui-browser.json, dispatch-browser.json, list-responsive-v47.json |
| PAGE-008 | 真实材料缩略图对应对象，大图/Esc/失败/焦点恢复 | 通过 | ui-browser.json, dispatch-browser.json, list-responsive-v47.json |
| PAGE-009 | A未确认不同A0，T不能当A或V | 通过 | ui-browser.json, dispatch-browser.json, list-responsive-v47.json |
| PAGE-010 | 编辑草稿999未保存时导出仍已保存A和当前版本/件片单位 | 通过 | ui-browser.json, dispatch-browser.json, storage-browser.json |
| DISPATCH-001 | SEW/SEW+IRONPACK走放行门禁；CUT整包原策略 | 通过 | dispatch-browser.json |
| DISPATCH-002 | 无A只有T，候选/提交/共享保存不能派 | 通过 | dispatch-browser.json |
| DISPATCH-003 | V20派21或同SKU150+150借V200，全部拒绝 | 通过 | dispatch-browser.json |
| DISPATCH-004 | 合法V20/K不足/辅料未配齐仍派20，欠数警示保留 | 通过 | dispatch-browser.json |
| DISPATCH-005 | exact SKU错颜色尺码/PO身份、NaN等不能借他格余量 | 通过 | dispatch-browser.json, storage-browser.json, migration-browser.json |
| ACCESSORY-001 | 辅料需求/已配/待配来自独立明细，不能用K赋已配 | 通过 | dispatch-browser.json, receipt-browser.json, supplement-browser.json |
| ACCESSORY-002 | PPIC本人任务显示工艺未回仓、辅料待配、原分配保持 | 通过 | dispatch-browser.json, receipt-browser.json, supplement-browser.json |
| DOWNSTREAM-001 | 普通票未装袋可按原简易整票交出，不新增第二接收 | 通过 | receipt-browser.json, dispatch-browser.json, supplement-browser.json |
| DOWNSTREAM-002 | 特殊最终实收90不能按票面100交；两入口防重复消耗 | 通过 | receipt-browser.json, dispatch-browser.json, supplement-browser.json |
| DOWNSTREAM-003 | A100/O80实交70，应回责任不能直接100或80 | 通过 | receipt-browser.json, dispatch-browser.json, supplement-browser.json |
| DOWNSTREAM-004 | 手动票无铺布打印同一身份，分纸部位映射不变 | 通过 | receipt-browser.json, dispatch-browser.json, supplement-browser.json |
| DOWNSTREAM-005 | 确认T100后P90可读补料缺10；等待工艺P100不补 | 通过 | ui-browser.json, supplement-browser.json, receipt-browser.json |
| DOWNSTREAM-006 | 退仓大票、自由补料不能直接叠入新增K | 通过 | receipt-browser.json, dispatch-browser.json, supplement-browser.json |
| DOWNSTREAM-007 | 冻结旧票仓库90继续反映，冻结后新票20进晚到队列 | 通过 | ui-browser.json, supplement-browser.json, receipt-browser.json |
| STORE-001 | 保存只改逐记录IDB，无业务LS后备或整包快照 | 通过 | storage-browser.json, migration-browser.json, backup-restore-browser.json |
| STORE-002 | 在写完records前后中止tx，不能半套事实或先成功 | 通过 | storage-browser.json, migration-browser.json, backup-restore-browser.json |
| STORE-003 | 两个页面同revision只有一个写入，另一冲突保留输入 | 通过 | storage-browser.json, migration-browser.json, backup-restore-browser.json |
| STORE-004 | 实际改量201后刷新/关闭直达读V2，不能错误读V1 | 通过 | storage-browser.json, migration-browser.json, backup-restore-browser.json |
| STORE-005 | 第二迁移批中止旧源原样；恢复不重复，核验后才删独占旧键 | 通过 | storage-browser.json, migration-browser.json, backup-restore-browser.json |
| STORE-006 | 旧receipt缺完成/旧release缺装袋证据保历史，不补造真实事实 | 通过 | storage-browser.json, migration-browser.json, backup-restore-browser.json |
| STORE-007 | 空库普通首次读cutDB零写；动作不复制整批演示事实 | 通过 | storage-browser.json, migration-browser.json, backup-restore-browser.json |
| STORE-008 | 容量/打开失败真实提示保留，恢复实际重读而非清站点 | 通过 | storage-browser.json, migration-browser.json, backup-restore-browser.json |
| STORE-009 | 导出35记录/9动作恢复独立空库内容相同，坏备份不损旧库 | 通过 | storage-browser.json, migration-browser.json, backup-restore-browser.json |
| VERIFY-001 | 1366/1280矩阵及1024主管、PDA小屏主要任务真实可用 | 通过 | version-v47.json, ui-browser.json, dispatch-browser.json |
| VERIFY-002 | S01–S24每个场景有规则/页面/储存下游对应证据 | 通过 | ui-browser.json, storage-browser.json, migration-browser.json |
| PERF-001 | 冷、刷新、路由和关键动作每项5次完整结果≤1000，不仅loading | 通过 | version-v47.json, ui-browser.json, dispatch-browser.json |
| VERIFY-003 | 源码/构建hash、两轮88条与交付/接受身份分清 | 通过 | ui-browser.json, version-v47.json, dispatch-browser.json |
| COPY-001 | 重复每颜色解释和多处同义提示 | 通过 | ui-browser.json, dispatch-browser.json, list-responsive-v47.json |
| COPY-002 | 把投影、事务、快照等实现术语直接放员工首屏 | 通过 | ui-browser.json, dispatch-browser.json, list-responsive-v47.json |
| COPY-003 | 在用户可见票号中出现HPB路径、%转义或tdv内部键 | 通过 | ui-browser.json, dispatch-browser.json, list-responsive-v47.json |
| COPY-004 | 为了精简删掉数量上下限、逐票实收或危险影响 | 通过 | ui-browser.json, dispatch-browser.json, list-responsive-v47.json |
