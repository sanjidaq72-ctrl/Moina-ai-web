import {useEffect,useState} from 'react'
import {sb,ok,supaUrl,supaKey} from './supabase'
import * as tus from 'tus-js-client'
import Logo from './Logo'
const MAX=500*1024*1024
const mb=b=>(b/1048576).toFixed(1)
async function tusUpload(file,path,onP){
 const{data:{session}}=await sb.auth.getSession()
 const ref=new URL(supaUrl).hostname.split('.')[0]
 return new Promise((res,rej)=>new tus.Upload(file,{endpoint:`https://${ref}.storage.supabase.co/storage/v1/upload/resumable`,retryDelays:[0,3000,5000,10000,20000],
  headers:{authorization:'Bearer '+session.access_token,apikey:supaKey},uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,chunkSize:6*1024*1024,
  metadata:{bucketName:'app-releases',objectName:path,contentType:'application/vnd.android.package-archive',cacheControl:'3600'},onError:rej,onProgress:onP,onSuccess:res}).start())
}
const log=(action,detail='')=>sb.from('admin_activity_logs').insert({action,detail})

function Login({onDone}){
 const[st,setSt]=useState('pw'),[em,setEm]=useState(''),[pw,setPw]=useState(''),[code,setCode]=useState(''),[f,setF]=useState(null),[err,setErr]=useState(''),[left,setLeft]=useState(120)
 useEffect(()=>{if(st!=='code')return;setLeft(120);const t=setInterval(()=>setLeft(x=>Math.max(0,x-1)),1000);return()=>clearInterval(t)},[st])
 async function pwGo(e){e.preventDefault();setErr('')
  const{error}=await sb.auth.signInWithPassword({email:em,password:pw});if(error)return setErr(error.message)
  const{data}=await sb.auth.mfa.listFactors()
  for(const x of(data.all||[]).filter(x=>x.status==='unverified'))await sb.auth.mfa.unenroll({factorId:x.id})
  const t=(data.totp||[])[0]
  if(t){setF({id:t.id});setSt('code');return}
  const r=await sb.auth.mfa.enroll({factorType:'totp'});if(r.error)return setErr(r.error.message)
  setF({id:r.data.id,qr:r.data.totp.qr_code,secret:r.data.totp.secret});setSt('code')}
 async function verify(e){e.preventDefault();setErr('')
  const{error}=await sb.auth.mfa.challengeAndVerify({factorId:f.id,code});if(error)return setErr('Wrong or expired code. Try the newest code in Google Authenticator.')
  onDone()}
 return<div className="w a3" style={{maxWidth:520}}><div className="card" style={{marginTop:60}}><div style={{textAlign:'center'}}><Logo size={90}/></div>
  {st==='pw'?<form onSubmit={pwGo}><p className="mu">Authentication</p><h1 style={{fontSize:'2.2rem'}}>Admin sign in</h1>
   <label>Email</label><input className="in" type="email" value={em} onChange={e=>setEm(e.target.value)} required/>
   <label>Password</label><input className="in" type="password" value={pw} onChange={e=>setPw(e.target.value)} required/>
   <p className="err">{err}</p><button className="btn">Continue</button></form>
  :<form onSubmit={verify}><p className="mu">Authentication</p><h1 style={{fontSize:'2.2rem'}}>Verify your identity</h1>
   {f?.qr?<><p className="mu">First time: scan this with Google Authenticator, then enter the 6-digit code.</p><img src={f.qr} alt="QR" width="180"/><p className="mu" style={{wordBreak:'break-all'}}>Manual key: {f.secret}</p></>:<p className="mu">Enter the 6-digit code from Google Authenticator.</p>}
   <input className="in code" inputMode="numeric" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} autoFocus/>
   <p className="mu">Codes refresh every 30 seconds · {String(Math.floor(left/60)).padStart(2,'0')}:{String(left%60).padStart(2,'0')}</p>
   <p className="err">{err}</p><button className="btn" disabled={code.length!==6}>Verify access</button></form>}
  <p style={{marginTop:20}}><a href="#/">← Back to site</a></p></div></div>
}

function S({l,n}){const[t,setT]=useState({})
 return<div className="card tilt" style={t} onMouseMove={e=>{const r=e.currentTarget.getBoundingClientRect();setT({'--ry':((e.clientX-r.left)/r.width-.5)*14+'deg','--rx':(.5-(e.clientY-r.top)/r.height)*14+'deg'})}} onMouseLeave={()=>setT({})}><div className="mu">{l}</div><h2>{n}</h2></div>}
function Overview(){
 const[d,setD]=useState(null)
 useEffect(()=>{(async()=>{
  const c=(p,e)=>{let q=sb.from('download_statistics').select('*',{count:'exact',head:true});if(p)q=q.eq('platform',p);if(e)q=q.eq('event',e);return q.then(r=>r.count??0)}
  const[v,ar,ac,ir,rel,lg]=await Promise.all([c('web','visit'),c('android','request'),c('android','completed'),c('ios','request'),
   sb.from('app_releases').select('platform,version,is_latest,is_published'),sb.from('admin_activity_logs').select('*').order('created_at',{ascending:false}).limit(8)])
  setD({v,ar,ac,ir,rel:rel.data||[],lg:lg.data||[]})})()},[])
 if(!d)return<p className="mu">Loading…</p>
 const lat=d.rel.find(r=>r.is_latest&&r.platform==='android')
 return<><div className="grid"><S l="Website visits" n={d.v}/><S l="Android download requests" n={d.ar}/><S l="Android completed downloads" n={d.ac}/><S l="iOS link clicks" n={d.ir}/><S l="Total releases" n={d.rel.length}/><S l="Latest Android version" n={lat?lat.version:'—'}/></div>
  <div className="card"><h3>Recent activity</h3>{d.lg.length?d.lg.map(l=><p key={l.id} className="mu">{new Date(l.created_at).toLocaleString()} · {l.action} {l.detail}</p>):<p className="mu">No activity yet.</p>}</div></>
}

function Releases(){
 const[list,setList]=useState([]),[pf,setPf]=useState('android'),[v,setV]=useState(''),[n,setN]=useState(''),[mo,setMo]=useState(''),[su,setSu]=useState(''),[tu,setTu]=useState(''),[file,setFile]=useState(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[drag,setDrag]=useState(false),[pct,setPct]=useState(null),[eu,setEu]=useState(''),[sz,setSz]=useState('')
 const load=()=>sb.from('app_releases').select('*').order('released_at',{ascending:false}).then(r=>setList(r.data||[]))
 useEffect(()=>{load()},[])
 const pick=f=>{if(!f)return;if(!f.name.toLowerCase().endsWith('.apk'))return setMsg('Only .apk files are allowed.');if(f.size>MAX)return setMsg('File is larger than 500 MB.');setMsg('');setFile(f)}
 async function add(e){e.preventDefault();setMsg('')
  if(pf==='android'&&!file&&!/^https:\/\//.test(eu))return setMsg('Choose an APK file, or paste an https:// download link.')
  setBusy(true);let path=null
  if(pf==='android'&&file){path=`${v}/${Date.now()}-${file.name.replace(/[^\w.-]/g,'_')}`
   try{setPct({p:0,a:0,b:file.size});await tusUpload(file,path,(a,b)=>setPct({p:Math.floor(a/b*100),a,b}))}
   catch(e){setPct(null);setBusy(false);const m=String(e.message||e);return setMsg('Upload failed: '+(/413|exceed|maximum|size/i.test(m)?'file is over the Supabase storage limit. Raise the global file size limit in Supabase Dashboard > Storage > Settings (needs a paid plan above 50 MB). ':'')+m)}
   setPct(null)}
  const{error}=await sb.from('app_releases').insert({platform:pf,version:v,notes:n,min_os:mo||null,file_path:path,file_size:file?.size??(sz?Math.round(+sz*1048576):null),store_url:pf==='ios'?(su||null):(file?null:eu),testflight_url:tu||null})
  setBusy(false);if(error){if(path)await sb.storage.from('app-releases').remove([path]);return setMsg('Save failed: '+error.message)}
  log('release created',`${pf} ${v}`);setMsg('Saved as draft. Publish it below.');setV('');setN('');setFile(null);setEu('');setSz('');load()}
 const pub=async r=>{await sb.from('app_releases').update({is_published:!r.is_published}).eq('id',r.id);log(r.is_published?'unpublished':'published',`${r.platform} ${r.version}`);load()}
 const latest=async r=>{const{error}=await sb.rpc('set_latest',{rid:r.id});if(error)setMsg(error.message);else log('set latest',`${r.platform} ${r.version}`);load()}
 const del=async r=>{if(!confirm(`Delete ${r.platform} ${r.version}? This cannot be undone.`))return
  if(r.file_path)await sb.storage.from('app-releases').remove([r.file_path]);await sb.from('app_releases').delete().eq('id',r.id);log('deleted',`${r.platform} ${r.version}`);load()}
 useEffect(()=>{if(pct===null)return;const f=e=>{e.preventDefault();e.returnValue=''};addEventListener('beforeunload',f);return()=>removeEventListener('beforeunload',f)},[pct===null])
 return<>{pct&&<div className="overlay"><div className="card"><h3>Uploading APK…</h3><div className="bar"><i style={{width:pct.p+'%'}}/></div><h2 style={{margin:'14px 0 4px'}}>{pct.p}%</h2><p className="mu">{mb(pct.a)} / {mb(pct.b)} MB. Keep this page open until it finishes.</p></div></div>}<form className="card" onSubmit={add}><h3>New release</h3>
  <label>Platform</label><select className="in" value={pf} onChange={e=>setPf(e.target.value)}><option value="android">Android</option><option value="ios">iOS</option></select>
  <label>Version</label><input className="in" value={v} onChange={e=>setV(e.target.value)} required placeholder="1.0.0"/>
  <label>Release notes</label><textarea className="in" value={n} onChange={e=>setN(e.target.value)}/>
  {pf==='android'?<><label>Minimum Android version</label><input className="in" value={mo} onChange={e=>setMo(e.target.value)} placeholder="Android 8.0"/>
   <label>APK file</label><div className="in" style={{textAlign:'center',outline:drag?'2px dashed var(--ac)':'none'}} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);pick(e.dataTransfer.files[0])}}>
   {file?`${file.name} · ${(file.size/1048576).toFixed(1)} MB`:'Drop an APK here (up to 500 MB) or '}<input type="file" accept=".apk" onChange={e=>pick(e.target.files[0])}/></div>
   <label>Or external download link (for APKs over 50 MB, e.g. GitHub Releases)</label><input className="in" value={eu} onChange={e=>setEu(e.target.value)} placeholder="https://github.com/…/MoinaAI.apk"/>
   <label>File size in MB (optional, for the link option)</label><input className="in" inputMode="decimal" value={sz} onChange={e=>setSz(e.target.value)} placeholder="143.7"/></>
  :<><label>App Store URL</label><input className="in" value={su} onChange={e=>setSu(e.target.value)} placeholder="https://apps.apple.com/…"/><label>TestFlight URL</label><input className="in" value={tu} onChange={e=>setTu(e.target.value)} placeholder="https://testflight.apple.com/…"/></>}
  <p className={msg.includes('ailed')||msg.includes('Only')||msg.includes('larger')?'err':'okc'}>{msg}</p>
  <button className="btn" disabled={busy}>{busy?'Uploading…':'Save release'}</button></form>
  <div className="card"><h3>Releases</h3>{list.length?<table><tbody>{list.map(r=><tr key={r.id}><td>{r.platform} {r.version}{r.is_latest&&' ★'}</td><td>{r.is_published?'Published':'Draft'}</td>
   <td><button className="btn" onClick={()=>pub(r)}>{r.is_published?'Unpublish':'Publish'}</button> <button className="btn" onClick={()=>latest(r)}>Set latest</button> <button className="btn" onClick={()=>del(r)}>Delete</button></td></tr>)}</tbody></table>:<p className="mu">No releases yet. Add your first one above.</p>}</div></>
}

const KEYS=[['site_title','Website title'],['hero_title','Hero title'],['hero_subtitle','Hero subtitle'],['description','Main description'],['about','About'],['support_contact','Support and contact'],['privacy','Privacy Policy'],['terms','Terms and Conditions'],['footer_text','Footer text'],['seo_title','SEO title'],['seo_description','SEO description']]
function Content(){
 const[c,setC]=useState({}),[s,setS]=useState({}),[msg,setMsg]=useState('')
 useEffect(()=>{sb.from('website_content').select('*').then(r=>setC(Object.fromEntries((r.data||[]).map(i=>[i.key,i.value]))));sb.from('app_settings').select('*').then(r=>setS(Object.fromEntries((r.data||[]).map(i=>[i.key,i.value]))))},[])
 async function save(){setMsg('')
  const a=await sb.from('website_content').upsert(KEYS.map(([k])=>({key:k,value:c[k]||'',updated_at:new Date()})))
  const b=await sb.from('app_settings').upsert(['android_enabled','ios_enabled','maintenance','accent'].map(k=>({key:k,value:s[k]??null,updated_at:new Date()})))
  if(a.error||b.error)return setMsg('Save failed: '+(a.error||b.error).message);log('content saved');setMsg('Saved.')}
 const T=({k,l})=><label className="row"><input type="checkbox" checked={s[k]===true} onChange={e=>setS({...s,[k]:e.target.checked})}/>{l}</label>
 return<div className="card"><h3>Website content</h3>{KEYS.map(([k,l])=><div key={k}><label>{l}</label><textarea className="in" value={c[k]||''} onChange={e=>setC({...c,[k]:e.target.value})}/></div>)}
  <h3 style={{marginTop:24}}>Settings</h3><label className="row"><input type="checkbox" checked={s.android_enabled!==false} onChange={e=>setS({...s,android_enabled:e.target.checked})}/>Android downloads enabled</label>
  <label className="row"><input type="checkbox" checked={s.ios_enabled!==false} onChange={e=>setS({...s,ios_enabled:e.target.checked})}/>iOS downloads enabled</label><T k="maintenance" l="Maintenance mode"/>
  <label>Accent color</label><input type="color" value={s.accent||'#5b6cff'} onChange={e=>setS({...s,accent:e.target.value})}/>
  <p className={msg.includes('ailed')?'err':'okc'}>{msg}</p><button className="btn" onClick={save}>Save changes</button></div>
}

const imgOk=f=>['image/png','image/jpeg','image/webp','image/x-icon','image/vnd.microsoft.icon'].includes(f.type)&&f.size<=5*1048576
async function putImg(bucket,key,file){const path=`${key}/${Date.now()}-${file.name.replace(/[^\w.-]/g,'_')}`;const{error}=await sb.storage.from(bucket).upload(path,file,{contentType:file.type});if(error)throw error;return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl}
function ImgSlot({k,label}){const[u,setU]=useState(''),[m,setM]=useState('')
 useEffect(()=>{sb.from('app_settings').select('value').eq('key',k).maybeSingle().then(r=>setU(r.data?.value||''))},[])
 async function pick(f){if(!f)return;if(!imgOk(f))return setM('Use PNG, JPG or WEBP, max 5 MB.');setM('Uploading…')
  try{const url=await putImg('website-assets',k,f);const{error}=await sb.from('app_settings').upsert({key:k,value:url});if(error)throw error;setU(url);setM('Saved.');log('image set',k)}catch(e){setM('Failed: '+e.message)}}
 async function clear(){await sb.from('app_settings').upsert({key:k,value:''});setU('');setM('Removed.');log('image removed',k)}
 return<div style={{marginBottom:18}}><label>{label}</label>{u&&<img src={u} alt="" style={{maxHeight:90,borderRadius:12,display:'block',margin:'0 0 8px'}}/>}<input type="file" accept="image/*" onChange={e=>pick(e.target.files[0])}/>{u&&<button className="btn" type="button" onClick={clear}>Remove</button>}<span className="mu"> {m}</span></div>}
function Shots(){const[rows,setR]=useState([]),[pf,setPf]=useState('android'),[m,setM]=useState('')
 const load=()=>sb.from('app_screenshots').select('*').order('sort').then(r=>setR(r.data||[]));useEffect(()=>{load()},[])
 async function add(f){if(!f)return;if(!imgOk(f))return setM('Use PNG, JPG or WEBP, max 5 MB.');setM('Uploading…')
  try{const url=await putImg('app-screenshots','shot',f);const{error}=await sb.from('app_screenshots').insert({url,platform:pf,sort:rows.length});if(error)throw error;setM('Added.');log('screenshot added');load()}catch(e){setM('Failed: '+e.message)}}
 async function del(r){if(!confirm('Delete this screenshot?'))return;await sb.from('app_screenshots').delete().eq('id',r.id);log('screenshot deleted');load()}
 return<div className="card"><h3>Screenshots</h3><div className="row">{rows.map(r=><div key={r.id}><img src={r.url} alt="" style={{height:120,borderRadius:14,display:'block'}}/><button className="btn" onClick={()=>del(r)}>Delete</button></div>)}</div>
  <label>Add screenshot</label><select className="in" value={pf} onChange={e=>setPf(e.target.value)}><option value="android">Android</option><option value="ios">iOS</option></select><input type="file" accept="image/*" onChange={e=>add(e.target.files[0])}/><p className={m.startsWith('Failed')||m.startsWith('Use')?'err':'okc'}>{m}</p></div>}
function Rows({table,title,fields}){const[rows,setR]=useState([]),[f,setF]=useState({}),[m,setM]=useState('')
 const load=()=>sb.from(table).select('*').order('sort').then(r=>setR(r.data||[]));useEffect(()=>{load()},[])
 async function add(e){e.preventDefault();if(f.url&&!/^https?:\/\//.test(f.url))return setM('Link must start with https://');const{error}=await sb.from(table).insert({...f,sort:rows.length});if(error)return setM(error.message);setF({});setM('');log('added',table);load()}
 async function del(r){if(!confirm('Delete?'))return;await sb.from(table).delete().eq('id',r.id);log('deleted',table);load()}
 return<div className="card"><h3>{title}</h3>{rows.map(r=><p key={r.id}>{fields.map(([k])=>r[k]).join(' — ')} <button className="btn" onClick={()=>del(r)}>Delete</button></p>)}
  <form onSubmit={add}>{fields.map(([k,l,ta])=><div key={k}><label>{l}</label>{ta?<textarea className="in" required value={f[k]||''} onChange={e=>setF({...f,[k]:e.target.value})}/>:<input className="in" required value={f[k]||''} onChange={e=>setF({...f,[k]:e.target.value})}/>}</div>)}<p className="err">{m}</p><button className="btn">Add</button></form></div>}
function Customize(){return<><div className="card"><h3>Images</h3><ImgSlot k="logo_url" label="Logo (replaces the animated icon)"/><ImgSlot k="hero_image_url" label="Home banner / hero image"/><ImgSlot k="favicon_url" label="Favicon"/><ImgSlot k="og_image_url" label="Social share image (Open Graph)"/></div>
 <Shots/><Rows table="app_features" title="Features" fields={[['title','Title'],['description','Description',1]]}/><Rows table="faq_items" title="FAQ" fields={[['question','Question'],['answer','Answer',1]]}/><Rows table="social_links" title="Social links" fields={[['label','Name'],['url','Link (https://…)']]}/></>}
export default function Admin(){
 const[st,setSt]=useState('load'),[tab,setTab]=useState('o'),[ov,setOv]=useState(0)
 async function check(){
  const{data:{session}}=await sb.auth.getSession();if(!session)return setSt('login')
  const{data:a}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();if(a.currentLevel!=='aal2')return setSt('login')
  const{data}=await sb.from('admin_profiles').select('id').maybeSingle()
  if(!data){await sb.auth.signOut();return setSt('denied')};setSt('in')}
 useEffect(()=>{ok?check():setSt('cfg')},[])
 if(st==='load')return<p className="w mu">Loading…</p>
 if(st==='cfg')return<div className="w"><p className="err">Supabase is not configured (.env).</p></div>
 if(st==='denied')return<div className="w"><div className="card" style={{marginTop:60}}><h3>Not authorized</h3><p className="mu">This account is not an administrator.</p><a href="#/">Back to site</a></div></div>
 if(st==='login')return<Login onDone={check}/>
 return<div className="w a3"><div className="nav"><Logo size={36}/><b>Admin</b><a href="#/">View site</a><button className="btn" onClick={async()=>{await sb.auth.signOut();setSt('login')}}>Sign out</button></div>
  <div className="tabs">{[['o','Overview'],['r','Releases'],['c','Content & settings'],['m','Images & sections']].map(([k,l])=><button key={k} className={'btn '+(tab===k?'on':'')} onClick={()=>{setTab(k);if(k==='o')setOv(x=>x+1)}}>{l}</button>)}</div>
  <div style={{display:tab==='o'?'block':'none'}}><Overview key={ov}/></div><div style={{display:tab==='r'?'block':'none'}}><Releases/></div><div style={{display:tab==='c'?'block':'none'}}><Content/></div><div style={{display:tab==='m'?'block':'none'}}><Customize/></div></div>
}
