export type ThirdPartyProviderModel = {
  id: string
  model: string
}

export type AppLanguage = 'zh' | 'en'

export type ThirdPartyProviderSettings = {
  id: string
  name: string
  enabled: boolean
  baseUrl: string
  apiKey: string
  models: ThirdPartyProviderModel[]
}

export type CoideSettings = {
  model: string // '' = no explicit selection, otherwise the selected provider model ID
  language: AppLanguage
  skipPermissions: boolean
  notifications: boolean
  systemPrompt: string
  claudeBinaryPath: string
  defaultCwd: string
  fontSize: 'small' | 'medium' | 'large'
  effort: '' | 'low' | 'medium' | 'high' | 'max'
  planMode: boolean
  compactMode: boolean
  autoCompact: boolean
  autoCompactThreshold: number
  thirdPartyProviders: ThirdPartyProviderSettings[]
  onboardingComplete: boolean
}

export const DEFAULT_SETTINGS: CoideSettings = {
  model: '',
  language: 'zh',
  skipPermissions: false,
  notifications: true,
  systemPrompt: '',
  claudeBinaryPath: 'claude',
  defaultCwd: '',
  fontSize: 'medium',
  effort: '',
  planMode: false,
  compactMode: false,
  autoCompact: true,
  autoCompactThreshold: 90,
  thirdPartyProviders: [],
  onboardingComplete: false
}
