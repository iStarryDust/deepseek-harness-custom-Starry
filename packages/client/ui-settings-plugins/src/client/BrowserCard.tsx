/**
 * The built-in browser plugin's card: the install action, the agent-use switch,
 * and the request headers (with its reset-default and save actions).
 */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { PluginCard } from './PluginCard.tsx'
import { SwitchField, TextAreaField } from './fields.tsx'
import type { BrowserCardFace } from './browser-card-controller.ts'
import type {} from './slot-contract.ts'
import css from './fields.module.css'

/** Props the renderer binds for the browser card. */
export type BrowserCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.plugins'>
  & InjectFace<BrowserCardFace>

/**
 * Render the built-in browser card.
 * @param props - locale copy, the card snapshot, and its form/install actions.
 * @returns the card.
 */
export function BrowserCard(props: BrowserCardProps) {
  const { t } = props
  const state = props.useBrowserCard(snapshot => snapshot)
  const disabled = !state.writable
  return (
    <PluginCard
      t={t}
      titleKey="browserTitle"
      descriptionKey="browserDescription"
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
      <div className={css.field}>
        <div className={css.head}>
          <span className={css.label}>{t('browserInstallTitle')}</span>
        </div>
        <div className={css.actionsRow}>
          <button
            type="button"
            className={css.actionButton}
            disabled={disabled || state.installing}
            onClick={props.install}
          >
            {state.installing ? t('browserInstalling') : state.browserInstalled ? t('browserInstalled') : t('browserInstall')}
          </button>
          {state.probing ? <span className={css.installStatus}>{t('browserProbing')}</span> : null}
        </div>
        {state.installMessage ? <p className={css.installStatus}>{state.installMessage}</p> : null}
        <p className={css.hint}>{t('browserInstallHint')}</p>
      </div>

      <SwitchField
        id="plugin-config-browser-use"
        label={t('browserAgentUse')}
        hint={t('browserAgentUseHint')}
        checked={state.agentUseBrowser.text === 'true'}
        overridden={state.agentUseBrowser.overridden}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        disabled={disabled}
        onToggle={(next) => { props.edit('agentUseBrowser', next ? 'true' : 'false') }}
        onReset={() => { props.resetField('agentUseBrowser') }}
      />

      <TextAreaField
        id="plugin-config-browser-headers"
        label={t('browserRequestHeaders')}
        hint={t('browserRequestHeadersHint')}
        text={state.requestHeaders.text}
        overridden={state.requestHeaders.overridden}
        invalid={state.requestHeaders.invalid}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        onEdit={(text) => { props.edit('requestHeaders', text) }}
        onReset={() => { props.resetField('requestHeaders') }}
      />

      <div className={css.actionsRow}>
        <button
          type="button"
          className={css.actionButton}
          disabled={disabled}
          onClick={() => { props.resetField('requestHeaders') }}
        >
          {t('browserResetHeaders')}
        </button>
        <button
          type="button"
          className={css.actionButton}
          disabled={disabled || !state.dirty}
          onClick={props.save}
        >
          {t('save')}
        </button>
      </div>
    </PluginCard>
  )
}
