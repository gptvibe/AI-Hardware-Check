import { describe, expect, it } from 'vitest'
import {
  createCompanionHelloRequest,
  formatCompanionCapabilities,
  LOCAL_COMPANION_HANDSHAKE_PROTOCOL,
  LOCAL_COMPANION_HARDWARE_INFO_JSON_SCHEMA,
  LOCAL_COMPANION_PROTOCOL_VERSION,
  parseLocalCompanionHardwareInfo,
} from '../src/domain'
import { createMockLocalCompanionAdapter } from '../src/utils'

describe('local companion contract', () => {
  it('defines a stable protocol and hardware schema contract', () => {
    const hello = createCompanionHelloRequest('1.0.0', {
      totalRam: true,
      gpuModel: true,
      localModels: true,
    })

    expect(hello.protocol).toBe(LOCAL_COMPANION_PROTOCOL_VERSION)
    expect(LOCAL_COMPANION_HANDSHAKE_PROTOCOL.flow).toHaveLength(5)
    expect(LOCAL_COMPANION_HARDWARE_INFO_JSON_SCHEMA.properties.gpus.type).toBe('array')
  })

  it('validates a mocked handshake and hardware snapshot through the adapter', async () => {
    const adapter = createMockLocalCompanionAdapter('1.0.0')
    const session = await adapter.connect()
    const snapshot = await session.requestHardwareSnapshot()

    expect(session.handshake.protocol).toBe(LOCAL_COMPANION_PROTOCOL_VERSION)
    expect(formatCompanionCapabilities(session.handshake.capabilities)).toContain('Total RAM')
    expect(parseLocalCompanionHardwareInfo(snapshot).installedRuntimes.length).toBeGreaterThan(0)
    expect(snapshot.localModels.length).toBeGreaterThan(0)
  })
})
