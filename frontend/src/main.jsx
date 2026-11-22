import React, {useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {motion,AnimatePresence} from "framer-motion";
import {LayoutDashboard,Link2,PenSquare,Sparkles,CalendarDays,Calendar,History,Settings,Sun,Moon,LogOut,Bell,Plus,TrendingUp,Users,Clock3,AlertTriangle,CheckCircle2,Upload,Send,ChevronRight,X,Menu,Eye,EyeOff,Mail,LockKeyhole,ArrowRight,ShieldCheck,Check} from "lucide-react";
import "./styles.css";

const API="";
const LOGO_SRC="/socialflow-logo.png";
const api=(path,options={})=>fetch(API+path,{...options,headers:{"Content-Type":"application/json",...(localStorage.token?{Authorization:`Bearer ${localStorage.token}`}:{ }),...options.headers}}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Request failed");return d});

function LoadingIndicator({label="Loading...",compact=false}){return <div className={`loading-indicator ${compact?"compact":""}`} role="status" aria-live="polite"><span className="loading-emblem" aria-hidden="true"><img src={LOGO_SRC} alt=""/></span><span className="loading-label">{label}<span className="loading-dots"><i/><i/><i/></span></span></div>}
function LoadingSpinner({className=""}){return <span className={`loading-spinner ${className}`} aria-hidden="true"/>}
function Splash({done,ready}){const[minimumElapsed,setMinimumElapsed]=useState(false);useEffect(()=>{const timer=setTimeout(()=>setMinimumElapsed(true),1800);return()=>clearTimeout(timer)},[]);useEffect(()=>{if(minimumElapsed&&ready)done()},[minimumElapsed,ready,done]);return <motion.div className="splash" exit={{opacity:0,scale:1.04}}><div className="splash-art" aria-hidden="true"><i/><i/><i/></div><motion.div className="splash-content" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}><motion.img className="splash-logo" src={LOGO_SRC} alt="SocialFlow" initial={{scale:.94}} animate={{scale:1}} transition={{type:"spring",stiffness:180,damping:18}}/><div className="splash-loader"><LoadingSpinner className="splash-spinner"/><span>Preparing your workspace</span></div></motion.div></motion.div>}

function Auth({onAuth}){
  const [mode,setMode]=useState("login");
  const [name,setName]=useState("");
  const [email,setEmail]=useState(localStorage.getItem("socialflow:email")||"");
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [remember,setRemember]=useState(true);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [loading,setLoading]=useState(false);
  const [resetMode,setResetMode]=useState(false);
  const strength=[password.length>=8,/[A-Z]/.test(password),/\d/.test(password)].filter(Boolean).length;
  async function submit(e){
    e.preventDefault();setLoading(true);setError("");setNotice("");
    try {
      if(resetMode){
        const result=await api("/api/auth/forgot",{method:"POST",body:JSON.stringify({email})});
        setNotice(result.message);return;
      }
      const body=mode==="signup"
        ?await api("/api/auth/signup",{method:"POST",body:JSON.stringify({name,email,password,confirmPassword:confirm})})
        :await api("/api/auth/login",{method:"POST",body:JSON.stringify({email,password})});
      localStorage.token=body.accessToken;
      if(remember)localStorage.setItem("socialflow:email",email);else localStorage.removeItem("socialflow:email");
      onAuth(body.user);
    }catch(e){setError(e.message)}
    finally{setLoading(false)}
  }
  function changeMode(next){setMode(next);setResetMode(false);setError("");setNotice("")}
  return <div className="auth-shell">
    <aside className="auth-art">
      <div className="auth-art-top"><div className="brand"><div className="brand-mark"><img className="app-logo-icon" src={LOGO_SRC} alt=""/></div><span>SocialFlow</span></div><span className="auth-edition">SOCIAL WORKSPACE</span></div>
      <div className="auth-art-content">
        <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}}>
          <span className="auth-kicker"><span/> YOUR SOCIAL, IN SYNC</span>
          <h1>Make every<br/>post <em>count.</em></h1>
          <p>One calm workspace to plan, create and publish your best work across every channel.</p>
        </motion.div>
        <div className="auth-product-preview">
          <div className="preview-topline"><span><i/> WORKSPACE OVERVIEW</span><span>THIS WEEK</span></div>
          <div className="preview-content"><div className="preview-message"><small>LESS BUSYWORK</small><b>More room<br/>for good ideas.</b></div><div className="preview-feature-list"><span>Plan with clarity</span><span>Create in one place</span><span>Keep every channel in sync</span></div></div>
          <div className="preview-networks"><span className="network-dot instagram">◎</span><span className="network-dot facebook">f</span><span className="network-dot linkedin">in</span><span className="network-caption">Connect your own channels</span></div>
        </div>
      </div>
      <div className="auth-art-footer"><ShieldCheck/><span>Your accounts stay yours. Connect securely, publish confidently.</span></div>
    </aside>
    <main className="auth-side">
      <motion.section className="auth-panel" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}>
        <div className="auth-mobile-brand"><div className="brand-mark"><img className="app-logo-icon" src={LOGO_SRC} alt=""/></div><b>SocialFlow</b></div>
        {!resetMode&&<div className="auth-tabs"><button type="button" className={mode==="login"?"active":""} onClick={()=>changeMode("login")}>Sign in</button><button type="button" className={mode==="signup"?"active":""} onClick={()=>changeMode("signup")}>Create account</button></div>}
        <div className="auth-heading"><span className="eyebrow">{resetMode?"ACCOUNT RECOVERY":mode==="login"?"WELCOME BACK":"GET STARTED"}</span><h2>{resetMode?"Reset your password":mode==="login"?"Sign in to SocialFlow":"Create your workspace"}</h2><p>{resetMode?"Enter your email and we’ll send password reset instructions.":mode==="login"?"Plan and publish your content from one place.":"Your next great week of content starts here."}</p></div>
        <form onSubmit={submit} className="auth-form">
          {mode==="signup"&&!resetMode&&<label>Full name<div className="input-wrap"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name" required/></div></label>}
          <label>Email address<div className="input-wrap"><Mail/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" autoComplete="email" required/></div></label>
          {!resetMode&&<label>Password<div className="input-wrap"><LockKeyhole/><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==="signup"?"At least 8 characters":"Enter your password"} autoComplete={mode==="signup"?"new-password":"current-password"} minLength={8} required/><button type="button" className="password-toggle" aria-label={showPassword?"Hide password":"Show password"} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff/>:<Eye/>}</button></div></label>}
          {mode==="signup"&&!resetMode&&<><div className="password-strength"><span>Password strength</span><div>{[0,1,2].map(i=><i className={strength>i?"filled":""} key={i}/>)}</div><small>{strength===3?"Strong":strength===2?"Almost there":"Use 8+ characters, a capital and a number"}</small></div><label>Confirm password<div className="input-wrap"><LockKeyhole/><input type={showPassword?"text":"password"} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Re-enter your password" autoComplete="new-password" minLength={8} required/></div></label></>}
          {mode==="login"&&!resetMode&&<div className="auth-options"><label className="remember-option"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span>Remember email</span></label><button type="button" className="inline-link" onClick={()=>{setResetMode(true);setError("");setNotice("")}}>Forgot password?</button></div>}
          {error&&<div className="form-error" role="alert">{error}</div>}
          {notice&&<div className="auth-notice" role="status"><Check/>{notice}</div>}
          <button className="primary auth-submit" disabled={loading}>{loading&&<LoadingSpinner/>}{loading?(resetMode?"Sending…":mode==="signup"?"Creating workspace…":"Signing in…"):(resetMode?"Send reset instructions":mode==="login"?"Sign in":"Create account")}{!loading&&<ArrowRight/>}</button>
        </form>
        {resetMode?<button type="button" className="auth-back" onClick={()=>{setResetMode(false);setError("");setNotice("")}}><ChevronRight/>Back to sign in</button>:<div className="auth-footnote">{mode==="login"?"New to SocialFlow?":"Already have an account?"} <button type="button" className="inline-link" onClick={()=>changeMode(mode==="login"?"signup":"login")}>{mode==="login"?"Create an account":"Sign in"}</button></div>}
        <div className="auth-legal">By continuing, you agree to our <button type="button">Terms</button> and <button type="button">Privacy Policy</button>.</div>
      </motion.section>
    </main>
  </div>
}

const nav=[["Overview",LayoutDashboard],["Accounts",Link2],["Create Post",PenSquare],["AI Studio",Sparkles],["7-Day Planner",CalendarDays],["Calendar",Calendar],["Post History",History],["Settings",Settings]];
function Sidebar({page,setPage,collapsed,setCollapsed,user,onLogout}){return <aside className={`sidebar ${collapsed?"collapsed":""}`}><button className="collapse" onClick={()=>setCollapsed(!collapsed)}><Menu/></button><div className="brand side-brand"><div className="brand-mark"><img className="app-logo-icon" src={LOGO_SRC} alt=""/></div><b>SocialFlow</b></div><nav>{nav.map(([n,I])=><button key={n} className={page===n?"active":""} onClick={()=>setPage(n)}><I/><span>{n}</span>{page===n&&<motion.i layoutId="nav"/>}</button>)}</nav><div className="side-user"><div className="avatar">{user?.name?.[0]||"A"}</div><div><b>{user?.name||"Account"}</b><small>Workspace</small></div><button onClick={onLogout} title="Logout"><LogOut/></button></div></aside>}

function Card({children,className=""}){return <motion.section className={`glass card ${className}`} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}>{children}</motion.section>}
function Overview({onCreate}){const[a,setA]=useState(null);const[error,setError]=useState("");const[loading,setLoading]=useState(false);async function load(){setLoading(true);setError("");try{setA(await api("/api/analytics"))}catch(e){setError(e.message)}finally{setLoading(false)}}useEffect(()=>{load();const timer=setInterval(()=>{if(document.visibilityState==="visible")load()},15000);return()=>clearInterval(timer)},[]);if(error)return <div className="page"><div className="page-error"><AlertTriangle/><div><b>We couldn’t load your overview</b><span>{error}</span></div><button className="primary small" onClick={load} disabled={loading}>{loading&&<LoadingSpinner/>}{loading?"Retrying…":"Try again"}</button></div></div>;if(!a)return <LoadingIndicator label="Loading your overview"/>;const stats=[[a.connected,Users,"Connected accounts","violet"],[a.scheduled,Clock3,"Scheduled posts","cyan"],[a.published,CheckCircle2,"Published posts","pink"],[a.failed,AlertTriangle,"Failed posts","amber"]];
return <div className="page overview"><div className="page-head"><div><p>Good morning</p><h1>Here’s your social pulse.</h1></div><button className="primary" onClick={onCreate}><Plus/>Create post</button></div><div className="stats">{stats.map(([n,I,l,c],i)=><Card className="stat" key={l}><div className={`stat-icon ${c}`}><I/></div><div><b><Count target={n}/></b><span>{l}</span></div><motion.div initial={{scaleX:0}} animate={{scaleX:1}} transition={{delay:i*.1}} className="stat-glow"/></Card>)}</div><div className="dashboard-grid"><Card className="chart-card"><div className="card-title"><div><b>Publishing activity</b><span>Last 7 days · live database</span></div><TrendingUp/></div><div className="chart">{a.chart.map((d,i)=><div className="bar-wrap" key={d.day}><motion.i initial={{height:0}} animate={{height:d.value?Math.min(200,Math.max(8,d.value*18)):2}} transition={{delay:i*.05}}/><span>{d.day}</span></div>)}</div></Card><Card className="activity-card"><div className="card-title"><div><b>Recent activity</b><span>Live feed</span></div></div>{a.activity.length?a.activity.map((x,i)=><motion.div className="activity-row" key={x.id} initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} transition={{delay:i*.05}}><span className="activity-dot"/><div><b>{x.description}</b><small>{x.created_at||"Just now"}</small></div></motion.div>):<Empty icon={Bell} text="No activity yet"/>}</Card></div></div>}
function Count({target}){const[n,setN]=useState(0);useEffect(()=>{let c=0,t=setInterval(()=>{c+=Math.ceil(target/12);if(c>=target){c=target;clearInterval(t)}setN(c)},30);return()=>clearInterval(t)},[target]);return n}
function Empty({icon:I,text}){return <div className="empty"><I/><p>{text}</p></div>}
function PlatformLogo({platform}){if(platform==="instagram")return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.25" fill="currentColor"/></svg>;if(platform==="facebook")return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-8h2.8l.4-3h-3.2V8.1c0-.9.3-1.6 1.7-1.6h1.7V3.8c-.3 0-1.3-.1-2.6-.1-2.6 0-4.3 1.6-4.3 4.4V10H7.2v3H10v8z"/></svg>;if(platform==="linkedin")return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.2 8.6a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM3.7 10h3v10h-3zm5 0h2.9v1.4h.1c.4-.8 1.4-1.7 3-1.7 3.1 0 3.7 2 3.7 4.6V20h-3v-5c0-1.2 0-2.7-1.7-2.7s-2 1.3-2 2.6V20h-3z"/></svg>;if(platform==="x")return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.6 22H2.4l7.3-8.4L1.9 2h6.4l4.4 6.9L18.9 2Zm-1.1 17.9h1.7L7.4 4H5.6z"/></svg>;if(platform==="tiktok")return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.2 7.3a6.1 6.1 0 0 1-3.7-3.8H12v12.1a2.8 2.8 0 1 1-2.8-2.8c.3 0 .6 0 .9.1v-3.5a6.5 6.5 0 1 0 5.4 6.4V9.6a9.3 9.3 0 0 0 4.6 1.2V7.4z"/></svg>;if(platform==="youtube")return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 7.1a3 3 0 0 0-2.1-2.2C19 4.4 12 4.4 12 4.4s-7 0-8.9.5A3 3 0 0 0 1 7.1 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.9 3 3 0 0 0 2.1 2.2c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.2 31 31 0 0 0 .5-4.9 31 31 0 0 0-.5-4.9ZM9.8 15.5v-7l6 3.5z"/></svg>;if(platform==="pinterest")return <span className="pinterest-mark" aria-hidden="true">P</span>;if(platform==="threads")return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.1 21c-4.9 0-8.1-3.5-8.1-9s3.2-9 8.1-9c4.2 0 7 2.2 7.7 6.1l-2.9.6c-.5-2.5-2-3.8-4.8-3.8-3.2 0-5 2.2-5 6.1s1.8 6.1 5 6.1c2.6 0 4.2-1.2 4.2-3.2 0-1.3-.8-2-2.1-2-1.5 0-2.4.7-2.4 1.8 0 .5.2.9.6 1.2l-1.7 2c-1.3-.7-2-1.8-2-3.2 0-2.8 2.2-4.6 5.5-4.6 3 0 5 1.8 5 4.7 0 3.7-2.8 6.2-7.1 6.2Z"/></svg>;if(platform==="telegram")return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.8 3.3-3.4 17c-.2 1.2-.9 1.5-1.9.9l-5.3-3.9-2.6 2.5c-.3.3-.6.6-1.1.6l.4-5.4 9.8-8.9c.4-.4-.1-.6-.6-.2L5 13.6l-5.1-1.6c-1.1-.3-1.1-1.1.2-1.6L20 2.8c.9-.3 2.1.2 1.8.5Z"/></svg>;return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M8.5 13.5c.8 1.2 2 1.8 3.5 1.8s2.7-.6 3.5-1.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/></svg>}

function Accounts(){
  const[accounts,setAccounts]=useState([]);
  const[platforms,setPlatforms]=useState([]);
  const[error,setError]=useState("");
  const[busy,setBusy]=useState("");
  const[loading,setLoading]=useState(true);
  const[notice,setNotice]=useState(()=>{const q=new URLSearchParams(window.location.search);const result=q.get("social");if(!result)return null;const message=q.get("message")||(result==="connected"?"Account connected successfully.":"Account connection failed.");window.history.replaceState({}, "", window.location.pathname);return{text:message,error:result==="error"}});
  async function load(showLoader=false){if(showLoader)setLoading(true);try{const[connected,available]=await Promise.all([api("/api/social/accounts"),api("/api/social/platforms")]);setAccounts(connected);setPlatforms(available);setError("")}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load();const timer=setInterval(()=>{if(document.visibilityState==="visible")load()},15000);return()=>clearInterval(timer)},[]);
  async function connect(platform){setBusy(platform);setError("");try{const result=await api(`/api/social/connect/${platform}`,{method:"POST"});if(!result.authUrl)throw new Error("The provider did not return an authorization link.");window.location.assign(result.authUrl)}catch(e){setError(e.message);setBusy("")}}
  async function disconnect(item){setBusy(item.platform);setError("");try{await api(`/api/social/${item.id}`,{method:"DELETE"});await load()}catch(e){setError(e.message)}finally{setBusy("")}}
  return <div className="page"><PageHead eyebrow="Channels" title="Connected accounts"/><p className="accounts-intro">Connect securely through each platform’s sign-in page. SocialFlow never asks for your social password.</p>{notice&&<div className={`connection-notice ${notice.error?"error":""}`} role="status">{notice.text}</div>}{error&&<div className="form-error" role="alert">{error} <button className="inline-link" onClick={()=>load(true)}>Retry</button></div>}{loading?<LoadingIndicator label="Loading your connected accounts"/>:<div className="platform-grid">{platforms.map(({id,name,configured,note})=>{const item=accounts.find(x=>x.platform===id);return <Card className="platform-card" key={id}>{item?.avatar_url?<img className={`platform-logo ${id} account-avatar`} src={item.avatar_url} alt=""/>:<div className={`platform-logo ${id}`}><PlatformLogo platform={id}/></div>}<div className="platform-info"><b>{name}</b><span className={item?"verified":configured?"not-connected":"setup-required"}>{item?`● ${item.display_name}`:configured?"Not connected":note||"OAuth app setup required"}</span></div>{item?<button className="ghost" disabled={busy===id} onClick={()=>disconnect(item)}>{busy===id&&<LoadingSpinner/>}<X/>{busy===id?"Disconnecting…":"Disconnect"}</button>:<button className="primary small" disabled={!configured||busy===id} title={!configured?note||"Configure this platform's OAuth app on the server":undefined} onClick={()=>connect(id)}>{busy===id&&<LoadingSpinner/>}{busy===id?"Opening…":configured?<><Plus/>Connect</>:"Unavailable"}</button>}</Card>})}</div>}</div>
}
function PageHead({eyebrow,title}){return <div className="page-head"><div><p>{eyebrow}</p><h1>{title}</h1></div></div>}

function Composer({aiSeed}){
  const[content,setContent]=useState(aiSeed?.caption||"");
  const[hashtags,setHashtags]=useState(aiSeed?.hashtags||[]);
  const[accounts,setAccounts]=useState([]);
  const[accountsLoading,setAccountsLoading]=useState(true);
  const[selected,setSelected]=useState([]);
  const[status,setStatus]=useState("");
  const[schedule,setSchedule]=useState("");
  const[media,setMedia]=useState([]);
  const[uploading,setUploading]=useState(false);
  const[busyAction,setBusyAction]=useState("");
  const previewAccount=accounts.find(account=>selected.includes(account.id));
  useEffect(()=>{api("/api/social/accounts").then(setAccounts).catch(e=>setStatus(e.message)).finally(()=>setAccountsLoading(false))},[]);
  useEffect(()=>{if(aiSeed?.caption){setContent(aiSeed.caption);setHashtags(aiSeed.hashtags||[])}},[aiSeed]);
  async function uploadFiles(files){
    if(!files.length)return;
    setUploading(true);setStatus("");
    try{const form=new FormData();files.forEach(file=>form.append("files",file));const response=await fetch("/api/media/upload",{method:"POST",headers:localStorage.token?{Authorization:`Bearer ${localStorage.token}`}:{},body:form});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"Upload failed");setMedia(items=>[...items,...result])}
    catch(e){setStatus(e.message)}
    finally{setUploading(false)}
  }
  async function create(action){
    setBusyAction(action);setStatus(action==="draft"?"Saving draft…":action==="schedule"?"Scheduling…":"Publishing…");
    try{
      if((action==="schedule"||action==="publish")&&!selected.length)throw new Error("Select at least one connected account.");
      if(action==="schedule"&&(!schedule||new Date(schedule)<=new Date()))throw new Error("Choose a future schedule date and time.");
      const body={content,hashtags:hashtags.join(" "),status:action==="schedule"?"scheduled":"draft",source:aiSeed?"ai":"manual",accountIds:selected,scheduledAt:action==="schedule"?new Date(schedule).toISOString():null,media};
      const post=await api("/api/posts",{method:"POST",body:JSON.stringify(body)});
      if(action==="publish"){const result=await api(`/api/posts/${post.id}/publish`,{method:"POST"});const failed=result.results.find(target=>target.status!=="published");if(failed)throw new Error(failed.error||"The post was not published.")}
      setStatus(action==="draft"?"Draft saved":action==="schedule"?"Post scheduled":"Published successfully");
    }catch(e){setStatus(e.message)}
    finally{setBusyAction("")}
  }
  function platformName(id){return id?`${id[0].toUpperCase()}${id.slice(1)}`:"No account selected"}
  function handleDrop(event){event.preventDefault();uploadFiles(Array.from(event.dataTransfer.files))}
  return <div className="page"><PageHead eyebrow="Composer" title="Create a post"/><div className="composer-layout"><Card className="composer-main"><label>Post copy<textarea value={content} onChange={event=>setContent(event.target.value)} placeholder="Write your post…"/></label><div className="composer-meta"><span>{content.length} characters</span><button onClick={()=>setHashtags(items=>[...items,"#SocialFlow"])}>+ Hashtag</button></div><label className="dropzone" onDragOver={event=>event.preventDefault()} onDrop={handleDrop}><input type="file" accept="image/*,video/*" multiple disabled={uploading} onChange={event=>uploadFiles(Array.from(event.target.files||[]))}/>{uploading?<LoadingSpinner/>:<Upload/>}<b>{uploading?"Uploading…":"Add media"}</b><span>Choose files or drop them here</span></label>{media.length>0&&<div className="media-list">{media.map((item,index)=><div className="media-item" key={item.url}><span>{item.url.split("/").pop()}</span><button type="button" className="inline-link" onClick={()=>setMedia(items=>items.filter((_,i)=>i!==index))}>Remove</button></div>)}</div>}<label>Schedule date & time<input type="datetime-local" value={schedule} onChange={event=>setSchedule(event.target.value)}/></label><div className="actions"><button className="ghost" disabled={!!busyAction||uploading} onClick={()=>create("draft")}>{busyAction==="draft"&&<LoadingSpinner/>}{busyAction==="draft"?"Saving…":"Save draft"}</button><button className="ghost" disabled={!!busyAction||uploading} onClick={()=>create("schedule")}>{busyAction==="schedule"&&<LoadingSpinner/>}{busyAction==="schedule"?"Scheduling…":"Schedule"}</button><button className="primary" disabled={!!busyAction||uploading} onClick={()=>create("publish")}>{busyAction==="publish"&&<LoadingSpinner/>}<Send/>{busyAction==="publish"?"Publishing…":"Publish now"}</button></div>{status&&<motion.div className="status-banner" initial={{scale:.96,opacity:0}} animate={{scale:1,opacity:1}}>{status}</motion.div>}</Card><Card className="preview"><div className="card-title"><div><b>Post preview</b><span>{platformName(previewAccount?.platform)}</span></div></div><div className="social-preview"><div className="preview-user">{previewAccount?.avatar_url?<img className="avatar" src={previewAccount.avatar_url} alt=""/>:<div className="avatar">{previewAccount?.display_name?.[0]||"?"}</div>}<b>{previewAccount?.display_name||"Choose a connected account"}</b></div>{media[0]?media[0].type==="video"?<video className="media-preview" controls src={media[0].url}/>:<img className="media-preview" src={media[0].url} alt="Post media preview"/>:<div className="preview-image empty-media"><Upload/><span>No media added</span></div>}<p>{content||"Your post text will appear here."}</p><small>{hashtags.join(" ")}</small></div><div className="account-picker"><b>Publish to</b>{accountsLoading?<LoadingIndicator compact label="Loading accounts"/>:accounts.length?accounts.map(account=><label key={account.id}><input type="checkbox" checked={selected.includes(account.id)} onChange={event=>setSelected(items=>event.target.checked?[...items,account.id]:items.filter(id=>id!==account.id))}/><span>{account.display_name}</span><i className="verified-dot"/></label>):<span className="muted-copy">Connect an account before scheduling or publishing.</span>}</div></Card></div></div>
}

function AIStudio({onUse,onAccounts}){
  const[topic,setTopic]=useState("");
  const[tone,setTone]=useState("professional");
  const[loading,setLoading]=useState(false);
  const[accountsLoading,setAccountsLoading]=useState(true);
  const[variations,setVariations]=useState([]);
  const[accounts,setAccounts]=useState([]);
  const[selected,setSelected]=useState([]);
  const[error,setError]=useState("");
  useEffect(()=>{api("/api/social/accounts").then(setAccounts).catch(e=>setError(e.message)).finally(()=>setAccountsLoading(false))},[]);
  async function generate(){setLoading(true);setError("");try{if(!selected.length)throw new Error("Connect and select at least one social account.");const result=await api("/api/ai/text",{method:"POST",body:JSON.stringify({topic,brand:"",tone,platforms:selected})});setVariations(result)}catch(e){setError(e.message)}finally{setLoading(false)}}
  return <div className="page"><PageHead eyebrow="Creative engine" title="AI Studio"/><Card className="ai-input"><label>What are you creating?</label><textarea value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Describe the post you want to create…"/><div className="ai-platforms"><b>Generate for connected accounts</b>{accountsLoading?<LoadingIndicator compact label="Loading connected accounts"/>:accounts.length?accounts.map(account=><label key={account.id}><input type="checkbox" checked={selected.includes(account.platform)} onChange={e=>setSelected(items=>e.target.checked?[...new Set([...items,account.platform])]:items.filter(platform=>platform!==account.platform))}/>{account.display_name} <small>{account.platform}</small></label>):<span>No connected accounts. <button className="inline-link" onClick={onAccounts}>Connect an account</button></span>}</div><div className="ai-controls"><div className="chips">{["professional","funny","inspirational","bold"].map(value=><button className={tone===value?"active":""} onClick={()=>setTone(value)} key={value}>{value}</button>)}</div><button className="primary" onClick={generate} disabled={loading||accountsLoading||!topic.trim()||!selected.length}>{loading&&<LoadingSpinner/>}<Sparkles/>{loading?"Generating…":"Generate"}</button></div></Card>{error&&<div className="form-error" role="alert">{error}</div>}{loading?<Card className="ai-loading"><LoadingIndicator label="Generating your content"/></Card>:<div className="variation-grid">{variations.map((variation,index)=><motion.div key={variation.platform} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:index*.08}}><Card className="variation"><div className="card-title"><b>{variation.platform}</b><span>{variation.caption.length} chars</span></div><p>{variation.caption}</p><small>{variation.hashtags.join(" ")}</small><div className="actions"><button className="primary small" onClick={()=>onUse(variation)}>Use post</button></div></Card></motion.div>)}</div>}</div>
}

function Planner({onAccounts}){
  const[form,setForm]=useState({niche:"",goal:"",audience:"",tone:"professional",platforms:[],startDate:new Date(Date.now()+86400000).toISOString().slice(0,10)});
  const[accounts,setAccounts]=useState([]);
  const[accountsLoading,setAccountsLoading]=useState(true);
  const[plan,setPlan]=useState(null);
  const[loading,setLoading]=useState(false);
  const[error,setError]=useState("");
  const[notice,setNotice]=useState("");
  useEffect(()=>{api("/api/social/accounts").then(setAccounts).catch(e=>setError(e.message)).finally(()=>setAccountsLoading(false))},[]);
  async function generate(){setLoading(true);setError("");setNotice("");try{const result=await api("/api/plans/generate",{method:"POST",body:JSON.stringify(form)});setPlan(result)}catch(e){setError(e.message)}finally{setLoading(false)}}
  async function approve(){setLoading(true);setError("");try{const result=await api(`/api/plans/${plan.id}/approve`,{method:"POST"});setNotice(`Saved and scheduled ${result.scheduledTargets} post targets.`);setPlan(null)}catch(e){setError(e.message)}finally{setLoading(false)}}
  const platformAccounts=[...new Map(accounts.map(account=>[account.platform,account])).values()];
  return <div className="page"><PageHead eyebrow="Strategy" title="7-Day Planner"/><Card className="planner-form"><div className="form-grid">{[["niche","Niche / business"],["goal","Goal"],["audience","Audience"],["tone","Tone"]].map(([key,label])=><label key={key}>{label}<input placeholder={label} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}</div><label>Start date<input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})}/></label><div className="ai-platforms"><b>Platforms for this plan</b>{accountsLoading?<LoadingIndicator compact label="Loading connected accounts"/>:platformAccounts.length?platformAccounts.map(account=><label key={account.platform}><input type="checkbox" checked={form.platforms.includes(account.platform)} onChange={e=>setForm({...form,platforms:e.target.checked?[...form.platforms,account.platform]:form.platforms.filter(platform=>platform!==account.platform)})}/>{account.display_name} <small>{account.platform}</small></label>):<span>No connected accounts. <button className="inline-link" onClick={onAccounts}>Connect an account</button></span>}</div><button className="primary" onClick={generate} disabled={loading||accountsLoading||!form.niche.trim()||!form.goal.trim()||!form.audience.trim()||!form.platforms.length}>{loading&&<LoadingSpinner/>}<Sparkles/>{loading?"Working…":"Generate 7-day plan"}</button></Card>{error&&<div className="form-error" role="alert">{error}</div>}{notice&&<div className="connection-notice" role="status">{notice}</div>}{plan&&<><div className="day-timeline">{plan.items.map(item=><motion.div className="day-card glass" key={item.day} initial={{opacity:0,y:30}} animate={{opacity:1,y:0}}><div className="day-num">{item.day}</div><b>{item.theme}</b><p>{item.caption}</p><small>{item.hashtags.join(" ")}</small><span>{item.date} · {item.scheduledAt.slice(11,16)} UTC</span></motion.div>)}</div><div className="actions plan-actions"><button className="ghost" onClick={()=>setPlan(null)}>Discard plan</button><button className="primary" onClick={approve} disabled={loading}>{loading&&<LoadingSpinner/>}<CheckCircle2/>Approve & schedule</button></div></>}</div>
}

function CalendarPage(){
  const[posts,setPosts]=useState([]);
  const[month,setMonth]=useState(()=>{const now=new Date();return new Date(now.getFullYear(),now.getMonth(),1)});
  const[error,setError]=useState("");
  const[loading,setLoading]=useState(true);
  const year=month.getFullYear(),monthIndex=month.getMonth(),offset=(new Date(year,monthIndex,1).getDay()+6)%7,daysInMonth=new Date(year,monthIndex+1,0).getDate(),cellCount=Math.ceil((offset+daysInMonth)/7)*7;
  async function load(){const from=new Date(Date.UTC(year,monthIndex,1)).toISOString(),to=new Date(Date.UTC(year,monthIndex+1,0,23,59,59,999)).toISOString();try{setPosts(await api(`/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`));setError("")}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{setLoading(true);load();const timer=setInterval(()=>{if(document.visibilityState==="visible")load()},15000);return()=>clearInterval(timer)},[year,monthIndex]);
  const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  return <div className="page"><PageHead eyebrow="Schedule" title="Calendar"/>{error&&<div className="form-error" role="alert">{error} <button className="inline-link" onClick={()=>{setLoading(true);load()}}>Retry</button></div>}{loading?<LoadingIndicator label="Loading your calendar"/>:<Card><div className="calendar-head"><button className="ghost" aria-label="Previous month" onClick={()=>setMonth(new Date(year,monthIndex-1,1))}>‹</button><b>{month.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</b><button className="ghost" aria-label="Next month" onClick={()=>setMonth(new Date(year,monthIndex+1,1))}>›</button></div><div className="calendar"><div className="calendar-week">{days.map(day=><span key={day}>{day}</span>)}</div>{Array.from({length:cellCount},(_,index)=>{const dateNumber=index-offset+1,valid=dateNumber>0&&dateNumber<=daysInMonth,dateKey=valid?`${year}-${String(monthIndex+1).padStart(2,"0")}-${String(dateNumber).padStart(2,"0")}`:"";const events=posts.filter(post=>post.scheduled_at?.slice(0,10)===dateKey);return <div className={`calendar-cell ${valid?"":"outside-month"}`} key={index}><b>{valid?dateNumber:""}</b>{events.map(post=><motion.div className="event" layout key={post.id} title={post.content}>{post.platform}: {post.content.slice(0,32)}</motion.div>)}</div>})}</div></Card>}</div>
}
function HistoryPage(){
  const[posts,setPosts]=useState([]);
  const[status,setStatus]=useState("all");
  const[error,setError]=useState("");
  const[loading,setLoading]=useState(true);
  const[deleting,setDeleting]=useState("");
  async function load(){try{setPosts(await api(`/api/posts?status=${status}`));setError("")}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{setLoading(true);load();const timer=setInterval(()=>{if(document.visibilityState==="visible")load()},15000);return()=>clearInterval(timer)},[status]);
  async function removePost(id){setDeleting(id);try{await api(`/api/posts/${id}`,{method:"DELETE"});await load()}catch(e){setError(e.message)}finally{setDeleting("")}}
  return <div className="page"><PageHead eyebrow="Archive" title="Post history"/><div className="filters"><button className={status==="all"?"active":""} onClick={()=>setStatus("all")}>All</button>{["draft","scheduled","published","failed"].map(value=><button className={status===value?"active":""} onClick={()=>setStatus(value)} key={value}>{value}</button>)}</div>{error&&<div className="form-error" role="alert">{error} <button className="inline-link" onClick={()=>{setLoading(true);load()}}>Retry</button></div>}<Card className="history-table">{loading?<LoadingIndicator label="Loading your post history"/>:<><div className="table-head"><span>Post</span><span>Source</span><span>Status</span><span>Action</span></div>{posts.length?posts.map(post=><div className="table-row" key={post.id}><b>{post.content.slice(0,70)}</b><span>{post.source}</span><span className={`badge ${post.status}`}>{post.status}</span><button className="ghost" disabled={deleting===post.id} onClick={()=>removePost(post.id)}>{deleting===post.id&&<LoadingSpinner/>}{deleting===post.id?"Deleting…":"Delete"}</button></div>):<Empty icon={History} text="No saved posts in this view"/>}</>}</Card></div>
}
function SettingsPage(){
  const[name,setName]=useState("");
  const[timezone,setTimezone]=useState("UTC");
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[error,setError]=useState("");
  const[notice,setNotice]=useState("");
  async function load(showLoader=false){if(showLoader)setLoading(true);try{const restoredUser=await api("/api/auth/me");setName(restoredUser.name);setTimezone(restoredUser.timeZone);setError("")}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  async function save(){setSaving(true);setError("");setNotice("");try{await api("/api/users/me",{method:"PATCH",body:JSON.stringify({name,timezone})});setNotice("Settings saved.")}catch(e){setError(e.message)}finally{setSaving(false)}}
  return <div className="page"><PageHead eyebrow="Workspace" title="Settings"/>{error&&<div className="form-error" role="alert">{error} <button className="inline-link" onClick={()=>load(true)}>Retry</button></div>}{loading?<LoadingIndicator label="Loading your settings"/>:<Card className="settings-card"><label>Name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Timezone<select value={timezone} onChange={e=>setTimezone(e.target.value)}><option>UTC</option><option>America/New_York</option><option>Europe/London</option><option>Asia/Kolkata</option></select></label><label className="toggle-row"><span>Reduce motion</span><input type="checkbox"/></label><button className="primary" onClick={save} disabled={saving}>{saving&&<LoadingSpinner/>}{saving?"Saving…":"Save changes"}</button>{notice&&<div className="connection-notice" role="status">{notice}</div>}</Card>}</div>
}

function Onboarding({user,onComplete,onLogout}) {
  const platforms=[
    ["instagram","Instagram","Photo & Reels"],
    ["facebook","Facebook","Pages & Posts"],
    ["linkedin","LinkedIn","Company & Profile"],
    ["x","X","Posts & Threads"],
    ["tiktok","TikTok","Videos"],
    ["youtube","YouTube","Videos"]
  ];
  const [accounts,setAccounts]=useState([]);
  const [providerStatus,setProviderStatus]=useState([]);
  const [connecting,setConnecting]=useState("");
  const [error,setError]=useState("");
  const [retryPlatform,setRetryPlatform]=useState("");
  const [loadingPlatforms,setLoadingPlatforms]=useState(true);
  const [connectionNotice]=useState(()=>{const q=new URLSearchParams(window.location.search);const result=q.get("social");if(!result)return null;const text=q.get("message")||(result==="connected"?"Account connected successfully.":"Account connection failed.");window.history.replaceState({}, "", window.location.pathname);return{text,error:result==="error"}});
  async function load(){setLoadingPlatforms(true);try{const[connected,providers]=await Promise.all([api("/api/social/accounts"),api("/api/social/platforms")]);setAccounts(connected);setProviderStatus(providers);setError("");setRetryPlatform("")}catch(e){setError(e.message);setRetryPlatform("")}finally{setLoadingPlatforms(false)}}
  useEffect(()=>{load()},[]);
  async function connect(id){
    setConnecting(id);
    setError("");
    try{const result=await api(`/api/social/connect/${id}`,{method:"POST"});if(!result.authUrl)throw new Error("The provider did not return an authorization link.");window.location.assign(result.authUrl)}catch(e){setError(e.message);setRetryPlatform(e.message.toLowerCase().includes("not configured")?"":id);setConnecting("")}
  }
  return <div className="onboarding-shell">
    <aside className="onboarding-aside">
      <div className="brand"><div className="brand-mark"><img className="app-logo-icon" src={LOGO_SRC} alt=""/></div><span>SocialFlow</span></div>
      <div className="onboarding-copy">
        <span className="eyebrow">Welcome, {user.name?.split(" ")[0]||"there"}</span>
        <h1>Bring all your<br/><em>social channels</em><br/>into one place.</h1>
        <p>Connect the accounts you use today. You can add or remove channels at any time.</p>
      </div>
      <div className="setup-progress"><div><span>Workspace setup</span><b>{accounts.length ? "2 of 2" : "1 of 2"}</b></div><i><span style={{width:accounts.length?"100%":"50%"}}/></i></div>
    </aside>
    <main className="onboarding-main">
      <header className="onboarding-header"><span>Step 1 of 2</span><button className="text-button" onClick={onLogout}>Log out</button></header>
      <motion.div className="channel-picker" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}>
        <div className="picker-heading"><span className="eyebrow">Connect accounts</span><h2>Choose your channels</h2><p>Select at least one account to start publishing.</p></div>
        {connectionNotice&&<div className={`connection-notice ${connectionNotice.error?"error":""}`} role="status">{connectionNotice.text}</div>}
        {error&&<div className="form-error" role="alert">{error}{retryPlatform?<button type="button" className="inline-link" onClick={()=>connect(retryPlatform)}>Retry connection</button>:<button type="button" className="inline-link" onClick={load}>Retry loading accounts</button>}</div>}
        {loadingPlatforms?<LoadingIndicator compact label="Checking your social channels"/>:<div className="channel-grid">
          {platforms.map(([id,name,detail])=>{
            const account=accounts.find(a=>a.platform===id);
            const provider=providerStatus.find(item=>item.id===id);
            return <motion.button whileTap={{scale:.985}} className={`channel-card ${account?"connected":""} ${provider?.configured===false?"unconfigured":""}`} key={id} onClick={()=>!account&&provider?.configured===true&&connect(id)} disabled={loadingPlatforms||!!account||connecting===id||provider?.configured!==true} title={provider?.configured===false?provider.note:undefined}>
              <div className={`channel-mark ${id}`}><PlatformLogo platform={id}/></div>
              <div className="channel-text"><b>{name}</b><span>{account?`${account.display_name} • Connected`:!provider?"Provider status unavailable":provider.configured?detail:"OAuth setup required"}</span></div>
              {account?<span className="channel-check"><CheckCircle2/></span>:<span className={`channel-action ${provider?.configured===false?"setup-required":""}`}>{connecting===id&&<LoadingSpinner/>}{connecting===id?"Connecting…":!provider?"Unavailable":provider.configured?"Connect":"Setup required"}{provider?.configured===true&&<ChevronRight/>}</span>}
            </motion.button>
          })}
        </div>}
        <div className="picker-footer"><button className="text-button" onClick={onComplete}>Skip for now</button><button className="primary continue" onClick={onComplete} disabled={!accounts.length}>Continue<ChevronRight/></button></div>
      </motion.div>
    </main>
  </div>
}

function App(){
  const[splash,setSplash]=useState(true);
  const[user,setUser]=useState(null);
  const[booting,setBooting]=useState(()=>Boolean(localStorage.token));
  const[onboarding,setOnboarding]=useState(false);
  const[page,setPage]=useState("Overview");
  const[collapsed,setCollapsed]=useState(false);
  const[theme,setTheme]=useState("light");
  const[aiSeed,setAiSeed]=useState(null);
  useEffect(()=>{if(new URLSearchParams(window.location.search).has("social"))setPage("Accounts")},[]);
  useEffect(()=>{document.documentElement.dataset.theme=theme},[theme]);
  useEffect(()=>{
    if(!localStorage.token)return;
    let active=true;
    async function restoreSession(){
      try{
        const restoredUser=await api("/api/auth/me");
        if(!active)return;
        setUser(restoredUser);
        try{
          const accounts=await api("/api/social/accounts");
          if(!active)return;
          const seen=localStorage.getItem(`socialflow:onboarding:${restoredUser.id}`);
          setOnboarding(accounts.length===0 && seen!=="complete");
        }catch(e){console.error(e);setOnboarding(true)}
      }catch{if(active)delete localStorage.token}
      finally{if(active)setBooting(false)}
    }
    restoreSession();
    return()=>{active=false};
  },[]);
  async function handleAuth(authenticatedUser){
    setUser(authenticatedUser);
    setBooting(true);
    try{
      const accounts=await api("/api/social/accounts");
      const seen=localStorage.getItem(`socialflow:onboarding:${authenticatedUser.id}`);
      setOnboarding(accounts.length===0 && seen!=="complete");
    }catch(e){console.error(e);setOnboarding(true)}
    finally{setBooting(false)}
  }
  function logout(){localStorage.removeItem("token");setUser(null);setOnboarding(false)}
  function finishOnboarding(){if(user)localStorage.setItem(`socialflow:onboarding:${user.id}`,"complete");setOnboarding(false)}
  if(splash)return <AnimatePresence><Splash ready={!booting} done={()=>setSplash(false)}/></AnimatePresence>;
  if(booting)return <div className="workspace-loading"><LoadingIndicator label="Loading your workspace"/></div>;
  if(!user)return <Auth onAuth={handleAuth}/>;
  if(onboarding)return <Onboarding user={user} onComplete={finishOnboarding} onLogout={logout}/>;
  const useAi=v=>{setAiSeed(v);setPage("Create Post")};
  return <div className={`app ${collapsed?"compact":""}`}>
    <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} user={user} onLogout={logout}/>
    <main>
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight/><b>{page}</b></div><div className="header-actions"><button className="icon-btn notification" aria-label="Notifications"><Bell/><i/></button><button className="icon-btn" aria-label="Toggle theme" onClick={()=>setTheme(t=>t==="dark"?"light":"dark")}>{theme==="dark"?<Sun/>:<Moon/>}</button></div></header>
      <AnimatePresence mode="wait"><motion.div key={page} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} transition={{duration:.22}}>{page==="Overview"?<Overview onCreate={()=>setPage("Create Post")}/>:page==="Accounts"?<Accounts/>:page==="Create Post"?<Composer aiSeed={aiSeed}/>:page==="AI Studio"?<AIStudio onUse={useAi} onAccounts={()=>setPage("Accounts")}/>:page==="7-Day Planner"?<Planner onAccounts={()=>setPage("Accounts")}/>:page==="Calendar"?<CalendarPage/>:page==="Post History"?<HistoryPage/>:<SettingsPage/>}</motion.div></AnimatePresence>
    </main>
  </div>
}
const rootContainer=document.getElementById("root");
const root=globalThis.__socialflowRoot||createRoot(rootContainer);
globalThis.__socialflowRoot=root;
root.render(<App/>);
