// 🟢 "متصل الآن" و"آخر ظهور" في الشات (نوفمبر 2026، طلب محمد).
// على Firebase Realtime Database مش Firestore: الحضور بيتغيّر كتير، ولو على Firestore كل تغيير بيتقري عند كل الناس فالحصة المجانية
// (50 ألف قراءة) كانت هتخلص في ساعات. Realtime Database المجانية: 100 اتصال في نفس الوقت، و10 جيجا تحميل في الشهر (الحضور كام بايت).
// on/{الطرف}/{الجهاز} = {on: فاتح والصفحة قدامه, ts: آخر تغيير (وقت السيرفر)}. الطرف = b-003 / d-drv1 / w-الإيميل (النقطة ← فاصلة)
// "onDisconnect": لو النت فصل أو الصفحة اتقفلت، سيرفر Firebase نفسه بيكتب on:false. ولو الصفحة راحت في الخلفية (الموبايل) بنكتب on:false.
// قاعدة البيانات لازم تتعمل مرة واحدة من Firebase (الولايات المتحدة us-central1)، والقواعد في database.rules.json
// ── على Supabase (النقل، نوفمبر 2026): لو app.sb موجود بنستخدم Realtime Presence (قناة خاصة "tz-presence"، للي داخل بس)
//    بدل Realtime Database. "آخر ظهور" بيتحفظ في seen/{الطرف} = {ts} لما الصفحة تروح الخلفية أو تتقفل، وكل 5 دقايق وهي قدامه،
//    وبيتقري مرة واحدة + كل 5 دقايق (مش لايف، علشان مايبعتش رسايل لكل الناس مع كل حركة).
import {collection,doc,getDocs,setDoc} from "./fb.js";
const RTDB="https://tasooma-ad4fe-default-rtdb.firebaseio.com";
let F=null,D=null,devRef=null,un=null,vis=null,M={},cb=null,me=null,gen=0,SB=false,ON={},SEEN={};
const K=p=>String(p||"").toLowerCase().replace(/\./g,",");
const DEV=(()=>{try{let d=localStorage.getItem("pres_dev");if(!d){d=Math.random().toString(36).slice(2,10);localStorage.setItem("pres_dev",d)}return d}catch(e){return "t"+Math.random().toString(36).slice(2,8)}})();
export async function initPres(app,party,onChange){
  stopPres();me=party;cb=onChange;const my=++gen;
  if(window.__mock){window.__pres=d=>{M=d||{};if(cb)cb()};return}// النسخة التجريبية
  if(app&&app.sb){SB=true;try{initSb(app,party)}catch(e){}return}
  try{
    F=F||await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js");
    if(my!==gen)return;
    D=F.getDatabase(app,RTDB);devRef=F.ref(D,`on/${K(party)}/${DEV}`);
    const up=()=>F.set(devRef,{on:!document.hidden,ts:F.serverTimestamp()}).catch(()=>{});
    // كل ما الاتصال يرجع: نجهّز "آخر ظهور" عند الانقطاع، وبعدين نسجّل إننا متصلين
    const u1=F.onValue(F.ref(D,".info/connected"),s=>{if(s.val()!==true||!devRef)return;F.onDisconnect(devRef).set({on:false,ts:F.serverTimestamp()}).then(up).catch(()=>{})});
    vis=()=>up();document.addEventListener("visibilitychange",vis);
    const u2=F.onValue(F.ref(D,"on"),s=>{M=s.val()||{};if(cb)cb()},()=>{});
    un=()=>{u1();u2()};
  }catch(e){}// لو قاعدة البيانات لسه ماتعملتش: الشات بيشتغل عادي من غير "متصل"
}
function initSb(app,party){
  const c=app.sb,db=app.db;
  const ch=c.channel("tz-presence",{config:{private:true,presence:{key:party+"|"+DEV}}});
  const sync=()=>{const s=ch.presenceState(),o={};
    for(const k in s)(s[k]||[]).forEach(x=>{if(!x||!x.p)return;const e=o[x.p]=o[x.p]||{on:false};if(x.on)e.on=true});
    ON=o;if(cb)cb()};
  ch.on("presence",{event:"sync"},sync)
    .on("presence",{event:"leave"},({leftPresences})=>{(leftPresences||[]).forEach(x=>{if(x&&x.p)SEEN[x.p]=Math.max(SEEN[x.p]||0,Date.now())});sync()})
    .subscribe(s=>{if(s==="SUBSCRIBED")ch.track({p:party,on:!document.hidden}).catch(()=>{})});
  let last=0;const save=()=>{last=Date.now();setDoc(doc(db,"seen",party),{ts:last}).catch(()=>{})};
  vis=()=>{ch.track({p:party,on:!document.hidden}).catch(()=>{});save()};
  document.addEventListener("visibilitychange",vis);
  const hide=()=>save();addEventListener("pagehide",hide);
  const iv=setInterval(()=>{if(!document.hidden&&Date.now()-last>5*6e4)save()},6e4);save();
  const load=async()=>{try{const sn=await getDocs(collection(db,"seen"));sn.docs.forEach(d=>{const t=+(d.data()||{}).ts||0;SEEN[d.id]=Math.max(SEEN[d.id]||0,t)});if(cb)cb()}catch(e){}};
  load();const iv2=setInterval(load,5*6e4);
  un=()=>{clearInterval(iv);clearInterval(iv2);removeEventListener("pagehide",hide);save();try{ch.untrack();c.removeChannel(ch)}catch(e){}};
}
export function stopPres(){
  gen++;if(un){un();un=null}if(vis){document.removeEventListener("visibilitychange",vis);vis=null}
  if(devRef&&F){const r=devRef;F.set(r,{on:false,ts:F.serverTimestamp()}).catch(()=>{});F.onDisconnect(r).cancel().catch(()=>{})}
  devRef=null;M={};ON={};cb=null;me=null;SB=false;
}
// {on, ts} للطرف ده (لو أي جهاز من أجهزته فاتح = متصل)
export function presOf(p){
  if(SB){const on=!!(ON[p]&&ON[p].on),ts=SEEN[p]||0;return on||ts?{on,ts}:null}
  const d=M[K(p)];if(!d||typeof d!=="object")return null;let on=false,ts=0;
  Object.values(d).forEach(x=>{if(!x||typeof x!=="object")return;if(x.on===true)on=true;ts=Math.max(ts,+x.ts||0)});
  return ts||on?{on,ts}:null;
}
const hm=t=>new Date(t).toLocaleTimeString("ar-EG-u-nu-latn",{hour:"numeric",minute:"2-digit"});
// "🟢 متصل الآن" أو "آخر ظهور اليوم 3:40 م"
export function presTxt(p){
  const s=presOf(p);if(!s)return "";if(s.on)return "متصل الآن";
  const t=s.ts,d=new Date(t),n=new Date(),y=new Date(n);y.setDate(n.getDate()-1);
  const m=Math.round((Date.now()-t)/6e4);
  if(m<1)return "آخر ظهور منذ لحظات";if(m<60)return `آخر ظهور منذ ${m} د`;
  if(d.toDateString()===n.toDateString())return `آخر ظهور اليوم ${hm(t)}`;
  if(d.toDateString()===y.toDateString())return `آخر ظهور أمس ${hm(t)}`;
  return `آخر ظهور ${d.toLocaleDateString("ar-EG-u-nu-latn",{day:"numeric",month:"short"})} ${hm(t)}`;
}
