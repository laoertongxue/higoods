# 款式与规格档案技术引用清理验收

依据 [AGENTS.md](../../AGENTS.md)，继承abc80b6a已发布版本，仅验本轮REF-01～08。

## 基本信息

- 日期：2026-10-12
- 任务 / 需求编号：REF-01～REF-08，款式与规格档案技术引用删除
- 验证人：Codex主代理；用户明确删除范围，技术验收不代签产品接受

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：两页技术引用页签、专属查询和展示直接删除；共享有效页签清单阻断旧事件。无存储格式、仓库、技术包及核价模块或路由修改。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 款式详情技术引用删除 | 通过 | REF-01，关联技术版本的款式直达、刷新及源码/渲染专项 |
| 规格详情技术引用删除 | 通过 | REF-02，对应SKU直达、刷新及源码/渲染专项 |
| 专属代码删除 | 通过 | REF-03，technicalTab、两个正文分支、两条导入、引用区域及跳转均删除 |
| 旧事件阻断 | 通过 | REF-04，单元及浏览器伪造technical按钮不改变正文和活动页签 |
| 关联数据与下游 | 通过 | REF-05，档案只读快照不变、技术包独立页面、BOM核价工作流、产品审批/生命周期防错通过 |
| 保留页签与设备 | 通过 | REF-06，款式六页签、规格五页签均可切换；1366×768及1280×720无主体横向溢出 |
| 图片 | 通过 | 本轮未换原图片，黑色衬衫演示记录保留对应实拍图；可视图片解码、名称与对象可读 |
| 性能 | 通过 | REF-07，75个完整响应样本、15家族各5次，最大261.69999998807907ms |
| 两轮逐项审查 | 通过 | REF-08，[矩阵实质审查段](../product-archive-technical-reference-cleanup.md) |
| 新增保存/迁移及附件字节 | 不适用 | 仅删除只读引用浏览，未改变读写格式、附件实体或保存动作 |
| PDA、打印、导入导出 | 不适用 | 本轮未改其入口、运行逻辑或数据契约，不声称重新验收这些未变流程 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/pages/pcs-product-archives.ts`

### 页面证据

- 版本：`codex/product-archive-technical-reference-cleanup`，HEAD `abc80b6a5716fb62b031dbdbd66f2c561a2b8b9c`及本轮未提交差异。源码SHA256 `1edbb87db76860598712d56739692f529d4788c880f3038cc0ae7a96375263be`，浏览器脚本SHA256 `6f4ef95aceeabc14bf22bd67360b275b511b26e261acf2cf328d50d4913af139`，运行index SHA256 `29b3fa4cfa3c5784db8479d7f097030eb52d00515d8c55e659fe5eeae2d9a5f9`。服务 `http://127.0.0.1:43222`，PID96414，工作树 `/Users/laoer/.codex/worktrees/simple-materials-main-integration/higoods`；Chromium149.0.7827.55、上海时区、网络缓存禁用，独立上下文，1366×768和1280×720。
- 证据：[原始结果](../verification-evidence/2026-10-12-product-technical-reference/evidence.json)、[款式1366](../verification-evidence/2026-10-12-product-technical-reference/style-1366.png)、[规格1280](../verification-evidence/2026-10-12-product-technical-reference/sku-1280.png)。命名路由 `/pcs/products/styles/style_demand_SPU_QC_001`、`/pcs/products/specifications/skuSeed_style_demand_SPU_QC_001_001`；两页直达/刷新/保留页签/旧事件通过，技术包独立路由按原版本ID直达通过。

### 性能结论

- 结论：通过
- 依据：[性能统计](../verification-evidence/2026-10-12-product-technical-reference/performance-summary.json)。15个命名冷加载、刷新及保留页签家族各5个样本，75个完整响应均<=1000ms，最大261.69999998807907ms；真实导航/事件开始至内容、必要图片、字体与两帧绘制完成。未增写操作，不把未涉及模块纳入性能倍增。

### 验证命令

- `node --import tsx --test tests/pcs-r1-product-rules.test.ts`：通过
- `node --import tsx tests/pcs-engineering-bom-version-workflow.spec.ts`：通过
- `node --import tsx --test tests/workflow-governance/affected-checks.test.ts`：通过
- `npm run build`：通过
- `node --import tsx --test tests/browser-contracts/pcs-product-reference-removal.test.ts`：通过
- `npm run check:prototype-design-governance -- --scope worktree --paths src/pages/pcs-product-archives.ts,docs/prototype-review-records/2026-10-12-product-technical-reference.md`：通过
- `npm run check:list-page-governance -- --scope worktree --paths src/pages/pcs-product-archives.ts,docs/prototype-review-records/2026-10-12-product-technical-reference.md`：通过

原基线的旧断言失败保存在 `/tmp/product-tech-baseline.log`，已经更新到当前销售页签名称和技术引用删除要求。最终收据位置 `/tmp/product-technical-reference-final/task-receipt.json`，冻结本轮文件后生成；本记录不代表GitHub或Vercel发布。

### 例外

- 无
