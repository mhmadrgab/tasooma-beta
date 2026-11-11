if(!/\/[^\/]*beta[^\/]*\//i.test(location.pathname)){document.documentElement.innerHTML='<body style="font:18px Tahoma;padding:40px;direction:rtl;line-height:1.9">⚠️ ملف fb.js بتاع النسخة التجريبية اترفع مكان ملف المنصة الأصلي.<br>ارفع ملف fb.js الأصلي من فولدر «ارفع-على-GitHub» على GitHub، وبعدين اعمل Ctrl+F5.</body>';throw new Error("beta fb.js outside /beta/")}
// fb.js — نسخة Supabase (النقل من Firebase، نوفمبر 2026). نفس اللي بيصدّره fb.js القديم بالظبط، فباقي الملفات ماتتغيّرش.
// يوم النقل: الملف ده بياخد اسم fb.js. لحد كده بيتجرب في نسخة تجريبية منفصلة.
// - البيانات والدخول: Supabase (sbcore.js + sb-config.js)
// - إشعارات الموبايل: لسه Firebase Cloud Messaging (مجاني ومالوش حد)، فمشروع Firebase بيفضل للإشعارات بس
import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
import {SB_URL, SB_KEY} from "./sb-config.js";
import * as S from "./sbcore.js";
const {collection, doc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit, increment, arrayUnion, deleteField,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword} = S;

// Firebase: للإشعارات بس (FCM)
const firebaseConfig = {
  apiKey: "AIzaSyDSMJmTT9Ed3hQYIe2zGhEUKKt0qTL3ZwM",
  authDomain: "tasooma-ad4fe.firebaseapp.com",
  projectId: "tasooma-ad4fe",
  storageBucket: "tasooma-ad4fe.firebasestorage.app",
  messagingSenderId: "463966731953",
  appId: "1:463966731953:web:6b43696b49837494d82c90"
};
export const DOMAIN = "tasooma.app";
export const ADMIN_EMAIL = "mohamedrgab20@gmail.com";
export const emailOf = c => `${c}@${DOMAIN}`;
// كل صفحة ليها دخول لوحدها (فرع / مستودع / سائق) بمفتاح تخزين مختلف، و"sec" (إنشاء الحسابات) مابيتفتكرش خالص
const APPS = {};
export function makeFb(name) {
  if (APPS[name]) return APPS[name];
  const c = createClient(SB_URL, SB_KEY, {auth: {storageKey: "tz-sb-" + name, persistSession: name !== "sec", autoRefreshToken: name !== "sec", detectSessionInUrl: false},
    realtime: {params: {eventsPerSecond: 10}}});
  const db = {c}, app = {name, sb: c, db};
  return APPS[name] = {app, db, auth: new S.Auth(c)};
}
export const withTimeout = (p, ms = 15000) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);

// ---------- إشعارات الجوال (FCM) ----------
let FBA = null;
async function fbApp() {
  if (FBA) return FBA;
  const m = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
  return FBA = m.getApps().find(a => a.name === "fcm") || m.initializeApp(firebaseConfig, "fcm");
}
export async function pushRegister(app, db, info) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return false;
    const m = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js");
    if (!(await m.isSupported())) return false;
    await navigator.serviceWorker.register("./sw.js");
    const reg = await withTimeout(navigator.serviceWorker.ready, 20000);
    const msg = m.getMessaging(await fbApp()), tok = await withTimeout(m.getToken(msg, {serviceWorkerRegistration: reg}), 20000);
    if (!tok) return false;
    if (!window.__fgm) { window.__fgm = 1; m.onMessage(msg, p => {
      const n = (p && p.notification) || {}, d = (p && p.data) || {};
      if (!(document.hidden || !document.hasFocus()) && d.tag !== "test") return;
      reg.showNotification(n.title || d.t || "تاسومة", {body: n.body || d.b || "", tag: d.tag || undefined, icon: "./icon-192.png", dir: document.documentElement.dir || "rtl", lang: document.documentElement.lang || "ar", data: {link: (p.fcmOptions && p.fcmOptions.link) || d.link || ""}}).catch(() => {});
    }) }
    await pushSave(db, info, tok);
    return true;
  } catch (e) { console.warn("push", e); return false }
}
export async function pushSave(db, info, tok) {
  const mob = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const rec = {role: info.role, key: String(info.key), email: String(info.email || "").toLowerCase(), tok, ts: Date.now()}, ref = doc(db, "push", info.role + "__" + tok);
  const en = window.TZL && TZL.lang === "en";
  await setDoc(ref, {...rec, dv: mob ? "m" : "pc", ...(en ? {lg: "en"} : {})});
}
// ---------- سيرفر الإشعارات (Cloudflare) ----------
export const PUSH_URL = "https://tasooma-push.tasooma.workers.dev";
export async function ping(auth, ids, chats, trips, gifts) {
  try {
    const u0 = a => [...new Set((a || []).filter(Boolean))]; ids = u0(ids); chats = u0(chats); trips = u0(trips); gifts = u0(gifts);
    chats.filter(c => /^g_/.test(c)).forEach(c => multiPush(auth, "/grp", {gid: c.slice(2)})); chats = chats.filter(c => !/^g_/.test(c));
    if (!PUSH_URL || !(ids.length || chats.length || trips.length || gifts.length)) return;
    const u = auth && auth.currentUser; if (!u) return;
    const t = await u.getIdToken();
    const jobs = [...trips.map(x => ({trips: [x]})), ...ids.map(x => ({ids: [x]})), ...chats.map(x => ({chats: [x]})), ...gifts.map(x => ({gifts: [x]}))].slice(0, 40);
    jobs.forEach(b => fetch(PUSH_URL + "/notify", {method: "POST", headers: {"Content-Type": "application/json", "Authorization": "Bearer " + t}, body: JSON.stringify({ids: [], chats: [], trips: [], gifts: [], ...b}), keepalive: true}).catch(() => {}));
  } catch (e) {}
}
export const annPush = (auth, id) => multiPush(auth, "/ann", {id});
async function multiPush(auth, path, body) {
  try { const u = auth && auth.currentUser; if (!u || !PUSH_URL) return; const t = await u.getIdToken();
    for (let part = 0; part < 12; part++) { const r = await fetch(PUSH_URL + path, {method: "POST", headers: {"Content-Type": "application/json", "Authorization": "Bearer " + t}, body: JSON.stringify({...body, part})});
      const j = await r.json().catch(() => ({})); if (!r.ok || !j.more) break } } catch (e) {}
}
export async function pushTest(auth, to) {
  const u = auth && auth.currentUser; if (!u) throw new Error("login");
  const r = await withTimeout(fetch(PUSH_URL + "/test", {method: "POST", headers: {"Content-Type": "application/json", "Authorization": "Bearer " + await u.getIdToken()}, body: JSON.stringify(to ? {to} : {})}), 20000);
  if (!r.ok) throw new Error("http " + r.status); return r.json();
}
// ---------- الحد اليومي: Supabase مالوش حد يومي، فالشريط البرتقالي مابيظهرش ----------
export async function quotaOut() { return false }
export async function checkQuota() { document.documentElement.classList.remove("ui-quota"); return false }
export async function failReason(x) {
  if (x && x.code === "permission-denied") return "denied";
  if (!navigator.onLine) return "offline";
  return "slow";
}
export const FAIL_MSG = {
  quota: "الخدمة متوقفة مؤقتاً. البيانات محفوظة على جهازك، حاول لاحقاً، وأبلغ المستودع.",
  offline: "لا يوجد اتصال بالإنترنت حالياً. البيانات محفوظة، حاول مجدداً فور عودة الإنترنت.",
  slow: "الاتصال بطيء ولم نتأكد من اكتمال الحفظ. اضغط مجدداً ولن يتكرر."
};
// ---------- سجل "مين عمل إيه" (نفس القديم بالظبط) ----------
let AUD = null;
export function setAudit(a) { AUD = a && a.db && a.e ? a : null }
const NOLOG = new Set(["dm", "whdir", "ddir", "push", "geo", "meta", "log", "ava", "pushlog", "chats", "pods", "giftimg", "seen"]);
function note(op, r, d) {
  if (!AUD || !r || !r.path) return null; const p = String(r.path).split("/"); if (p.length !== 2 || NOLOG.has(p[0])) return null;
  if (d && typeof d === "object" && Object.keys(d).join() === "msgs") return null;
  let t = ""; try { t = String(AUD.label && AUD.label(p[0], p[1], d) || "") } catch (e) {}
  const o = d && typeof d === "object" ? d : {};
  const s = typeof o.st === "string" ? o.st : typeof o.enabled === "boolean" ? (o.enabled ? "on" : "off") : typeof o.admin === "boolean" ? (o.admin ? "adm" : "acc") : "";
  return {e: AUD.e, n: String(AUD.n && AUD.n() || "").slice(0, 60), op, c: p[0].slice(0, 30), id: p[1].slice(0, 60), t: t.slice(0, 100), k: Object.keys(o).slice(0, 12).map(x => x.slice(0, 30)), s: s.slice(0, 20)};
}
const put = L => { if (AUD) L.filter(Boolean).forEach(o => S.addDoc(collection(AUD.db, "log"), {...o, ts: Date.now()}).catch(() => {})) };
const group = L => { const g = {}; L.filter(Boolean).forEach(o => { const k = o.c + "|" + o.op; (g[k] = g[k] || []).push(o) }); return Object.values(g).map(a => a.length === 1 ? a[0] : {...a[0], id: "", t: "", x: a.length}) };
const setDoc = (r, d, o) => { const L = [note("set", r, d)]; return S.setDoc(r, d, o).then(x => { put(L); return x }) };
const updateDoc = (r, d) => { const L = [note("upd", r, d)]; return S.updateDoc(r, d).then(x => { put(L); return x }) };
const deleteDoc = r => { const L = [note("del", r, null)]; return S.deleteDoc(r).then(x => { put(L); return x }) };
const addDoc = (c, d) => S.addDoc(c, d).then(ref => { put([note("set", ref, d)]); return ref });
function writeBatch(db) {
  const b = S.writeBatch(db), L = [], w = {
    set(r, d, o) { L.push(note("set", r, d)); b.set(r, d, o); return w },
    update(r, d) { L.push(note("upd", r, d)); b.update(r, d); return w },
    delete(r) { L.push(note("del", r, null)); b.delete(r); return w },
    commit() { return b.commit().then(x => { put(group(L)); return x }) }};
  return w;
}
export {collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where, writeBatch, arrayUnion, orderBy, limit, increment, deleteField, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword};
