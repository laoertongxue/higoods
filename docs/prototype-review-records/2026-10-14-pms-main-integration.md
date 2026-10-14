# 采购管理合并 main 增量审查

依据 `AGENTS.md` 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01，继承已完成采购逐项实施的验收边界。

## 基本信息

- 日期：2026-10-14
- 任务 / 需求编号：PMS-MAIN-PUBLISH，继承采购管理806条追踪与六对象清退范围
- 验证人：Codex 主代理，技术验证不代表用户产品接受

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：将采购实现5df8cffe与当前main fe203b8d整合，采购建议快速入口改为读取当前页面自身事实；保留main的PCS独立加载、PDA登录、缩略图及Caddy配置。页面共享缩略图保留同对象原图入口。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 合并范围 | 通过 | 原238任务路径显式暂存，main新增5个提交保留；新增本记录及其直接证据。未覆盖其他工作树或本地主目录的无关改动。 |
| 冲突及旧对象引用 | 通过 | src/main.ts与采购链路检查器两处冲突已解决；自动合并重新引入的inventory-monitor及bom-templates动态导入已解除，六对象无活动入口。 |
| 业务数量和状态 | 通过 | 合并资产运行30项PMS业务与交互用例通过，采购、面辅料、KOL、库存、物流、请付款及独立刷新回读正常。未改变原数量与状态规则。 |
| 测试时序 | 通过 | 首轮备货款evaluateAll在弹窗异步挂载前取空数组；失败快照已有有效候选，未改产品时单项复测通过。用例补等候选择框可见，完整30项复测通过，无固定延时。 |
| 保存与附件 | 通过 | 直接回读用例验证主单、关联与日志保存；未新增存储模型或旧源写入。未受影响的附件原子保存、恢复证据沿用原版本审查。 |
| 管理端布局 | 通过 | Chrome1366×768与1280×720实际页面主体无横向溢出，合并版本截图保存在本记录证据目录。 |
| 图片对应及大图 | 通过 | 首屏女式基础圆领短袖读取同对象192px WebP缩略图；大图读取765px原始tee-black.jpg，图片实际加载，Esc关闭成功。 |
| 菜单、路由及默认入口 | 通过 | 原采购9组21页30项保持，现行检查器验全部图标与目标地址、采购默认入口及已退役地址；WLS菜单使用main版本。 |
| 性能 | 通过 | 21路由各5次完整首访样本最大573.5ms；P1/P2页面切换及局部操作原始值见两批日志，全有效样本不超过1000ms。 |
| PDA及实物打印 | 不适用 | 本次采购管理桌面合并增量未改变员工PDA业务或打印映射。main既有PDA登录优化保留，采购电子打印用例照常通过。 |

## 最终结论

结论：通过

本记录只补合并的新依赖、入口与测试等待影响。原完整实施、逐按钮清单与806条矩阵保留在2026-10-14-pms-procurement-alignment.md及pms-alignment-20261013目录，不改写其原版本和历史失败。当前AGENTS.md的发布目标已由原Vercel调整为GitHub Actions加Caddy，按当前文件核验。最终技术收据在此记录冻结后生成，不预填机器结果或远端发布状态。

## 变更覆盖与验证

### 受管文件

- `src/main.ts`
- `src/pages/pms/shared.ts`

### 页面证据

- 版本：codex/pms-test-alignment-20261013，采购提交5df8cffef8fd498b4b2c01c0e7621e9f57262c84与main fe203b8da8f9944ec4ca5ea3acec28beaf116a56合并中的实际工作树；/Users/laoer/.codex/worktrees/7eaf/higoods，运行资产/tmp/pms-main-merged-preview-20261014，Chrome本地5403，Asia/Shanghai。四个增量文件实际SHA256在integration-evidence.json。
- 证据：pms-main-integration-20261014/integration-evidence.json、merged-suggestions-1366.png、merged-suggestions-1280.png、merged-browser.log、merged-browser-r2.log与merged-reorder-focused.log；首轮失败原样保留，30项当前复测覆盖业务闭环。

### 性能结论

- 结论：通过
- 依据：merged-browser.log的105个隔离context首访样本，从导航到目标表格内容、可见图片decode、字体及两次绘制完成，最大573.5ms；未冒称新进程冷启动。merged-browser-r2.log含P1/P2真实导航、查询、局部弹窗的各5次以上完整响应，均未超过1000ms。未受影响的保存、导入导出家族采样保留原审查版本与证据。

### 验证命令

- `npx vite build --outDir /tmp/pms-main-merged-preview-20261014 --emptyOutDir`：通过
- `npm run typecheck:engineering`：通过
- `npm run check:pms-purchase-chain`：通过
- `npx playwright test tests/pms-peripheral.spec.ts --grep 新增备货款 --workers=1`：通过
- `npx playwright test tests/pms-cold-load.spec.ts tests/pms-purchase-chain.spec.ts tests/pms-material-flow.spec.ts tests/pms-master-data.spec.ts tests/pms-settlement-flow.spec.ts tests/pms-peripheral.spec.ts --grep-invert 隔离context首次访问 --workers=1`：通过
- `git diff --check`：通过

首次31项批次失败保留在merged-browser.log；其105个首访样本未受测试等待修改影响，按EVIDENCE-01保留。最终完整聚合收据输出/tmp/pms-main-publication-20261014/integrated-task-receipt.json，包含实际检查命令、退出码及绑定版本。范围工程类型门禁通过不冒称全仓既存类型问题为零。

### 例外

- 无新增例外；原来源6条未可执行集成分支仍按原审查登记，未伪造外部业务能力。
