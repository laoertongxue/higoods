import test from 'node:test'
import assert from 'node:assert/strict'
import { patternRepo } from '../src/data/pcs-pattern-library-repository.ts'
import { listMaterialPatternChoices, getMaterialPatternReference, listMaterialPatternVersionChoices } from '../src/data/pcs-material-pattern.ts'

test('MAT-012: pattern selection reads existing identity and versions without seeding browser business records', async () => {
  let saves = 0, reads = 0
  const originalLoad = patternRepo.loadStore, originalSave = patternRepo.saveStore
  patternRepo.loadStore = async () => { reads++; return null }
  patternRepo.saveStore = async () => { saves++ }
  try {
    const candidates = listMaterialPatternChoices()
    assert.ok(candidates.length > 0)
    const selected = candidates[0], reference = getMaterialPatternReference(selected.id)
    assert.equal(reference.patternId, selected.id)
    assert.equal(reference.patternCode, selected.pattern_code)
    assert.ok(listMaterialPatternVersionChoices(selected.id).some(version => version.id === reference.patternVersionId))
    assert.throws(() => getMaterialPatternReference(selected.id, 'another-pattern-version'), /不属于/)
    assert.ok(!/^(data|blob):/i.test(reference.patternImageUrl))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(reads, 1)
    assert.equal(saves, 0)
  } finally { patternRepo.loadStore = originalLoad; patternRepo.saveStore = originalSave }
})
