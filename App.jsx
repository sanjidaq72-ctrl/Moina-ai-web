import {useEffect,useState} from 'react'
import {sb,ok} from './supabase'
import Admin from './Admin'
import Logo,{LogoCtx} from './Logo'
import './styles.css'
const fmt=b=>b?(b/1048576).toFixed(1)+' MB':'—'
const useHash=()=>{const[h,s]=useState(location.hash||'#/');useEffect(()=>{const f=()=>{s(location.hash||'#/');scrollTo(0,0)};addEventListener('hashchange',f);return()=>removeEventListener('hashchange',f)},[]);return h}
function useSite(){
 const[d,setD]=useState({c:{},s:{},rel:[],feat:[],faq:[],soc:[],shots:[]}),[err,setErr]=useState('')
 useEffect(()=>{
  if(!ok){setErr('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');return}
  const q=t=>sb.from(t).select('*')
  Promise.all([q('website_content'),q('app_settings'),q('app_releases').eq('is_published',true).order('released_at',{ascending:false}),
   q('app_features').order('sort'),q('faq_items').order('sort'),q('social_links').order('sort'),q('app_screenshots').order('sort')]).then(r=>{
   const e=r.find(x=>x.error);if(e)return setErr(e.error.message)
   const m=x=>Object.fromEntries(x.data.map(i=>[i.key,i.value]))
   setD({c:m(r[0]),s:m(r[1]),rel:r[2].data,feat:r[3].data,faq:r[4].data,soc:r[5].data,shots:r[6].data})})
  sb.from('download_statistics').insert({platform:'web',event:'visit'}).then(()=>{})
 },[])
 return{...d,err}
}
function Download({site,platform}){
 const{s,rel}=site,[p,setP]=useState(null),[msg,setMsg]=useState('')
 const list=rel.filter(r=>r.platform===platform),r=list.find(x=>x.is_latest)||list[0]
 const enabled=s[platform+'_enabled']!==false
 async function go(){
  setMsg('');setP(0)
  if(platform==='ios'){const u=r?.store_url||r?.testflight_url;if(!u){setP(null);return}
   await sb.from('download_statistics').insert({release_id:r.id,platform:'ios',event:'request'});setP(null);open(u,'_blank','noopener');return}
  if(!r.file_path){await sb.from('download_statistics').insert({release_id:r.id,platform:'android',event:'request'});setP(null);open(r.store_url,'_blank','noopener');return}
  try{
   await sb.from('download_statistics').insert({release_id:r.id,platform:'android',event:'request'})
   const{data,error}=await sb.storage.from('app-releases').createSignedUrl(r.file_path,120)
   if(error)throw error
   const res=await fetch(data.signedUrl);if(!res.ok)throw new Error('Download failed ('+res.status+')')
   const tot=+res.headers.get('content-length')||r.file_size,rd=res.body.getReader(),ch=[];let got=0
   for(;;){const{done,value}=await rd.read();if(done)break;ch.push(value);got+=value.length;setP(Math.round(got/tot*100))}
   const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(ch));a.download=`MOiNA-AI-${r.version}.apk`;a.click()
   await sb.from('download_statistics').insert({release_id:r.id,platform:'android',event:'completed'})
   setMsg('Download finished.')
  }catch(e){setMsg('Could not download: '+e.message)}
  setP(null)
 }
 const label=platform==='android'?'Android':'iOS'
 if(!enabled||!r||(platform==='ios'&&!(r.store_url||r.testflight_url))||(platform==='android'&&!r.file_path&&!r.store_url))return<div className="card"><h3>{label}</h3><p className="mu">Coming soon.</p></div>
 return<div className="card"><h3>{label}</h3><p className="mu">Version {r.version} · {platform==='android'?fmt(r.file_size)+' · ':''}{new Date(r.released_at).toLocaleDateString()}{r.min_os&&` · Requires ${r.min_os}`}</p>
  <p style={{whiteSpace:'pre-wrap'}}>{r.notes}</p>
  <button className="btn" disabled={p!==null} onClick={go}>{p!==null?`Downloading ${p}%`:platform==='ios'?'Open on iOS':'Download APK'}</button>
  {p!==null&&<div className="bar" style={{marginTop:14}}><i style={{width:p+'%'}}/></div>}{msg&&<p className={msg.startsWith('Could')?'err':'okc'}>{msg}</p>}</div>
}
const Page=({t,text})=><div className="card"><h2>{t}</h2><p style={{whiteSpace:'pre-wrap'}}>{text||'Nothing published yet.'}</p></div>
function Welcome(){
 const[st,setSt]=useState(()=>{try{return sessionStorage.getItem('w')||location.hash.startsWith('#/admin')?'gone':'on'}catch{return'on'}})
 const done=()=>{try{sessionStorage.setItem('w','1')}catch{};setSt('out');setTimeout(()=>setSt('gone'),700)}
 useEffect(()=>{if(st!=='on')return;const t=setTimeout(done,2800);return()=>clearTimeout(t)},[])
 if(st==='gone')return null
 return<div className={'welcome '+(st==='out'?'out':'')} onClick={done}><Logo size={150}/><h1>MOiNA AI</h1><p className="mu">Welcome. Your intelligent AI companion.</p><div className="wbar"><i/></div></div>
}
export default function App(){
 const h=useHash(),site=useSite(),{c,s}=site
 useEffect(()=>{document.title=c.seo_title||c.site_title||'MOiNA AI';if(s.accent)document.documentElement.style.setProperty('--ac',s.accent)
  if(s.favicon_url){let l=document.querySelector('link[rel="icon"]');if(!l){l=document.createElement('link');l.rel='icon';document.head.appendChild(l)}l.href=s.favicon_url}
  if(s.og_image_url){let m=document.querySelector('meta[property="og:image"]');if(!m){m=document.createElement('meta');m.setAttribute('property','og:image');document.head.appendChild(m)}m.content=s.og_image_url}},[c,s])
 if(h.startsWith('#/admin'))return<Admin/>
 if(s.maintenance===true)return<div className="w"><div className="card" style={{marginTop:60}}><h2>We'll be back soon</h2><p className="mu">The site is under maintenance.</p></div></div>
 const latest=site.rel.find(r=>r.platform==='android'&&r.is_latest)
 let body
 if(h==='#/download')body=<><h2>Download MOiNA AI</h2><div className="grid"><Download site={site} platform="android"/><Download site={site} platform="ios"/></div></>
 else if(h==='#/versions')body=<div className="card"><h2>Version history</h2>{site.rel.length?<table><tbody>{site.rel.map(r=><tr key={r.id}><td>{r.platform}</td><td>{r.version}</td><td>{new Date(r.released_at).toLocaleDateString()}</td><td style={{whiteSpace:'pre-wrap'}}>{r.notes}</td></tr>)}</tbody></table>:<p className="mu">No releases yet.</p>}</div>
 else if(h.startsWith('#/page/')){const k=h.slice(7);body=<Page t={{about:'About',privacy:'Privacy Policy',terms:'Terms and Conditions',support_contact:'Support and Contact'}[k]||'Page'} text={c[k]}/>}
 else body=<>
  <div className="hero"><div><h1>{c.hero_title||'MOiNA AI'}</h1><p className="mu">{c.hero_subtitle}</p><p>{c.description}</p>
   <div className="row"><a className="btn" href="#/download">Download</a>{latest&&<span className="mu">Latest: v{latest.version}</span>}</div></div>
   <div style={{display:"grid",placeItems:"center"}}>{s.hero_image_url?<img src={s.hero_image_url} alt="" style={{maxWidth:"100%",borderRadius:28}}/>:<Logo size={200}/>}</div></div>
  {site.err&&<p className="err">{site.err}</p>}
  {site.feat.length>0&&<><h2>Features</h2><div className="grid">{site.feat.map(f=><div className="card" key={f.id}><h3>{f.title}</h3><p className="mu">{f.description}</p></div>)}</div></>}
  {site.shots.length>0&&<><h2>Screenshots</h2><div className="grid">{site.shots.map(x=><img key={x.id} src={x.url} alt="" loading="lazy" style={{width:'100%',borderRadius:20}}/>)}</div></>}
  {latest?.notes&&<div className="card"><h2>What's new in v{latest.version}</h2><p style={{whiteSpace:'pre-wrap'}}>{latest.notes}</p></div>}
  {site.faq.length>0&&<div className="card"><h2>FAQ</h2>{site.faq.map(f=><details key={f.id}><summary><b>{f.question}</b></summary><p className="mu">{f.answer}</p></details>)}</div>}</>
 return<LogoCtx.Provider value={s.logo_url||''}><Welcome/><div className="w"><div className="nav"><Logo size={36}/><b>{c.site_title||'MOiNA AI'}</b><a href="#/">Home</a><a href="#/download">Download</a><a href="#/versions">Versions</a><a href="#/page/about">About</a><a href="#/page/support_contact">Support</a></div>
  {body}<footer className="mu"><p>{c.footer_text}</p><p>{site.soc.map(l=><a key={l.id} href={l.url} rel="noopener" style={{margin:'0 8px'}}>{l.label}</a>)}</p>
  <p><a href="#/page/privacy">Privacy</a> · <a href="#/page/terms">Terms</a></p><p style={{fontSize:'.7rem'}}><a className="mu" href="#/admin">Admin login</a></p></footer></div></LogoCtx.Provider>
}
