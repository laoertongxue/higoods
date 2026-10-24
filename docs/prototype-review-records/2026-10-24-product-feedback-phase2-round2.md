# 商品反馈管理二期 V1.1 第二轮业务与产品对抗式审查

依据 `AGENTS.md` REVIEW-01、EVIDENCE-01。

## 基本信息

- 日期：2026-10-24
- 任务 / 需求编号：二期V1.1第二轮审查，R2-01
- 依据：用户要求使用现有Mock完整操作评论分类、商品诊断、问题跟进、行动处理和复盘关闭，直接修复问题，暂不发布。
- 版本：分支`codex/product-feedback-phase2`，HEAD仍为`122ce19391becb61f2657d0f796c2e380136e77e`，未提交工作区；源码及资产另以本轮version.json绑定。
- 验证人：主代理分别从业务规则与产品操作反例核对，实际使用Playwright CLI隔离会话操作；本轮没有将真实业务人员或用户接受写为已完成。
- 历史：[首轮实现与对抗式审查](2026-10-24-product-feedback-phase2.md)保留当时版本、70个性能样本和R01～R13；本记录只说明本轮新增问题、操作与受影响证据。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：修复复盘草稿的日期保存及恢复，补齐复盘记录中的后续安排日期；仅本模块定向切换缺字段旧演示草稿。T3业务验证，不触碰共享档案或发布链。
- 范围：复盘记录类型、保存投影、恢复表单、反馈专属本地存储和静态Mock版本；直接上下游为继续观察的新计划、调整措施的处理日及正式复盘关闭。
- 非范围：真实采集/翻译服务、生产后台、权限或多人共享；退货、Shopee首批不纳入。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 评论分类不改变原始事实 | 通过 | 五星双主题建议入草稿不改变确认主题；人工确认生效；另将面料正向原文确认后，总评论仍33，评分不变，分类完成比静态基线增加1。 |
| 商品诊断与评论一致 | 通过 | 两SPU不重复；SPU-QC-001本次26条评论、26条有效评分、6条差评、14条已确认分类、8条问题评论；五个诊断Tab及关联新跟进均操作。 |
| 正式建单有实际证据 | 通过 | 从五星水洗缩水原文发起核查，填写与已有面料偏薄跟进的区别，正式记录仅引用原评论，不增加评论数。 |
| 行动状态和进度一致 | 通过 | 开始、记录进展；备用行动取消→恢复→再次取消；主要行动完成且无需观察；仅1项有效行动完成，取消项不计完成率。 |
| 后续观察不可绕过 | 通过 | 正式保存“继续观察”后，仅有一个后续待观察计划，日期为11月8日；旧复盘不能作为当前结束依据。 |
| 结束、关闭、重开 | 通过 | 核查型正式结束→关闭→刷新只读→重开第二轮，旧行动不计新轮进度；商品诊断能查看跟进及复盘。 |
| 反馈变化分母一致 | 通过 | 同范围两日窗前期C=6/V=6/L=2，后期C=7/V=7/L=2；本次问题Y均为1，比例为1/6和1/7，Y/N/U/R合计等于C。小样本不自动认定改善。 |
| 未完成窗口不可提前结束 | 通过 | 14日后窗未完整结束时仍提示并只存草稿；没有产生正式复盘。正式阻断规则另由97项定向契约覆盖。 |
| 草稿后续安排不丢失 | 通过 | R2-01修复后，“继续观察”的复盘日与“调整措施”的处理日均保存、刷新及恢复原值；正式提交继续使用该值。 |
| 定向切换与原有资料 | 通过 | 5次独立v3→v4：仅移除缺日期旧Mock复盘草稿；完整草稿、正式历史、备注、文件及无关库保留；旧连接关闭、旧3写者拒绝，刷新不再次清理。 |

评论分类/商品诊断和跟进/复盘分别使用隔离会话，避免前一场景的分类修改污染固定复盘样本；不混用两会话的分类完成数。均为现有两页内Mock，并通过实际业务动作增加一条跟进和两项行动，没有批量扩充数据。

## 对抗式审查与修复

### R2-01：复盘草稿保存后，后续日期丢失

- 原始复现：将“下次复盘日”填为2026-11-08，保存草稿、刷新、重新打开，实际变为默认2026-10-31；观察正文和后续目标仍在，日期未保存。
- 根因：命令中有`nextDueDate/targetDate`，复盘记录未保存这两个字段，恢复表单也固定使用默认日期；“调整措施”的处理日存在同一缺口。
- 修复：复盘草稿与正式记录均保存两个日期，恢复时读取记录值；空草稿值保留为空，不把默认值冒充用户输入。正式“继续观察”及“调整措施”原有日期校验保留。
- 失败与修复证据：review-draft-before.log、draft-contract-before.log保留；review-draft-after.log、review-adjust-draft结果、97项定向回归及正式后续计划/处理日契约通过。
- 影响：刷新后继续处理草稿不会把复盘或处理日悄悄改成默认日期；没有增加业务字段输入或操作步骤。

## 数据重建登记

- 反馈专属库`higood-product-feedback-v1`由3升4，完成标记`meta:phase2-cutover`值为`feedback-phase2-v1.1-review-draft-dates`；静态Mock版本`feedback-phase2-v1.1-20261024-3`。
- 对v3仅在升级事务中移除`issueReviews`内`draft=true`且缺`nextDueDate`或`targetDate`的旧演示覆盖记录。旧实现从未保存过这些值，不能虚构恢复。完整草稿、正式历史、其他记录和附件保留；v1/v2沿用先前已确认的模块旧演示数据切换。
- 不在getter、刷新或业务维护界面清理；旧连接收到versionchange关闭，旧3写者不能重新写入。正常刷新不重复清理。
- 不操作测试数据库或真实资料。升级验证中的旧字段/文件哨兵属于独立技术夹具，不是新增的合法业务Mock或真实工厂证据。

## 页面证据

- 证据：`output/playwright/product-feedback-phase2-20261024/round2/`中保存CLI操作、实际回读结果、截图、失败及修复记录。
- 版本：同目录version.json绑定21项源码/测试、构建入口及反馈页面资源；initial-version.json用于核对本轮变化和无关差异保护。
- 环境：本机生产构建`/tmp/higoods-feedback-phase2-round2`，服务`http://127.0.0.1:4184`，Chromium隔离会话，分类/诊断1366×768，跟进/复盘1280×720；正式性能1366×768，业务时间Asia/Jakarta。未接触用户浏览器业务记录；旧4182服务不变。
- classification-diagnosis结果：建议、人工分类、原评分及商品五Tab；issue-final-state结果：实际建单、行动、后继计划、关闭/重开及商品关联回读；feedback-window-close结果：6/7前后样本、分母、关闭及未来窗口。
- review-adjust-draft结果：两种日期、正文和安排恢复；upgrade-check结果：五次定向清理、保护、旧写者及刷新。
- 页面截图：diagnosis、issue-ending-review、reopened-diagnosis、feedback-window、review-draft-after、review-adjust-draft。最终截图在产品记录关闭前实际查看。
- 校准失败单列：保存尚未完成就读值、错误状态文案、未选信息量即确认、复跑已确认记录仍断言新增1、等待当前分支未显示的字段、测试地址favicon不存在、升级夹具缺必需历史字段等。没有放宽业务校验以让脚本通过。原失败截图被后次复测覆盖，不作为失败证据；原失败日志和契约断言仍保留。CLI遇原生确认会先返回模态状态；后续已通过实际回读确认关闭/重开完成，未将该中间输出当成全部完成。

## 性能结论

- 结论：通过
- 依据：仅重采本轮受影响的定向切换、草稿保存/刷新恢复、正式复盘和关闭；每家族5个有效样本，计时起点为实际导航/点击，终点包含目标状态、独立持久回读、必要图片/字体及两次绘制。
- 旧证据复用：分类规则、商品聚合、Y/N/U/R、行动算法和页面布局未改；首轮存储中止/原子性、附件字节及窄屏/键盘证据保留其原版本，不冒称本轮重测了全部70样本。用户点名的业务流程已实际重走，草稿与升级分支以本轮结果为准。

- 本轮5个家族各5项，共25个有效样本，最大值300ms，全部≤1000ms；原始值见[本轮性能汇总](../../output/playwright/product-feedback-phase2-20261024/round2/performance-summary.json)。

| 等价家族 | 原始值ms | 最大值ms |
| --- | --- | --- |
| targeted-draft-cutover-entry | 300, 240, 258, 292, 252 | 300 |
| review-draft-save-durable | 77, 80, 73, 83, 79 | 83 |
| review-draft-refresh-resume | 300, 266, 300, 251, 250 | 300 |
| formal-review-with-next-arrangement | 74, 76, 75, 75, 76 | 76 |
| issue-close-current-review | 94, 78, 128, 78, 79 | 128 |

## 验证命令

- `node --import tsx --test tests/unit/product-feedback-model.test.ts tests/unit/product-feedback-classification-history.test.ts tests/unit/product-feedback-master.test.ts tests/unit/product-feedback-route-entry.test.ts tests/unit/product-feedback-phase2.test.ts`：通过
- `npx vite build --outDir /tmp/higoods-feedback-phase2-round2 --emptyOutDir`：通过
- `npm run typecheck:engineering`：通过

## 例外

- 全仓TypeScript仍有19项既有范围外错误，未记为全仓通过；工程范围检查通过。构建仍有既有大分块提醒。
- 本模块局部T3修复和旧演示草稿定向切换，不涉及共享事实/跨模块运行契约/发布链，未生成收据。
- 实现与本地验证不等于真实业务接受；没有提交、推送、合并main或部署，用户接受仍待用户实际确认。

## 最终结论

结论：通过

## 受管文件

- `src/data/product-feedback/phase2-types.ts`
- `src/data/product-feedback/phase2-model.ts`
- `src/data/product-feedback/repository.ts`
- `src/data/product-feedback/mock.ts`
- `src/pages/product-feedback/issues.ts`
