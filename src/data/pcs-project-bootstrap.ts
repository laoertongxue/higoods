import type { PcsProjectStoreSnapshot } from './pcs-project-types.ts'

export function createBootstrapProjectSnapshot(version: number): PcsProjectStoreSnapshot {
  return {
    version,
    projects: [],
    phases: [],
    nodes: [],
  }
}
