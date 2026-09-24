# PCS 测款商品绑定修正审查

## 1. 基本信息
|项目|内容|
|---|---|
|记录日期|2026-09-24|
|相关需求 / 任务|BIND-001～005，来源 docs/product-design/PCS测款商品绑定修正-2026-09-24.md|
|记录模式|完整产品审查|
|涉及系统|PCS|
|涉及页面路径|/pcs/testing/orders、/pcs/testing/orders/create、/pcs/testing/orders/:id、/pcs/products/styles、/pcs/products/styles/:id|
|端类型|管理端|
|主要角色与任务|买手选择商品和 SKU 建单；档案人员维护商品买手与基础配置关联|

## 2. 影响判定
- 用户可见影响：有
- 判定依据：新建页等宽、商品买手只读、商品属性关联基础配置、旧演示商品补齐配置引用。未访问数据库，未变更线上数据。
- 设计基线：AGENTS.md 第 4、5、7 节。

## 3. 自查结论
|检查项|结论|说明|
|---|---|---|
|角色、任务与页面模式|通过|建单保留商品与 SKU 选择；买手在商品档案维护|
|文案、状态、数量与单位|通过|商品属性名称来自基础配置；未设或未指定三级类目明确区分；未知新商品不套用 Mock 值|
|扫码、真实图片与对象识别|通过|沿用商品档案对应实拍图；缩略图、SKU 图和大图验证；图片失败阻断|
|防错、危险确认与主管兜底|通过|空商品、空 SKU、无绑定买手、错误 SKU、重复 SPU 阻断；保留历史人工属性|
|交接、跨端事实与异常追溯|通过|买手与商品属性保持商品档案唯一来源，配置 ID 解析当前名称；没有跨端变更|
|低分辨率、PDA、弱网与上传恢复|通过|1366×768、1280×720；新建与列表边界一致，无横向溢出；PDA、上传不适用|
|命名路由、交互、图片大图与打印|通过|原始样本与版本绑定见证据 JSON；打印不适用|

## 4. 问题标签
- 选不对
- 协作断裂
- 视觉干扰

## 5. 主要问题与处理
|问题|标签|影响角色|处理方式|是否仍有风险|
|---|---|---|---|---|
|建单页窄于列表|视觉干扰|买手|移除最大宽度，两端边界一致|否|
|买手由建单手填|选不对|买手|读取商品绑定，缺失阻断|否|
|商品属性大片待完善|协作断裂|商品管理|已知 Mock 配置引用补齐、旧存储升级、配置名称实时解析|真实新商品仍需建立实际关联|
|编辑档案后演示单换绑|协作断裂|买手|五张种子测款单固定商品 ID|否|
|逐商品重复读取字典|视觉干扰|管理端|每轮列表共用配置上下文，保持跨轮实时读取|保留修复前 684.3ms 原始失败样本|

## 6. 最终结论
结论：通过
产品确认依据为用户 2026-09-24 三条要求，页面产品接受待用户审阅。当前改动位于 codex/cekuanyouhua，尚未提交与推送。

## 7. 变更覆盖与验证
### 受管文件
- `src/data/pcs-style-archive-types.ts`
- `src/data/pcs-style-archive-bootstrap.ts`
- `src/data/pcs-style-archive-repository.ts`
- `src/data/pcs-style-product-information.ts`
- `src/data/pcs-testing-order-repository.ts`
- `src/pages/pcs-product-information.ts`
- `src/pages/pcs-testing-order-create.ts`
- `src/pages/pcs-testing-order-detail.ts`

### 页面路由
- `/pcs/testing/orders`
- `/pcs/testing/orders/create`
- `/pcs/testing/orders/to_seed_normal`
- `/pcs/products/styles`
- `/pcs/products/styles/style_demand_PRJ_202603_006`

### 验证命令
- 三项测款专项检查：通过
- `npm run check:pcs-product-testing-v1`：通过
- `npm run build`：通过（438 项单元测试；最终构建结果另由 task-receipt.json 绑定）
- `npx vite build`：通过
- 全量 `npx tsc --noEmit`：失败，main 基线有 6 条 FCS/PMS 既有错误；本次修改范围无新增错误，基线差异检查另留存
- `npm run check:list-page-governance:static`：通过
- `npm run check:prototype-design-governance -- --all`：通过（8 个用户可见受管文件）

### 图片与 Mock 来源
沿用仓库已有款式与 SKU 实拍素材：蜡染衬衫 `public/materials/pcs-reviewed/batik-black.jpg` 与 `batik-white.jpg` 等，商品档案绑定相同 URL。新建、详情与档案保持图片与商品标识同块；大图复用全局组件。临时拦截真实图片资源验证失败文案及保存阻断，解除拦截后恢复。配置绑定是原型 Mock 数据，不声称真实商品运营属性。

### 验证版本与证据
工作树 `/Users/laoer/.codex/worktrees/cekuanyouhua/higoods`，基线 HEAD `5b349675874c3e97fcd7bcf282c3f915942ac395` 加任务差异。预览 http://127.0.0.1:4192；浏览器隔离验收配置，不清理用户日常浏览器数据。
最终浏览器记录、源码 SHA-256 与原始样本：`2026-09-24-pcs-testing-product-binding-evidence.json`。可复现脚本及截图：`output/playwright/pcs-binding/`。测试后恢复隔离验收环境测试前的 localStorage，撤销测试建单、买手和属性修改。

### 例外
- 无性能豁免。全量 tsc 的 6 条既有错误不计为通过，不在本任务改动范围。PDA、打印、数据库不适用。

### 最终实测汇总
50 次首屏完整加载（含可见图片）最大 355ms；270 次交互最大 156.70000000298023ms，每个动作重复 5 次，全部严格低于 500ms。包括正常建单、SKU、防空、无买手、图片失败/恢复、档案配置维护、买手查询/排序/导出/列设置。1366×768 和 1280×720 的列表与新建左右边界均一致。
源码与专项测试摘要见证据 JSON；完整任务收据位于 `/private/tmp/pcs-binding-final/task-receipt.json`。完整 diff 已人工审查，未修改路由注册、全局布局、公共字典实现和其他模块。

### main 集成复验（本节取代此前未发布状态）
用户已授权本地合并 main 并推送 GitHub main。在独立发布工作树合入 main `d396c3ed70e95367d87da4645393afd759d288af`，保留最新测款延迟初始化与生产准备准入逻辑。三项测款专项及生产准备准入回归通过；类型检查仍为相同 6 条既有错误。
当前实现与复验 SHA、工作树、逐项原始样本及可复现脚本见证据 JSON 的 mainIntegration。重新验收 50 次加载（最大 311.29999999701977ms）及 270 次交互（最大 228.70000000298023ms），全部低于 500ms。最终发布收据：`/private/tmp/pcs-cekuan-release-receipt.json`；Vercel 正式部署在推送后通过 GitHub 绑定 SHA 的 Production 状态核验。

最终发布还合入并保留并行 main 提交 `0cf32afc`（织带厂存储恢复），在集成提交 `d26868ab400888a5028ec4aa87ed04b30ca8d46e` 构建后重新执行全部 50 次加载、270 次交互，最大分别为 198.29999999701977ms、65.8999999910593ms，全部通过。最终源码及主渲染入口摘要和测量脚本已更新到 mainIntegration。发布构建单元测试为 450 项通过。
