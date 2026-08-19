# 工序工艺字典默认顺序删除原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-19 |
| 相关需求 / 任务 | ORDER-001～ORDER-008：删除跨款式工序默认顺序并保留任务清单边界 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS、PCS |
| 涉及页面路径 | `/fcs/production/craft-dict`；`/fcs/process/task-breakdown`；PCS 技术包工序路线 |
| 端类型 | 管理端 |
| 主要角色与任务 | 生产计划、跟单、工艺人员查询工序能力并按每款技术包维护和确认生产路线 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：字典页删除“查看基础工序顺序”入口及弹窗；页面说明改为每款顺序以对应技术包确认路线为准；技术包来源由“字典基础路线”改为“工序字典引用”；空技术包不再展示硬编码生产路线；任务清单同时保留生产准备工序边界与 KOL-GOTO 整单任务说明。

当前审查基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 字典继续是管理端结果查询页；款式顺序回到技术包维护和确认。 |
| 文案、状态、数量与单位 | 通过 | 删除跨款式顺序编号；保留工序任务边界；来源文案不再暗示默认路线。 |
| 扫码、真实图片与对象识别 | 不适用 | 本次不新增或修改款式、物料、扫码和图片对象。 |
| 防错、危险确认与主管兜底 | 通过 | 保留同 BOM 水溶／染色及染色／印花的必要顺序守卫。 |
| 交接、跨端事实与异常追溯 | 通过 | 已确认技术包路线仍进入生产单快照和下游任务；只删除字典兜底。 |
| 低分辨率、PDA、弱网与上传恢复 | 不适用 | 本次为管理端字典与路线来源调整，不涉及 PDA、上传和弱网。 |
| 命名路由、交互、图片大图与打印 | 通过 | 当前分支服务实测字典路由返回 200，默认顺序入口不存在，“匹染”详情可打开和关闭；图片大图和打印不适用。 |

## 4. 问题标签

- `读不懂`
- `状态抽象`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 字典默认顺序被误解为所有款式的统一生产路线 | 读不懂 | 生产计划、跟单、工艺人员 | 删除入口、弹窗、排序值和技术包兜底读取 | 否 |
| “字典基础路线”把资料来源表达成路线来源 | 状态抽象 | 跟单、工艺人员 | 改为“工序字典引用”，只说明资料来源 | 否 |
| 空技术包自动出现硬编码生产路线 | 状态抽象 | 跟单、工艺人员 | 无工序时保持为空，只允许 BOM 真实要求生成准备工序 | 否 |

## 6. 最终结论

结论：通过

说明：

- 代码、专项契约、目标类型检查、构建、CodeGraph 和三个命名页面已按每款技术包路线收口。
- 用户已于 2026-08-19 确认“无跨款式默认顺序”的业务口径，并授权直接合并发布到 GitHub `main`。
- `check:tech-pack-process-route` 的现行产前版样衣和 BOM 复核夹具已补齐，检查完整通过；没有为通过检查而放宽业务门禁。
- 全量 `tsc --noEmit` 的既有配置与类型基线问题单独列为例外，不替代本任务的目标类型、构建、专项和页面证据；标准列表全库检查已在干净 `main` 上完整通过。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/process-craft-dict.ts`
- `src/data/tech-pack-process-route.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-tech-pack-task-generation.ts`
- `src/pages/production-craft-dict.ts`
- `src/pages/task-breakdown.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/process-domain.ts`

### 验证与文档支持文件

- `package.json`
- `scripts/check-process-craft-default-order-removal.ts`
- `scripts/check-process-craft-final-taxonomy.ts`
- `scripts/check-production-craft-dict-page.ts`
- `scripts/check-tech-pack-process-route.ts`
- `scripts/helpers/technical-data-version-fixtures.ts`
- `docs/product-design/工序工艺字典默认顺序删除总体设计.md`
- `docs/product-design/工序工艺字典默认顺序删除实施计划.md`
- `docs/product-design/工序工艺字典默认顺序删除需求追踪与交付矩阵.md`

### 页面路由

- `/fcs/production/craft-dict`
- `/fcs/process/task-breakdown`
- `/pcs/technical-data/tech-packs`

### 验证命令

- `npm run check:process-craft-default-order-removal`：通过；默认顺序、显式款式路线、同 BOM 必要依赖和空技术包四项契约均通过。
- `npm run check:production-craft-dict-page`：通过；默认顺序已删除，字典详情交互回归通过。
- `npm run check:process-craft-final-taxonomy`：通过。
- `npm run check:tech-pack-process-route`：通过；默认顺序删除、显式路线、产前版样衣要求和 BOM 复核门禁完整通过。
- `npm exec tsc -- --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --strict --skipLibCheck --allowImportingTsExtensions --lib ES2022,DOM src/data/fcs/process-craft-dict.ts src/data/tech-pack-process-route.ts src/data/pcs-technical-data-version-types.ts`：通过。
- `npm exec tsc -- --noEmit`：失败；项目当前全量基线存在 `.ts` 扩展名的 `TS5097` 配置冲突及多个无关既有类型错误。
- `npm run build`：通过；Vite 生产构建完成，仅有既有大 chunk 提示。
- `npm run check:prototype-design-governance -- --all`：通过；首次运行因本记录仍为“待运行”而失败，补齐明确结果后重跑通过，覆盖 9 个用户可见文件和 1 份审查记录。
- `npm run check:list-page-governance`：通过；在干净 `main` 上扫描 358 个页面，17 个历史基线有效，标准列表模板与 Chromium 列拖拽检查通过。
- Playwright 命名页面验收：通过；`/fcs/production/craft-dict` 无默认顺序入口且“匹染”详情可开关；`/fcs/process/task-breakdown` 可见生产准备、KOL-GOTO 和合并任务三条边界；从 `/pcs/technical-data/tech-packs` 进入当前已发布技术包后，工序工艺页显示染色第 1 步、印花第 2 步和“路线待跟单确认”；浏览器控制台无错误。
- `codegraph sync /Users/laoer/Documents/higoods` 与 CodeGraph 状态：通过；真实 `main` 工作树索引 1517 个文件、46806 个节点、160033 条边，无待同步文件。

### 例外

- 全量 `tsc --noEmit` 当前不适合作为本任务门禁；目标文件类型检查及正式构建均通过。
- 临时旧分支上，全库列表检查曾因本任务未修改的 `src/pages/adjustments.ts` 与历史基线不一致而阻断；只拣选本次提交到干净 `main` 后，该文件恢复基线且完整检查通过，证明旧分支历史未被带入主线。本次修改的 `src/pages/task-breakdown.ts` 已声明列表模式并使用标准列表组件。
- 当前技术包 Mock 只出现“物料要求推导”来源，浏览器无法直接展示“工序字典引用”；该来源类型和文案由专项源码契约验证。
