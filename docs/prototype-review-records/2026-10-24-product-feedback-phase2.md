# 商品反馈管理二期 V1.1 实现与业务、产品对抗式审查

依据 `AGENTS.md` REVIEW-01、TRACE-01，范围为已确认的二期V1.1本地原型。

## 基本信息

- 日期：2026-10-24
- 任务 / 需求编号：商品反馈管理二期V1.1，A21～A38，D21～D28
- 依据：[二期V1.1方案](../product-design/商品反馈管理二期完整方案-2026-10-24.md)，D21～D28全部采用；后续用户明确授权实现与审查修复，暂不发布。
- 验证人：主代理执行页面、统计、存储及交互验收；独立审查代理 `/root/review_phase2_implementation` 只读审查业务规则、反例及产品接线。没有假称真实业务人员接受。
- 业务对抗视角：逐一尝试用旧计划、旧复盘、未确认评论、未结束窗口和过期依据推进流程；产品对抗视角：实际往返、刷新、快速操作、保存失败及等待中继续输入。
- 起点与当前HEAD：`122ce19391becb61f2657d0f796c2e380136e77e`；分支 `codex/product-feedback-phase2`，本次尚未提交。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：新增问题跟进与详情，扩展评论理解、商品诊断、关注候选及本地原子保存。原五页保留，所有评分采集，九家TikTok每天执行，唯一现有负责人仍为小羊.高阳.kiko。
- 本模块业务变更按T3验收；本地反馈演示记录定向重建，不写共享商品事实、不接真实数据服务或鉴权，不引入退货、Shopee首批、外部通知、真实AI或生产系统。
- 最小业务契约与需求矩阵见[实施追踪](../product-design/product-feedback-phase2-20261024/implementation-trace.md)，A21～A38双向对应。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 六页、独立跟进详情、原菜单位置 | 通过 | 六页直达与站内切换，动态详情刷新，菜单与路由定向回归；browser-results.json。 |
| 原文、译文、建议、人工确认分离 | 通过 | 五星多主题、建议仅草稿、人工确认/撤回，原评分与采集任务不变；unit-regression.log及insights-results.json。 |
| 商品五维、诊断五Tab、分母和未知项 | 通过 | 按款式合计33条，已采/有效评分分别统计；空期仍显示9条活动跟进；诊断/来源下钻、参考备注刷新。 |
| 正式建单、草稿、责任及范围 | 通过 | 一条当前确认问题证据即可建单；仅评分草稿、多SPU/重叠校验、正式编辑不误存草稿；browser与unit。 |
| 行动、生效、轮次与关闭 | 通过 | 完成与生效未知分开；核查复盘→关闭→刷新→重开第2轮，旧行动不计新轮；快速新建完成的精度边界已修。 |
| 具体问题Y/N/U/R、前后窗口、正式快照 | 通过 | UI前期C=6、V=6、L=2，后期C=7、V=7、L=2；逐条核对后Y/N/U/R合计分别6/7，Y/C仍为1/6、1/7；40条隔离内存夹具验证三种比例差。 |
| 关注候选及待办 | 通过 | 最近7个完整自然日，阈值、同对象和覆盖；下钻ID集合等于候选成员，不自动建单或处罚。 |
| 证据原文/分类/实际译文依赖 | 通过 | 两标签分别更新分类或仅更新译文，旧核对均阻断并保留输入；刷新重核可保存实际译文ID；未依赖译文不失效。 |
| 保存失败、并发、幂等、回读 | 通过 | 保存中第二次写入抛错时，记录/附件/日志一起回滚；重试成功；另一标签旧版本覆盖被拒；独立持久回读。 |
| 定向切换与文件实体 | 通过 | v1/v2→v3，清本库旧records/attachments，保留无关库；一次性标记，旧1/2写者拒绝；普通刷新保留新数据；文件下载字节一致。 |
| UI、分页、导出、图片和键盘 | 通过 | 1366×768及1280×720；20+13分页、33条完整导出；实际表格横滚/列设置回读、Tab/Escape、建单返回滚动/焦点；图片来自现有对应款式。 |
| 本地响应时间 | 通过 | 14类各5个有效样本，共70个，全部≤1000ms，原始值见性能证据。 |
| 一期直接回归与无关差异保护 | 通过 | 原采集/人员/身份/评分/撤回/路由契约保持；原17项质检相关差异哈希全部保留，HEAD未动。 |

## 对抗式审查及修复闭环

首次审查不通过。以下问题均先保留失败事实，再修复与复核；独立审查报告不能替代主代理现场操作。

| 编号 | 反例与业务影响 | 修复及最终证据 |
| --- | --- | --- |
| R01 | 旧结束复盘可能绕过后继计划；旧计划可重成活动计划。 | 绑定最新正式计划与最新正式复盘；新草稿不提前使旧决定失效；unit及连续正式计划/复盘实测。 |
| R02 | 未分类低星来源保存草稿崩溃。 | 允许空分类证据快照；正式证据仍严格校验；定向反例。 |
| R03 | 建单去标注再返回丢输入。首轮模块内恢复修正仍未通过现场。 | 根因是动态链接挂到body绕过#app委托，触发整页导航；三处改走应用内导航，保留表单/范围/滚动/焦点；人工分类保存后返回实测通过。 |
| R04 | 正式编辑可勾证据，提交却忽略变化。 | 正式编辑显示现有引用并禁用勾选，调整走评论证据Tab；UI实测。 |
| R05 | 计划草稿保存后无恢复入口。 | 继续编辑同一草稿ID/版本；保存→关闭→刷新→恢复字段实测。 |
| R06 | 覆盖联合与一期成功段不一致，未知时间/链接的F/P可能被排除。 | 复用有效成功段、终结交付和回执；任一已接收执行有相关未解决缺口仍阻断；可信窗外可排除，未知项保守保留；定向反例。 |
| R07 | 零评论期间已有活动跟进被算0。 | 按固定对象范围求交，列与筛选共用；空期0评论/9跟进实测。 |
| R08 | 正式编辑“保存草稿”会直接改正式事实。 | UI仅保存修改，模型拒绝正式单draft=true；单位反例及现场。 |
| R09 | 参考备注保存等待中继续输入，成功回读无条件清dirty，可能丢后写文字。 | 固定submittedNote，回读后比较屏幕现值；延迟事务完成场景保留未保存输入、离开保护，实际提交值与新文字分开。 |
| R10 | UUID键序回读使第三轮新计划被旧计划误挡，其他最新事实也可能回退。 | 追加事实记录事务提交order；投影合并后按order规范化，译文按revision；含日志/备注。逆向ID、同一时间反例及连续5计划/5复盘保存回读通过；旧无序Mock通过v3切换退出。 |
| R11 | 差评变化关注未显式比较前后组合对象集合。 | 同店铺/链接/SKU含未知桶集合一致才生成自动比较候选；20评分/+3/覆盖齐触发，19、+2、对象不同、缺覆盖均不触发。 |
| R12 | 同一秒快速新建后完成，默认时间截断到秒而早于创建毫秒，误触合法时序阻断。 | 显示未改变时提交原精确时间，改动仍按雅加达解析；未放宽模型时序；新建→行动/附件→完成实际重放通过。 |
| R13 | 重核只校验跟进版本，另一标签更新原文/分类或实际依赖译文后可能误记“已核对”。 | 每条核对选择原文/中文，逐条签名及实际译文映射在事务内核验；历史保留当时原文/关联/分类/评分/译文并显示旧译文；过期添加/重核整次拒绝，解除旧引用仍可执行。 |

独立审查分别复核原缺陷、R03根委托、等待输入、顺序、对象集合、时间精度和R13实际依赖接线；最终没有剩余阻断。R13旧历史译文展示建议已落实。主代理完成了对应现场证据。

列表静态检查还要求入口采用可证明的显式返回分支；问题页已将嵌套三元表达式整理为等价的列表/详情返回，未改组件或基线。审查文档的日期标点及固定字段名也按模板校正。

脚本校准问题另行辨别：页码/导航/返回按钮选择器、将33条误认为三个SPU、固定昨日日期、假设末条ID为mock-33、未等待保存完成即刷新、将“小样本”错误等同于必须“数据不足”等，均修正观察方式，未修改业务阈值迎合脚本。原失败、R10真实业务失败及校准输出保留在证据目录；不计为有效通过样本。初始化时固定词典误用非空断言导致的错误也已修复，回归通过。

## 可直接操作的Mock路径

默认打开即有33条评论、12条跟进、11项行动、7个正式计划、13项具体问题核对和2条正式复盘；所有评论均有评论者。默认每页20条，40条两期数学/阈值反例仅在隔离内存夹具中，不叠到日常页面。

| 入口 / 记录 | 可验证场景 |
| --- | --- |
| 采集工作台 | 九店每日安排、人员考核、责任任务、实际待办下钻。 |
| 评论1、5、26 | 五星正负多主题、具体原文/对应译文、辅助草稿与人工确认、原文变化后旧译文失效。 |
| 商品评价汇总 | 两个SPU、同SKU多个链接、未确定SKU、五维与五Tab、选品参考备注。 |
| 反馈分析重点关注 | 七完整日、集中问题/低星待复核/已有跟进新证据，精确成员下钻。 |
| 跟进1、2、3 | 草稿、待处理、处理中及已取消备用行动；跟进3的证据需重核。 |
| 跟进4、5 | 核查型复盘；完成但生效时间未确认不能假装有反馈变化窗口。 |
| 跟进6、10 | 已结束的等长两日前后窗小样本复盘；默认14日后窗未结束，仅保存草稿。 |
| 跟进7、8、9 | 关闭只读、作废终态、关闭后重开新一轮且当前行动为0。 |
| 跟进11、12 | 引用分类变化待核对、行动逾期；行动/复盘/采集成绩分别统计。 |

## 页面证据

- 证据：以下版本绑定的浏览器、统计、存储、并发、图片与键盘记录共同覆盖本任务。

- 工作树：`/Users/laoer/Documents/higoods`。生产构建目录：`/tmp/higoods-feedback-phase2-final`，本机服务 `http://127.0.0.1:4184`；未发布。
- 版本：源码/测试21项与构建资源哈希见[version.json](../../output/playwright/product-feedback-phase2-20261024/final/version.json)。不是只以HEAD证明未提交资产。
- 环境：Chromium独立测试上下文，业务日期边界显式Asia/Jakarta，1366×768与1280×720；不使用用户浏览器的业务记录。正式性能与重型构建串行。
- [浏览器闭环](../../output/playwright/product-feedback-phase2-20261024/final/browser-results.json)：30项，含六页、R03往返、保存回读、行动/附件/关闭/重开/复盘、窄屏。
- [统计与下钻](../../output/playwright/product-feedback-phase2-20261024/final/insights-results.json)：23项，含采集/人员、五Tab、分页导出、空期跟进、关注原集合。
- [存储故障与切换](../../output/playwright/product-feedback-phase2-20261024/final/storage-results.json)：10项；[备注保存竞态](../../output/playwright/product-feedback-phase2-20261024/final/notes-race-results.json)：2项；[列设置/实际滚动/键盘](../../output/playwright/product-feedback-phase2-20261024/final/ui-final-results.json)：5项。
- [证据核对并发及实际译文依赖](../../output/playwright/product-feedback-phase2-20261024/final/evidence-concurrency-results.json)：4项现场断言，另含该分支5个性能样本。
- 截图：同目录六页1366、四页1280、review-periods、task-detail-1280、comments-horizontal-1280、evidence-rechecked。已实际查看列表与复盘及横滚截图，不以DOM宽度代替视觉检查。
- 数据模型：96项定向回归（含二期38项），日志[unit-regression.log](../../output/playwright/product-feedback-phase2-20261024/final/unit-regression.log)。

## 性能结论

- 依据：本机生产构建、默认两页Mock，14类各5个真实导航/操作样本及独立保存回读；原始值与计时边界如下。

- 结论：通过
- 基准：33条评论、12条跟进、20条每页，新增操作保持两页内；行动附件使用对应现有款式`shirt-black.jpg`原始文件。
- 起点：真实导航/点击前；终点：目标数量/状态、保存的独立持久回读、必要图片与字体完成、两个绘制帧后可交互；填写及用户确认等待不计。
- 冷启动为全新浏览器上下文；刷新、站内切换、保存、导出分别采样。窄屏功能覆盖，布局成本同族且DOM/数据规模相同；未宣称移动端或线上性能。
- 各家族5个有效样本，共70个；任何有效样本均未超过1000ms。原始值：[主样本](../../output/playwright/product-feedback-phase2-20261024/final/performance-results.json)、[证据核对样本](../../output/playwright/product-feedback-phase2-20261024/final/evidence-concurrency-results.json)、[汇总](../../output/playwright/product-feedback-phase2-20261024/final/performance-summary.json)。

| 等价家族 | 样本数 | 最大值ms |
| --- | --- | --- |
| cold-module-entry | 5 | 288.6 |
| cold-comment-images-entry | 5 | 280.7 |
| refresh-feedback-entry | 5 | 249.9 |
| in-app-module-switch | 5 | 133.1 |
| list-query | 5 | 83.9 |
| detail-and-tab | 5 | 133 |
| translation-save | 5 | 113.7 |
| classification-confirm | 5 | 113.1 |
| action-with-attachment-save | 5 | 101.9 |
| formal-plan-save | 5 | 125.8 |
| formal-review-save | 5 | 119.4 |
| specific-judgment-save | 5 | 94.8 |
| all-filtered-export | 5 | 116.6 |
| evidence-current-version-save | 5 | 127.7 |

## 验证命令

- `node --import tsx --test tests/unit/product-feedback-model.test.ts tests/unit/product-feedback-classification-history.test.ts tests/unit/product-feedback-master.test.ts tests/unit/product-feedback-route-entry.test.ts tests/unit/product-feedback-phase2.test.ts`：通过
- `npx vite build --outDir /tmp/higoods-feedback-phase2-final --emptyOutDir`：通过
- `npm run typecheck:engineering`：通过
- `git diff --check -- src/components/product-feedback src/data/product-feedback src/pages/product-feedback src/main.ts src/main-handlers/pcs-handlers.ts src/router/routes-pcs.ts src/data/app-shell-config.ts tests/unit/product-feedback-master.test.ts`：通过

## 例外

- 仓库全量TypeScript检查仍有19项既有范围外错误；本反馈模块、入口和路由没有新增类型错误。渐进工程检查通过，不把全量检查失败写为通过。明细在full-typecheck.log/typecheck.log。
- 构建保留仓库既有大分块提醒；未为本任务调整无关构建配置/依赖。
- 不触发共享事实迁移、跨模块业务写入或发布链，未生成版本绑定收据。定向切换仅为本模块旧演示记录重建，未宣称静态构建已清理用户其他来源资料。
- 仅本机Mock能力验证；真实拓展/本地应用/翻译服务接入及多人共享未在本次实施范围。没有操作测试数据库。
- 本地工作区交付；未提交、推送、合并main或部署。用户对本次实现的接受待确认，代理不代填。

## 最终结论

结论：通过

## 受管文件

- `src/components/product-feedback/insights-shared.ts`
- `src/components/product-feedback/operations-ui.ts`
- `src/data/app-shell-config.ts`
- `src/data/product-feedback/mock.ts`
- `src/data/product-feedback/model.ts`
- `src/data/product-feedback/repository.ts`
- `src/data/product-feedback/types.ts`
- `src/data/product-feedback/phase2-types.ts`
- `src/data/product-feedback/phase2-model.ts`
- `src/data/product-feedback/phase2-mock.ts`
- `src/main-handlers/pcs-handlers.ts`
- `src/main.ts`
- `src/router/routes-pcs.ts`
- `src/pages/product-feedback/collection.ts`
- `src/pages/product-feedback/batches.ts`
- `src/pages/product-feedback/comments.ts`
- `src/pages/product-feedback/products.ts`
- `src/pages/product-feedback/analysis.ts`
- `src/pages/product-feedback/issues.ts`
