import { resolve } from 'node:path'
import process from 'node:process'
import ts from 'typescript'

const rootDir = process.cwd()
const fixturePath = resolve(rootDir, 'tests/pcs-repository-sync-transaction.types.ts')
const configPath = resolve(rootDir, 'tsconfig.json')
const config = ts.readConfigFile(configPath, ts.sys.readFile)
if (config.error) {
  console.error(ts.formatDiagnosticsWithColorAndContext([config.error], {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => rootDir,
    getNewLine: () => '\n',
  }))
  process.exit(1)
}

const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, rootDir)
const program = ts.createProgram([fixturePath], parsed.options)
const fixtureDiagnostics = ts.getPreEmitDiagnostics(program).filter(
  (diagnostic) => diagnostic.file && resolve(diagnostic.file.fileName) === fixturePath,
)

if (fixtureDiagnostics.length > 0) {
  console.error(ts.formatDiagnosticsWithColorAndContext(fixtureDiagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => rootDir,
    getNewLine: () => '\n',
  }))
  process.exit(1)
}

console.log('check-pcs-repository-sync-transactions.ts PASS')
