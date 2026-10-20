import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
// Conservative fixed-version edit contract for historical browser drivers.
// Actual changed file-selection and handover behavior executes in the fresh suite.
const baseline='ecc8af013b5f9d67f5fef14fe5b692483aada61d'
export const ONBOARDING_IDENTITY_FIXTURE_PATHS=[
 'tests/factory-onboarding-final-flow.spec.ts', 'tests/factory-onboarding-p1.spec.ts',
 'tests/factory-onboarding-p2.spec.ts','tests/factory-onboarding-step1-model-state-form.spec.ts',
 'tests/factory-onboarding-step8-form-account-simplify.spec.ts',
] as const
const actualFile="await page.locator('[data-pda-onboarding-file=\"identityFile\"]').setInputFiles({ name: 'identity-test.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.4\\n'), Buffer.alloc(16 * 1024, 32), Buffer.from('\\n%%EOF')]) })"
function migrate(path:string,source:string):string {
 if((ONBOARDING_IDENTITY_FIXTURE_PATHS as readonly string[]).includes(path))return source.replaceAll("await page.locator('[data-pda-onboarding-action=\"use-demo-identity-file\"]').click()",actualFile)
 if(path==='tests/water-soluble-pda.spec.ts')return source.replaceAll('?demoRole=RECEIVER','').replaceAll('?demoRole=FACTORY','').replaceAll('/demoRole=RECEIVER/','/\\/fcs\\/pda\\/handover\\/[^?]+$/')
 if(path==='tests/ppic-shared-consumers.spec.ts')return source.replaceAll('?demoRole=RECEIVER','')
 throw Error('Unregistered historical driver')
}
function assertOnlyExpected(path:string,current:string) {
 const old=execFileSync('git',['show',baseline+':'+path],{encoding:'utf8'}),expected=migrate(path,old)
 assert.notEqual(old,expected,'Migration must change registered fixture/URL')
 assert.equal(current,expected,path+': only explicit obsolete fixture/URL replacements are permitted; selectors, assertions and all other bytes stay unchanged')
}
for(const path of [...ONBOARDING_IDENTITY_FIXTURE_PATHS,'tests/water-soluble-pda.spec.ts','tests/ppic-shared-consumers.spec.ts'])test(path+' exact retired fixture migration',()=>assertOnlyExpected(path,readFileSync(path,'utf8')))
test('retired fixture migration rejects unrelated selectors and weakened assertions',()=>{
 const path=ONBOARDING_IDENTITY_FIXTURE_PATHS[0],source=readFileSync(path,'utf8')
 for(const changed of [source.replace('await expect(', 'await ignored('),source+'\n// unrelated change']){assert.notEqual(changed,source);assert.throws(()=>assertOnlyExpected(path,changed))}
})
