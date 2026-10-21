/* =====================================================
   FoodLoop - ตัวช่วยกลาง (ใช้ร่วมทุกหน้า)
   - ฐานข้อมูลจำลองเก็บใน localStorage ของเบราว์เซอร์
   - ข้อมูลตั้งต้น (ร้าน/สินค้า/บัญชีตัวอย่าง) แก้ได้ที่ seedData() ด้านล่าง
   - ถ้าอยากล้างข้อมูลกลับเป็นค่าเริ่มต้น: เปิด Console แล้วพิมพ์ DB.reset()
   ===================================================== */
const DB_KEY = 'foodloop_db_v1';
const DAY = 86400000;

/* ---------- ตัวช่วยเล็ก ๆ ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baht = n => Number(n).toLocaleString('th-TH') + ' ฿';
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtDate = t => new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
/* รูปสินค้า: ถ้ามี p.img ใช้รูป ถ้าไม่มีจะเว้นว่าง */
const pic = p => p.img ? `<img src="${esc(p.img)}" alt="">` : '';
/* รูปร้าน: ถ้ามี s.img ใช้รูป ถ้าไม่มีใช้ตัวอักษรแรกของชื่อร้าน */
const shopPic = s => s.img ? `<img src="${esc(s.img)}" alt="">` : `<span class="initial">${esc(initial(s.name))}</span>`;
/* ช่องอัปโหลดรูป: ใช้ในฟอร์มสินค้า/ตั้งค่าร้าน รูปถูกย่อเหลือกว้าง 800px แล้วเก็บในเบราว์เซอร์ */
const imageField = (label, cur) => `
  <div class="full img-field">
    <span>${label}</span>
    <div class="img-preview" data-preview>${cur ? `<img src="${esc(cur)}" alt="">` : 'ยังไม่มีรูป'}</div>
    <input type="hidden" name="img" value="${esc(cur || '')}">
    <input type="file" accept="image/*" data-imgfile>
    <button type="button" class="link-btn" data-clearimg>ลบรูป</button>
  </div>`;
document.addEventListener('change', e => {
  const inp = e.target;
  if (!inp.hasAttribute || !inp.hasAttribute('data-imgfile') || !inp.files[0]) return;
  const box = inp.closest('.img-field'), reader = new FileReader();
  reader.onload = () => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 800 / im.width), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.8);
      box.querySelector('[name=img]').value = url;
      box.querySelector('[data-preview]').innerHTML = `<img src="${url}" alt="">`;
    };
    im.src = reader.result;
  };
  reader.readAsDataURL(inp.files[0]);
});
document.addEventListener('click', e => {
  if (!e.target.hasAttribute || !e.target.hasAttribute('data-clearimg')) return;
  const box = e.target.closest('.img-field');
  box.querySelector('[name=img]').value = '';
  box.querySelector('[data-preview]').textContent = 'ยังไม่มีรูป';
});

const initial = s => String(s || '?').trim().charAt(0).toUpperCase();
const itemCount = o => o.items.reduce((a, i) => a + i.qty, 0);

/* หมวดหมู่สินค้า: แก้ชื่อ/เพิ่มหมวดได้ที่นี่ */
const CATS = { bakery: 'เบเกอรี่', dessert: 'เค้ก', cookie: 'คุกกี้', bread: 'ขนมปัง', other: 'อื่นๆ' };

/* สถานะออเดอร์ */
const STATUS = {
  reserved:  { text: 'รอรับสินค้า', cls: 'wait' },
  picked:    { text: 'รับสินค้าแล้ว', cls: 'ok' },
  cancelled: { text: 'ยกเลิก', cls: 'bad' }
};

/* ---------- ข้อมูลตั้งต้น ---------- */
function seedData() {
  const now = Date.now();
  const shops = [
    { id: 's1', name: 'The Hill Bakery',   img: 'images/shop-hill.jpg', rating: 4.8, reviews: 120, dist: 1.2, status: 'approved', tag: 'ยอดนิยม', pickup: '17:00 - 19:00', address: '123 ถ.สุขุมวิท กรุงเทพฯ', open: true },
    { id: 's2', name: 'Sweet Home Bakery', img: 'images/shop-sweet.jpg', rating: 4.7, reviews: 98,  dist: 2.5, status: 'approved', tag: 'แนะนำ',   pickup: '18:00 - 20:00', address: '45 ถ.ลาดพร้าว กรุงเทพฯ', open: true },
    { id: 's3', name: 'Baan Khanom Pang',  img: 'images/shop-baan.jpg', rating: 4.6, reviews: 75,  dist: 3.1, status: 'approved', tag: '',        pickup: '16:30 - 18:30', address: '9 ถ.พหลโยธิน กรุงเทพฯ', open: true },
    { id: 's4', name: 'Cafe Mellow',       rating: 0,   reviews: 0,   dist: 4.0, status: 'pending',  tag: '',        pickup: '17:00 - 19:00', address: '77 ถ.รัชดา กรุงเทพฯ',   open: true }
  ];
  const users = [
    { id: 'u1', role: 'customer', name: 'สมใจ ดีมาก',  email: 'customer@demo.com', pass: '1234', phone: '081-234-5678' },
    { id: 'u4', role: 'customer', name: 'มานี รักกิน', email: 'mani@demo.com',     pass: '1234', phone: '089-111-2222' },
    { id: 'u2', role: 'shop', name: 'คุณสมชาย', email: 'shop@demo.com',  pass: '1234', shopId: 's1' },
    { id: 'u5', role: 'shop', name: 'คุณสุดา',  email: 'sweet@demo.com', pass: '1234', shopId: 's2' },
    { id: 'u6', role: 'shop', name: 'คุณวิชัย', email: 'baan@demo.com',  pass: '1234', shopId: 's3' },
    { id: 'u7', role: 'shop', name: 'คุณมินตรา', email: 'mellow@demo.com', pass: '1234', shopId: 's4' },
    { id: 'u9', role: 'admin', name: 'ผู้ดูแลระบบ', email: 'admin@demo.com', pass: 'admin' }
  ];
  const products = [
    { id: 'p1', shopId: 's1', name: 'ครัวซองต์เนยสด',   img: 'images/croissant.jpg', cat: 'bakery',  price: 45,  orig: 90,  qty: 18 },
    { id: 'p2', shopId: 's1', name: 'เค้กช็อกโกแลต',    img: 'images/chocolate-cake.jpg', cat: 'dessert', price: 120, orig: 240, qty: 6 },
    { id: 'p7', shopId: 's1', name: 'คุกกี้ช็อกชิป',     img: 'images/cookie.jpg', cat: 'cookie',  price: 25,  orig: 45,  qty: 20 },
    { id: 'p3', shopId: 's2', name: 'คัพเค้กวานิลลา',   img: 'images/cupcake.jpg', cat: 'dessert', price: 55,  orig: 85,  qty: 12 },
    { id: 'p4', shopId: 's2', name: 'บราวนี่ช็อกโกแลต', img: 'images/brownie.jpg', cat: 'dessert', price: 40,  orig: 65,  qty: 15 },
    { id: 'p8', shopId: 's2', name: 'โดนัทน้ำตาล',      img: 'images/donut.jpg', cat: 'other',   price: 25,  orig: 40,  qty: 14 },
    { id: 'p5', shopId: 's3', name: 'ขนมปังไส้ครีม',    img: 'images/cream-bun.jpg', cat: 'bread',   price: 35,  orig: 55,  qty: 20 },
    { id: 'p6', shopId: 's3', name: 'ขนมปังโฮลวีท',     img: 'images/wholewheat.jpg', cat: 'bread',   price: 30,  orig: 50,  qty: 10 }
  ];
  // ออเดอร์ย้อนหลังตัวอย่าง เพื่อให้กราฟมีข้อมูล
  const orders = []; let n = 0;
  for (let d = 1; d <= 6; d++) for (let k = 0; k < (d % 3) + 2; k++) {
    const sid = ['s1', 's2', 's3'][(d + k) % 3];
    const ps = products.filter(p => p.shopId === sid);
    const p = ps[(d + k) % ps.length], q = (k % 3) + 1;
    orders.push({ id: 'o' + (++n), code: 'FL' + (1000 + n), userId: k % 2 ? 'u4' : 'u1', shopId: sid,
      items: [{ pid: p.id, name: p.name, cat: p.cat, price: p.price, qty: q }],
      total: p.price * q, pay: 'ชำระที่ร้าน', status: 'picked', created: now - d * DAY - k * 3600000, pickedAt: now - d * DAY });
  }
  const reports = [{ id: 'r1', orderId: orders[2].id, userId: 'u1', shopId: orders[2].shopId, text: 'ขนมที่ได้รับไม่ตรงกับที่จอง', status: 'open', time: now - 3600000 }];
  return { users, shops, products, orders, reports, notifs: [], carts: {} };
}

/* แปลงข้อมูลเก่าที่เคยมีหมวด "เครื่องดื่ม" ให้เป็น "คุกกี้" */
function migrate(d) {
  const fix = x => { if (x.cat === 'drink') { x.cat = 'cookie'; if (x.name === 'ชาเย็นไข่มุก') x.name = 'คุกกี้ช็อกชิป'; } };
  d.products.forEach(fix);
  const imgs = { p1: 'croissant', p2: 'chocolate-cake', p6: 'wholewheat', p3: 'cupcake', p4: 'brownie', p5: 'cream-bun', p7: 'cookie', p8: 'donut' };   // รูปสินค้าตัวอย่าง
  const shopImgs = { s1: 'shop-hill', s2: 'shop-sweet', s3: 'shop-baan' };   // รูปร้านตัวอย่าง
  d.shops.forEach(s => { if (shopImgs[s.id] && !s.img) s.img = 'images/' + shopImgs[s.id] + '.jpg'; });
  d.products.forEach(p => { if (imgs[p.id] && !p.img) p.img = 'images/' + imgs[p.id] + '.jpg'; });
  d.orders.forEach(o => o.items.forEach(fix));
}

const DB = {
  load() {
    try { const d = JSON.parse(localStorage.getItem(DB_KEY)); if (d) { d.carts = d.carts || {}; migrate(d); return d; } } catch (e) {}
    const d = seedData(); localStorage.setItem(DB_KEY, JSON.stringify(d)); return d;
  },
  save(d) {
    d.updatedAt = Date.now();   // เวลาแก้ไขข้อมูลล่าสุด (แสดงในหน้าตั้งค่าระบบ)
    try { localStorage.setItem(DB_KEY, JSON.stringify(d)); }
    catch (e) { alert('พื้นที่จัดเก็บในเบราว์เซอร์เต็ม (รูปใหญ่เกินไป) กรุณาลบรูปเก่าหรือใช้รูปที่เล็กลง'); }
  },
  reset() { localStorage.removeItem(DB_KEY); location.reload(); }
};
let db = DB.load();
const save = () => DB.save(db);

/* ถ้าเปิดหลายแท็บ (เช่น ลูกค้า + ร้านค้า) ข้อมูลจะอัปเดตตามกัน */
window.addEventListener('storage', e => {
  if (e.key !== DB_KEY) return;
  db = DB.load();
  if (window.onDbChange) window.onDbChange();
});
/* true ถ้ากำลังพิมพ์/เปิดหน้าต่างอยู่ (ไม่ควรรีเฟรชหน้าทับ) */
const busy = () => !!$('.modal-bg') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);

function notify(to, text) { db.notifs.unshift({ id: uid(), to, text, time: Date.now(), read: false }); }
function genCode() { let c; do { c = 'FL' + Math.floor(1000 + Math.random() * 9000); } while (db.orders.some(o => o.code === c)); return c; }
const shopById = id => db.shops.find(s => s.id === id);
const userById = id => db.users.find(u => u.id === id);

/* ---------- ระบบล็อกอิน (แยก session ตามบทบาท) ---------- */
const Auth = {
  key: role => 'foodloop_session_' + role,
  cur(role) { const id = localStorage.getItem(this.key(role)); return db.users.find(u => u.id === id && u.role === role) || null; },
  login(role, email, pass) {
    const u = db.users.find(x => x.role === role && x.email.toLowerCase() === email.trim().toLowerCase() && x.pass === pass);
    if (!u) return { err: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
    if (u.suspended) return { err: 'บัญชีนี้ถูกระงับการใช้งาน' };
    if (role === 'shop') {
      const s = shopById(u.shopId);
      if (s.status === 'pending')   return { err: 'ร้านของคุณรอผู้ดูแลระบบอนุมัติ' };
      if (s.status === 'rejected')  return { err: 'คำขอเปิดร้านถูกปฏิเสธ' };
      if (s.status === 'suspended') return { err: 'ร้านนี้ถูกระงับการใช้งาน' };
    }
    localStorage.setItem(this.key(role), u.id);
    u.loginLog = [Date.now(), ...(u.loginLog || [])].slice(0, 5);   // ประวัติเข้าสู่ระบบล่าสุด 5 ครั้ง
    DB.save(db);
    return { user: u };
  },
  logout(role) { localStorage.removeItem(this.key(role)); location.href = 'login-' + role + '.html'; },
  guard(role) { const u = this.cur(role); if (!u) { location.replace('login-' + role + '.html'); return null; } return u; }
};

/* ---------- UI: หน้าต่างป๊อปอัป / ข้อความแจ้ง ---------- */
function modal(html) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = '<div class="modal">' + html + '</div>';
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) closeModal(); });
  document.body.appendChild(bg);
  return bg.firstChild;
}
/* เมนูข้างแบบขีดสามขีด (จอเล็ก) */
document.addEventListener('click', e => {
  const d = $('.dash');
  if (!d) return;
  if (e.target.closest('#menuBtn')) d.classList.toggle('menu-open');
  else if (e.target.closest('.side-bg') || e.target.closest('.sidebar [data-act]')) d.classList.remove('menu-open');
});

/* แถบบนของลูกค้า (จอเล็ก): ปุ่มขีดสามขีดเปิด/ปิดเมนูไอคอน */
document.addEventListener('click', e => {
  const bar = $('.topbar');
  if (!bar) return;
  if (e.target.closest('#navBtn')) bar.classList.toggle('nav-open');
  else if (!e.target.closest('.nav-icons') || (e.target.closest('[data-act]') && !e.target.closest('[data-act=menu]'))) bar.classList.remove('nav-open');
});

/* ถามยืนยันก่อนออกจากระบบ (กันกดพลาด) */
function confirmLogout(role) {
  const m = modal(`
    <div class="center">
      <h3>ออกจากระบบ?</h3>
      <p style="margin:6px 0 16px">คุณต้องการออกจากระบบใช่หรือไม่</p>
      <button class="btn btn-light" data-close>ยกเลิก</button>
      <button class="btn" id="logoutOk">ออกจากระบบ</button>
    </div>`);
  m.querySelector('#logoutOk').onclick = () => Auth.logout(role);
}
function closeModal() { const m = $('.modal-bg'); if (m) m.remove(); }
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
function drawQR(el, text) {
  if (window.QRCode) new QRCode(el, { text, width: 180, height: 180, colorDark: '#5a3220', colorLight: '#ffffff' });
  else el.innerHTML = '<b style="font-size:28px">' + esc(text) + '</b>';
}

/* ผูกปุ่ม data-act="ชื่อ" กับฟังก์ชัน และฟอร์ม data-form="ชื่อ" */
function bind(actions, forms = {}) {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    e.preventDefault();
    const f = actions[el.dataset.act];
    if (f) f(el.dataset, el);
  });
  document.addEventListener('submit', e => {
    const n = e.target.dataset.form;
    if (!n) return;
    e.preventDefault();
    if (forms[n]) forms[n](e.target);
  });
}

/* ---------- กราฟแท่ง (ใช้ CSS ล้วน) ---------- */
function daily(list, valFn) {
  const today = startOfDay(Date.now()), nm = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  return Array.from({ length: 7 }, (_, k) => {
    const s = today - (6 - k) * DAY;
    return { label: nm[new Date(s).getDay()], value: valFn(list.filter(o => o.created >= s && o.created < s + DAY)) };
  });
}
function barChart(items) {
  const max = Math.max(1, ...items.map(i => i.value));
  return '<div class="chart">' + items.map(i =>
    `<div class="bar-col"><span class="bar-val">${i.value}</span><div class="bar" style="height:${i.value / max * 100}%"></div><span class="bar-lbl">${esc(i.label)}</span></div>`).join('') + '</div>';
}
function hBars(items) {
  const max = Math.max(1, ...items.map(i => i.value));
  return items.map(i => `<div class="hbar"><span class="hbar-lbl">${esc(i.label)}</span><div class="hbar-track"><div class="hbar-fill" style="width:${i.value / max * 100}%"></div></div><span class="hbar-val">${esc(i.text ?? i.value)}</span></div>`).join('');
}







