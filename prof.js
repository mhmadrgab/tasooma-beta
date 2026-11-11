// الملف الشخصي لحسابات المستودع: صورة لكل واحد (ava/{email}) + اسم وكنية مالك النظام (meta/me).
// كل واحد بيرفع صورته هو بس (بيقصها بنفسه في نافذة "ضبط الصورة" وبتتحفظ 320×320). اسم وكنية الموظفين والمديرين بيحددهم المالك من تبويب "الموظفين".
// ctx = {db, me:إيميلي, owner, name:()=>اسمي, k:()=>كنيتي, toast, redraw, onMe(ME) للمالك}
import {collection,doc,onSnapshot,setDoc,deleteDoc} from "./fb.js";
import {E} from "./cust.js";
const STYLE=`.pfa{border-radius:50%;object-fit:cover;flex:none;display:inline-block;vertical-align:middle;background:#1b1b1b}
.pfi{display:inline-grid;place-items:center;color:#d4ae5c;font-weight:800;line-height:1}
.pfme{display:inline-flex!important;align-items:center;gap:7px;padding:3px 12px 3px 4px!important}.pfme span{max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (max-width:600px){.pfme span{display:none}.pfme{padding:3px!important}}
#pfm{display:none;position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.55);padding:16px;align-items:center;justify-content:center}
#pfm.on{display:flex}#pfm .bx{background:var(--card);color:var(--ink);border-radius:20px;width:100%;max-width:400px;padding:22px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.35)}
#pfm h3{margin:12px 0 2px;font-size:20px}#pfm .k{color:var(--acc);font-weight:700;min-height:22px}#pfm .off{font-size:13px}
#pfm .row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:14px}
#pfm input[type=text]{width:100%;font:inherit;font-size:15px;border-radius:12px;border:1.5px solid var(--line);background:var(--field,#f3f1ed);color:var(--ink);padding:9px 12px;margin-top:8px}
#pfm label{display:block;text-align:start;font-size:13px;color:var(--mut);margin-top:10px}`;
let X=null,AV={},ME=null,un=[],busy=false;
export const photo=em=>AV[String(em||"").toLowerCase()]||"";
// صورة الشخص، ولو لا يوجد: أول حرف من اسمه
export function avatar(em,name,sz){
  sz=sz||36;const p=photo(em),st=`width:${sz}px;height:${sz}px`;
  return p?`<img class="pfa" src="${p}" alt="" style="${st}">`:`<span class="pfa pfi" style="${st};font-size:${Math.round(sz*.44)}px">${E([...String(name||"؟").trim()][0]||"؟")}</span>`;
}
export const ownerMe=()=>ME||{};
export const meReady=()=>ME!==null;// اسم المالك اتحمّل؟
// زرار "أنا" في شريط اللوحة
// أيقونة "حسابي" (راس وكتفين) زي أي تطبيق، ولو رفع صورته بتظهر بدلها. الاسم بيظهر جوه نافذة الحساب مش على الزرار
const ICON=sz=>`<span class="pfa pfi" style="width:${sz}px;height:${sz}px"><svg viewBox="0 0 24 24" width="${Math.round(sz*.62)}" height="${Math.round(sz*.62)}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg></span>`;
export const chip=()=>X?`<button id="pfme" class="pfme" type="button" title="حسابي: ${E(X.name())}" aria-label="حسابي">${photo(X.me)?avatar(X.me,X.name(),28):ICON(28)}<span>حسابي</span></button>`:"";
// ✂️ قص الصورة (نوفمبر 2026): كانت بتتقص من النص على 160 بكسل فتطلع صغيرة ومش واضحة.
// دلوقتي بتفتح نافذة: الشخص يحرّك الصورة بصباعه/الماوس ويكبّرها لحد ما وشه يملا الدايرة، وبعدين تتحفظ 320×320 بأعلى جودة تحت حد Firebase (80 ألف حرف)
const VP=260;let CR=null;
const CSTYLE=`#pfc{display:none;position:fixed;inset:0;z-index:92;background:rgba(0,0,0,.7);padding:16px;align-items:center;justify-content:center}#pfc.on{display:flex}
#pfc .bx{background:var(--card);color:var(--ink);border-radius:20px;width:100%;max-width:360px;padding:20px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)}
#pfc h3{margin:0 0 4px;font-size:18px}#pfc p{margin:0 0 12px;font-size:13px;color:var(--mut)}
.pfcv{width:${VP}px;height:${VP}px;max-width:100%;margin:0 auto;border-radius:50%;overflow:hidden;position:relative;background:#111;touch-action:none;cursor:grab;box-shadow:0 0 0 4px #d4ae5c}
.pfcv:active{cursor:grabbing}.pfcv img{position:absolute;left:0;top:0;transform-origin:0 0;user-select:none;-webkit-user-drag:none;pointer-events:none;max-width:none}
#pfc input[type=range]{width:100%;margin:16px 0 4px;accent-color:#d4ae5c}#pfc .zl{display:flex;justify-content:space-between;font-size:12px;color:var(--mut)}
#pfc .row{display:flex;gap:8px;justify-content:center;margin-top:14px}`;
function cropOpen(file){
  return new Promise((done,fail)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onerror=()=>{URL.revokeObjectURL(url);fail(new Error("img"))};
    img.onload=()=>{
      let m=document.getElementById("pfc");if(!m){m=document.createElement("div");m.id="pfc";document.body.appendChild(m)}
      m.innerHTML=`<div class="bx"><h3>ضبط الصورة</h3><p>اسحب الصورة لتحريكها، وكبّرها حتى يملأ الوجه الدائرة</p>
      <div class="pfcv" id="pfcv"><img id="pfci" src="${url}" alt=""></div>
      <input id="pfcz" type="range" min="1" max="4" step="0.01" value="1" aria-label="تكبير"><div class="zl"><span>➖</span><span>🔍 تكبير</span><span>➕</span></div>
      <div class="row"><button class="bt p" id="pfcok" type="button">✅ حفظ الصورة</button><button class="bt" id="pfcno" type="button">إلغاء</button></div></div>`;
      m.className="on";
      const W=img.naturalWidth,H=img.naturalHeight,v=document.getElementById("pfcv"),el=document.getElementById("pfci"),z=document.getElementById("pfcz");
      const vp=()=>v.clientWidth||VP,base=()=>vp()/Math.min(W,H);
      // نبدأ والصورة مالية الدايرة، ومايلة لفوق شوية (الوش غالباً في التلت الأعلاني)
      CR={x:0,y:0,k:1};const sc=()=>base()*CR.k;
      const clamp=()=>{const s=sc(),V=vp();CR.x=Math.min(0,Math.max(V-W*s,CR.x));CR.y=Math.min(0,Math.max(V-H*s,CR.y))};
      const draw=()=>{clamp();el.style.transform=`translate(${CR.x}px,${CR.y}px) scale(${sc()})`};
      CR.x=(vp()-W*sc())/2;CR.y=H>W?-(H*sc()-vp())*.22:(vp()-H*sc())/2;draw();
      z.oninput=()=>{const V=vp(),cx=(V/2-CR.x)/sc(),cy=(V/2-CR.y)/sc();CR.k=+z.value;CR.x=V/2-cx*sc();CR.y=V/2-cy*sc();draw()};
      const P=new Map();let last=null,dist=0;
      v.onpointerdown=e=>{v.setPointerCapture(e.pointerId);P.set(e.pointerId,{x:e.clientX,y:e.clientY});last=null;dist=0};
      v.onpointermove=e=>{if(!P.has(e.pointerId))return;P.set(e.pointerId,{x:e.clientX,y:e.clientY});const ps=[...P.values()];
        if(ps.length===2){// قرصة بصباعين للتكبير
          const d=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);if(dist){z.value=String(Math.min(4,Math.max(1,CR.k*d/dist)));z.oninput()}dist=d;return}
        const p=ps[0];if(last){CR.x+=p.x-last.x;CR.y+=p.y-last.y;draw()}last=p};
      const up=e=>{P.delete(e.pointerId);last=null;dist=0};v.onpointerup=up;v.onpointercancel=up;
      v.onwheel=e=>{e.preventDefault();z.value=String(Math.min(4,Math.max(1,CR.k*(e.deltaY<0?1.08:1/1.08))));z.oninput()};
      const end=r=>{m.className="";m.innerHTML="";URL.revokeObjectURL(url);CR=null;r()};
      document.getElementById("pfcno").onclick=()=>end(()=>done(null));
      document.getElementById("pfcok").onclick=()=>{
        const s=sc(),S=320,c=document.createElement("canvas");c.width=c.height=S;const g=c.getContext("2d");g.imageSmoothingQuality="high";
        g.fillStyle="#fff";g.fillRect(0,0,S,S);g.drawImage(img,-CR.x/s,-CR.y/s,vp()/s,vp()/s,0,0,S,S);
        let q=.92,d=c.toDataURL("image/jpeg",q);while(d.length>78000&&q>.4){q-=.06;d=c.toDataURL("image/jpeg",q)}
        end(()=>done(d));
      };
    };
    img.src=url;
  });
}
function paint(){
  const m=document.getElementById("pfm");if(!m||!X)return;
  const own=X.owner,n=X.name(),k=X.k?X.k():"";
  m.innerHTML=`<div class="bx">${avatar(X.me,n,96)}<h3>${E(n)}</h3><div class="k">${E(k)}</div><div class="off" dir="ltr">${E(X.me)}</div>
  ${own?`<label for="pfn">اسمك (يظهر للفروع في الدردشة)</label><input id="pfn" type="text" maxlength="60" value="${E(ME&&ME.n||n)}">
  <label for="pfk">كنيتك (تظهر بجانب اسمك)</label><input id="pfk" type="text" maxlength="40" placeholder="مثلاً: المدير العام" value="${E(ME&&ME.k||"")}">`
  :`<p class="off" style="margin:12px 0 0">يحدد مالك النظام الاسم والكنية.</p>`}
  <input id="pff" type="file" accept="image/*" hidden>
  <div class="row"><button class="bt p" data-pf="up" type="button" ${busy?"disabled":""}>${busy?"⏳ جاري الرفع...":photo(X.me)?"📷 غيّر الصورة":"📷 ارفع صورتك"}</button>${photo(X.me)?`<button class="bt" data-pf="rm" type="button">🗑 إزالة الصورة</button>`:""}</div>
  <div class="row">${own?`<button class="bt g" data-pf="save" type="button">حفظ الاسم والكنية</button>`:""}<button class="bt" data-pf="x" type="button">إغلاق</button></div></div>`;
}
function open(){let m=document.getElementById("pfm");if(!m){m=document.createElement("div");m.id="pfm";document.body.appendChild(m);m.addEventListener("click",e=>{if(e.target===m)m.className=""})}m.className="on";paint()}
async function click(e){
  if(!X)return;
  if(e.target.closest("#pfme,[data-pfopen]"))return void open();
  const b=e.target.closest("[data-pf]");if(!b)return;const a=b.dataset.pf,m=document.getElementById("pfm");
  if(a==="x"){m.className="";return}
  if(a==="up"){document.getElementById("pff").click();return}
  try{
    if(a==="rm"&&confirm("هل تريد إزالة صورتك؟")){await deleteDoc(doc(X.db,"ava",X.me));X.toast("أُزيلت الصورة")}
    if(a==="save"&&X.owner){
      const n=document.getElementById("pfn").value.trim().slice(0,60),k=document.getElementById("pfk").value.trim().slice(0,40);
      if(!n)return void X.toast("اكتب اسمك");
      await setDoc(doc(X.db,"meta","me"),{n,k});X.toast("حُفظ الاسم والكنية");m.className="";
    }
  }catch(x){X.toast("تعذر الحفظ: "+(x&&x.code||x&&x.message))}
}
async function pick(e){
  if(!X||e.target.id!=="pff")return;const f=e.target.files&&e.target.files[0];e.target.value="";if(!f)return;
  if(!/^image\//.test(f.type))return void X.toast("اختر صورة");
  let ph;try{ph=await cropOpen(f)}catch(x){return void X.toast("تعذر فتح الصورة، جرّب صورة أخرى")}
  if(!ph)return;
  busy=true;paint();
  try{if(ph.length>78000)throw new Error("big");await setDoc(doc(X.db,"ava",X.me),{ph,ts:Date.now()});X.toast("✅ رُفعت صورتك")}
  catch(x){X.toast(x&&x.message==="big"?"الصورة كبيرة، جرّب صورة أخرى":"تعذر رفع الصورة: "+(x&&x.code||x&&x.message))}
  busy=false;paint();
}
export function initProf(ctx){
  stopProf();X=ctx;
  if(!document.getElementById("pf-css")){const s=document.createElement("style");s.id="pf-css";s.textContent=STYLE+CSTYLE;document.head.appendChild(s)}
  if(!window.__pfc){window.__pfc=1;document.addEventListener("click",click);document.addEventListener("change",pick)}
  un.push(onSnapshot(collection(X.db,"ava"),sn=>{AV={};sn.docs.forEach(d=>{const p=d.data().ph;if(typeof p==="string"&&/^data:image\/jpeg;base64,/.test(p))AV[d.id]=p});paint();X.redraw()},()=>{}));
  if(X.owner)un.push(onSnapshot(doc(X.db,"meta","me"),d=>{ME=d.exists()?d.data():{};if(X.onMe)X.onMe(ME);paint()},()=>{}));
}
export function stopProf(){un.forEach(f=>f());un=[];AV={};ME=null;X=null;const m=document.getElementById("pfm");if(m)m.remove()}
