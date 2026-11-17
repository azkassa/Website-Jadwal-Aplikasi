const THEME_KEY = "jadwal.theme", USERS_KEY = "jadwal.users", SESSION_KEY = "jadwal.session";
const QUESTIONS = ["Nama hewan peliharaan pertamamu?", "Nama sekolah dasarmu?", "Kota tempat kamu lahir?", "Makanan favorit masa kecilmu?"];
const dataKey = () => `jadwal.data.${current}`;
const K = id => "u:" + id;
const EASE = "cubic-bezier(.22,1,.36,1)";
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const CATS = { Kuliah: "#4F7CFF", Kerja: "#12A07A", Pribadi: "#E58A2B", Proyek: "#B849C9" };
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// Tanggal tanpa jam dibaca sebagai UTC, jadi jam selalu ditambahkan.
const dueOf = t => new Date(`${t.date}T${t.time || "23:59"}`);
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtDay = d => d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });

function seed() {
  const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return ymd(x); };
  const mk = (title, cat, n, time, pri, done = false) => ({ id: uid(), title, cat, date: d(n), time, pri, note: "", done });
  return [
    mk("Revisi bab 2 skripsi", "Kuliah", -1, "17:00", "tinggi"),
    mk("Kumpulkan laporan praktikum", "Kuliah", 0, "23:00", "tinggi"),
    mk("Rapat mingguan tim", "Kerja", 1, "09:30", "sedang"),
    mk("Bayar tagihan internet", "Pribadi", 2, "", "rendah"),
    mk("Presentasi demo proyek", "Proyek", 4, "14:00", "tinggi"),
    mk("Kirim draf proposal", "Kerja", -2, "16:00", "sedang", true),
  ];
}

function load() {
  try { const raw = localStorage.getItem(dataKey()); if (raw) return JSON.parse(raw); } catch (e) {}
  return [];
}
function save() {
  try { localStorage.setItem(dataKey(), JSON.stringify(tasks)); } catch (e) {}
  snapshotRecap();
}

let tasks = [], current = null, shownPct = 0, firstPaint = true;
const view = { cat: "Semua", q: "", day: null };
let editId = null, lastDeleted = null, toastTimer = 0;

function rel(t) {
  const ms = dueOf(t) - Date.now(), a = Math.abs(ms);
  const m = Math.round(a / 6e4), h = Math.round(a / 36e5), d = Math.round(a / 864e5);
  const u = m < 60 ? `${m} menit` : h < 24 ? `${h} jam` : `${d} hari`;
  return ms < 0 ? `Terlambat ${u}` : `${u} lagi`;
}
const isLate = t => !t.done && dueOf(t) < Date.now();

function renderHead() {
  const now = new Date(), todayKey = ymd(now);
  $("#today").textContent = fmtDay(now);
  const open = tasks.filter(t => !t.done);
  const td = open.filter(t => t.date === todayKey).length, late = open.filter(isLate).length;
  $("#summary").textContent = !open.length ? "Tidak ada deadline yang terbuka."
    : `${td} tugas hari ini${late ? `, ${late} terlambat` : ""}.`;
}

function renderNext() {
  const open = tasks.filter(t => !t.done).sort((a, b) => dueOf(a) - dueOf(b));
  const t = open.find(x => dueOf(x) >= Date.now()) || open[0];
  const el = $("#next");
  if (!t) { el.innerHTML = `<p>Deadline berikutnya</p><div class="big">Semua beres</div><p>Tambahkan tugas baru kapan saja.</p>`; return; }
  const when = dueOf(t).toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", hour: t.time ? "2-digit" : undefined, minute: t.time ? "2-digit" : undefined });
  el.innerHTML = `<p>Deadline berikutnya</p><div><div class="big">${rel(t)}</div><h2>${esc(t.title)}</h2><p>${esc(t.cat)}, ${when}</p></div>`;
}

function renderProg() {
  const total = tasks.length, done = tasks.filter(t => t.done).length;
  const pct = total ? Math.round(done / total * 100) : 0, C = 2 * Math.PI * 52;
  const wk = new Date(); wk.setDate(wk.getDate() + 7);
  const open = tasks.filter(t => !t.done);
  $("#prog").innerHTML = `
    <div class="ring"><svg viewBox="0 0 128 128"><circle class="bg" cx="64" cy="64" r="52"/><circle class="fg" cx="64" cy="64" r="52" stroke-dasharray="${C}" style="stroke-dashoffset:${C * (1 - shownPct / 100)}"/></svg><b id="pct">${shownPct}%</b></div>
    <ul class="stats">
      <li><span>Selesai</span><b>${done} dari ${total}</b></li>
      <li><span>Terlambat</span><b>${open.filter(isLate).length}</b></li>
      <li><span>7 hari ke depan</span><b>${open.filter(t => dueOf(t) >= Date.now() && dueOf(t) <= wk).length}</b></li>
    </ul>`;
  const fg = $("#prog .fg");
  // Baca layout dulu agar transisi mulai dari nilai lama.
  void fg.getBoundingClientRect();
  fg.style.strokeDashoffset = C * (1 - pct / 100);
  count($("#pct"), shownPct, pct, v => v + "%");
  shownPct = pct;
}

function renderDays() {
  let h = "";
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const key = ymd(d), n = tasks.filter(t => !t.done && t.date === key).length;
    h += `<button class="day${i === 0 ? " today" : ""}" data-day="${key}" aria-pressed="${view.day === key}" aria-label="${fmtDay(d)}, ${n} tugas">
      <small>${i === 0 ? "Hari ini" : d.toLocaleDateString("id-ID", { weekday: "short" })}</small><strong>${d.getDate()}</strong>
      <span class="dots">${"<i></i>".repeat(Math.min(n, 3))}</span></button>`;
  }
  $("#days").innerHTML = h;
}

function renderChips() {
  $("#chips").innerHTML = ["Semua", ...Object.keys(CATS)].map(c =>
    `<button class="chip" data-cat="${c}" aria-pressed="${view.cat === c}">${c === "Semua" ? "" : `<i class="dot" style="--c:${CATS[c]}"></i>`}${c}</button>`).join("");
}

function row(t) {
  const late = isLate(t);
  return `<div class="row${t.done ? " done" : ""}" data-id="${t.id}">
    <button class="check" data-act="toggle" aria-label="${t.done ? "Tandai belum selesai" : "Tandai selesai"}"></button>
    <div>
      <div class="title">${esc(t.title)}</div>
      <div class="meta"><span><i class="dot" style="--c:${CATS[t.cat] || "#888"}"></i>${esc(t.cat)}</span>
      <span>${t.time || "Seharian"}</span>${t.pri === "tinggi" && !t.done ? `<span class="pri-tinggi">Prioritas tinggi</span>` : ""}
      ${t.note ? `<span>${esc(t.note)}</span>` : ""}</div>
    </div>
    ${t.done ? "" : `<span class="when${late ? " late" : ""}">${rel(t)}</span>`}
    <div class="row-actions"><button class="mini" data-act="edit">Ubah</button><button class="mini" data-act="del">Hapus</button></div>
  </div>`;
}

function renderList() {
  const before = snapshot();
  const q = view.q.trim().toLowerCase(), now = Date.now(), todayKey = ymd(new Date());
  let items = tasks.filter(t => (view.cat === "Semua" || t.cat === view.cat) && (!q || t.title.toLowerCase().includes(q)) && (!view.day || t.date === view.day));
  items.sort((a, b) => dueOf(a) - dueOf(b));
  const title = view.day ? `Tugas ${fmtDay(new Date(view.day + "T00:00"))}` : "Semua tugas", titleEl = $("#listTitle");
  if (titleEl.textContent !== title) {
    titleEl.textContent = title;
    if (!calm()) titleEl.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 350, easing: "cubic-bezier(.22,1,.36,1)" });
  }
  if (!items.length) {
    $("#list").innerHTML = `<div class="empty"><p>${tasks.length ? "Tidak ada tugas yang cocok dengan filter ini." : "Belum ada tugas. Tambahkan deadline pertamamu."}</p><button class="btn" data-act="new">Tambah tugas</button></div>`;
    return;
  }
  const groups = [
    ["Terlambat", "late", items.filter(isLate)],
    ["Hari ini", "", items.filter(t => !t.done && dueOf(t) >= now && t.date === todayKey)],
    ["Mendatang", "", items.filter(t => !t.done && dueOf(t) >= now && t.date > todayKey)],
    ["Selesai", "", items.filter(t => t.done)],
  ];
  $("#list").innerHTML = groups.filter(g => g[2].length).map(([name, cls, arr]) =>
    `<section class="group ${cls}"><h3>${name} (${arr.length})</h3>${arr.map(row).join("")}</section>`).join("");
  flip(before);
}

function count(el, from, to, fmt) {
  if (from === to || calm()) { el.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => {
    const p = Math.min((now - t0) / 900, 1), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(from + (to - from) * e));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function snapshot() {
  return new Map([...document.querySelectorAll("#list .row")].map(r => [r.dataset.id, r.getBoundingClientRect().top]));
}

// Baris dipindah dulu, lalu dianimasikan dari posisi lamanya.
function flip(before) {
  if (calm()) return;
  let i = 0;
  document.querySelectorAll("#list .row").forEach(r => {
    const old = before.get(r.dataset.id);
    if (firstPaint) r.animate([{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], { duration: 650, delay: 350 + i++ * 55, easing: EASE, fill: "backwards" });
    else if (old === undefined) r.animate([{ opacity: 0, transform: "translateY(14px) scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 450, easing: EASE });
    else {
      const dy = old - r.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) r.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 560, easing: EASE });
    }
  });
  firstPaint = false;
}

function burst(el) {
  if (calm()) return;
  const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < 10; i++) {
    const p = document.createElement("i"), a = i / 10 * Math.PI * 2 + Math.random() * .5, d = 26 + Math.random() * 22;
    p.style.cssText = `position:fixed;left:${cx - 3}px;top:${cy - 3}px;width:6px;height:6px;border-radius:50%;background:${i % 2 ? "var(--accent)" : "#FFB020"};pointer-events:none;z-index:9`;
    document.body.append(p);
    p.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(0)`, opacity: 0 }], { duration: 650, easing: EASE }).onfinish = () => p.remove();
  }
}

function sync() {
  document.querySelectorAll("#days .day").forEach(x => x.setAttribute("aria-pressed", x.dataset.day === view.day));
  document.querySelectorAll("#chips .chip").forEach(x => x.setAttribute("aria-pressed", x.dataset.cat === view.cat));
}

function closeDlg() {
  const d = $("#dlg");
  if (!d.open) return;
  if (calm()) { d.close(); return; }
  d.classList.add("closing");
  d.addEventListener("animationend", () => { d.classList.remove("closing"); d.close(); }, { once: true });
}

function render() { renderHead(); renderNext(); renderProg(); renderDays(); renderChips(); renderList(); }

function toast(msg, withUndo) {
  $("#toastMsg").textContent = msg;
  $("#undo").hidden = !withUndo;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("#toast").hidden = true; lastDeleted = null; }, 5000);
}

function openDlg(id) {
  editId = id || null;
  const t = tasks.find(x => x.id === id);
  $("#dlgTitle").textContent = t ? "Ubah tugas" : "Tugas baru";
  $("#fTitle").value = t ? t.title : "";
  $("#fDate").value = t ? t.date : (view.day || ymd(new Date()));
  $("#fTime").value = t ? t.time : "";
  $("#fCat").value = t ? t.cat : "Kuliah";
  $("#fPri").value = t ? t.pri : "sedang";
  $("#fNote").value = t ? t.note : "";
  $("#dlg").showModal();
  $("#fTitle").focus();
}

$("#fCat").innerHTML = Object.keys(CATS).map(c => `<option>${c}</option>`).join("");
$("#add").onclick = () => openDlg();
$("#cancel").onclick = closeDlg;
$("#form").onsubmit = e => {
  e.preventDefault();
  const data = { title: $("#fTitle").value.trim(), date: $("#fDate").value, time: $("#fTime").value, cat: $("#fCat").value, pri: $("#fPri").value, note: $("#fNote").value.trim() };
  if (!data.title || !data.date) return;
  if (editId) Object.assign(tasks.find(t => t.id === editId), data);
  else tasks.push({ id: uid(), done: false, ...data });
  save(); render(); closeDlg(); toast("Tersimpan");
};

$("#list").onclick = e => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  if (b.dataset.act === "new") return openDlg();
  const id = b.closest(".row").dataset.id, t = tasks.find(x => x.id === id);
  if (b.dataset.act === "toggle") {
    t.done = !t.done; save();
    if (t.done && !calm()) {
      b.closest(".row").classList.add("done");
      b.classList.add("pop");
      burst(b);
      setTimeout(render, 520);
    } else render();
    return;
  }
  if (b.dataset.act === "edit") return openDlg(id);
  if (b.dataset.act === "del") {
    lastDeleted = { t, i: tasks.indexOf(t) }; tasks = tasks.filter(x => x.id !== id); save(); toast("Tugas dihapus", true);
    const rowEl = b.closest(".row"), h = rowEl.offsetHeight;
    if (calm()) { render(); return; }
    rowEl.style.overflow = "hidden";
    rowEl.animate([{ height: h + "px", opacity: 1, transform: "none" }, { height: "0px", opacity: 0, transform: "translateX(48px)", paddingTop: "0px", paddingBottom: "0px", marginBottom: "0px" }], { duration: 380, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }).onfinish = render;
  }
};
$("#undo").onclick = () => {
  if (!lastDeleted) return;
  tasks.splice(lastDeleted.i, 0, lastDeleted.t);
  lastDeleted = null; $("#toast").hidden = true; save(); render();
};
$("#days").onclick = e => {
  const b = e.target.closest("[data-day]");
  if (!b) return;
  view.day = view.day === b.dataset.day ? null : b.dataset.day;
  sync(); renderList();
};
$("#chips").onclick = e => {
  const b = e.target.closest("[data-cat]");
  if (!b) return;
  view.cat = b.dataset.cat; sync(); renderList();
};
$("#q").oninput = e => { view.q = e.target.value; renderList(); };

$("#theme").onclick = () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.classList.add("theming");
  setTimeout(() => root.classList.remove("theming"), 450);
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem(THEME_KEY, root.dataset.theme); } catch (e) {}
};
try { const th = localStorage.getItem(THEME_KEY); if (th) document.documentElement.dataset.theme = th; } catch (e) {}

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const rnd = () => hex(crypto.getRandomValues(new Uint8Array(16)));
const field = id => $("#" + id).value;
let fails = 0, lockUntil = 0;

// Tanpa server, hash ini hanya memperlambat tebakan, bukan pengaman penuh.
async function hash(text, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(text), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 150000, hash: "SHA-256" }, key, 256));
}

function getUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; } catch (e) { return {}; } }
function putUsers(u) { try { localStorage.setItem(USERS_KEY, JSON.stringify(u)); return true; } catch (e) { return false; } }

function snapshotRecap() {
  if (!current) return;
  const users = getUsers(), u = users[K(current)];
  if (!u) return;
  const open = tasks.filter(t => !t.done).sort((a, b) => dueOf(a) - dueOf(b));
  const nx = open.find(t => dueOf(t) >= Date.now()) || open[0];
  u.recap = { at: Date.now(), done: tasks.length - open.length, open: open.length, late: open.filter(isLate).length, next: nx ? nx.title : "" };
  putUsers(users);
}

function showRecap(r, name) {
  const el = $("#recap");
  const msg = r
    ? `<b>Rekap terakhir</b> (${new Date(r.at).toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}): ${r.done} selesai, ${r.open} masih terbuka, ${r.late} terlambat${r.next ? `. Berikutnya: ${esc(r.next)}` : ""}.`
    : `Halo, <b>${esc(name)}</b>. Rekap aktivitasmu akan muncul di sini saat kamu kembali.`;
  el.innerHTML = `<span>${msg}</span><button class="mini" data-close>Tutup</button>`;
  el.hidden = false;
}

function enter(id) {
  const u = getUsers()[K(id)];
  current = id; tasks = load();
  $("#who").textContent = u.name;
  $("#auth").hidden = true; $("#app").hidden = false;
  showRecap(u.recap, u.name);
  render();
}

function login(id, remember) {
  try {
    localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, id);
  } catch (e) {}
  enter(id);
}

function showAuth(mode) {
  $("#auth").hidden = false;
  const forms = { in: "#fIn", up: "#fUp", forgot: "#fFg" };
  for (const [m, sel] of Object.entries(forms)) {
    const f = $(sel), on = m === mode;
    if (on && f.hidden && !calm()) f.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 350, easing: EASE });
    f.hidden = !on;
    f.querySelector(".err").textContent = "";
  }
  $("#fFg").reset();
  $("#fgUser").readOnly = false; $("#fgStep2").hidden = true; $("#fgGo").textContent = "Lanjut";
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.go === mode));
  $("#authTitle").textContent = { in: "Selamat datang kembali", up: "Buat akun baru", forgot: "Ganti password" }[mode];
}

function fail(form, msg) {
  form.querySelector(".err").textContent = msg;
  if (msg && !calm()) $(".card").animate([{ transform: "translateX(0)" }, { transform: "translateX(-8px)" }, { transform: "translateX(8px)" }, { transform: "translateX(0)" }], { duration: 300 });
}
function locked(form) {
  if (Date.now() >= lockUntil) return false;
  fail(form, `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil((lockUntil - Date.now()) / 1000)} detik.`);
  return true;
}
function miss() { if (++fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; } }

$("#upQ").innerHTML = QUESTIONS.map((q, i) => `<option value="${i}">${q}</option>`).join("");
$("#auth").onclick = e => { const b = e.target.closest("[data-go]"); if (b) showAuth(b.dataset.go); };
$("#recap").onclick = e => { if (e.target.closest("[data-close]")) $("#recap").hidden = true; };

$("#fIn").onsubmit = async e => {
  e.preventDefault();
  const f = e.target; fail(f, "");
  if (locked(f)) return;
  const id = field("inUser").trim().toLowerCase(), u = getUsers()[K(id)];
  if (!u || await hash(field("inPass"), u.salt) !== u.hash) { miss(); return fail(f, "Username atau password salah."); }
  login(id, $("#inRemember").checked);
};

$("#fUp").onsubmit = async e => {
  e.preventDefault();
  const f = e.target; fail(f, "");
  const name = field("upName").trim(), id = field("upUser").trim().toLowerCase(), pw = field("upPass"), ans = field("upAns").trim().toLowerCase();
  if (!name || !ans) return fail(f, "Nama dan jawaban tidak boleh kosong.");
  if (!/^[a-z0-9_]{3,20}$/.test(id)) return fail(f, "Username 3 sampai 20 karakter: huruf, angka, atau garis bawah.");
  if (pw.length < 8) return fail(f, "Password minimal 8 karakter.");
  const users = getUsers();
  if (users[K(id)]) return fail(f, "Username sudah dipakai.");
  const salt = rnd(), aSalt = rnd();
  users[K(id)] = { name, salt, hash: await hash(pw, salt), q: +field("upQ"), aSalt, aHash: await hash(ans, aSalt), recap: null };
  if (!putUsers(users)) return fail(f, "Penyimpanan browser tidak tersedia, akun tidak bisa dibuat.");
  try { localStorage.setItem(`jadwal.data.${id}`, JSON.stringify(seed())); } catch (err) {}
  login(id, true);
};

$("#fFg").onsubmit = async e => {
  e.preventDefault();
  const f = e.target; fail(f, "");
  if (locked(f)) return;
  const id = field("fgUser").trim().toLowerCase(), u = getUsers()[K(id)];
  if (!u) return fail(f, "Username tidak ditemukan.");
  if ($("#fgStep2").hidden) {
    $("#fgQ").textContent = QUESTIONS[u.q];
    $("#fgUser").readOnly = true; $("#fgStep2").hidden = false; $("#fgGo").textContent = "Ganti password";
    $("#fgAns").focus();
    return;
  }
  const pw = field("fgPass");
  if (pw.length < 8) return fail(f, "Password baru minimal 8 karakter.");
  if (pw !== field("fgPass2")) return fail(f, "Konfirmasi password tidak sama.");
  if (await hash(field("fgAns").trim().toLowerCase(), u.aSalt) !== u.aHash) { miss(); return fail(f, "Jawaban keamanan salah."); }
  const users = getUsers(), nu = users[K(id)];
  nu.salt = rnd(); nu.hash = await hash(pw, nu.salt);
  putUsers(users);
  showAuth("in");
  $("#inUser").value = id; $("#inPass").focus();
  toast("Password diganti, silakan masuk");
};

$("#logout").onclick = () => {
  snapshotRecap();
  current = null; tasks = [];
  try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  Object.assign(view, { cat: "Semua", q: "", day: null });
  $("#q").value = ""; $("#list").innerHTML = ""; firstPaint = true;
  document.querySelectorAll(".authform").forEach(f => f.reset());
  $("#app").hidden = true; $("#recap").hidden = true;
  showAuth("in");
};

addEventListener("pagehide", snapshotRecap);
setInterval(() => { if (current) render(); }, 60000);

function restoreSession() {
  let id = null;
  try { id = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY); } catch (e) {}
  if (id && getUsers()[K(id)]) enter(id);
  else showAuth("in");
}

restoreSession();
