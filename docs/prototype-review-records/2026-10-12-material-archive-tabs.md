# 基础物料档案页签与附件简化验收

依据 [AGENTS.md](../../AGENTS.md)。本记录只证明TAB-v1的本地原型改动，继承已发布d4b7c34a的其余业务。

## 基本信息

- 日期：2026-10-12
- 任务 / 需求编号：TAB-01～TAB-12，基础物料档案页签与附件简化
- 验证人：Codex主代理；用户提出范围，技术验收不代签产品接受

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：面料、辅料、纱线主档/SKU取消独立资料页签；SKU取消加工计划与创建入口；附件归入基本资料、规格及加工关系并限制当前类型。沿用原存储事务、外部路由与下游事实，未删除用户文件。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 加工计划页签与档案专属代码删除 | 通过 | TAB-01/02：九项专项源码/渲染检查及三类SKU直达；专用查询函数、按钮、事件和导入删除 |
| 主档核心资料归入基本资料 | 通过 | TAB-03：三个主档上传通用说明、保存、刷新回读；图库沿用原图片 |
| SKU核心资料归入规格 | 通过 | TAB-04：三类基础SKU上传说明、保存、刷新、Blob字节回读 |
| 按当前工艺限制附件类型 | 通过 | TAB-05：染色两类，其余三种加工固定一种；基础仅图片/规格说明 |
| 旧资料仍可读取且不混所有者 | 通过 | TAB-06：八用途恰好可达一次；主档不展示子SKU附件；原记录读前读后一致 |
| 附件与执行定义原子保存 | 通过 | TAB-07：真实IndexedDB记录和Blob回读；补充执行文件产生新内部版本，历史引用不变 |
| 失败及离开恢复 | 通过 | TAB-08：注入配额错误后记录和Blob不变，文件输入保留，重试通过；切换取消/确认；伪造用途/归属阻断 |
| 直接上下游与相邻物料 | 通过 | TAB-09：工厂计划冻结来源、采购/BOM防错、TMF引用及加工模式专项；页面计量/成本/包装和耗材配件列表 |
| 管理端布局 | 通过 | TAB-10：1366×768、1280×720，真实页面无主体横向溢出 |
| 图片与附件查看 | 通过 | 原物料图片源不变；新色样验收用白黑棉针织布实拍资料；可视图片解码及附件大图开关通过 |
| 性能完整响应 | 通过 | TAB-11：420样本、82家族、每家族至少5次，最大243.2000000178814ms |
| 两轮逐项正反向审查 | 通过 | TAB-12：[矩阵审查段](../material-archive-tabs-cleanup.md)，已修复隐藏编辑分支和旧计划测试夹具，未放宽守卫 |
| PDA、打印与业务导入导出 | 不适用 | 本轮未改变其运行代码、入口、字段或存储格式，保留既有引用；不以本次验收声明这些未变操作重新验收 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/pages/pcs-material-archives.ts`

### 页面证据

- 版本：`codex/material-archive-tabs-cleanup`，HEAD `d4b7c34a2dd1aa69e454c5a0322aa4c25202af8f`加本次未提交差异。源码SHA256 `284b9595847f8c35725a769865b38c93242f33ba3dcd547756d60e8468e45983`，浏览器脚本SHA256 `b2fc30941bc2705ab1079172d0f0af72bf7bc07144171d41edaf9ec2f93aab8e`，运行index SHA256 `1fa0661a7554d1482256e0ec013992109c22948eca1c07ec7ee2dd6b038d83ae`。服务 `http://127.0.0.1:43222`，Vite生产预览PID96414、工作树 `/Users/laoer/.codex/worktrees/simple-materials-main-integration/higoods`；Chromium149.0.7827.55，上海时区，网络缓存禁用；1366×768和1280×720，独立上下文，不修改用户浏览器资料。
- 证据：[原始结果](../verification-evidence/2026-10-12-material-archive-tabs/evidence.json)、[性能统计](../verification-evidence/2026-10-12-material-archive-tabs/performance-summary.json)、[面料规格](../verification-evidence/2026-10-12-material-archive-tabs/fabric-spec-1366.png)、[纱线规格](../verification-evidence/2026-10-12-material-archive-tabs/yarn-spec-1280.png)、[染色附件](../verification-evidence/2026-10-12-material-archive-tabs/dye-process-1366.png)、[印花附件](../verification-evidence/2026-10-12-material-archive-tabs/print-process-1280.png)。路由为 `/pcs/materials/fabric|accessory|yarn/<主档ID>`及其SKU；主档ID与SKU记录在浏览器脚本中逐项固定。附件保存后逐条读持久记录、Blob及刷新页面。

### 性能结论

- 结论：通过
- 依据：每个命名冷加载、刷新、切换、文件选择、保存成功/失败、确认取消/放弃及图片开关至少5个完整响应样本；输入相同事件链重复读记录不扩充家族。起点为导航或真实事件，终点含必要图片、字体和两帧绘制；保存等待本次文件已持久及DOM内容就绪。完整原始值和环境见上述JSON，最大243.2000000178814ms，无超时样本。

### 验证命令

- `node --import tsx --test tests/unit/pcs-material-archive-tabs.test.ts`：通过
- `node --import tsx --test tests/unit/pcs-material-archive-tabs.test.ts tests/pcs-r1-material-plans.test.ts tests/unit/tmf-material-references.test.ts tests/unit/pcs-material-process-roundtrip.test.ts tests/unit/pcs-material-classification-cleanup.test.ts tests/pcs-simple-material-downstream.test.ts tests/workflow-governance/affected-checks.test.ts`：通过
- `node scripts/check-typescript-scope.mjs src/pages/pcs-material-archives.ts`：通过
- `npm run build`：通过
- `node --import tsx --test tests/browser-contracts/pcs-material-archive-tabs.test.ts`：通过
- `npm run check:prototype-design-governance -- --scope worktree --paths src/pages/pcs-material-archives.ts,docs/prototype-review-records/2026-10-12-material-archive-tabs.md`：通过
- `npm run check:list-page-governance -- --scope worktree --paths src/pages/pcs-material-archives.ts,docs/prototype-review-records/2026-10-12-material-archive-tabs.md`：通过

83项相关专项及构建815项通过。执行日志保存在 `/tmp/material-archive-tabs-final/`；初次校准/旧夹具失败按原版本保留，见矩阵审查段。最终任务收据位置 `/tmp/material-archive-tabs-final/task-receipt.json`，冻结文件后生成；GitHub及Vercel不是本轮已执行发布。

### 例外

- 无
