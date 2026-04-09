import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type CoideSettings, DEFAULT_SETTINGS, type ThirdPartyProviderSettings } from '../../../shared/types'

function normalizeProviders(providers: ThirdPartyProviderSettings[] = []): ThirdPartyProviderSettings[] {
  const merged = providers.map((provider) => ({
    enabled: false,
    ...provider
  }))

  if (merged.length === 0) return merged

  const enabledIndex = merged.findIndex((provider) => provider.enabled)
  if (enabledIndex < 0) return merged

  return merged.map((provider, index) => ({
    ...provider,
    enabled: index === enabledIndex
  }))
}

type SettingsStore = CoideSettings & {
  updateSettings: (partial: Partial<CoideSettings>) => void
  resetSettings: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      updateSettings: (partial: Partial<CoideSettings>) => set(partial),
      resetSettings: () => set(DEFAULT_SETTINGS)
    }),
    {
      name: 'coide-settings',
      merge: (persisted, current) => {
        const merged = {
          ...current,
          ...(persisted as Partial<SettingsStore>)
        }
        // Migration: existing users with defaultCwd already set skip onboarding
        if (merged.defaultCwd && (persisted as Record<string, unknown>)?.onboardingComplete === undefined) {
          merged.onboardingComplete = true
        }
        merged.thirdPartyProviders = normalizeProviders(merged.thirdPartyProviders ?? [])
        return merged
      },
    }
  )
)
