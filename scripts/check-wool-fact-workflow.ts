/** The retired single-order contracts are replaced by stage-specific business checks. Each runs isolated. */
import {execFileSync} from 'node:child_process'
for(const script of [
 'check-wool-piece-source.ts', 'check-wool-route-isolation.ts', 'check-wool-receiving-demo-batch.ts', 'check-wool-two-stage-flow.ts', 'check-wool-stage-receiving.ts',
 'check-wool-final-downstream.ts', 'check-wool-final-refresh.ts', 'check-wool-stage-boundaries.ts', 'check-wool-stage-stock-machine.ts',
 'check-wool-legacy-reset.ts', 'check-wool-pda-single-execution.ts', 'check-wool-handover-printing.ts',
 'check-wool-stage-ui.ts', 'check-wool-craft-warehouse.ts', 'check-wool-craft-generation-boundary.ts',
 'check-wool-stock-allocations.ts', 'check-wool-warehouse-unified-model.ts',
]) execFileSync(process.execPath,['--import','tsx',`scripts/${script}`],{stdio:'inherit'})
console.log('PASS 毛织两阶段已登记业务契约；浏览器及性能结果另行验收')
