import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUp,Aperture,Check,ChevronRight,LockKeyhole,RotateCcw,Sparkles} from 'lucide-react';

type Msg={from:'lumi'|'user';text:string};
type ApiData={missingFields?:string[];quoteStatus?:string;customerFacingPrice?:string;negotiationStatus?:string;selectedQuoteStatus?:string};
type ApiResponse={success:boolean;sessionId:string;status:string;reply:string;data?:ApiData;returningCustomer?:{status?:string}};
const API_URL='https://i0cae18igk.execute-api.us-east-2.amazonaws.com/chat';
const newSession=()=>crypto.randomUUID();
const getSession=()=>{let id=sessionStorage.getItem('picsway-lumi-session');if(!id){id=newSession();sessionStorage.setItem('picsway-lumi-session',id)}return id};
const money=(v?:string)=>v?`$${Number(v).toLocaleString('en-US')}`:'';

function suggestions(r:ApiResponse|null){
 if(!r)return ['START MY QUOTE'];
 if(r.status==='RETURNING_CUSTOMER_FOUND')return ['VERIFY & CONTINUE','START NEW INQUIRY'];
 if(r.returningCustomer?.status==='VERIFIED'&&r.status!=='SELECTED')return ['CONTINUE PREVIOUS','DISMISS & START NEW'];
 if(r.status==='QUOTE_ACCEPTED')return ['SAVE THIS QUOTE'];
 if(r.status==='QUOTE_READY')return ['Discuss Price','Change Coverage','Accept Offer'];
 if(r.status==='NEGOTIATING')return ['Accept Offer','Discuss Further','Change Coverage'];
 if(r.status==='SELECTED'||r.status==='PENDING_EMAIL_VERIFICATION'||r.status==='REVIEW_REQUIRED')return [];
 const m=(r.data?.missingFields||[]).map(x=>x.toLowerCase());
 if(m.some(x=>x.includes('event')&&x.includes('type')))return ['Wedding Day','Engagement','Nikah','Mehendi','Gaye Holud','Reception / Walima','Other Event'];
 if(m.some(x=>x.includes('service')))return ['Photography','Videography','Photography + Videography','Cinematic'];
 if(m.some(x=>x.includes('hour')||x.includes('coverage')))return ['4 Hours','6 Hours','8 Hours','10 Hours','Full Day'];
 if(m.some(x=>x.includes('second')))return ['Yes','No','Not Sure'];
 return [];
}

export default function App(){
 const [sessionId,setSessionId]=useState(getSession);const [messages,setMessages]=useState<Msg[]>([{from:'lumi',text:"Hi! I'm Lumi, PicSway's quote assistant. I'll help you build a photography package for your event. It only takes a few minutes."}]);
 const [last,setLast]=useState<ApiResponse|null>(null);const [input,setInput]=useState('');const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [otp,setOtp]=useState(['','','','','','']);const end=useRef<HTMLDivElement>(null);
 useEffect(()=>end.current?.scrollIntoView({behavior:'smooth'}),[messages,last,loading]);
 const chips=useMemo(()=>suggestions(last),[last]);
 const price=last?.data?.customerFacingPrice;
 const isOtp=last?.status==='PENDING_EMAIL_VERIFICATION'||last?.returningCustomer?.status==='OTP_PENDING';
 async function send(text:string){const value=text.trim();if(!value||loading)return;setError('');setMessages(m=>[...m,{from:'user',text:value}]);setInput('');setLoading(true);try{const res=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId,message:value})});const raw=await res.json();const body:ApiResponse=typeof raw.body==='string'?JSON.parse(raw.body):raw.body??raw;if(!res.ok||body.success===false)throw new Error('Request failed');setLast(body);if(body.reply)setMessages(m=>[...m,{from:'lumi',text:body.reply}]);}catch{setError("Lumi couldn't complete that request right now. Please try again.");}finally{setLoading(false)}}
 function submit(e:FormEvent){e.preventDefault();send(input)}
 function verify(){const code=otp.join('');if(code.length===6)send(code)}
 function reset(){const id=newSession();sessionStorage.setItem('picsway-lumi-session',id);setSessionId(id);setMessages([{from:'lumi',text:"Hi! I'm Lumi, PicSway's quote assistant. I'll help you build a photography package for your event. It only takes a few minutes."}]);setLast(null);setInput('');setOtp(['','','','','','']);setError('')}
 const stage=last?.status||'COLLECTING';
 return <main className="page"><section className="shell" aria-label="PicSway Lumi quote assistant">
 <header className="header"><div className="brandmark"><Aperture size={22}/></div><div><div className="titleRow"><h1>Lumi</h1><span className="online"><i/>Online</span></div><p>PicSway Quote Assistant</p></div><button className="reset" onClick={reset} title="Start over"><RotateCcw size={17}/></button></header>
 <div className="progress"><span className="on">Event</span><b/><span className={stage!=='COLLECTING'?'on':''}>Services</span><b/><span className={['QUOTE_READY','NEGOTIATING','QUOTE_ACCEPTED','PENDING_EMAIL_VERIFICATION','SELECTED'].includes(stage)?'on':''}>Quote</span><b/><span className={stage==='SELECTED'?'on':''}>Saved</span></div>
 <div className="chat"><div className="light l1"/><div className="light l2"/>
 {messages.map((m,i)=><div key={i} className={'row '+m.from}>{m.from==='lumi'&&<div className="mini"><Sparkles size={14}/></div>}<div className="bubble">{m.text}</div></div>)}
 {loading&&<div className="row lumi"><div className="mini"><Sparkles size={14}/></div><div className="bubble typing">Lumi is thinking<span>…</span></div></div>}
 {error&&<div className="errorBox">{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
 {price&&['QUOTE_READY','NEGOTIATING','QUOTE_ACCEPTED'].includes(stage)&&<div className="quoteCard"><div className="eyebrow">{stage==='NEGOTIATING'?'CURRENT OFFER':'YOUR PICSWAY QUOTE'}</div><div className="price">{money(price)}</div><div className="rule"/><p className="quoteHint">Your package details are being kept in your secure Lumi session.</p>{stage==='QUOTE_ACCEPTED'&&<div className="accepted"><Check size={16}/> Quote accepted — save to secure it</div>}</div>}
 {isOtp&&<div className="otpCard"><div className="lock"><LockKeyhole size={20}/></div><h3>Verify your email</h3><p>Enter the 6-digit code PicSway sent to your email.</p><div className="otpInputs">{otp.map((d,i)=><input key={i} inputMode="numeric" maxLength={1} value={d} aria-label={`Digit ${i+1}`} onChange={e=>{const v=e.target.value.replace(/\D/g,'');const n=[...otp];n[i]=v;setOtp(n);if(v)(e.target.nextElementSibling as HTMLInputElement|null)?.focus()}}/>)}</div><button className="primary" disabled={loading||otp.join('').length!==6} onClick={verify}>Verify <ChevronRight size={17}/></button></div>}
 {stage==='SELECTED'&&<div className="savedCard"><div className="savedIcon"><Check/></div><div className="eyebrow">QUOTE SAVED</div>{price&&<div className="price">{money(price)}</div>}<p>Your PicSway quote has been securely saved.</p><p className="notice">Your event is not booked until PicSway's normal contract and deposit process is completed.</p></div>}
 {chips.length>0&&!isOtp&&<div className="chips">{chips.map(c=><button disabled={loading} key={c} className={c==='SAVE THIS QUOTE'?'saveChip':''} onClick={()=>send(c)}>{c}</button>)}</div>}
 <div ref={end}/></div>
 <form className="composer" onSubmit={submit}><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Message Lumi..." aria-label="Message Lumi" disabled={loading}/><button aria-label="Send message" disabled={loading||!input.trim()}><ArrowUp size={20}/></button></form>
 <footer>Powered by PicSway · Your information is used only to prepare your inquiry.</footer></section></main>
}
