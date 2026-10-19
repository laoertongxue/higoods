# Stage20 PDA cold diagnostic — final generic print adapter version

Only this diagnostic and its evidence are new. No product or collector change was made. All browser contexts have closed. The original normal cold 1020.8 ms remains a valid failure; this profile does not replace or pass it.

Frozen source manifest: `6fa0d3c6480b4e4ef162e07db7e53a4493cf25b054d6cb0cd000f3539c596f07`; dist index: `8b3f768ec5272b8816e48689369ec1073f16e0f0b5882602afbeba21a666f7dc`; collector: `8341beb517ad0cdd3438ae235fcc5281611779b41a0d01e0bf19887d8eaacaf2`. Local production preview port43198, original F090 ROLE_OPERATOR, fixed D10 source backup SHA `78adb8de3cac155fd32499707c4d7d703f0f7f9e48e8bad72d0642f12bb1d586`, 27,548 records /36,178,108 bytes. No dataset or identity reduction.

Cold profiled end-to-end 941.7 ms = ready908.4 + native persistent readback21.1 + paint12.2 ms. One large D10 readonly transaction246.6→407.7ms took161.1ms. No handler errors. Profile sampling spans994.742ms and includes sampling overhead outside the response endpoint. The unchanged page calibration sequence continued to unprofiled refresh827.0ms and navigation399.3ms after this profiled cold was below1000ms. All three are calibration only; no formal family has started.

Weighted V8 CPU milliseconds below are inclusive unless explicitly called self. Parent/child values must not be added. Samples are not exact invocation counts.

| Branch | ms | Included work |
| --- | ---: | --- |
| PDA `pe` |343.676| explicit DYE133.538 + actual render202.224 + lookup4.925 + runtime context2.989 |
| actual render `E` |202.224| shell120.170 + link80.983 + local detail read1.071 |
| shell `qt` |120.170| header `Qt`106.450, other frame controls |
| header `Qt` |106.450| todo `Ht`96.852 |
| todo `Ht` |96.852| prepare `W`63.904 + after-execution32.948 |
| prepare `W` |63.904| cutting `Jt`60.010; cutting map45.031 contains marker dispute→platform case→facts directory33.013 |
| after-execution |32.948| discrepancy todo `wt`32.610 |
| discrepancy `wt` |32.610| stock `us`25.506 and objection `Yi`7.104 |
| link `m` |80.983| PROCESS_DOC index `Mt`79.488 |
| PROCESS_DOC `Mt` |79.488| fixture task links43.509 and post task projection35.979 |
| fixture task links |43.509| facts directory `be`42.006 through current once-per-build cache |
| post task projection |35.979| source-provider `kt`25.478→special craft `Zt`25.478; summaries5.994; other snapshots |
| hydrate `Me` |74.117| own41.744 + validator callback28.452; separate from PDA render tree |
| validator |28.452| primitive progress10.113, SKU consistency8.546, other relationship checks; no full records/SKU clone bottleneck visible |

DYE breakdown: `hr133.538→we133.538`; parallel `Re94.491` cold initialization and `it38.646` actual linked handover. Re contains Kd55.476 (je40.455→it37.020), Ld27.024 ($r downstream-target synchronization→ji→Nt), and another ji7.501 path. All timings include descendants. DYE self by file: handover104.315ms, runtime6.605ms, PF5.987ms, builtin structuredClone5.376ms, printing3.348ms. The K clone wrapper self in this branch is1.504ms. Most DYE work is linked handover/head recomputation, not pure copying. DYE facts remain necessary for F090; no suggestion to skip them.

Clone containment: total handover K self49.221ms spans different caller paths. PROCESS_DOC facts→per-row readiness→gu→er→K12.012ms; header cutting→marker dispute→platform case→facts→per-row readiness→gu→er→K13.520ms inclusive (K self12.021 plus nested builtin1.499); discrepancy stock→hc→xe→er→K10.506ms; discrepancy objections→Yi→xe→er→K4.115ms. These are inside the branches above, not additional durations. No claim that the once-per-build facts cache was lost; the source has distinct consumers in the link and marker/platform trees.

Actual runtime source fragments (full excerpts and qualified callers are in JSON):

`printing-task-domain-CEjBgsAL.js:0:70332 / node436 we`

```js
nction we(e){var o;if(Se())return;Re(),vt();const t=e?[S.get(e)].filter(a=>!!a):[...S.values()],r=pa({includeWool:!1,taskIds:new Set(t.map(a=>a.taskId))}).filter(a=>a.headType==="HANDOUT");for(const a of S.values()){if(e&&a.dyeOrderId!==e)continue;const s=Jr(a.dyeOrderId,a.qtyUnit);if(s.length){a.materialReceipts=[...(a.materialReceipts??[]).filter(c=>!c.receiptId.startsWith("FRP-")),...s];const i=a.materialReceipts.reduce((c,u)=>c+u.qty,0);if(i>0){const c=Z.get(a.dyeOrderId)??[],u=c.find(I=>I.nodeCode==="INPUT_RECEIVED"),l=s.at(-1),m={...u,nodeRecordId:(u==null?void 0:u.nodeRecordId)||`FRP-${a.dyeOrderId}`,dyeOrderId:a.dyeOrderId,taskId:a.ta
```

`printing-task-domain-CEjBgsAL.js:0:112814 / node437 Re`

```js
nction Re(){if(!Se()&&!tt){tt=!0,Kd(),Ld(),zn.forEach(e=>{var r;const t=S.get(e.workOrderId);!t||(r=t.materialReceipts)!=null&&r.length||(t.materialReceipts=[{receiptId:`DYE-SEED-RECEIPT-${e.workOrderId}`,upstreamRecordId:`ISSUE-DYE-${e.workOrderId}-L001`,qty:e.qty,receiverName:e.targetFactoryName,receivedAt:e.issuedAt}])}),Gd(),jd(),xd(),Jd();for(const[e,t]of[["DWO-008",2016],["DWO-009",3798],["DWO-010",5600]]){const r=S.get(e),o=Z.get(e);o.some(a=>a.nodeCode==="DYE")||o.unshift({nodeRecordId:`${e}-DYE`,dyeOrderId:e,taskId:r.taskId,nodeCode:"DYE",nodeName:"染色",operatorUserId:"USR-DYE-01",operatorName:"染色工厂",startedAt:e==="DWO-009"?"2026-06-0
```

`printing-task-domain-CEjBgsAL.js:0:63267 / node440 je`

```js
nction je(e){var d,i,c,u;const t=it(e.taskId);if(!t)return{recordIds:[]};const r=G(t,{includeWool:!1});if(!r)return{handoverOrderId:t,recordIds:[]};if(F(r.handoverId,r).length===0||e.createNewBatch){const l=Array.from(S.values()).find(y=>y.taskId===e.taskId),m=(i=(d=l==null?void 0:l.formalProductionOrderSnapshot)==null?void 0:d.materialItems)==null?void 0:i.find(y=>{var N;return y.materialId===l.rawMaterialSku&&(!((N=l.sourceSnapshot)!=null&&N.bomItemId)||y.sourceBomItemId===l.sourceSnapshot.bomItemId)}),I=(c=m==null?void 0:m.materialType)==null?void 0:c.trim(),R=(!l||!Ot(l))&&(!I||I==="FABRIC"||I.includes("面料"));qt({dyeExecutionConfirmed:!0,
```

`printing-task-domain-CEjBgsAL.js:0:63124 / node441 it`

```js
nction it(e){const t=de(e);if(!(t!=null&&t.startedAt))return;const r=pr(e,{includeWool:!1});return xa(e,r.handoverOrderId),r.handoverOrderId}function je(e){var d,i,c,u;const t=it(e.taskId);if(!t)return{recordIds:[]};const r=G(t,{includeWool:!1});if(!r)return{handoverOrderId:t,recordIds:[]};if(F(r.handoverId,r).length===0||e.createNewBatch){const l=Array.from(S.values()).find(y=>y.taskId===e.taskId),m=(i=(d=l==null?void 0:l.formalProductionOrderSnapshot)==null?void 0:d.materialItems)==null?void 0:i.find(y=>{var N;return y.materialId===l.rawMaterialSku&&(!((N=l.sourceSnapshot)!=null&&N.bomItemId)||y.sourceBomItemId===l.sourceSnapshot.bomItemId)
```

`pda-handover-events-HmXwn01B.js:1:192887 / node442 Vi`

```js
nction Vi(e,t={}){var l;const r=Le(e),o=ji(e,t)[0];if(o){if(r&&r.status!=="DONE"&&((r.handoverQty??0)+1e-6<r.completedQty||r.completedQty+1e-6<r.plannedQty&&r.supervisorDecision!=="CONTINUE_WITH_ACTUAL_QTY")&&(Ie.delete(o.handoverId),z()),r){const R=Ko(r.waterOrderId,e,o.handoverOrderId||o.handoverId);if(!R.ok)throw new Error(R.message)}return{taskId:e,handoverOrderId:o.handoverOrderId||o.handoverId,created:!1}}const a=Qi(e);if(!a)throw new Error(`未找到任务：${e}`);if(r&&r.status!=="WAIT_HANDOVER")throw new Error(`水溶加工单当前为“${r.status}”，只有待交出时才能创建交出单。`);if(r&&(!r.factoryId||r.factoryId!==a.assignedFactoryId))throw new Error("水溶加工单尚未正确派厂，不能创建交出单。");
```

`printing-task-domain-CEjBgsAL.js:0:58220 / node572 $r`

```js
nction $r(e){var o,a,s,n,d,i,c,u;const t=(o=e.sourceSnapshot)!=null&&o.downstreamWorkOrderId?{targetBusinessId:e.sourceSnapshot.downstreamWorkOrderId,targetName:`印花加工单 ${e.sourceSnapshot.downstreamWorkOrderNo||e.sourceSnapshot.downstreamWorkOrderId}`,targetWarehouseId:`${e.sourceSnapshot.downstreamWorkOrderId}-WAIT`,targetWarehouseName:"印花待加工仓"}:Tt({sourceType:e.sourceType,productionOrderNo:e.sourceProductionOrderNo||((a=e.productionOrderIds)==null?void 0:a[0]),supplementRecordId:(s=e.sourceSnapshot)==null?void 0:s.supplementRecordId,supplementRecordNo:(n=e.sourceSnapshot)==null?void 0:n.supplementRecordNo,receivingTeamId:(d=e.sourceSnapshot)
```

Header/cutting/difference source and paths are retained in `qualified-stage-callers.json`, `qualified-branch-children.json`, `qualified-sources-and-clones.json`, `qualified-repeat-source-paths.json`, and `qualified-dye-header-breakdown.json`. No new invocation-count probe or extra browser run was used. Runtime assets were copied from this exact frozen dist:134 files,11,417,946 bytes, with per-file hashes in binding evidence.

No delta/actions/print/route preflight or formal acceptance was run for stage20 after the normal cold failure. Wait for root decision and a newly frozen version before further sampling.

Original source names and lines

- `src/data/fcs/pda-handover-events.ts:2446 cloneHead` = runtime `K`.
- `src/data/fcs/pda-handover-events.ts:3803 listHeadsSorted` = runtime `er`.
- `src/data/fcs/pda-handover-events.ts:4101 listPdaHandoverHeadsByType` = runtime `xe`.
- `src/data/fcs/pda-handover-events.ts:4133 getPdaPickupHeads` = runtime `gu`.
- `src/data/fcs/pda-handover-events.ts:4139 getPdaHandoutHeads` = runtime `Du`.
- `src/data/fcs/post-finishing-current-read-model.ts:452 listPostFinishingTasks` = runtime `fr`.
- `src/data/fcs/post-finishing-full-flow.ts:2714 listPostFinishingTaskQuantitySummaries` = runtime `Yt`.
- `src/data/fcs/post-finishing-full-flow.ts:2724 listPostFinishingTaskChildQuantitySummaries` = runtime `Zt`.

The PROCESS_DOC post projection35.979ms has five directly sampled children: SC provider25.478ms (including SC ensureStore23.971ms), task quantity summaries5.994ms, child primitive summaries1.505ms, formal source builder1.492ms, final mapping1.510ms. These sum35.979ms; no additional deep history clone duration should be added. Exact original snippets are retained in `original-source-mapping.json`.
