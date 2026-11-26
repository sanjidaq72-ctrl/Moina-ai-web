import {createContext,useContext} from 'react'
export const LogoCtx=createContext('')
export default function Logo({size=120}){const u=useContext(LogoCtx);if(u)return<img src={u} width={size} height={size} alt="MOiNA AI" style={{objectFit:'contain',borderRadius:size/4}}/>
 return<svg className="logo" width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="MOiNA AI">
<defs><radialGradient id="lg" cx="35%" cy="30%"><stop offset="0" stopColor="#fff"/><stop offset=".55" stopColor="#e9edf2"/><stop offset="1" stopColor="#c5cad3"/></radialGradient>
<linearGradient id="ag" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7b8bff"/><stop offset="1" stopColor="#4de0ff"/></linearGradient></defs>
<circle className="glow" cx="60" cy="60" r="54" fill="url(#ag)"/>
<circle cx="60" cy="60" r="46" fill="url(#lg)"/>
<circle className="ring" cx="60" cy="60" r="54" fill="none" stroke="url(#ag)" strokeWidth="3" strokeDasharray="70 270" strokeLinecap="round"/>
<path className="spark" d="M60 28L67 53L92 60L67 67L60 92L53 67L28 60L53 53Z" fill="url(#ag)"/>
</svg>}
