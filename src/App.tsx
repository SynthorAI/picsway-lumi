import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Aperture,
  ArrowUp,
  CakeSlice,
  Camera,
  Check,
  ChevronRight,
  CircleDollarSign,
  Heart,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';

type Message = {
  from: 'lumi' | 'user';
  text: string;
};

type UiOption = {
  id: string;
  label: string;
};

type UiState = {
  type:
    | 'single_select'
    | 'multi_select'
    | 'actions'
    | 'text'
    | 'email'
    | 'date'
    | 'number'
    | 'currency'
    | 'otp'
    | 'status';
  questionId: string;
  prompt?: string;
  options?: UiOption[];
  actions?: UiOption[];
  allowFreeText?: boolean;
  minSelections?: number;
  maxSelections?: number;
  selectedValues?: string[];
  min?: number;
  max?: number;
  step?: number;
  length?: number;
  maxLength?: number;
};

type ApiData = {
  missingFields?: string[];
  quoteStatus?: string;
  customerFacingPrice?: string;
  negotiationStatus?: string;
  selectedQuoteStatus?: string;
  emailVerified?: boolean;
};

type ApiResponse = {
  success: boolean;
  sessionId?: string;
  status?: string;
  reply?: string;
  message?: string;
  error?: string;
  data?: ApiData;
  ui?: UiState | null;
  returningCustomer?: { status?: string };
};

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://i0cae18igk.execute-api.us-east-2.amazonaws.com/chat';

const SESSION_KEY = 'picsway-lumi-session';
const newSession = () => crypto.randomUUID();
const getSession = () => {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = newSession();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
};

function unwrapApi(raw: unknown): ApiResponse {
  const outer = raw as Record<string, unknown>;
  let body: unknown = outer?.body ?? raw;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return {
        success: false,
        error: 'InvalidApiResponse',
        message: 'Lumi returned an unreadable response.',
      };
    }
  }
  return (body ?? {}) as ApiResponse;
}

function money(value?: string) {
  if (!value) return '';
  const number = Number(value);
  return Number.isFinite(number)
    ? `$${number.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    : '';
}

function maskEmail(value: string) {
  const [local, domain] = value.split('@');
  if (!domain) return value;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(2, Math.min(5, local.length - visible.length)))}@${domain}`;
}

function iconForOption(id: string) {
  const size = 18;
  if (id.includes('BIRTHDAY')) return <CakeSlice size={size} />;
  if (id.includes('MARRIAGE') || id.includes('NIKAH') || id.includes('WEDDING')) {
    return <Heart size={size} />;
  }
  if (id.includes('PHOTO')) return <Camera size={size} />;
  if (id.includes('VIDEO') || id.includes('CINEMATIC')) return <Video size={size} />;
  if (id.includes('GUEST')) return <Users size={size} />;
  if (id.includes('BUDGET') || id.includes('PRICE') || id.includes('COUNTER')) {
    return <CircleDollarSign size={size} />;
  }
  if (id.includes('VERIFY') || id.includes('SAVE')) return <ShieldCheck size={size} />;
  return <ChevronRight size={size} />;
}

function userDisplayForInput(ui: UiState | null | undefined, value: string) {
  if (ui?.type === 'email') return maskEmail(value);
  if (ui?.type === 'otp') return 'Verification code submitted';
  if (ui?.type === 'currency') {
    const cleaned = value.replace(/[$,\s]/g, '');
    const number = Number(cleaned);
    return Number.isFinite(number) ? `$${number.toLocaleString('en-US')}` : value;
  }
  return value;
}

function stageIndex(status?: string, ui?: UiState | null) {
  if (status === 'SELECTED' || ui?.questionId === 'quote_saved') return 4;
  if (status === 'PENDING_EMAIL_VERIFICATION' || ui?.type === 'otp') return 3;
  if (
    ['QUOTE_READY', 'NEGOTIATING', 'QUOTE_ACCEPTED'].includes(status || '') ||
    ['quote_action', 'negotiation_action', 'save_quote_action'].includes(ui?.questionId || '')
  ) {
    return 3;
  }
  if (
    ui?.questionId === 'services' ||
    ui?.questionId === 'second_shooter' ||
    ui?.questionId?.startsWith('coverage_hours_') ||
    ui?.questionId?.startsWith('event_') ||
    ui?.questionId === 'guest_count' ||
    ui?.questionId === 'budget_range' ||
    ui?.questionId === 'referral_source'
  ) {
    return 2;
  }
  return 1;
}

export default function App() {
  const [sessionId, setSessionId] = useState(getSession);
  const [messages, setMessages] = useState<Message[]>([
    {
      from: 'lumi',
      text: "Hi — I'm Lumi, PicSway's quote assistant. I'll guide you through a secure quote one step at a time.",
    },
  ]);
  const [last, setLast] = useState<ApiResponse | null>(null);
  const [started, setStarted] = useState(false);
  const [input, setInput] = useState('');
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastPrice, setLastPrice] = useState<string>();
  const endRef = useRef<HTMLDivElement>(null);

  const ui = last?.ui ?? null;
  const stage = stageIndex(last?.status, ui);
  const optionLocked = Boolean(
    ui && ['single_select', 'multi_select', 'actions', 'status', 'otp'].includes(ui.type),
  );
  const isOtp = ui?.type === 'otp';
  const isMulti = ui?.type === 'multi_select';
  const canText = Boolean(
    ui && ['text', 'email', 'date', 'number', 'currency'].includes(ui.type),
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, last, loading]);

  useEffect(() => {
    setMultiSelected(ui?.selectedValues ?? []);
    setOtp(['', '', '', '', '', '']);
    setInput('');
  }, [ui?.questionId]);

  useEffect(() => {
    const price = last?.data?.customerFacingPrice;
    if (price) setLastPrice(price);
  }, [last?.data?.customerFacingPrice]);

  const quoteVisible = useMemo(
    () =>
      Boolean(lastPrice) &&
      ['QUOTE_READY', 'NEGOTIATING', 'QUOTE_ACCEPTED', 'PENDING_EMAIL_VERIFICATION', 'SELECTED'].includes(
        last?.status || '',
      ),
    [last?.status, lastPrice],
  );

  async function request(
    payload: Record<string, unknown>,
    userDisplay?: string,
    options: { silentUser?: boolean } = {},
  ) {
    if (loading) return;
    setError('');
    if (userDisplay && !options.silentUser) {
      setMessages((current) => [...current, { from: 'user', text: userDisplay }]);
    }
    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, ...payload }),
      });
      const raw = await response.json();
      const body = unwrapApi(raw);

      if (body.sessionId && body.sessionId !== sessionId) {
        setSessionId(body.sessionId);
        sessionStorage.setItem(SESSION_KEY, body.sessionId);
      }

      setLast(body);
      const reply = body.reply || body.message;
      if (reply) {
        setMessages((current) => [...current, { from: 'lumi', text: reply }]);
      }

      // Validation responses intentionally return the current server-owned UI.
      // Keep the user in that state instead of replacing it with a generic error.
      if (!response.ok && !body.ui) {
        throw new Error(body.message || 'Request failed');
      }
      if (body.success === false && !body.ui && !reply) {
        throw new Error(body.message || 'Request failed');
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(message || "Lumi couldn't complete that request right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function startQuote() {
    setStarted(true);
    await request({ message: 'START MY QUOTE' }, undefined, { silentUser: true });
  }

  async function sendSelection(option: UiOption) {
    if (!ui || loading) return;
    await request(
      {
        selection: {
          questionId: ui.questionId,
          value: option.id,
        },
      },
      option.label,
    );
  }

  async function sendMultiSelection() {
    if (!ui || loading) return;
    const labels = (ui.options ?? [])
      .filter((option) => multiSelected.includes(option.id))
      .map((option) => option.label);
    await request(
      {
        selection: {
          questionId: ui.questionId,
          values: multiSelected,
        },
      },
      labels.join(' + '),
    );
  }

  function toggleMulti(id: string) {
    if (!ui) return;
    setMultiSelected((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      const max = ui.maxSelections ?? (ui.options?.length || 1);
      if (current.length >= max) return current;
      return [...current, id];
    });
  }

  async function submitText(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value || loading || !canText || !ui) return;
    await request({ message: value }, userDisplayForInput(ui, value));
  }

  async function verifyOtp() {
    if (!ui || loading) return;
    const code = otp.join('');
    if (!/^\d{6}$/.test(code)) return;
    await request({ message: code }, 'Verification code submitted');
  }

  async function otpAction(option: UiOption) {
    if (!ui || loading) return;
    await request(
      {
        selection: {
          questionId: ui.questionId,
          value: option.id,
        },
      },
      option.label,
    );
  }

  function reset() {
    const id = newSession();
    sessionStorage.setItem(SESSION_KEY, id);
    setSessionId(id);
    setStarted(false);
    setLast(null);
    setInput('');
    setMultiSelected([]);
    setOtp(['', '', '', '', '', '']);
    setLastPrice(undefined);
    setError('');
    setMessages([
      {
        from: 'lumi',
        text: "Hi — I'm Lumi, PicSway's quote assistant. I'll guide you through a secure quote one step at a time.",
      },
    ]);
  }

  const inputType = ui?.type === 'email' ? 'email' : ui?.type === 'date' ? 'date' : ui?.type === 'number' ? 'number' : 'text';
  const placeholder =
    ui?.type === 'currency'
      ? 'Enter an amount…'
      : ui?.type === 'email'
        ? 'name@example.com'
        : ui?.type === 'date'
          ? 'Choose a date'
          : ui?.prompt || 'Message Lumi…';

  const minimum = ui?.minSelections ?? 1;
  const maximum = ui?.maxSelections ?? ui?.options?.length ?? 1;
  const multiReady = multiSelected.length >= minimum && multiSelected.length <= maximum;

  return (
    <main className="lumiPage">
      <section className="lumiShell" aria-label="PicSway Lumi quote assistant">
        <header className="lumiHeader">
          <div className="brandmark"><Aperture size={22} /></div>
          <div className="brandCopy">
            <div className="titleRow">
              <h1>Lumi</h1>
              <span className="online"><i />Online</span>
            </div>
            <p>PicSway Quote Assistant</p>
          </div>
          <div className="secureBadge"><ShieldCheck size={14} /> Secure quote flow</div>
          <button className="reset" onClick={reset} title="Start a new quote" aria-label="Start a new quote">
            <RotateCcw size={17} />
          </button>
        </header>

        <div className="progress" aria-label="Quote progress">
          {['Event', 'Package', 'Quote', 'Verified'].map((label, index) => (
            <div className="progressPart" key={label}>
              <span className={stage >= index + 1 ? 'on' : ''}>{label}</span>
              {index < 3 && <b className={stage > index + 1 ? 'on' : ''} />}
            </div>
          ))}
        </div>

        <div className="chat">
          <div className="ambientLight lightOne" />
          <div className="ambientLight lightTwo" />

          {messages.map((message, index) => (
            <div key={`${message.from}-${index}`} className={`row ${message.from}`}>
              {message.from === 'lumi' && <div className="mini"><Sparkles size={14} /></div>}
              <div className="bubble">{message.text}</div>
            </div>
          ))}

          {!started && (
            <div className="startCard">
              <div className="startIcon"><Camera size={22} /></div>
              <div>
                <strong>Build your PicSway quote</strong>
                <p>Guided options keep your package accurate while Lumi handles the conversation.</p>
              </div>
              <button disabled={loading} onClick={startQuote}>Start my quote <ChevronRight size={17} /></button>
            </div>
          )}

          {loading && (
            <div className="row lumi">
              <div className="mini"><Sparkles size={14} /></div>
              <div className="bubble typing">Lumi is working<span>…</span></div>
            </div>
          )}

          {error && (
            <div className="errorBox">
              <span>{error}</span>
              <button onClick={() => setError('')}>Dismiss</button>
            </div>
          )}

          {quoteVisible && (
            <div className="quoteCard">
              <div className="eyebrow">
                {last?.status === 'NEGOTIATING' ? 'CURRENT AUTHORIZED OFFER' : 'YOUR PICSWAY QUOTE'}
              </div>
              <div className="price">{money(lastPrice)}</div>
              <div className="rule" />
              <div className="securityLine"><ShieldCheck size={15} /> Pricing is validated by PicSway before it is shown.</div>
              {last?.status === 'QUOTE_ACCEPTED' && (
                <div className="accepted"><Check size={16} /> Accepted — verify your email to save it securely.</div>
              )}
            </div>
          )}

          {ui && !isOtp && ['single_select', 'actions'].includes(ui.type) && (
            <div className={`choicePanel ${ui.type === 'actions' ? 'actionPanel' : ''}`}>
              <div className="panelEyebrow">{ui.type === 'actions' ? 'CHOOSE YOUR NEXT STEP' : 'SELECT ONE'}</div>
              <div className="choiceGrid">
                {(ui.options ?? []).map((option) => (
                  <button
                    key={option.id}
                    disabled={loading}
                    className={option.id === 'SAVE_QUOTE' ? 'choice saveChoice' : 'choice'}
                    onClick={() => sendSelection(option)}
                  >
                    <span className="choiceIcon">{iconForOption(option.id)}</span>
                    <span>{option.label}</span>
                    <ChevronRight className="choiceArrow" size={16} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {ui && isMulti && (
            <div className="choicePanel">
              <div className="panelHeading">
                <div>
                  <div className="panelEyebrow">SELECT OPTIONS</div>
                  <p>Choose {minimum === maximum ? minimum : `${minimum}–${maximum}`}.</p>
                </div>
                <span className="selectionCount">{multiSelected.length}/{maximum}</span>
              </div>
              <div className="choiceGrid multiGrid">
                {(ui.options ?? []).map((option) => {
                  const selected = multiSelected.includes(option.id);
                  return (
                    <button
                      type="button"
                      key={option.id}
                      disabled={loading}
                      aria-pressed={selected}
                      className={`choice multiChoice ${selected ? 'selected' : ''}`}
                      onClick={() => toggleMulti(option.id)}
                    >
                      <span className="choiceIcon">{iconForOption(option.id)}</span>
                      <span>{option.label}</span>
                      <span className="checkCircle">{selected && <Check size={14} />}</span>
                    </button>
                  );
                })}
              </div>
              <button className="continueButton" disabled={!multiReady || loading} onClick={sendMultiSelection}>
                Continue <ChevronRight size={17} />
              </button>
            </div>
          )}

          {isOtp && ui && (
            <div className="otpCard">
              <div className="lock"><LockKeyhole size={20} /></div>
              <div className="eyebrow">EMAIL VERIFICATION</div>
              <h3>Enter your 6-digit code</h3>
              <p>{ui.prompt}</p>
              <div className="otpInputs">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={digit}
                    aria-label={`Verification digit ${index + 1}`}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, '').slice(-1);
                      const next = [...otp];
                      next[index] = value;
                      setOtp(next);
                      if (value) (event.target.nextElementSibling as HTMLInputElement | null)?.focus();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Backspace' && !otp[index]) {
                        (event.currentTarget.previousElementSibling as HTMLInputElement | null)?.focus();
                      }
                    }}
                  />
                ))}
              </div>
              <button className="primary" disabled={loading || otp.join('').length !== 6} onClick={verifyOtp}>
                Verify email <ChevronRight size={17} />
              </button>
              {(ui.actions ?? []).map((action) => (
                <button className="linkButton" key={action.id} disabled={loading} onClick={() => otpAction(action)}>
                  {action.label}
                </button>
              ))}
              <div className="privacyNote"><LockKeyhole size={13} /> Your quote is not permanently saved until verification succeeds.</div>
            </div>
          )}

          {ui?.type === 'status' && ui.questionId === 'quote_saved' && (
            <div className="savedCard">
              <div className="savedIcon"><Check size={21} /></div>
              <div className="eyebrow">VERIFIED & SAVED</div>
              {lastPrice && <div className="price">{money(lastPrice)}</div>}
              <p>Your PicSway quote has been securely saved after email verification.</p>
              <p className="notice">The event is not booked until PicSway completes its normal contract and deposit process.</p>
            </div>
          )}

          {ui?.type === 'status' && ui.questionId === 'manual_review' && (
            <div className="reviewCard">
              <Sparkles size={20} />
              <div>
                <strong>Custom PicSway review</strong>
                <p>{ui.prompt}</p>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        <div className={`composerWrap ${optionLocked && !isOtp ? 'locked' : ''}`}>
          {canText && ui ? (
            <form className="composer" onSubmit={submitText}>
              {ui.type === 'currency' && <span className="inputPrefix">$</span>}
              <input
                type={inputType}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={placeholder}
                aria-label={ui.prompt || 'Lumi input'}
                disabled={loading}
                min={ui.min}
                max={ui.max}
                step={ui.step}
                maxLength={ui.maxLength}
                autoComplete={ui.type === 'email' ? 'email' : ui.questionId === 'full_name' ? 'name' : 'off'}
              />
              <button aria-label="Send" disabled={loading || !input.trim()}><ArrowUp size={20} /></button>
            </form>
          ) : started && ui && !isOtp ? (
            <div className="lockedComposer"><LockKeyhole size={14} /> Choose one of the secure options above to continue.</div>
          ) : started && isOtp ? (
            <div className="lockedComposer"><LockKeyhole size={14} /> Enter the verification code above.</div>
          ) : (
            <div className="lockedComposer muted">Start your quote to begin.</div>
          )}
        </div>

        <footer>
          <span>Powered by PicSway</span>
          <span className="footerDot">•</span>
          <span>Protected option-based quoting</span>
        </footer>
      </section>
    </main>
  );
}
