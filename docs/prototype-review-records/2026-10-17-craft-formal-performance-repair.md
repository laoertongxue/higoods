# 工艺加工单冷加载修复：本地 T4 验证记录

依据：`AGENTS.md` 的 SCOPE-02、TRACE-01、REVIEW-01、IMAGE-01、PERF-01、EVIDENCE-01 与 RELEASE-01。

## 基本信息

- 日期：2026-10-17
- 任务 / 需求编号：继承 SEAM-14、SEAM-16；本记录关闭本地 T4，T5 正式发布另验
- 验证人：Codex 主代理；独立审查为 release_evidence_audit；不代替工厂产品接受

## 范围、继承与阶段

基准正式发布为 de3e9b91ac1e3436b401e63cd7150ca167754ca5 / Actions 39013360292。该版本16类48列表场景、158详情176图、业务分支与400实际资源核对已通过；首批5个有效正式冷加载为5501.3–6380.1ms，另有8秒采集超时，因此正式性能未通过。本记录保留该结果，不关闭 SEAM-16。工作树为 /Users/laoer/.codex/worktrees/dfd6/higoods，分支 codex/seam-embroidery-unification。

目标只覆盖本任务首屏图片传输与依赖发现。保持原加工单、数量、状态、工厂、存储、路由和初始化执行顺序；不新增图片服务、依赖、框架、业务缓存或静态事实副本。原图文件和原图URL作为对象身份保留；已知静态照片使用同源真实图片生成的小图与高清WebP，未知/上传地址回退原图。

## 诊断、设计与实施计划

正式waterfall记录137资源约4.19MB：卫衣原图约1.96MB在1489ms才发现并于5454ms完成；JS等依赖末端约1364ms。只换小图的隔离诊断中，实际未缓存原图预览仍需2060.6ms，因此同时提供保持比例、长边至多1280、字节严格小于原件的高清衍生图。fabric-main原件已经更小，删除其多余高清派生，保留原件预览。最终新增7张小图、8张高清图，未覆盖原文件。

计划按依赖执行：最小失败图片契约 → 共用图片渲染与显式高清预览 → 命名路由静态预取 → 原图/正常/失败/未知图片与相邻Web/PDA/打印核验 → 完整构建与毛织E2E → 全量页面与性能 → 两轮对抗审查 → 收据 → 新SHA推送部署 → 正式站全量复核。预取复用现有构建插件，只fetch/compile实际静态闭包、基线JSON与缩略图，不执行模块，不改变hydration或成本清理顺序。

## 原子需求与本地结果

| 需求编号 | 来源 | 原子需求 | 工作包 | 实际文件 / 符号 | 自动化验证 | 页面 / 性能证据 | 状态 | 证据位置 | 确认人 / 版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SEAM-14a | IMAGE-01/PERF-01 | 小图对应同一真实对象，原图身份与文件保持 | 图片 | stage-display.ts / renderWoolObjectImage、静态映射 | static-image-thumbnail，原图SHA/比例 | 158详情176图及失败/回退 | 已验证 | cold-repair-local；craft-static-derivative-final-proof.json | Codex；de3e9b91+130输入冻结清单 |
| SEAM-14b | PERF-01 | 仅命名路径预取实际依赖，初始化执行顺序不变 | 预取 | vite.config.ts / preloadStaticFirstScreenRoutes | craft-route-preload、pda-sewing-route-preload、构建 | 16路由正例、未知/嵌套/打印等负例，实际导航 | 已验证 | craft-preload-and-images-green.log；最终receipt | 同上 |
| SEAM-14c | 用户全量核对 | 16类列表、158详情与原有交互正确 | 回归 | 原任务17项范围；本次图片/预取调用方 | 1083单元、毛织17 E2E、直接专项 | 48列表、158详情176图、6分支 | 已验证 | cold-repair-local；cold-repair-receipt-accepted.json | 同上 |
| SEAM-14e | IMAGE-01/PERF-01 | 高清预览同一原图、保持比例且体积更小，未知地址回退 | 高清图 | pda-image-preview.ts / staticImagePreview / 8静态高清图 | 显式安全地址、原件SHA、体积契约 | 重图20次打开/20次Esc、焦点、关闭/失败；打印原图 | 已验证 | detail-image-performance.json；R1/R2 | 同上 |
| SEAM-14d | PERF-01 | 本地每家族至少5样本，全部完整响应≤1000ms且绑定资源 | 性能 | 同一原采集器与实际候选构建 | 575有效样本/115家族 | 列表415/83、毛织45/9、成本15/3、详情100/20 | 已验证 | cold-repair-performance-unique-bound/combined-summary.json及三组严格资源证据 | 同上 |
| SEAM-16 | 用户正式部署 | 新SHA的Actions、线上版本、全量页面及正式性能全部正确 | T5 | main/正式HTTPS | 新部署后执行 | 本地证据不能代替正式站 | 已实现待验证 | 独立正式发布收据；旧正式失败保留 | Codex；正式候选SHA在发布收据绑定 |

表中相对证据均位于 output/playwright/seam-embroidery-unification；三组毛织/成本/详情性能原件位于 output/verification/wool-storage/performance/cold-repair-local。新增资源位于 public/thumbnails/ 与 public/previews/，版本、来源和SHA逐件登记在冻结清单和派生证明中。

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：首屏使用同一对象小图，显式声明的按钮可使用同源高清衍生图；原图身份、业务事实与上传图片保持。构建预取改变下载发现时机。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 原图及对象对应 | 通过 | 18源图片保持SHA，7新增小图与8高清保持比例；8高清均小于原件；R1独立像素对应检查 |
| 大图/关闭/失败/未知图片 | 通过 | 详情100性能样本按原图尺寸/字节选择真正重图；20打开和20Esc；原图身份焦点、安全地址/回退契约，毛织真实失败态 |
| 预取及初始化边界 | 通过 | 5新路由契约及既有2契约；不访问存储/不执行模块，旧入口规则保持；毛织及成本失败后回读证据 |
| Web/PDA/打印 | 通过 | 17毛织E2E含两种小屏、保存/实收/打印图片+QR就绪、失败和列设置；打印继续直接原图 |
| 全量列表/详情 | 通过 | 16类48列表、158详情176图和6分支，1024详情无主体横溢 |
| 当前本地性能与资源身份 | 通过 | 575/115各家族5样本，最大877.9ms，当前所有样本均≤1000ms；唯一资源集合实际200正文SHA全部匹配 |

## 最终结论

结论：通过

此结论只关闭本地T4修复。正式基准慢值、采集失败与本地网络诊断均保留，正式T5仍待新SHA部署及重新验收，没有性能例外。

## 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/wool/stage-display.ts`
- `src/components/ui/pda-image-preview.ts`
- `src/utils/static-image-thumbnail.ts`
- `src/utils/static-image-thumbnails.json`
- `vite.config.ts`

### 页面证据

- 版本：上述分支和基准HEAD+未提交候选；asset-version.json冻结130输入/1198资产，正式候选提交后由交付收据比对提交内容；服务 http://127.0.0.1:43183，完整任务路径和差异由最终receipt绑定。
- 证据：cold-repair-local 的158详情176图及6分支为该130/1198版本。48列表是此前131/1199版本，原身份保留；语义复用的差异仅删除比原件更大的fabric-main高清派生及映射，列表数据/原图/缩略图保持。其内容与当前资产不是字节相同；当前详情与全部合格性能重新核验。
- 图片：craft-static-derivative-final-proof.json、craft-derivative-geometry.json及R1/R2记录同一源、比例、来源SHA与明确弃用的冗余高清派生；没有用小图尺寸选择较轻对象。

### 性能结论

- 结论：通过
- 依据：当前合格样本为575/115，各家族5样本，最大877.9ms。列表415/83位于 cold-repair-performance-unique-bound，最大877.9ms；毛织45/9最大669.7ms，成本15/3最大764.4ms，详情100/20最大774ms，三者位于 output/verification/wool-storage/performance/cold-repair-local。导航起点0或可信操作起点，等待对象图解码、字体、动画和双帧，1000ms门槛未改。
- 资源身份：列表采集器正文未改，schema2包装器对每个唯一静态路径的实际首个200响应取正文SHA；重复200/304仅聚合引用，304明确无正文，不声称核验每个请求或每个context的缓存字节。每个唯一路径最终均须有匹配正文，首个失败/哈希错/未知路径/异常状态/标识冲突保持阻断；独立入口前后核对不替代实际响应。其余160样本也绑定冻结清单、入口和实际资源。
- 保留记录：原 cold-repair-performance 的415样本虽观测≤1000ms，但缺少响应绑定，只作历史观察；首次 cold-repair-performance-bound 的210观测有24慢值、最大2036.3ms及418捕获错误（417为304），不作通过，未删除或重标无效。原包装器、日志和SHA保存在 response-identity-v1-failed-backup。1MiB/s、25ms本地HTTP/2诊断2269–2358ms是额外传输风险，不作正式通过。正式旧5冷加载5501.3–6380.1ms及8秒采集超时不被本地结果覆盖。

### 验证命令

- `npm run build`：通过
- `node --import tsx --test tests/unit/static-image-thumbnail.test.ts tests/unit/craft-route-preload.test.ts tests/unit/pda-sewing-route-preload.test.ts`：通过
- `CUTTING_E2E_PORT=43233 PLAYWRIGHT_REUSE_EXISTING_SERVER=false npx playwright test tests/wool-management-fact-workflow.spec.ts --workers=1 --reporter=line`：通过
- `npm run check:prototype-design-governance -- --scope worktree --paths <完整24路径>`：通过
- `npm run check:list-page-governance -- --scope worktree --paths <完整24路径>`：通过

实际参数、退出结果和任务指纹在 cold-repair-receipt-accepted.json；该最终收据只在报告固定后生成。1083单元、17毛织E2E及直接专项日志保留。历史doc/旧verified收据精确全文成对保存在 cold-repair-pre-final-doc-history；旧收据不冒充新文档通过。聚合工具不支持复用既有检查，因此修正文档后实际强制重跑的范围如实登记，不改写旧哈希。首次红色图片契约、SVG canvas及编码器失败日志均保留。

### 例外

- 无。正式发布、线上页面和线上性能仍须独立完成；原型技术验证不代表真实工厂验收。
