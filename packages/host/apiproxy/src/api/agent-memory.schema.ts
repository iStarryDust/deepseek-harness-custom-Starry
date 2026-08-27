/**
 * agent-memory domain zod schemas (names derived from map keys:
 * agentMemoryReadGlobalRequestSchema / agentMemoryReadGlobalValueSchema).
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import { sessionIdSchema } from './sessions.schema.ts'

/** agentMemory.readGlobal request payload. */
export const agentMemoryReadGlobalRequestSchema = z.object({
}) satisfies z.ZodType<Wire<RequestPayload<'agentMemory.readGlobal'>>>

/** agentMemory.readGlobal response value. */
export const agentMemoryReadGlobalValueSchema = z.object({
  text: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'agentMemory.readGlobal'>>>

/** agentMemory.writeGlobal request payload. */
export const agentMemoryWriteGlobalRequestSchema = z.object({
  text: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'agentMemory.writeGlobal'>>>

/** agentMemory.writeGlobal response value. */
export const agentMemoryWriteGlobalValueSchema = z.object({
}) satisfies z.ZodType<Wire<ResponseValue<'agentMemory.writeGlobal'>>>

/** agentMemory.readAgent request payload. */
export const agentMemoryReadAgentRequestSchema = z.object({
  agentId: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'agentMemory.readAgent'>>>

/** agentMemory.readAgent response value. */
export const agentMemoryReadAgentValueSchema = z.object({
  agentId: z.string(),
  text: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'agentMemory.readAgent'>>>

/** agentMemory.writeAgent request payload. */
export const agentMemoryWriteAgentRequestSchema = z.object({
  agentId: z.string().min(1),
  text: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'agentMemory.writeAgent'>>>

/** agentMemory.writeAgent response value. */
export const agentMemoryWriteAgentValueSchema = z.object({
  agentId: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'agentMemory.writeAgent'>>>

/** agentMemory.remember request payload. */
export const agentMemoryRememberRequestSchema = z.object({
  sessionId: sessionIdSchema,
  text: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'agentMemory.remember'>>>

/** agentMemory.remember response value. */
export const agentMemoryRememberValueSchema = z.object({
  saved: z.boolean(),
  agentId: z.string().optional(),
  outcome: z.string().optional(),
  entries: z.array(z.string()).optional(),
}) satisfies z.ZodType<Wire<ResponseValue<'agentMemory.remember'>>>
