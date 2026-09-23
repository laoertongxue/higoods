// Isolated storage for generating browser fixtures from domain actions.
// Example: DESIGN_REVISION_EVIDENCE_DIR=output/playwright/design-revision-gap/fixtures node --import tsx --import ./tests/helpers/design-revision-evidence-storage.mjs --test --test-name-pattern='同一 BOM 行真实' tests/unit/fcs-design-revision-result-readiness.test.ts
const values = new Map()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  get length() { return values.size },
  getItem(key) { return values.get(key) ?? null },
  setItem(key, value) { values.set(key, String(value)) },
  removeItem(key) { values.delete(key) },
  clear() { values.clear() },
  key(index) { return [...values.keys()][index] ?? null },
} })
