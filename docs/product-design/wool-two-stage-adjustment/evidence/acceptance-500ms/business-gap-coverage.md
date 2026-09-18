# 补充业务浏览器场景与 A01—A20 对照

> 2026-09-19 文档核对。本轮内部验收已通过。最终源码、构建及全部复测以 [最终收口记录](../acceptance-500/final-verification.md) 和 [源码清单](../acceptance-500/final-source-manifest.json) 为准。下面保留分阶段原始回执，不将旧构建性能当作当前通过证据。
>
> 最新用户授权口径：常规加载及操作严格 `<500ms`；仅 `/fcs/pda/exec` 任务队列冷进入允许 `≤1000ms`，其刷新、站内切换和所有动作仍 `<500ms`。本文件不变更126项矩阵状态。

## A01—A20 新旧证据映射

下表“旧”指原有测试文件，而非允许使用旧版本运行结果。最终须以同一冻结源码重新运行；领域契约汇总见 [core.log](../acceptance-500/core.log)，全套浏览器结果见 [browser.log](../acceptance-500/browser.log)。`gaps` 为 `tests/wool-acceptance-gaps.spec.ts`，`extra` 为 `tests/wool-acceptance-extra.spec.ts`，`workflow` 为 `tests/wool-management-fact-workflow.spec.ts`，`actions` 为 `tests/wool-stage-actions.spec.ts`。

| 场景 | 领域与原有浏览器证据 | 本轮新增真实 UI 证据 | 覆盖判断与边界 |
|---|---|---|---|
| A01 整件无外加工100件 | 两阶段契约精确100件四事实；workflow 无外加工实际填报5件并读回四事实 | gaps 保存失败恢复实际填报7件、刷新核对 | 已有算法精确量与真实入口组合；最终交出另由 A17 覆盖 |
| A02 部位无逐片 | 来源契约无逐片无工艺合法；两阶段契约按件自动衔接 | gaps 部位004实际最终交出8件，裁厂实际收货 | 不虚构不外发片明细；无片名是合法输入 |
| A03 混合片短板 | workflow Q1/Q2回货80/100时81被阻断，实际填报50 | gaps 多SKU页面与刷新结果 | 不外发片按横机件数记录；外发片取同SKU短板 |
| A04 已50再31 | workflow 总上限80；gaps 360/400两屏实际50后31拒绝 | gaps 360×800、400×806，各SKU持久化事实核对 | 明确余额30，失败无增量 |
| A05 分片首厂 | 两阶段及统一接收契约首厂分离；workflow 横机只交选定5片并确认首厂 | gaps A06、extra A13接续不同片路线 | 已有分片去向、打印及工厂隔离证据；不把一片交给多厂同时加工 |
| A06 多工艺顺序 | workflow 首厂实际加工/交出后下一厂待收且未虚增 | gaps 两节点各实际5片加工/交出、第二节点实收、最终缝盘实收；extra 两片100链 | 完整两节点真实操作链 |
| A07 同名工艺与双纱 | 来源契约同名节点不合并、双纱同物理片去重 | gaps 同名三节点详情分别确认taskId、1/3至3/3及片身份 | 需求结果已有契约+页面证据；没有宣称三节点所有动作逐一回放，设计本项未要求此额外链 |
| A08 同来源60+40分批 | 两阶段A05/08及统一接收契约验证累计、防重和首次未收齐；workflow已有部分接收前置后UI追加5 | `wool-split-receipt-acceptance.spec.ts`实际补填60后横机交出100，首厂同来源实收60、刷新、再实收40，核对两笔唯一记录和库存100 | 已通过真实同来源两次实收；原始日志与页面结果见本文件最后的A08回执 |
| A09 资料阻断 | 来源和route-isolation契约产生环路、分叉、缺厂诊断且按片/SKU阻断 | gaps 三类诊断详情与PDA禁操作，未生成交出或自动衔接 | 诊断是隔离前置，未伪称通过PCS UI编辑生成错误 |
| A10 SKU隔离 | 来源契约隔离颜色尺码；route-isolation契约不影响正常SKU | gaps L实际10件、M填50后31阻断、刷新M50/L10 | 不借用另一尺码余额；无外工艺SKU不重复手工缝盘 |
| A11 幂等与失败恢复 | 领域同commandId防重、存储原子回滚；原对抗契约 | gaps 实际UI写入失败保留7件输入，恢复后重试恰好一组四事实 | 存储失败注入仅故障条件，成功动作走UI |
| A12 数量更正 | 两阶段契约同步四事实、消费后阻断 | actions Web真实更正、最终交出后反向更正阻断且无写入 | 已有直接UI回归，不重复造用例 |
| A13 合法超计划 | 领域实际量≤150%及缝盘不再放大 | extra 计划80、实际100前置；两种片完整工艺接收/加工/交出，缝盘各收100、加工100、最终交出100 | 来源前置不算UI横机动作；正常横机填报/交出由 A01/A05 与150%反例组合覆盖 |
| A14 阶段完成 | 领域阶段独立完成、计划与最终实收不同口径 | actions Web及两种PDA二次确认/未闭合拒绝；独立交互脚本实际下游收货后完单 | 早期actions部分闭合前置为领域准备；完整真实收货路径见最终交互报告 |
| A15 绑定版本 | 来源契约深复制与绑定版本优先 | gaps PCS真实启用新版；刷新后两张毛织单旧片名/路线，生产单完整快照不变 | 合法正式生产单及两版本为领域夹具；实际验收的是启用版本及读取原单，非创建审核 |
| A16 多端统一接收 | 统一接收、PDA投影、工厂权限契约 | workflow Web纱线/片实际保存；原PDA测试、主管1024接收与交互脚本读回同源事实 | 同一事实模型；每项独立浏览器不表述为同一真实工厂单据跨端同时操作 |
| A17 最终下游 | 最终下游契约；workflow/final-craft-pda真实选择成衣批次并保持另一批待收 | gaps 部位004→指定裁厂真实PDA收货→待装袋来源；整件003→指定后道来源，错厂排除 | 需求是正确下游来源；未将后道来源展示扩称后道全部加工流程 |
| A18 清空旧毛织 | 清理/幂等初始化/非毛织保留契约 | gaps 旧列表、详情、打印、tasks、orders均不能恢复旧入口 | 删除边界及重启事实由契约覆盖；本轮未清用户浏览器 |
| A19 页面、图片、单位、打印 | workflow 六状态、时间/数量列、导出偏好、1280、图片大图关闭与失败态；PDA仓储两屏 | gaps 1024两阶段详情/填报、4批A4；extra 1024领退移库/设备；打印失败恢复各5次和长PDF5次；新增debounce回归 | 最后warehouse源码改动后全部受影响项须重跑；不能引用早先45项绿灯作为该修复验收 |
| A20 扫码与设备 | actions加工单直达、生产单双阶段候选、错厂拒绝；无缝盘设备入口 | extra 1024设备关联、释放、维修状态刷新；最终交互脚本真扫码动作 | 保留横机设备功能且缝盘不提供 |

## 126项矩阵中仍需区分的缺口

1. **A08直接UI证据已补齐。** 真实横机补填60后交出100，同来源实收60后剩余40，刷新再收40，累计/库存100且两笔ID唯一；日志与截图见本文件末尾。
2. **已修复、待最终新鲜证据：仓库筛选debounce竞态。** 旧input定时器可能在change/reset后迟到重绘，覆盖后续每页条数选择。已增加确定性红绿用例并取消旧timer；最新46项中45项通过、1项分页偏好测试即时读取存储的等待竞态失败；仅补测试等待实际14行后定向通过，业务源码没有因此再改。最终受影响交互全部五轮通过，完整结论见最终收口记录。
3. **完成门禁待收口，不是新增业务功能缺失：** 当前冻结构建全部路由/操作五样本、共享优化等价、最终完整diff对抗式审查、126项证据版本及确认字段。具体结论由 [最终收口记录](../acceptance-500/final-verification.md) 更新。
4. **不是遗漏：** A07不要求额外扩建三节点流程；A15不要求新建技术包审核流程；A17不要求重做后道生产；真实工厂执行、物理打印机队列与扫码硬件均未被本原型证据宣称已验收。

## 可复现命令与阶段回执

以下命令均在 `/private/tmp/higoods-wool-main-release-20260918` 执行，服务为同一工作树。新增14例的阶段执行是12例整组+另2例分别通过，不伪称当时单次14例完整运行。后来主代理45例整组已包含14例；新增debounce后需46例整组重新生成证据。

```sh
CUTTING_E2E_PORT=5198 PLAYWRIGHT_REUSE_EXISTING_SERVER=true npx playwright test tests/wool-acceptance-gaps.spec.ts --workers=1 --reporter=line --output=/private/tmp/wool-business-final
CUTTING_E2E_PORT=5198 PLAYWRIGHT_REUSE_EXISTING_SERVER=true npx playwright test tests/wool-acceptance-extra.spec.ts --workers=1 --reporter=line --output=/private/tmp/wool-business-extra-final
CUTTING_E2E_PORT=5198 PLAYWRIGHT_REUSE_EXISTING_SERVER=true npx playwright test tests/wool-acceptance-extra.spec.ts --grep 1024 --workers=1 --reporter=line --output=/private/tmp/wool-1024-final5
CUTTING_E2E_PORT=5198 PLAYWRIGHT_REUSE_EXISTING_SERVER=true npx playwright test tests/wool-acceptance-gaps.spec.ts tests/wool-management-fact-workflow.spec.ts --grep '打印|阶段错配' --workers=1 --reporter=line --output=/private/tmp/wool-print-final2
WOOL_BASE_URL=http://127.0.0.1:4198 node scripts/check-wool-print-extra-performance.mjs
```

- 第1条：12/12通过，[business-final.log](./business-final.log)。
- 第2条当时版本：A13通过、1024因测试未等待异步option失败；[原始失败保留](./business-extra-a13-with-initial-1024-failure.log)。
- 第3条：等待修正后1024通过，[business-1024-final.log](./business-1024-final.log)。这与后来发现的真正debounce源码缺陷不同。
- 第4条：3/3通过，打印分页、错阶段、图片QR就绪及内部自动不打印；原日志 `/private/tmp/wool-print-final2.log`。
- 第5条：当时构建15/15通过，[原始JSON](./print-extra-performance.json)。最终构建必须重新回放，见最终收口报告，不能只引用本阶段最大值。

## 阶段原始说明


本次执行文件：`tests/wool-acceptance-gaps.spec.ts`。只在隔离浏览器内准备来源数据与角色会话；加工、交出、工艺接收、最终接收均通过实际页面入口。不会把导入模块执行命令当作用户操作通过证据。

命令：

```sh
CUTTING_E2E_PORT=5198 PLAYWRIGHT_REUSE_EXISTING_SERVER=true npx playwright test tests/wool-acceptance-gaps.spec.ts --workers=1 --reporter=line --output=/private/tmp/wool-acceptance-gaps-results
```

开发服务仅用于这些业务功能回放。本文件不提供加载或逐操作 500ms 通过结论；计时仍由专门报告负责，不能以功能通过替代。

## 实际覆盖范围

- A04/A10：360×800、400×806；同一加工单新增 L 来源，真实填报 L 10 件；M 50 件后再填31件被阻断；刷新仍 M50/L10；L 无外工艺不能在缝盘重复手工填报。
- A09：准备三种资料诊断（环、多个后继、缺厂），详情显示原诊断，PDA没有非法交出入口；无新增交出及缝盘加工；已有内部衔接事实保持不变。
- A06：真实工艺页面首站填报/交出5片，第二厂实际接收5片、填报/交出5片，缝盘实际接收末工艺5片后刷新。来源实收qty而非状态推断。
- A07：同名工艺的3个独立节点页面、具体步数及片身份均检查。此项验证既有完整演示的查询身份，不声称重放了3节点全部操作。
- A19：1024×768两阶段列表查询、重置、详情所有分区及实际横机填报；4次真实交出形成4页PDF，长备注/QR/真实图片就绪。
- A18：旧work-orders、其详情/打印、tasks、orders入口不恢复旧模型。
- A17：部位交出8件，在指定裁厂真实PDA收货前不能装袋、实收后才成为待装袋来源；整件实际缝盘交出出现在后道任务，改为其他指定厂的后续交出不进入本后道来源。

- A11：模拟单一毛织存储键写入失败，实际页面显示未保存、保留7件输入，所有事实不变；恢复存储后UI重试一次，刷新恰有一组横机7件→内部交出7件→缝盘接收7件→缝盘加工7件。
- A15：准备来源完整的PCS已发布两版本、生产准备单确认任务及正式生产单旧版本快照，页面实际点击新版“启用为当前生效版本”。刷新确认当前版为新版，再进入横机、缝盘详情，仍展示旧版片名与路线；正常持久化读取的生产单全快照与两张毛织单全对象，启用前后深比较一致。

## 明确边界

- A15 的版本、生产准备任务和正式生产单／毛织单是隔离来源夹具，使用现有领域API、快照构建／片解析和持久化schema准备。只有“PCS启用新版”及随后查询刷新是实际UI动作；没有声称通过UI完成技术包创建、审核或生产单创建。默认版启用仍实际经过来源身份、成本和固定依赖校验。
- A09验证来源诊断在页面的阻断投影，路线诊断生成算法仍由现有piece-source与route-isolation契约负责；页面测试不伪称编辑真实技术包形成了这些错误。
- A13 与1024仓库／设备验证已补齐，见下方追加回执；它们不替代各动作五样本性能报告。
- 多节点页面查询、后道来源显示不能替代对应工厂的完整接收、加工、交出全链路验收。

## 打印修复与最终证据

实际复现：四次交出预览有四张纸，原桌面固定高度滚动容器使Chromium PDF仅输出第一页。`handover-print.ts` 只在打印媒体释放当前打印面的祖先高度、滚动裁切，并隐藏非打印兄弟区域；保持每批独立分页。固定表格列宽使数量可读且长备注换行。

最后打印专项：`/private/tmp/wool-print-final2.log`，3/3通过（多批A4、错阶段地址、图片/QR就绪及内部自动不打印）。PDF实测4页；渲染页面确认数量“5件”、完整260字备注、二维码、真实款式图及签收栏均可见。

A15定向：`/private/tmp/wool-a15-final.log`，1/1通过。

先前完整组合：`/private/tmp/wool-acceptance-gaps-final.log`，补充11项 + 原有17项共28/28通过。其后只改打印列宽并新增A15：打印专项已重新通过，补充文件最终12/12项通过（46.3秒），原始结果见本目录 `business-final.log`。

环境：工作树 `/private/tmp/higoods-wool-main-release-20260918`；基线 HEAD `4ea0f03d81035608e3c9f4afe7933013ab28a57b` + 本轮工作区修改；开发服务 `http://127.0.0.1:5198`；Playwright Chromium、单worker、每项独立上下文，PDA360/400与主管1024视口按测试定义。原始日志及截图/PDF保存在 `business-browser/`，源码哈希见 `business-source-sha256.txt`。

## 打印失败、恢复和长PDF五样本

`scripts/check-wool-print-extra-performance.mjs` 在预览4198、1366×768、五个全新隔离上下文（打印测量脚本不导入业务模块、不写入业务事实），实际UI创建四批各5件交出，每批带260字备注。每轮主动中止对应款式图请求，整页刷新计时至四图失败、明确提示且打印禁用；解除中止后整页刷新至四图解码、四二维码及可打印按钮就绪。计时包含导航、完整结果及两次绘制。再从实际打印按钮click开始至Chromium完整PDF缓冲返回计时；系统打印机队列不属于原型测试范围。

`print-extra-performance.json`：15/15通过。失败反馈最大125.2000000178814ms；恢复最大212.59999999403954ms；四批PDF最大108.30000001192093ms。全部五份PDF为4页A4，原始耗时与版本/build哈希见JSON，文件 `print-four-batch-1.pdf` 至 `print-four-batch-5.pdf`。这是明确失败注入用例，正常性能采样没有中止图片或伪造成功。

## A13 与1024追加回执

`tests/wool-acceptance-extra.spec.ts`：A13隔离前置是需求计划80、已横机/外发/首厂实际接收100（125%，低于150%）；没有修改已有实际数量。随后两种外发片各按其路线，在实际工艺页面填报100和交出100、后继厂接收100，最终缝盘各收100；缝盘实际填报100并最终交出100，刷新核对两个片接收事实及缝盘产出/交出均为100。原始组合日志 `business-extra-a13-with-initial-1024-failure.log` 中A13通过；同次1024失败是测试脚本未等待异步弹窗便读取option，保留该失败日志以说明最后修正范围。

1024最终日志 `business-1024-final.log`：1/1通过，5.2秒。真实称重净接收2kg→实际库位领1kg→退1kg→移库1kg；两个仓库所有tab及明细可操作；设备003关联到横机单、释放、状态改维修并刷新确认。三个页面均确认主体不横向溢出，截图见 `business-browser/`。该回放包含待接收的1024实际保存，未使用存储写入伪造业务操作。

原12项与新增2项共14个补充功能用例在各自回放中通过；后来追加仓库延迟刷新回归用例，补充用例数变为15。此前“仓库没有源码改动”的结论仅对应第一次功能回放；本轮性能回放又发现真实 debounce 竞态，现已修改 warehouse.ts 并增加确定性回归，不得沿用旧证据关闭该变更。

## A08 最终补测通过（2026-09-19）

新增 `tests/wool-split-receipt-acceptance.spec.ts`，[原始日志](../acceptance-500/split-receipt.log)。全程实际UI：008原有40件先补填60，再首片交出100；首工艺同一实际来源先收60，页面剩余40且未收齐，刷新后再收40。领域只读核对恰两笔60/40，来源唯一、收齐差异0，首工艺库存2条合计100且ID不重复；再次刷新后数量不变且无重复接收按钮。[页面结果](../acceptance-500/split-receipt-complete.png)。没有通过改夹具或命令伪造交出/接收。前文“补测中”是文档交接历史状态，本段与最终收口记录为最新结论。
