// خرائط جوه المنصة (من غير ما نفتح خرائط جوجل): مكتبة Leaflet من cdnjs + خريطة TomTom وطبقة الزحمة اللايف (حساب مجاني، نوفمبر 2026).
// TomTom المجاني: ~50 ألف جزء خريطة و2,500 حساب مسار في اليوم. المفتاح ده بيبان في الصفحة عادي (زي أي مفتاح خرائط)؛ اقفله على
// الدومين من my.tomtom.com ← Keys ← Domain whitelist = mhmadrgab.github.io. لو TomTom وقع بنرجع لـ OpenStreetMap لوحده.
// المكتبة بتتحمّل أول مرة بس حد يفتح خريطة، ومعاها بصمة (integrity) علشان محدش يقدر يبدّلها.
const V="1.9.4",CDN=`https://cdnjs.cloudflare.com/ajax/libs/leaflet/${V}/`;
const SRI_JS="sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g==";
const SRI_CSS="sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw==";
let ready=null;
export function leaflet(){
 if(window.L&&window.L.map)return Promise.resolve(window.L);
 if(ready)return ready;
 ready=new Promise((res,rej)=>{
  if(!document.getElementById("lf-css")){const l=document.createElement("link");l.id="lf-css";l.rel="stylesheet";l.href=CDN+"leaflet.min.css";l.integrity=SRI_CSS;l.crossOrigin="anonymous";document.head.appendChild(l)}
  const s=document.createElement("script");s.src=CDN+"leaflet.min.js";s.integrity=SRI_JS;s.crossOrigin="anonymous";
  s.onload=()=>window.L&&window.L.map?res(window.L):(ready=null,rej(new Error("leaflet")));
  s.onerror=()=>{ready=null;s.remove();rej(new Error("leaflet"))};// لا يوجد نت: نحاول مجدداً المرة الجاية
  document.head.appendChild(s);
 });
 return ready;
}
const TT="EKvqbvD3N1wXR53fTP5Ti4XF6lB4BOKX",TTA='&copy; <a href="https://www.tomtom.com" target="_blank" rel="noopener noreferrer">TomTom</a>';
const dark=()=>!!(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);
const lsG=k=>{try{return localStorage.getItem(k)}catch(e){return null}},lsS=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
// خريطة جديدة جوه عنصر (المركز الافتراضي الرياض إلى ما نعرف الأماكن) + زرار 🚦 الزحمة (بيتفتكر)
export function baseMap(L,el){
 const m=L.map(el,{zoomControl:true,attributionControl:true,scrollWheelZoom:true}).setView([24.71,46.68],11);
 const base=L.tileLayer(`https://api.tomtom.com/map/1/tile/basic/${dark()?"night":"main"}/{z}/{x}/{y}.png?key=${TT}&tileSize=256&language=ar`,{maxZoom:20,attribution:TTA}).addTo(m);
 // TomTom لم يتم (المفتاح اتقفل أو الحد خلص): نرجع لـ OpenStreetMap
 let bad=0;base.on("tileerror",()=>{if(++bad===6){m.removeLayer(base);if(dark())el.classList.add("tz-dark");L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'}).addTo(m)}});
 // الزحمة اللايف (أخضر = ماشي، أصفر/أحمر = زحمة)
 const tr=L.tileLayer(`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TT}&tileSize=256`,{maxZoom:20,opacity:.85,zIndex:5});
 if(lsG("tz_traffic")!=="0")tr.addTo(m);
 const C=L.Control.extend({options:{position:"topleft"},onAdd(){const b=L.DomUtil.create("button","tz-trf");b.type="button";const paint=()=>{b.textContent=m.hasLayer(tr)?"🚦 الزحام: ظاهر":"🚦 الزحام: مخفي";b.classList.toggle("off",!m.hasLayer(tr))};paint();
  L.DomEvent.on(b,"click",e=>{L.DomEvent.stop(e);if(m.hasLayer(tr)){m.removeLayer(tr);lsS("tz_traffic","0")}else{tr.addTo(m);lsS("tz_traffic","1")}paint()});L.DomEvent.disableClickPropagation(b);return b}});
 new C().addTo(m);
 return m;
}
// المسار على الطريق الحقيقي + الوقت بالزحمة حالياً (TomTom Routing). pts = [{lat,lng},...] بالترتيب (إلى 25 نقطة).
// النتيجة بتتحفظ على الجهاز علشان مانصرفش من الحد اليومي على نفس المسار: {path:[[lat,lng]], sec, m, delay}
const RC=new Map();
export async function roadRoute(pts,maxAgeMin=10){
 pts=(pts||[]).filter(okPt).slice(0,25);if(pts.length<2)return null;
 const key=pts.map(p=>(+p.lat).toFixed(4)+","+(+p.lng).toFixed(4)).join(":"),c=RC.get(key);
 if(c&&Date.now()-c.at<maxAgeMin*6e4)return c.r;
 try{
  const r=await fetch(`https://api.tomtom.com/routing/1/calculateRoute/${key}/json?key=${TT}&traffic=true&routeType=fastest&travelMode=car`);
  if(!r.ok)return null;const j=await r.json(),rt=j&&j.routes&&j.routes[0];if(!rt)return null;
  const out={path:rt.legs.flatMap(l=>l.points.map(p=>[p.latitude,p.longitude])),sec:rt.summary.travelTimeInSeconds,m:rt.summary.lengthInMeters,delay:rt.summary.trafficDelayInSeconds||0,legs:rt.legs.map(l=>l.summary.travelTimeInSeconds)};
  RC.set(key,{at:Date.now(),r:out});if(RC.size>80)RC.delete(RC.keys().next().value);return out;
 }catch(e){return null}
}
// حركة ناعمة للعلامة من مكانها لمكان جديد (بدل ما تنط)
export function glide(mk,to,ms=1500){
 const a=mk.getLatLng(),b={lat:+to.lat,lng:+to.lng};if(!a||(Math.abs(a.lat-b.lat)<1e-6&&Math.abs(a.lng-b.lng)<1e-6))return;
 if(mk._gl)cancelAnimationFrame(mk._gl);const t0=performance.now();
 const step=t=>{const k=Math.min(1,(t-t0)/ms),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;mk.setLatLng([a.lat+(b.lat-a.lat)*e,a.lng+(b.lng-a.lng)*e]);if(k<1)mk._gl=requestAnimationFrame(step);else mk._gl=0};
 mk._gl=requestAnimationFrame(step);
}
// علامة HTML (من غير صور): مركزها على النقطة بالظبط
export const pin=(L,html)=>L.divIcon({className:"tz-pin",html:`<div class="tz-in">${html}</div>`,iconSize:[0,0],iconAnchor:[0,0],popupAnchor:[0,-18],tooltipAnchor:[0,-16]});
export const okPt=p=>!!(p&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lng)&&!(+p.lat===0&&+p.lng===0));
export const MAP_CSS=`
.tz-map{background:var(--card);border-radius:16px;padding:10px;margin-bottom:12px;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.tz-mapc{height:380px;border-radius:12px;overflow:hidden;background:#dfe3e6;z-index:0;position:relative}
@media (max-width:600px){.tz-mapc{height:300px}}
.tz-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--mut);margin-top:8px}.tz-bar .bt{width:auto}
.tz-dark .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.92) contrast(.9)}
.tz-trf{font:700 12.5px "IBM Plex Sans Arabic",Tahoma,sans-serif;background:#fff;color:#1b1b1b;border:2px solid rgba(0,0,0,.2);border-radius:8px;padding:5px 9px;cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,.2)}.tz-trf.off{opacity:.75}
.tz-pin{background:none;border:0}
.tz-in{position:absolute;left:0;top:0;transform:translate(-50%,-50%);white-space:nowrap;display:flex;flex-direction:column;align-items:center;gap:2px;font:600 12px/1.2 "IBM Plex Sans Arabic",Tahoma,sans-serif}
.tz-d b{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#6a56c9;color:#fff;font-size:18px;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)}
.tz-d.old b{background:#8d8a85}
.tz-d span,.tz-s span{background:rgba(27,27,27,.85);color:#fff;border-radius:8px;padding:2px 7px}
.tz-w{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#1b1b1b;border:2px solid #d4ae5c;font-size:17px;box-shadow:0 2px 6px rgba(0,0,0,.3)}
.tz-b{background:#fff;color:#1b1b1b;border:2px solid #a8832f;border-radius:999px;padding:1px 7px;font-size:11.5px;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.tz-b.nx{background:#d4ae5c;border-color:#1b1b1b;font-size:13px;padding:2px 9px}
.tz-s b{display:grid;place-items:center;min-width:26px;height:26px;padding:0 6px;border-radius:13px;background:#2f8f3e;color:#fff;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35);font-size:13px}
.tz-s.wait b{background:#8d8a85}.tz-s.pk b{background:#1c4f86}.tz-s.st b{background:#1b1b1b}.tz-s.end b{background:#c4362b}
.leaflet-popup-content{direction:rtl;text-align:right;font:14px/1.6 "IBM Plex Sans Arabic",Tahoma,sans-serif;margin:10px 14px}
.leaflet-container{font-family:"IBM Plex Sans Arabic",Tahoma,sans-serif}
`;
