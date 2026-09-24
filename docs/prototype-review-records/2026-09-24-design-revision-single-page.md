# 设计改款：同页创建与第一步视觉简化

## 1. 基本信息

- 日期：2026-09-24；记录模式：完整产品审查。
- 系统：PCS；管理端；角色：买手；任务：一次填写并保存或提交设计改款。
- 基线 HEAD：430bd9a1b9460cc0b69703584f92ea4978637f6b；分支：codex/design-revision-single-step。
- 工作树：/Users/laoer/Documents/higoods；验收服务：http://127.0.0.1:4734，当前工作树生产构建。
- 来源：用户本次两项要求及产品方案 §4 的 2026-09-24 补充。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：新建从弹窗改为完整第一步页面；首次保存同时保存基本信息、设计稿、BOM、费用与样衣要求；去掉重复标题和装饰性嵌套边框。
- 基线：AGENTS.md 第 4、5、7 节。其余加工、调拨、样衣完成、批量复制规则不修改。

### 实施与需求追踪

| 编号 | 原子需求／来源 | 实施位置与工作包 | 自动化及页面证据 | 状态 |
| --- | --- | --- | --- | --- |
| FORM-001 | 新建直接进入第一步／本次要求 1 | W1 页面入口、renderCreationBasicFields、new 页面临时表单 | single-page 测试：无弹窗、返回列表无新增任务 | 已验证 |
| FORM-002 | 同页保存基本信息、物料、费用及样衣／本次要求 1 | W2 createEngineeringIndependentSampling 可选创建输入、现有 BOM 事务；保存／提交处理器 | current-flow 单元测试；同页保存刷新、直接提交、缺物料后恢复 | 已验证 |
| FORM-003 | 删除重复标题和多余边框／本次要求 2 | W3 renderSchemeConfirmationStep、基本摘要、物料费用、样衣与底部操作区 | 1366×768、1280×768 截图；不横向溢出 | 已验证 |
| FORM-004 | 局部编辑和图片预览保持填写上下文／相关回归 | W3 refreshBuyerFormSections、PCS Esc 配置 | 明细增删、图片上传／删除／Esc 关闭、列表回归；各操作五次性能 | 已验证 |

实施顺序：W1 合并入口及临时输入 → W2 一次保存并沿用正式提交校验 → W3 简化边框及局部更新 → 当前构建浏览器验证。用户为需求确认人；实现验收由 Codex 执行，产品最终接受待用户查看。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 新建入口与同页填写 | 通过 | 取消前置弹窗，保存及直接提交浏览器验证通过 |
| 视觉与低分辨率 | 通过 | 标题及多余外框已删除，1366 与 1280 下页面不横向溢出 |
| 图片与防错 | 通过 | 图片上传校验、预览及 Esc 关闭，缺失物料提交恢复通过 |
| 性能与持久化 | 通过 | 29 个新建场景各五次均低于 500ms；保存后刷新回读正确 |


- 角色与页面模式：买手在一个页面连续填写；第一步与制作交接两步仍清晰区分。
- 数量：单位用量 × 样衣件数沿用现有口径，染后印不重复备料。单位与费用币种继续可见。
- 图片：本地款式图、物料图、上传设计稿沿用既有图片组件；缩略图与标识同块；上传非图片阻断，错误不丢输入。
- 防错：打开页面不建单；创建失败不增加任务；提交失败保留草稿并明确提示，后续在同一任务继续。
- 交互：新增／删除明细局部更新；Esc 只关闭大图，不触发旧创建弹窗关闭动作返回列表。
- PDA、打印、仓库／工厂交接：本次不改变入口和业务事实，不适用新增验收。
## 4. 问题标签

- 视觉干扰
- 组件误用

## 5. 主要问题与处理

| 问题 | 处理 |
| --- | --- |
| 基本信息创建后再填物料费用，操作割裂 | 新建直接进入完整填写页；实际保存时才生成任务 |
| 重复步骤标题、双重卡片、按钮外框 | 删除装饰外框，以标题、留白、软背景区分，保留输入框和表格分隔 |
| 旧 Esc 关闭列表包含 close-create | 删除旧弹窗关闭项，避免退出填写页 |
| 上传后提示已保存容易误解 | 改为已读取、随草稿或任务一起保存 |

## 6. 最终结论

结论：通过。正向核对两项用户要求与 FORM-001～004 均有实现及证据；反向核对差异仅涉及本次创建输入、页面简化及旧 Esc 清理。验证仅涉及原型 Mock，不代表真实业务已发生。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/pcs-independent-sampling.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/main-handlers/pcs-handlers.ts`

### 页面路由

- `/pcs/production-preparation/design-revision`
- `/pcs/production-preparation/design-revision/new`
- `/pcs/production-preparation/design-revision/:samplingTaskId`

### 验证命令

- `npm run build`：通过，437 个单元测试全部通过，生产构建完成。
- `node scripts/check-typescript-scope.mjs src/pages/pcs-independent-sampling.ts src/data/pcs-engineering-master-sampling.ts`：通过，范围内 0 错误；全仓其他范围 6 个既有错误。
- `CUTTING_E2E_PORT=4734 CUTTING_E2E_USE_PREVIEW=true CUTTING_E2E_TEST_TIMEOUT=90000 npx playwright test tests/pcs-design-revision-single-page.spec.ts tests/pcs-design-revision-create-upload-ui.spec.ts tests/pcs-design-revision-list-performance.spec.ts --workers=1 --reporter=line`：通过，3 项专项。
- 单页验证包含冷进入、刷新、打开／返回、缺目标提示、目标选择、改款要求、设计图上传／预览／Esc／删除、纸样选择、物料增删及目标 SKU／用量、费用增删及输入、样衣数量及规格行增删、完整保存与刷新回读、已有草稿提交、缺物料保留草稿再恢复、直接提交。
- 浏览器：Chromium 149.0.7827.55；1366×768 与 1280×768；5 个独立浏览器上下文，冷进入无缓存，后续刷新和操作保留缓存。保留完整 Mock 数据。操作从事件到目标结果及可见图片解码、两帧绘制；冷进入从导航起算。
- `npm run check:list-page-governance:static`：通过，558 页面。
- `npm run check:prototype-design-governance`：通过，3 个受管文件均由本记录覆盖。
- 原始性能：`evidence/2026-09-24-design-revision-single-page-performance.json`、`evidence/2026-09-24-design-revision-single-page-list-performance.json`。新建页 29×5 样本最大 313.5ms；列表 53×5 样本最大 368.5ms，全部 <500ms。
- 页面截图：`test-results/playwright/pcs-design-revision-single-page-新建直接填写全部内容，保存和直接提交全流程及五次性能/single-page-0.png`、`single-page-4.png`、`single-page-bottom-0.png`、`single-page-bottom-4.png`。
- `codegraph sync`：通过，索引已同步。

### 真实图片验证

本地 `public/dress-sample-1.jpg` 用于隔离浏览器上传验证；款式档案和目标 SKU 图片沿用已有本地素材及其对象标识。设计稿支持大图和 Esc 关闭；图片组件的加载失败说明保留。Mock 图不作为真实打样成果。

### 例外

- 无新增性能例外，全部按 <500ms 验证。
- 工作区 AGENTS.md 为用户已有未提交修改，不纳入本次提交，不生成会吸收该差异的全工作区收据。
