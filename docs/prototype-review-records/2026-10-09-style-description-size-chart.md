# 款式档案商品描述与尺码资料原型审查

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 日期 | 2026-10-09 |
| 需求 | DESC-001/002、SIZE-001/002/003、IMAGE-001、SAVE-001、PERF-001 |
| 记录模式 | 完整产品审查 |
| 系统 | PCS |
| 页面 | `/pcs/products/styles/:id`、`/pcs/products/styles/:id/edit?tab=sales`、`/pcs/products/styles/new` |
| 端类型 | 管理端 |
| 角色／任务 | 商品资料维护人员维护描述、尺码资料及图片 |
| 版本 | detached HEAD `155144308f6b2931a8acb229a579e04ec99af41d` + 本次任务 diff |
| 工作树 | `/Users/laoer/.codex/worktrees/a924/higoods` |
| 实际服务 | 用户预览 :4207 与隔离验收 :4208，两个进程 cwd 都是本工作树，读取同一 dist |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：完整线上默认描述、工厂表、原始示意图、全量尺码／参数、国家设置、生成及图像操作；编辑／详情和复制读取同一档案。
- 基线：AGENTS.md 第 4、5、7 节。需求、计划和交付矩阵见本任务同名前缀文档。
- 原型边界：上传绑定到当前浏览器本地档案，不调用线上上传或 TikTok 发布接口。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 沿用管理端资料页签和路由 |
| 文案、状态、数量与单位 | 通过 | 中文动作；尺寸必须填写；支持范围和 free，不推算缺失值 |
| 真实图片与对象识别 | 通过 | 14 选项使用线上 13 个原始 JPG；款式主图仍来自现有实拍图台账 |
| 防错与恢复 | 通过 | 无选择／空值阻断；坏图／超限提示；失败输入保留；五轮冲突阻止旧覆盖 |
| 低分辨率、局部更新与性能 | 通过 | 1366×768、1280×720；全部选项与受影响动作五轮；6023 个通过样本，最大819.4ms |
| 路由、图片大图与持久保存 | 通过 | 冷进入／刷新／SPA、描述／工厂／国家／Blob 读回；字体颜色五轮保存重开 |

## 4. 问题标签

默认模板缺失、格式丢失、示意图简化、选项与生成行为不完整、重复编码图片。上一版 495 样本仅证明旧版简化实现，不用于本版验收。

## 5. 主要问题与处理

线上商品 229039 的描述是可编辑 HTML 尺码表，不是嵌入图片。保留完整印尼语模板、600px 黑色表头、灰白行、标题和客服说明，默认参考尺寸严格按截图。生成和查看尺寸图片另有入口。原来的在线 Tag_1.png 链接返回 404，原型默认静态参考图从同一表格绘制，并允许用户生成／替换原始 PNG。

14 示意图、372 尺码、41 参数的标签和顺序与线上 DOM 全量比较一致。预留欧／美／英码按线上当前脚本仅保留选择，不擅自推算换算。生成前选择，填写后插入到商品描述、独立工厂表或启用国家；替换已有尺寸块，保留其他正文。

重复插入相同表格时复用当前页面已生成的 PNG Blob；尺寸变化重新编码。字体工具切换到受限 CSS span，避免 font 标签被过滤后丢失格式；引号字体及链接参数重复保存保持一致。保存仍采用既有 PCS IndexedDB 同一记录／附件事务，无业务 localStorage 后备。

## 6. 最终结论

结论：通过

本地原型验证状态 verified。需求八项均有实现与直接证据，未声明 GitHub 交付、Vercel 发布或产品 accepted。线上业务资料未修改，默认尺寸仅为原型静态参考，不能当作实际款式的工厂标准。

性能硬门禁：通过。完整版本第 5～9 轮及最后格式修正的第 10～14 轮相关回归均通过，6023 个采样最大819.4ms，最后修正后的冷进入／刷新最大220.4ms；每项至少五轮。早期长批次、PNG 重复编码和前台绘制复测前的慢样本都保留在 final/attempt*.json，不用平均值隐藏。复测将 Chrome 窗口置前台并保持验收页可见，最终没有门禁例外。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/pcs-style-size-chart.ts`
- `src/data/pcs-style-size-chart-options.ts`
- `src/data/pcs-style-archive-types.ts`
- `src/data/pcs-style-archive-repository.ts`
- `src/data/pcs-product-archive-fixtures.ts`
- `src/data/generated/pcs-record-baseline.json`（仅款式集合）
- `src/pages/pcs-style-content-editor.ts`
- `src/pages/pcs-product-archives.ts`

### 页面路由

- `/pcs/products/styles/style_demand_PRJ_202604_013/edit?tab=sales`
- `/pcs/products/styles/style_demand_PRJ_202604_013?tab=sales`
- `/pcs/products/styles/new?tab=sales`

### 验证命令

- `node --import tsx --test tests/unit/pcs-style-size-chart.test.ts`：通过，7 项。
- `npm exec vite build`：通过。
- `npm run build`：通过，642 项测试、工程专项类型检查及最终 Vite 构建。
- `npm run check:prototype-design-governance -- --all --base HEAD`：通过，8 个受管文件覆盖完整。
- `npm run check:list-page-governance`：通过，列表静态门禁、模板类型契约及产品审查覆盖通过。全仓 tsc 有三处既有错误，位于 FCS 接收同步和 TMF 采购文件，本任务文件无错误；未越界修改。项目受影响检查和构建结果以最终任务收据为准。
- CodeGraph sync 已执行；最终健康状态由收据核对。
- 最终任务收据：`output/playwright/style-content/online-parity/task-receipt.json`，检查结果与最终差异摘要以该文件为准。
- 浏览器：`output/playwright/style-content/online-parity/final/summary.json`、`final/round-*.json`、`final/native-uploads.json`、`final/conflicts.json`、`final/spa.json`、`final/navigation.json`、`final/format-final-loads.json`、`final/format-reopens.json`。
- 浏览器脚本：同目录上一层 `acceptance.js`、`extra.js`、`format-persistence.js`；原生文件选择通过 CUA filechooser，未用合成 change 代替实际上传。
- 原始选项和资源：`option-parity.json`、`source-evidence.json`；13 张原图逐字节与来源一致，其他 baseline 集合与 HEAD 一致。
- 截图：`final-description-fullscreen.jpg`、`final-size-chart-tool.jpg`，在用户 :4207 新标签页读取，没有保存或清空用户资料。

### 真实图片验证

当前款式沿用 `/materials/pcs-reviewed/lace-top-black.jpg` 和 `lace-top-white.jpg`。生成 PNG 按当前测量值绘制，或选择原始 JPG／PNG／WebP；业务 JSON 仅存文件引用，原始 Blob 存既有 files。失败保存前后持久记录不变，重试成功后立即读回；复制未重复附件字节。读取时不写整批种子。

### 例外

- 无性能门禁例外。
- PDA、打印、真实线上商品、发布：不适用，未改对应入口。
- 数据库结构升级、旧源迁移／清理：不适用，新增可选记录字段，未修改数据库结构与迁移机制。
