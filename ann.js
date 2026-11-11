// 📢 التعميمات (نوفمبر 2026، طلب محمد): "جروب" فيه المستودع والمدير وكل الفروع. المالك والمديرين بيبعتوا، والكل بيشوف.
// ann/{id} = {t: النص, by: إيميل اللي بعت, n: اسمه, ts}. ann/{id}/rd/{الطرف} = {ts, n} قرأها إمتى (الطرف = كود الفرع أو الإيميل)
// الإشعار لكل الأجهزة من السيرفر (/ann) على دفعات (annPush في fb.js). العلامة الحمرا على الزرار = جديد من آخر مرة فتحت (على الجهاز ده).
import {collection,doc,addDoc,setDoc,getDoc,getDocs,deleteDoc,onSnapshot,query,orderBy,limit,withTimeout,failReason,FAIL_MSG,annPush} from "./fb.js";
const g=id=>document.getElementById(id);
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const LS="ann_seen";
let X=null,UN=null,A=[],CNT={},RDU=null,busy=false;
const CSS=`
#annb{font:inherit;font-weight:800;font-size:14px;border:0;border-radius:999px;padding:8px 14px;background:linear-gradient(135deg,#f1d58e,#a8832f);color:#1b1b1b;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;position:relative}
#annb i{font-style:normal;background:#c0392b;color:#fff;border-radius:999px;min-width:20px;padding:0 6px;font-size:12px;line-height:20px}
#annb.nw{animation:ann-ring 1.8s ease-in-out infinite}@keyframes ann-ring{0%,100%{transform:rotate(0)}8%{transform:rotate(-8deg)}16%{transform:rotate(8deg)}24%{transform:rotate(0)}}
#annm{display:none;position:fixed;inset:0;z-index:86;background:rgba(0,0,0,.55);padding:14px;overflow:auto;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}#annm.on{display:block}
.annk{max-width:640px;margin:3vh auto;background:var(--card);color:var(--ink);border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.annh{display:flex;align-items:center;gap:12px;padding:16px 20px;background:linear-gradient(120deg,#2b2416,#1b1b1b);color:#fff;border-bottom:3px solid #d4ae5c}
.annh b{font-size:19px;display:block}.annh small{color:#cdb67a;font-size:12.5px}.annh button{margin-inline-start:auto;font:inherit;background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:10px;width:38px;height:38px;cursor:pointer;font-size:17px}
.annc{padding:14px 18px;border-bottom:1px solid var(--line);background:var(--soft,#f6f2e9)}
.annc textarea{width:100%;min-height:90px;resize:vertical;font:inherit;font-size:16px;line-height:1.6;border-radius:14px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);padding:10px 14px}
.annc .row{display:flex;gap:8px;align-items:center;margin-top:8px}.annc .row small{color:var(--mut);font-size:12.5px;flex:1}
.annc button{font:inherit;font-weight:800;border:0;border-radius:12px;padding:10px 18px;background:#1b1b1b;color:#fff;cursor:pointer}.annc button:disabled{opacity:.5}
.annl{padding:12px 18px 18px;max-height:62vh;overflow:auto}
.anni{border-radius:16px;padding:12px 16px;margin-top:10px;background:var(--card);border:1.5px solid var(--line);border-inline-start:5px solid #d4ae5c}
.anni.nw{background:#fff8e6}.anni .hd2{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--mut)}.anni .hd2 b{color:var(--ink);font-size:14.5px}
.anni .tx{white-space:pre-wrap;word-wrap:break-word;font-size:16px;line-height:1.7;margin-top:6px}
.anni .rd{margin-top:8px;font-size:12.5px;color:#1d6fb8;font-weight:700;cursor:pointer}
.rdrow{display:flex;align-items:center;gap:10px;margin-top:8px}.rdrow .rd{margin-top:0}
.anndel{margin-inline-start:auto;font:inherit;font-size:12.5px;font-weight:800;border:1px solid #e3b4ad;background:transparent;color:#c0392b;border-radius:10px;padding:4px 12px;cursor:pointer}.anndel:hover{background:#c0392b;color:#fff}
#annp{display:none;position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.6);padding:14px;overflow:auto;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}#annp.on{display:flex;align-items:center;justify-content:center}
.annpk{width:100%;max-width:560px;margin:0}.annpk.pop{animation:ann-pop .42s cubic-bezier(.2,.9,.3,1.25)}@keyframes ann-pop{from{opacity:0;transform:translateY(24px) scale(.92)}to{opacity:1;transform:none}}
.annpb{padding:18px 22px 22px;max-height:60vh;overflow:auto}.annpb .tx{white-space:pre-wrap;word-wrap:break-word;font-size:18px;line-height:1.8}
.annpn{margin-top:14px;font-size:13px;color:var(--mut);font-weight:700}
.annrd{margin-top:6px;font-size:12.5px;color:var(--mut);line-height:1.9}
.anne{text-align:center;color:var(--mut);padding:30px 10px;line-height:2}
.annc .pic{background:transparent;color:var(--ink);border:1.5px solid var(--line)}
.annpv{position:relative;margin-top:10px;border-radius:14px;overflow:hidden;background:#111;max-height:260px;display:flex;justify-content:center}
.annpv img{max-width:100%;max-height:260px;display:block}.annpv button{position:absolute;top:8px;inset-inline-end:8px;width:34px;height:34px;padding:0;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:15px}
.annpv small{position:absolute;bottom:6px;inset-inline-start:8px;background:rgba(0,0,0,.6);color:#fff;border-radius:8px;padding:2px 8px;font-size:11.5px}
.annimg{display:block;width:100%;margin-top:10px;padding:0;border:0;border-radius:14px;overflow:hidden;cursor:zoom-in;background:#1b1b1b url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='14' fill='none' stroke='%23d4ae5c' stroke-width='3' stroke-dasharray='60 30'/%3E%3C/svg%3E") center/42px no-repeat;max-height:70vh}
.annimg img{width:100%;height:100%;object-fit:contain;display:block;opacity:0;transition:opacity .3s}.annimg img.ok{opacity:1}
.annpb .annimg{margin:0 0 14px}
#anniv{display:none;position:fixed;inset:0;z-index:99;background:rgba(0,0,0,.94);flex-direction:column}#anniv.on{display:flex}
#anniv .t{display:flex;gap:10px;align-items:center;padding:12px 14px;color:#fff}#anniv .t b{flex:1;font-size:15px}
#anniv .t a,#anniv .t button{font:inherit;font-weight:800;font-size:14px;border:0;border-radius:10px;padding:8px 14px;background:rgba(255,255,255,.14);color:#fff;cursor:pointer;text-decoration:none}
#anniv .v{flex:1;display:flex;align-items:center;justify-content:center;overflow:auto;padding:8px}#anniv .v img{max-width:100%;max-height:100%;object-fit:contain}
#anniv .l{color:#cdb67a;text-align:center;padding:6px;font-size:13px}
.annc .bgt[aria-pressed="true"]{background:linear-gradient(135deg,#d9b25f,#a8832f);color:#1b1b1b;border-color:transparent}
/* وانت بتكتب على خلفية تاسومة: خانة الكتابة جوه الكارت نفسه، فبتشوف البوست كامل زي ما هيوصل بالظبط */
.annc .annbgc{margin-top:0;cursor:text}
.annc .annbgc textarea{position:relative;width:100%;min-height:0;height:auto;margin:0;padding:4px 0;border:0;border-radius:0;background:transparent;color:#fff;text-align:center;font-family:inherit;font-weight:800;line-height:1.55;resize:none;overflow:hidden;text-shadow:0 2px 12px rgba(0,0,0,.5);box-shadow:none;outline:none}
.annc .annbgc textarea:focus{box-shadow:none;outline:none}
.annc .annbgc textarea::placeholder{color:#cdb67a;opacity:.85;font-weight:700;font-size:18px}
.annbgc .cnt{position:absolute;bottom:8px;inset-inline-start:12px;color:#cdb67a;font-size:11px;opacity:.8}
.annbg{position:relative;overflow:hidden;margin-top:10px;border-radius:16px;min-height:300px;padding:26px 22px 22px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:14px;text-align:center;color:#fff;
  background:radial-gradient(circle at 18% 12%,rgba(212,174,92,.28),transparent 45%),radial-gradient(circle at 85% 90%,rgba(212,174,92,.2),transparent 50%),linear-gradient(140deg,#151515,#2b2416 55%,#151515);border:2px solid #d4ae5c;box-shadow:inset 0 0 0 6px rgba(212,174,92,.08)}
.annbg .wm{position:absolute;inset:0;margin:auto;width:78%;max-width:340px;height:auto;fill:#d4ae5c;opacity:.08;pointer-events:none}
.annbg .hd3{position:relative;display:flex;align-items:center;gap:8px;color:#d4ae5c;font-weight:800;letter-spacing:4px;font-size:13px;direction:ltr}.annbg .hd3 svg{width:30px;height:30px;fill:#d4ae5c}
.annbg .abt{position:relative;white-space:pre-wrap;word-wrap:break-word;font-weight:800;line-height:1.55;text-shadow:0 2px 12px rgba(0,0,0,.5);max-width:100%}
.annbg .abt.s1{font-size:34px}.annbg .abt.s2{font-size:27px}.annbg .abt.s3{font-size:21px}.annbg .abt.s4{font-size:17px;font-weight:700}.annbg .abt.s5{font-size:15px;font-weight:600;line-height:1.75;text-align:start}
.annvo{margin-top:12px}.annvo button{width:100%;font:inherit;font-weight:800;font-size:16px;border:0;border-radius:14px;padding:13px 16px;background:linear-gradient(135deg,#d9b25f,#a8832f);color:#1b1b1b;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 14px rgba(168,131,47,.35)}
.annvo button:disabled{opacity:.7}.annvo small{opacity:.75;font-weight:700}.annvo audio{width:100%;height:46px}
.annvop{display:flex;gap:8px;align-items:center;margin-top:10px;background:var(--card);border:1.5px solid var(--line);border-radius:14px;padding:6px 10px}.annvop audio{flex:1;min-width:0;height:40px}
.annvop button{width:32px;height:32px;padding:0;border-radius:50%;background:#c0392b;color:#fff;font-size:14px;flex:none}
.annc .row{flex-wrap:wrap}.annc .rec{background:#c0392b!important;color:#fff!important;border-color:#c0392b!important;animation:ann-rec 1.2s ease-in-out infinite}.annc .rec small{opacity:.85}@keyframes ann-rec{50%{opacity:.75}}
.annbg .ft{position:relative;width:100%;display:flex;align-items:center;gap:10px;color:#cdb67a;font-size:12px}.annbg .ft::before,.annbg .ft::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,#d4ae5c,transparent)}
.annpb .annbg{margin:0 0 6px}
@media (max-width:480px){.annbg{min-height:260px}.annbg .abt.s1{font-size:28px}.annbg .abt.s2{font-size:23px}}
@media (prefers-color-scheme:dark){.anni.nw{background:#2b2210}}
@media print{#annb,#annm,#annp,#anniv{display:none!important}}
`;
const me=()=>X&&X.party;
// 📷 صورة التعميم (نوفمبر 2026، طلب محمد: إعلان أو تعميم بصورة بجودة عالية جداً). مفيش Storage، فالصورة في مستندين لوحدهم
// علشان قايمة التعميمات تفضل خفيفة: ann/{id}/img/f = {i} الأصلية (لحد 2560 بكسل JPEG بأعلى جودة تدخل في 950 ألف حرف)،
// و ann/{id}/img/t = {i} مصغّرة 720 بكسل للقايمة. على التعميم نفسه img:1, w, h بس. الفرع بيشوف الأصلية في النافذة، والضغط بيكبّرها
// 🎨 خلفية تاسومة (نوفمبر 2026، زي بوست فيسبوك بخلفية): خلفية واحدة ثابتة بهوية المنصة ولوجو الديب، والكلام كبير في النص.
// على التعميم bg:1 (نص بس من غير صورة). مفيش صورة بتترفع: الكارت بيترسم CSS + SVG، فمفيش أي حمل على Firebase
// (نوفمبر 2026: الخلفية بقت الافتراضية من غير زرار. أي تعميم نص من غير صورة = على خلفية تاسومة، حتى القديم)
const WOLF=`<path d="M139.5 87L142.5 88L175.5 130L129 212.5ZM370.5 87L373.5 87L374.5 94L384.5 211L383 213.5L336.5 130ZM197.5 135L314.5 135L314.5 138L249.5 219L250.5 273L259 275.5L262.5 270L262.5 221L269 214.5L305.5 306L290 344.5L267.5 334L281.5 318L282.5 307L268 292.5L262 289.5L247 290.5L230.5 305L230.5 318L244.5 334L225 343.5L222 343.5L219.5 340L206.5 305L242.5 217L247.5 199ZM327.5 141L330.5 143L352 184.5L320 171.5L297.5 179ZM183.5 142L188.5 145L215 179.5L192 171.5L160.5 184ZM192.5 185L233.5 201L232.5 209L211 261.5L201 257.5L175.5 240L154.5 202ZM315.5 186L327 187.5L357 200.5L357.5 203L335.5 242L303 262.5L299.5 259L278.5 202ZM192.5 203L199 202.5L205.5 213L212.5 230L209 237.5L202 236.5L173.5 217L173.5 212L177 208.5ZM312.5 203L326 204.5L335 208.5L339.5 215L334 221.5L320 230.5L308 237.5L304 237.5L300.5 235L299.5 230ZM144.5 213L150.5 219L164.5 244L164.5 248L128.5 308L126 308.5L125.5 247ZM365.5 213L368.5 213L386.5 246L386 308.5L347.5 248ZM174.5 256L205.5 275L194.5 302L194.5 311L214.5 358L249.5 387L249 425.5L165 374.5L127.5 333ZM334.5 257L340.5 259L384.5 334L345 376.5L263 425.5L262.5 387L299.5 356L318.5 309L307.5 274ZM254.5 343L281.5 355L257 375.5L231.5 356L232 353.5Z"/>`;
const bgSize=t=>{const n=[...String(t||"")].length,l=String(t||"").split("\n").length;return n<=40&&l<=3?"s1":n<=110&&l<=5?"s2":n<=260?"s3":n<=500?"s4":"s5"};
const bgCard=a=>`<div class="annbg"><svg class="wm" viewBox="0 0 512 512" aria-hidden="true">${WOLF}</svg><div class="hd3"><svg viewBox="80 60 352 390" aria-hidden="true">${WOLF}</svg>TASOOMA</div><div class="abt ${bgSize(a.t)}" data-notr>${E(a.t)}</div><div class="ft">📢 ${E(a.n||"الإدارة")}</div></div>`;
// خانة الكتابة على الخلفية: الخط بيكبر/يصغر زي البوست النهائي، والطول على قد الكلام، وعدّاد الحروف
function fitBg(){const t=g("annt");if(!t||!t.closest(".annbgc"))return;t.className="abt "+bgSize(t.value);t.style.height="auto";t.style.height=t.scrollHeight+"px";
  const c=g("annn");if(c){const n=[...t.value].length;c.textContent=n?`${n}/1000`:""}}
// جسم التعميم: خلفية تاسومة، أو صورة + نص، أو نص عادي
const bodyOf=a=>`${a.img?`${imgBox(a)}${a.t?`<div class="tx" data-notr>${E(a.t)}</div>`:""}`:a.t?bgCard(a):""}${voBox(a)}`;
// 🎤 تعميم صوتي (نوفمبر 2026، طلب محمد: "في ناس متفهمش عربي"): المدير يسجّل بأي لغة، لحد دقيقتين.
// على التعميم v:1 + d (المدة بالثواني)، والصوت نفسه في ann/{id}/aud/a = {a: data URL} وبيتحمّل بس لما حد يدوس "استمع"
let VO=null,REC=null;const MAXS=120,AUDC={};
const fmtS=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
const voBox=a=>a.v?`<div class="annvo" data-annvo="${E(a.id)}"><button type="button" data-annplay="${E(a.id)}">▶ استمع للتعميم الصوتي <small>${fmtS(N(a.d))}</small></button></div>`:"";
async function playVo(id){
  document.querySelectorAll(`[data-annvo="${id}"] button`).forEach(b=>{b.disabled=true;b.textContent="⏳ تحميل الصوت..."});
  let v=AUDC[id];
  if(!v){try{const s=await withTimeout(getDoc(doc(X.db,"ann",id,"aud","a")),30000);const x=s.exists()&&s.data().a;if(typeof x==="string"&&/^data:audio\//.test(x))v=AUDC[id]=x}catch(e){}}
  document.querySelectorAll(`[data-annvo="${id}"]`).forEach((el,i)=>{el.innerHTML=v?`<audio controls ${i===0?"autoplay":""} src="${v}"></audio>`:`<button type="button" data-annplay="${E(id)}">⚠️ تعذر تحميل الصوت، اضغط للمحاولة مجدداً</button>`});
  const au=document.querySelector(`[data-annvo="${id}"] audio`);if(au)au.onerror=()=>X&&X.toast("هذا الجهاز غير قادر على تشغيل هذا التسجيل");
}
async function recStart(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){X.toast("هذا الجهاز لا يدعم التسجيل الصوتي");return}
  let st;try{st=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){X.toast("لم يُسمح باستخدام الميكروفون. اسمح به من إعدادات المتصفح");return}
  const mt=["audio/webm;codecs=opus","audio/mp4","audio/ogg;codecs=opus"].find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t))||"";
  let mr;try{mr=new MediaRecorder(st,mt?{mimeType:mt,audioBitsPerSecond:32000}:{audioBitsPerSecond:32000})}catch(e){mr=new MediaRecorder(st)}
  const r={mr,st,ch:[],t0:Date.now()};REC=r;
  mr.ondataavailable=e=>{if(e.data&&e.data.size)r.ch.push(e.data)};
  mr.onstop=async()=>{st.getTracks().forEach(t=>t.stop());clearInterval(r.tm);if(REC!==r)return;REC=null;
    const d=Math.max(1,Math.round((Date.now()-r.t0)/1000)),blob=new Blob(r.ch,{type:(mr.mimeType||mt||"audio/webm").split(";")[0]});
    const url=await new Promise(ok=>{const fr=new FileReader();fr.onload=()=>ok(String(fr.result||""));fr.onerror=()=>ok("");fr.readAsDataURL(blob)});
    if(!url||url.length>1000000){X&&X.toast("التسجيل طويل جداً، سجّل رسالة أقصر");paint();return}
    VO={a:url,d};paint()};
  mr.start(1000);
  r.tm=setInterval(()=>{const s=(Date.now()-r.t0)/1000,b=document.querySelector("[data-annrec]");if(b)b.innerHTML=`⏹ إيقاف التسجيل <small>${fmtS(s)} / ${fmtS(MAXS)}</small>`;if(s>=MAXS&&mr.state!=="inactive")mr.stop()},500);
  paint();
}
function recStop(){if(REC&&REC.mr.state!=="inactive")REC.mr.stop()}
let PIC=null;const IMG={};// PIC = الصورة المختارة قبل الإرسال، IMG = اللي اتحمّل {id:{t,f}}
const loadEl=f=>new Promise((ok,no)=>{const u=URL.createObjectURL(f),i=new Image();i.onload=()=>ok({i,u});i.onerror=()=>{URL.revokeObjectURL(u);no(new Error("img"))};i.src=u});
function jpg(im,max,q){const s=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.max(1,Math.round(im.naturalWidth*s)),h=Math.max(1,Math.round(im.naturalHeight*s));
  const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,w,h);x.imageSmoothingQuality="high";x.drawImage(im,0,0,w,h);return {d:c.toDataURL("image/jpeg",q),w,h}}
async function encode(file){
  const {i,u}=await loadEl(file);
  try{let best=null;
    // أعلى مقاس وجودة تدخل في الحد: نبدأ 2560 بجودة 0.95 وننزل بالراحة
    for(const mx of [2560,2048,1600,1280]){for(const q of [.95,.9,.85,.8,.74]){const r=jpg(i,mx,q);if(r.d.length<=950000){best=r;break}}if(best)break}
    if(!best)throw new Error("big");
    const t=jpg(i,720,.8);return {f:best.d,t:t.d,w:best.w,h:best.h};
  }finally{URL.revokeObjectURL(u)}
}
async function getImg(id,k){
  IMG[id]=IMG[id]||{};if(IMG[id][k])return IMG[id][k];
  try{const s=await withTimeout(getDoc(doc(X.db,"ann",id,"img",k)),25000);const v=s.exists()&&s.data().i;if(typeof v==="string"&&/^data:image\/jpeg;base64,/.test(v))IMG[id][k]=v}catch(e){}
  return IMG[id][k]||"";
}
// يحط الصورة في كل مكان ظاهرة فيه (القايمة أو نافذة الفرع)
async function fillImg(id,k){const v=await getImg(id,k);document.querySelectorAll(`[data-annimg="${id}"] img`).forEach(el=>{if(v&&(!el.dataset.k||el.dataset.k==="t")){el.onload=()=>el.classList.add("ok");el.src=v;el.dataset.k=k;if(el.complete&&el.naturalWidth)el.classList.add("ok")}})}
const imgBox=a=>a.img?`<button type="button" class="annimg" data-annimg="${E(a.id)}" aria-label="تكبير الصورة" style="aspect-ratio:${N(a.w)||4}/${N(a.h)||3}"><img alt=""></button>`:"";
async function viewImg(id){
  const a=A.find(x=>x.id===id)||{};let v=g("anniv");if(!v){v=document.createElement("div");v.id="anniv";document.body.appendChild(v);v.addEventListener("click",e=>{if(e.target===v||e.target.closest("[data-annivx]"))v.className=""})}
  v.className="on";v.innerHTML=`<div class="t"><b>📢 ${E(a.n||"الإدارة")}</b><button type="button" data-annivx>✕ إغلاق</button></div><div class="v"><img alt="" src="${(IMG[id]&&(IMG[id].f||IMG[id].t))||""}"></div><div class="l">⏳ تحميل الجودة الكاملة...</div>`;
  const f=await getImg(id,"f");if(!g("anniv")||v.className!=="on")return;
  const im=v.querySelector(".v img"),l=v.querySelector(".l");
  if(f){im.src=f;l.outerHTML="";v.querySelector(".t b").insertAdjacentHTML("afterend",`<a href="${f}" download="tasooma-ann-${E(id)}.jpg">⬇️ حفظ الصورة</a>`)}else l.textContent="تعذر تحميل الصورة";
}
async function pickImg(file){
  if(!file||!/^image\//.test(file.type)){X.toast("اختر صورة");return}
  const b=document.querySelector("[data-annpic]");if(b){b.disabled=true;b.textContent="⏳ تجهيز الصورة..."}
  try{PIC=await encode(file);paint()}catch(e){X.toast(e&&e.message==="big"?"الصورة كبيرة جداً، جرّب صورة أخرى":"تعذر فتح الصورة، جرّب صورة أخرى");paint()}
}
const seen=()=>{try{return N(localStorage.getItem(LS))}catch(e){return 0}};
const markSeen=()=>{const t=A.length?N(A[0].ts):0;try{localStorage.setItem(LS,String(Math.max(seen(),t)))}catch(e){}paintBtn()};
const unread=()=>A.filter(a=>N(a.ts)>seen()&&a.by!==X.email).length;
function paintBtn(){const b=g("annb");if(!b)return;const n=unread();b.innerHTML=`📢 التعميمات${n?` <i>${n}</i>`:""}`;b.classList.toggle("nw",!!n);if(X&&X.onBadge)X.onBadge(n)}
// زرار جاهز كـ HTML (لوحة المستودع بتعيد رسم الشريط كتير)
export const annBtn=()=>{if(!X)return "";const n=unread();return `<button id="annb" type="button" data-annopen class="${n?"nw":""}">📢 التعميمات${n?` <i>${n}</i>`:""}</button>`};
const when=t=>new Date(N(t)).toLocaleString("ar-EG-u-nu-latn",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

// ctx: {db, auth, toast, party: "003" | إيميل, email, name(), canPost, mount(btn), total: عدد الفروع (للقراءة)}
export function initAnn(ctx){
  stopAnn();X=ctx;
  if(!g("ann-css")){const s=document.createElement("style");s.id="ann-css";s.textContent=CSS;document.head.appendChild(s)}
  if(X.mount){const b=document.createElement("button");b.id="annb";b.type="button";b.dataset.annopen="1";X.mount(b)}paintBtn();
  // آخر 30 تعميم (قراءة خفيفة)
  UN=onSnapshot(query(collection(X.db,"ann"),orderBy("ts","desc"),limit(30)),sn=>{
    const old=A.length?N(A[0].ts):0;A=sn.docs.map(d=>({id:d.id,...d.data()}));paintBtn();
    if(X.popup){checkPop();return}
    const nw=A[0];if(old&&nw&&N(nw.ts)>old&&nw.by!==X.email&&X.toast)X.toast(`📢 تعميم جديد من ${nw.n||"الإدارة"}`);
    if(g("annm")&&g("annm").classList.contains("on")){paint();markRead()}
  },()=>{});
  if(!X.popup&&new URLSearchParams(location.search).get("ann"))setTimeout(open,900);
}
export function stopAnn(){recStop();VO=null;if(UN){UN();UN=null}if(RDU){RDU();RDU=null}A=[];CNT={};Q=[];CHK={};const b=g("annb");if(b)b.remove();const m=g("annm");if(m)m.remove();const p=g("annp");if(p)p.remove();X=null}

// 🔔 وضع الفرع (طلب محمد): مفيش زرار تعميمات عند الفرع. أي تعميم جديد بيطلع في وش الفرع (أول ما يفتح، أو فوراً لو فاتح)
// ومش بيختفي غير لما الفرع يقفله من ✕. القفل بيتسجل في ann/{id}/rd/{كود الفرع} (عشان ميطلعش تاني على أي جهاز) + نسخة على الجهاز.
const DAYS=14;let Q=[],CHK={};
const dkey=()=>"ann_dis_"+me();
const dis=()=>{try{return JSON.parse(localStorage.getItem(dkey())||"[]")}catch(e){return []}};
const addDis=id=>{try{const l=dis().filter(x=>A.some(a=>a.id===x));if(!l.includes(id))l.push(id);localStorage.setItem(dkey(),JSON.stringify(l.slice(-60)))}catch(e){}};
async function checkPop(){
  if(!X||!X.popup)return;const p=me();if(!p)return;const from=Date.now()-DAYS*864e5,d=dis();
  const live=new Set(A.map(a=>a.id));Q=Q.filter(a=>live.has(a.id));// تعميم اتمسح: يختفي من الطابور
  for(const a of A){
    if(N(a.ts)<from||d.includes(a.id)||CHK[a.id])continue;CHK[a.id]=1;
    try{const s=await getDoc(doc(X.db,"ann",a.id,"rd",p));if(s.exists()){addDis(a.id);continue}}catch(e){}
    if(!Q.some(q=>q.id===a.id))Q.push(a);
  }
  Q.sort((a,b)=>N(a.ts)-N(b.ts));showPop();
}
function showPop(){
  let m=g("annp");const a=Q[0];
  if(!a){if(m)m.className="";return}
  if(!m){m=document.createElement("div");m.id="annp";document.body.appendChild(m)}
  const fresh=m.dataset.id!==a.id;m.dataset.id=a.id;m.className="on";
  m.innerHTML=`<div class="annk annpk${fresh?" pop":""}"><div class="annh"><span style="font-size:30px">📢</span><div><b>تعميم من الإدارة</b><small>${E(a.n||"الإدارة")} · ${when(a.ts)}</small></div><button type="button" data-annpx aria-label="إغلاق">✕</button></div>
  <div class="annpb">${bodyOf(a)}${Q.length>1?`<div class="annpn">يوجد ${Q.length-1} تعميم آخر بعد هذا</div>`:""}</div></div>`;
  if(a.img)fillImg(a.id,"f");// الفرع بيشوف الصورة الأصلية على طول
}
async function dismissPop(){
  const a=Q.shift();if(!a||!X)return showPop();addDis(a.id);showPop();
  try{await setDoc(doc(X.db,"ann",a.id,"rd",me()),{ts:Date.now(),n:String(X.name()||me()).slice(0,60)})}catch(e){}
}
async function delAnn(id){
  if(!X||!X.canPost)return;
  if(!confirm("حذف هذا التعميم نهائياً؟ سيختفي من عند الجميع."))return;
  const a=A.find(x=>x.id===id);
  try{if(a&&a.img)await Promise.all(["f","t"].map(k=>deleteDoc(doc(X.db,"ann",id,"img",k)).catch(()=>{})));
    if(a&&a.v)await deleteDoc(doc(X.db,"ann",id,"aud","a")).catch(()=>{});
    await withTimeout(deleteDoc(doc(X.db,"ann",id)),20000);X.toast("🗑 حُذف التعميم")}
  catch(e){const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":FAIL_MSG[w])}
}

function box(){let m=g("annm");if(!m){m=document.createElement("div");m.id="annm";m.addEventListener("click",e=>{if(e.target===m)close()});document.body.appendChild(m)}return m}
function close(){const m=g("annm");if(m)m.className="";recStop();markSeen()}
function open(){if(!X)return;const m=box();m.className="on";paint();markRead();markSeen()}
function paint(){
  const m=g("annm");if(!m||!X)return;const s=seen(),keep=g("annt")?g("annt").value:"",foc=document.activeElement&&document.activeElement.id==="annt";
  m.innerHTML=`<div class="annk"><div class="annh"><span style="font-size:30px">📢</span><div><b>التعميمات</b><small>رسائل الإدارة والمستودع لكل الفروع</small></div><button type="button" data-annx aria-label="إغلاق">✕</button></div>
  ${X.canPost?`<div class="annc">${!PIC?`<div class="annbg annbgc" data-annfocus><svg class="wm" viewBox="0 0 512 512" aria-hidden="true">${WOLF}</svg><div class="hd3"><svg viewBox="80 60 352 390" aria-hidden="true">${WOLF}</svg>TASOOMA</div><textarea id="annt" class="abt s1" rows="1" maxlength="1000" placeholder="اكتب التعميم أو العرض هنا..."></textarea><div class="ft">📢 ${E(X.name()||"الإدارة")}</div><span class="cnt" id="annn"></span></div>`
   :`<textarea id="annt" maxlength="2000" placeholder="اكتب كلاماً مع الصورة (اختياري)..."></textarea>`}
   ${PIC?`<div class="annpv"><img src="${PIC.t}" alt=""><button type="button" data-annrm aria-label="إزالة الصورة">✕</button><small>${PIC.w}×${PIC.h} · جودة عالية</small></div>`:""}
   ${VO?`<div class="annvop"><span>🎤</span><audio controls src="${VO.a}"></audio><button type="button" data-annvrm aria-label="حذف التسجيل">✕</button></div>`:""}
   <input id="annf" type="file" accept="image/*" hidden>
   <div class="row"><button type="button" class="pic" data-annpic>📷 ${PIC?"تغيير الصورة":"إضافة صورة"}</button><button type="button" class="pic${REC?" rec":""}" data-annrec>${REC?`⏹ إيقاف التسجيل <small>${fmtS((Date.now()-REC.t0)/1000)} / ${fmtS(MAXS)}</small>`:`🎤 ${VO?"إعادة التسجيل":"تسجيل صوت"}`}</button><small>سيصل إشعار فوري لكل الفروع والمستودع</small><button type="button" data-anns ${REC?"disabled":""}>📢 إرسال للجميع</button></div></div>`:""}
  <div class="annl">${A.length?A.map(a=>`<div class="anni${N(a.ts)>s&&a.by!==X.email?" nw":""}"><div class="hd2"><b>${E(a.n||"الإدارة")}</b><span>· ${when(a.ts)}</span></div>${bodyOf(a)}
   ${X.canPost?`<div class="rdrow"><span class="rd" data-annr="${E(a.id)}">👁 ${CNT[a.id]!=null?`قرأه ${CNT[a.id].n}`:"من قرأه؟"}</span><button type="button" class="anndel" data-anndel="${E(a.id)}">🗑 حذف</button></div>${CNT[a.id]&&CNT[a.id].open?`<div class="annrd">${CNT[a.id].names.map(E).join(" · ")||"لا أحد بعد"}</div>`:""}`:""}</div>`).join(""):`<div class="anne">📭<br>لا توجد تعميمات بعد</div>`}</div></div>`;
  const t=g("annt");if(t&&keep)t.value=keep;fitBg();if(t&&foc){t.focus();try{t.setSelectionRange(t.value.length,t.value.length)}catch(e){}}
  A.forEach(a=>{if(a.img)fillImg(a.id,"t")});// المصغّرة بس في القايمة (الأصلية لما يضغط)
}
// "قرأتها": كل طرف بيسجّل مرة واحدة على آخر التعميمات اللي ظهرتله
async function markRead(){
  if(!X)return;const p=me();if(!p)return;
  for(const a of A.slice(0,10)){if(a.by===X.email||a._r)continue;a._r=1;
    try{const ref=doc(X.db,"ann",a.id,"rd",p),s=await getDoc(ref);if(!s.exists())await setDoc(ref,{ts:Date.now(),n:String(X.name()||p).slice(0,60)})}catch(e){}}
}
async function readers(id){
  try{const sn=await withTimeout(getDocs(collection(X.db,"ann",id,"rd")),15000);const names=sn.docs.map(d=>d.data().n||d.id);CNT[id]={n:names.length,names,open:!(CNT[id]&&CNT[id].open)};paint()}
  catch(e){X.toast("تعذر تحميل من قرأ التعميم")}
}
async function post(){
  if(busy||!X||!X.canPost)return;const t=String((g("annt")||{}).value||"").trim().slice(0,2000);
  if(REC){X.toast("أوقف التسجيل أولاً");return}
  if(!t&&!PIC&&!VO){X.toast("اكتب التعميم أو أضف صورة أو سجّل صوتاً");return}
  const bg=!PIC&&!!t;// الكلام من غير صورة = على خلفية تاسومة دايماً
  if(!confirm("إرسال هذا التعميم إلى كل الفروع والمستودع؟"))return;
  busy=true;const b=document.querySelector("[data-anns]");if(b){b.disabled=true;b.textContent=PIC||VO?"⏳ جاري الرفع...":"⏳ جاري الإرسال..."}
  try{
    // الصورة والصوت الأول (علشان لما التعميم يوصل للفروع يكونوا موجودين)، وبعدين التعميم نفسه
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,10),p=PIC,vo=VO;
    if(p){await withTimeout(setDoc(doc(X.db,"ann",id,"img","f"),{i:p.f}),90000);await withTimeout(setDoc(doc(X.db,"ann",id,"img","t"),{i:p.t}),30000);IMG[id]={f:p.f,t:p.t}}
    if(vo){await withTimeout(setDoc(doc(X.db,"ann",id,"aud","a"),{a:vo.a}),90000);AUDC[id]=vo.a}
    await withTimeout(setDoc(doc(X.db,"ann",id),{t,by:X.email,n:String(X.name()||"الإدارة").slice(0,60),ts:Date.now(),...(p?{img:1,w:p.w,h:p.h}:{}),...(bg?{bg:1}:{}),...(vo?{v:1,d:vo.d}:{})}),20000);
    PIC=null;VO=null;g("annt").value="";X.toast("📢 أُرسل التعميم، وجاري إبلاغ الجميع");annPush(X.auth,id);paint()}
  catch(e){const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":FAIL_MSG[w])}
  busy=false;const b2=document.querySelector("[data-anns]");if(b2){b2.disabled=false;b2.textContent="📢 إرسال للجميع"}
}
document.addEventListener("click",e=>{
  if(!X)return;const t=e.target;
  if(t.closest("[data-annopen]"))return void open();
  if(t.closest("[data-annx]"))return void close();
  if(t.closest("[data-anns]"))return void post();
  if(t.closest("[data-annpx]"))return void dismissPop();
  if(t.closest("[data-annpic]"))return void (g("annf")&&g("annf").click());
  if(t.closest("[data-annrm]")){PIC=null;return void paint()}
  if(t.closest("[data-annrec]"))return void (REC?recStop():recStart());
  if(t.closest("[data-annvrm]")){VO=null;return void paint()}
  const pl=t.closest("[data-annplay]");if(pl)return void playVo(pl.dataset.annplay);
  if(t.closest("[data-annfocus]")&&t.id!=="annt"){const ta=g("annt");if(ta)ta.focus();return}
  const im=t.closest("[data-annimg]");if(im)return void viewImg(im.dataset.annimg);
  const dl=t.closest("[data-anndel]");if(dl)return void delAnn(dl.dataset.anndel);
  const r=t.closest("[data-annr]");if(r)return void readers(r.dataset.annr);
});
document.addEventListener("input",e=>{if(X&&e.target.id==="annt")fitBg()});
document.addEventListener("change",e=>{if(!X||e.target.id!=="annf")return;const f=e.target.files&&e.target.files[0];e.target.value="";if(f)pickImg(f)});
