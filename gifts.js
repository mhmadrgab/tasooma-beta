// 🎁 الهدايا والعينات: الفرع (أو المستودع) يسجّل هدية/عينة طلعت + سند يثبتها، والاعتماد لمدير التسويق (p.gm) واللي معاه "اعتماد الهدايا" (p.ga) بس،
// والمحاسب (صلاحية gift) بيشوف ويطلّع تقارير لكل فرع أو للمستودع (طباعة PDF وملف إكسل). التعديل والمسح لمالك النظام بس.
// gifts/{id} = {br:"003"|"WH", brn, no, ts, dt, rows:[{k,c,z,q}], pcs, to:{n,ph?}, why, note?, img:1, by:{e,n}, st:"pend"|"ok"|"no"|"set", ap?:{e,n,at,note?}}
// التسوية (نوفمبر 2026): المحاسب (gift) بيشوف المعتمد بس، ويكتب رقم/مرجع السند في السيستم ← st:"set", sa:{e,n,at,ref}, sm:"YYYY-MM" (شهر الهدية)
//   المحاسب بيسمع st=="ok" (اللي مستني تسوية) + المتسوّي الشهر ده، والشهور الأقدم بتتحمّل من التقرير (st=="set" && sm==الشهر، من غير فهرس مركّب)
// صورة السند لوحدها في giftimg/{id} = {img} (بتتحمّل بس لما حد يدوس 📎، علشان القايمة تفضل خفيفة).
import {collection,doc,getDoc,getDocs,setDoc,deleteDoc,updateDoc,onSnapshot,query,where,writeBatch,withTimeout,failReason,FAIL_MSG} from "./fb.js";
import {E,N,fmt,today,shrink,printStmt,ensurePrintCss} from "./cust.js";
import {initZoom,zoomOpen} from "./zoom.js";
const g=id=>document.getElementById(id);
const toEn=s=>String(s||"").replace(/[٠-٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g,d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/٫/g,".").replace(/[٬,]/g,"");
const WHY=["هدية لعميل","تعويض عميل","عينة","تسويق / مؤثر","مناسبة / حدث","أخرى"];
const STL={pend:"⏳ بانتظار الاعتماد",ok:"✅ معتمدة",set:"🧾 تمت التسوية",no:"❌ مرفوضة"};
const isAp=r=>r.st==="ok"||r.st==="set";// المعتمدة (اتسوّت أو لسه)
// العينات اللي بترجع (نوفمبر 2026): مدير التسويق وهو بيعتمد عينة بيحدد هترجع ولا لأ (rt).
// اللي طلّعها يسجّل رجوعها: الفرع لهداياه، والمستودع لهدايا المستودع ← rb = {e,n,at,q:اللي رجع, lines:[لكل صنف], note?}
// الصافي = اللي طلع − اللي رجع، والمحاسب بيسوّي الصافي بس (sa.net).
const isSample=r=>r&&r.why==="عينة";
const retQ=r=>r&&r.rb?N(r.rb.q):0;
const net=r=>Math.max(0,N(r.pcs)-retQ(r));
const waitRet=r=>!!r&&r.st==="ok"&&r.rt===true&&!r.rb;// لسه مارجعتش
const canRet=r=>waitRet(r)&&!!X&&(X.mode==="branch"?r.br===X.code:(r.br==="WH"&&!X.noNew&&!X.view));
function retHtml(r){
 if(!isAp(r))return "";
 if(r.rt===true&&!r.rb)return `<div class="gf-ret w">↩️ العينة يجب أن ترجع ${r.br==="WH"?"إلى المستودع":"إلى الفرع"} · لم ترجع بعد</div>`;
 if(r.rb)return `<div class="gf-ret ok">↩️ رجع ${N(r.rb.q)} من ${N(r.pcs)} قطعة · ${hm(r.rb.at)}${r.rb.n?" · سجّلها: <bdi>"+E(r.rb.n)+"</bdi>":""} · <b>الصافي ${net(r)} قطعة</b>${r.rb.note?"<br>"+E(r.rb.note):""}</div>`;
 if(r.rt===false&&isSample(r))return `<div class="gf-ret no">العينة لا ترجع</div>`;
 return "";
}
const ymOf=t=>new Date(N(t)).toLocaleDateString("en-CA").slice(0,7);
const D=864e5,LIVE=31;// آخر 31 يوم بيتسمعوا لايف في المستودع (كانت 90: توفير قراءات نوفمبر 2026)، والأقدم بيتحمّل وقت التقرير
let X=null,L=new Map(),LS=new Map(),PEND=new Map(),OLD=new Map(),MON=new Set(),un=[],bun=null,BL=[],img="",imgBusy=false,edit=null;
let F={from:"",to:"",br:"",st:"",why:""};
const CSS=`
.gfm{display:none;position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.55);overflow:auto;padding:16px}.gfm.on{display:block}
.gfk{max-width:680px;margin:3vh auto;background:var(--card);border-radius:18px;padding:20px 22px;box-shadow:0 20px 50px rgba(0,0,0,.25)}
.gfk h3{margin:0 0 4px}.gfk label{display:block;color:var(--mut);font-size:13px;margin:12px 0 4px}.gfk input,.gfk select,.gfk textarea{width:100%}
.gfk textarea{background:var(--field);border:1.5px solid transparent;border-radius:11px;padding:10px 12px;font:inherit;color:var(--ink)}
.gf-rows{display:grid;gap:6px}.gf-row{display:grid;grid-template-columns:1.4fr 1fr .8fr .7fr auto;gap:6px;align-items:center}.gf-row input{padding:9px 8px;text-align:center}
.gf-row button{border:0;background:none;font-size:18px;cursor:pointer;color:var(--mut)}
.gf-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:560px){.gf-2{grid-template-columns:1fr}.gf-row{grid-template-columns:1fr 1fr 1fr .8fr auto}}
.gf-up{border:2px dashed var(--line);border-radius:14px;padding:14px;text-align:center;cursor:pointer;display:block;color:var(--mut)}.gf-up.ok{border-color:#2f8f3e;color:#1d5a24;background:#eaf6eb}
.gf-up img{max-height:120px;max-width:100%;border-radius:8px;display:block;margin:8px auto 0}
.gf-act{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.gf-act>*{flex:1;min-width:120px}
.gf-card{background:var(--card);border-radius:16px;padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 2px rgba(0,0,0,.06);border-inline-start:6px solid #d4ae5c}
.gf-card.ok{border-inline-start-color:#2f8f3e}.gf-card.no{border-inline-start-color:#c4362b;opacity:.85}
.gf-card h4{margin:0 0 4px;font-size:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}.gf-card .m{color:var(--mut);font-size:13.5px}
.gf-st{border-radius:999px;padding:2px 10px;font-size:12.5px;font-weight:700;background:#f6edd2;color:#6b5314}.gf-st.set{background:#dde9f7;color:#1c4f86}.gf-card.set{border-inline-start-color:#2a78d6}
.gf-set{margin-top:8px;background:#eef4fb;color:#1c4f86;border-radius:10px;padding:8px 12px;font-size:13.5px;line-height:1.8}.gf-set small{color:#4a6a90}
/* ورقة الهدية (زي ورقة تحميل النواقص) */
.gfk:has(.gs){padding:0;overflow:hidden}.gs{margin:0;background:var(--card)}
.gs-hd{display:flex;align-items:center;gap:14px;background:#1b1b1b;border-bottom:3px solid #d4ae5c;padding:18px 22px;color:#fff}
.gs-hd img{width:52px;height:52px;border-radius:12px;flex:none}.gs-hd b{display:block;font-size:20px}.gs-hd small{color:#cdb67a;font-size:13px;direction:ltr;display:block;text-align:right}
.gs-hd .gf-st{margin-inline-start:auto}
.gs-bd{padding:18px 22px 0}
.gs-rt{display:flex;align-items:stretch;gap:10px;margin-bottom:16px}.gs-rt>div{flex:1;min-width:0;border-radius:14px;padding:10px 14px;background:var(--field,#f3f1ed);border:1.5px solid var(--line)}
.gs-rt>div.to{background:#1b1b1b;color:#fff;border-color:#1b1b1b}.gs-rt small{display:block;font-size:12px;opacity:.7}.gs-rt b{display:block;font-size:17px;line-height:1.4;word-break:break-word}
.gs-rt .ar{flex:none;align-self:center;background:none;border:0;padding:0;color:#d4ae5c;font-size:26px;font-weight:800}
.gs-mt{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}.gs-mt div{background:var(--soft,#f6f2e9);border-radius:12px;padding:8px 12px}.gs-mt small{display:block;color:var(--mut);font-size:12px}.gs-mt b{font-size:15px}
.gs-tb{width:100%;border-collapse:collapse;font-size:15px}.gs-tb th{font-size:12.5px;color:var(--mut);font-weight:700;padding:8px 6px;border-bottom:2px solid #d4ae5c;text-align:center}
.gs-tb td{padding:10px 6px;border-bottom:1px solid var(--line);text-align:center}.gs-tb td.k{font-weight:800;font-size:17px;direction:ltr;text-align:right}.gs-tb td.q{font-weight:800;font-size:19px}.gs-tb tr:nth-child(even) td{background:rgba(212,174,92,.06)}
.gs-tb tfoot td{font-weight:800;border-bottom:0;padding-top:12px}.gs-tb .rq{color:#1d5a24}
.gs-nt{margin-top:12px;padding:10px 14px;border-radius:12px;background:#fff8e6;border-inline-start:4px solid #d4ae5c;font-size:14.5px}
.gs-tl{display:flex;gap:6px;margin:16px 0 4px;flex-wrap:wrap}.gs-tl div{flex:1;min-width:110px;border-radius:12px;padding:8px 10px;background:var(--soft,#f6f2e9);font-size:12.5px;color:var(--mut);border-top:4px solid var(--line)}
.gs-tl div.on{color:var(--ink);border-top-color:#d4ae5c}.gs-tl div.no{border-top-color:#c4362b}.gs-tl b{display:block;font-size:14px}
.gs-ac{display:flex;gap:8px;flex-wrap:wrap;padding:14px 22px 18px;border-top:1px solid var(--line);background:var(--soft,#f6f2e9);margin:12px -22px 0}
.gs-ac .bt{flex:1;min-width:120px}
.gf-card h4{cursor:pointer}
@media (max-width:560px){.gs-mt{grid-template-columns:1fr 1fr}.gs-bd{padding:14px 14px 0}.gs-ac{margin:12px -14px 0;padding:12px 14px 16px}.gs-ac .bt{min-width:calc(50% - 4px)}.gs-hd{padding:14px}.gs-rt b{font-size:15px}.gs-tb{font-size:14px}.gs-tb td.k{font-size:15px}}
@media (prefers-color-scheme:dark){.gs-nt{background:#2b2210}.gs-rt>div.to{background:#000}}
.gf-ret{margin-top:8px;border-radius:10px;padding:8px 12px;font-size:13.5px;line-height:1.8;background:#f3efe6;color:#5b4512}.gf-ret.w{background:#fff1d6;color:#8a5a00;font-weight:700}.gf-ret.ok{background:#e7f4ec;color:#1d5a24}.gf-ret.no{background:#f1f1f1;color:#666}
.gf-rt{display:grid;gap:10px;margin-top:14px}.gf-rt button{font:inherit;font-weight:800;font-size:16px;border-radius:14px;padding:14px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;text-align:start}.gf-rt button small{display:block;font-weight:400;color:var(--mut);font-size:13px;margin-top:2px}.gf-rt button.y{border-color:#d4ae5c;background:#fff8e6}
.gf-rr{display:grid;grid-template-columns:1fr 90px 100px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px dashed var(--line)}.gf-rr input{text-align:center;padding:9px 6px}
@media (prefers-color-scheme:dark){.gf-ret{background:#2a261d;color:#e8cf8a}.gf-ret.w{background:#3a2a08;color:#f6c770}.gf-ret.ok{background:#173a1b;color:#8fd39a}.gf-ret.no{background:#262626;color:#aaa}.gf-rt button.y{background:#3a3115}}
.gf-ref{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px dashed var(--line)}.gf-ref input{flex:1;min-width:180px}
.gf-acc{background:#eef4fb;border:1px solid #9fc0e6;border-radius:16px;padding:12px 14px;margin-bottom:14px}
@media (prefers-color-scheme:dark){.gf-st.set,.gf-set,.gf-acc{background:#14243a;color:#9cc4f0;border-color:#2a4a70}}.gf-st.ok{background:#d8efd9;color:#1d5a24}.gf-st.no{background:#f8d9d5;color:#8a2218}
.gf-it{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.gf-it span{background:var(--soft);border-radius:9px;padding:3px 9px;font-size:13.5px}
.gf-b{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.gf-b .bt,.gf-b button{width:auto}
/* شريط الفلاتر (نوفمبر 2026): كان flex بيلف بشكل عشوائي (فلاتر فوق وتحت وفي النص). دلوقتي شبكة ثابتة: 4 فلاتر + الأزرار في سطر على الكمبيوتر، وعمودين على التابلت والموبايل والأزرار سطر كامل */
.gf-lh{margin:18px 0 10px;font-size:17px}
.gf-f{display:grid;grid-template-columns:repeat(5,minmax(0,1fr)) auto;gap:10px;align-items:end;margin:0 0 12px;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 14px}
.gf-f>div{display:flex;flex-direction:column;gap:4px;min-width:0}.gf-f small{color:var(--mut);font-size:12px;font-weight:700}
.gf-f input,.gf-f select{width:100%;height:44px;margin:0}
.gf-f .gf-act{flex-direction:row;gap:8px}.gf-f .gf-act .bt{height:44px;white-space:nowrap;margin:0}
@media (max-width:980px){.gf-f{grid-template-columns:repeat(2,minmax(0,1fr))}.gf-f .gf-act{grid-column:1/-1}.gf-f .gf-act .bt{flex:1}}
.gf-sum{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.gf-sum span{background:var(--card);border-radius:999px;padding:7px 14px;font-size:14px;box-shadow:0 1px 2px rgba(0,0,0,.06)}
.gf-pend{background:#fff7e6;border:1px solid #efc47c;border-radius:16px;padding:12px 14px;margin-bottom:14px}
#gfbtn{display:flex;align-items:center;gap:14px;width:100%;margin:0 0 14px;padding:14px 18px;border:0;border-radius:18px;cursor:pointer;font:inherit;text-align:start;color:#1b1b1b;
 background:linear-gradient(120deg,#f7e3b0 0%,#e9c977 55%,#d4ae5c 100%);box-shadow:0 8px 22px rgba(168,131,47,.28);position:relative;overflow:hidden;transition:transform .15s,box-shadow .15s;animation:ui-fade .35s ease both}
#gfbtn:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(168,131,47,.35)}#gfbtn:active{transform:scale(.99)}
#gfbtn::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.45) 50%,transparent 70%);transform:translateX(-120%);animation:gf-shine 4.5s ease-in-out infinite}
@keyframes gf-shine{0%,70%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
#gfbtn .ic{width:58px;height:58px;border-radius:16px;background:rgba(255,255,255,.55);display:grid;place-items:center;font-size:32px;flex:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.6)}
#gfbtn .tx{flex:1;min-width:0}#gfbtn .tx b{display:block;font-size:19px;font-weight:800}#gfbtn .tx small{display:block;font-size:13.5px;color:#4a3a14;margin-top:2px}
#gfbtn .bd{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}#gfbtn .bd span{background:rgba(27,27,27,.85);color:#f3e7c8;border-radius:999px;padding:1px 10px;font-size:12px;font-weight:700}
#gfbtn .ar{font-size:24px;font-weight:800;flex:none;opacity:.7}html[dir="rtl"] #gfbtn .ar{transform:scaleX(-1)}
.gf-hero{display:flex;align-items:center;gap:14px;margin:-20px -22px 14px;padding:18px 22px;border-radius:18px 18px 0 0;background:linear-gradient(120deg,#2b2416,#1b1b1b);color:#f3e7c8}
.gf-hero .ic{font-size:40px}.gf-hero h3{margin:0;font-size:21px;color:#fff}.gf-hero p{margin:3px 0 0;font-size:13.5px;color:#cdb67a;line-height:1.7}
.gf-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 14px}.gf-stats div{background:var(--soft);border-radius:14px;padding:10px;text-align:center}.gf-stats b{display:block;font-size:22px}.gf-stats small{color:var(--mut);font-size:12.5px}
.gf-new{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;font:inherit;font-size:17px;font-weight:800;border:0;border-radius:14px;padding:15px;background:#1b1b1b;color:#fff;cursor:pointer;box-shadow:0 6px 16px rgba(0,0,0,.18)}
@media (prefers-color-scheme:dark){#gfbtn{color:#1b1b1b}}
@media (prefers-color-scheme:dark){.gf-st{background:#3a3115;color:#e8cf8a}.gf-st.ok{background:#173a1b;color:#8fd39a}.gf-st.no{background:#40191a;color:#f1a5a0}.gf-up.ok{background:#173a1b;color:#8fd39a}.gf-pend{background:#2b2210;border-color:#6b5226}}
#gfm .bt{font:inherit;font-weight:700;border-radius:12px;padding:10px 16px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}#gfm .bt.s{padding:6px 12px;font-size:13.5px}
#gfm .bt.p{background:#1b1b1b;border-color:#1b1b1b;color:#fff}#gfm .bt.g{background:#d4ae5c;border-color:#d4ae5c;color:#1b1b1b}#gfm .bt.r{color:#c4362b;border-color:#c4362b}#gfm .bt:disabled{opacity:.6}
@media print{.gfm{display:none!important}}
`;
const all=()=>{const m=new Map([...OLD,...L,...LS,...PEND]);return [...m.values()]};
const hm=t=>new Date(N(t)).toLocaleString("en-GB",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
const brName=c=>c==="WH"?"المستودع":((X&&X.branches||[]).find(b=>String(b).split("-")[0]===c)||c);
const itemsTxt=r=>(Array.isArray(r.rows)?r.rows:[]).map(x=>[x.k,x.c,x.z].filter(Boolean).join(" ")+" × "+N(x.q)).join(" · ");
const canApprove=()=>!!(X&&X.approver);
const canSettle=()=>!!(X&&X.settler);// المحاسب (والمديرين)
const accOnly=()=>!!(X&&X.acc);// المحاسب بس: يشوف المعتمد بس
const isOwner=()=>!!(X&&X.owner&&X.owner());
// ---------- البداية ----------
// ctx: {db,toast,ping(ids),mode:"wh"|"branch",me:{e,n},approver,acc,view,owner(),branches,redraw,tab, code,brn (للفرع)}
export function initGifts(ctx){
 stopGifts();X=ctx;
 if(!g("gf-css")){const s=document.createElement("style");s.id="gf-css";s.textContent=CSS;document.head.appendChild(s);ensurePrintCss()}
 if(ctx.mode==="branch"){initZoom({db:ctx.db,toast:ctx.toast,owner:()=>false});addBranchButton()}
 else{
  const draw=()=>{if(X&&X.tab()==="gift")X.redraw();else if(X&&X.badge)X.badge()};
  if(canApprove())un.push(onSnapshot(query(collection(X.db,"gifts"),where("st","==","pend")),sn=>{PEND=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));draw()},()=>{}));
  const err=()=>X.toast("تعذر قراءة الهدايا. تأكد من نشر القواعد (Rules) الجديدة");
  if(accOnly()){
   // المحاسب: المعتمد اللي مستني تسوية + اللي اتسوّى الشهر ده (القواعد مش بتسمحله يشوف غير المعتمد)
   const cm=ymOf(Date.now());MON.add(cm);
   un.push(onSnapshot(query(collection(X.db,"gifts"),where("st","==","ok")),sn=>{L=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));draw()},err));
   un.push(onSnapshot(query(collection(X.db,"gifts"),where("st","==","set"),where("sm","==",cm)),sn=>{LS=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));draw()},err));
  }
  else{
   un.push(onSnapshot(query(collection(X.db,"gifts"),where("ts",">=",Date.now()-LIVE*D)),sn=>{L=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));draw()},err));
   // المعتمد اللي لسه ماتسوّاش (والعينات اللي مستنية ترجع) مهما كان قديم، علشان مايختفيش لما الفترة اللايف بقت شهر
   un.push(onSnapshot(query(collection(X.db,"gifts"),where("st","==","ok")),sn=>{LS=new Map(sn.docs.map(d=>[d.id,{id:d.id,...d.data()}]));draw()},()=>{}));
  }
 }
 if(!window.__gfc){window.__gfc=1;document.addEventListener("click",click);document.addEventListener("change",change)}
}
export function stopGifts(){un.forEach(f=>f());un=[];if(bun){bun();bun=null}BL=[];{const b=g("gfbtn");if(b)b.remove()}L=new Map();LS=new Map();PEND=new Map();OLD=new Map();MON=new Set();closeM()}
export const pendingCount=()=>PEND.size;
// للتقرير الأسبوعي (short.js): الهدايا من تاريخ معيّن، والصافي
export const giftsSince=t=>all().filter(r=>N(r.ts)>=t);
export const giftNet=r=>net(r);
// ---------- الفرع: زرار فوق + نافذة فيها هداياه ----------
function addBranchButton(){
 if(g("gfbtn"))return;const me=g("me");if(!me)return;
 const b=document.createElement("button");b.id="gfbtn";b.type="button";b.dataset.gf="bopen";
 me.parentNode.insertBefore(b,me.nextSibling);paintBtn();
 if(!bun)bun=onSnapshot(query(collection(X.db,"gifts"),where("br","==",X.code)),sn=>{BL=sn.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>N(b.ts)-N(a.ts));paintBtn();if(g("gfm")&&g("gfm").dataset.v==="list")paintBranch()},e=>{});
}
function paintBtn(){
 const b=g("gfbtn");if(!b)return;const rw=BL.filter(waitRet).length,p=BL.filter(r=>r.st==="pend").length,no=BL.filter(r=>r.st==="no"&&N(r.ap&&r.ap.at)>Date.now()-7*D).length;
 b.innerHTML=`<span class="ic">🎁</span><span class="tx"><b>الهدايا والعينات</b><small>سجّل أي هدية أو عينة خرجت من الفرع لعميل</small>${p||no||rw?`<span class="bd">${p?`<span>⏳ ${p} بانتظار الاعتماد</span>`:""}${no?`<span>❌ ${no} مرفوضة</span>`:""}${rw?`<span>↩️ ${rw} عينة لم ترجع</span>`:""}</span>`:""}</span><span class="ar">➜</span>`;
}
function openBranch(){paintBranch()}
function paintBranch(){
 const c=k=>BL.filter(r=>r.st===k).length;
 openM(`<div class="gf-hero"><span class="ic">🎁</span><div><h3>الهدايا والعينات</h3><p>أي هدية أو عينة تخرج من الفرع يجب تسجيلها هنا (ويمكنك إرفاق صورة السند)، ويعتمدها مدير التسويق.</p></div></div>
 <div class="gf-stats"><div><b>${c("pend")}</b><small>⏳ بانتظار الاعتماد</small></div><div><b>${c("ok")+c("set")}</b><small>✅ معتمدة</small></div><div><b>${c("no")}</b><small>❌ مرفوضة</small></div></div>
 <button class="gf-new" data-gf="new" type="button">➕ تسجيل هدية / عينة جديدة</button>
 <div style="margin-top:14px">${BL.length?BL.slice(0,40).map(r=>card(r,false)).join(""):'<div class="m" style="text-align:center;padding:20px;color:var(--mut)">لا توجد هدايا مسجّلة بعد</div>'}</div>
 <div class="gf-act"><button class="b" data-gf="close" type="button">إغلاق</button></div>`,"list");
}
// ---------- الكارت ----------
function card(r,wh,setUi){// setUi = خانة مرجع السند (في قسم "بانتظار التسوية" بس، علشان ماتتكررش)
 const st=r.st||"pend",ap=r.ap||{};
 return `<div class="gf-card ${st}"><h4 data-gf="view" data-id="${E(r.id)}" title="فتح الهدية">${wh?`<bdi dir="ltr">${E(r.brn||brName(r.br))}</bdi>`:""}<span class="gf-st ${st}">${STL[st]||st}</span><small class="m"><bdi dir="ltr">${E(r.no)}</bdi> · ${E(r.dt||"")}</small></h4>
 <div class="m">👤 ${E(r.to&&r.to.n||"")}${r.to&&r.to.ph?` · <bdi dir="ltr">${E(r.to.ph)}</bdi>`:""} · 🏷 ${E(r.why||"")}${r.note?` · ${E(r.note)}`:""}</div>
 <div class="gf-it">${(Array.isArray(r.rows)?r.rows:[]).map(x=>`<span><bdi dir="ltr">${E([x.k,x.c,x.z].filter(Boolean).join(" "))}</bdi> × <b>${N(x.q)}</b></span>`).join("")}</div>
 <div class="m">سجّلها: <bdi>${E(r.by&&r.by.n||"")}</bdi> · ${hm(r.ts)} · ${N(r.pcs)} قطعة${st!=="pend"&&ap.n?` · ${st==="no"?"رفضها":"اعتمدها"}: ${E(ap.n)} ${hm(ap.at)}`:""}${st==="no"&&ap.note?`<br><b style="color:#c4362b">سبب الرفض: ${E(ap.note)}</b>`:""}</div>
 ${retHtml(r)}
 ${st==="set"&&r.sa?`<div class="gf-set">🧾 تمت التسوية${wh?` بواسطة ${E(r.sa.n||"")}`:""} · ${hm(r.sa.at)} · مرجع السند: <b dir="ltr">${E(r.sa.ref||"")}</b>${r.sa.net!=null&&N(r.sa.net)!==N(r.pcs)?` · الصافي المسوّى ${N(r.sa.net)} قطعة`:""}${wh?"":`<br><small>خصم المحاسب هذه الهدية من مخزون الفرع في النظام</small>`}</div>`:""}
 ${wh&&setUi&&canSettle()&&st==="ok"?`${waitRet(r)?'<div class="gf-ret w" style="margin-top:10px">⏳ انتظر رجوع العينة قبل التسوية، فالصافي قد يتغيّر</div>':""}${r.rb?`<div class="gf-ret ok" style="margin-top:10px">🧮 سوِّ الصافي فقط: <b>${net(r)} قطعة</b> (طلع ${N(r.pcs)} − رجع ${retQ(r)})</div>`:""}<div class="gf-ref"><input data-gfref="${E(r.id)}" maxlength="60" dir="ltr" placeholder="رقم / مرجع السند في النظام"><button class="bt s g" data-gf="set" data-id="${E(r.id)}" type="button">✔ تمت التسوية</button></div>`:""}
 <div class="gf-b"><button class="bt s p" data-gf="view" data-id="${E(r.id)}" type="button">📄 ${wh?"فتح السند":"فتح الهدية"}</button>${canRet(r)?`<button class="bt s g" data-gf="ret" data-id="${E(r.id)}" type="button">↩️ رجعت العينة</button>`:""}${r.img?`<button class="bt s" data-gf="img" data-id="${E(r.id)}" type="button">📎 السند</button>`:'<span class="m">بدون مرفق</span>'}
 ${wh&&canApprove()&&st==="pend"?`<button class="bt s g" data-gf="ok" data-id="${E(r.id)}" type="button">✅ اعتماد</button><button class="bt s r" data-gf="no" data-id="${E(r.id)}" type="button">❌ رفض</button>`:""}
 ${isOwner()?`<button class="bt s" data-gf="edit" data-id="${E(r.id)}" type="button">✏️ تعديل</button><button class="bt s" data-gf="del" data-id="${E(r.id)}" type="button">🗑 حذف</button>`:""}</div></div>`;
}
// ---------- تبويب المستودع ----------
// البند (نوفمبر 2026، طلب محمد): نوع الهدية. "أخرى" بتشمل أي سبب مش من القايمة
const whyOk=r=>!F.why||(F.why==="أخرى"?(r.why==="أخرى"||!WHY.includes(r.why)):r.why===F.why);
// الفرع والبند بيتطبّقوا كمان على "بانتظار اعتمادك" و"بانتظار التسوية" و"العينات" (المدير يضيّق الطابور بسرعة)
const brWhy=r=>(!F.br||r.br===F.br)&&whyOk(r);
function filtered(){
 const a=F.from?new Date(F.from+"T00:00:00").getTime():0,b=F.to?new Date(F.to+"T23:59:59").getTime():Infinity;
 return all().filter(r=>N(r.ts)>=a&&N(r.ts)<=b&&brWhy(r)&&(!F.st||r.st===F.st)).sort((x,y)=>N(y.ts)-N(x.ts));
}
export function giftsView(){
 if(!X)return "";
 if(!F.from){F.from=new Date(Date.now()-30*D).toLocaleDateString("en-CA");F.to=today()}
 const rs=filtered(),pend=canApprove()?[...PEND.values()].filter(brWhy).sort((a,b)=>N(a.ts)-N(b.ts)):[];
 const toSet=canSettle()?all().filter(r=>r.st==="ok"&&brWhy(r)).sort((a,b)=>N(a.ap&&a.ap.at)-N(b.ap&&b.ap.at)):[];
 const ok=rs.filter(isAp),pcs=ok.reduce((s,r)=>s+net(r),0);
 const per={};ok.forEach(r=>{const k=r.br;(per[k]=per[k]||{n:0,p:0}).n++;per[k].p+=net(r)});
 const rets=all().filter(r=>canRet(r)&&brWhy(r)).sort((a,b)=>N(a.ap&&a.ap.at)-N(b.ap&&b.ap.at)),nWait=all().filter(waitRet).length;
 const brs=[...new Set(all().map(r=>r.br))].sort();
 return `<div class="fl" style="margin:0 0 12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center"><h2 style="margin:0">🎁 الهدايا والعينات</h2>${!X.noNew&&!X.view?`<button class="bt g" data-gf="new" type="button" style="margin-inline-start:auto">➕ هدية / عينة من المستودع</button>`:""}</div>
 <div class="gf-f"><div><small>من</small><input type="date" id="gff" value="${E(F.from)}"></div><div><small>إلى</small><input type="date" id="gft" value="${E(F.to)}"></div>
 <div><small>الفرع</small><select id="gfb"><option value="">كل الفروع والمستودع</option><option value="WH" ${F.br==="WH"?"selected":""}>المستودع</option>${(X.branches||[]).map(b=>{const c=String(b).split("-")[0];return `<option value="${E(c)}" ${F.br===c?"selected":""}>${E(b)}</option>`}).join("")}${brs.filter(c=>c!=="WH"&&!(X.branches||[]).some(b=>String(b).split("-")[0]===c)).map(c=>`<option value="${E(c)}" ${F.br===c?"selected":""}>${E(c)}</option>`).join("")}</select></div>
 <div><small>الحالة</small><select id="gfs"><option value="">الكل</option>${Object.entries(STL).filter(([k])=>!accOnly()||k==="ok"||k==="set").map(([k,v])=>`<option value="${k}" ${F.st===k?"selected":""}>${v}</option>`).join("")}</select></div>
 <div><small>البند</small><select id="gfw"><option value="">كل البنود</option>${WHY.map(w=>`<option ${F.why===w?"selected":""}>${E(w)}</option>`).join("")}</select></div>
 <div class="gf-act"><button class="bt" data-gf="print" type="button">🖨 تقرير PDF</button><button class="bt" data-gf="csv" type="button">⬇️ إكسل</button></div></div>
 <div class="gf-sum"><span>🎁 <b>${rs.length}</b> في الفترة</span><span>✅ <b>${ok.length}</b> معتمدة · <b>${fmt(pcs)}</b> قطعة صافي</span>${accOnly()?"":`<span>⏳ <b>${rs.filter(r=>r.st==="pend").length}</b> بانتظار</span>`}<span>🧾 <b>${rs.filter(r=>r.st==="set").length}</b> تمت تسويتها</span>${nWait?`<span>↩️ <b>${nWait}</b> عينة لم ترجع</span>`:""}${accOnly()?"":`<span>❌ <b>${rs.filter(r=>r.st==="no").length}</b> مرفوضة</span>`}</div>
 ${pend.length?`<div class="gf-pend"><h3 style="margin:0 0 8px">⏳ بانتظار اعتمادك (${pend.length})</h3>${pend.map(r=>card(r,true)).join("")}</div>`:""}
 ${rets.length?`<div class="gf-pend" style="background:#fff8ec"><h3 style="margin:0 0 4px">↩️ عينات المستودع بانتظار الرجوع (${rets.length})</h3><p class="off" style="font-size:13px;margin:0 0 10px">لما العينة ترجع للمستودع اضغط "رجعت العينة" واكتب العدد، ويُحسب الصافي للمحاسب.</p>${rets.map(r=>card(r,true)).join("")}</div>`:""}
 ${toSet.length?`<div class="gf-acc"><h3 style="margin:0 0 4px">🧾 معتمدة بانتظار التسوية (${toSet.length})</h3><p class="off" style="font-size:13px;margin:0 0 10px">بعد خصم الهدية من مخزون الفرع في النظام، اكتب رقم أو مرجع السند واضغط "تمت التسوية"، فيصل الفرع إشعار بذلك.</p>${toSet.map(r=>card(r,true,true)).join("")}</div>`:""}
 <h3 class="gf-lh">📋 كل الهدايا في الفترة (${rs.length})</h3>
 ${Object.keys(per).length>1?`<div class="pan" style="margin-bottom:12px"><h3 style="margin:0 0 8px">المعتمد لكل فرع</h3><div class="tw"><table><thead><tr><th>الفرع</th><th>عدد</th><th>قطع</th></tr></thead><tbody>${Object.entries(per).sort((a,b)=>b[1].p-a[1].p).map(([k,v])=>`<tr><td class="l"><bdi dir="ltr">${E(brName(k))}</bdi></td><td>${v.n}</td><td>${fmt(v.p)}</td></tr>`).join("")}</tbody></table></div></div>`:""}
 ${rs.length?rs.map(r=>card(r,true)).join(""):'<div class="pan off" style="text-align:center;padding:24px">لا توجد هدايا في هذه الفترة</div>'}`;
}
// لو الفترة أقدم من اللي بيتسمع لايف: نحمّلها مرة واحدة
async function ensureRange(){
 if(accOnly()){
  const a=new Date((F.from||today())+"T00:00:00"),b=new Date((F.to||today())+"T00:00:00"),ms=[];const d=new Date(a.getFullYear(),a.getMonth(),1);
  while(d<=b&&ms.length<24){ms.push(d.toLocaleDateString("en-CA").slice(0,7));d.setMonth(d.getMonth()+1)}
  try{for(const m of ms.filter(m=>!MON.has(m))){const sn=await getDocs(query(collection(X.db,"gifts"),where("st","==","set"),where("sm","==",m)));sn.docs.forEach(x=>OLD.set(x.id,{id:x.id,...x.data()}));MON.add(m)}}
  catch(e){X.toast("تعذر تحميل هذه الفترة، تأكد من الإنترنت")}
  return;
 }
 const a=F.from?new Date(F.from+"T00:00:00").getTime():0;if(a>=Date.now()-LIVE*D)return;
 const b=Math.min(F.to?new Date(F.to+"T23:59:59").getTime():Date.now(),Date.now()-LIVE*D);
 try{const sn=await getDocs(query(collection(X.db,"gifts"),where("ts",">=",a),where("ts","<=",b)));sn.docs.forEach(d=>OLD.set(d.id,{id:d.id,...d.data()}))}
 catch(e){X.toast("تعذر تحميل هذه الفترة، تأكد من الإنترنت")}
}
// ---------- النافذة ----------
function box(){let m=g("gfm");if(!m){m=document.createElement("div");m.id="gfm";m.className="gfm";m.addEventListener("click",e=>{if(e.target===m)closeM()});document.body.appendChild(m)}return m}
function openM(h,v){const m=box();m.innerHTML=`<div class="gfk">${h}</div>`;m.className="gfm on";m.dataset.v=v||""}
function closeM(){const m=g("gfm");if(m){m.className="gfm";m.innerHTML="";m.dataset.v=""}img="";imgBusy=false;edit=null}
// ---------- نموذج التسجيل ----------
const rowHtml=(x={})=>`<div class="gf-row"><input data-r="k" placeholder="الكود" dir="ltr" maxlength="40" value="${E(x.k||"")}"><input data-r="c" placeholder="اللون" maxlength="40" value="${E(x.c||"")}"><input data-r="z" placeholder="المقاس" maxlength="20" value="${E(x.z||"")}"><input data-r="q" placeholder="العدد" inputmode="numeric" value="${x.q?E(x.q):""}"><button type="button" data-gf="rmrow" title="احذف السطر">✕</button></div>`;
function form(r){
 edit=r||null;img="";imgBusy=false;
 const wh=X.mode!=="branch",autoName=wh?String(X.me.n||X.me.e||""):String(X.brn||X.code||"");
 openM(`<h3>${r?"✏️ تعديل":"🎁 تسجيل"} هدية / عينة</h3><div style="color:var(--mut);font-size:13.5px">${r?`<bdi dir="ltr">${E(r.no)}</bdi> · ${E(r.brn||brName(r.br))}`:wh?"من المستودع — ستُرسل إلى مدير التسويق ليعتمدها":"من "+E(X.brn)+" — ستُرسل إلى مدير التسويق ليعتمدها"}</div>
 <label>الأصناف</label><div class="gf-rows" id="gfrows">${(r&&Array.isArray(r.rows)&&r.rows.length?r.rows:[{}]).map(rowHtml).join("")}</div>
 <button class="bt s" data-gf="addrow" type="button" style="margin-top:6px;width:auto">➕ صنف</button>
 <div class="gf-2"><div><label>اسم المستلم *</label><input id="gfn" maxlength="60" value="${E(r&&r.to&&r.to.n||"")}" placeholder="مثلاً: أ. محمد علي"></div>
 <div><label>جوال المستلم</label><input id="gfp" maxlength="20" inputmode="tel" dir="ltr" value="${E(r&&r.to&&r.to.ph||"")}" placeholder="05xxxxxxxx"></div></div>
 <div class="gf-2"><div><label>السبب *</label><select id="gfw">${WHY.map(w=>`<option ${r&&r.why===w?"selected":""}>${E(w)}</option>`).join("")}</select></div>
 <div><label>المسجِّل (تلقائي)</label><input id="gfby" dir="auto" maxlength="60" value="${E(r&&r.by?r.by.n:autoName)}" disabled title="يُكتب تلقائياً باسم الحساب الداخل"></div></div>
 <label>ملاحظة</label><textarea id="gfnote" rows="2" maxlength="300" placeholder="اختياري">${E(r&&r.note||"")}</textarea>
 <label>صورة السند (اختياري)</label><input type="file" id="gff1" accept="image/*" hidden><label class="gf-up" id="gfup" for="gff1"><span id="gfupt">📎 ${r?"صورة سند جديدة (اختياري)":"اضغط هنا لإضافة صورة السند (اختياري)"}</span><img id="gfupi" alt="" hidden></label>
 <div class="gf-act"><button class="bt p" data-gf="save" type="button">${r?"💾 حفظ التعديل":"✅ تسجيل"}</button><button class="bt" data-gf="${X.mode==="branch"&&!r?"bopen":"close"}" type="button">رجوع</button></div>`,"form");
 g("gff1").onchange=async()=>{const f=g("gff1").files[0],u=g("gfup"),tx=g("gfupt"),pv=g("gfupi");if(!f)return;imgBusy=true;u.className="gf-up";tx.textContent="⏳ جاري تجهيز الصورة...";pv.hidden=true;
  try{img=await shrink(f,1400,230000);u.className="gf-up ok";tx.textContent="✅ السند جاهز (اضغط مجدداً إن أردت تغييره)";pv.src=img;pv.hidden=false}
  catch(e){img="";tx.textContent="⚠️ الصورة غير صالحة، حاول مجدداً"}
  imgBusy=false};
}
async function save(){
 if(imgBusy){X.toast("انتظر حتى تنتهي الصورة");return}
 const rows=[...document.querySelectorAll("#gfrows .gf-row")].map(el=>{const v=k=>el.querySelector(`[data-r="${k}"]`).value.trim();return {k:v("k").slice(0,40),c:v("c").slice(0,40),z:v("z").slice(0,20),q:Math.min(99999,Math.round(N(toEn(v("q")))))}}).filter(x=>x.k&&x.q>0).map(x=>{const o={k:x.k,q:x.q};if(x.c)o.c=x.c;if(x.z)o.z=x.z;return o});
 const to={n:g("gfn").value.trim().slice(0,60)},ph=toEn(g("gfp").value).replace(/[^\d+]/g,"").slice(0,20);if(ph)to.ph=ph;
 const why=g("gfw").value,note=g("gfnote").value.trim().slice(0,300),byN=g("gfby").value.trim().slice(0,60);
 if(!rows.length){X.toast("اكتب صنفاً واحداً على الأقل (الكود والعدد)");return}
 if(rows.length>100){X.toast("الأصناف كثيرة جداً (أكثر من 100)");return}
 if(!to.n){X.toast("اكتب اسم المستلم");return}
 if(!byN){X.toast("اكتب اسمك");return}
 
 const btn=document.querySelector('[data-gf="save"]');if(btn){btn.disabled=true;btn.textContent="⏳ جاري الحفظ..."}
 try{
  const pcs=rows.reduce((s,x)=>s+x.q,0);
  if(edit){// المالك بس
   const d={...edit,rows,pcs,to,why,note};delete d.id;if(!note)delete d.note;if(img)d.img=1;
   const b=writeBatch(X.db);b.set(doc(X.db,"gifts",edit.id),d);if(img)b.set(doc(X.db,"giftimg",edit.id),{img});
   await withTimeout(b.commit(),20000);X.toast("تم حفظ التعديل ✅");closeM();if(X.mode==="branch")openBranch();return;
  }
  const wh=X.mode!=="branch",ts=Date.now(),dd=new Date(ts),p=n=>String(n).padStart(2,"0"),br=wh?"WH":X.code;
  const ref=doc(collection(X.db,"gifts")),no=`G-${br}-${p(dd.getMonth()+1)}${p(dd.getDate())}-${p(dd.getHours())}${p(dd.getMinutes())}`;
  const d={br,brn:wh?"المستودع":String(X.brn||br).slice(0,40),no,ts,dt:today(),rows,pcs,to,why,by:{e:X.me.e,n:byN},st:"pend"};
  if(note)d.note=note;if(img)d.img=1;
  const b=writeBatch(X.db);b.set(ref,d);if(img)b.set(doc(X.db,"giftimg",ref.id),{img});
  await withTimeout(b.commit(),20000);
  if(X.ping)X.ping([ref.id]);
  X.toast("سُجّلت ✅ وبانتظار اعتماد مدير التسويق");
  if(X.mode==="branch")openBranch();else closeM();
 }catch(e){if(btn){btn.disabled=false;btn.textContent=edit?"💾 حفظ التعديل":"✅ تسجيل"}const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":FAIL_MSG[w],"er")}
}
// ---------- الاعتماد / الرفض ----------
async function decide(id,ok,rt){
 const r=PEND.get(id)||L.get(id);if(!r||r.st!=="pend")return;
 let note="";if(!ok){note=(prompt(`سبب رفض هدية ${r.no}؟`)||"").trim().slice(0,300);if(!note){X.toast("يجب كتابة سبب الرفض");return}}
 else if(isSample(r)&&rt===undefined){// العينة: نسأل هترجع ولا لأ قبل الاعتماد
  openM(`<h3>✅ اعتماد عينة <bdi dir="ltr">${E(r.no)}</bdi></h3><div style="color:var(--mut);font-size:14px"><bdi dir="ltr">${E(r.brn||brName(r.br))}</bdi> · ${N(r.pcs)} قطعة · ${E(itemsTxt(r))}</div>
  <div style="font-weight:800;font-size:17px;margin-top:14px">هل هذه العينة سترجع؟</div>
  <div class="gf-rt"><button class="y" data-gf="okrt" data-id="${E(id)}" type="button">↩️ اعتماد — العينة سترجع<small>تظهر "لم ترجع بعد" حتى ${r.br==="WH"?"يسجّل المستودع":"يسجّل الفرع"} رجوعها، ويسوّي المحاسب الصافي فقط</small></button>
  <button data-gf="oknort" data-id="${E(id)}" type="button">✅ اعتماد — العينة لا ترجع<small>تُعامَل مثل الهدية وتُسوّى كاملة</small></button></div>
  <div class="gf-act"><button class="bt" data-gf="close" type="button">إلغاء</button></div>`,"rt");
  return;
 }
 else if(!isSample(r)&&!confirm(`اعتماد هدية ${r.no} (${r.brn||brName(r.br)} · ${N(r.pcs)} قطعة)؟`))return;
 const ap={e:X.me.e,n:String(X.me.n||X.me.e).slice(0,60),at:Date.now()};if(note)ap.note=note;
 const u={st:ok?"ok":"no",ap};if(ok&&isSample(r))u.rt=rt===true;
 try{await withTimeout(updateDoc(doc(X.db,"gifts",id),u),15000);closeM();if(X.ping)X.ping([id]);X.toast(ok?(u.rt?"اعتُمدت ✅ — العينة سترجع، وأُبلغ الفرع":"اعتُمدت ✅"):"رُفضت")}
 catch(e){const w=await failReason(e);X.toast(w==="denied"?"غير مسموح (ربما اعتمدها شخص آخر)":FAIL_MSG[w])}
}
// ---------- ورقة الهدية: كل التفاصيل بشكل مرتب (زي ورقة تحميل النواقص) + الأزرار ----------
function sheetHtml(r,print){
 const st=r.st||"pend",ap=r.ap||{},rows=Array.isArray(r.rows)?r.rows:[],rl=r.rb&&Array.isArray(r.rb.lines)?r.rb.lines:null;
 const step=(on,cls,t,s)=>`<div class="${on?cls||"on":""}"><b>${t}</b>${s||""}</div>`;
 return `<div class="gs-rt"><div><small>من</small><b><bdi dir="ltr">${E(r.brn||brName(r.br))}</bdi></b></div><div class="ar">←</div><div class="to"><small>إلى (المستلم)</small><b>${E(r.to&&r.to.n||"")}</b>${r.to&&r.to.ph?`<small><bdi dir="ltr">${E(r.to.ph)}</bdi></small>`:""}</div></div>
 <div class="gs-mt"><div><small>السبب</small><b>🏷 ${E(r.why||"")}</b></div><div><small>التاريخ</small><b><bdi dir="ltr">${E(r.dt||"")}</bdi> · ${new Date(N(r.ts)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</b></div><div><small>سجّلها</small><b><bdi>${E(r.by&&r.by.n||"")}</bdi></b></div><div><small>السند</small><b>${r.img?"📎 مرفق":"بدون مرفق"}</b></div></div>
 <table class="gs-tb"><thead><tr><th>#</th><th>الكود</th><th>اللون</th><th>المقاس</th><th>العدد</th>${rl?"<th>رجع</th>":""}</tr></thead><tbody>
 ${rows.map((x,i)=>`<tr><td>${i+1}</td><td class="k">${E(x.k||"")}</td><td><bdi dir="ltr">${E(x.c||"—")}</bdi></td><td><bdi dir="ltr">${E(x.z||"—")}</bdi></td><td class="q">${N(x.q)}</td>${rl?`<td class="q rq">${N(rl[i])}</td>`:""}</tr>`).join("")}</tbody>
 <tfoot><tr><td colspan="4" style="text-align:start">الإجمالي: ${rows.length} صنف</td><td class="q">${N(r.pcs)}</td>${rl?`<td class="q rq">${retQ(r)}</td>`:""}</tr>${r.rb?`<tr><td colspan="${rl?6:5}" style="text-align:start;color:#1d5a24">الصافي بعد الرجوع: ${net(r)} قطعة</td></tr>`:""}</tfoot></table>
 ${r.note?`<div class="gs-nt">📝 ${E(r.note)}</div>`:""}
 ${st==="no"&&ap.note?`<div class="gs-nt" style="background:#fbe3e0;border-color:#c4362b">❌ سبب الرفض: ${E(ap.note)}</div>`:""}
 ${print?"":`<div class="gs-tl">${step(true,"on","1. التسجيل",`<bdi>${E(r.by&&r.by.n||"")}</bdi><br>${hm(r.ts)}`)}${step(st!=="pend",st==="no"?"no":"on",st==="no"?"2. مرفوضة":"2. الاعتماد",ap.n?`${E(ap.n)}<br>${hm(ap.at)}`:"بانتظار مدير التسويق")}${r.rt===true?step(!!r.rb,"on","↩️ رجوع العينة",r.rb?`${N(r.rb.q)} قطعة<br>${hm(r.rb.at)}`:"لم ترجع بعد"):""}${step(st==="set","on","3. التسوية",r.sa?`مرجع <bdi dir="ltr">${E(r.sa.ref||"")}</bdi><br>${hm(r.sa.at)}`:"بانتظار المحاسب")}</div>`}`;
}
function viewGift(id){
 const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(!r)return;
 const st=r.st||"pend",wh=X.mode!=="branch";
 openM(`<div class="gs"><div class="gs-hd"><img src="./icon-192.png" alt=""><div><b>${isSample(r)?"سند عينة":"سند هدية"}</b><small>${E(r.no)}</small></div><span class="gf-st ${st}">${STL[st]||st}</span></div>
 <div class="gs-bd">${sheetHtml(r)}
 <div class="gs-ac">${wh&&canApprove()&&st==="pend"?`<button class="bt g" data-gf="ok" data-id="${E(r.id)}" type="button">✅ اعتماد</button><button class="bt r" data-gf="no" data-id="${E(r.id)}" type="button">❌ رفض</button>`:""}
 ${canRet(r)?`<button class="bt g" data-gf="ret" data-id="${E(r.id)}" type="button">↩️ رجعت العينة</button>`:""}
 ${r.img?`<button class="bt" data-gf="img" data-id="${E(r.id)}" type="button">📎 صورة السند</button>`:""}
 <button class="bt" data-gf="gprint" data-id="${E(r.id)}" type="button">🖨 طباعة</button>
 <button class="bt" data-gf="${wh?"close":"bopen"}" type="button">رجوع</button></div></div></div>`,"view");
}
function printGift(id){
 const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(!r)return;
 printStmt(`<div class="st"><div class="ph"><h2>${isSample(r)?"سند عينة":"سند هدية"}</h2><div>${E(r.no)} · ${E((STL[r.st]||"").replace(/^\S+\s/,""))}</div></div>
 <style>.gs-rt{display:flex;gap:8px;margin:4mm 0}.gs-rt>div{flex:1;border:1px solid #999;border-radius:6px;padding:2mm 3mm}.gs-rt .ar{flex:none;border:0;align-self:center;font-size:16pt}.gs-rt small{display:block;font-size:8pt;color:#555}.gs-rt b{font-size:12pt}
 .gs-mt{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm;margin-bottom:4mm}.gs-mt div{border:1px solid #ccc;border-radius:4px;padding:1.5mm 2mm}.gs-mt small{display:block;font-size:8pt;color:#555}
 .gs-tb{width:100%;border-collapse:collapse}.gs-tb th,.gs-tb td{border:1px solid #999;padding:2mm;text-align:center}.gs-tb td.k{font-weight:700}.gs-nt{margin-top:3mm;border:1px solid #ccc;padding:2mm}</style>
 ${sheetHtml(r,true)}
 <div class="sg"><span>سجّلها: <bdi>${E(r.by&&r.by.n||"")}</bdi></span><span>اعتمدها: ${E(r.ap&&r.ap.n||"")}</span><span>المستلم</span></div></div>`);
}
// ---------- رجوع العينة (اللي طلّعها: الفرع أو المستودع) ----------
function retForm(id){
 const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(!r||!canRet(r))return;
 const rows=Array.isArray(r.rows)?r.rows:[];
 openM(`<h3>↩️ رجوع العينة <bdi dir="ltr">${E(r.no)}</bdi></h3><div style="color:var(--mut);font-size:14px">اكتب عدد ما رجع من كل صنف (يمكن أن يكون أقل من الذي خرج)، وسيُحسب الصافي تلقائياً للمحاسب.</div>
 <div style="margin-top:12px"><div class="gf-rr" style="font-size:13px;color:var(--mut);font-weight:700"><span>الصنف</span><span style="text-align:center">خرج</span><span style="text-align:center">رجع</span></div>
 ${rows.map((x,i)=>`<div class="gf-rr"><bdi dir="ltr">${E([x.k,x.c,x.z].filter(Boolean).join(" "))}</bdi><b style="text-align:center">${N(x.q)}</b><input data-rq="${i}" data-max="${N(x.q)}" inputmode="numeric" value="${N(x.q)}"></div>`).join("")}</div>
 <label>ملاحظة</label><textarea id="gfrn" rows="2" maxlength="200" placeholder="اختياري (مثلاً: رجعت بحالة جيدة)"></textarea>
 <div class="gf-act"><button class="bt p" data-gf="retsave" data-id="${E(id)}" type="button">✅ تسجيل الرجوع</button><button class="bt" data-gf="${X.mode==="branch"?"bopen":"close"}" type="button">رجوع</button></div>`,"ret");
}
async function retSave(id){
 const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(!r||!canRet(r))return;
 const lines=[...document.querySelectorAll("[data-rq]")].map(el=>Math.max(0,Math.min(N(el.dataset.max),Math.round(N(toEn(el.value))))));
 const q=lines.reduce((a,b)=>a+b,0);if(!q){X.toast("اكتب عدد ما رجع (قطعة واحدة على الأقل)");return}
 const by=String(X.mode==="branch"?(X.brn||X.code):(X.me.n||X.me.e)).slice(0,60);
 const note=String((g("gfrn")||{}).value||"").trim().slice(0,200);
 if(!confirm(`تسجيل رجوع ${q} من ${N(r.pcs)} قطعة؟ الصافي للتسوية سيكون ${N(r.pcs)-q} قطعة.`))return;
 const rb={e:X.me.e,n:by,at:Date.now(),q,lines};if(note)rb.note=note;
 try{await withTimeout(updateDoc(doc(X.db,"gifts",id),{rb}),15000);
  if(X.ping)X.ping([id]);X.toast("↩️ سُجّل رجوع العينة، وأُبلغ المحاسب");if(X.mode==="branch")openBranch();else{closeM();if(X.redraw)X.redraw()}}
 catch(e){const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":FAIL_MSG[w])}
}
// ---------- التسوية (المحاسب) ----------
async function settle(id){
 const r=all().find(x=>x.id===id);if(!r||r.st!=="ok")return;
 const inp=[...document.querySelectorAll("[data-gfref]")].find(x=>x.dataset.gfref===id),ref=String(inp&&inp.value||"").trim().slice(0,60);
 if(!ref){X.toast("اكتب رقم أو مرجع السند في النظام أولاً");if(inp)inp.focus();return}
 if(waitRet(r)&&!confirm(`العينة ${r.no} لم ترجع بعد. تسويتها الآن كاملة (${N(r.pcs)} قطعة)؟\n\nالأفضل الانتظار حتى ترجع وتسوية الصافي فقط.`))return;
 if(!confirm(`تسوية ${r.no} (${r.brn||brName(r.br)} · الصافي ${net(r)} قطعة${r.rb?` بعد رجوع ${retQ(r)}`:""}) بمرجع ${ref}؟\nسيصل الفرع إشعار بأنها خُصمت من مخزونه.`))return;
 const sa={e:X.me.e,n:String(X.me.n||X.me.e).slice(0,60),at:Date.now(),ref,net:net(r)};
 try{await withTimeout(updateDoc(doc(X.db,"gifts",id),{st:"set",sa,sm:ymOf(r.ts)}),15000);L.delete(id);OLD.set(id,{...r,st:"set",sa,sm:ymOf(r.ts)});if(X.ping)X.ping([id]);X.toast("🧾 تمت التسوية، وأُبلغ الفرع");if(X.redraw)X.redraw()}
 catch(e){const w=await failReason(e);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":FAIL_MSG[w])}
}
// ---------- السند ----------
async function showImg(id){
 const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);
 try{const s=await withTimeout(getDoc(doc(X.db,"giftimg",id)),15000);const im=s.exists()?s.data().img:"";
  if(!im){X.toast("لا توجد صورة سند (ربما حُذفت)");return}
  zoomOpen(im,`سند ${r?r.no:""} · ${r?(r.brn||brName(r.br)):""}`,`giftimg/${id}/img`);
 }catch(e){X.toast(e&&e.code==="permission-denied"?"غير مسموح لك برؤية هذا السند":"تعذر تحميل السند، تأكد من الإنترنت")}
}
// ---------- التقارير ----------
function reportRows(){return filtered()}
function printReport(){
 const rs=reportRows(),ok=rs.filter(isAp),per={};ok.forEach(r=>{(per[r.br]=per[r.br]||{n:0,p:0}).n++;per[r.br].p+=net(r)});
 const who=F.br?brName(F.br):"كل الفروع والمستودع",stl=F.st?STL[F.st]:"كل الحالات";
 printStmt(`<div class="st"><div class="ph"><h2>تقرير الهدايا والعينات</h2><div>${E(today())}</div></div>
 <div class="rt"><div><small>الفرع</small><b><bdi dir="ltr">${E(who)}</bdi></b></div><div><small>الفترة</small><b style="font-size:11pt">${E(F.from||"—")} ← ${E(F.to||today())}</b></div><div><small>الحالة</small><b style="font-size:11pt">${E(stl)}</b></div><div><small>البند</small><b style="font-size:11pt">${E(F.why||"كل البنود")}</b></div></div>
 ${Object.keys(per).length?`<table class="stt" style="margin-bottom:5mm"><thead><tr><th>الفرع</th><th>عدد المعتمد</th><th>قطع (صافي)</th></tr></thead><tbody>${Object.entries(per).map(([k,v])=>`<tr><td>${E(brName(k))}</td><td class="n">${v.n}</td><td class="n">${fmt(v.p)}</td></tr>`).join("")}</tbody></table>`:""}
 <table class="stt"><thead><tr><th>#</th><th>التاريخ</th><th>الفرع</th><th>الرقم</th><th>المستلم</th><th>السبب</th><th>الأصناف</th><th>قطع</th><th>رجع / الصافي</th><th>الحالة</th><th>سجّلها / اعتمدها</th><th>مرجع السند</th></tr></thead><tbody>
 ${rs.map((r,i)=>`<tr><td>${i+1}</td><td>${E(r.dt||"")}</td><td>${E(r.brn||brName(r.br))}</td><td>${E(r.no)}</td><td>${E(r.to&&r.to.n||"")}${r.to&&r.to.ph?"<br>"+E(r.to.ph):""}</td><td>${E(r.why||"")}${r.note?"<br>"+E(r.note):""}</td><td>${E(itemsTxt(r))}</td><td class="n">${N(r.pcs)}</td><td class="n">${r.rb?retQ(r)+" / "+net(r):r.rt===true?"لم ترجع":"—"}</td><td>${E((STL[r.st]||"").replace(/^\S+\s/,""))}${r.st==="no"&&r.ap&&r.ap.note?"<br>"+E(r.ap.note):""}</td><td><bdi>${E(r.by&&r.by.n||"")}</bdi>${r.ap&&r.ap.n?"<br>"+E(r.ap.n):""}</td><td>${r.sa?E(r.sa.ref||"")+"<br>"+E(r.sa.n||""):""}</td></tr>`).join("")||'<tr><td colspan="12" style="text-align:center">لا توجد هدايا</td></tr>'}</tbody></table>
 <div class="tt"><span>العدد ${rs.length}</span><span>المعتمد ${ok.length}</span><span><b>قطع معتمدة (صافي) ${fmt(ok.reduce((s,r)=>s+net(r),0))}</b></span></div>
 <div class="sg"><span>المحاسب</span><span>مدير المستودع</span><span>المدير</span></div></div>`);
}
function csv(){
 const rs=reportRows(),q=v=>{const s=String(v==null?"":v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
 const head=["التاريخ","الوقت","الفرع","الرقم","المستلم","جوال المستلم","السبب","ملاحظة","الأصناف","عدد القطع","الحالة","سجّلها","اعتمدها/رفضها","وقت الاعتماد","سبب الرفض","فيه سند","مرجع السند في النظام","سوّاها","وقت التسوية","العينة ترجع؟","رجع","الصافي"];
 const lines=rs.map(r=>[r.dt,new Date(N(r.ts)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),r.brn||brName(r.br),r.no,r.to&&r.to.n,r.to&&r.to.ph?`="${r.to.ph}"`:"",r.why,r.note,itemsTxt(r),N(r.pcs),(STL[r.st]||"").replace(/^\S+\s/,""),r.by&&r.by.n,r.ap&&r.ap.n,r.ap&&r.ap.at?new Date(N(r.ap.at)).toLocaleString("en-GB"):"",r.st==="no"&&r.ap?r.ap.note:"",r.img?"نعم":"لا",r.sa?r.sa.ref:"",r.sa?r.sa.n:"",r.sa&&r.sa.at?new Date(N(r.sa.at)).toLocaleString("en-GB"):"",r.rt===true?"نعم":r.rt===false?"لا":"",r.rb?retQ(r):"",isAp(r)?net(r):""].map(q).join(","));
 const blob=new Blob(["﻿"+[head.join(","),...lines].join("\r\n")],{type:"text/csv;charset=utf-8"});
 const u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download=`tasooma-gifts-${F.br||"all"}-${F.from}-${F.to}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
}
// ---------- الأحداث ----------
async function click(e){
 const t=e.target.closest("[data-gf]");if(!t||!X)return;const a=t.dataset.gf,id=t.dataset.id;
 if(a==="bopen")return void openBranch();
 if(a==="close")return void closeM();
 if(a==="new")return void form(null);
 if(a==="addrow"){const w=g("gfrows");if(w&&w.children.length<100)w.insertAdjacentHTML("beforeend",rowHtml());return}
 if(a==="rmrow"){const w=g("gfrows"),row=t.closest(".gf-row");if(w&&row&&w.children.length>1)row.remove();return}
 if(a==="save")return void save();
 if(a==="img")return void showImg(id);
 if(a==="ok"||a==="no")return void decide(id,a==="ok");
 if(a==="okrt"||a==="oknort")return void decide(id,true,a==="okrt");
 if(a==="ret")return void retForm(id);
 if(a==="view")return void viewGift(id);
 if(a==="gprint")return void printGift(id);
 if(a==="retsave")return void retSave(id);
 if(a==="set")return void settle(id);
 if(a==="print")return void printReport();
 if(a==="csv")return void csv();
 if(a==="edit"){if(!isOwner())return;const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(r)form(r);return}
 if(a==="del"){if(!isOwner())return;const r=all().find(x=>x.id===id)||BL.find(x=>x.id===id);if(!r||!confirm(`حذف هدية ${r.no} نهائياً مع السند الخاص بها؟`))return;
  try{const b=writeBatch(X.db);b.delete(doc(X.db,"gifts",id));b.delete(doc(X.db,"giftimg",id));await withTimeout(b.commit(),15000);L.delete(id);OLD.delete(id);PEND.delete(id);X.toast("حُذفت");if(X.redraw)X.redraw()}
  catch(e){X.toast("تعذر الحذف")}}
}
function change(e){
 const id=e.target&&e.target.id;if(!X||!["gff","gft","gfb","gfs","gfw"].includes(id))return;
 if(id==="gff")F.from=e.target.value;if(id==="gft")F.to=e.target.value;if(id==="gfb")F.br=e.target.value;if(id==="gfs")F.st=e.target.value;if(id==="gfw")F.why=e.target.value;
 if(F.from&&F.to&&F.from>F.to)[F.from,F.to]=[F.to,F.from];
 ensureRange().then(()=>X.redraw());
}
