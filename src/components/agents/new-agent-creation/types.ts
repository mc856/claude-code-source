import type { SettingSource } from 'src/utils/settings/constants.js'
import type { Tools } from '../../../Tool.js'
import type { AgentColorName } from '../../../tools/AgentTool/agentColorManager.js'
import type { AgentMemoryScope } from '../../../tools/AgentTool/agentMemory.js'
import type { CustomAgentDefinition } from '../../../tools/AgentTool/loadAgentsDir.js'
import type { GeneratedAgent } from '../generateAgent.js'

export type AgentCreationMethod = 'generate' | 'manual'

export type AgentWizardData = {
  location?: SettingSource
  method?: AgentCreationMethod
  agentType?: string
  whenToUse?: string
  systemPrompt?: string
  generationPrompt?: string
  generatedAgent?: GeneratedAgent
  isGenerating?: boolean
  wasGenerated?: boolean
  selectedTools?: string[]
  selectedModel?: string
  selectedColor?: AgentColorName | 'automatic'
  selectedMemory?: AgentMemoryScope
  finalAgent?: Omit<CustomAgentDefinition, 'location'>
  tools?: Tools
}
