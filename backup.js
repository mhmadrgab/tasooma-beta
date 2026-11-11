// النسخة الاحتياطية (لمالك النظام بس): زرار "📥 نسخة" بيحمّل بيانات المنصة في ملف JSON على الجهاز.
// أول نسخة = كل حاجة. بعد كده (علشان حصة القراءة اليومية في الخطة المجانية): الطلبات والرحلات والبنزين ورسايل الدردشة
// من 60 يوم قبل آخر نسخة + الطلبات المفتوحة، وباقي البيانات (الفروع، العهدة، الموظفين، العربيات...) كاملة كل مرة.
// علشان كده لازم كل الملفات تتحفظ مع بعض. مش بتشمل: كلمات السر، وتسجيلات الإشعارات، والصوت نفسه.
// meta/backup = {at, n}: آخر نسخة إمتى وكام سجل (للتنبيه لو عدّى أسبوع).
import {collection,doc,getDoc,getDocs,setDoc,query,where,withTimeout} from "./fb.js";
// (الدردشة القديم "chats" اتمسح. الدردشة الخاص dm مش في النسخة: القواعد مش بتسمح إلى يقرا محادثات غيره، ولا حتى المالك)
const ALL=["branches","staff","ledger","settlements","drivers","workers","wrate","geo","cars","whdir"];
const BYTIME=[["requests","ts"],["trips","start"],["fuel","ts"],["pods","at"],["log","ts"]];
const OVERLAP=60*864e5,NAG=7*864e5;
const STYLE=`#bkp{position:relative;white-space:nowrap}#bkp .bkd{position:absolute;top:1px;inset-inline-end:1px;width:10px;height:10px;border-radius:50%;background:#e5484d;border:2px solid #1b1b1b}
.bkn{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin:0 0 14px;padding:11px 14px;border-radius:14px;background:#fff4e2;border:1px solid #efc47c;color:#6b4300;font-weight:700;font-size:14px}
.bkn button{font:inherit;font-size:13.5px;border:0;border-radius:999px;background:#1b1b1b;color:#fff;padding:7px 15px;cursor:pointer}
@media (prefers-color-scheme:dark){.bkn{background:#2b2210;border-color:#6b5226;color:#f0d49a}.bkn button{background:#d4ae5c;color:#1b1b1b}}`;
let X=null,META=null,busy=false;
const N=x=>Number.isFinite(+x)?+x:0;
const dd=t=>new Date(t).toLocaleDateString("en-GB");
const late=()=>!!(X&&X.owner&&META&&Date.now()-N(META.at)>NAG);

export function initBackup(ctx){
  X=ctx;META=null;busy=false;if(!X.owner)return;
  if(!document.getElementById("bk-css")){const s=document.createElement("style");s.id="bk-css";s.textContent=STYLE;document.head.appendChild(s)}
  if(!window.__bkc){window.__bkc=1;document.addEventListener("click",e=>{if(e.target.closest("#bkp,[data-bkp]"))run()})}
  getDoc(doc(X.db,"meta","backup")).then(s=>{if(!X||X!==ctx)return;META=s.exists()?s.data():{};if(late())X.redraw()}).catch(()=>{});
}
export function stopBackup(){X=null;META=null}
// زرار في شريط اللوحة (عليه نقطة حمرا لو النسخة متأخرة)
export const backupBtn=()=>X&&X.owner?`<button id="bkp" type="button" title="نسخة احتياطية">📥 نسخة${late()?'<i class="bkd"></i>':""}</button>`:"";
// تنبيه فوق الصفحة لو عدّى أسبوع من غير نسخة
export const backupNag=()=>late()?`<div class="bkn"><span>💾 ${N(META.at)?`آخر نسخة احتياطية من ${Math.floor((Date.now()-N(META.at))/864e5)} يوم`:"لم تأخذ أي نسخة احتياطية من بيانات المنصة بعد"}</span><button data-bkp type="button">📥 خذ نسخة الآن</button></div>`:"";

async function run(){
  if(busy||!X||!X.owner)return;
  const ctx=X;
  if(!META){try{const s=await withTimeout(getDoc(doc(ctx.db,"meta","backup")),15000);META=s.exists()?s.data():{}}catch(e){return void ctx.toast("تعذر الاتصال. تأكد من الإنترنت وحاول مجدداً")}}
  const full=!N(META.at),from=full?0:N(META.at)-OVERLAP;
  if(!confirm(full?"ستأخذ نسخة كاملة من كل بيانات المنصة، وستُحمَّل كملف على هذا الجهاز. قد تستغرق دقيقة.\n\nهل تريد المتابعة؟"
    :`ستأخذ نسخة من بيانات المنصة (الطلبات والرحلات ورسائل الدردشة من ${dd(from)} حتى اليوم، وكل الباقي كاملاً).\n\nاحفظ هذا الملف مع النسخ القديمة في مكان واحد (مثلاً Google Drive).\n\nهل تريد المتابعة؟`))return;
  busy=true;ctx.toast("⏳ جاري تجهيز النسخة الاحتياطية...");
  try{
    const at=Date.now(),out={app:"tasooma",v:1,at,from,full,data:{},chat:{}};let n=0;
    const take=(sn,o={})=>{sn.docs.forEach(d=>{if(!(d.id in o))n++;o[d.id]=d.data()});return o};
    const get=(q,ms=60000)=>withTimeout(getDocs(q),ms);
    for(const c of ALL)out.data[c]=take(await get(collection(ctx.db,c)));
    for(const [c,f] of BYTIME)out.data[c]=take(await get(full?collection(ctx.db,c):query(collection(ctx.db,c),where(f,">=",from)),120000));
    // الطلبات اللي لا يزال مفتوحة حتى لو قديمة
    if(!full)take(await get(query(collection(ctx.db,"requests"),where("st","in",["new","prep","go","done"]))),out.data.requests);
    const blob=new Blob([JSON.stringify(out)],{type:"application/json"});
    save(blob,`tasooma-backup-${new Date(at).toLocaleDateString("en-CA")}${full?"-full":""}.json`);
    await withTimeout(setDoc(doc(ctx.db,"meta","backup"),{at,n}),15000).catch(()=>{});
    if(X===ctx){META={at,n};ctx.redraw()}
    ctx.toast(`✅ تم تحميل النسخة (${n} سجل · ${blob.size<1048576?Math.max(1,Math.round(blob.size/1024))+" كيلو":(blob.size/1048576).toFixed(1)+" ميجا"}). احفظ الملف في Google Drive أو ذاكرة فلاش`);
  }catch(e){
    ctx.toast(e&&e.code==="permission-denied"?"غير مسموح: تأكد من نشر القواعد (Rules) الجديدة":"تعذر أخذ النسخة. تأكد من الإنترنت وحاول مجدداً");
  }finally{busy=false}
}
function save(blob,name){
  const u=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=u;a.download=name;a.style.display="none";document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),60000);
}
