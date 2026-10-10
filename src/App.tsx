import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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
  Sparkles,
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

const API_URL =
  import.meta.env.VITE_LUMI_API_URL ||
  'https://i0cae18igk.execute-api.us-east-2.amazonaws.com/chat'

const SESSION_KEY = 'picsway_lumi_session_id_v12'
const STATE_KEY = 'picsway_lumi_state_v12'
const CHAT_KEY = 'picsway_lumi_chat_v12'

const starterChat: ChatItem[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: "Hi — I'm Lumi. I'll guide you through a clean, secure PicSway quote one step at a time.",
  },
]

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
    return { type: 'email', placeholder: 'you@example.com', prefix: '' }
  }
  if (qid.startsWith('event_date_')) {
    return { type: 'date', placeholder: '', prefix: '' }
  }
  if (qid === 'budget_amount') {
    return { type: 'number', placeholder: 'e.g. 3500', prefix: '$' }
  }
  if (qid === 'counteroffer_amount') {
    return { type: 'number', placeholder: 'Enter your counteroffer', prefix: '$' }
  }
  if (ui?.type === 'number' || ui?.type === 'currency') {
    return { type: 'number', placeholder: 'Enter amount', prefix: ui.type === 'currency' ? '$' : '' }
  }
  if (ui?.type === 'otp') {
    return { type: 'text', placeholder: '6-digit code', prefix: '' }
  }
  if (qid.startsWith('event_exact_location_')) {
    return { type: 'text', placeholder: 'Venue name, city, or address', prefix: '' }
  }
  if (qid === 'full_name') {
    return { type: 'text', placeholder: 'Your full name', prefix: '' }
  }
  return { type: 'text', placeholder: 'Type your answer', prefix: '' }
}

export default function App() {
  const [response, setResponse] = useState<LumiResponse | null>(null)
  const [chat, setChat] = useState<ChatItem[]>(starterChat)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [multiSelected, setMultiSelected] = useState<string[]>([])
  const initialized = useRef(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const ui = response?.ui || null
  const stage = currentStage(ui, response)
  const price = formatMoney(response?.data?.customerFacingPrice)
  const meta = inputMeta(ui)

  const stageNames = ['Details', 'Services', 'Quote', 'Verified']

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const savedState = sessionStorage.getItem(STATE_KEY)
    const savedChat = sessionStorage.getItem(CHAT_KEY)

    if (savedState) {
      try {
        setResponse(JSON.parse(savedState) as LumiResponse)
      } catch {
        sessionStorage.removeItem(STATE_KEY)
      }
    }

    if (savedChat) {
      try {
        setChat(JSON.parse(savedChat) as ChatItem[])
      } catch {
        sessionStorage.removeItem(CHAT_KEY)
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
  }, [ui?.questionId])

  const optionGroups = useMemo(() => ui?.options || [], [ui?.options])

  async function sendRequest(
    payload: { message?: string; selection?: { questionId: string; value?: string; values?: string[] } },
    addUserBubble = true,
    displayText?: string,
  ) {
    if (loading) return
    setLoading(true)
    setError(null)

    const sessionId = sessionStorage.getItem(SESSION_KEY)
    const body = {
      ...payload,
      ...(sessionId ? { sessionId } : {}),
    }

    if (addUserBubble && displayText) {
      setChat((items) => [...items, { id: makeId(), role: 'user', text: displayText }])
    }

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = (await res.json()) as LumiResponse
      if (data.sessionId) sessionStorage.setItem(SESSION_KEY, data.sessionId)
      setResponse(data)
      sessionStorage.setItem(STATE_KEY, JSON.stringify(data))

      const assistantText = data.reply || data.message || 'Please continue with the next step.'
      setChat((items) => {
        const next = [...items, { id: makeId(), role: 'assistant' as const, text: assistantText }]
        sessionStorage.setItem(CHAT_KEY, JSON.stringify(next))
        return next
      })

      const expectedBootstrapPrompt = !addUserBubble && data.error === 'InvalidFieldValue' && data.ui?.questionId === 'full_name'
      if ((!res.ok || data.success === false) && !expectedBootstrapPrompt) {
        setError(data.message || data.reply || 'That step could not be completed.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to reach Lumi.'
      setError(message)
    } finally {
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
    if (!ui || multiSelected.length === 0) return
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

  function submitInput(event: FormEvent) {
    event.preventDefault()
    const value = input.trim()
    if (!value || !ui) return
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
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(STATE_KEY)
    sessionStorage.removeItem(CHAT_KEY)
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

  return (
    <main className="page-shell">
      <section className="lumi-app" aria-label="PicSway Lumi quote assistant">
        <header className="topbar">
          <div className="brand-wrap">
            <div className="brand-mark" aria-hidden="true">
              <Sparkles size={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="brand-line">
                <span className="brand-name">Lumi</span>
                <span className="online-pill"><span />ONLINE</span>
              </div>
              <div className="brand-sub">PicSway Quote Assistant</div>
            </div>
          </div>

          <div className="top-actions">
            <div className="secure-pill"><ShieldCheck size={16} /> Secure quote flow</div>
            <button className="icon-button" onClick={resetSession} title="Start a new quote" aria-label="Start a new quote">
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
            <div className="chat-scroll">
              {chat.map((item) => (
                <div key={item.id} className={`message-row ${item.role}`}>
                  {item.role === 'assistant' && (
                    <div className="assistant-avatar" aria-hidden="true"><Sparkles size={17} /></div>
                  )}
                  <div className={`bubble ${item.role}`}>{item.text}</div>
                </div>
              ))}

              {price && (response?.data?.quoteStatus === 'QUOTE_READY' || response?.data?.negotiationStatus) && (
                <div className="quote-card">
                  <div className="quote-kicker">Current PicSway quote</div>
                  <div className="quote-price">{price}</div>
                  <div className="quote-note">This is your current package price. You can accept it, discuss price, or adjust the package.</div>
                </div>
              )}

              {error && (
                <div className="error-card">
                  <strong>Couldn’t complete that step.</strong>
                  <span>{error}</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <div className="interaction-panel">
              {ui?.prompt && !statusSaved && !manualReview && (
                <div className="current-question">
                  <div className="question-icon"><Sparkles size={16} /></div>
                  <div>{ui.prompt}</div>
                </div>
              )}

              {(ui?.type === 'single_select' || ui?.type === 'actions') && (
                <div className={`options-grid ${isStateQuestion(ui) ? 'state-grid' : ''}`}>
                  {optionGroups.map((option) => (
                    <button
                      key={option.id}
                      className={`option-card ${isStateQuestion(ui) ? 'state-option' : ''}`}
                      onClick={() => chooseSingle(option)}
                      disabled={loading}
                    >
                      {isStateQuestion(ui) && <MapPin size={18} />}
                      <span>{option.label}</span>
                      <ArrowRight size={16} className="option-arrow" />
                    </button>
                  ))}
                </div>
              )}

              {ui?.type === 'multi_select' && (
                <>
                  <div className="options-grid">
                    {optionGroups.map((option) => {
                      const selected = multiSelected.includes(option.id)
                      return (
                        <button
                          key={option.id}
                          className={`option-card multi ${selected ? 'selected' : ''}`}
                          onClick={() => toggleMulti(option)}
                          disabled={loading}
                        >
                          <span>{option.label}</span>
                          <span className="check-dot">{selected && <Check size={14} />}</span>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    className="primary-button"
                    onClick={submitMulti}
                    disabled={loading || multiSelected.length < (ui.minSelections || 1)}
                  >
                    Continue <ArrowRight size={17} />
                  </button>
                </>
              )}

              {showInput && (
                <form className="input-form" onSubmit={submitInput}>
                  <div className={`input-shell ${meta.prefix ? 'with-prefix' : ''}`}>
                    {meta.prefix && <span className="input-prefix">{meta.prefix}</span>}
                    <input
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      type={meta.type}
                      inputMode={ui?.type === 'currency' || ui?.type === 'number' ? 'decimal' : ui?.type === 'otp' ? 'numeric' : undefined}
                      placeholder={meta.placeholder}
                      maxLength={ui?.maxLength || (ui?.type === 'otp' ? ui.length || 6 : undefined)}
                      min={ui?.min}
                      max={ui?.max}
                      step={ui?.step}
                      autoComplete={ui?.type === 'email' ? 'email' : ui?.type === 'otp' ? 'one-time-code' : 'off'}
                      aria-label={ui?.prompt || 'Lumi input'}
                      disabled={loading}
                    />
                    <button className="send-button" type="submit" disabled={loading || !input.trim()} aria-label="Send">
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
                    <div className="helper-line"><MapPin size={15} /> State is already selected. Enter the exact venue, city, or address here.</div>
                  )}

                  {ui?.actions && ui.actions.length > 0 && (
                    <div className="secondary-actions">
                      {ui.actions.map((action) => (
                        <button type="button" className="secondary-button" key={action.id} onClick={() => triggerUiAction(action)} disabled={loading}>
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </form>
              )}

              {statusSaved && (
                <div className="success-card">
                  <CheckCircle2 size={30} />
                  <div>
                    <div className="success-title">Your quote is saved</div>
                    <div className="success-copy">Email verification passed and your quote is securely stored.</div>
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
                    <div className="success-copy">This request is outside the automatic quoting path, so Lumi will not invent a price.</div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="side-panel">
            <div className="side-badge"><Sparkles size={15} /> LUMI</div>
            <h1>Simple inputs.<br />A cleaner quote.</h1>
            <p>Quick choices keep the flow easy, while exact details stay in your hands when they matter.</p>

            <div className="side-points">
              <div><MapPin size={18} /><span><strong>Venue state first</strong><small>NJ, NY, MI, or custom</small></span></div>
              <div><CircleDollarSign size={18} /><span><strong>Your budget</strong><small>You enter the amount</small></span></div>
              <div><ShieldCheck size={18} /><span><strong>Secure save</strong><small>Email verification before final save</small></span></div>
            </div>
          </aside>
        </div>

        <footer className="app-footer">
          <span>PicSway • Lumi</span>
          <a href="https://mahdi.inksway.com" target="_blank" rel="noreferrer">
            Developed by Mahdi <ExternalLink size={13} />
          </a>
        </footer>
      </section>
    </main>
  )
}
