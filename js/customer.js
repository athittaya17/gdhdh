/* =====================================================
   FoodLoop - ฝั่งลูกค้า
   หน้าต่าง ๆ: home, search, shop, cart, orders, notifs, profile
   แต่ละหน้าคือฟังก์ชันที่คืนค่า HTML (แก้หน้าตาได้ในฟังก์ชันนั้น ๆ)
   ===================================================== */
let me = Auth.guard('customer');
const app = $('#app');
const st = { q: '', cat: '', promo: false };   // สถานะการค้นหา
let cur = { name: 'home', p: null };

/* ---------- ข้อมูลที่ใช้บ่อย ---------- */
const liveShops = () => db.shops.filter(s => s.status === 'approved' && s.open !== false);
const liveProducts = () => db.products.filter(p => liveShops().some(s => s.id === p.shopId));
const disc = p => Math.round((1 - p.price / p.orig) * 100);
const sold = pid => db.orders.filter(o => o.status !== 'cancelled').reduce((a, o) => a + o.items.filter(i => i.pid === pid).reduce((x, i) => x + i.qty, 0), 0);
const isFav = id => (me.favs || []).includes(id);
const myCart = () => db.carts[me.id] || (db.carts[me.id] = []);

/* ---------- ชิ้นส่วนการ์ด ---------- */
const shopCard = s => `
  <div class="card" data-act="shop" data-id="${s.id}">
    <div class="thumb">${s.tag ? `<span class="badge">${esc(s.tag)}</span>` : ''}${shopPic(s)}</div>
    <div class="card-body">
      <h4>${esc(s.name)}</h4>
      <div class="meta"><span>${s.reviews ? `<span class="star">★</span> ${s.rating} (${s.reviews})` : 'ร้านใหม่'}</span><span>${s.dist} กม.</span></div>
    </div>
  </div>`;

const prodCard = p => {
  const s = shopById(p.shopId);
  return `
  <div class="card ${p.qty < 1 ? 'soldout' : ''}">
    <div class="thumb" data-act="prod" data-id="${p.id}"><span class="badge">-${disc(p)}%</span>${pic(p)}</div>
    <div class="card-body">
      <h4 data-act="prod" data-id="${p.id}">${esc(p.name)}</h4>
      <div class="meta"><span>${esc(s.name)}</span><span>${p.qty < 1 ? 'หมดแล้ว' : 'เหลือ ' + p.qty}</span></div>
      <div class="price-row">
        <span class="price">${baht(p.price)}<s class="old">${baht(p.orig)}</s></span>
        <button class="cart-btn" data-act="add" data-id="${p.id}" ${p.qty < 1 ? 'disabled' : ''} title="ใส่ตะกร้า">+</button>
      </div>
    </div>
  </div>`;
};

/* =====================================================
   หน้าต่าง ๆ
   ===================================================== */
const views = {

  /* ---- หน้าหลัก: แบนเนอร์ / หมวดหมู่ / ร้านยอดนิยม / สินค้ายอดนิยม ---- */
  home() {
    const maxD = Math.max(0, ...liveProducts().map(disc));
    const shops = [...liveShops()].sort((a, b) => b.rating - a.rating).slice(0, 3);
    const prods = liveProducts().filter(p => p.qty > 0).sort((a, b) => sold(b.id) - sold(a.id)).slice(0, 4);
    // ร้านที่เพิ่งได้รับอนุมัติ / สินค้าที่เพิ่งเพิ่ม (ภายใน 7 วัน) จะขึ้นให้ลูกค้าเห็นทันที
    const fresh = t => t && Date.now() - t < 7 * DAY;
    const newShops = liveShops().filter(s => fresh(s.approvedAt) && !shops.includes(s));
    const newProds = liveProducts().filter(p => fresh(p.created) && p.qty > 0 && !prods.includes(p)).sort((a, b) => b.created - a.created);
    return `
    <section class="banner">
      <div>
        <h2>ขนมอบราคาพิเศษ<br>ลดสูงสุด ${maxD}%</h2>
        <a class="btn btn-light" href="#" data-act="promo">ดูโปรโมชั่น</a>
      </div>
      <div class="banner-img"><img src="images/banner-croissant.png" alt=""></div>
    </section>

    <section class="section">
      <div class="section-head"><h3>ร้านค้ายอดนิยม</h3><a href="#" data-act="cat" data-v="">ดูทั้งหมด ›</a></div>
      <div class="grid grid-shops">${shops.map(shopCard).join('')}</div>
    </section>

    ${newShops.length ? `<section class="section">
      <div class="section-head"><h3>ร้านค้าใหม่</h3></div>
      <div class="grid grid-shops">${newShops.map(shopCard).join('')}</div>
    </section>` : ''}

    <section class="section">
      <div class="section-head"><h3>สินค้ายอดนิยม</h3><a href="#" data-act="cat" data-v="">ดูทั้งหมด ›</a></div>
      <div class="grid grid-products">${prods.map(prodCard).join('') || '<p class="empty">ยังไม่มีสินค้า</p>'}</div>
    </section>

    ${newProds.length ? `<section class="section">
      <div class="section-head"><h3>เมนูมาใหม่</h3></div>
      <div class="grid grid-products">${newProds.map(prodCard).join('')}</div>
    </section>` : ''}`;
  },

  /* ---- ค้นหา / กรองตามหมวด / โปรโมชั่น ---- */
  search() {
    const q = st.q.trim().toLowerCase();
    const prods = liveProducts().filter(p =>
      (!st.cat || p.cat === st.cat) && (!st.promo || disc(p) >= 40) &&
      (!q || (p.name + shopById(p.shopId).name).toLowerCase().includes(q)));
    const shops = liveShops().filter(s => prods.some(p => p.shopId === s.id) ||
      (!st.cat && !st.promo && q && s.name.toLowerCase().includes(q)));
    return `
    <h3 class="page-title">ร้านค้า (${shops.length})</h3>
    <div class="grid grid-shops">${shops.map(shopCard).join('') || '<p class="empty">ไม่พบร้านค้า</p>'}</div>
    <h3 class="page-title">สินค้า (${prods.length})</h3>
    <div class="grid grid-products">${prods.map(prodCard).join('') || '<p class="empty">ไม่พบสินค้า</p>'}</div>`;
  },

  /* ---- หน้าร้านค้า ---- */
  shop(id) {
    const s = shopById(id);
    const prods = db.products.filter(p => p.shopId === id);
    return `
    <a class="back" href="#" data-act="go" data-v="home">‹ กลับ</a>
    <div class="shop-head">
      <div class="big">${shopPic(s)}</div>
      <div>
        <h2>${esc(s.name)}</h2>
        <p><span class="star" style="color:var(--accent)">★</span> ${s.rating} (${s.reviews} รีวิว) · ${s.dist} กม.</p>
        <p>รับสินค้า ${esc(s.pickup)} · ${esc(s.address)}</p>
      </div>
      <button class="fav-btn ${isFav(s.id) ? 'on' : ''}" data-act="fav" data-id="${s.id}">${isFav(s.id) ? 'เป็นร้านโปรดแล้ว' : 'เพิ่มเป็นร้านโปรด'}</button>
    </div>
    <h3 class="page-title">สินค้าของร้าน</h3>
    <div class="grid grid-products">${prods.map(prodCard).join('') || '<p class="empty">ร้านนี้ยังไม่มีสินค้า</p>'}</div>`;
  },

  /* ---- ร้านโปรด ---- */
  favs() {
    const list = liveShops().filter(s => isFav(s.id));
    return `<h3 class="page-title">ร้านโปรดของฉัน</h3><div class="grid grid-shops">${list.map(shopCard).join('') || '<p class="empty">ยังไม่มีร้านโปรด กดปุ่ม "เพิ่มเป็นร้านโปรด" ในหน้าร้านเพื่อเพิ่ม</p>'}</div>`;
  },

  /* ---- ตะกร้า + ชำระเงิน ---- */
  cart() {
    const rows = myCart().map(it => ({ it, p: db.products.find(x => x.id === it.pid) })).filter(r => r.p);
    if (!rows.length) return `<div class="empty">ตะกร้ายังว่างอยู่<br><br><a class="btn" href="#" data-act="go" data-v="home">ไปเลือกสินค้า</a></div>`;
    const total = rows.reduce((a, r) => a + r.p.price * r.it.qty, 0);
    return `
    <h3 class="page-title">ตะกร้าของฉัน</h3>
    <div class="two-col" style="grid-template-columns:2fr 1fr;align-items:start">
      <div>${rows.map(({ it, p }) => `
        <div class="list-item">
          <div class="em">${pic(p)}</div>
          <div class="grow"><h4>${esc(p.name)}</h4><small>${esc(shopById(p.shopId).name)} · ${baht(p.price)}</small></div>
          <div class="stepper">
            <button data-act="cq" data-id="${p.id}" data-d="-1">−</button><b>${it.qty}</b><button data-act="cq" data-id="${p.id}" data-d="1">+</button>
          </div>
          <b style="width:70px;text-align:right">${baht(p.price * it.qty)}</b>
          <button class="cart-btn" data-act="cq" data-id="${p.id}" data-d="-999" title="ลบ">✕</button>
        </div>`).join('')}
      </div>
      <div class="summary">
        <h3>ชำระเงิน / จอง</h3>
        <label class="pay-opt"><input type="radio" name="pay" value="ชำระที่ร้าน" checked> ชำระที่ร้านตอนรับสินค้า</label>
        <label class="pay-opt"><input type="radio" name="pay" value="พร้อมเพย์"> พร้อมเพย์ (จำลอง)</label>
        <label class="pay-opt"><input type="radio" name="pay" value="บัตรเครดิต"> บัตรเครดิต (จำลอง)</label>
        <div class="total"><span>ยอดรวม</span><span>${baht(total)}</span></div>
        <button class="btn" style="width:100%" data-act="checkout">ยืนยันการจอง</button>
      </div>
    </div>`;
  },

  /* ---- ประวัติการจอง ---- */
  orders() {
    const list = db.orders.filter(o => o.userId === me.id);
    return `<h3 class="page-title">ประวัติการจอง</h3>` + (list.map(o => {
      const s = shopById(o.shopId), stt = STATUS[o.status];
      return `
      <div class="list-item" style="align-items:flex-start">
        <div class="em">${pic(db.products.find(x => x.id === o.items[0].pid) || {})}</div>
        <div class="grow">
          <h4>${esc(s.name)} <span class="tag ${stt.cls}">${stt.text}</span></h4>
          <small>รหัส ${o.code} · ${fmtDate(o.created)} · ชำระ: ${esc(o.pay)}</small><br>
          <small>${o.items.map(i => esc(i.name) + ' x' + i.qty).join(', ')}</small><br>
          ${o.status === 'cancelled' && o.cancelReason ? `<small style="color:var(--danger)">สาเหตุที่ยกเลิก: ${esc(o.cancelReason)}</small>` : ''}
          ${o.status === 'reserved' ? `<small>รับสินค้า ${esc(s.pickup)}</small>` : ''}
        </div>
        <div style="text-align:right">
          <b style="color:var(--brown)">${baht(o.total)}</b><br><br>
          ${o.status === 'reserved' ? `<button class="mini-btn" data-act="qr" data-id="${o.id}">QR รับสินค้า</button> <button class="mini-btn alt" data-act="cancel" data-id="${o.id}">ยกเลิก</button>` : ''}
          ${o.status === 'picked' ? `<button class="mini-btn alt" data-act="report" data-id="${o.id}">แจ้งปัญหา</button>` : ''}
        </div>
      </div>`;
    }).join('') || '<p class="empty">ยังไม่มีประวัติการจอง</p>');
  },

  /* ---- แจ้งเตือน ---- */
  notifs() {
    const list = db.notifs.filter(n => n.to === me.id);
    return `<h3 class="page-title">การแจ้งเตือน</h3><div class="narrow" style="margin:0">` +
      (list.map(n => `<div class="notif ${n.read ? '' : 'unread'}">${esc(n.text)}<br><small>${fmtDate(n.time)}</small></div>`).join('') || '<p class="empty">ยังไม่มีการแจ้งเตือน</p>') + '</div>';
  },

  /* ---- โปรไฟล์ ---- */
  profile() {
    return `
    <h3 class="page-title">โปรไฟล์ของฉัน</h3>
    <div class="summary narrow" style="margin:0">
      <form data-form="profile" class="stack">
        <p><label>ชื่อ-นามสกุล<input name="name" value="${esc(me.name)}" required></label></p><br>
        <p><label>เบอร์โทร<input name="phone" value="${esc(me.phone)}"></label></p><br>
        <p><label>อีเมล<input value="${esc(me.email)}" disabled></label></p><br>
        <button class="btn">บันทึก</button>
        <button type="button" class="btn btn-light" data-act="logout">ออกจากระบบ</button>
      </form>
    </div>`;
  }
};

/* ---------- การแสดงผล ---------- */
/* แถบหมวดหมู่ใต้ช่องค้นหา (แก้รายการหมวดที่ CATS ใน js/common.js) */
function renderCatBar() {
  const on = cur.name === 'search';
  const item = (act, v, label, active) => `<a href="#" class="${active ? 'active' : ''}" data-act="${act}" data-v="${v}">${label}</a>`;
  $('#catbar').innerHTML =
    item('promo', '', 'โปรโมชั่น', on && st.promo) +
    Object.entries(CATS).map(([k, v]) => item('cat', k, v, on && !st.promo && st.cat === k)).join('');
}
function closeDD() { document.querySelectorAll('.dd').forEach(x => x.hidden = true); }
function go(name, p = null) {
  closeDD();
  cur = { name, p };
  render();
  scrollTo(0, 0);
}
function render() {
  app.innerHTML = views[cur.name](cur.p);
  renderCatBar();
  if (cur.name === 'notifs') {   // เปิดดูแล้ว = อ่านแล้ว
    db.notifs.forEach(n => { if (n.to === me.id) n.read = true; });
    save();
  }
  updateBadges();
}
function updateBadges() {
  const c = myCart().reduce((a, i) => a + i.qty, 0), n = db.notifs.filter(x => x.to === me.id && !x.read).length;
  $('#cartDot').hidden = !c; $('#cartDot').textContent = c;
  $('#notifDot').hidden = !n;
  $('#burgerDot').hidden = !(c || n);   // จุดแดงบนปุ่มขีดสามขีด เมื่อมีของในตะกร้า/แจ้งเตือนใหม่
  $('#avatar').textContent = (me.name || 'S').trim().charAt(0).toUpperCase();
}
window.onDbChange = () => {
  me = userById(me.id) || me;
  if (busy()) return updateBadges();
  render();
};

/* ---------- ฟังก์ชันการทำงาน ---------- */
function addToCart(pid, n) {
  const p = db.products.find(x => x.id === pid), c = myCart(), it = c.find(x => x.pid === pid);
  if ((it ? it.qty : 0) + n > p.qty) return toast('สินค้าคงเหลือไม่พอ');
  if (it) it.qty += n; else c.push({ pid, qty: n });
  save(); updateBadges(); toast('เพิ่มลงตะกร้าแล้ว');
}

function showProduct(id) {
  const p = db.products.find(x => x.id === id), s = shopById(p.shopId);
  modal(`
    <div class="center">
      <div class="modal-pic">${pic(p)}</div>
      <h3>${esc(p.name)}</h3>
      <p style="color:var(--muted)">${esc(s.name)} · ${CATS[p.cat]}</p>
      <p class="price" style="font-size:26px">${baht(p.price)}<s class="old">${baht(p.orig)}</s> <span class="tag wait">-${disc(p)}%</span></p>
      <p style="color:var(--muted)">เหลือ ${p.qty} ชิ้น · รับสินค้า ${esc(s.pickup)}</p>
      <p style="margin:16px 0"><span class="stepper"><button data-act="mq" data-d="-1">−</button><b id="mq">1</b><button data-act="mq" data-d="1" data-max="${p.qty}">+</button></span></p>
      <button class="btn" data-act="addm" data-id="${p.id}" ${p.qty < 1 ? 'disabled' : ''}>ใส่ตะกร้า</button>
      <button class="btn btn-light" data-close>ปิด</button>
    </div>`);
}

function showQR(id) {
  const o = db.orders.find(x => x.id === id), s = shopById(o.shopId);
  modal(`
    <div class="center">
      <h3>QR Code รับสินค้า</h3>
      <div class="qr-box" id="qr"></div>
      <div class="code-big">${o.code}</div>
      <p style="color:var(--muted)">แสดงรหัสนี้ที่ร้าน ${esc(s.name)}<br>ช่วงเวลารับสินค้า ${esc(s.pickup)}</p>
      <br><button class="btn" data-close>ปิด</button>
    </div>`);
  drawQR($('#qr'), o.code);
}

function checkout() {
  const c = myCart();
  if (!c.length) return;
  for (const it of c) {
    const p = db.products.find(x => x.id === it.pid);
    if (!p || p.qty < it.qty) return toast('สินค้า "' + (p ? p.name : '') + '" คงเหลือไม่พอ');
  }
  const pay = document.querySelector('input[name=pay]:checked').value, by = {};
  c.forEach(it => {
    const p = db.products.find(x => x.id === it.pid);
    (by[p.shopId] = by[p.shopId] || []).push({ pid: p.id, name: p.name, cat: p.cat, price: p.price, qty: it.qty });
    p.qty -= it.qty;
  });
  let first;
  Object.entries(by).forEach(([sid, items]) => {
    const o = { id: uid(), code: genCode(), userId: me.id, shopId: sid, items, total: items.reduce((a, i) => a + i.price * i.qty, 0), pay, status: 'reserved', created: Date.now() };
    db.orders.unshift(o);
    first = first || o;
    notify(sid, `ออเดอร์ใหม่ ${o.code} จาก ${me.name} (${baht(o.total)})`);
    notify(me.id, `จองสำเร็จ! รหัสรับสินค้า ${o.code} ที่ร้าน ${shopById(sid).name}`);
  });
  db.carts[me.id] = [];
  save();
  go('orders');
  showQR(first.id);
}

/* ---------- ผูกปุ่มต่าง ๆ ---------- */
bind({
  go: d => go(d.v),
  shops: () => { st.cat = ''; st.promo = false; st.q = ''; $('#q').value = ''; go('search'); },
  fav: d => {
    me.favs = me.favs || [];
    const i = me.favs.indexOf(d.id);
    if (i >= 0) me.favs.splice(i, 1); else me.favs.push(d.id);
    save(); render();
  },
  menu: d => {                                       // เมนูย่อยของกระดิ่ง / บัญชี
    const box = $('#dd' + d.v), was = !box.hidden;
    closeDD();
    if (was) return;
    if (d.v === 'Notif') {
      const list = db.notifs.filter(n => n.to === me.id).slice(0, 5);
      box.innerHTML = '<div class="dd-title">การแจ้งเตือน</div>' +
        (list.map(n => `<div class="dd-item ${n.read ? '' : 'unread'}">${esc(n.text)}<br><small>${fmtDate(n.time)}</small></div>`).join('') || '<div class="dd-item">ยังไม่มีการแจ้งเตือน</div>') +
        '<a href="#" data-act="go" data-v="notifs">ดูทั้งหมด</a>';
      db.notifs.forEach(n => { if (n.to === me.id) n.read = true; });
      save(); updateBadges();
    }
    box.hidden = false;
  },
  cat: d => { st.cat = d.v; st.promo = false; go('search'); },
  promo: () => { st.promo = true; st.cat = ''; st.q = ''; $('#q').value = ''; go('search'); },
  shop: d => go('shop', d.id),
  prod: d => showProduct(d.id),
  add: d => addToCart(d.id, 1),
  mq: (d, el) => {                                   // ปุ่ม +/- ในหน้าต่างสินค้า
    const b = $('#mq'), max = Number(el.dataset.max || $('[data-act=mq][data-max]').dataset.max);
    b.textContent = Math.min(max, Math.max(1, Number(b.textContent) + Number(d.d)));
  },
  addm: d => { addToCart(d.id, Number($('#mq').textContent)); closeModal(); },
  cq: d => {                                         // เปลี่ยนจำนวนในตะกร้า
    const c = myCart(), it = c.find(x => x.pid === d.id), p = db.products.find(x => x.id === d.id);
    it.qty += Number(d.d);
    if (it.qty > p.qty) { it.qty = p.qty; toast('สินค้าคงเหลือไม่พอ'); }
    if (it.qty <= 0) c.splice(c.indexOf(it), 1);
    save(); render();
  },
  checkout,
  qr: d => showQR(d.id),
  cancel: d => {
    if (!confirm('ยืนยันยกเลิกการจองนี้?')) return;
    const o = db.orders.find(x => x.id === d.id);
    o.status = 'cancelled';
    o.items.forEach(i => { const p = db.products.find(x => x.id === i.pid); if (p) p.qty += i.qty; });
    notify(o.shopId, `ลูกค้ายกเลิกออเดอร์ ${o.code}`);
    save(); render(); toast('ยกเลิกการจองแล้ว');
  },
  report: d => {
    const text = prompt('อธิบายปัญหาที่พบ (ส่งถึงผู้ดูแลระบบ)');
    if (!text) return;
    const o = db.orders.find(x => x.id === d.id);
    db.reports.unshift({ id: uid(), orderId: o.id, userId: me.id, shopId: o.shopId, text, status: 'open', time: Date.now() });
    notify('admin', `มีเรื่องร้องเรียนใหม่เกี่ยวกับออเดอร์ ${o.code}`);
    save(); toast('ส่งเรื่องให้ผู้ดูแลระบบแล้ว');
  },
  logout: () => confirmLogout('customer')
}, {
  profile: f => {
    me.name = f.name.value.trim(); me.phone = f.phone.value.trim();
    save(); toast('บันทึกแล้ว');
  }
});

/* ช่องค้นหาด้านบน */
$('#q').addEventListener('input', e => { st.q = e.target.value; st.promo = false; if (cur.name !== 'search') cur = { name: 'search' }; render(); });

/* คลิกที่อื่น = ปิดเมนูย่อย */
document.addEventListener('click', e => { if (!e.target.closest('.nav-dd')) closeDD(); });

go('home');









