import React, { useCallback, useEffect, useState } from 'react'
import { useSettingsStore } from '../store/settings'
import { useHookEditorStore } from '../store/hookEditor'
import { type ThirdPartyProviderSettings } from '../../../shared/types'

type SettingsSection = 'essential' | 'advanced' | 'third-party'

export default function SettingsModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const settings = useSettingsStore()
  const update = settings.updateSettings
  const reset = settings.resetSettings
  const [draftProviders, setDraftProviders] = useState<ThirdPartyProviderSettings[]>(settings.thirdPartyProviders)
  const [activeSection, setActiveSection] = useState<SettingsSection>('essential')
  const [saveNotice, setSaveNotice] = useState('')

  const commitProviders = useCallback((providers: ThirdPartyProviderSettings[]): void => {
    const { model: selectedModel, updateSettings } = useSettingsStore.getState()
    const enabledProvider = providers.find((provider) => provider.enabled) ?? null
    const enabledModels = new Set(
      enabledProvider?.models.map((item) => item.model.trim()).filter(Boolean) ?? []
    )
    const trimmedModel = selectedModel.trim()
    const nextModel = trimmedModel && enabledModels.has(trimmedModel) ? trimmedModel : ''
    updateSettings({ thirdPartyProviders: providers, model: nextModel })

    if (trimmedModel && !nextModel) {
      void window.api.settings.syncSelectedModel('')
    }
  }, [])

  const handleBackdrop = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setDraftProviders(settings.thirdPartyProviders)
  }, [settings.thirdPartyProviders])

  useEffect(() => {
    if (!saveNotice) return

    const timeout = window.setTimeout(() => setSaveNotice(''), 2200)
    return () => window.clearTimeout(timeout)
  }, [saveNotice])

  const handlePickDefaultCwd = async (): Promise<void> => {
    const folder = await window.api.dialog.pickFolder()
    if (folder) update({ defaultCwd: folder })
  }

  const saveProviders = (providerName?: string): void => {
    commitProviders(draftProviders)
    setSaveNotice(providerName?.trim() ? 'Saved locally' : 'Saved')
  }

  const activateProviders = (providers: ThirdPartyProviderSettings[]): void => {
    commitProviders(providers)
    const { updateSettings: _updateSettings, resetSettings: _resetSettings, ...state } = useSettingsStore.getState()
    void window.api.settings.activateProvider({
      ...state,
      thirdPartyProviders: providers
    })
  }

  const addProvider = (): void => {
    setDraftProviders([
      ...draftProviders,
      {
        id: crypto.randomUUID(),
        name: '',
        enabled: false,
        baseUrl: '',
        apiKey: '',
        models: [{ id: crypto.randomUUID(), model: '' }]
      }
    ])
  }

  const updateProvider = (
    providerId: string,
    partial: Partial<Omit<ThirdPartyProviderSettings, 'id' | 'models'>>
  ): void => {
    if (partial.enabled === true) {
      const nextProviders = draftProviders.map((provider) => ({
        ...provider,
        enabled: provider.id === providerId
      }))
      setDraftProviders(nextProviders)
      activateProviders(nextProviders)
      return
    }

    if (partial.enabled === false) {
      const nextProviders = draftProviders.map((provider) => {
        if (provider.id === providerId) return { ...provider, enabled: false }
        return provider
      })
      setDraftProviders(nextProviders)
      activateProviders(nextProviders)
      return
    }

    setDraftProviders(
      draftProviders.map((provider) =>
        provider.id === providerId ? { ...provider, ...partial } : provider
      )
    )
  }

  const removeProvider = (providerId: string): void => {
    const remainingProviders = draftProviders.filter((provider) => provider.id !== providerId)
    setDraftProviders(remainingProviders)
  }

  const addModel = (providerId: string): void => {
    setDraftProviders(
      draftProviders.map((provider) =>
        provider.id === providerId
          ? {
              ...provider,
              models: [...provider.models, { id: crypto.randomUUID(), model: '' }]
            }
          : provider
      )
    )
  }

  const updateModel = (providerId: string, modelId: string, model: string): void => {
    setDraftProviders(
      draftProviders.map((provider) =>
        provider.id === providerId
          ? {
              ...provider,
              models: provider.models.map((item) =>
                item.id === modelId ? { ...item, model } : item
              )
            }
          : provider
      )
    )
  }

  const removeModel = (providerId: string, modelId: string): void => {
    setDraftProviders(
      draftProviders.map((provider) =>
        provider.id === providerId
          ? {
              ...provider,
              models:
                provider.models.length > 1
                  ? provider.models.filter((item) => item.id !== modelId)
                  : provider.models
            }
          : provider
      )
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="relative flex h-[85vh] w-full max-w-[960px] overflow-hidden rounded-[28px] border border-white/[0.1] bg-[#141414] shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
        {saveNotice ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-[772px] items-center justify-center">
            <div className="rounded-2xl border border-cyan-300/20 bg-[#11181a]/95 px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <p className="text-sm font-medium text-white/90">{saveNotice}</p>
            </div>
          </div>
        ) : null}
        <aside className="flex w-[188px] flex-shrink-0 flex-col border-r border-white/[0.06] bg-[#101010] px-4 py-6">
          <div className="mb-7 pr-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/35">Preferences</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white/92">Settings</h2>
            <p className="mt-2 text-xs leading-5 text-white/32">
              Configure runtime behavior, workspace defaults, and provider access.
            </p>
          </div>
          <nav className="space-y-2">
            <SidebarItem
              title="Essential"
              subtitle="Core behavior"
              active={activeSection === 'essential'}
              onClick={() => setActiveSection('essential')}
            />
            <SidebarItem
              title="Advanced"
              subtitle="Runtime and workspace"
              active={activeSection === 'advanced'}
              onClick={() => setActiveSection('advanced')}
            />
            <SidebarItem
              title="Third-Party API"
              subtitle="Providers and models"
              active={activeSection === 'third-party'}
              onClick={() => setActiveSection('third-party')}
            />
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <div className="mx-auto flex w-full max-w-[680px] items-center justify-between gap-4">
              <h3 className="text-[22px] font-semibold tracking-tight text-white/92">
                {activeSection === 'essential'
                  ? 'Essential'
                  : activeSection === 'advanced'
                    ? 'Advanced'
                    : 'Third-Party API'}
              </h3>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center text-lg leading-none text-white/38 transition-colors hover:text-white/70"
                type="button"
                aria-label="Close settings"
              >
                &times;
              </button>
            </div>
          </div>

          <div className="min-w-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="mx-auto w-full max-w-[680px]">
              {activeSection === 'essential' && (
                <>
                  <SectionLabel>Essential</SectionLabel>

                  <SettingRow label="Skip Permissions">
                    <Toggle
                      checked={settings.skipPermissions}
                      onChange={(v) => update({ skipPermissions: v })}
                    />
                  </SettingRow>

                  <SettingRow label="Notifications">
                    <Toggle
                      checked={settings.notifications}
                      onChange={(v) => update({ notifications: v })}
                    />
                  </SettingRow>

                  <SettingRow label="Auto-compact">
                    <Toggle
                      checked={settings.autoCompact}
                      onChange={(v) => update({ autoCompact: v })}
                    />
                  </SettingRow>

                  <div className="mb-4">
                    <label className="block text-xs text-white/50 mb-1.5">System Prompt</label>
                    <textarea
                      value={settings.systemPrompt}
                      onChange={(e) => update({ systemPrompt: e.target.value })}
                      placeholder="Appended to Claude's system prompt..."
                      rows={3}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/80 placeholder-white/20 outline-none focus:border-white/[0.15] transition-colors resize-none"
                    />
                  </div>
                </>
              )}

              {activeSection === 'advanced' && (
                <>
                  <SectionLabel>Advanced</SectionLabel>

                  <div className="mb-3">
                    <label className="block text-xs text-white/50 mb-1.5">Claude Binary</label>
                    <input
                      type="text"
                      value={settings.claudeBinaryPath}
                      onChange={(e) => update({ claudeBinaryPath: e.target.value })}
                      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 font-mono outline-none focus:border-white/[0.15] transition-colors"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs text-white/50 mb-1.5">Default CWD</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={settings.defaultCwd}
                        onChange={(e) => update({ defaultCwd: e.target.value })}
                        className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 font-mono outline-none focus:border-white/[0.15] transition-colors"
                      />
                      <button
                        onClick={handlePickDefaultCwd}
                        className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/40 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
                        title="Browse..."
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="block text-xs text-white/50 mb-1.5">Hooks</label>
                    <button
                      onClick={() => {
                        onClose()
                        useHookEditorStore.getState().open()
                      }}
                      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/40 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
                    >
                      Configure Hooks...
                    </button>
                  </div>

                  <SettingRow label="Font Size">
                    <SegmentedControl
                      value={settings.fontSize}
                      onChange={(v) => update({ fontSize: v as 'small' | 'medium' | 'large' })}
                      options={[
                        { value: 'small', label: 'S' },
                        { value: 'medium', label: 'M' },
                        { value: 'large', label: 'L' }
                      ]}
                    />
                  </SettingRow>

                  <SettingRow label="Effort Level">
                    <Select
                      value={settings.effort}
                      onChange={(v) => update({ effort: v })}
                      options={[
                        { value: '', label: 'Default' },
                        { value: 'low', label: 'Low' },
                        { value: 'medium', label: 'Medium' },
                        { value: 'high', label: 'High' }
                      ]}
                    />
                  </SettingRow>
                </>
              )}

              {activeSection === 'third-party' && (
                <>
                  <div className="mb-4 flex w-full items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">
                      Third-Party API
                    </p>
                    <button
                      onClick={addProvider}
                      aria-label="Add provider"
                      className="flex h-8 w-8 items-center justify-center text-lg leading-none text-cyan-100/80 transition-colors hover:text-cyan-100"
                    >
                      +
                    </button>
                  </div>

                  <div className="mb-3 w-full">
                    {draftProviders.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center">
                        <p className="text-xs text-white/28">No third-party provider configured yet.</p>
                      </div>
                    ) : (
                      <div className="grid justify-items-start gap-x-4 gap-y-5 md:grid-cols-2">
                        {draftProviders.map((provider) => (
                          <div
                            key={provider.id}
                            className={`w-[320px] rounded-2xl border p-4 shadow-[0_12px_40px_rgba(0,0,0,0.18)] transition-colors ${
                              provider.enabled
                                ? 'border-white/[0.08] bg-[#101010]'
                                : 'border-white/[0.05] bg-[#101010]/55'
                            }`}
                          >
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div className="flex h-8 items-center">
                                <div className="flex h-8 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2">
                                  <span className={`text-[11px] ${provider.enabled ? 'text-emerald-300/75' : 'text-white/35'}`}>
                                    {provider.enabled ? 'Enabled' : 'Disabled'}
                                  </span>
                                  <Toggle
                                    checked={provider.enabled}
                                    onChange={(v) => updateProvider(provider.id, { enabled: v })}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => removeProvider(provider.id)}
                                  disabled={provider.enabled}
                                  className="flex h-8 items-center rounded-lg border border-red-400/10 bg-red-400/[0.05] px-2.5 text-[11px] text-red-200/70 transition-colors hover:bg-red-400/[0.1] disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  Remove
                                </button>
                                <button
                                  onClick={() => saveProviders(provider.name)}
                                  disabled={provider.enabled}
                                  className="flex h-8 items-center rounded-lg border border-cyan-400/15 bg-cyan-400/[0.08] px-2.5 text-[11px] text-cyan-100/80 transition-colors hover:bg-cyan-400/[0.12] disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  Save
                                </button>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <SettingsField label="Provider Name">
                                <input
                                  type="text"
                                  value={provider.name}
                                  onChange={(e) => updateProvider(provider.id, { name: e.target.value })}
                                  placeholder="OpenAI-compatible provider"
                                  className={fieldClassName}
                                  disabled={provider.enabled}
                                />
                              </SettingsField>

                              <SettingsField label="Base URL">
                                <input
                                  type="text"
                                  value={provider.baseUrl}
                                  onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value })}
                                  placeholder="https://api.example.com/v1"
                                  className={fieldClassName}
                                  disabled={provider.enabled}
                                />
                              </SettingsField>

                              <SettingsField label="API Key">
                                <input
                                  type="password"
                                  value={provider.apiKey}
                                  onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })}
                                  placeholder="sk-..."
                                  className={fieldClassName}
                                  disabled={provider.enabled}
                                />
                              </SettingsField>

                              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-3">
                                <div className="mb-3 flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">
                                    Models
                                  </p>
                                  <button
                                    onClick={() => addModel(provider.id)}
                                    disabled={provider.enabled}
                                    className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/55 transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
                                  >
                                    Add
                                  </button>
                                </div>

                                <div className="flex flex-wrap gap-1.5 px-0.5">
                                  {provider.models.map((item) => (
                                    <div
                                      key={item.id}
                                      style={{
                                        minWidth: 'calc((100% - 0.75rem) / 3)',
                                        width: 'fit-content',
                                        maxWidth: 'calc((100% - 0.375rem) / 2)'
                                      }}
                                      className="inline-flex h-8 items-center gap-1.5 overflow-hidden rounded-full border border-cyan-300/[0.14] bg-cyan-300/[0.06] px-2.5"
                                    >
                                      <input
                                        type="text"
                                        value={item.model}
                                        onChange={(e) => updateModel(provider.id, item.id, e.target.value)}
                                        placeholder="gpt-4o-mini"
                                        className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap bg-transparent text-[11px] text-cyan-50/90 placeholder:text-cyan-50/30 outline-none disabled:cursor-not-allowed disabled:text-cyan-50/45"
                                        disabled={provider.enabled}
                                      />
                                      <button
                                        onClick={() => removeModel(provider.id, item.id)}
                                        disabled={provider.enabled || provider.models.length <= 1}
                                        className="text-[11px] leading-none text-cyan-50/45 transition-colors hover:text-cyan-50/75 disabled:cursor-not-allowed disabled:opacity-30"
                                        aria-label="Remove model"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#121212] px-6 py-4">
            <button
              onClick={() => reset()}
              className="text-[11px] text-white/30 hover:text-white/50 transition-colors"
            >
              Reset to Defaults
            </button>
            <button
              onClick={onClose}
              className="rounded-lg bg-white/[0.08] px-4 py-1.5 text-xs text-white/70 hover:bg-white/[0.12] transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SidebarItem({
  title,
  subtitle,
  active = false,
  onClick
}: {
  title: string
  subtitle: string
  active?: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
        active
          ? 'border-cyan-400/15 bg-cyan-400/[0.08]'
          : 'border-white/[0.04] bg-white/[0.02]'
      }`}
      type="button"
    >
      <p className={`text-xs font-medium ${active ? 'text-cyan-100/85' : 'text-white/72'}`}>{title}</p>
      <p className="mt-1 text-[11px] text-white/30">{subtitle}</p>
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25 mb-3">{children}</p>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between mb-3">
      <label className="text-xs text-white/50">{label}</label>
      {children}
    </div>
  )
}

function SettingsField({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium text-white/42">{label}</label>
      {children}
    </div>
  )
}

const fieldClassName =
  'w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white/78 placeholder-white/18 outline-none focus:border-cyan-300/[0.22] focus:bg-white/[0.05] transition-colors disabled:cursor-not-allowed disabled:border-white/[0.05] disabled:bg-white/[0.02] disabled:text-white/35'

function Toggle({
  checked,
  onChange,
  disabled = false
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      onClick={() => {
        if (!disabled) onChange(!checked)
      }}
      disabled={disabled}
      className={`relative h-5 w-9 rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-white/[0.1]'
      } ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`}
      />
    </button>
  )
}

function Select({
  value,
  onChange,
  options
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}): React.JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-white/70 outline-none focus:border-white/[0.15] transition-colors appearance-none cursor-pointer pr-6"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23666' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center'
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-[#1a1a1a] text-white/80">
          {opt.label}
        </option>
      ))}
    </select>
  )
}

function SegmentedControl({
  value,
  onChange,
  options
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}): React.JSX.Element {
  return (
    <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-xs transition-colors ${
            value === opt.value
              ? 'bg-white/[0.1] text-white/80'
              : 'text-white/30 hover:text-white/50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
