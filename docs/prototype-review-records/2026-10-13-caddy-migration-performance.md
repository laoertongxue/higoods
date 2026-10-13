# Caddy 迁移与命名入口加载优化审查

依据 `AGENTS.md` 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01；本记录仅核验本任务准备切换候选，不新增独立治理要求。

## 基本信息

- 日期：2026-10-13
- 任务 / 需求编号：DEP-01～DEP-21；GitHub Actions + Caddy 迁移和性能前置条件
- 验证人：主代理 Codex；技术验证不表示真实工厂用户接受

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：托管与自动发布配置变化；PCS/PMS 缩略图显示、登录和采购建议入口的模块初始化、HTML 预加载变化。原型业务公式、对象身份、路由、图片原件与持久化格式继承现有契约。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
|---|---|---|
| 命名入口完整首次加载 | 通过 | DEP-16；同公开 HTTPS 条件四家族各 5 样本全 ≤1000ms，旧失败保留；迁移记录最终候选表及原始 JSON |
| 页面内容与设备 | 通过 | PCS 54 条/20 行，PMS 8 行，1366×768 无横溢；PDA 390×844 两输入；命名截图 |
| 相邻事件与自然缓存刷新 | 通过 | /tmp/higoods-caddy-final-interactions.json，9 家族各 5 样本，最大167.8ms；真实内容、图片和双 rAF |
| 采购建议实际已存数据读取 | 通过 | 隔离浏览器 UI 将 PSG-2026-0001 生成 CG-2026-0028，刷新后仍为已生成，已转单/数量可读；读取既有 PMS IndexedDB |
| 登录校验及输入保留 | 通过 | 空账号反馈、错误账号/密码反馈，各5次；错误后输入仍保留，无 pageerror；现有登录与执行链单测 |
| 真实缩略图与原件对应 | 通过 | 89 幅静态原图 SHA256 不变与 WebP 存在单测；公网 PCS tee-black 原图与缩略图对应，PMS 原图预览、Esc 关闭 |
| 图片失败与恢复 | 通过 | 新隔离 context 阻断 PMS tshirt 缩略图，实际显示失败，点击重试读取原始 JPEG 并加载成功；未知、上传及外链 URL 保持单测 |
| 附件/业务保存格式 | 不适用 | 本次未改变附件、记录格式或已有写入实现；仅改初始化加载次序及静态图 src，不新增数据库或清理旧来源 |
| 列表标准骨架 | 通过 | 已有 PCS/PMS renderStandardListPage 骨架保留，行/查询/数量契约不变；只修改对应图片 src 和加载时机；同范围列表治理随技术收据执行 |
| 静态托管、HTTPS、404 与原子发布 | 通过 | 51部署契约；服务器 Python3.12接收器33契约、actual Caddy双版本夹具、TLS/MIME/404、权限和禁止通用shell实际回执 |
| main 正式发布证明 | 不适用 | 本记录的对象为已测准备切换候选，正式 main 的 SHA/Actions/public manifest 对齐独立按 RELEASE-01 保存至部署归档，不用此记录预填发布成功 |
| 打印/PDA执行业务数量变化 | 不适用 | 不修改打印或业务执行数量；PDA认证后的原路由与处理仍使用已有实现，不新增业务动作 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/main.ts`
- `src/pages/pcs-product-archives.ts`
- `src/pages/pda-login.ts`
- `src/pages/pms/shared.ts`
- `src/utils/static-image-thumbnail.ts`
- `src/utils/static-image-thumbnails.json`
- `vite.config.ts`
- `vercel.json`
- `.github/workflows/deploy.yml`
- `deploy/Caddyfile`
- `deploy/sites.json`
- `deploy/network-initcwnd.py`
- `deploy/higoods-network.service`
- `deploy/higoods-network.timer`
- `scripts/deploy/receiver.py`
- `scripts/deploy/prepare-release.py`
- `scripts/deploy/check-public.py`

### 页面证据

- 版本：codex/caddy-auto-deploy，HEAD ee14949905b08b260e9c6309eebc59bfa5b32764；实际候选未提交差异身份 94cf2be0adb857091d5ed5a7997b09e1f9daa640485fa171755f45e19757dc7d，保存在候选 candidate-source.json。服务为公开 higood.12lab.cn Caddy HTTPS + 本次专用 header 选择的 /srv/higoods-candidate/current；工作树 /Users/laoer/.codex/worktrees/e37b/higoods。已测应用字节后续未变，文档/治理契约整理按 EVIDENCE-01 不改标原证据身份；正式 CI 运行资产将逐文件比对。
- 证据：output/playwright/caddy-migration/pcs-final-candidate-cold.png、pms-final-candidate-cold.png、pda-final-candidate-cold.png；/tmp/higoods-caddy-final-interactions.json 包含命名路由、真实事件、原图、错误恢复与持久回读；/tmp/higoods-caddy-final-candidate-performance.json 包含视口、行数及可见图片结果。仅新建隔离浏览器，不清空用户数据。

### 性能结论

- 结论：通过
- 依据：真实公网 Chrome，Asia/Shanghai，当前 Mac/FlClash TUN 网络，无人工限速；服务器原路由仅 initcwnd64。导航开始至完整行/输入、可见对应图、字体、双 rAF；每次新 context 无 HTTP 缓存和业务数据，四个入口各5次。PCS最大661.6ms、PMS最大256.5ms、PDA最大194.5ms；旧项目最大483.0ms另有独立记录。相邻真实点击与自然缓存刷新9家族各5次最大167.8ms。完整原始值、脚本、环境与早期失败均保留，不以平均值替代门禁，不描述为浏览器进程冷启动或现场接受。

### 验证命令

- `npm run build`：通过
- `node --import tsx --test tests/unit/static-image-thumbnail.test.ts`：通过
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests/deploy -v`：通过
- `/Users/laoer/.codex/skills/playwright/scripts/playwright_cli.sh -s=higoods-caddy run-code --filename /tmp/higoods-caddy-final-candidate-performance.js`：通过
- `/Users/laoer/.codex/skills/playwright/scripts/playwright_cli.sh -s=higoods-caddy run-code --filename /tmp/higoods-caddy-final-interactions.js`：通过

构建810单测、缩略图3单测及部署51契约的实际日志分别 /tmp/higoods-caddy-optimized-build.log、/tmp/higoods-caddy-thumbnail-tests.log、/tmp/higoods-caddy-final/incremental-all-deploy-tests.log。原型/列表治理和完整冻结文件技术收据另存 /tmp/higoods-caddy-final/verify.log 与 task-receipt.json，机器技术结果和正式发布各自核验。

### 例外

- 无。用户要求先达成≤1000ms，再切换自动部署；未采用性能例外，保留所有早期失败。
