import type { FunctionDeclaration } from '@google/genai'
import { z } from 'zod'
import type { AssistantTool, AssistantToolName, ToolExecutionContext } from './chat-types'

export const assistantToolRegistry: readonly AssistantTool<unknown>[] = []

export const getAssistantTool = (
  name: string,
  registry: readonly AssistantTool<unknown>[] = assistantToolRegistry
): AssistantTool<unknown> | undefined =>
  registry.find((tool) => tool.name === name)

const formatValidationError = (toolName: string, error: z.ZodError): string => {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'input'
      return `${path}: ${issue.message}`
    })
    .join('; ')

  return details
    ? `The ${toolName} tool could not run because its arguments were invalid: ${details}`
    : `The ${toolName} tool could not run because its arguments were invalid.`
}

export const buildFunctionDeclarations = (
  registry: readonly AssistantTool<unknown>[] = assistantToolRegistry
): FunctionDeclaration[] =>
  registry.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: z.toJSONSchema(tool.argsSchema),
  }))

export const dispatchToolCall = async (
  name: AssistantToolName | string,
  rawArgs: unknown,
  ctx: ToolExecutionContext,
  registry: readonly AssistantTool<unknown>[] = assistantToolRegistry
): Promise<string> => {
  const tool = getAssistantTool(name, registry)
  if (!tool) {
    return `The requested tool "${name}" is unavailable.`
  }

  const parsed = tool.argsSchema.safeParse(rawArgs ?? {})
  if (!parsed.success) {
    return formatValidationError(tool.name, parsed.error)
  }

  try {
    return await tool.execute(parsed.data, ctx)
  } catch {
    return `The ${tool.name} tool failed to run right now.`
  }
}
