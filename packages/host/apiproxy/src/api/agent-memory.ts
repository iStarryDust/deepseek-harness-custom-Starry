/**
 * agent-memory domain contract: the memory documents behind the editor
 * surfaces (settings page global store, agent page assistant store).
 *
 * The four switches ride the ordinary settings wire (`agent-memory`
 * namespace), so no memory-specific request exists for them. Every request
 * carries content — never a path — and the Host resolves it against its own
 * harness-home store, so no browser payload can select an arbitrary file.
 */

import type { RpcRequest, RpcResponse } from './rpc.ts'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** agent-memory-domain unary methods (the map key agentMemory.* of RpcMethodMap). */
export interface AgentMemoryApi {
  /** Read the shared global memory document. */
  readGlobal(request: RpcRequest<{}>): Promise<RpcResponse<{ text: string }>>

  /** Replace the shared global memory document (editor save). */
  writeGlobal(request: RpcRequest<{ text: string }>): Promise<RpcResponse<{}>>

  /** Read one agent's memory document. */
  readAgent(request: RpcRequest<{ agentId: string }>):
  Promise<RpcResponse<{ agentId: string; text: string }>>

  /** Replace one agent's memory document (editor save). */
  writeAgent(request: RpcRequest<{ agentId: string; text: string }>):
  Promise<RpcResponse<{ agentId: string }>>

  /**
   * Analyze selected conversation text with the session's own model and write
   * the resulting entries to the session agent's memory store.
   */
  remember(request: RpcRequest<{ sessionId: SessionId; text: string }>):
  Promise<RpcResponse<RememberResponse>>
}

/** agentMemory.remember response value. */
export interface RememberResponse {
  saved: boolean
  agentId?: string
  outcome?: string
  entries?: string[]
}
