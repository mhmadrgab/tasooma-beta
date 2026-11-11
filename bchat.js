// الدردشة الخاص: نص + رسايل صوتية. كل محادثة بين طرفين بس، ومحدش غيرهم يقدر يشوفها (ولا حتى المالك والمديرين).
// الأطراف: الفروع (b-كود)، اللي في المستودع (w-إيميل)، السائقين (d-رقم). سائق مع سائق ممنوع (نوفمبر 2026).
//   فرع مع المستودع (الشكل القديم، زي ما هو):
// كل محادثة = فرع واحد + شخص واحد من المستودع (المالك أو مدير أو موظف طلبات). محدش غيرهم يقدر يشوفها، حتى المالك والمديرين
// (firestore.rules هي اللي بتمنع ده، مش الصفحة بس). الفرع بيختار يكلّم مين من قايمة الأسماء (whdir).
//   dm/{code}__{email}  = ملخّص: {br, brn, wh:إيميل الشخص, whn:اسمه, last:{by,n,t,ts,v}, lb, lw, rb, rw, nb, nw}
//                         lb/lw = آخر رسالة من الفرع/المستودع، rb/rw = قرا إلى إمتى، nb/nw = رسايل لم تُقرأ بعد عند الفرع/المستودع
//   dm/{cid}/msgs/{id}  = رسالة: {by:"br"|"wh", n:اسم اللي كتب, t?:النص, v?+d?:صوت ومدته بالثواني, ts, rq?:{id,no} بخصوص طلب, rd?:قُرئت إمتى}
//   dm/{cid}/aud/{id}   = الصوت نفسه {a: data URL}، بيتحمّل بس لما حد يدوس تشغيل (توفير قراءات)
//   whdir/{email}       = {n, k, r}: أسماء اللي في المستودع وكنيتهم (المالك بس بيكتبها، staff.js). ava/{email} = صورهم
//   كل شخص بيظهر باسمه وكنيته وصورته بس (من غير "مدير" أو "مالك النظام")
import {collection,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,onSnapshot,query,where,orderBy,limit,writeBatch,increment,deleteField,withTimeout,failReason,FAIL_MSG} from "./fb.js";
import {initPres,stopPres,presOf,presTxt} from "./pres.js";// 🟢 متصل الآن / آخر ظهور
const LEN=1000,MAXS=60,MAXB=470000,PAGE=40,SEP="__";// نفس الحدود اللي في firestore.rules
const E=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N=x=>Number.isFinite(+x)?+x:0;
const g=id=>document.getElementById(id);
const isMob=()=>/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
const SILENT="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
const QUICK={b:["نحتاج بضاعة بشكل عاجل 🙏","أين طلبنا؟","حسناً، شكراً 👍"],w:["حسناً 👍","جاري التجهيز ⏳","سيصلكم اليوم 🚚","الصنف غير متوفر حالياً"],d:["في الطريق 🚚","وصلت ✅","سأتأخر قليلاً ⏳","حسناً 👍"]};
// المحادثات الجديدة (سواقين، موظفين مع بعض، فروع مع بعض): dm/{طرف1}__{طرف2} مترتبين = {ps:[الطرفين], nm:{طرف:اسمه}, last:{by:الطرف,...},
//   l0/l1 آخر رسالة من الطرف 0/1، r0/r1 قرا إلى إمتى، n0/n1 لا يزال ماقراش كام}، والرسائل by = الطرف. ddir/{drv1} = {n} أسماء السائقين
const QALL=new Set([].concat(...Object.values(QUICK)));// الردود السريعة تُترجم، أما ما يكتبه الناس فلا (data-notr)
const ROLE_O={v:0,admin:1,gm:1,owner:2,req:3};// ترتيب القايمة (مش بيظهر)
// 🏛 قسم "الإدارة" (نوفمبر 2026، طلب محمد): المديرين + مدير التسويق + صاحب الشركة، ظاهرين لكل الفروع. فلتر "m" = w- اللي دوره إدارة
const MGMT=["admin","gm","v"];
// w = المالك اختاره يظهر في "المستودع" (حتى لو مدير): بيتشال من الإدارة
const isM=p=>{if(p[0]!=="w")return false;const d=DIR[pv(p)]||{};return MGMT.includes(d.r)&&d.w!==true};
// عند الفرع والسواق: "المستودع" = المالك + اللي المالك اختارهم بس (طلب محمد)
const inWh=d=>d&&(d.r==="owner"||d.w===true);
// كل شخص في قسم واحد بس: w = 🏭 المستودع (المالك + المختارين، عند الكل)، m = الإدارة، s = باقي الموظفين
const kindOf=p=>{if(p[0]!=="w")return p[0];if(inWh(DIR[pv(p)]))return "w";return isM(p)?"m":"s"};
// CUR = المحادثة المفتوحة (cid). CTX = "بخصوص طلب" لكل محادثة، PEND = طلب مستني الفرع يختار يكلّم مين عنه. AVA = الصور
let PRT=0;
let X=null,SUMS={},SO={},SN={},SG={},UNG=null,DIR={},DDIR={},AVA={},FILT="",CUR=null,GEN=0,UNM=null,UNS=null,UNS2=null,UND=null,UNA=null,UNDD=null,MSGS=[],LIM=PAGE,DRAFT={},CTX={},PEND=null,REC=null,PLAY={id:null,au:null},busy=false,marking=false,first=true,keepTop=null,ROOT=null,Q="";
const AUD=new Map();let SCR={t:0,end:true,l:0};
const STYLE=`
.bcv [hidden]{display:none!important}
.bcv{position:relative;display:flex;flex-direction:column;min-height:0;min-width:0;background:var(--card);color:var(--ink);height:100%}
/* رأس المحادثة: صورة + اسم + حالة، زي تطبيقات التواصل */
.bch{display:flex;align-items:center;gap:11px;padding:9px 12px;background:var(--card);color:var(--ink);border-bottom:1px solid var(--line);flex:none;z-index:3;box-shadow:0 2px 10px rgba(0,0,0,.04)}
.bch>div{flex:1;min-width:0}.bch b{display:block;font-size:16px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bch small{display:flex;align-items:center;gap:4px;color:var(--mut);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bch button,.bclh button{font:inherit;background:transparent;color:inherit;border:0;border-radius:50%;width:40px;height:40px;font-size:18px;cursor:pointer;flex:none;display:grid;place-items:center;transition:background .15s}
.bch button:hover,.bclh button:hover{background:var(--soft,#f6f2e9)}
.bch #bcav:empty{display:none}
/* الصور الرمزية: صورة الشخص، أو أول حرف بلون ثابت لكل اسم */
.av{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:16px;flex:none;color:#fff;direction:ltr;object-fit:cover;position:relative;overflow:hidden;letter-spacing:-.3px}
.av.c0{background:linear-gradient(135deg,#d9b25f,#a8832f)}.av.c1{background:linear-gradient(135deg,#3f8fd8,#235f9e)}.av.c2{background:linear-gradient(135deg,#3fb27f,#1f7a52)}.av.c3{background:linear-gradient(135deg,#e0776a,#b04538)}
.av.c4{background:linear-gradient(135deg,#8b74e0,#5a43b0)}.av.c5{background:linear-gradient(135deg,#2bb3c0,#17808b)}.av.c6{background:linear-gradient(135deg,#e39a4a,#b36b1e)}.av.c7{background:linear-gradient(135deg,#4b4b4b,#1b1b1b);color:#e8cf8a}
.av.sm{width:40px;height:40px;font-size:14.5px}.av.avb{font-size:13.5px}.av.avd{font-size:21px}
img.av{background:#1b1b1b}
/* منطقة الرسايل: خلفية بنقشة هادية */
.bcms{flex:1;overflow-y:auto;padding:10px 14px 14px;display:flex;flex-direction:column;gap:0;overscroll-behavior:contain;scroll-behavior:auto;
 background-color:#efe8db;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='none' stroke='%23a07a2c' stroke-opacity='.10' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='14' y='16' width='22' height='18' rx='3'/%3E%3Cpath d='M14 22h22M25 16v6'/%3E%3Cpath d='M92 18h24a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5h-14l-7 6v-6h-3a5 5 0 0 1-5-5V23a5 5 0 0 1 5-5z'/%3E%3Ccircle cx='60' cy='70' r='9'/%3E%3Cpath d='M60 64v6l4 3'/%3E%3Cpath d='M118 82l6 6 12-13'/%3E%3Cpath d='M18 104h26l6 8v10H18z'/%3E%3Ccircle cx='26' cy='124' r='4'/%3E%3Ccircle cx='44' cy='124' r='4'/%3E%3Cpath d='M86 118l7-14 7 14M88 114h10'/%3E%3Cpath d='M128 128c0-6 10-6 10 0s-10 10-10 10-10-4-10-10 10-6 10 0'/%3E%3Ccircle cx='140' cy='40' r='2'/%3E%3Ccircle cx='70' cy='140' r='2'/%3E%3Ccircle cx='8' cy='70' r='2'/%3E%3C/g%3E%3C/svg%3E")}
.bcmt{margin:auto;text-align:center;color:var(--mut);font-size:14.5px;line-height:1.9;padding:18px 22px;background:rgba(255,255,255,.75);border-radius:14px;max-width:340px;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.bcmt.ok b{display:block;font-size:34px;line-height:1.3}
.bcday{position:sticky;top:4px;z-index:2;align-self:center;font-size:12px;font-weight:700;color:#5b5446;background:rgba(255,253,248,.95);border-radius:9px;padding:4px 12px;margin:10px 0 6px;box-shadow:0 1px 2px rgba(0,0,0,.1)}
/* الفقاعة */
.bcg{position:relative;display:flex;flex-wrap:wrap;align-items:flex-end;column-gap:10px;max-width:min(80%,560px);border-radius:12px;padding:6px 10px 5px;font-size:15px;line-height:1.55;word-wrap:break-word;overflow-wrap:anywhere;margin-top:8px;box-shadow:0 1px 1px rgba(0,0,0,.12);animation:bc-in .22s cubic-bezier(.2,.9,.3,1.2) both}
.bcg.cont{margin-top:2px}
.bcg>i{flex-basis:100%;display:flex;align-items:center;gap:6px;font-style:normal;font-size:12.5px;font-weight:800;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bcg>i img{width:18px;height:18px;border-radius:50%;object-fit:cover}
.bcg .bcx{flex:1 1 auto;white-space:pre-wrap;min-width:0}
.bcg small{flex:none;display:inline-flex;align-items:center;gap:3px;margin-inline-start:auto;font-size:11px;line-height:1;color:rgba(0,0,0,.45);padding-top:6px;white-space:nowrap;direction:ltr}
.bcg .tk{width:17px;height:11px;flex:none;color:#8d8778}.bcg .tk.rd{color:#2a9df4}
.bcg .rqt{flex-basis:100%;display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;background:rgba(0,0,0,.06);border-inline-start:3px solid #a8832f;border-radius:6px;padding:4px 8px;margin:2px 0 5px}
.bcg.me{align-self:flex-start;background:#f6e2b0;color:#1f1a10;border-start-start-radius:3px}
.bcg.ot{align-self:flex-end;background:#fff;color:#1b1b1b;border-start-end-radius:3px}
.bcg.cont.me{border-start-start-radius:12px}.bcg.cont.ot{border-start-end-radius:12px}
.bcg:not(.cont)::before{content:"";position:absolute;top:0;width:9px;height:13px}
.bcg.me:not(.cont)::before{right:-8px;background:#f6e2b0;clip-path:polygon(0 0,100% 0,0 100%)}
.bcg.ot:not(.cont)::before{left:-8px;background:#fff;clip-path:polygon(0 0,100% 0,100% 100%)}
html[dir="ltr"] .bcg.me:not(.cont)::before{right:auto;left:-8px;clip-path:polygon(0 0,100% 0,100% 100%)}
html[dir="ltr"] .bcg.ot:not(.cont)::before{left:auto;right:-8px;clip-path:polygon(0 0,100% 0,0 100%)}
.bcg.ot>i{color:#a8832f}
/* 📷 الصور + 👥 الجروبات */
.bcf button.pic{background:transparent;color:var(--mut);box-shadow:none;width:42px}.bcf button.pic svg{width:24px;height:24px}
.bcg.pic{padding:4px 4px 5px}.bcimg{display:block;border:0;padding:0;margin:0 0 4px;border-radius:9px;overflow:hidden;cursor:zoom-in;background:rgba(0,0,0,.08);width:min(280px,62vw);max-height:340px}.bcimg img{width:100%;height:100%;object-fit:cover;display:block}
.bcg.pic .bcx{padding:0 6px}.bcg.pic>i{padding:2px 6px 0}.bcg.pic small{padding:0 6px}
#bciv{display:none;position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.92);flex-direction:column;align-items:center;justify-content:center;padding:12px}#bciv.on{display:flex}
#bciv img{max-width:100%;max-height:78vh;object-fit:contain;border-radius:8px}#bciv .iv-t{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:10px;padding:12px 16px;color:#fff}#bciv .iv-t small{opacity:.7}#bciv .iv-t button{margin-inline-start:auto;font:inherit;background:rgba(255,255,255,.15);color:#fff;border:0;border-radius:50%;width:40px;height:40px;cursor:pointer}
#bciv .iv-l{color:#fff;margin-top:12px;text-align:center;line-height:1.8}#bciv .iv-l a{display:inline-block;color:#1b1b1b;background:#d4ae5c;font-weight:800;border-radius:999px;padding:8px 18px;text-decoration:none}
.bclh .bcng{font:inherit;font-weight:800;font-size:13px;border:0;border-radius:999px;padding:8px 14px;width:auto;height:auto;background:#1b1b1b;color:#e8cf8a;cursor:pointer;white-space:nowrap}.bclh .bcng:hover{background:#2b2416}
.bcr .nm small .gwho{font-weight:700;color:var(--ink)}
#bcgm,#bcgi{display:none;position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.55);padding:14px;overflow:auto}#bcgm.on,#bcgi.on{display:block}
.gfk2{max-width:560px;margin:3vh auto;background:var(--card);color:var(--ink);border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.gfh{display:flex;align-items:center;gap:10px;padding:14px 18px;background:linear-gradient(120deg,#2b2416,#1b1b1b);color:#fff;border-bottom:3px solid #d4ae5c}.gfh b{font-size:18px}.gfh button{margin-inline-start:auto;font:inherit;background:rgba(255,255,255,.12);color:#fff;border:0;border-radius:10px;width:36px;height:36px;cursor:pointer}
.gfb{padding:14px 18px;max-height:62vh;overflow:auto}.gfb label{display:block;font-size:13px;color:var(--mut);margin:8px 0 4px}.gfb input[type=search],#gfn{width:100%;font:inherit;font-size:15px;border-radius:12px;border:1.5px solid var(--line);background:var(--field,#f3f1ed);color:var(--ink);padding:9px 12px}
.gfs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.gfs button{font:inherit;font-size:12.5px;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:5px 12px;cursor:pointer}
.gft{font-weight:800;font-size:14px;margin:12px 0 4px}.gfi{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:12px;cursor:pointer}.gfi.on{background:var(--soft,#f6f2e9)}.gfi input{width:20px;height:20px;flex:none}.gfi span{flex:1;min-width:0;font-weight:600}.gfa{color:#a8832f;font-weight:700}
.gff{display:flex;gap:8px;padding:12px 18px 16px;border-top:1px solid var(--line);background:var(--soft,#f6f2e9)}.gff button{flex:1;font:inherit;font-weight:800;border-radius:12px;padding:11px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}.gff .ok{background:#1b1b1b;color:#fff;border-color:#1b1b1b}.gff .del{color:#c4362b;border-color:#c4362b}
.bcseen{align-self:flex-start;display:flex;align-items:center;gap:4px;font-size:11.5px;color:#6d6656;margin:3px 4px 0;animation:ui-fade .3s ease both}
.bcseen .tk{width:16px;height:11px;color:#8d8778}.bcseen .tk.rd{color:#2a9df4}
@keyframes bc-in{from{opacity:0;transform:translateY(6px) scale(.98)}to{opacity:1;transform:none}}
/* الرسالة الصوتية: موجة بتتملي وهي شغّالة */
.bcvo{display:flex;align-items:center;gap:10px;min-width:210px;direction:ltr;flex:1 1 auto;padding:2px 0}
.bcvo button{width:40px;height:40px;border-radius:50%;border:0;background:#a8832f;color:#fff;font-size:15px;cursor:pointer;flex:none;box-shadow:0 2px 6px rgba(0,0,0,.15)}
.bcg.ot .bcvo button{background:#1b1b1b}
.bcvo span.bar{flex:1;height:26px;position:relative;background:rgba(0,0,0,.2);
 -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 26' preserveAspectRatio='none'%3E%3Cg fill='%23000'%3E%3Crect x='0' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='4' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='8' y='3' width='2.4' height='20' rx='1.2'/%3E%3Crect x='12' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='16' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='20' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='24' y='2' width='2.4' height='22' rx='1.2'/%3E%3Crect x='28' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='32' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='36' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='40' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='44' y='11' width='2.4' height='4' rx='1.2'/%3E%3Crect x='48' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='52' y='1' width='2.4' height='24' rx='1.2'/%3E%3Crect x='56' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='60' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='64' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='68' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='72' y='3' width='2.4' height='20' rx='1.2'/%3E%3Crect x='76' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='80' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='84' y='2' width='2.4' height='22' rx='1.2'/%3E%3Crect x='88' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='92' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='96' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='100' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='104' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='108' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='112' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='116' y='10' width='2.4' height='6' rx='1.2'/%3E%3C/g%3E%3C/svg%3E") center/100% 100% no-repeat;
 mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 26' preserveAspectRatio='none'%3E%3Cg fill='%23000'%3E%3Crect x='0' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='4' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='8' y='3' width='2.4' height='20' rx='1.2'/%3E%3Crect x='12' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='16' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='20' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='24' y='2' width='2.4' height='22' rx='1.2'/%3E%3Crect x='28' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='32' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='36' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='40' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='44' y='11' width='2.4' height='4' rx='1.2'/%3E%3Crect x='48' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='52' y='1' width='2.4' height='24' rx='1.2'/%3E%3Crect x='56' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='60' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='64' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='68' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='72' y='3' width='2.4' height='20' rx='1.2'/%3E%3Crect x='76' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='80' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='84' y='2' width='2.4' height='22' rx='1.2'/%3E%3Crect x='88' y='7' width='2.4' height='12' rx='1.2'/%3E%3Crect x='92' y='10' width='2.4' height='6' rx='1.2'/%3E%3Crect x='96' y='5' width='2.4' height='16' rx='1.2'/%3E%3Crect x='100' y='8' width='2.4' height='10' rx='1.2'/%3E%3Crect x='104' y='4' width='2.4' height='18' rx='1.2'/%3E%3Crect x='108' y='9' width='2.4' height='8' rx='1.2'/%3E%3Crect x='112' y='6' width='2.4' height='14' rx='1.2'/%3E%3Crect x='116' y='10' width='2.4' height='6' rx='1.2'/%3E%3C/g%3E%3C/svg%3E") center/100% 100% no-repeat}
.bcvo span.bar b{position:absolute;inset:0 auto 0 0;display:block;width:0;background:#a8832f;transition:width .2s linear}
.bcg.ot .bcvo span.bar b{background:#1b1b1b}
.bcvo span.du{font-size:12px;font-weight:700;opacity:.7;min-width:30px}
.bcgone{font-size:13px;opacity:.75;font-style:italic;flex:1 1 auto}
.bcmore{align-self:center;font:inherit;font-size:13px;font-weight:700;border:0;background:rgba(255,253,248,.95);color:#5b5446;border-radius:999px;padding:6px 16px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.1);margin:4px 0}
/* زرار النزول لآخر رسالة */
.bcdown{position:absolute;inset-inline-start:16px;bottom:96px;z-index:4;width:42px;height:42px;border-radius:50%;border:0;background:var(--card);color:var(--ink);box-shadow:0 3px 12px rgba(0,0,0,.2);cursor:pointer;display:grid;place-items:center;animation:ui-fade .2s ease both}
.bcdown svg{width:20px;height:20px}
.bcrq{display:flex;align-items:center;gap:8px;margin:0;padding:8px 12px;background:var(--card);border-top:1px solid var(--line);font-size:13.5px;font-weight:700;flex:none;color:var(--ink)}
.bcrq span{flex:1;border-inline-start:3px solid #a8832f;padding-inline-start:9px;color:#8a6a22}
.bcrq button{font:inherit;border:0;background:var(--soft,#f3f1ed);color:inherit;border-radius:50%;width:28px;height:28px;cursor:pointer}
/* الردود السريعة + خانة الكتابة */
.bcq{display:flex;gap:6px;overflow-x:auto;padding:8px 10px 0;scrollbar-width:none;flex:none;background:#efe8db}.bcq::-webkit-scrollbar{display:none}
.bcq button{font:inherit;font-size:13px;font-weight:600;white-space:nowrap;border-radius:999px;border:1px solid rgba(168,131,47,.35);background:rgba(255,253,248,.95);color:#5b4512;padding:5px 13px;cursor:pointer;flex:none;transition:transform .12s,background .12s}
.bcq button:hover{background:#fff6dc}.bcq button:active{transform:scale(.96)}
.bcf{display:flex;gap:8px;align-items:flex-end;padding:8px 10px 10px;flex:none;background:#efe8db}
.bcf textarea{flex:1;resize:none;font:inherit;font-size:16px;line-height:1.45;max-height:130px;min-height:48px;border-radius:24px;border:0;background:var(--card);color:var(--ink);padding:12px 18px;box-shadow:0 1px 2px rgba(0,0,0,.12)}
.bcf textarea:focus{outline:0;box-shadow:0 0 0 2px rgba(212,174,92,.6),0 1px 2px rgba(0,0,0,.12)}
.bcf button{border:0;border-radius:50%;width:48px;height:48px;padding:0;background:linear-gradient(135deg,#d9b25f,#a8832f);color:#fff;cursor:pointer;flex:none;display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.2);transition:transform .15s}
.bcf button:active{transform:scale(.92)}.bcf button svg{width:22px;height:22px}
.bcf button:disabled{opacity:.5}
.bcf.has #bcmic{display:none}.bcf:not(.has) #bcsend{display:none}
#bcsend svg{animation:bc-pop .18s ease both}html[dir="rtl"] #bcsend svg{transform:scaleX(-1)}
@keyframes bc-pop{from{transform:scale(.5)}}
html[dir="rtl"] #bcsend svg{animation:none}
/* التسجيل */
.bcr2{display:flex;align-items:center;gap:10px;padding:8px 10px 10px;flex:none;background:#efe8db}
.bcr2 .pill{flex:1;display:flex;align-items:center;gap:10px;background:var(--card);border-radius:24px;height:48px;padding:0 16px;box-shadow:0 1px 2px rgba(0,0,0,.12)}
.bcr2 .dot{width:11px;height:11px;border-radius:50%;background:#e03b2f;animation:bc-pulse 1s ease-in-out infinite;flex:none}
.bcr2 .tm{flex:1;font-weight:800;font-size:16px;direction:ltr;text-align:right}.bcr2 .tm small{font-weight:400;color:var(--mut);font-size:12.5px}
.bcr2 button{font:inherit;font-weight:800;border:0;border-radius:50%;width:48px;height:48px;cursor:pointer;flex:none;display:grid;place-items:center;font-size:18px}
.bcr2 .x{background:var(--card);color:#c4362b;box-shadow:0 1px 2px rgba(0,0,0,.12)}.bcr2 .ok{background:linear-gradient(135deg,#d9b25f,#a8832f);color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2)}
.bcr2 .ok svg{width:22px;height:22px}html[dir="rtl"] .bcr2 .ok svg{transform:scaleX(-1)}
@keyframes bc-pulse{50%{opacity:.25;transform:scale(.8)}}
/* القايمة + المحادثة */
.bcw{display:grid;grid-template-columns:340px 1fr;height:calc(100dvh - 175px);min-height:460px;background:var(--card);border-radius:18px;overflow:hidden;border:1px solid var(--line);box-shadow:0 10px 30px rgba(0,0,0,.06)}
.bcl{border-inline-end:1px solid var(--line);display:flex;flex-direction:column;min-height:0;background:var(--card)}
.bclh{display:flex;align-items:center;gap:10px;padding:14px 16px 4px;flex:none}
.bclh>div{flex:1;min-width:0}.bclh b{display:block;font-size:22px;font-weight:800}.bclh small{display:block;color:var(--mut);font-size:12.5px;margin-top:2px}
.bcs{padding:10px 14px 8px;flex:none}
.bcs input{width:100%;font:inherit;font-size:15px;border-radius:999px;border:0;background:var(--field,#f3f1ed);color:var(--ink);padding:10px 16px}
.bcs input:focus{outline:0;box-shadow:0 0 0 2px rgba(212,174,92,.55)}
.bcfl{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}/* كل الأقسام ظاهرة (كانت سطر بيتسحب ومابيتسحبش على الكمبيوتر) */
.bcfl button{font:inherit;font-size:13px;font-weight:700;white-space:nowrap;border-radius:999px;border:0;background:var(--field,#f3f1ed);color:var(--mut);padding:6px 14px;cursor:pointer;transition:background .15s,color .15s}
.bcfl button.on{background:#1b1b1b;color:#e8cf8a}
.bcli{overflow-y:auto;flex:1;padding:2px 6px 8px}
.bcr{display:flex;gap:12px;align-items:center;width:100%;padding:9px 10px;border:0;border-radius:14px;background:none;text-align:start;font:inherit;color:var(--ink);cursor:pointer;transition:background .15s}
.bcr:hover{background:var(--soft,#f6f2e9)}.bcr.on{background:#f6ecd2}
.bcr .av{width:50px;height:50px}
.avw{position:relative;flex:none;display:inline-flex}.bcon{position:absolute;bottom:1px;right:1px;width:14px;height:14px;border-radius:50%;background:#25d366;border:2.5px solid var(--card,#fff);box-shadow:0 0 0 1px rgba(0,0,0,.06)}
.bcpr{color:#1f9d55;font-weight:700}
.bcr .nm{flex:1;min-width:0}.bcr .nm b{display:flex;align-items:center;gap:6px;font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden}
.bcr .nm b bdi{overflow:hidden;text-overflow:ellipsis}
.bcr .nm b u{text-decoration:none;font-weight:600;font-size:11px;color:#8a6a22;background:#f6ecd2;border-radius:6px;padding:0 6px;flex:none}
.bcr .nm small{display:flex;align-items:center;gap:3px;color:var(--mut);font-size:13.5px;white-space:nowrap;overflow:hidden;margin-top:2px}
.bcr .nm small span{overflow:hidden;text-overflow:ellipsis}
.bcr .nm small .tk{width:16px;height:11px;flex:none;color:#8d8778}.bcr .nm small .tk.rd{color:#2a9df4}
.bcr.nw .nm small{color:var(--ink);font-weight:700}
.bcr .mt{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex:none;align-self:stretch;justify-content:center}.bcr .mt small{color:var(--mut);font-size:11.5px}
.bcr.nw .mt small{color:#a8832f;font-weight:800}
.bcr .mt i,.bcbd{font-style:normal;background:#a8832f;color:#fff;border-radius:999px;min-width:21px;padding:0 6px;font-size:12px;line-height:21px;text-align:center;font-weight:800}
.bcnone{margin:auto;text-align:center;color:var(--mut);font-size:15px;line-height:2;padding:30px}
.bcnone b{display:grid;place-items:center;width:84px;height:84px;margin:0 auto 10px;border-radius:50%;background:linear-gradient(135deg,#f6ecd2,#ecd193);font-size:38px}
.bcw>.bcv.empty .bch,.bcw>.bcv.empty .bcq,.bcw>.bcv.empty .bcf,.bcw>.bcv.empty .bcr2,.bcw>.bcv.empty .bcrq,.bcw>.bcv.empty .bcdown{display:none}
.bcw>.bcv.empty .bcms{background:var(--soft,#f6f2e9)}
.bcback{display:none!important}
html[dir="ltr"] .bcback{transform:scaleX(-1)}
@media (max-width:760px){
 .bcw:not(.one){grid-template-columns:1fr;height:auto;min-height:0}.bcw:not(.one) .bcl{border:0}.bcw:not(.one) .bcli{overflow:visible}
 .bcw:not(.one)>.bcv{display:none}.bcw:not(.one).open>.bcv{display:flex;position:fixed;inset:0;z-index:60;height:100dvh;padding-bottom:env(safe-area-inset-bottom,0px)}
 .bcw .bcback{display:grid!important}
 .bcg{max-width:86%}
}
/* صفحة الفرع والسائق: نافذة فيها القايمة أو المحادثة (عمود واحد) */
.bcw.one{grid-template-columns:1fr;height:100%;min-height:0;border:0;border-radius:0;box-shadow:none}
.bcw.one .bcl{border:0}.bcw.one>.bcv{display:none}.bcw.one.open>.bcv{display:flex}.bcw.one.open>.bcl{display:none}
.bcw.one .bcback{display:grid!important}
#bcfab{position:fixed;left:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#2b2416,#1b1b1b);color:#e8cf8a;border:2px solid #d4ae5c;box-shadow:0 10px 26px rgba(0,0,0,.3);cursor:pointer;display:grid;place-items:center;animation:ui-fade .3s ease both}
#bcfab svg{width:28px;height:28px}
#bcfab i{position:absolute;top:-4px;right:-4px;font-style:normal;background:#c0392b;color:#fff;border-radius:999px;min-width:22px;padding:0 6px;font-size:12.5px;line-height:22px;font-weight:800;border:2px solid #fff}
#bcfab.nw{animation:bc-ring 1.6s ease-in-out infinite}
@keyframes bc-ring{0%,100%{transform:rotate(0)}10%{transform:rotate(-12deg)}20%{transform:rotate(12deg)}30%{transform:rotate(-8deg)}40%{transform:rotate(0)}}
#me #bcme{font:inherit;font-weight:800;font-size:14px;border:0;border-radius:999px;padding:8px 14px;background:#1b1b1b;color:#fff;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;margin-inline-start:auto}
#me #bcme i{font-style:normal;background:#c0392b;color:#fff;border-radius:999px;min-width:20px;padding:0 6px;font-size:12px;line-height:20px}
#bcm{display:none;position:fixed;inset:0;z-index:85;background:rgba(0,0,0,.55);padding:14px;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
#bcm.on{display:flex;align-items:center;justify-content:center;animation:ui-fade .2s ease both}
#bcm .bcp{width:100%;max-width:580px;height:min(760px,calc(100dvh - 28px));border-radius:22px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.4);background:var(--card)}
@media (max-width:600px){#bcm{padding:0}#bcm .bcp{height:100dvh;max-width:none;border-radius:0;padding-bottom:env(safe-area-inset-bottom,0px)}}
.bcrqb{font:inherit;font-size:13px;font-weight:700;border:1.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:5px 12px;cursor:pointer;white-space:nowrap}
@media (prefers-color-scheme:dark){
 .bcms{background-color:#0f0d0a;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='none' stroke='%23d4ae5c' stroke-opacity='.06' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='14' y='16' width='22' height='18' rx='3'/%3E%3Cpath d='M14 22h22M25 16v6'/%3E%3Cpath d='M92 18h24a5 5 0 0 1 5 5v12a5 5 0 0 1-5 5h-14l-7 6v-6h-3a5 5 0 0 1-5-5V23a5 5 0 0 1 5-5z'/%3E%3Ccircle cx='60' cy='70' r='9'/%3E%3Cpath d='M60 64v6l4 3'/%3E%3Cpath d='M118 82l6 6 12-13'/%3E%3Cpath d='M18 104h26l6 8v10H18z'/%3E%3Ccircle cx='26' cy='124' r='4'/%3E%3Ccircle cx='44' cy='124' r='4'/%3E%3Cpath d='M86 118l7-14 7 14M88 114h10'/%3E%3C/g%3E%3C/svg%3E")}
 .bcq,.bcf,.bcr2{background:#0f0d0a}
 .bcg.me{background:#5a4618;color:#f7ecd0}.bcg.me:not(.cont)::before{background:#5a4618}
 .bcg.ot{background:#24221e;color:#ece6d8}.bcg.ot:not(.cont)::before{background:#24221e}
 .bcg small{color:rgba(255,255,255,.5)}.bcg .tk{color:rgba(255,255,255,.5)}.bcg .tk.rd{color:#53bdeb}
 .bcg.ot>i{color:#e8cf8a}.bcg .rqt{background:rgba(255,255,255,.08)}
 .bcday,.bcmore{background:rgba(36,34,30,.95);color:#d8cfbd}.bcmt{background:rgba(36,34,30,.9)}
 .bcq button{background:#24221e;color:#e8cf8a;border-color:rgba(212,174,92,.3)}
 .bcvo span.bar{background:rgba(255,255,255,.25)}.bcvo span.bar b,.bcvo button{background:#d4ae5c}.bcg.ot .bcvo button,.bcg.ot .bcvo span.bar b{background:#ece6d8;color:#1b1b1b}
 .bcr.on{background:#2b2416}.bcr .nm b u{background:#2b2416;color:#e8cf8a}.bcrq span{color:#e8cf8a}
 .bcfl button.on{background:#d4ae5c;color:#1b1b1b}.bcnone b{background:linear-gradient(135deg,#3a3115,#5a4618)}
}
.tabs .tbn{background:#c0392b;color:#fff;border-radius:999px;padding:0 7px;font-size:12px;line-height:19px;display:inline-block;margin-inline-start:4px;font-weight:800}
@media print{#bcfab,#bcm,#bcme,.bcrqb{display:none!important}}
@media (prefers-reduced-motion:reduce){.bcg,#bcfab.nw{animation:none}}
`;
// ---------- مساعدات ----------
const hm=t=>new Date(N(t)).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
const dayOf=t=>{const d=new Date(N(t)),n=new Date(),y=new Date(n.getTime()-864e5);return d.toDateString()===n.toDateString()?"اليوم":d.toDateString()===y.toDateString()?"أمس":d.toLocaleDateString("ar-EG-u-nu-latn",{weekday:"long",day:"numeric",month:"long"})};
// أيقونات (SVG) زي تطبيقات التواصل
const IC={
  send:`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg>`,
  mic:`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15zm6-3.5a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.9V20H8.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2H13v-2.6a6 6 0 0 0 5-5.9z"/></svg>`,
  down:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`,
  chat:`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.6 1.3 4.9 3.4 6.5L4.6 22l4.2-2.2c1 .3 2.1.4 3.2.4 5.5 0 10-3.9 10-8.6S17.5 3 12 3zm-4 10a1.3 1.3 0 1 1 0-2.6A1.3 1.3 0 0 1 8 13zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"/></svg>`,
  trash:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="22" height="22"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`,
  lock:`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="11" height="11"><path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4z"/></svg>`
};
// علامة الإرسال: ✓ وصلت، ✓✓ زرقا = اتقرت
const tick=rd=>rd?`<svg class="tk rd" viewBox="0 0 18 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 6l3.2 3.2L11 2M7.5 9.2 8.3 10 16.8 1.5"/></svg>`:`<svg class="tk" viewBox="0 0 18 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l3.2 3.2L14 2"/></svg>`;
// لون ثابت للصورة الرمزية حسب الاسم
const avc=s=>{let h=0;for(const ch of String(s))h=(h*31+ch.charCodeAt(0))>>>0;return "c"+(h%8)};
// الصورة الرمزية لأي طرف: صورته، أو أول حرف من اسمه، أو رقم الفرع، أو 🚚 للسائق
function avHtml(p,n,cls){if(isG(p))return `<span class="av ${avc(p)} avd${cls||""}">👥</span>`;const img=ph(p),t=p[0];if(img)return `<img class="av${cls||""}" src="${img}" alt="">`;
  const txt=t==="b"?E(pv(p)):t==="d"?"🚚":E([...String(n||"").replace(/^[^\p{L}\p{N}]+/u,"")][0]||"؟");
  return `<span class="av ${avc(p)}${t==="b"?" avb":t==="d"?" avd":""}${cls||""}">${txt}</span>`}
const when=t=>{if(!t)return "";const d=new Date(N(t)),n=new Date();return d.toDateString()===n.toDateString()?hm(t):Date.now()-N(t)<6*864e5?d.toLocaleDateString("ar-EG-u-nu-latn",{weekday:"short"}):d.toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit"})};
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
// الأطراف: b-كود الفرع / w-إيميل الشخص اللي في المستودع / d-رقم السائق. X.me = طرفي أنا
const T=()=>X.me[0];
const pv=p=>String(p).slice(2);
const isOld=c=>/^\d{3}__/.test(c);// فرع مع المستودع: الشكل القديم {كود}__{إيميل}
// 👥 الجروبات (نوفمبر 2026): grp/{gid} = {name, ms:[الأعضاء], ad:[مديرين الجروب], by, ts, last, u:{مفتاح:لسه ماقراش كام}, r:{مفتاح:قرا لحد إمتى}, nm:{مفتاح:اسمه}}
//   الرسايل grp/{gid}/msgs والصوت aud والصور img. اسم المحادثة جوه الصفحة = "g_"+gid. المفتاح = الطرف من غير رموز (gk)
const isG=c=>/^g_/.test(String(c||""));
const gidOf=c=>String(c).slice(2);
const gk=p=>String(p).replace(/[^A-Za-z0-9]/g,"_");
// مكان الرسايل/الصوت/الصور للمحادثة دي (خاصة أو جروب)
const sub=(cid,s)=>isG(cid)?collection(X.db,"grp",gidOf(cid),s):collection(X.db,"dm",cid,s);
const subDoc=(cid,s,id)=>isG(cid)?doc(X.db,"grp",gidOf(cid),s,id):doc(X.db,"dm",cid,s,id);
// اسم المحادثة مع الطرف ده: فرع مع المستودع بالشكل القديم، والباقي {طرف}__{طرف} مترتبين
function cidFor(peer){if(isG(peer))return peer;const t=[T(),peer[0]].sort().join("");if(t==="bw"){const b=T()==="b"?X.me:peer,w=T()==="w"?X.me:peer;return pv(b)+SEP+pv(w)}return [X.me,peer].sort().join(SEP)}
function peerOf(c){if(isG(c))return c;if(isOld(c)){const i=c.indexOf(SEP);return T()==="b"?"w-"+c.slice(i+SEP.length):"b-"+c.slice(0,i)}const [a,b]=c.split(SEP);return a===X.me?b:a}
const oldBy=()=>T()==="b"?"br":"wh";// اسمي جوه المحادثات القديمة
const mine=(c,by)=>isOld(c)?by===oldBy():by===X.me;// (الجروب زي الجديدة: by = الطرف)
// صاحب الرسالة (كطرف): القديمة br/wh، الجديدة الطرف نفسه
const byParty=(c,by)=>isOld(c)?(by==="br"?"b-"+c.slice(0,c.indexOf(SEP)):"w-"+c.slice(c.indexOf(SEP)+SEP.length)):String(by||"");
function pname(p,c){const t=p[0],v=pv(p),s=c&&SUMS[c];
  if(isG(p)){const G=SUMS[p];return (G&&G.name)||"جروب"}
  if(t==="b")return X.brn(v)||v;
  if(t==="d"){const d=DDIR[v];return (d&&d.n)||(s&&s.nm&&s.nm[p])||v}
  const d=DIR[v];return (d&&d.n)||(s&&(s.whn||(s.nm&&s.nm[p])))||v.split("@")[0]}
const pk=p=>p[0]==="w"?((DIR[pv(p)]||{}).k||""):"";
const ph=p=>p&&p[0]==="w"?AVA[pv(p)]||"":"";
// لا يزال ماقريتش كام في المحادثة دي
function unreadOf(s){if(!s)return 0;
  if(s._g){const u=N((s.u||{})[gk(X.me)]);return u||(s.last&&s.last.by!==X.me&&N(s.last.ts)>N((s.r||{})[gk(X.me)])?1:0)}
  if(s._old)return T()==="b"?(N(s.nb)||(N(s.lw)>N(s.rb)?1:0)):(N(s.nw)||(N(s.lb)>N(s.rw)?1:0));
  const i=s.ps.indexOf(X.me),o=1-i;return N(s["n"+i])||(N(s["l"+o])>N(s["r"+i])?1:0)}
// المستودع: كام محادثة بانتظار رد. الفرع والسائق: كام رسالة جديدة
export function unreadTotal(){if(!X)return 0;return Object.values(SUMS).reduce((a,s)=>a+(T()==="w"?(unreadOf(s)?1:0):unreadOf(s)),0)}
// زرار "كلّم ... عن الطلب ده" على كارت الطلب (cls = شكل الزرار في الصفحة)
export const rqBtn=(r,cls)=>X&&T()!=="d"?`<button class="${cls||"bcrqb"}" data-bcrq="${E(r.id)}" data-no="${E(r.no||"")}" data-br="${E(r.br||"")}" type="button" title="محادثة خاصة بخصوص هذا الطلب">💬 ${T()==="b"?"تواصل مع المستودع":"تواصل مع الفرع"}</button>`:"";
const modal=()=>T()!=="w";// الفرع والسائق: نافذة. المستودع: تبويب
const GRP={w:[["","الكل"],["w","🏭 المستودع"],["m","🏛 الإدارة"],["g","👥 الجروبات"],["b","الفروع"],["d","السائقين"],["s","الموظفين"]],b:[["","الكل"],["w","🏭 المستودع"],["m","🏛 الإدارة"],["g","👥 الجروبات"],["d","السائقين"],["b","الفروع"]],d:[["","الكل"],["w","🏭 المستودع"],["m","🏛 الإدارة"],["g","👥 الجروبات"],["b","الفروع"],["s","الموظفين"]]};
const IMG_IC=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`;
// ---------- المحادثة نفسها (مشتركة بين اللوحة والفرع والسائق) ----------
function convHtml(){
  return `<div class="bch"><button class="bcback" data-bcback type="button" aria-label="رجوع">→</button><span id="bcav"></span><div><b id="bct"></b><small id="bcsub"></small></div>${modal()?`<button data-bcclose type="button" aria-label="إغلاق">✕</button>`:""}</div>
  <div class="bcms" id="bcms"></div>
  <button class="bcdown" id="bcdown" data-bcdown type="button" aria-label="آخر رسالة" title="آخر رسالة" hidden>${IC.down}</button>
  <div class="bcrq" id="bcrq" hidden></div>
  <div class="bcq">${(QUICK[T()]||[]).map(q=>`<button data-bcq="${E(q)}" type="button">${E(q)}</button>`).join("")}</div>
  <div class="bcf" id="bcfoot"><button class="pic" id="bcpic" type="button" title="إرسال صورة" aria-label="إرسال صورة">${IMG_IC}</button><input type="file" id="bcfile" accept="image/*" hidden><textarea id="bcin" rows="1" maxlength="${LEN}" placeholder="اكتب رسالة..."></textarea><button class="mic" id="bcmic" type="button" title="رسالة صوتية" aria-label="رسالة صوتية">${IC.mic}</button><button id="bcsend" type="button" title="إرسال" aria-label="إرسال">${IC.send}</button></div>
  <div class="bcr2" id="bcrec" hidden><button class="x" data-bccancel type="button" title="إلغاء" aria-label="إلغاء">${IC.trash}</button><div class="pill"><span class="dot"></span><span class="tm" id="bcrt">0:00</span></div><button class="ok" data-bcstop type="button" title="إرسال" aria-label="إرسال">${IC.send}</button></div>`;
}
const emptyTxt=()=>`<div class="bcnone"><b>💬</b>اختر من القائمة لتبدأ محادثة<br><small>🔒 محادثاتك خاصة بك، لا يراها أحد غيرك</small></div>`;
function buildRoot(){
  const r=document.createElement("div");r.className="bcw"+(modal()?" one":"");
  r.innerHTML=`<aside class="bcl"><div class="bclh"><div><b>المحادثات</b><small id="bcpend">${modal()?"":"🔒 كل محادثة خاصة بين طرفيها فقط"}</small></div>${X.canGroup?`<button class="bcng" data-bcng type="button" title="جروب جديد">👥 جروب جديد</button>`:""}${modal()?`<button data-bcclose type="button" aria-label="إغلاق">✕</button>`:""}</div><div class="bcs"><input id="bcqs" type="search" placeholder="🔎 ابحث عن اسم أو فرع" autocomplete="off"><div class="bcfl">${(GRP[T()]||[]).filter(([k])=>!(T()==="w"&&k==="b"&&!X.canBr)).map(([k,l])=>`<button type="button" data-bcf="${k}" class="${FILT===k?"on":""}">${E(l)}</button>`).join("")}</div></div><div class="bcli"></div></aside><section class="bcv empty">${convHtml()}</section>`;
  wire(r);
  r.addEventListener("scroll",e=>{const t=e.target;if(t.id==="bcms"){SCR={...SCR,t:t.scrollTop,end:t.scrollHeight-t.scrollTop-t.clientHeight<90};paintDown()}else if(t.classList&&t.classList.contains("bcli"))SCR.l=t.scrollTop},true);
  r.querySelector("#bcms").innerHTML=modal()?"":emptyTxt();
  return r;
}
function wire(el){
  el.addEventListener("click",e=>{
    const t=e.target;
    if(t.closest("[data-bcq]")){const i=g("bcin"),q=t.closest("[data-bcq]").dataset.bcq;i.value=i.value?i.value+" "+q:q;i.focus();grow();return}
    if(t.closest("#bcsend"))return void sendText();
    if(t.closest("#bcpic")){const f=g("bcfile");if(f){f.value="";f.click()}return}
    if(t.closest("[data-img]"))return void viewImg(t.closest("[data-img]").dataset.img);
    if(t.closest("[data-bcng]"))return void groupForm(null);
    if(isG(CUR)&&t.closest(".bch")&&!t.closest("button"))return void groupInfo();
    if(t.closest("#bcmic"))return void startRec();
    if(t.closest("[data-bcstop]"))return void stopRec(false);
    if(t.closest("[data-bccancel]"))return void stopRec(true);
    if(t.closest("[data-play]"))return void play(t.closest("[data-play]").dataset.play);
    if(t.closest("[data-bcrqx]")){if(CUR)delete CTX[CUR];paintCtx();return}
    if(t.closest("[data-bcdown]")){const b=g("bcms");if(b)b.scrollTo({top:b.scrollHeight,behavior:"smooth"});return}
    if(t.closest("[data-bcmore]")){keepTop={h:g("bcms").scrollHeight,t:g("bcms").scrollTop};LIM+=PAGE;listen(GEN);return}
    if(t.closest("[data-bcback]")){if(ROOT)ROOT.classList.remove("open");setCode(null);paintList();return}
    if(t.closest("[data-bcclose]"))return void closeBr();
    const f=t.closest("[data-bcf]");if(f){FILT=f.dataset.bcf;el.querySelectorAll("[data-bcf]").forEach(b=>b.classList.toggle("on",b.dataset.bcf===FILT));paintList();return}
    const r=t.closest("[data-bcc]");if(r){setCode(cidFor(r.dataset.bcc));if(ROOT)ROOT.classList.add("open");paintList();if(!isMob())setTimeout(()=>{const i=g("bcin");if(i)i.focus()},50)}
  });
  el.addEventListener("keydown",e=>{
    // الحاسوب: Enter يبعت و Shift+Enter سطر جديد. الجوال: Enter سطر جديد عادي
    if(e.target.id==="bcin"&&e.key==="Enter"&&!e.shiftKey&&!isMob()){e.preventDefault();sendText()}
  });
  el.addEventListener("change",e=>{if(e.target.id==="bcfile"&&e.target.files&&e.target.files[0])sendImage(e.target.files[0])});
  el.addEventListener("input",e=>{if(e.target.id==="bcin"){grow();if(CUR)DRAFT[CUR]=e.target.value}if(e.target.id==="bcqs"){Q=e.target.value.trim().toLowerCase();paintList()}});
}
// خانة الكتابة بتكبر مع النص، والزرار بيتبدّل: 🎤 لما فاضية، وسهم الإرسال لما فيها كلام
function grow(){const t=g("bcin");if(!t)return;t.style.height="auto";t.style.height=Math.min(130,t.scrollHeight+2)+"px";const f=g("bcfoot");if(f)f.classList.toggle("has",!!t.value.trim())}
function paintDown(){const b=g("bcdown"),m=g("bcms");if(b&&m)b.hidden=!CUR||m.scrollHeight-m.scrollTop-m.clientHeight<200}
function paintHead(){
  if(!g("bct"))return;
  const av=g("bcav");if(av)av.innerHTML="";
  if(!CUR){g("bct").textContent="";g("bcsub").textContent="";return}
  const p=peerOf(CUR),k=pk(p),n=pname(p,CUR);
  if(isG(CUR)){const G=SUMS[CUR]||{},ms=Array.isArray(G.ms)?G.ms:[];
    g("bct").innerHTML=`<bdi>${E(n)}</bdi>`;
    g("bcsub").innerHTML=`👥 ${ms.length} عضو · اضغط لعرض الأعضاء`;
    if(av)av.innerHTML=avHtml(CUR,n," sm");return}
  g("bct").innerHTML=`<bdi${p[0]==="b"?' dir="ltr"':""}>${E(n)}</bdi>`;
  const kind=p[0]==="d"?"سائق":p[0]==="b"?"فرع":"";
  // 🟢 متصل الآن / آخر ظهور (لو مفيش معلومة: "محادثة خاصة" زي الأول)
  const pr=presTxt(p),on=pr&&presOf(p).on;
  g("bcsub").innerHTML=`${k?E(k)+" · ":kind?E(kind)+" · ":""}${pr?`<span class="${on?"bcpr":""}">${on?"🟢 ":""}${E(pr)}</span>`:`${IC.lock} محادثة خاصة بينكما فقط`}`;
  if(av)av.innerHTML=avHtml(p,n," sm");
}
function paintCtx(){const b=g("bcrq");if(!b)return;const c=CUR&&CTX[CUR];b.hidden=!c;if(c)b.innerHTML=`<span>📦 بخصوص طلب <bdi dir="ltr">${E(c.no)}</bdi></span><button data-bcrqx type="button" aria-label="أزل">✕</button>`}
function paintPend(){const p=g("bcpend");if(p)p.innerHTML=PEND?`📦 بخصوص طلب <bdi dir="ltr">${E(PEND.no)}</bdi> — اختر من تريد محادثته`:"اختر من تريد محادثته · 🔒 كل محادثة خاصة"}
// كل تغيير في المحادثة المفتوحة: نقفل السماع القديم ونبدأ جديد. GEN بيتأكد إن أي رد متأخر من محادثة تانية يتجاهل (لا يوجد تداخل)
function setCode(cid){
  if(CUR===cid)return;
  stopRec(true);stopPlay();
  if(UNM){UNM();UNM=null}
  CUR=cid;GEN++;MSGS=[];LIM=PAGE;keepTop=null;SCR.end=true;
  if(cid&&PEND){CTX[cid]=PEND;PEND=null;paintPend()}
  const v=ROOT&&ROOT.querySelector(".bcv");if(v)v.classList.toggle("empty",!cid);
  if(!g("bcms"))return;
  const i=g("bcin");if(i){i.value=cid?DRAFT[cid]||"":"";grow()}
  paintHead();paintCtx();
  if(!cid){g("bcms").innerHTML=modal()?"":emptyTxt();return}
  g("bcms").innerHTML=`<div class="bcmt">⏳ لحظة...</div>`;
  listen(GEN);
}
function listen(my){
  if(UNM){UNM();UNM=null}
  const cid=CUR;if(!cid)return;
  UNM=onSnapshot(query(sub(cid,"msgs"),orderBy("ts","desc"),limit(LIM)),sn=>{
    if(my!==GEN||cid!==CUR)return;
    MSGS=sn.docs.map(d=>({id:d.id,...d.data()})).filter(m=>m&&typeof m.by==="string").sort((a,b)=>N(a.ts)-N(b.ts));
    paintMsgs();markRead();
  },e=>{if(my!==GEN||!g("bcms"))return;
    // محادثة جديدة لا يزال مااتعملتش (لا يوجد ولا رسالة): مش غلط
    if(e&&e.code==="permission-denied"&&!SUMS[cid]){MSGS=[];paintMsgs();return}
    g("bcms").innerHTML=`<div class="bcmt">⚠️ تعذر تحميل الرسائل${e&&e.code==="permission-denied"?" (غير مسموح)":"، تأكد من الإنترنت"}</div>`});
}
// قُرئت إمتى: لو نفس يوم الإرسال الساعة بس، غير كده اليوم أيضاً
const rdAt=(rd,ts)=>new Date(N(rd)).toDateString()===new Date(N(ts)).toDateString()?hm(rd):when(rd)+" "+hm(rd);
function whoHtml(ap,m){
  if(ap[0]==="w"){const img=ph(ap),k=pk(ap),n=(DIR[pv(ap)]&&DIR[pv(ap)].n)||m.n||"المستودع";return `${img?`<img src="${img}" alt="">`:""}${E(n)}${k?` · ${E(k)}`:""}`}
  if(ap[0]==="b")return `${m.n?E(m.n)+" · ":""}فرع <bdi dir="ltr">${E(X.brn(pv(ap))||pv(ap))}</bdi>`;
  return `🚚 ${E(m.n||pname(ap))}`;
}
function paintMsgs(){
  const box=g("bcms");if(!box||!CUR)return;
  const atEnd=box.scrollHeight-box.scrollTop-box.clientHeight<90,firstPaint=!box.querySelector(".bcg,.bcmt.ok");
  let h=MSGS.length>=LIM?`<button class="bcmore" data-bcmore type="button">⬆ رسائل أقدم</button>`:"",d="",prev=null;
  const lastMe=[...MSGS].reverse().find(m=>mine(CUR,m.by));
  const grp=isG(CUR),G=grp?SUMS[CUR]||{}:null,gms=grp&&Array.isArray(G.ms)?G.ms:[];
  // الجروب: كام عضو قرا الرسالة (من r في ملخّص الجروب)
  const readN=m=>gms.filter(p=>p!==m.by&&N((G.r||{})[gk(p)])>=N(m.ts)).length;
  if(!MSGS.length)h+=grp?`<div class="bcmt ok"><b>👥</b>لا توجد رسائل في الجروب بعد.<br>اكتب أول رسالة، أو أرسل صورة 📷 أو رسالة صوتية 🎤.<br><small>🔒 لا يرى الرسائل إلا أعضاء الجروب (${gms.length})</small></div>`:`<div class="bcmt ok"><b>👋</b>لا توجد رسائل بعد.<br>اكتب لـ ${E(pname(peerOf(CUR),CUR))} أي شيء، أو اضغط 🎤 وسجّل رسالة صوتية.<br><small>🔒 الرسائل هنا لا يراها أحد غيركم</small></div>`;
  MSGS.forEach(m=>{const dd=dayOf(m.ts);if(dd!==d){d=dd;prev=null;h+=`<div class="bcday">${E(dd)}</div>`}
    const me=mine(CUR,m.by);
    // رسايل ورا بعض من نفس الشخص خلال 5 دقايق = مجموعة واحدة (من غير اسم ولا ذيل)، زي تطبيقات التواصل
    const cont=!!prev&&prev.by===m.by&&String(prev.n||"")===String(m.n||"")&&N(m.ts)-N(prev.ts)<5*6e4&&!(m.rq&&m.rq.no);prev=m;
    // gone: السيرفر مسح الصوت بعد 30 يوم (علشان مساحة Firebase المجانية)
    const body=m.v&&m.gone?`<div class="bcgone">🎤 رسالة صوتية (${mmss(m.d)}) · حُذفت تلقائياً بعد 30 يوماً</div>`:m.v?`<div class="bcvo"><button data-play="${E(m.id)}" type="button" aria-label="تشغيل">${PLAY.id===m.id?"⏸":"▶"}</button><span class="bar"><b id="bcpb-${E(m.id)}"></b></span><span class="du">${mmss(m.d)}</span></div>`
      // صورة: المصغّرة جوه الرسالة، والأصلية بجودة عالية بتتحمّل لما يدوس عليها
      :m.img?`<button class="bcimg" data-img="${E(m.id)}" type="button" aria-label="فتح الصورة" style="aspect-ratio:${N(m.w)||4}/${N(m.h)||3}">${/^data:image\/jpeg;base64,/.test(m.th||"")?`<img src="${m.th}" alt="">`:"📷"}</button>${m.t?`<span class="bcx" data-notr>${E(m.t)}</span>`:""}`
      :QALL.has(m.t)?`<span class="bcx">${E(m.t)}</span>`:`<span class="bcx" data-notr>${E(m.t||"")}</span>`;
    const rq=m.rq&&m.rq.no?`<span class="rqt">📦 بخصوص طلب <bdi dir="ltr">${E(m.rq.no)}</bdi></span>`:"";
    // اسم اللي كتب (للطرف التاني بس، وأول المجموعة) + الوقت + علامة القراءة لرسايلي (والوقت بالظبط لما تقف عليها)
    const who=!me&&!cont?`<i>${whoHtml(byParty(CUR,m.by),m)}</i>`:"";
    const rn=grp&&me?readN(m):0,allRd=grp?rn>=gms.length-1&&gms.length>1:!!m.rd;
    const rdT=me?(grp?`قرأها ${rn} من ${Math.max(0,gms.length-1)}`:m.rd?`قُرئت ${rdAt(m.rd,m.ts)}`:"لم تُقرأ بعد"):"";
    h+=`<div class="bcg ${me?"me":"ot"}${cont?" cont":""}${m.img?" pic":""}">${who}${rq}${body}<small${rdT?` title="${E(rdT)}"`:""}>${hm(m.ts)}${me?tick(allRd):""}</small></div>`;
    // تحت آخر رسالة ليا: "قُرئت الساعة كام" (زي "Seen" في تطبيقات التواصل)، وفي الجروب "قرأها كام من كام"
    if(m===lastMe&&m===MSGS[MSGS.length-1])h+=`<div class="bcseen">${grp?`${tick(allRd)} 👁 قرأها ${rn} من ${Math.max(0,gms.length-1)}`:m.rd?`${tick(1)} قُرئت ${rdAt(m.rd,m.ts)}`:`${tick(0)} لم تُقرأ بعد`}</div>`});
  box.innerHTML=h;
  if(keepTop){box.scrollTop=box.scrollHeight-keepTop.h+keepTop.t;keepTop=null}
  else if(atEnd||firstPaint)box.scrollTop=box.scrollHeight;
  paintDown();
}
// "قُرئت": لما المحادثة مفتوحة قدامه فعلاً. بنسجّل وقت القراية على كل رسالة من الطرف المجدداً (rd) + نصفّر العدّاد
function markRead(){
  if(!X||!CUR||document.hidden||marking||!X.visible())return;
  // الجروب: مابنعلّمش كل رسالة، بنحدّث "قرأ لحد إمتى" بتاعي في ملخّص الجروب بس (كتابة واحدة)
  if(isG(CUR)){const s=SUMS[CUR],k=gk(X.me);if(!s||!(N((s.u||{})[k])||N(s.last&&s.last.ts)>N((s.r||{})[k])))return;
    marking=true;updateDoc(doc(X.db,"grp",gidOf(CUR)),{["u."+k]:0,["r."+k]:Date.now()}).catch(()=>{}).finally(()=>{marking=false});return}
  const s=SUMS[CUR],un=MSGS.filter(m=>!mine(CUR,m.by)&&!m.rd).slice(-100);
  if(!(s&&unreadOf(s))&&!un.length)return;
  marking=true;const cid=CUR,now=Date.now(),b=writeBatch(X.db);
  if(s&&unreadOf(s)){if(s._old)b.update(doc(X.db,"dm",cid),T()==="b"?{rb:now,nb:0}:{rw:now,nw:0});else{const i=s.ps.indexOf(X.me);b.update(doc(X.db,"dm",cid),{["r"+i]:now,["n"+i]:0})}}
  un.forEach(m=>b.update(doc(X.db,"dm",cid,"msgs",m.id),{rd:now}));
  b.commit().catch(()=>{}).finally(()=>{marking=false});
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)markRead()});
// ---------- الإرسال ----------
function write(cid,m,a,full){
  const ts=Date.now(),n=String(X.name()||"").trim().slice(0,60),b=writeBatch(X.db),ref=doc(sub(cid,"msgs"));
  const old=isOld(cid),by=old?oldBy():X.me,rq=CTX[cid],msg={by,n,ts,...m,...(rq?{rq:{id:String(rq.id).slice(0,40),no:String(rq.no).slice(0,40)}}:{})};
  if(a)b.set(subDoc(cid,"aud",ref.id),{a});
  if(full)b.set(subDoc(cid,"img",ref.id),{i:full});// الصورة بجودتها الكاملة لوحدها (بتتحمّل بس لما حد يفتحها)
  b.set(ref,msg);
  const last={by,n,t:m.v?"🎤 رسالة صوتية":m.img?(m.t?"📷 "+String(m.t).slice(0,190):"📷 صورة"):String(m.t).slice(0,200),ts,v:!!m.v};
  if(isG(cid)){
    // الجروب: آخر رسالة + العدّاد يزيد لكل الأعضاء غيري + أنا قريت لحد دلوقتي
    const G=SUMS[cid]||{},up={last,["r."+gk(X.me)]:ts,["u."+gk(X.me)]:0,["nm."+gk(X.me)]:String(X.myLabel?X.myLabel():n||pname(X.me)).slice(0,60)};
    (Array.isArray(G.ms)?G.ms:[]).forEach(p=>{if(p!==X.me)up["u."+gk(p)]=increment(1)});
    b.update(doc(X.db,"grp",gidOf(cid)),up);
    return b.commit();
  }
  if(old){
    const code=cid.slice(0,cid.indexOf(SEP)),wh=cid.slice(cid.indexOf(SEP)+SEP.length),sum={brn:String(X.brn(code)||code).slice(0,40),last};
    // اسم الشخص: المستودع بيحدّثه دايماً، والفرع بيكتبه بس في أول رسالة (القواعد مش بتسمح للفرع يغيّره)
    if(by==="wh")Object.assign(sum,{br:code,wh,whn:n||"المستودع",lw:ts,rw:ts,nb:increment(1)});
    else Object.assign(sum,SUMS[cid]?{}:{br:code,wh,whn:String(pname("w-"+wh,cid)).slice(0,60)},{lb:ts,rb:ts,nw:increment(1)});
    b.set(doc(X.db,"dm",cid),sum,{merge:true});
  }else{
    // الجديدة: الطرفين مترتبين، وأنا الطرف رقم i. اسمي في nm (كل واحد بيكتب اسمه هو بس)
    const peer=peerOf(cid),ps=[X.me,peer].sort(),i=ps.indexOf(X.me),o=1-i;
    b.set(doc(X.db,"dm",cid),{ps,nm:{[X.me]:String(X.myLabel?X.myLabel():n||pname(X.me)).slice(0,60)},last,["l"+i]:ts,["r"+i]:ts,["n"+o]:increment(1)},{merge:true});
  }
  return b.commit();
}
async function deliver(cid,m,a,onOk,full){
  busy=true;const sb=g("bcsend");if(sb)sb.disabled=true;
  try{await withTimeout(write(cid,m,a,full),full?45000:20000);onOk&&onOk();X.ping(cid)}
  catch(x){
    const w=await failReason(x);
    // النت بطيء: الرسالة محفوظة على الجهاز وهتتبعت لوحدها (ما نبعتهاش مجدداً علشان ما تتكررش)
    if(w==="slow"){onOk&&onOk();X.toast("⏳ الإنترنت بطيء: سترسل الرسالة تلقائياً فور تحسّن الاتصال");X.ping(cid)}
    else{const p=peerOf(cid),gone=(p[0]==="w"&&!DIR[pv(p)])||(p[0]==="d"&&!DDIR[pv(p)]);
      X.toast(w==="denied"?(gone?"هذا الشخص لم يعد موجوداً. اختر شخصاً آخر":"غير مسموح لك بالإرسال في هذه المحادثة (ربما لم تتحدّث القواعد بعد)"):FAIL_MSG[w]||"تعذر الإرسال",true)}
  }
  busy=false;if(g("bcsend"))g("bcsend").disabled=false;
}
function sendText(){
  const i=g("bcin");if(!i||!CUR||busy)return;
  const t=i.value.trim().slice(0,LEN),cid=CUR;if(!t)return;
  deliver(cid,{t},null,()=>{DRAFT[cid]="";if(CUR===cid){i.value="";grow()}});
}

// ---------- 📷 الصور (بأعلى جودة تنفع في الخطة المجانية) ----------
// الأصلية: أطول ضلع لحد 2048 بكسل وJPEG بأعلى جودة تدخل في مستند واحد (أقل من 950 كيلو حرف)، والمصغّرة 420 بكسل جوه الرسالة
const IMG_MAX=950000;
function loadImg(file){return new Promise((ok,no)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);ok(im)};im.onerror=()=>{URL.revokeObjectURL(u);no(new Error("img"))};im.src=u})}
function toJpeg(im,side,q){const s=Math.min(1,side/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.max(1,Math.round(im.naturalWidth*s)),h=Math.max(1,Math.round(im.naturalHeight*s));
  const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,w,h);x.imageSmoothingQuality="high";x.drawImage(im,0,0,w,h);return {d:c.toDataURL("image/jpeg",q),w,h}}
async function sendImage(file){
  if(!CUR||busy)return;const cid=CUR,i=g("bcin");
  if(!/^image\//.test(file.type||"")){X.toast("اختر صورة فقط");return}
  X.toast("⏳ جاري تجهيز الصورة بأعلى جودة...");
  let im;try{im=await loadImg(file)}catch(e){X.toast("تعذر قراءة الصورة",true);return}
  // نبدأ بأعلى جودة ونقلّل لحد ما تدخل في المساحة
  let best=null;
  for(const [side,q] of [[2048,.92],[2048,.85],[1800,.85],[1600,.82],[1600,.75],[1400,.75],[1200,.72],[1000,.7]]){const r=toJpeg(im,side,q);if(r.d.length<=IMG_MAX){best=r;break}}
  if(!best){X.toast("الصورة كبيرة جداً، جرّب صورة أخرى",true);return}
  const th=toJpeg(im,420,.72);
  const cap=i?String(i.value||"").trim().slice(0,LEN):"";
  const m={img:1,w:best.w,h:best.h,th:th.d};if(cap)m.t=cap;
  deliver(cid,m,null,()=>{if(cap){DRAFT[cid]="";if(CUR===cid&&i){i.value="";grow()}}X.toast("📷 أُرسلت الصورة")},best.d);
}
const IMGC=new Map();
async function viewImg(id){
  const m=MSGS.find(x=>x.id===id),cid=CUR;if(!m)return;
  let v=g("bciv");if(!v){v=document.createElement("div");v.id="bciv";v.addEventListener("click",e=>{if(e.target===v||e.target.closest("[data-ivx]"))v.className=""});document.body.appendChild(v)}
  v.className="on";v.innerHTML=`<div class="iv-t"><b>${E(m.n||"")}</b><small>${hm(m.ts)}</small><button data-ivx type="button" aria-label="إغلاق">✕</button></div><img src="${m.th||""}" alt=""><div class="iv-l">⏳ تحميل الجودة الكاملة...</div>`;
  let full=IMGC.get(cid+"/"+id);
  if(!full){try{const s=await withTimeout(getDoc(subDoc(cid,"img",id)),20000);full=s.exists()?String(s.data().i||""):""}catch(e){full=""}
    if(/^data:image\/jpeg;base64,/.test(full)){IMGC.set(cid+"/"+id,full);if(IMGC.size>20)IMGC.delete(IMGC.keys().next().value)}}
  if(!v.classList.contains("on"))return;
  if(!/^data:image\/jpeg;base64,/.test(full)){const l=v.querySelector(".iv-l");if(l)l.textContent="تعذر تحميل الصورة الأصلية";return}
  v.querySelector("img").src=full;const l=v.querySelector(".iv-l");
  if(l)l.innerHTML=`<a href="${full}" download="tasooma-${new Date(N(m.ts)).toISOString().slice(0,10)}.jpg">⬇️ حفظ الصورة</a>${m.t?`<div data-notr>${E(m.t)}</div>`:""}`;
}

// ---------- 👥 إنشاء/تعديل جروب (المالك والمديرين) ----------
let GF=null;// {gid, name, sel:Set}
function allParties(){
  const out=[];(X.codes||[]).forEach(b=>out.push({p:"b-"+String(b).split("-")[0],n:String(b),t:"b"}));
  Object.entries(DIR).forEach(([e,d])=>out.push({p:"w-"+e,n:(d&&d.n)||e.split("@")[0],t:"w"}));
  Object.entries(DDIR).forEach(([k,d])=>out.push({p:"d-"+k,n:(d&&d.n)||k,t:"d"}));
  return out;
}
function groupForm(gid){
  if(!X||!X.canGroup)return;const G=gid?SUMS["g_"+gid]:null;
  GF={gid,name:G?G.name:"",sel:new Set(G&&Array.isArray(G.ms)?G.ms:[X.me]),q:""};paintGF();
}
function paintGF(){
  let m=g("bcgm");if(!m){m=document.createElement("div");m.id="bcgm";m.addEventListener("click",gfClick);m.addEventListener("input",e=>{if(e.target.id==="gfq"){GF.q=e.target.value.trim().toLowerCase();paintGFList()}if(e.target.id==="gfn")GF.name=e.target.value});document.body.appendChild(m)}
  m.className="on";
  m.innerHTML=`<div class="gfk2"><div class="gfh"><b>${GF.gid?"✏️ تعديل الجروب":"👥 جروب جديد"}</b><button data-gfx type="button" aria-label="إغلاق">✕</button></div>
  <div class="gfb"><label>اسم الجروب</label><input id="gfn" maxlength="60" value="${E(GF.name)}" placeholder="مثلاً: فروع الرياض + المستودع">
  <div class="gfr"><label>الأعضاء <b id="gfc"></b></label><input id="gfq" type="search" placeholder="🔎 ابحث بالاسم أو رقم الفرع"></div>
  <div class="gfs"><button type="button" data-gfall="b">+ كل الفروع</button><button type="button" data-gfall="w">+ كل المستودع</button><button type="button" data-gfall="d">+ كل السائقين</button><button type="button" data-gfnone>إلغاء الكل</button></div>
  <div id="gfl" class="gfl"></div></div>
  <div class="gff"><button class="ok" data-gfsave type="button">${GF.gid?"💾 حفظ":"✅ إنشاء الجروب"}</button>${GF.gid?`<button class="del" data-gfdel type="button">🗑 حذف الجروب</button>`:""}<button data-gfx type="button">إلغاء</button></div></div>`;
  paintGFList();
}
function paintGFList(){
  const l=g("gfl");if(!l)return;const P=allParties(),T0={b:"🏬 الفروع",w:"🏭 المستودع",d:"🚚 السائقين"};
  l.innerHTML=["w","b","d"].map(t=>{const L=P.filter(x=>x.t===t&&(!GF.q||x.n.toLowerCase().includes(GF.q)||x.p.toLowerCase().includes(GF.q)));if(!L.length)return "";
    return `<div class="gft">${T0[t]}</div>${L.map(x=>`<label class="gfi${GF.sel.has(x.p)?" on":""}"><input type="checkbox" data-gfp="${E(x.p)}" ${GF.sel.has(x.p)?"checked":""} ${x.p===X.me?"disabled":""}>${avHtml(x.p,x.n," sm")}<span><bdi${t==="b"?' dir="ltr"':""}>${E(x.n)}</bdi>${x.p===X.me?" (أنت)":""}</span></label>`).join("")}`}).join("");
  const c=g("gfc");if(c)c.textContent=`(${GF.sel.size})`;
}
async function gfClick(e){
  const t=e.target,m=g("bcgm");
  if(e.target===m||t.closest("[data-gfx]")){m.className="";GF=null;return}
  const cb=t.closest("[data-gfp]");if(cb){cb.checked?GF.sel.add(cb.dataset.gfp):GF.sel.delete(cb.dataset.gfp);cb.closest(".gfi").classList.toggle("on",cb.checked);const c=g("gfc");if(c)c.textContent=`(${GF.sel.size})`;return}
  const al=t.closest("[data-gfall]");if(al){allParties().filter(x=>x.t===al.dataset.gfall).forEach(x=>GF.sel.add(x.p));paintGFList();return}
  if(t.closest("[data-gfnone]")){GF.sel=new Set([X.me]);paintGFList();return}
  if(t.closest("[data-gfdel]")){if(!confirm(`حذف الجروب "${GF.name}" نهائياً؟ ستختفي المحادثة عند كل الأعضاء.`))return;
    try{await withTimeout(deleteDoc(doc(X.db,"grp",GF.gid)),15000);if(CUR==="g_"+GF.gid){setCode(null);if(ROOT)ROOT.classList.remove("open")}m.className="";GF=null;X.toast("🗑 حُذف الجروب")}catch(x){X.toast("تعذر الحذف (غير مسموح؟)",true)}return}
  if(t.closest("[data-gfsave]")){
    const name=String(GF.name||"").trim().slice(0,60);if(!name){X.toast("اكتب اسم الجروب");return}
    GF.sel.add(X.me);const ms=[...GF.sel].slice(0,80);if(ms.length<2){X.toast("اختر عضواً واحداً على الأقل");return}
    try{
      if(GF.gid){const G=SUMS["g_"+GF.gid]||{},ad=(Array.isArray(G.ad)?G.ad:[X.me]).filter(p=>ms.includes(p));
        await withTimeout(updateDoc(doc(X.db,"grp",GF.gid),{name,ms,ad:ad.length?ad:[X.me]}),15000);X.toast("💾 تم حفظ الجروب")}
      else{const ref=doc(collection(X.db,"grp")),ts=Date.now(),n=String(X.myLabel?X.myLabel():X.name()||"").slice(0,60);
        await withTimeout(setDoc(ref,{name,ms,ad:[X.me],by:X.me,ts,last:{by:X.me,n,t:"👥 أنشأ الجروب",ts,v:false},u:{},r:{[gk(X.me)]:ts},nm:{[gk(X.me)]:n}}),15000);
        X.toast("✅ أُنشئ الجروب");m.className="";GF=null;setCode("g_"+ref.id);if(ROOT)ROOT.classList.add("open");X.ping("g_"+ref.id);return}
      m.className="";GF=null;
    }catch(x){const w=await failReason(x);X.toast(w==="denied"?"غير مسموح. ربما القواعد (Rules) لم تتحدّث بعد":FAIL_MSG[w]||"تعذر الحفظ",true)}
  }
}
// معلومات الجروب: الأعضاء (ولمدير الجروب: تعديل)
function groupInfo(){
  const G=SUMS[CUR];if(!G)return;const ms=Array.isArray(G.ms)?G.ms:[],ad=Array.isArray(G.ad)?G.ad:[],canEd=X.canGroup&&(ad.includes(X.me)||X.owner);
  let m=g("bcgi");if(!m){m=document.createElement("div");m.id="bcgi";m.addEventListener("click",e=>{if(e.target===m||e.target.closest("[data-gix]"))m.className="";if(e.target.closest("[data-gied]")){m.className="";groupForm(gidOf(CUR))}});document.body.appendChild(m)}
  m.className="on";
  m.innerHTML=`<div class="gfk2"><div class="gfh"><b>👥 ${E(G.name||"")}</b><button data-gix type="button" aria-label="إغلاق">✕</button></div>
  <div class="gfb"><div class="off" style="font-size:13px;margin-bottom:8px">${ms.length} عضو · لا يرى الرسائل إلا أعضاء الجروب</div>
  ${ms.map(p=>{const n=pname(p,CUR)||(G.nm||{})[gk(p)]||pv(p);return `<div class="gfi">${avHtml(p,n," sm")}<span><bdi${p[0]==="b"?' dir="ltr"':""}>${E(n)}</bdi>${p===X.me?" (أنت)":""}${ad.includes(p)?' <small class="gfa">مدير الجروب</small>':""}</span></div>`}).join("")}</div>
  ${canEd?`<div class="gff"><button class="ok" data-gied type="button">✏️ تعديل الأعضاء والاسم</button></div>`:""}</div>`;
}

// ---------- الرسائل الصوتية ----------
function paintRec(){
  const r=g("bcrec"),f=g("bcfoot"),q=ROOT&&ROOT.querySelector(".bcq");if(!r)return;
  r.hidden=!REC;f.hidden=!!REC;if(q)q.hidden=!!REC;
  if(REC)g("bcrt").innerHTML=`${mmss((Date.now()-REC.t0)/1000)} <small>/ ${mmss(MAXS)} · يسجّل…</small>`;
}
async function startRec(){
  if(!CUR||REC||busy)return;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder)return void X.toast("هذا المتصفح لا يدعم تسجيل الصوت. جرّب Chrome أو حدّث المتصفح.",true);
  const cid=CUR,my=GEN;let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})}
  catch(e){return void X.toast(e&&(e.name==="NotAllowedError"||e.name==="SecurityError")?(isMob()?"اسمح للمنصة باستخدام الميكروفون: من إعدادات الموقع أو التطبيق ← الميكروفون ← سماح":"اسمح للمنصة باستخدام الميكروفون: علامة القفل 🔒 بجانب الرابط ← الميكروفون ← سماح"):"لا يوجد ميكروفون يعمل على هذا الجهاز",true)}
  if(my!==GEN||cid!==CUR||REC){stream.getTracks().forEach(t=>t.stop());return}
  const type=["audio/webm;codecs=opus","audio/mp4","audio/ogg;codecs=opus","audio/webm"].find(t=>{try{return MediaRecorder.isTypeSupported(t)}catch(e){return false}})||"";
  let mr;try{mr=new MediaRecorder(stream,{...(type?{mimeType:type}:{}),audioBitsPerSecond:24000})}catch(e){mr=new MediaRecorder(stream)}
  const r={cid,my,mr,stream,chunks:[],size:0,t0:Date.now(),cancel:false,done:false};REC=r;
  mr.ondataavailable=e=>{if(e.data&&e.data.size){r.chunks.push(e.data);r.size+=e.data.size;if(r.size>MAXB&&REC===r)stopRec(false)}};
  mr.onstop=()=>finishRec(r);
  try{mr.start(1000)}catch(e){stream.getTracks().forEach(t=>t.stop());REC=null;return void X.toast("تعذر بدء التسجيل",true)}
  r.timer=setInterval(()=>{if(REC!==r)return;if((Date.now()-r.t0)/1000>=MAXS)stopRec(false);else paintRec()},250);
  paintRec();
}
function stopRec(cancel){
  const r=REC;if(!r)return;REC=null;r.cancel=!!cancel;r.dur=(Date.now()-r.t0)/1000;clearInterval(r.timer);
  try{if(r.mr.state!=="inactive")r.mr.stop();else finishRec(r)}catch(e){finishRec(r)}
  paintRec();
}
async function finishRec(r){
  if(r.done)return;r.done=true;try{r.stream.getTracks().forEach(t=>t.stop())}catch(e){}
  if(r.cancel)return;
  if(r.my!==GEN||r.cid!==CUR)return;// المحادثة اتغيّرت أثناء التسجيل: نلغي
  if(N(r.dur)<1)return void X.toast("الرسالة قصيرة جداً. اضغط 🎤 وتحدّث، ثم اضغط إرسال");
  const blob=new Blob(r.chunks,{type:String(r.mr.mimeType||(r.chunks[0]&&r.chunks[0].type)||"audio/webm").split(";")[0]||"audio/webm"});
  if(blob.size>MAXB*1.05)return void X.toast("الرسالة الصوتية طويلة. سجّل رسالة أقصر",true);
  let a="";try{a=await new Promise((ok,no)=>{const f=new FileReader();f.onload=()=>ok(String(f.result||""));f.onerror=no;f.readAsDataURL(blob)})}catch(e){}
  if(!/^data:audio\/[a-z0-9.+-]+;base64,/.test(a))return void X.toast("تعذر تجهيز الرسالة الصوتية",true);
  deliver(r.cid,{v:true,d:Math.max(1,Math.round(r.dur))},a);
}
// ---------- تشغيل الصوت ----------
function stopPlay(){const p=PLAY;PLAY={id:null,au:null};if(p.au){try{p.au.pause()}catch(e){}}if(p.id){const b=document.querySelector(`[data-play="${p.id}"]`);if(b)b.textContent="▶";const bar=g("bcpb-"+p.id);if(bar)bar.style.width="0"}}
async function play(id){
  if(PLAY.id===id)return void stopPlay();
  stopPlay();
  const cid=CUR,my=GEN,key=cid+"/"+id,btn=()=>document.querySelector(`[data-play="${id}"]`);
  // بنجهّز الصوت جوه الضغطة نفسها (الآيفون مش بيشغّل صوت إلا من ضغطة مباشرة)
  const au=new Audio();PLAY={id,au};au.src=SILENT;au.play().catch(()=>{});
  let a=AUD.get(key);
  if(!a){
    const b=btn();if(b)b.textContent="⏳";
    let none=false;
    try{const s=await withTimeout(getDoc(subDoc(cid,"aud",id)),15000);none=!s.exists();a=none?"":String(s.data().a||"")}catch(e){a=""}
    if(my!==GEN||PLAY.au!==au)return;
    if(!/^data:audio\//.test(a)){stopPlay();return void X.toast(none?"حُذفت هذه الرسالة الصوتية (أقدم من 30 يوماً)":"تعذر تحميل الرسالة الصوتية",true)}
    AUD.set(key,a);if(AUD.size>40)AUD.delete(AUD.keys().next().value);
  }
  au.src=a;
  au.ontimeupdate=()=>{const bar=g("bcpb-"+id);if(bar&&au.duration&&isFinite(au.duration))bar.style.width=Math.min(100,au.currentTime/au.duration*100)+"%"};
  au.onended=()=>{if(PLAY.au===au)stopPlay()};
  au.onerror=()=>{if(PLAY.au===au){stopPlay();X.toast("هذا الجهاز غير قادر على تشغيل هذه الرسالة الصوتية",true)}};
  try{await au.play();const b=btn();if(b&&PLAY.au===au)b.textContent="⏸"}catch(e){if(PLAY.au===au){stopPlay();X.toast("اضغط ▶ مجدداً لتسمع الرسالة")}}
}
// ---------- القايمة: كل اللي أقدر أكلّمهم ----------
// المستودع: الفروع (لو معاه الطلبات أو مدير) + السائقين + الموظفين. الفرع: المستودع (اللي بيرد على الفروع بس) + السائقين + الفروع.
// السائق: المستودع + الفروع. (سائق مع سائق ممنوع)
function people(){
  const out=[],seen=new Set(),add=p=>{if(p&&p!==X.me&&!seen.has(p)){seen.add(p);out.push(p)}};
  const brs=()=>(X.codes||[]).forEach(b=>add("b-"+String(b).split("-")[0]));
  if(T()==="w"){if(X.canBr)brs();Object.keys(DDIR).forEach(d=>add("d-"+d));Object.keys(DIR).forEach(e=>add("w-"+e))}
  else if(T()==="b"){Object.entries(DIR).forEach(([e,d])=>{if(inWh(d)||isM("w-"+e))add("w-"+e)});Object.keys(DDIR).forEach(d=>add("d-"+d));brs()}
  else{Object.keys(DIR).forEach(e=>add("w-"+e));brs()}// السواق: كل المستودع زي ما هو (بيتنسّق مع مسؤولين السيارات)
  Object.values(SUMS).forEach(s=>add(s._peer));// محادثات مع ناس مابقوش في القايمة بتفضل ظاهرة
  return out;
}
function paintList(){
  if(!ROOT)return;const box=ROOT.querySelector(".bcli");if(!box)return;
  const rows=people().filter(p=>!FILT||kindOf(p)===FILT).map(p=>{
    const cid=cidFor(p),s=SUMS[cid],n=pname(p,cid),t=p[0],d=t==="w"?DIR[pv(p)]:null;
    const role=t==="g"?`${(s&&Array.isArray(s.ms)?s.ms.length:0)} عضو`:t==="w"?(d?d.k||(isM(p)?"الإدارة":""):"لم يعد في المستودع"):t==="d"?(DDIR[pv(p)]?"سائق":"لم يعد موجوداً"):"";
    return {p,cid,s,u:unreadOf(s),n,img:ph(p),av:t==="b"?E(pv(p)):t==="d"?"🚚":E([...n][0]||"؟"),cls:t==="b"?"":" p",role,o:t==="g"?0:t==="w"?(d?ROLE_O[d.r]??3:9):t==="d"?4:5};
  }).filter(x=>!Q||x.n.toLowerCase().includes(Q)||x.p.toLowerCase().includes(Q))
    .sort((a,b)=>(b.u>0)-(a.u>0)||N(b.s&&b.s.last&&b.s.last.ts)-N(a.s&&a.s.last&&a.s.last.ts)||a.o-b.o||a.n.localeCompare(b.n));
  box.innerHTML=rows.map(x=>{const l=x.s&&x.s.last,my=l&&mine(x.cid,l.by);
    // آخر رسالة: لو مني بعلامة ✓/✓✓ (اتقرت لو الطرف التاني فتح بعدها)
    const seen=my&&x.s?(x.s._g?false:x.s._old?(T()==="b"?N(x.s.rw)>=N(l.ts):N(x.s.rb)>=N(l.ts)):N(x.s["r"+(1-x.s.ps.indexOf(X.me))])>=N(l.ts)):false;
    // الجروب: اسم اللي كتب قبل الرسالة
    const gw=x.s&&x.s._g&&l&&!my&&l.n?`<b class="gwho">${E(String(l.n).split(" ")[0])}:</b> `:"";
    const pvw=l?`${my?tick(seen):""}${gw}${l.v?"🎤 ":""}<span data-notr>${E(l.v?String(l.t).replace(/^🎤\s*/,""):l.t)}</span>`:`<span>${E("ابدأ محادثة")}</span>`;
    return `<button class="bcr${x.cid===CUR?" on":""}${x.u?" nw":""}" data-bcc="${E(x.p)}" type="button"><span class="avw">${avHtml(x.p,x.n)}${x.p[0]!=="g"&&presOf(x.p)&&presOf(x.p).on?'<i class="bcon" title="متصل الآن"></i>':""}</span><span class="nm"><b><bdi${x.p[0]==="b"?' dir="ltr"':""}>${E(x.n)}</bdi>${x.role?`<u>${E(x.role)}</u>`:""}</b><small>${pvw}</small></span><span class="mt"><small>${l?when(l.ts):""}</small>${x.u?`<i>${x.u}</i>`:""}</span></button>`}).join("")
    ||`<div class="bcnone"><b>🔎</b>${Q?"لا توجد نتائج بهذا الاسم":"لا يوجد أحد هنا بعد"}</div>`;
}
// الصفحة بتعيد رسم نفسها كتير، فالدردشة عنصر ثابت بنحطّه في مكانه كل مرة (الكتابة والتسجيل مايضيعوش)
export function mountWh(host){
  if(!X||!host||modal())return;
  if(!ROOT)ROOT=buildRoot();
  // نقل العنصر بيصفّر مكان السكرول، فبنرجّعه زي ما كان
  host.appendChild(ROOT);paintList();
  const ms=ROOT.querySelector("#bcms"),li=ROOT.querySelector(".bcli");ms.scrollTop=SCR.end?ms.scrollHeight:SCR.t;li.scrollTop=SCR.l;
  if(CUR){paintHead();markRead()}
}
// خرجنا من تبويب الدردشة: نقفل المحادثة المفتوحة (توفير قراءات + وقف أي تسجيل)
export function hideWh(){if(CUR&&X&&!modal()){setCode(null);if(ROOT)ROOT.classList.remove("open")}}
// المستودع: يفتح محادثة مع طرف (rq = بخصوص طلب)
export function openPeer(p,rq){
  if(!X||!/^([bdw]-.|g_.)/.test(String(p||""))||p===X.me)return;
  if(modal())return void openBr(p,rq);
  if(!ROOT)ROOT=buildRoot();
  const cid=cidFor(p);if(rq)CTX[cid]=rq;setCode(cid);paintCtx();ROOT.classList.add("open");paintList();
}
export function openWh(code,rq){if(/^\d{3}$/.test(String(code||"")))openPeer("b-"+code,rq)}
// ---------- الفرع والسائق: زرار عائم + نافذة ----------
function paintFab(){
  if(!X||!modal())return;const n=unreadTotal();
  const f=g("bcfab");if(f){f.innerHTML=`${IC.chat}${n?`<i>${n}</i>`:""}`;f.classList.toggle("nw",!!n);f.title=n?`${n} رسالة جديدة`:"المحادثات"}
  const m=g("bcme");if(m)m.innerHTML=`💬 ${T()==="b"?"المحادثات":"الرسائل"}${n?` <i>${n}</i>`:""}`;
  if(X.onBadge)X.onBadge(n);
}
// peer = الطرف (أو إيميل الشخص من إشعارات قديمة)، rq = بخصوص طلب (الفرع يختار يكلّم مين عنه)
export function openBr(peer,rq){
  if(!X||!modal())return;
  if(typeof peer==="string"&&peer.includes("@")&&!/^w-/.test(peer))peer="w-"+peer;
  let m=g("bcm");
  if(!m){m=document.createElement("div");m.id="bcm";m.innerHTML=`<div class="bcp"></div>`;document.body.appendChild(m);ROOT=buildRoot();m.firstChild.appendChild(ROOT);
    m.addEventListener("click",e=>{if(e.target===m)closeBr()});addEventListener("keydown",e=>{if(e.key==="Escape"&&g("bcm")&&g("bcm").classList.contains("on")&&!REC)closeBr()})}
  m.className="on";
  if(rq){PEND=rq;setCode(null);ROOT.classList.remove("open");if(T()==="b"){FILT="w";ROOT.querySelectorAll("[data-bcf]").forEach(b=>b.classList.toggle("on",b.dataset.bcf===FILT))}}
  else if(peer&&typeof peer==="string"&&/^([bdw]-.|g_.)/.test(peer)&&peer!==X.me){setCode(cidFor(peer));ROOT.classList.add("open")}
  else if(!CUR)ROOT.classList.remove("open");
  paintPend();paintList();markRead();
  if(CUR&&!isMob())setTimeout(()=>{const i=g("bcin");if(i)i.focus()},60);
}
function closeBr(){const m=g("bcm");if(m)m.className="";PEND=null;setCode(null);if(ROOT)ROOT.classList.remove("open");paintFab()}
// ---------- التشغيل ----------
// ctx = {db, party:"b-003"|"w-email"|"d-drv1", name:()=>اسم الكاتب, myLabel?:()=>اسمي في القايمة عند المجدداً, brn:code=>اسم الفرع,
//        codes:[قائمة الفروع], canBr (المستودع: يقدر يكلّم الفروع؟), toast, beep, notify, ping:cid=>..., visible:()=>المحادثة قدامه؟,
//        onBadge(n), show:()=>يفتح تبويب الدردشة (المستودع)}
export function initBChat(ctx){
  stopBChat();
  // (توافق: الصفحات القديمة كانت بتبعت by + me/code)
  const party=ctx.party||(ctx.by==="br"?"b-"+ctx.code:ctx.by==="wh"?"w-"+String(ctx.me||"").toLowerCase():"");
  if(!/^[bdw]-./.test(party))return;
  X={...ctx,me:party,by:party[0]==="b"?"br":party[0]==="w"?"wh":"d",canBr:party[0]==="w"?ctx.canBr!==false:false,brn:ctx.brn||(c=>c)};
  first=true;SUMS={};SO={};SN={};SG={};DIR={};DDIR={};FILT="";
  if(!g("bc-css")){const s=document.createElement("style");s.id="bc-css";s.textContent=STYLE;document.head.appendChild(s)}
  if(!window.__bcrq){window.__bcrq=1;document.addEventListener("click",e=>{const b=e.target.closest("[data-bcrq]");if(!b||!X)return;
    const rq={id:b.dataset.bcrq,no:b.dataset.no};if(T()==="w"){if(X.show)X.show();openWh(b.dataset.br,rq)}else openBr(null,rq)})}
  const onSum=()=>{
    const old=SUMS;SUMS={};
    Object.entries(SO).forEach(([cid,s])=>{if(s&&s.br&&s.wh)SUMS[cid]={...s,cid,_old:true,_peer:peerOf(cid)}});
    Object.entries(SN).forEach(([cid,s])=>{if(s&&Array.isArray(s.ps)&&s.ps.includes(X.me))SUMS[cid]={...s,cid,_peer:peerOf(cid)}});
    // 👥 الجروبات اللي أنا عضو فيها
    Object.entries(SG).forEach(([id,s])=>{if(s&&Array.isArray(s.ms)&&s.ms.includes(X.me)){const cid="g_"+id;SUMS[cid]={...s,cid,_g:true,_peer:cid}}});
    if(!first)Object.entries(SUMS).forEach(([cid,s])=>{const l=s.last,o=old[cid]&&old[cid].last;
      if(l&&!mine(cid,l.by)&&N(l.ts)>N(o&&o.ts)&&!(CUR===cid&&X.visible()&&!document.hidden)){
        const who=pname(s._peer,cid);X.toast(`💬 ${who}: ${String(l.t).slice(0,70)}`);if(X.beep)X.beep();
        if(X.notify)X.notify("💬 "+who,String(l.t).slice(0,140),"g"+cid);
      }});
    first=false;paintHead();if(CUR)paintMsgs();paintList();paintFab();markRead();
    if(!modal()&&X.onBadge)X.onBadge(unreadTotal());
  };
  let gotO=T()==="d"||(T()==="w"&&!X.canBr),gotN=false,gotG=false;
  const fire=()=>{if(gotO&&gotN&&gotG)onSum()};
  // أسماء وكنيات وصور اللي في المستودع، وأسماء السائقين
  const again=()=>{paintList();paintHead();if(CUR)paintMsgs()};
  // الحضور: لو أي حد فتح أو قفل، نحدّث القايمة والعنوان بس (مش الرسايل)
  if(X.app)initPres(X.app,X.me,()=>{paintList();paintHead()});
  // "آخر ظهور منذ X د" بيتغيّر مع الوقت
  PRT=setInterval(()=>{if(CUR)paintHead()},60000);
  UND=onSnapshot(collection(X.db,"whdir"),sn=>{DIR={};sn.docs.forEach(d=>{DIR[d.id]=d.data()});again()},()=>{});
  UNA=onSnapshot(collection(X.db,"ava"),sn=>{AVA={};sn.docs.forEach(d=>{const p=d.data().ph;if(typeof p==="string"&&/^data:image\/jpeg;base64,/.test(p))AVA[d.id]=p});again()},()=>{});
  UNDD=onSnapshot(collection(X.db,"ddir"),sn=>{DDIR={};sn.docs.forEach(d=>{DDIR[d.id]=d.data()});again()},()=>{});
  // محادثاتي: القديمة (فرع مع المستودع) + الجديدة (ps فيها أنا)
  if(T()==="b")UNS=onSnapshot(query(collection(X.db,"dm"),where("br","==",pv(X.me))),sn=>{SO={};sn.docs.forEach(d=>SO[d.id]=d.data());gotO=true;fire()},()=>{gotO=true;fire()});
  else if(T()==="w"&&X.canBr)UNS=onSnapshot(query(collection(X.db,"dm"),where("wh","==",pv(X.me))),sn=>{SO={};sn.docs.forEach(d=>SO[d.id]=d.data());gotO=true;fire()},()=>{gotO=true;fire()});
  UNS2=onSnapshot(query(collection(X.db,"dm"),where("ps","array-contains",X.me)),sn=>{SN={};sn.docs.forEach(d=>SN[d.id]=d.data());gotN=true;fire()},()=>{gotN=true;fire()});
  UNG=onSnapshot(query(collection(X.db,"grp"),where("ms","array-contains",X.me)),sn=>{SG={};sn.docs.forEach(d=>SG[d.id]=d.data());gotG=true;fire()},()=>{gotG=true;fire()});
  if(modal()){
    if(!g("bcfab")){const f=document.createElement("button");f.id="bcfab";f.type="button";f.setAttribute("aria-label","المحادثات");f.onclick=()=>openBr();document.body.appendChild(f)}
    const at=g("mx")||g("out");if(at&&!g("bcme")){const b=document.createElement("button");b.id="bcme";b.type="button";b.onclick=()=>openBr();at.parentNode.insertBefore(b,at)}
    paintFab();
  }
}
export function stopBChat(){
  if(!X)return;stopRec(true);stopPlay();stopPres();clearInterval(PRT);[UNM,UNS,UNS2,UND,UNA,UNDD,UNG].forEach(f=>f&&f());UNM=UNS=UNS2=UND=UNA=UNDD=UNG=null;
  CUR=null;GEN++;MSGS=[];SUMS={};SO={};SN={};SG={};DIR={};DDIR={};AVA={};DRAFT={};CTX={};PEND=null;AUD.clear();
  const m=g("bcm");if(m)m.remove();["bcfab","bcme"].forEach(id=>{const e=g(id);if(e)e.remove()});
  if(ROOT){ROOT.remove();ROOT=null}
  X=null;
}

// ---------- مسح الدردشة القديم المشترك (مرة واحدة، من جهاز المالك) ----------
// الدردشة قبل كده كان مشترك (chats/{code} و msgs جوه كل طلب)، فبنمسحه كله علشان محدش يشوف رسايل حد مجدداً.
export async function wipeOldChat(db){
  try{
    if((await getDoc(doc(db,"meta","chatv2"))).exists())return;
    let n=0;const del=async refs=>{for(let i=0;i<refs.length;i+=400){const b=writeBatch(db);refs.slice(i,i+400).forEach(r=>b.delete(r));await b.commit()}n+=refs.length};
    const cs=await getDocs(collection(db,"chats"));
    for(const c of cs.docs)for(const sub of ["msgs","aud"])await del((await getDocs(collection(db,"chats",c.id,sub))).docs.map(d=>doc(db,"chats",c.id,sub,d.id)));
    await del(cs.docs.map(d=>doc(db,"chats",d.id)));
    const rq=(await getDocs(query(collection(db,"requests"),where("msgs","!=",null)))).docs;
    for(let i=0;i<rq.length;i+=400){const b=writeBatch(db);rq.slice(i,i+400).forEach(d=>b.update(doc(db,"requests",d.id),{msgs:deleteField()}));await b.commit()}
    await setDoc(doc(db,"meta","chatv2"),{at:Date.now(),n:n+rq.length});
  }catch(e){console.warn("wipe old chat",e&&(e.code||e.message))}
}
