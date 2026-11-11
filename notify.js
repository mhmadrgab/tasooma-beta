// تنبيهات + تثبيت التطبيق (مشترك)
export const canNotify=()=>"Notification" in window;
export async function askNotify(){if(!canNotify())return "unsupported";try{return await Notification.requestPermission()}catch(e){return "denied"}}
// إشعار الجهاز: لما الصفحة مش قدامه (تبويب تاني، أو الصفحة مفتوحة بس هو شغّال في برنامج مجدداً على الحاسوب)
export const away=()=>document.hidden||!document.hasFocus();
export function notify(title,body,tag){try{if(canNotify()&&Notification.permission==="granted"&&away()){const n=new Notification(window.TZL?TZL.t(title):title,{body:window.TZL?TZL.t(body):body,tag,icon:"./icon-192.png",dir:document.documentElement.dir||"rtl",lang:document.documentElement.lang||"ar"});n.onclick=()=>{try{window.focus()}catch(e){}window.dispatchEvent(new CustomEvent("tz-open",{detail:{tag:String(tag||"")}}));try{n.close()}catch(e){}}}}catch(e){}}
export function beep(){try{const c=new (window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),v=c.createGain();o.connect(v);v.connect(c.destination);o.frequency.value=880;v.gain.setValueAtTime(.2,c.currentTime);v.gain.exponentialRampToValueAtTime(.001,c.currentTime+.6);o.start();o.stop(c.currentTime+.6)}catch(e){}}
export function badge(n){try{if(navigator.setAppBadge){n>0?navigator.setAppBadge(n):navigator.clearAppBadge()}}catch(e){}}
let dip=null;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();dip=e;document.querySelectorAll("[data-install]").forEach(b=>b.hidden=false)});
addEventListener("appinstalled",()=>document.querySelectorAll("[data-install]").forEach(b=>b.hidden=true));
export async function install(){if(!dip)return false;dip.prompt();try{await dip.userChoice}catch(e){}dip=null;document.querySelectorAll("[data-install]").forEach(b=>b.hidden=true);return true}
export const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone=()=>(window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
// جوال ولا حاسوب؟ (الآيباد الجديد بيقول عن نفسه "Macintosh" بس فيه لمس)
export const isMobile=()=>/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)||(navigator.userAgentData&&navigator.userAgentData.mobile===true)||(/macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
const dev=()=>isMobile()?"هذا الجوال":"هذا الحاسوب";
// الحاسوب بيستقبل الإشعارات طول ما المتصفح شغّال بس، فبنقولها بصراحة
const okText=()=>isMobile()?`سيصلك كل جديد على ${dev()} في نفس اللحظة، حتى والتطبيق مغلق.`
  :`سيصلك كل جديد على ${dev()} في نفس اللحظة، ما دام الحاسوب يعمل والمتصفح مفتوحاً (حتى لو كانت صفحة المنصة نفسها مغلقة).<br><br>📱 لتصلك على جوالك أيضاً: افتح المنصة من الجوال وفعّلها هناك.`;
// لو الصفحة خلصت تحميل خلاص (زي لوحة المستودع اللي بتنادي دي بعد الدخول) نسجّل على طول، وإلا نستنى التحميل
export function regSW(){if(!("serviceWorker" in navigator))return;const go=()=>navigator.serviceWorker.register("./sw.js").catch(()=>{});document.readyState==="complete"?go():addEventListener("load",go)}
// ---------- تفعيل الإشعارات بأسهل طريقة ----------
// بعد الدخول بتتنادي autoPush(): لو الإشعارات مسموحة بيتسجّل الجهاز في صمت، ولو لأ بتظهر رسالة فيها زرار واحد.
// (المتصفحات مش بتسمح بتفعيل الإشعارات من غير ضغطة من الشخص نفسه، فدي أقل حاجة ممكنة: ضغطة واحدة مرة واحدة)
let pushOk=null;// null = لسه، true = الجهاز متسجّل فعلاً، false = حصلت مشكلة
// الجهاز متسجّل في إشعارات السيرفر؟ (ساعتها الصفحة مش محتاجة تعرض نسخة تانية من نفس الإشعار)
export const pushOn=()=>pushOk===true;
const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:k=>{try{localStorage.setItem(k,String(Date.now()))}catch(e){}}};
const recently=(k,days)=>Date.now()-(+ls.get(k)||0)<days*864e5;
const pcHelp=`<li>على الحاسوب: اضغط على علامة <b>الإغلاق 🔒</b> التي بجانب رابط الموقع في الأعلى</li><li>اختر <b>الإشعارات / Notifications</b> واجعلها <b>سماح / Allow</b></li><li>قم بـ <b>تحديث للصفحة</b> (F5)</li>`;
const mobHelp=`<li>على الجوال: اضغط مطوّلاً على أيقونة التطبيق ← <b>معلومات التطبيق</b> ← <b>الإشعارات</b> وفعّلها</li><li>أو من المتصفح: ⋮ ← الإعدادات ← إعدادات المواقع ← الإشعارات ← اسمح للموقع</li>`;
function paintBell(){
  const bell=document.getElementById("bell");if(!bell)return;
  if(!canNotify()&&!(isIOS()&&!isStandalone())){bell.hidden=true;return}
  const p=canNotify()?Notification.permission:"default";
  bell.textContent=p==="granted"&&pushOk===true?"🔔 الإشعارات تعمل":p==="granted"&&pushOk===null?"⏳ الإشعارات...":p==="denied"?"🔕 الإشعارات مغلقة":"🔔 فعّل الإشعارات";
  bell.dataset.on=p==="granted"&&pushOk?"1":"0";
}
function dlg(html){
  let m=document.getElementById("npm");
  if(!m){m=document.createElement("div");m.id="npm";m.addEventListener("click",e=>{if(e.target===m||e.target.closest("[data-npx]")){m.className="";if(e.target.closest("[data-later]"))ls.set("np_later")}});document.body.appendChild(m)}
  m.innerHTML=`<div class="uik">${html}</div>`;m.className="on";return m;
}
const closeDlg=()=>{const m=document.getElementById("npm");if(m)m.className=""};
async function register(){pushOk=null;paintBell();pushOk=window.__push?await window.__push():false;paintBell();return pushOk}
// الرسالة المناسبة لحالة الجهاز
function showDlg(kind){
  if(kind==="ios")return dlg(`<div class="uii">📲</div><h3>ثبّت التطبيق للحصول على الإشعارات</h3><p>على الآيفون تعمل الإشعارات فقط من التطبيق المثبّت:</p><ol><li>اضغط زر <b>المشاركة</b> (المربع والسهم) في الأسفل</li><li>اختر <b>إضافة إلى الشاشة الرئيسية</b></li><li>افتح التطبيق من الشاشة الرئيسية وسجّل الدخول</li></ol><div class="uib"><button class="bt p" data-npx type="button">حسناً</button></div>`);
  if(kind==="denied")return dlg(`<div class="uii">🔕</div><h3>الإشعارات مغلقة على ${dev()}</h3><p>ليصلك كل جديد فوراً، افتحها مرة واحدة:</p><ol>${isMobile()?mobHelp:pcHelp}</ol><div class="uib"><button class="bt p" data-npx type="button">حسناً</button></div>`);
  const m=dlg(`<div class="uii">🔔</div><h3>فعّل الإشعارات على ${dev()}</h3><p>ليصلك كل جديد في نفس اللحظة${isMobile()?"، حتى والتطبيق مغلق":""}. ستضغط مرة واحدة فقط.</p><div class="uib"><button class="bt p" id="npgo" type="button" style="font-size:17px;padding:13px 26px">🔔 فعّل الإشعارات</button><button class="bt" data-npx data-later type="button">لاحقاً</button></div>`);
  m.querySelector("#npgo").onclick=async()=>{
    const b=m.querySelector("#npgo");b.disabled=true;b.textContent="⏳ لحظة...";
    const p=await askNotify();paintBell();
    if(p==="denied")return showDlg("denied");
    if(p!=="granted"){closeDlg();return}
    const ok=await register();
    dlg(ok?`<div class="uii">✅</div><h3>تم! الإشعارات تعمل على ${dev()}</h3><p>${okText()}</p><div class="uib"><button class="bt p" data-npx type="button">جيد</button></div>`
      :`<div class="uii">⚠️</div><h3>لم نتمكن من تفعيلها حالياً</h3><p>تأكد من عمل الإنترنت وحاول مجدداً من زر 🔔 التي في الأعلى.</p><div class="uib"><button class="bt p" data-npx type="button">حسناً</button></div>`);
    if(ok&&isMobile())setTimeout(closeDlg,2500);// على الحاسوب بنسيبها إلى ما يقرا ملاحظة المتصفح
  };
  return m;
}
// بتتنادي بعد الدخول من كل صفحة (بعد ما الصفحة تجهّز window.__push)
export async function autoPush(){
  paintBell();
  if(isIOS()&&!isStandalone()){if(!recently("np_ios",3)){ls.set("np_ios");showDlg("ios")}return}
  if(!canNotify())return;
  const p=Notification.permission;
  if(p==="granted"){await register();return}// مسموحة: نسجّل في صمت
  if(p==="default"&&!recently("np_later",1))return void setTimeout(()=>showDlg("ask"),1200);// نسيب الصفحة تظهر الأول
  if(p==="denied"&&!recently("np_denied",3)){ls.set("np_denied");setTimeout(()=>showDlg("denied"),1200)}
}
// ربط زرار الجرس وزرار التثبيت
export function wireButtons(){
  const bell=document.getElementById("bell"),ins=document.querySelectorAll("[data-install]");
  paintBell();
  if(bell)bell.onclick=async()=>{
    if(isIOS()&&!isStandalone())return void showDlg("ios");
    if(!canNotify())return;
    if(Notification.permission==="denied")return void showDlg("denied");
    if(Notification.permission==="default")return void showDlg("ask");
    const ok=await register();// مسموحة: نعيد التسجيل ونقول النتيجة
    // لوحة المستودع: بنبعت إشعار تجربة حقيقي من السيرفر علشان يتأكد بعينه
    if(ok&&window.__pushTest)window.__pushTest().catch(()=>{});
    dlg(ok?`<div class="uii">✅</div><h3>الإشعارات تعمل على ${dev()}</h3><p>${okText()}${window.__pushTest?"<br><br>🔔 أرسلنا لك الآن إشعاراً تجريبياً، يفترض أن يظهر خلال ثوانٍ.":""}</p><div class="uib"><button class="bt p" data-npx type="button">حسناً</button></div>`
      :`<div class="uii">⚠️</div><h3>لم نتمكن من تفعيلها حالياً</h3><p>تأكد من عمل الإنترنت وحاول مجدداً.</p><div class="uib"><button class="bt p" data-npx type="button">حسناً</button></div>`);
  };
  ins.forEach(b=>b.onclick=async()=>{if(!(await install())&&isIOS())showDlg("ios")});
  if(isIOS()&&!isStandalone())ins.forEach(b=>b.hidden=false);
}
