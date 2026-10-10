import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  LockKeyhole,
  MapPin,
  RefreshCcw,
  Send,
  ShieldCheck,
} from 'lucide-react'

type UiOption = {
  id: string
  label: string
}

type LumiUi = {
  type: string
  questionId: string
  prompt?: string
  options?: UiOption[]
  actions?: UiOption[]
  allowFreeText?: boolean
  minSelections?: number
  maxSelections?: number
  min?: number
  max?: number
  step?: number
  maxLength?: number
  length?: number
  optional?: boolean
  selectedValues?: string[]
  quoteId?: string | null
  expiresAt?: string | null
}

type LumiData = {
  missingFields?: string[]
  quoteStatus?: string | null
  customerFacingPrice?: number | string | null
  negotiationStatus?: string | null
  selectedQuoteStatus?: string | null
  emailVerified?: boolean
  verificationDeliveryStatus?: string | null
  verificationDeliveryCode?: string | null
}

type LumiResponse = {
  success?: boolean
  error?: string | null
  message?: string
  reply?: string
  sessionId?: string
  status?: string
  data?: LumiData
  ui?: LumiUi | null
}

type ChatItem = {
  id: string
  role: 'assistant' | 'user'
  text: string
}

type RequestPayload = {
  message?: string
  selection?: {
    questionId: string
    value?: string
    values?: string[]
  }
}

const API_URL =
  import.meta.env.VITE_LUMI_API_URL ||
  'https://i0cae18igk.execute-api.us-east-2.amazonaws.com/chat'

const SESSION_KEY = 'picsway_lumi_session_id_v13'
const STATE_KEY = 'picsway_lumi_state_v13'
const CHAT_KEY = 'picsway_lumi_chat_v13'
const REQUEST_TIMEOUT_MS = 30000

const starterChat: ChatItem[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: "Hi — I'm Lumi. I'll help you build a PicSway quote one clear step at a time.",
  },
]

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function storageGet(key: string) {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // Session storage is a convenience only. Lumi still works without it.
  }
}

function storageRemove(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}

function formatMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return String(value)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(numeric)
}

function formatExpiry(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function currentStage(ui: LumiUi | null, response: LumiResponse | null) {
  const qid = ui?.questionId || ''
  if (
    qid.includes('quote_saved') ||
    qid.includes('otp') ||
    qid.includes('save_quote') ||
    response?.data?.selectedQuoteStatus === 'SELECTED'
  ) {
    return 4
  }
  if (
    qid.includes('quote_action') ||
    qid.includes('negotiation') ||
    qid.includes('counteroffer') ||
    response?.data?.quoteStatus === 'QUOTE_READY'
  ) {
    return 3
  }
  if (
    qid.includes('services') ||
    qid.includes('coverage') ||
    qid.includes('second_shooter') ||
    qid.includes('package_edit')
  ) {
    return 2
  }
  return 1
}

function isStateQuestion(ui: LumiUi | null) {
  return Boolean(ui?.questionId?.startsWith('event_state_'))
}

function inputMeta(ui: LumiUi | null) {
  const qid = ui?.questionId || ''

  if (qid === 'email') {
    return {
      type: 'email',
      inputMode: 'email' as const,
      placeholder: 'you@example.com',
      prefix: '',
      autoComplete: 'email',
    }
  }

  if (qid.startsWith('event_date_')) {
    return {
      type: 'date',
      inputMode: undefined,
      placeholder: '',
      prefix: '',
      autoComplete: 'off',
    }
  }

  if (qid === 'budget_amount') {
    return {
      type: 'text',
      inputMode: 'decimal' as const,
      placeholder: 'Enter your budget',
      prefix: '$',
      autoComplete: 'off',
    }
  }

  if (qid === 'counteroffer_amount') {
    return {
      type: 'text',
      inputMode: 'decimal' as const,
      placeholder: 'Enter your counteroffer',
      prefix: '$',
      autoComplete: 'off',
    }
  }

  if (ui?.type === 'currency') {
    return {
      type: 'text',
      inputMode: 'decimal' as const,
      placeholder: 'Enter amount',
      prefix: '$',
      autoComplete: 'off',
    }
  }

  if (ui?.type === 'number') {
    return {
      type: 'number',
      inputMode: 'decimal' as const,
      placeholder: 'Enter a number',
      prefix: '',
      autoComplete: 'off',
    }
  }

  if (ui?.type === 'otp') {
    return {
      type: 'text',
      inputMode: 'numeric' as const,
      placeholder: '6-digit code',
      prefix: '',
      autoComplete: 'one-time-code',
    }
  }

  if (qid.startsWith('event_exact_location_')) {
    return {
      type: 'text',
      inputMode: 'text' as const,
      placeholder: 'Venue name, city, or address',
      prefix: '',
      autoComplete: 'street-address',
    }
  }

  if (qid === 'full_name') {
    return {
      type: 'text',
      inputMode: 'text' as const,
      placeholder: 'Your full name',
      prefix: '',
      autoComplete: 'name',
    }
  }

  return {
    type: 'text',
    inputMode: 'text' as const,
    placeholder: 'Type your answer',
    prefix: '',
    autoComplete: 'off',
  }
}

function humanizeApiError(error?: string | null, fallback?: string) {
  if (fallback) return fallback
  if (!error) return 'That step could not be completed. Please try again.'

  const known: Record<string, string> = {
    EmailDeliveryFailed: 'We could not send the verification email. Check the address and try again.',
    InvalidFieldValue: 'That value was not accepted. Please check it and try again.',
    InvalidRequest: 'That request was not accepted. Please try the current step again.',
    InvalidSelection: 'That option is no longer available. Please use the choices shown below.',
  }

  return known[error] || 'That step could not be completed. Please try again.'
}

export default function App() {
  const [response, setResponse] = useState<LumiResponse | null>(null)
  const [chat, setChat] = useState<ChatItem[]>(starterChat)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [multiSelected, setMultiSelected] = useState<string[]>([])
  const initialized = useRef(false)
  const requestInFlight = useRef(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const ui = response?.ui || null
  const stage = currentStage(ui, response)
  const price = formatMoney(response?.data?.customerFacingPrice)
  const meta = inputMeta(ui)
  const stageNames = ['Details', 'Services', 'Quote', 'Verified']

  function appendChat(role: ChatItem['role'], text: string) {
    const cleanText = text.trim()
    if (!cleanText) return

    setChat((items) => {
      const next = [...items, { id: makeId(), role, text: cleanText }]
      storageSet(CHAT_KEY, JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const savedState = storageGet(STATE_KEY)
    const savedChat = storageGet(CHAT_KEY)

    if (savedState) {
      try {
        setResponse(JSON.parse(savedState) as LumiResponse)
      } catch {
        storageRemove(STATE_KEY)
      }
    }

    if (savedChat) {
      try {
        const parsed = JSON.parse(savedChat) as ChatItem[]
        if (Array.isArray(parsed) && parsed.length > 0) setChat(parsed)
      } catch {
        storageRemove(CHAT_KEY)
      }
    }

    if (!savedState) {
      void sendRequest({ message: 'start' }, false)
    }
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chat, ui?.questionId])

  useEffect(() => {
    setInput('')
    setMultiSelected(ui?.selectedValues || [])
  }, [ui?.questionId, ui?.selectedValues])

  const optionGroups = useMemo(() => ui?.options || [], [ui?.options])

  async function sendRequest(
    payload: RequestPayload,
    addUserBubble = true,
    displayText?: string,
  ) {
    if (requestInFlight.current) return

    requestInFlight.current = true
    setLoading(true)
    setError(null)

    const sessionId = storageGet(SESSION_KEY)
    const body = {
      ...payload,
      ...(sessionId ? { sessionId } : {}),
    }

    if (addUserBubble && displayText) {
      appendChat('user', displayText)
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      const raw = await res.text()
      let data: LumiResponse

      try {
        data = raw ? (JSON.parse(raw) as LumiResponse) : {}
      } catch {
        throw new Error(`PicSway API returned an unreadable response (${res.status}).`)
      }

      if (data.sessionId) storageSet(SESSION_KEY, data.sessionId)
      setResponse(data)
      storageSet(STATE_KEY, JSON.stringify(data))

      const assistantText = (data.reply || data.message || '').trim()
      const uiPrompt = (data.ui?.prompt || '').trim()

      // If the API reply is only the same field prompt already rendered below,
      // avoid showing it twice. This keeps the chat feeling intentional.
      if (assistantText && assistantText !== uiPrompt) {
        appendChat('assistant', assistantText)
      }

      const expectedBootstrapPrompt =
        !addUserBubble && data.error === 'InvalidFieldValue' && data.ui?.questionId === 'full_name'

      if ((!res.ok || data.success === false) && !expectedBootstrapPrompt) {
        setError(humanizeApiError(data.error, data.message || data.reply))
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('The quote service took too long to respond. Please try again.')
      } else if (err instanceof TypeError) {
        setError('Lumi could not reach the PicSway quote service. Please try again.')
      } else {
        setError(err instanceof Error ? err.message : 'Unable to reach Lumi.')
      }
    } finally {
      window.clearTimeout(timeout)
      requestInFlight.current = false
      setLoading(false)
    }
  }

  function chooseSingle(option: UiOption) {
    if (!ui) return
    void sendRequest(
      { selection: { questionId: ui.questionId, value: option.id } },
      true,
      option.label,
    )
  }

  function toggleMulti(option: UiOption) {
    setMultiSelected((current) => {
      if (current.includes(option.id)) {
        return current.filter((value) => value !== option.id)
      }
      if (ui?.maxSelections && current.length >= ui.maxSelections) {
        return current
      }
      return [...current, option.id]
    })
  }

  function submitMulti() {
    if (!ui) return
    const minimum = ui.minSelections || 1
    if (multiSelected.length < minimum) return

    const labels = optionGroups
      .filter((option) => multiSelected.includes(option.id))
      .map((option) => option.label)
      .join(', ')

    void sendRequest(
      { selection: { questionId: ui.questionId, values: multiSelected } },
      true,
      labels,
    )
  }

  function submitInput(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = input.trim()
    if (!value || !ui) return

    if (ui.type === 'otp' && !/^\d{6}$/.test(value)) {
      setError('Enter the 6-digit verification code from your email.')
      return
    }

    void sendRequest({ message: value }, true, value)
  }

  function skipBudget() {
    if (ui?.questionId !== 'budget_amount') return
    void sendRequest({ message: 'skip' }, true, 'Budget: not sure yet')
  }

  function triggerUiAction(action: UiOption) {
    if (!ui) return
    void sendRequest(
      { selection: { questionId: ui.questionId, value: action.id } },
      true,
      action.label,
    )
  }

  function resetSession() {
    if (requestInFlight.current) return

    storageRemove(SESSION_KEY)
    storageRemove(STATE_KEY)
    storageRemove(CHAT_KEY)
    setResponse(null)
    setChat(starterChat)
    setInput('')
    setError(null)
    setMultiSelected([])
    void sendRequest({ message: 'start' }, false)
  }

  const showInput = Boolean(
    ui && ['text', 'email', 'date', 'number', 'currency', 'otp'].includes(ui.type),
  )
  const statusSaved = ui?.questionId === 'quote_saved'
  const manualReview = ui?.questionId === 'manual_review'
  const multiMinimum = ui?.minSelections || 1

  return (
    <main className="page-shell">
      <section className="lumi-app" aria-label="PicSway Lumi quote assistant">
        <header className="topbar">
          <div className="brand-wrap">
            <div className="brand-mark" aria-hidden="true">L</div>
            <div>
              <div className="brand-eyebrow">PICSWAY</div>
              <div className="brand-line">
                <span className="brand-name">Lumi</span>
                <span className="online-pill"><span />Online</span>
              </div>
            </div>
          </div>

          <div className="top-actions">
            <div className="secure-pill"><ShieldCheck size={16} /> Secure quote</div>
            <button
              className="icon-button"
              onClick={resetSession}
              title="Start a new quote"
              aria-label="Start a new quote"
              disabled={loading}
            >
              <RefreshCcw size={18} />
            </button>
          </div>
        </header>

        <nav className="progress" aria-label="Quote progress">
          {stageNames.map((name, index) => {
            const number = index + 1
            const active = stage === number
            const complete = stage > number
            return (
              <div className={`progress-step ${active ? 'active' : ''} ${complete ? 'complete' : ''}`} key={name}>
                <span className="progress-number">{complete ? <Check size={13} /> : number}</span>
                <span>{name}</span>
              </div>
            )
          })}
        </nav>

        <div className="workspace">
          <section className="chat-column">
            <div className="chat-scroll" role="log" aria-live="polite" aria-relevant="additions text">
              {chat.map((item) => (
                <div key={item.id} className={`message-row ${item.role}`}>
                  {item.role === 'assistant' && (
                    <div className="assistant-avatar" aria-hidden="true">L</div>
                  )}
                  <div className={`bubble ${item.role}`}>{item.text}</div>
                </div>
              ))}

              {price && (response?.data?.quoteStatus === 'QUOTE_READY' || response?.data?.negotiationStatus) && (
                <div className="quote-card" aria-label={`Current quote ${price}`}>
                  <div>
                    <div className="quote-kicker">Current quote</div>
                    <div className="quote-price">{price}</div>
                  </div>
                  <div className="quote-note">Accept it, discuss price, or adjust the package below.</div>
                </div>
              )}

              {error && (
                <div className="error-card" role="alert">
                  <strong>That did not go through.</strong>
                  <span>{error}</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <div className="interaction-panel">
              {ui?.prompt && !statusSaved && !manualReview && (
                <div className="current-question">
                  <span className="question-label">Next</span>
                  <div>{ui.prompt}</div>
                </div>
              )}

              {(ui?.type === 'single_select' || ui?.type === 'actions') && (
                <div className={`options-grid ${isStateQuestion(ui) ? 'state-grid' : ''} ${ui.type === 'actions' ? 'action-grid' : ''}`}>
                  {optionGroups.map((option) => (
                    <button
                      type="button"
                      key={option.id}
                      className={`option-card ${isStateQuestion(ui) ? 'state-option' : ''}`}
                      onClick={() => chooseSingle(option)}
                      disabled={loading}
                    >
                      {isStateQuestion(ui) && <MapPin size={17} />}
                      <span>{option.label}</span>
                      <ArrowRight size={15} className="option-arrow" />
                    </button>
                  ))}
                </div>
              )}

              {ui?.type === 'multi_select' && (
                <>
                  <div className="options-grid multi-grid">
                    {optionGroups.map((option) => {
                      const selected = multiSelected.includes(option.id)
                      return (
                        <button
                          type="button"
                          key={option.id}
                          className={`option-card multi ${selected ? 'selected' : ''}`}
                          onClick={() => toggleMulti(option)}
                          disabled={loading}
                          aria-pressed={selected}
                        >
                          <span>{option.label}</span>
                          <span className="check-dot">{selected && <Check size={14} />}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="multi-footer">
                    <span>{multiSelected.length} selected</span>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={submitMulti}
                      disabled={loading || multiSelected.length < multiMinimum}
                    >
                      Continue <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              )}

              {showInput && (
                <form className="input-form" onSubmit={submitInput}>
                  <div className={`input-shell ${meta.prefix ? 'with-prefix' : ''}`}>
                    {meta.prefix && <span className="input-prefix">{meta.prefix}</span>}
                    <input
                      value={input}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setInput(event.target.value)}
                      type={meta.type}
                      inputMode={meta.inputMode}
                      placeholder={meta.placeholder}
                      maxLength={ui?.maxLength || (ui?.type === 'otp' ? ui.length || 6 : undefined)}
                      min={meta.type === 'number' ? ui?.min : undefined}
                      max={meta.type === 'number' ? ui?.max : undefined}
                      step={meta.type === 'number' ? ui?.step : undefined}
                      autoComplete={meta.autoComplete}
                      pattern={ui?.type === 'otp' ? '[0-9]{6}' : undefined}
                      aria-label={ui?.prompt || 'Lumi input'}
                      disabled={loading}
                    />
                    <button className="send-button" type="submit" disabled={loading || !input.trim()} aria-label="Send answer">
                      {loading ? <span className="spinner" /> : <Send size={18} />}
                    </button>
                  </div>

                  {ui?.questionId === 'budget_amount' && (
                    <button className="text-button" type="button" onClick={skipBudget} disabled={loading}>
                      I’m not sure yet — skip budget
                    </button>
                  )}

                  {ui?.questionId === 'counteroffer_amount' && (
                    <div className="helper-line"><CircleDollarSign size={15} /> Enter the exact amount you want PicSway to consider.</div>
                  )}

                  {ui?.questionId?.startsWith('event_exact_location_') && (
                    <div className="helper-line"><MapPin size={15} /> State is already selected. Enter the exact venue, city, or address.</div>
                  )}

                  {ui?.actions && ui.actions.length > 0 && (
                    <div className="secondary-actions">
                      {ui.actions.map((action) => (
                        <button
                          type="button"
                          className="secondary-button"
                          key={action.id}
                          onClick={() => triggerUiAction(action)}
                          disabled={loading}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </form>
              )}

              {statusSaved && (
                <div className="success-card">
                  <CheckCircle2 size={28} />
                  <div>
                    <div className="success-title">Your quote is saved</div>
                    <div className="success-copy">Your email is verified and the selected quote is stored securely.</div>
                    {ui?.quoteId && <div className="quote-reference">Quote ID <strong>{ui.quoteId}</strong></div>}
                    {ui?.expiresAt && <div className="success-expiry">Valid until {formatExpiry(ui.expiresAt)}</div>}
                  </div>
                </div>
              )}

              {manualReview && (
                <div className="review-card">
                  <LockKeyhole size={26} />
                  <div>
                    <div className="success-title">Custom PicSway review</div>
                    <div className="success-copy">This request is outside the automatic quote path, so Lumi will not invent a price.</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="app-footer">
          <span>PicSway · Lumi</span>
          <a href="https://mahdi.inksway.com" target="_blank" rel="noreferrer">
            Developed by Mahdi <ExternalLink size={13} />
          </a>
        </footer>
      </section>
    </main>
  )
}
