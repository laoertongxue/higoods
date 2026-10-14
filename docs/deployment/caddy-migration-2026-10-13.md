# GitHub Actions + Caddy 迁移记录

范围：higoods 与 old_higoods 的静态托管、main 自动发布、HTTPS、版本核验和回滚。继承既有业务与浏览器存储契约；不调整业务页面的数量、规则和附件归属。用户已新增要求：先优化首次加载到 1 秒以内，再切换自动部署；允许为此调整模块加载与静态缩略图。任务为 T4 + T5。需求与设计、计划、原子矩阵及实施证据合并记录。

## 需求与设计

用户已选择 GitHub Actions + Caddy，希望日常只推送 main。higoods → https://higood.12lab.cn；old_higoods → https://old-higood.12lab.cn。GitHub 构建 Vite dist，服务器只提供静态文件。两项目无需 Node 常驻服务、SSR、ISR、Docker 或部署面板。

2026-10-13 现场服务器：182.44.11.152，Ubuntu 24.04.2 LTS x86_64，7.5 GiB 内存、40 GiB 磁盘、已有 2 GiB Swap。DNSPod 两个子域名 A 记录均指向该 IP。用户明确备案由其处理，本任务不核查备案。Caddy 2.11.7 官方 Debian 包已安装，systemd 已启用；80/443 提供服务，管理端 2019 和健康端口 18081/18082 仅监听 loopback。两个域名已获得有效自动 HTTPS 证书。

GitHub Actions 使用 Node 24、npm ci 和既有构建命令。每仓库独立非 root 用户、目录和密钥；root 安装的 forced-command 接收器只允许该站点 deploy/rollback，不提供通用 shell、sudo 或其他站点写权限。私钥仅放 GitHub Secrets 和本机仓库外的受限凭据目录，不进入代码、日志或文档。

产物 deployment.json 包含 project、完整 SHA、GitHub run_id、UTC 构建时间、逐文件 SHA256 清单和入口资源。解包拒绝越界、链接、特殊文件、重复路径、超量和不完整文件；全部文件、身份、校验清单相符才发布。站点锁防止乱序运行覆盖较新版本。current 原子切换，previous 保留原当前版；本机或公网验证失败精确恢复原 current/previous。保留最近版本并保护回滚需要的指针目标。

Caddy 对深层 SPA 路由返回 index.html；真实资源不回退 HTML，缺失 JS/CSS 返回 404。assets 优先当前版，必要时读取上一版，兼顾仍打开旧页面的资源请求。HTML 重新验证缓存，deployment.json 不缓存，JS/CSS 可缓存一小时；启用 zstd/gzip 和预生成 br/gzip sidecars；解压字节与原始文件一致。PMS 核验地址使用现有真实路由 /pms/purchase-suggestions，旧文档中的 /pms/workbench/overview 已确认显示“页面未找到”，不作为验证证据。

## 依赖计划与完成条件

1. 核对来源版本、服务器、DNS；完成部署工具和隔离契约。
2. 安装 Caddy、两站点用户与 forced command；本机验证后开启用户指定域名 HTTPS。
3. 完成真实页面、图片、深层刷新、资源与异常发布验证；整理全部失败与恢复证据。
4. 固定任务文件并执行 workflow:verify 技术收据；只合并本任务文件，保留主工作区其他差异。
5. 开启 CADDY_DEPLOY_ENABLED，推送各仓库 main；核对准确 SHA 的 Actions 成功与公开 deployment.json 的 SHA/run_id，并核对运行资产。
6. vercel.json 禁止后续 Git 自动部署，保留已存在旧站；订阅降级属于账户操作，本任务未自动执行。

## 原子矩阵

技术验证人为主代理 Codex；用户授权只表示实施范围，不能替代现场产品接受。以下状态对应准备切换时的真实证据，最终 main 发布结果通过 Actions 与 deployment.json 核验后单独登记，不预填成功。

| 编号 | 原子需求 / 来源 | 实际文件与工作包 | 验证与证据 | 状态 | 确认人 / 版本 |
|---|---|---|---|---|---|
| DEP-01 | 用户：main 推送自动发布，两仓库独立 | .github/workflows/deploy.yml | push/main 与手动非 main 拒绝条件已审查；实际 main 运行待验 | 已实现待验证 | Codex / 迁移分支 |
| DEP-02 | 检查与构建成功后才上传 | 工作流 / prepare-release.py | 优化后 higoods 810 单测、构建通过；old 73 helpers、14 核心、构建通过；Node 24/Linux 将由 Actions 再验 | 已实现待验证 | Codex / ee149499、8ba502ba 的应用 |
| DEP-03 | 产物身份、完整 SHA 与清单一致 | receiver.py / prepare-release.py | tests/deploy/test_receiver.py：身份、篡改、缺失、额外文件 | 已验证 | Codex / 25 契约 |
| DEP-04 | 解包路径与类型不能越界 | receiver.py | traversal、链接、特殊文件、重复路径、归档中断契约 | 已验证 | Codex / 25 契约 |
| DEP-05 | 上传失败不替换已有站点 | receiver.py | 损坏/中断/错误资源保留原 pointer 和内容 | 已验证 | Codex / 25 契约 |
| DEP-06 | 原子切换并保留上一版资源 | receiver.py / Caddyfile | 双版本 symlink 契约；实际 Caddy loopback 夹具读 current/previous | 已验证 | Codex / Caddy 2.11.7 |
| DEP-07 | 本机及公网失败回滚原两个指针 | receiver.py / 工作流 | 首次/已有版本失败、外部 rollback、清理后回滚、gzip 错误契约 | 已验证 | Codex / 25 契约 |
| DEP-08 | 旧运行与陈旧回滚不能覆盖新运行 | receiver.py | 乱序、冲突 run_id、重复上传、陈旧 rollback 契约 | 已验证 | Codex / 25 契约 |
| DEP-09 | 两站点账号、密钥与目录独立 | 服务器 / SSH forced command | 非 root、无 sudo、目录归属、Caddy 可读；通用 shell 实测拒绝 | 已验证 | Codex / 2026-10-13 服务器 |
| DEP-10 | 真实深层页面、静态资源与缺失资源正确 | deploy/Caddyfile / sites.json | PCS/PMS/PDA/旧测新页浏览器；MIME、HTML、404、原版资源读回 | 已验证 | Codex / 初次部署资产 |
| DEP-11 | 两域名自动 HTTPS 与本机监听正确 | deploy/Caddyfile | 有效 TLS 回读，caddy validate，loopback ss | 已验证 | Codex / 2026-10-13 服务器 |
| DEP-12 | 不清空或覆盖旧浏览器记录/附件 | 既有浏览器存储、旧 Vercel 入口 | 两旧入口 HTTP 200，未执行数据清理；新来源不会自动继承旧数据 | 已验证 | Codex / 保留事实；跨来源数据转移不在确认范围 |
| DEP-13 | 正式版本绑定 main SHA 与 Actions run_id | deployment.json / 工作流 | 准备阶段上传原应用 SHA/run_id=1；最终 main 四端 SHA 与 Actions 待验 | 已实现待验证 | Codex / 待正式推送 |
| DEP-14 | 停止重复 Vercel 构建且保留旧站 | 两仓库 vercel.json | git.deploymentEnabled=false；官方配置定义已核对，提交后生效 | 已实现待验证 | Codex / 待正式推送；Pro 订阅未改 |
| DEP-15 | 性能门禁按实际样本与确认范围处理 | AGENTS.md PERF-01 / 浏览器原始样本 | 原始与第一轮失败保留；最终候选四家族各 5 样本全部 ≤1000ms，详见追加表 | 已验证 | 用户：先优化到 1 秒以内，再切换自动部署 |

## 已执行的检查与原始证据

初次应用来源 higoods ee14949905b08b260e9c6309eebc59bfa5b32764、old_higoods 8ba502baf34f5bcfb5543e36cf6845c80e099c25；准备环境采用 Node 26.8.2/npm 11.19.1，正式 Actions 固定 Node 24、Ubuntu 24.04。初次部署未引入业务源码差异，后续用户指定性能优化的源码与资产差异见变更记录。静态产物约 122 MB/35 MB，清单 1002/119 文件。main 主工作区另有业务编辑，本迁移在隔离分支内完成，不吸收这些差异。

- 本地构建：/tmp/higoods-caddy-build.log（807 单测通过）；/tmp/old-higoods-caddy-tests.log（70 helpers 通过）；/tmp/old-higoods-caddy-build.log（构建通过）。
- 服务器 Python 3.12 契约：/tmp/higoods-caddy-server-contracts.log，25 tests，OK，退出 0。独立旁路代理只负责部署契约与一次完整独立审查；主代理检查实际实现并集成修复。
- 独立审查发现并已修复：失败版本清理可能删除回滚所需旧 previous、手动非 main 发布条件、发布目录 0700 导致 Caddy 不可读；分别有契约、工作流条件和服务器权限直接证据。增加 gzip 成功及内容错误契约。
- 服务器/Caddy：/tmp/higoods-caddy-server-web-checks.log、/tmp/higoods-caddy-caddy-contracts.log、/tmp/higoods-caddy-deny-shell.log。actual Caddy temporary loopback 夹具证明上一版资源和 404；夹具进程已退出，未改正式 pointer。
- 页面校准：/tmp/higoods-caddy-pms-calibration.log、/tmp/higoods-caddy-readiness.log、/tmp/old-higoods-caddy-control-calibration.log；PMS 原错误地址的失败保留，不作为通过证据。旧站 favicon.ico 缺失产生 404，属于现有产物未含图标，页面无未捕获脚本异常。
- 浏览器功能：PCS 款式档案 54 条/首屏 20 行与真实图片；PMS 8 条建议与真实图片；PDA 390×844 两输入及登录按钮；旧测新页 24 款/首屏 20 行，禁止采购 Tab 切换与深层刷新正确。原始图在 output/playwright/caddy-migration/：pcs-cold.png、pms-cold.png、pda-cold.png、old-control-cold.png；1366×768 管理页面无文档横向溢出。
- 性能原始 JSON：/tmp/higoods-caddy-performance.json、/tmp/old-higoods-caddy-performance.json；脚本 /tmp/higoods-caddy-performance.js、/tmp/old-higoods-caddy-performance.js。真实公网 HTTPS，桌面 Chrome，Asia/Shanghai，当前 Mac 网络含 FlClash TUN，无人工限速。新隔离 context 无 HTTP 缓存与业务存储；旧站只携带由真实 UI 登录建立的演示账号状态。终点为指定真实内容/行数、可见图片、字体及双 rAF，不以 shell 文本或 HTTP 200 替代。

| 冷首次加载家族 / 每家族 5 样本 | 原始毫秒值（保留精度至 0.1，仅展示） | 最大值 | PERF-01 |
|---|---|---|---|
| PCS / 1366×768 / 20 行、可见 2 图 | 1585.7, 2211.8, 2186.8, 2096.0, 2287.5 | 2287.5 | 未通过 |
| PMS / 1366×768 / 8 行、可见 4 图 | 5566.8, 4956.5, 5316.3, 5310.8, 5638.3 | 5638.3 | 未通过 |
| PDA 登录 / 390×844 / 2 输入 | 3228.6, 2887.0, 2867.4, 2846.5, 3401.1 | 3401.1 | 未通过 |
| 旧测新工作台 / 1366×768 / 20 行、可见 2 图 | 8215.9, 1383.1, 2194.1, 2286.7, 2502.3 | 8215.9 | 未通过 |

旧站首样本与一次 PCS 网络诊断短暂并行，资源竞争可能影响该慢样本，保留其结果，不删除或按平均值宣布通过。其余正式样本串行。同机已有用户应用负载未终止。早期错误路由/登录状态采集无效的日志 /tmp/higoods-caddy-browser-smoke.log 保留；修正选择器后取得上表有效样本。网络诊断 /tmp/higoods-caddy-network-diagnostic.log 显示 Caddy 已返回 zstd，耗时包含现有预加载模块、基线 JSON 和图片。未因迁移顺手优化业务或缩减数据。

## 技术收据与发布核验

任务文件冻结后执行 npm run workflow:verify，收据预定 /tmp/higoods-caddy-final/task-receipt.json，执行日志 /tmp/higoods-caddy-final/verify.log；机器 verified 只证明所绑定技术检查。仓库 main 的发布验收另按 AGENTS.md RELEASE-01：local main/origin main/远端/GitHub SHA 一致、对应 Deploy Caddy Production 成功、两个公开 deployment.json 项目/SHA/run_id 一致，实际资源与页面符合预期。

当前状态：服务器静态托管与工具契约已验证，正式 main 自动发布尚未执行，命名入口的冷首次加载优化已通过同条件复测；旧 Vercel 站点和 Pro 订阅均保留。跨来源浏览器记录/附件不会自动迁移，未清除旧数据；若后续需要转移须另确认具体来源和完整备份/恢复能力。


## 变更记录：用户新增性能前置条件

用户明确选择先达成 ≤1000ms，再启用 main 自动部署；不降低 PERF-01，不删除失败样本。新增工作包仅覆盖已测四个入口的初始化、资源和缩略图。higoods src/main.ts 独立登录渲染/事件、独立 PMS 采购建议读取其实际来源、PCS 列表不提前启动其他 PMS 模块；src/pages/pda-login.ts 移除与认证无关的执行页预读。Vite 在 HTML 阶段发现这些入口的既有静态依赖及必要小图；PMS/PCS 缩略图映射只作用于已发布静态图片，原图和用户上传地址保留。old_higoods 拆分原有 25 个业务页的加载，保留 29 个路由、权限、记录及保存路径。两仓库 prepare-release.py 统一用已存在的 Node zlib 生成 br/gzip；Caddy 从对应原始文件读取 sidecars，不改变内容校验。

验证前冻结构建目录。候选发布到服务器单独目录，由本次隔离浏览器专用 HTTP header 选择，同一正式域名/TLS/网络/Caddy 下测量；未通过前不改正式 current，也不开启 main 自动部署。候选身份记录 base HEAD 和未提交差异 SHA256，不冒称正式 Git SHA 产物。

| 编号 | 原子新增需求 | 实现 / 验证计划 | 状态 |
|---|---|---|---|
| DEP-16 | 四个命名入口的完整冷首次加载 ≤1000ms，每家族 5 样本 | 最终候选真实公网 20 样本全部通过，保留旧失败和采集脚本 | 已验证 |
| DEP-17 | 轻量图仍对应同一原图，未知/上传 URL 不改，高清查看保留 | 89 原图 SHA256 / 缩略图单测；公网 PCS/PMS 原图预览、Esc、PMS 失败重试通过 | 已验证 |
| DEP-18 | 拆分初始化保持已存记录及认证/生成动作可读 | 810 单测；公网建议转单 CG-2026-0028、刷新仍已生成；登录空值/错误输入保持 | 已验证 |
| DEP-19 | 旧项目分包保持全部路由和规则、附件来源 | 29 路由差异核对、73 helpers +14核心、真实旧页面、权限、规则内容搜索/重开和取消通过 | 已验证 |
| DEP-20 | 预压缩解压后仍是原始发布文件，失败不会切换 | Node br/gzip 解压与清单契约通过；实际 Caddy 与页面读回，正式 CI 公网再验 | 已验证 |


服务器传输假设及验证：正式候选的 PCS 瀑布显示 1～3 KB 缩略图也等待约 780ms，服务端负载 0.00；原 IPv4 默认路由使用 cubic 的默认初始窗口。仅将原默认路由 initcwnd 设为 64（保留网关、接口、来源、协议、metric），同一候选诊断 load 由 1091.6ms 降至 795.9ms。不是应用通过证据，仍需正式 5 样本。原环境记录 /tmp/higoods-caddy-network-baseline.log，新诊断 /tmp/higoods-caddy-initcwnd64-diagnostic.log。deploy/network-initcwnd.py 对已设 64 不写路由，对多条或不完整默认路由拒绝改动；4 条契约通过。服务器 root 所有的 systemd oneshot 与 timer 在启动/租约更新后维护该参数，不开放应用部署用户修改网络的权限。systemd-analyze verify 与 timer active 回读见 /tmp/higoods-caddy-persistent-network.log。未改变服务器地址/网关/防火墙/拥塞算法，也未终止云厂商服务。已有云厂商单位的 MemoryLimit 弃用提示只记录，未改其配置。

| DEP-21 | 实测有效的传输设置在重启/DHCP 后保持，且不覆盖路由其他字段 | deploy/network-initcwnd.py、higoods-network.service/timer；4 契约、实际旧/新 route 与 systemd 回读 | 已验证 |

官方接口核对：[Caddy precompressed](https://caddyserver.com/docs/caddyfile/directives/file_server)、[ip-route initcwnd](https://man7.org/linux/man-pages/man8/ip-route.8.html)。实际性能改进以上述现场诊断及后续正式样本为准，不从文档推定速度。


第一轮候选公网证据（独立目录/专用 header，未替换正式站点）：/tmp/higoods-caddy-optimized-performance.json 和 /tmp/old-higoods-caddy-optimized-performance.json。PMS 903.3/998.1/939.6/813.5/947.2ms、PDA 738.3/828.2/705.4/794.3/757.3ms 达成该轮条件；PCS 1338.9/1256.4/1194.6/1239.2/1118.9ms、旧首单 1684.0/1927.4/1569.1/1569.3/1544.6ms 未通过，均保留，未宣称自动部署完成。后续样本已追加如下，不覆盖此轮失败。


## 最终候选性能证据（准备切换版本）

higoods 候选 app 源码差异身份 94cf2be0adb857091d5ed5a7997b09e1f9daa640485fa171755f45e19757dc7d，base HEAD ee14949905b08b260e9c6309eebc59bfa5b32764；old_higoods 第二轮候选 app 差异身份 cc3520b8e3ca87db35055da6c97a7b28d3cf79c4ba76328cf0777daa20c821ae，base HEAD 8ba502baf34f5bcfb5543e36cf6845c80e099c25。身份保存在候选产物 candidate-source.json；正式 CI 干净构建不会带此文件或候选字段。仅文档、治理契约和服务器配置同步的后续变化不改变已测应用字节。

环境仍为上述真实公开 HTTPS 域名、Chrome/Asia Shanghai/当前 Mac 网络/无人工限速；使用服务器独立候选目录与专用 header，root 当前版尚未替换。默认路由 initcwnd64 的实测环境已固定。各样本新 context 无缓存及业务数据；old 仅携带真实 UI 登录建立的演示 admin 身份。起点为导航开始，终点为完整实际列表/登录控件、首屏对应图、字体和双 rAF；页面首次访问与浏览器进程启动区分。各家族串行测量，没有构建任务同时运行。

| 入口 / 视口 / 实际数据 | 最终候选原始毫秒（显示至 0.1） | 最大值 | 结果 |
|---|---|---|---|
| PCS 款式档案 / 1366×768 / 54 条、首屏 20 行、可见 2 图 | 444.4, 292.0, 580.9, 661.6, 645.9 | 661.6 | 通过 |
| PMS 采购建议 / 1366×768 / 8 行、可见 4 图 | 256.5, 235.8, 228.1, 236.3, 227.9 | 256.5 | 通过 |
| PDA 登录 / 390×844 / 2 输入 | 194.2, 194.5, 185.2, 188.6, 180.5 | 194.5 | 通过 |
| old 首单管控 / 1366×768 / 24 款、首屏 20 行、可见 2 图 | 483.0, 370.6, 372.6, 371.2, 368.5 | 483.0 | 通过 |

原始 JSON：/tmp/higoods-caddy-final-candidate-performance.json、/tmp/old-higoods-caddy-final-candidate-performance.json；同名 .js 采集脚本与 .log CLI 回执。截图 output/playwright/caddy-migration/pcs-final-candidate-cold.png、pms-final-candidate-cold.png、pda-final-candidate-cold.png、old-control-final-candidate-cold.png。以上 20 样本无 pageerror，桌面无文档横向溢出，不冒称印尼现场接受或网络环境变化后的速度保证。

后续正式 main 发布回执与 DEP-01/02/13/14 的实际结果单独持久保存到 /Users/laoer/Documents/deployment-records/2026-10-13-caddy/production.md 及 production.json，不预填成功；并比较正式 app 字节与此候选，字节相同的产品证据按 EVIDENCE-01 保留原身份，改变的部分重新验证。其余原始失败、收据和浏览器证据也复制到该目录归档。

维护入口：Caddy 管理配置 /etc/caddy/Caddyfile；网络设置 /usr/local/sbin/higoods-network-initcwnd 与 higoods-network.service/timer。需要撤销已测传输设置时，先停用这两个 systemd 单位，再依据保存的默认路由保留 via/dev/proto/src/metric 并移除 initcwnd 字段；不由应用 Actions 修改系统网络。


相邻交互与自然缓存刷新：/tmp/higoods-caddy-final-interactions.json，共 9 家族各 5 样本，所有有效值 ≤1000ms，无 pageerror；真实首次点击包括模块加载、内容/图和双 rAF，刷新从导航开始。原图 Esc 关闭和 PMS 缩略图失败显示/原图重试通过。采购建议 PSG-2026-0001 通过真实 UI 生成 CG-2026-0028 后刷新仍为已生成，仅本次新建隔离浏览器内记录，不触碰用户浏览器/服务器业务数据。

| 家族 | 原始毫秒 | 最大值 | 结果 |
|---|---|---|---|
| pcs-original-preview | 131.6, 139.7, 149.7, 123.1, 140.3 | 149.7 | 通过 |
| pcs-refresh | 148.0, 164.0, 167.8, 149.9, 148.6 | 167.8 | 通过 |
| pms-query | 92.1, 103.1, 101.7, 101.6, 103.2 | 103.2 | 通过 |
| pms-reset | 100.0, 99.9, 98.2, 99.9, 100.0 | 100.0 | 通过 |
| pms-original-preview | 98.6, 98.1, 99.3, 98.3, 98.8 | 99.3 | 通过 |
| pms-refresh | 94.2, 111.1, 112.7, 127.2, 94.8 | 127.2 | 通过 |
| pda-empty-login | 77.4, 74.7, 78.0, 81.3, 71.9 | 81.3 | 通过 |
| pda-invalid-login | 100.0, 103.5, 91.0, 92.1, 91.7 | 103.5 | 通过 |
| pda-refresh | 82.0, 64.7, 82.3, 81.9, 65.2 | 82.3 | 通过 |

旧项目 /tmp/old-caddy-final-interactions.json：刷新最大 296.8ms、首次详情最大 771.7ms、首次规则最大 373.8ms、首次动作弹窗最大 363.5ms，各家族 5 样本，全部 ≤1000ms；包含实际正文/图/字体、双 rAF 及内容动画结束，不在动作窗口保存。完整原始值见旧项目本次部署记录。


## 正式流水线中的传输验证与必要调整

old 首次 main 推送 066ad13c33aa2088984021174e88a37beafecbdc 创建 Actions 38418311804。Node24、29部署契约、73 helpers与构建/打包已通过；跨境完整SSH上传数分钟仅收到约2MB，首次流水线主动取消，服务器保留初次旧应用 current，没有把取消当成功。

为避免每次重传未改变的实拍图片，prepare-release.py 可获取正式 HTTPS deployment.json，仍生成全部目标文件的完整校验清单，只上传与已验证基版不同的文件及新 manifest。基版标识固定 full SHA/run_id；首次无有效基版时明确退回完整包。receiver 在站点锁内独立校验指定不可变基版全部字节，再以硬链接补齐缺失且 checksum 一致的文件。任何遗漏变化文件、坏基版、越界/额外路径、身份或健康失败都拒绝发布，保留/恢复指针；删除的旧文件不会加入新 release。仍保留原子 current/previous 与精确公网回滚，不开放通用远端 shell，不新增镜像服务或常驻 Node。

新增增量契约含复用/删除/变更/漏传/坏基版/越界/额外文件和发布健康失败；实现仅修改部署工具和两个工作流，已冻结应用字节未改，原性能证据保持原身份。正式完整包首次上传慢及取消记录保留到生产归档。

完整技术收据首次运行的 PMS 检查器引用了 ee149499 已退役页面/数据模块；本次修复 scripts/check-pms-purchase-chain.ts，仅移除12陈旧导入和39退役断言调用点，保留270现行调用点并新增2夹具守卫。现有27菜单可达、13退役入口防复活、采购→面辅料/物流→对账付款与库存域断言实际通过；内存夹具显式初始化并按来源采购单取下推对象，不依赖已删工作台副作用，不改业务代码或断言业务目标。失败重放和PASS原文 /tmp/higoods-caddy-final/pms-checker-repair.log，首次收据失败归档 verify-first-failed.log。主代理已检查完整diff；新冻结完整收据独立重跑。

最终增量准备工具14契约与接收器33契约及网络4契约共51项通过，日志 /tmp/higoods-caddy-final/incremental-all-deploy-tests.log；服务器 Python3.12 接收器33项实际通过 /tmp/higoods-caddy-final/incremental-server-tests.log。旧仓库不安装系统网络工具，47项部署契约通过。
