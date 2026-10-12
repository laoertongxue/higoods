# 耗材、配件同页建档 R2 发布前整合核验

日期：2026-10-12。用户授权：本地合并 main 并推送 GitHub main。

本次只提交原验收收据登记的76项文件（feature commit a6a3f062），与 origin/main dab3ebf2 的后道业务及 AGENTS 更新整合。唯一冲突为 affected-checks 测试文件末尾追加，双方全部断言保留。任务实现中只有路由渲染入口、治理路由及其测试承接上游新增；其余耗材配件业务源码逐文件与原验收提交一致。原验证矩阵36/36、两轮审查与3975样本保留原构建身份，不将旧收据改写为本轮结果。

发现并修复发布门禁的 Git 输出容量：主分支新增证据后 ls-tree 输出1331257字节，超过 Node execFileSync 默认1MB。仅提高有界缓冲到16MB，增加5000证据文件、真实树输出大于1MB的回归，验证固定对象读取和完整分支范围。无业务页面改动。

本轮整合核验：778单元、303治理、构建、菜单路由、prototype/list branch治理均通过。同工作树 production preview 43222 的列表编辑/整款方案入口与同页多规格保存、事务失败重试、图片复用、追加、刷新回读五轮通过，共285样本，最大 312.6ms，1366×768/1280×720。原预览服务停止造成首次脚本采集无效，重启同服务并确认运行bundle后重测，未改业务代码。

完整证据：docs/verification-evidence/2026-10-12-simple-materials-main-publication/summary.json 及同目录原始报告/日志。本轮冻结输入后的增量治理收据：/tmp/higoods-r2-publication-final-receipt.json。旧功能收据和原始性能报告按旧基线保留；本轮不伪造原始 full-runtime 哈希清单已覆盖上游后道改动。代码内容不变的前两轮业务审查及对应事实依旧按原版本联查，合并新增影响由本轮直接核验。

本文仅登记发布前验证。推送后以 GitHub ref/main、远端 ls-remote 和 exact-SHA Production 状态确认实际发布，不提前填写成功。
