#!/usr/bin/env node
// Node-only protocol/byte/cardinality contract. Does not launch a browser.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
const hash = bytes => createHash('sha256').update(bytes).digest('hex'), output = resolve(process.env.FIXTURE_PROTOCOL_OUTPUT || 'output/qc-implementation-20261022/execution-performance/fixture-transport-node-check.json')
const beforeServers = process._getActiveHandles().filter(handle => handle.constructor?.name === 'Server').length
const api = await import('./quality-performance-fixture.mjs')
assert.equal(process._getActiveHandles().filter(handle => handle.constructor?.name === 'Server').length, beforeServers, 'import must not start a server')
const fixture = await api.buildQualityPerformanceFixture(), allowedOrigin = 'http://127.0.0.1:43529', binary = Buffer.from([0,1,2,10,13,127,128,254,255]), phase = 'protocol-only'
const service = await api.startQualityPerformanceFixtureServer({ fixture, allowedOrigin, overlays: { [phase]: [] }, files: [{ id: 'protocol-original-blob', buffer: binary, mimeType: 'application/octet-stream' }] })
const descriptor = service.descriptor(phase), headers = { Origin: allowedOrigin }, report = { nodeOnly: true, nativeBrowserHelperExecuted: false, businessAcceptance: false, startedAt: new Date().toISOString(), importsStartNoServer: true, baseUrl: service.baseUrl, originalManifest: fixture.manifest, streams: [], passed: false }
let fatal
try {
  assert.equal(new URL(service.baseUrl).hostname, '127.0.0.1')
  await assert.rejects(api.startQualityPerformanceFixtureServer({ fixture, allowedOrigin: 'https://example.com' }), /localhost/)
  assert.equal((await fetch(descriptor.manifestUrl)).status, 403)
  assert.equal((await fetch(descriptor.manifestUrl, { headers: { Origin: 'http://127.0.0.1:9' } })).status, 403)
  const post = await fetch(descriptor.manifestUrl, { method: 'POST', headers }); assert.equal(post.status, 405); assert.equal(post.headers.get('allow'), 'GET')
  const options = await fetch(descriptor.manifestUrl, { method: 'OPTIONS', headers }); assert.equal(options.status, 204); assert.equal(options.headers.get('access-control-allow-origin'), allowedOrigin); assert.equal(options.headers.get('access-control-allow-methods'), 'GET')
  const response = await fetch(descriptor.manifestUrl, { headers }); assert.equal(response.status, 200); assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin); assert.equal(response.headers.get('cache-control'), 'no-store')
  const manifest = await response.json(); assert.deepEqual(manifest.original, fixture.manifest)
  const combined = createHash('sha256'); let originalQcRecords = 0, originalRounds = 0, sampleRecords = 0, allBytes = 0
  for (const [kind, stream] of Object.entries(manifest.streams)) {
    const start = performance.now(), response = await fetch(service.baseUrl + stream.path, { headers }); assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /ndjson/)
    const digest = createHash('sha256'), decoder = new TextDecoder(); let buffer = '', count = 0, bytes = 0, wireBytes = 0
    for await (const chunk of response.body) {
      wireBytes += chunk.byteLength; buffer += decoder.decode(chunk, { stream: true }); let offset = 0, end
      while ((end = buffer.indexOf('\n', offset)) >= 0) {
        const line = buffer.slice(offset, end); offset = end + 1; const row = JSON.parse(line)
        assert.ok(row.id && row.collection); digest.update(line); combined.update(line); bytes += Buffer.byteLength(line); count++
        if (row.collection === 'flow/qcTasks' && row.value.qcTaskId.startsWith('QPERF-QC-')) { originalQcRecords++; originalRounds += row.value.inspection.rounds.length }
        if (row.collection === 'production-context:samples') sampleRecords++
      }
      buffer = buffer.slice(offset)
    }
    buffer += decoder.decode(); assert.equal(buffer, ''); assert.equal(count, stream.count); assert.equal(bytes, stream.serializedRowBytes); assert.equal(wireBytes, stream.ndjsonBytes); assert.equal(digest.digest('hex'), stream.sha256); allBytes += bytes
    report.streams.push({ kind, count, serializedRowBytes: bytes, ndjsonBytes: wireBytes, sha256: stream.sha256, nodeFetchParseMs: performance.now() - start })
  }
  assert.equal(combined.digest('hex'), fixture.manifest.sha256); assert.equal(allBytes, 221412084); assert.equal(allBytes, fixture.manifest.serializedRowBytes)
  assert.equal(originalQcRecords, 8000); assert.equal(originalRounds, 20000); assert.equal(sampleRecords, 2000)
  const overlayUrl = descriptor.manifestUrl.replace('/manifest.json', `/overlays/${phase}`); assert.deepEqual(await (await fetch(overlayUrl, { headers })).json(), [])
  const blobResponse = await fetch(service.baseUrl + manifest.files[0].path, { headers }); assert.equal(blobResponse.headers.get('content-type'), 'application/octet-stream'); const restored = Buffer.from(await blobResponse.arrayBuffer()); assert.deepEqual(restored, binary); assert.equal(hash(restored), manifest.files[0].sha256)
  assert.equal((await fetch(service.baseUrl + '/unknown', { headers })).status, 404)
  report.protocol = { exactOriginOnly: true, rejectsMissingOrWrongOrigin: true, readOnlyGet: true, optionsCors: true, unknownPathRejected: true, originalBinaryBytesUnchanged: true }
  report.countsDerivedFromWire = { originalQcRecords, originalRounds, sampleRecords }; report.passed = true
} catch (error) { fatal = error; report.error = { name: error.name, message: error.message, stack: error.stack } }
finally { await service.close(); report.serverExplicitlyClosed = true; report.finishedAt = new Date().toISOString(); report.sources = Object.fromEntries(['scripts/verification/quality-performance-fixture.mjs','scripts/verification/quality-execution-performance.mjs', 'scripts/verification/quality-fixture-transport-check.mjs'].map(path => [path, hash(readFileSync(path))])); mkdirSync(resolve(output, '..'), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2)) }
console.log(JSON.stringify({ passed: report.passed, originalBytes: report.originalManifest.serializedRowBytes, streamRows: report.streams.map(row => [row.kind,row.count]), originalCounts: report.countsDerivedFromWire, browserRun: false, output }, null, 2))
if (fatal) { console.error(fatal); process.exitCode = 1 }
