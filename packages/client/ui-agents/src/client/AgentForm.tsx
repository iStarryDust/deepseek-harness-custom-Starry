/**
 * The create / profile form for one agent.
 *
 * Both modes share the identity fields (name, language, persona); the create
 * mode additionally offers the base-mode select and hides the delete action,
 * while the edit mode prefills from the agent's stored profile and puts the
 * delete action on the left of the confirm button, per the product flow.
 */

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import type { AgentsKey } from './locales.ts'
import type { AgentFormInput } from './stores.ts'
import css from './AgentForm.module.css'

/** Which surface the form serves. */
export type AgentFormMode = 'create' | 'edit'

/** Form props, composed by the browser. */
export interface AgentFormProps {
  /** create and edit share the identity fields; edit adds the delete action. */
  mode: AgentFormMode
  /** Prefill (edit only; null means still loading). */
  initial: AgentFormInput | null
  /** A wire call is in flight — buttons disabled. */
  busy: boolean
  /** A rejected wire call's message, shown above the actions. */
  error: string | null
  /** Locale seat. */
  t: (key: AgentsKey) => string
  /** Confirm. */
  onSubmit: (input: AgentFormInput) => void
  /** Leave the form. */
  onCancel: () => void
  /** Delete the agent being edited (edit mode only). */
  onDelete: (() => void) | undefined
}

/** Render the create / profile form. */
export function AgentForm({
  mode, initial, busy, error, t, onSubmit, onCancel, onDelete,
}: AgentFormProps) {
  const [name, setName] = useState('')
  const [language, setLanguage] = useState('')
  const [description, setDescription] = useState('')
  const [persona, setPersona] = useState('')
  const [touched, setTouched] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Prefill when the profile arrives.
  useEffect(() => {
    if (initial === null) return
    setName(initial.name)
    setLanguage(initial.language)
    setDescription(initial.description)
    setPersona(initial.persona)
  }, [initial])

  const invalid = (value: string): boolean => touched && value.trim() === ''
  const valid = name.trim() !== '' && language.trim() !== '' && persona.trim() !== ''

  const submit = (): void => {
    setTouched(true)
    if (!valid) return
    onSubmit({
      name: name.trim(),
      language: language.trim(),
      description: description.trim(),
      persona: persona.trim(),
    })
  }

  return (
    <div className={css.root}>
      <div className={css.header}>
        <button type="button" className={css.back} onClick={onCancel} disabled={busy}>
          ← {t('agents.back')}
        </button>
        <span className={css.title}>
          {mode === 'create' ? t('form.title.create') : t('form.title.edit')}
        </span>
      </div>

      <div className={css.fields}>
        <label className={css.field}>
          <span className={css.label}>{t('form.name')}</span>
          <input
            className={clsx(css.input, invalid(name) && css.invalid)}
            value={name}
            onChange={(event) => { setName(event.target.value) }}
            placeholder={t('form.name.placeholder')}
            disabled={busy}
            autoFocus
          />
          {invalid(name) && <span className={css.fieldError}>{t('error.required')}</span>}
        </label>

        <label className={css.field}>
          <span className={css.label}>{t('form.description')}</span>
          <input
            className={css.input}
            value={description}
            onChange={(event) => { setDescription(event.target.value) }}
            placeholder={t('form.description.placeholder')}
            disabled={busy}
          />
        </label>

        <label className={css.field}>
          <span className={css.label}>{t('form.language')}</span>
          <input
            className={clsx(css.input, invalid(language) && css.invalid)}
            value={language}
            onChange={(event) => { setLanguage(event.target.value) }}
            placeholder={t('form.language.placeholder')}
            disabled={busy}
          />
          {invalid(language) && <span className={css.fieldError}>{t('error.required')}</span>}
        </label>

        <label className={css.field}>
          <span className={css.label}>{t('form.persona')}</span>
          <textarea
            className={clsx(css.textarea, invalid(persona) && css.invalid)}
            value={persona}
            onChange={(event) => { setPersona(event.target.value) }}
            placeholder={t('form.persona.placeholder')}
            disabled={busy}
            rows={6}
          />
          {invalid(persona) && <span className={css.fieldError}>{t('error.required')}</span>}
        </label>
      </div>

      {error !== null && <div className={css.error}>{error}</div>}

      <div className={css.actions}>
        {mode === 'edit' && onDelete !== undefined && (
          <button
            type="button"
            className={css.delete}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true)
                return
              }
              onDelete()
            }}
            disabled={busy}
          >
            {confirmDelete ? t('form.delete.confirm') : t('form.delete')}
          </button>
        )}
        <span className={css.actionsSpacer} />
        <button type="button" className={css.cancel} onClick={onCancel} disabled={busy}>
          {t('form.cancel')}
        </button>
        <button type="button" className={css.submit} onClick={submit} disabled={busy}>
          {t('form.submit')}
        </button>
      </div>
    </div>
  )
}
