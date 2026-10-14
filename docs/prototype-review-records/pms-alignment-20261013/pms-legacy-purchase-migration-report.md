# 旧面辅料采购资料显式迁移工具

源码冻结时间：2026-10-13T23:41:12.982927

状态：已实现待验证；Node 隔离事务契约 15 / 15 通过，未冒充实际用户资料迁移或浏览器 UI 完整验收。

只处理旧键 `higood-pms-material-purchase-updates-v1`。不自动迁移，不写其它旧键，不清库；普通检测和备份只读。

API：

- `PMS_LEGACY_MPO_KEY`：alias of canonical old key constant retained by MPO owner
- `detectLegacyMaterialPurchaseOrders(storage?)`：Promise<{key,found,count,sourceHash?}>; absent only when getItem truly returns null; invalid/read failure rejects
- `readLegacyMaterialPurchaseBackup(storage?)`：Promise<{raw,fileName,sourceHash,count:number|null,validationMessage?}>; exact original raw string, no writes/deletion, even invalid format or Base64 can be backed up; absent/read failure rejects
- `migrateLegacyMaterialPurchaseOrders(options)`：Promise<{key,status:no-source|completed|cleanup-pending,sourceHash?,operationId?,total,migrated,skipped,replayed,targetVerified,removed,message}>
- `LegacyPurchaseMigrationOptions`：{otherPagesClosed:boolean,expectedSourceHash?:string,storage?:LegacyPurchaseStorage,actor?:{id,name,role}}; otherPagesClosed must equal true

正常执行依次验证旧业务记录、事务内全批目标/版本/附件、共同提交缺失记录与操作日志、独立回读、再核验旧 raw 并清理指定键。相同目标跳过；任何冲突不覆盖。保存后删除失败明确区分“目标已保存、旧源未清理”，同 raw 重试复用稳定 SHA-256 回执。

需要根代理完成本地资料 UI 的关闭旧页勾选、备份下载和真实浏览器隔离源验收。Node fixture 只证明所列事务与错误契约。

文件：

- `src/data/pms/legacy-purchase-migration.ts` — SHA256 `08be9a84c738c5dbe23c806a2c15b6a013aea7806f4dea156bd77f1e2196bdc0`
- `tests/unit/pms-legacy-purchase-migration.test.ts` — SHA256 `b89605cc709c4f92ebbc15a9757b20cd919747a18256cdeb1a0c077dbd34575c`

证据：`/tmp/pms-legacy-purchase-migration-report.test.txt`、`/tmp/pms-legacy-purchase-migration-report.syntax.json`。
