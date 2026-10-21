/* =====================================================
   FoodLoop - ฝั่งร้านค้า (Merchant)
   หน้าต่าง ๆ: dashboard, products, orders, scan, settings
   ===================================================== */
let me = Auth.guard('shop');
const app = $('#app');
let cur = 'dashboard';
let orderFilter = '';

const shop = () => shopById(me.shopId);
const myOrders = () => db.orders.filter(o => o.shopId === me.shopId);
const custName = o => (userById(o.userId) || { name: '-' }).name;
const optCats = sel => Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');

const views = {

  /* ---- Dashboard: สถิติ + กราฟยอดขาย 7 วัน + ออเดอร์ล่าสุด ---- */
  dashboard() {
    const os = myOrders(), picked = os.filter(o => o.status === 'picked');
    const today = startOfDay(Date.now());
    const salesToday = picked.filter(o => o.created >= today).reduce((a, o) => a + o.total, 0);
    const ps = db.products.filter(p => p.shopId === me.shopId);
    const totalStock = ps.reduce((a, p) => a + p.qty, 0);
    const maxQty = Math.max(1, ...ps.map(p => p.qty));
    const notifs = db.notifs.filter(n => n.to === me.shopId).slice(0, 5);
    return `
    <h1>Dashboard ร้านค้า</h1>
    <div class="stats">
      <div class="stat"><small>ยอดขายวันนี้</small><b>${baht(salesToday)}</b></div>
      <div class="stat"><small>รอลูกค้ามารับ</small><b>${os.filter(o => o.status === 'reserved').length} คน</b></div>
      <div class="stat"><small>รับสินค้าแล้ว</small><b>${picked.length} ออเดอร์</b></div>
      <div class="stat"><small>สินค้าในสต็อกรวม</small><b>${totalStock} ชิ้น</b></div>    </div>
    <section class="panel"><h3>ยอดขาย 7 วันล่าสุด (บาท)</h3>${barChart(daily(picked, l => l.reduce((a, o) => a + o.total, 0)))}</section>
    <section class="panel">
      <div class="toolbar"><h3 style="margin:0">สินค้าในสต็อก</h3><button class="mini-btn" data-act="prodForm">+ เพิ่มสินค้า</button></div>
      ${ps.length ? `<table>
        <tr><th>สินค้า</th><th style="width:50%">คงเหลือ</th><th></th></tr>
        ${[...ps].sort((a, b) => a.qty - b.qty).map(p => `<tr>
          <td>${esc(p.name)}</td>
          <td><div class="hbar" style="margin:0"><div class="hbar-track"><div class="hbar-fill" style="width:${p.qty / maxQty * 100}%"></div></div><b style="width:60px">${p.qty} ชิ้น</b></div></td>
          <td><button class="mini-btn alt" data-act="prodForm" data-id="${p.id}">เติมสต็อก</button></td>
        </tr>`).join('')}
      </table>` : '<p class="empty">ยังไม่มีสินค้า กด "+ เพิ่มสินค้า" ได้เลย</p>'}
    </section>
    <div class="two-col">
      <section class="panel"><h3>คำสั่งจองล่าสุด</h3>${ordersTable(os.slice(0, 5), false)}</section>
      <section class="panel"><h3>การแจ้งเตือน</h3>${notifs.map(n => `<p style="margin-bottom:8px">${esc(n.text)}<br><small style="color:var(--muted)">${fmtDate(n.time)}</small></p>`).join('') || '<p class="empty">ยังไม่มีการแจ้งเตือน</p>'}</section>
    </div>`;
  },

  /* ---- จัดการสินค้า ---- */
  products() {
    const ps = db.products.filter(p => p.shopId === me.shopId);
    return `
    <h1>จัดการสินค้า</h1>
    <section class="panel">
      <div class="toolbar"><span>ทั้งหมด ${ps.length} รายการ</span><button class="mini-btn" data-act="prodForm">+ เพิ่มสินค้า</button></div>
      <table>
        <tr><th>สินค้า</th><th>หมวด</th><th>ราคาลด</th><th>ราคาเต็ม</th><th>คงเหลือ</th><th></th></tr>
        ${ps.map(p => `<tr>
          <td>${esc(p.name)}</td><td>${CATS[p.cat]}</td><td>${baht(p.price)}</td><td>${baht(p.orig)}</td>
          <td>${p.qty < 1 ? '<span class="tag bad">หมด</span>' : p.qty}</td>
          <td><button class="mini-btn edit" data-act="prodForm" data-id="${p.id}">แก้ไข</button> <button class="mini-btn danger" data-act="prodDel" data-id="${p.id}">ลบ</button></td>
        </tr>`).join('') || '<tr><td colspan="6" class="empty">ยังไม่มีสินค้า กด "+ เพิ่มสินค้า" ได้เลย</td></tr>'}
      </table>
    </section>`;
  },

  /* ---- คำสั่งจอง / ยืนยันรับสินค้า ---- */
  orders() {
    const list = myOrders().filter(o => !orderFilter || o.status === orderFilter);
    return `
    <h1>คำสั่งจอง</h1>
    <section class="panel">
      <div class="toolbar">
        <span>${list.length} รายการ</span>
        <select data-filter>
          <option value="">ทุกสถานะ</option>
          ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === orderFilter ? 'selected' : ''}>${v.text}</option>`).join('')}
        </select>
      </div>
      ${ordersTable(list, true)}
    </section>`;
  },

  /* ---- สแกน QR / ตรวจสอบสิทธิ์ (พิมพ์รหัสที่ลูกค้าแสดง) ---- */
  scan() {
    const list = myOrders();
    const note = { reserved: 'รอลูกค้ามารับ', picked: 'ส่งมอบแล้ว', cancelled: 'ยกเลิกแล้ว' };
    return `
    <h1>ยืนยันคำสั่งจอง</h1>
    <p class="page-sub">กรอกรหัส 6 ตัวจากลูกค้าเพื่อยืนยันการส่งมอบสินค้า</p>
    <section class="panel scan-card">
      <div class="scan-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg></div>
      <h3>ตรวจสอบรหัสรับสินค้า</h3>
      <p class="scan-sub">ยืนยันการรับสินค้าเมื่อส่งมอบให้ลูกค้าแล้วเท่านั้น</p>
      <form data-form="scan" class="scan-box"><input name="code" placeholder="เช่น FL1234" maxlength="6" autocomplete="off" required><button class="btn">ยืนยันรหัส</button></form>
      <p class="scan-hint">ให้ลูกค้าเปิดหน้าการจองของตัวเอง แล้วสอบรหัส 6 ตัวให้ร้านตรวจสอบ</p>
    </section>
    <section class="panel list-card">
      <div class="toolbar"><div><h3 style="margin:0">รายการจอง</h3><small class="page-sub">ตรวจสอบสถานะการรับสินค้าล่าสุด</small></div><small class="page-sub">${list.length} รายการ</small></div>
      ${list.length ? `<table>
        <tr><th>รหัส / สินค้า</th><th>ลูกค้า</th><th>ยอดรวม</th><th>สถานะจอง</th><th>สถานะการรับ</th></tr>
        ${list.map(o => `<tr>
          <td><b>${o.items.map(i => esc(i.name) + ' x' + i.qty).join(', ')}</b><br><small class="page-sub">${o.status === 'reserved' ? 'FL••••' : o.code} · ${fmtDate(o.created)}</small></td>
          <td>${esc(custName(o))}</td>
          <td><b>${baht(o.total)}</b></td>
          <td><span class="tag ${STATUS[o.status].cls}">${STATUS[o.status].text}</span></td>
          <td>${note[o.status]}</td>
        </tr>`).join('')}
      </table>` : '<p class="empty">ยังไม่มีรายการจอง</p>'}
    </section>`;
  },

  /* ---- ตั้งค่าร้าน ---- */
  settings() {
    const s = shop(), [ps, pe] = parsePickup(s.pickup), on = s.open !== false;
    const ot = s.openTime || (ps < '09:00' ? ps : '09:00'), ct = s.closeTime || (pe > '20:00' ? pe : '20:00');
    return `
    <h1>ตั้งค่าร้าน</h1>
    <p class="page-sub">จัดการข้อมูลร้าน เวลาทำการ และสถานะการรับออเดอร์</p>
    <div class="settings-layout">
    <section class="panel settings-form">
      <form data-form="settings" id="settingsForm" class="form-grid">
        <div class="full status-row ${on ? '' : 'off'}">
          <div><b id="openLbl">${openText(on)}</b><small>ปิดรับชั่วคราว = ลูกค้าจะไม่เห็นร้านในหน้ารายการร้านค้า</small></div>
          <label class="switch"><input type="checkbox" name="open" ${on ? 'checked' : ''}><span class="slider"></span></label>
        </div>

        <label class="full">ชื่อร้าน<input name="name" value="${esc(s.name)}" required></label>

        <p class="full grp-title">เวลาเปิด–ปิดร้าน</p>
        <label>เวลาเปิดร้าน<input type="time" name="openTime" value="${ot}" required></label>
        <label>เวลาปิดร้าน<input type="time" name="closeTime" value="${ct}" required></label>

        <p class="full grp-title">ช่วงเวลาที่ลูกค้ามารับสินค้า</p>
        <label>เริ่มรับสินค้า<input type="time" name="pickStart" value="${ps}" required></label>
        <label>สิ้นสุดรับสินค้า<input type="time" name="pickEnd" value="${pe}" required></label>

        <label class="full">ที่อยู่ร้าน<input name="address" value="${esc(s.address)}"></label>
        ${shopImageField(s.img)}
        <div class="form-actions save-bar">
          <span id="dirtyMsg" class="dirty-msg">ยังไม่มีการแก้ไข</span>
          <button class="btn" id="saveBtn" disabled>บันทึก</button>
        </div>
      </form>
    </section>
    <aside class="panel preview-card" id="shopPreview"></aside>
    </div>`;
  }
};

/* ---------- ตั้งค่าร้าน: ตัวช่วย ---------- */
/* แผงตัวอย่างหน้าร้านที่ลูกค้าเห็น อัปเดตทันทีตามที่กรอก */
function updatePreview() {
  const f = $('#settingsForm'), box = $('#shopPreview');
  if (!f || !box) return;
  const v = n => f[n].value, on = f.open.checked;
  box.innerHTML = `
    <h3>ตัวอย่างที่ลูกค้าเห็น</h3>
    <div class="pv-card">
      <div class="pv-img">${shopPic({ img: v('img'), name: v('name') })}</div>
      <div class="pv-body">
        <b>${esc(v('name').trim() || 'ชื่อร้าน')}</b>
        <span class="tag ${on ? 'ok' : 'bad'}">${openText(on)}</span>
        <p>เปิด ${v('openTime')} – ${v('closeTime')} น.</p>
        <p>รับสินค้า ${v('pickStart')} – ${v('pickEnd')} น.</p>
        <p>${esc(v('address'))}</p>
      </div>
    </div>
    <small>ตัวอย่างนี้ยังไม่ถูกบันทึก จนกว่าจะกดปุ่มบันทึก</small>`;
}

const openText = on => on ? 'เปิดรับออเดอร์' : 'หยุดรับออเดอร์ชั่วคราว';
const hhmm = t => t.replace(/^(\d):/, '0$1:');
const parsePickup = p => { const m = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(p || ''); return m ? [hhmm(m[1]), hhmm(m[2])] : ['17:00', '19:00']; };

/* รูปหน้าร้าน: เปลี่ยน/ลบ/ครอบตัด (ขนาดเดียวกันเสมอ 800x450 = 16:9) พร้อมตัวอย่างก่อนบันทึก */
const shopImageField = cur => `
  <div class="full img-field">
    <span>รูปหน้าร้าน (สัดส่วน 16:9)</span>
    <div class="img-preview crop-prev" id="shopPrev">${cur ? `<img src="${esc(cur)}" alt="">` : 'ยังไม่มีรูป'}</div>
    <input type="hidden" name="img" value="${esc(cur || '')}">
    <input type="file" accept="image/*" id="shopFile" hidden>
    <div class="img-btns">
      <button type="button" class="mini-btn" id="pickImg">เปลี่ยนรูป</button>
      <button type="button" class="mini-btn danger" id="delImg">ลบรูป</button>
    </div>
    <div class="crop-ctl" id="cropCtl" hidden>
      <label>ซูม<input type="range" id="cropZoom" min="1" max="3" step="0.01" value="1"></label>
      <label>เลื่อนซ้าย–ขวา<input type="range" id="cropX" min="0" max="100" value="50"></label>
      <label>เลื่อนขึ้น–ลง<input type="range" id="cropY" min="0" max="100" value="50"></label>
      <small>ปรับแถบเพื่อครอบตัด ดูตัวอย่างด้านบนก่อนกดบันทึก</small>
    </div>
  </div>`;

let dirty = false, cropImg = null;
function setDirty(v) {
  dirty = v;
  const m = $('#dirtyMsg'), b = $('#saveBtn');
  if (m) { m.textContent = v ? 'มีการแก้ไขที่ยังไม่ได้บันทึก' : 'ยังไม่มีการแก้ไข'; m.classList.toggle('on', v); }
  if (b) b.disabled = !v;
}
function drawCrop() {
  if (!cropImg) return;
  const W = 800, H = 450, z = +$('#cropZoom').value, x = +$('#cropX').value, y = +$('#cropY').value;
  const k = Math.max(W / cropImg.width, H / cropImg.height) * z, dw = cropImg.width * k, dh = cropImg.height * k;
  let cv = $('#cropCv');
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'cropCv'; cv.width = W; cv.height = H; $('#shopPrev').replaceChildren(cv); }
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.drawImage(cropImg, -(dw - W) * x / 100, -(dh - H) * y / 100, dw, dh);
  $('#settingsForm').img.value = cv.toDataURL('image/jpeg', 0.85);
  updatePreview();
}
function resetCrop() { cropImg = null; $('#cropCtl').hidden = true; ['#cropZoom', '#cropX', '#cropY'].forEach((s, i) => $(s).value = i ? 50 : 1); }

document.addEventListener('click', e => {
  if (e.target.id === 'pickImg') $('#shopFile').click();
  if (e.target.id === 'delImg') {
    resetCrop(); $('#settingsForm').img.value = ''; $('#shopPrev').textContent = 'ยังไม่มีรูป'; setDirty(true); updatePreview();
  }
});
document.addEventListener('change', e => {
  if (e.target.id !== 'shopFile' || !e.target.files[0]) return;
  const reader = new FileReader();
  reader.onload = () => {
    const im = new Image();
    im.onload = () => { cropImg = im; $('#cropCtl').hidden = false; drawCrop(); setDirty(true); };
    im.src = reader.result;
  };
  reader.readAsDataURL(e.target.files[0]);
  e.target.value = '';
});
document.addEventListener('input', e => {
  if (!e.target.closest('#settingsForm')) return;
  if (/^crop(Zoom|X|Y)$/.test(e.target.id)) drawCrop();
  if (e.target.name === 'open') {
    $('#openLbl').textContent = openText(e.target.checked);
    e.target.closest('.status-row').classList.toggle('off', !e.target.checked);
  }
  setDirty(true);
  updatePreview();
});
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ตารางออเดอร์ (ใช้ซ้ำหลายหน้า) */
function ordersTable(list, actions) {
  if (!list.length) return '<p class="empty">ไม่มีรายการ</p>';
  return `<table>
    <tr><th>รหัส</th><th>ลูกค้า</th><th>รายการ</th><th>ยอดรวม</th><th>สถานะ</th>${actions ? '<th></th>' : ''}</tr>
    ${list.map(o => `<tr>
      <td><b>${o.status === 'reserved' ? 'FL••••' : o.code}</b><br><small style="color:var(--muted)">${fmtDate(o.created)}</small></td>
      <td>${esc(custName(o))}</td>
      <td>${o.items.map(i => esc(i.name) + ' x' + i.qty).join('<br>')}</td>
      <td>${baht(o.total)}<br><small style="color:var(--muted)">${esc(o.pay)}</small></td>
      <td><span class="tag ${STATUS[o.status].cls}">${STATUS[o.status].text}</span></td>
      ${actions ? `<td>${o.status === 'reserved' ? `<button class="mini-btn alt" data-act="cancel" data-id="${o.id}">ยกเลิก</button>` : ''}</td>` : ''}
    </tr>`).join('')}
  </table>`;
}

/* ---------- การแสดงผล ---------- */
function go(v) {
  if (dirty && cur === 'settings' && v !== cur && !confirm('มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?')) return;
  cur = v; render(); scrollTo(0, 0);
}
function render() {
  dirty = false; cropImg = null;
  app.innerHTML = views[cur]();
  if (cur === 'settings') updatePreview();
  document.querySelectorAll('#nav [data-v]').forEach(a => a.classList.toggle('active', a.dataset.v === cur));
  $('#shopName').textContent = shop().name;
  const n = myOrders().filter(o => o.status === 'reserved').length;
  $('#orderCount').hidden = !n; $('#orderCount').textContent = n;
}
window.onDbChange = () => { me = userById(me.id) || me; if (!busy() && !dirty) render(); };

/* ---------- ฟังก์ชันการทำงาน ---------- */
function pickOrder(id) {
  const o = db.orders.find(x => x.id === id);
  o.status = 'picked'; o.pickedAt = Date.now();
  notify(o.userId, `รับสินค้าเรียบร้อย ออเดอร์ ${o.code} ขอบคุณที่ช่วยลดขยะอาหาร `);
  save(); closeModal(); render(); toast('ยืนยันรับสินค้าแล้ว ');
}
function prodForm(id) {
  const p = id ? db.products.find(x => x.id === id) : { name: '', cat: 'bakery', price: '', orig: '', qty: '' };
  modal(`
    <h3>${id ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h3>
    <form data-form="prod" class="form-grid">
      <input type="hidden" name="id" value="${id || ''}">
      <label class="full">ชื่อสินค้า<input name="name" value="${esc(p.name)}" required></label>

      <label>หมวดหมู่<select name="cat">${optCats(p.cat)}</select></label>
      <label>ราคาเต็ม (บาท)<input type="number" name="orig" min="1" value="${p.orig}" required></label>
      <label>ราคาลด (บาท)<input type="number" name="price" min="1" value="${p.price}" required></label>
      <label class="full">จำนวนคงเหลือ<input type="number" name="qty" min="0" value="${p.qty}" required></label>
      ${imageField('รูปสินค้า', p.img)}
      <div class="form-actions"><button type="button" class="btn btn-light" data-close>ยกเลิก</button><button class="btn">บันทึก</button></div>
    </form>`);
}

bind({
  go: d => go(d.v),
  logout: () => confirmLogout('shop'),
  pick: d => pickOrder(d.id),
  cancel: d => {
    const o = db.orders.find(x => x.id === d.id);
    modal(`
      <h3>ยกเลิกออเดอร์ของ ${esc(custName(o))}</h3>
      <form data-form="cancel" class="stack">
        <input type="hidden" name="id" value="${o.id}">
        <label>สาเหตุที่ยกเลิก (ลูกค้าจะได้รับแจ้งเตือนพร้อมข้อความนี้)
          <textarea name="reason" rows="4" placeholder="เช่น สินค้าหมดก่อน / ร้านปิดทำการวันนี้" required></textarea>
        </label>
        <div class="form-actions" style="margin-top:12px"><button type="button" class="btn btn-light" data-close>ไม่ยกเลิก</button><button class="btn">ยืนยันยกเลิก</button></div>
      </form>`);
  },
  prodForm: d => prodForm(d.id),
  prodDel: d => {
    if (!confirm('ลบสินค้านี้?')) return;
    db.products = db.products.filter(p => p.id !== d.id);
    save(); render();
  }
}, {
  prod: f => {
    const price = Number(f.price.value), orig = Number(f.orig.value);
    if (price > orig) return toast('ราคาลดต้องไม่เกินราคาเต็ม');
    const data = { name: f.name.value.trim(), cat: f.cat.value, price, orig, qty: Number(f.qty.value), img: f.img.value };
    if (f.id.value) Object.assign(db.products.find(p => p.id === f.id.value), data);
    else db.products.push({ id: uid(), shopId: me.shopId, created: Date.now(), ...data });
    save(); closeModal(); render(); toast('บันทึกสินค้าแล้ว');
  },
  cancel: f => {
    const o = db.orders.find(x => x.id === f.id.value), reason = f.reason.value.trim();
    if (!reason) return toast('กรุณากรอกสาเหตุที่ยกเลิก');
    o.status = 'cancelled'; o.cancelReason = reason; o.cancelledBy = 'shop';
    o.items.forEach(i => { const p = db.products.find(x => x.id === i.pid); if (p) p.qty += i.qty; });
    notify(o.userId, `ร้าน ${shop().name} ยกเลิกออเดอร์ ${o.code} สาเหตุ: ${reason}`);
    save(); closeModal(); render(); toast('ยกเลิกออเดอร์และแจ้งลูกค้าแล้ว');
  },
  scan: f => {
    const code = f.code.value.trim().toUpperCase();
    const o = myOrders().find(x => x.code === code);
    if (!o) return modal(`<div class="center"><h3>ไม่พบรหัสนี้ในร้านของคุณ</h3><button class="btn" data-close>ปิด</button></div>`);
    modal(`
      <div class="center">

        <h3>ออเดอร์ ${o.code}</h3>
        <p>ลูกค้า: ${esc(custName(o))}</p>
        <p>${o.items.map(i => esc(i.name) + ' x' + i.qty).join('<br>')}</p>
        <p class="price" style="margin:10px 0">${baht(o.total)} · ${esc(o.pay)}</p>
        <p><span class="tag ${STATUS[o.status].cls}">${STATUS[o.status].text}</span></p><br>
        ${o.status === 'reserved' ? `<button class="btn" data-act="pick" data-id="${o.id}">ยืนยันรับสินค้า</button>` : ''}
        <button class="btn btn-light" data-close>ปิด</button>
      </div>`);
  },
  settings: f => {
    const [ot, ct, ps, pe] = ['openTime', 'closeTime', 'pickStart', 'pickEnd'].map(n => f[n].value);
    if (ot >= ct) return toast('เวลาปิดร้านต้องหลังเวลาเปิดร้าน');
    if (ps >= pe) return toast('เวลาสิ้นสุดรับสินค้าต้องหลังเวลาเริ่มรับสินค้า');
    if (ps < ot || pe > ct) return toast('ช่วงเวลารับสินค้าต้องอยู่ในเวลาเปิดร้าน');
    Object.assign(shop(), { name: f.name.value.trim(), openTime: ot, closeTime: ct, pickup: `${ps} - ${pe}`, address: f.address.value.trim(), img: f.img.value, open: f.open.checked });
    save(); render(); toast('บันทึกการตั้งค่าร้านเรียบร้อยแล้ว');
  }
});

/* ตัวกรองสถานะในหน้าคำสั่งจอง */
document.addEventListener('change', e => {
  if (e.target.hasAttribute('data-filter')) { orderFilter = e.target.value; render(); }
});

go('dashboard');



