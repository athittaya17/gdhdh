/* =====================================================
   FoodLoop - ฝั่งผู้ดูแลระบบ (Admin)
   หน้าต่าง ๆ: dashboard, shops, users, reports, stats
   ===================================================== */
let me = Auth.guard('admin');
const app = $('#app');
let cur = 'dashboard';

const SHOP_STATUS = {
  pending:   { text: 'รออนุมัติ', cls: 'wait' },
  approved:  { text: 'เปิดใช้งาน', cls: 'ok' },
  rejected:  { text: 'ถูกปฏิเสธ', cls: 'bad' },
  suspended: { text: 'ถูกระงับ', cls: 'bad' }
};
const ownerOf = s => db.users.find(u => u.shopId === s.id);
const shopOrders = id => db.orders.filter(o => o.shopId === id && o.status !== 'cancelled');
const sales = list => list.filter(o => o.status === 'picked').reduce((a, o) => a + o.total, 0);

/* ปุ่มจัดการร้านตามสถานะ (ใช้ซ้ำ) */
const shopButtons = s => ({
  pending:   `<button class="mini-btn" data-act="shopSet" data-id="${s.id}" data-v="approved">อนุมัติ</button> <button class="mini-btn alt" data-act="shopSet" data-id="${s.id}" data-v="rejected">ปฏิเสธ</button>`,
  approved:  `<button class="mini-btn danger" data-act="shopSet" data-id="${s.id}" data-v="suspended">ระงับ</button>`,
  suspended: `<button class="mini-btn" data-act="shopSet" data-id="${s.id}" data-v="approved">เปิดใช้งาน</button>`,
  rejected:  `<button class="mini-btn" data-act="shopSet" data-id="${s.id}" data-v="approved">อนุมัติ</button>`
}[s.status]);

const views = {

  /* ---- Dashboard ภาพรวม ---- */
  dashboard() {
    const today = startOfDay(Date.now()), os = db.orders.filter(o => o.status !== 'cancelled');
    const pend = db.shops.filter(s => s.status === 'pending');
    return `
    <h1>Dashboard ภาพรวมระบบ</h1>
    <div class="stats">
      <div class="stat"><small>ร้านค้าที่เปิดอยู่</small><b>${db.shops.filter(s => s.status === 'approved').length}</b></div>
      <div class="stat"><small>ลูกค้าทั้งหมด</small><b>${db.users.filter(u => u.role === 'customer').length}</b></div>
      <div class="stat"><small>ออเดอร์วันนี้</small><b>${os.filter(o => o.created >= today).length}</b></div>
      <div class="stat"><small>ร้านรออนุมัติ</small><b>${pend.length}</b></div>
      <div class="stat"><small>ข้อร้องเรียนค้าง</small><b>${db.reports.filter(r => r.status === 'open').length}</b></div>
    </div>
    <section class="panel"><h3>จำนวนออเดอร์ 7 วันล่าสุด</h3>${barChart(daily(os, l => l.length))}</section>
    <section class="panel">
      <h3>ร้านค้ารออนุมัติ</h3>
      ${pend.length ? `<table><tr><th>ร้านค้า</th><th>เจ้าของ</th><th>ที่อยู่</th><th></th></tr>
        ${pend.map(s => `<tr><td>${esc(s.name)}</td><td>${esc((ownerOf(s) || {}).name || '-')}</td><td>${esc(s.address)}</td><td>${shopButtons(s)}</td></tr>`).join('')}</table>` : '<p class="empty">ไม่มีร้านที่รออนุมัติ</p>'}
    </section>`;
  },

  /* ---- จัดการร้านค้า / อนุมัติร้านค้า ---- */
  shops() {
    return `
    <h1>จัดการร้านค้า / อนุมัติร้านค้า</h1>
    <section class="panel"><table>
      <tr><th>ร้านค้า</th><th>เจ้าของ / อีเมล</th><th>ออเดอร์</th><th>ยอดขาย</th><th>สถานะ</th><th></th></tr>
      ${db.shops.map(s => { const o = ownerOf(s) || {}, st = SHOP_STATUS[s.status]; return `<tr>
        <td><b>${esc(s.name)}</b><br><small style="color:var(--muted)">${esc(s.address)}</small></td>
        <td>${esc(o.name || '-')}<br><small style="color:var(--muted)">${esc(o.email || '')}</small></td>
        <td>${shopOrders(s.id).length}</td><td>${baht(sales(shopOrders(s.id)))}</td>
        <td><span class="tag ${st.cls}">${st.text}</span></td><td>${shopButtons(s)}</td></tr>`; }).join('')}
    </table></section>`;
  },

  /* ---- จัดการลูกค้า ---- */
  users() {
    const cs = db.users.filter(u => u.role === 'customer');
    return `
    <h1>จัดการลูกค้า</h1>
    <section class="panel"><table>
      <tr><th>ชื่อ</th><th>อีเมล</th><th>เบอร์โทร</th><th>จำนวนจอง</th><th>สถานะ</th><th></th></tr>
      ${cs.map(u => `<tr>
        <td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.phone || '-')}</td>
        <td>${db.orders.filter(o => o.userId === u.id).length}</td>
        <td><span class="tag ${u.suspended ? 'bad' : 'ok'}">${u.suspended ? 'ถูกระงับ' : 'ใช้งาน'}</span></td>
        <td><button class="mini-btn ${u.suspended ? '' : 'danger'}" data-act="userToggle" data-id="${u.id}">${u.suspended ? 'เปิดใช้' : 'ระงับ'}</button></td>
      </tr>`).join('')}
    </table></section>`;
  },

  /* ---- ตรวจสอบรายการ / ข้อร้องเรียน ---- */
  reports() {
    return `
    <h1>ตรวจสอบรายการ / ข้อร้องเรียน</h1>` + (db.reports.map(r => {
      const o = db.orders.find(x => x.id === r.orderId) || {}, u = userById(r.userId) || {}, s = shopById(r.shopId) || {};
      return `<div class="notif report ${r.status === 'done' ? 'done' : ''}">
        <b>ออเดอร์ ${esc(o.code || '-')}</b> · ร้าน ${esc(s.name || '-')} · ผู้ร้องเรียน ${esc(u.name || '-')}
        <span class="tag ${r.status === 'done' ? 'ok' : 'wait'}">${r.status === 'done' ? 'ดำเนินการแล้ว' : 'รอตรวจสอบ'}</span><br>
        “${esc(r.text)}”<br>
        ${r.note ? `<small>บันทึกแอดมิน: ${esc(r.note)}</small><br>` : ''}
        <small>${fmtDate(r.time)}</small>
        ${r.status === 'open' ? `<br><br><button class="mini-btn" data-act="resolve" data-id="${r.id}">ตอบกลับและปิดเรื่อง</button> <button class="mini-btn danger" data-act="shopSet" data-id="${r.shopId}" data-v="suspended">ระงับร้านนี้</button>` : ''}
      </div>`;
    }).join('') || '<p class="empty">ไม่มีข้อร้องเรียน</p>');
  },

  /* ---- รายงานและสถิติ ---- */
  stats() {
    const picked = db.orders.filter(o => o.status === 'picked');
    const byShop = db.shops.filter(s => s.status === 'approved').map(s => ({ label: s.name, v: sales(shopOrders(s.id)) })).sort((a, b) => b.v - a.v);
    const byCat = Object.entries(CATS).map(([k, name]) => ({
      label: name, value: picked.reduce((a, o) => a + o.items.filter(i => i.cat === k).reduce((x, i) => x + i.qty, 0), 0)
    }));
    return `
    <h1>รายงานและสถิติ</h1>
    <div class="stats">
      <div class="stat"><small>ยอดขายรวม</small><b>${baht(sales(picked))}</b></div>
      <div class="stat"><small>อาหารที่ถูกช่วยไว้</small><b>${picked.reduce((a, o) => a + itemCount(o), 0)} ชิ้น</b></div>
      <div class="stat"><small>ออเดอร์สำเร็จ</small><b>${picked.length}</b></div>
      <div class="stat"><small>ยกเลิก</small><b>${db.orders.filter(o => o.status === 'cancelled').length}</b></div>
    </div>
    <div class="two-col">
      <section class="panel"><h3>ร้านค้าขายดี (ยอดขาย)</h3>${hBars(byShop.map(b => ({ label: b.label, value: b.v, text: baht(b.v) }))) || '-'}</section>
      <section class="panel"><h3>สินค้าที่ขายได้ตามหมวด (ชิ้น)</h3>${hBars(byCat)}</section>
    </div>
    <section class="panel"><h3>ยอดขาย 7 วันล่าสุด (บาท)</h3>${barChart(daily(picked, l => sales(l)))}</section>`;
  },

  /* ---- ตั้งค่าระบบ: โปรไฟล์ / ความปลอดภัย / การใช้งาน / ข้อมูลระบบ / ประวัติผู้ดูแล ---- */
  settings() {
    const a = adminUser(), c = cfg(), signup = c.allowShopSignup !== false;
    const bks = c.backups || [], last = bks[0], stale = last && db.updatedAt - last.time > 5000;
    const pendN = db.shops.filter(s => s.status === 'pending').length, repN = db.reports.filter(r => r.status === 'open').length;
    const kb = Math.max(1, Math.round(JSON.stringify(db).length / 1024));
    const eye = '<button type="button" class="pw-eye" data-eye>แสดง</button>';
    const logins = (a.loginLog || []).slice(0, 5);
    return `
    <h1>ตั้งค่าระบบ</h1>
    <p class="page-sub">จัดการบัญชีผู้ดูแล ความปลอดภัย และข้อมูลของระบบ</p>
    <div class="set-grid">
      <div class="set-col">
      <section class="panel set-card">
        <div class="set-head"><div class="set-avatar">${esc(initial(a.name))}</div><div><h3>โปรไฟล์ผู้ดูแลระบบ</h3><small>ข้อมูลบัญชีที่ใช้เข้าสู่ระบบ</small></div></div>
        <form data-form="adminProfile" class="form-grid">
          <label>ชื่อที่แสดง<input name="name" value="${esc(a.name)}" required></label>
          <label>อีเมล<input name="email" type="email" value="${esc(a.email)}" required></label>
          <label class="full">รหัสผ่านปัจจุบัน <small>(ต้องกรอกเมื่อเปลี่ยนอีเมล เพื่อยืนยันว่าเป็นเจ้าของบัญชี)</small><span class="pw-wrap"><input name="cpw" type="password" autocomplete="current-password">${eye}</span></label>
          <div class="form-actions"><button class="btn">บันทึกการเปลี่ยนแปลง</button></div>
        </form>
      </section>

      <section class="panel set-card">
        <div class="set-head"><div><h3>ความปลอดภัย</h3><small>เปลี่ยนรหัสผ่านสำหรับเข้าสู่ระบบ</small></div></div>
        <form data-form="adminPass" class="form-grid" id="passForm">
          <label class="full">รหัสผ่านปัจจุบัน<span class="pw-wrap"><input name="old" type="password" autocomplete="current-password" required>${eye}</span></label>
          <label>รหัสผ่านใหม่<span class="pw-wrap"><input name="pw" type="password" autocomplete="new-password" required>${eye}</span></label>
          <label>ยืนยันรหัสผ่านใหม่<span class="pw-wrap"><input name="pw2" type="password" autocomplete="new-password" required>${eye}</span></label>
          <ul class="full pw-rules" id="pwRules">
            <li data-r="len">อย่างน้อย 6 ตัวอักษร</li>
            <li data-r="diff">ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน</li>
            <li data-r="same">รหัสผ่านใหม่และการยืนยันต้องตรงกัน</li>
          </ul>
          <div class="form-actions"><button class="btn" id="pwBtn" disabled>เปลี่ยนรหัสผ่าน</button></div>
        </form>
        <div class="set-info">
          <b>ประวัติการเข้าสู่ระบบ</b>
          ${logins.length ? `<ul>${logins.map((t, i) => `<li>${fmtFull(t)}${i === 0 ? ' <span class="tag ok">ครั้งนี้</span>' : ''}</li>`).join('')}</ul>` : '<p>ยังไม่มีประวัติ (จะเริ่มบันทึกตั้งแต่การเข้าสู่ระบบครั้งถัดไป)</p>'}
          <small>ข้อมูลเข้าสู่ระบบเก็บในเบราว์เซอร์ของแต่ละเครื่อง จึงยังไม่รองรับ "ออกจากระบบทุกอุปกรณ์"</small>
        </div>
      </section>

      </div>
      <div class="set-col">
      <section class="panel set-card">
        <div class="set-head"><div><h3>การใช้งานระบบ</h3><small>ควบคุมการสมัครของร้านค้า และการแจ้งเตือนของผู้ดูแล</small></div></div>
        <div class="set-row">
          <div><b>เปิดรับสมัครร้านค้าใหม่</b><small>ควบคุมหน้าสมัครสมาชิกของร้านค้าเท่านั้น ไม่เกี่ยวกับการเปิด–ปิดรับออเดอร์ของแต่ละร้าน</small></div>
          <label class="switch"><input type="checkbox" id="signupToggle" ${signup ? 'checked' : ''}><span class="slider"></span></label>
        </div>
        <p class="set-sub">การแจ้งเตือนในเมนูข้าง</p>
        <div class="set-row">
          <div><b>ร้านค้าสมัครใหม่รออนุมัติ</b><small>ตอนนี้รออยู่ ${pendN} ร้าน</small></div>
          <label class="switch"><input type="checkbox" id="ntShop" ${c.notifyShop !== false ? 'checked' : ''}><span class="slider"></span></label>
        </div>
        <div class="set-row">
          <div><b>ข้อร้องเรียนใหม่</b><small>ตอนนี้ค้างอยู่ ${repN} เรื่อง</small></div>
          <label class="switch"><input type="checkbox" id="ntReport" ${c.notifyReport !== false ? 'checked' : ''}><span class="slider"></span></label>
        </div>
      </section>

      <section class="panel set-card">
        <div class="set-head"><div><h3>ข้อมูลระบบ</h3><small>ภาพรวม สำรอง และกู้คืนข้อมูล</small></div></div>
        <div class="set-stats">
          <div><b>${db.shops.length}</b><small>ร้านค้า</small></div>
          <div><b>${db.users.filter(u => u.role === 'customer').length}</b><small>ลูกค้า</small></div>
          <div><b>${db.orders.length}</b><small>ออเดอร์</small></div>
          <div><b>${kb} KB</b><small>ขนาดข้อมูล</small></div>
        </div>
        <dl class="set-status">
          <dt>แก้ไขข้อมูลล่าสุด</dt><dd>${fmtFull(db.updatedAt)}</dd>
          <dt>สำรองข้อมูลล่าสุด</dt><dd>${last ? fmtFull(last.time) : '-'}</dd>
          <dt>สถานะการสำรอง</dt><dd>${!last ? '<span class="tag bad">ยังไม่เคยสำรอง</span>' : stale ? '<span class="tag wait">มีการแก้ไขหลังสำรองล่าสุด</span>' : '<span class="tag ok">สำเร็จ · เป็นข้อมูลล่าสุด</span>'}</dd>
        </dl>

        <div class="set-group">
          <div><b>สำรองข้อมูล</b><small>ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON</small></div>
          <button class="mini-btn" data-act="backup">ดาวน์โหลดไฟล์สำรอง</button>
        </div>
        <div class="set-group">
          <div><b>กู้คืนข้อมูล</b><small>แทนที่ข้อมูลปัจจุบันด้วยไฟล์สำรอง</small></div>
          <button class="mini-btn edit" data-act="pickRestore">เลือกไฟล์สำรอง</button>
          <input type="file" id="restoreFile" accept="application/json,.json" hidden>
        </div>
        <div class="set-group danger-zone">
          <div><b>รีเซ็ตเป็นข้อมูลตัวอย่าง</b><small>ลบร้านค้า ลูกค้า และออเดอร์ทั้งหมด กู้คืนไม่ได้</small></div>
          <button class="mini-btn danger" data-act="resetData">รีเซ็ต…</button>
        </div>

        ${bks.length ? `<p class="set-sub">ประวัติการสำรองข้อมูล</p>
        <table class="set-table"><tr><th>วันเวลา</th><th>ขนาด</th><th>สถานะ</th></tr>
          ${bks.map(b => `<tr><td>${fmtFull(b.time)}</td><td>${b.kb} KB</td><td><span class="tag ok">สำเร็จ</span></td></tr>`).join('')}
        </table>` : ''}
        <small class="set-note">ไฟล์สำรองมีข้อมูลส่วนตัวของลูกค้าและรหัสผ่านของทุกบัญชี ระบบจึงไม่เก็บสำเนาไฟล์ไว้ (เก็บเพียงวันเวลาและขนาด) ควรเก็บไฟล์ไว้ในที่ปลอดภัยและไม่แชร์ต่อ</small>
      </section>
      </div>

      <section class="panel set-card set-wide">
        <div class="set-head"><div><h3>ประวัติการใช้งานของผู้ดูแล</h3><small>บันทึกว่าใครทำอะไรและเมื่อไร (แสดง 10 รายการล่าสุด)</small></div></div>
        ${(db.audit || []).length ? `<table class="set-table"><tr><th>วันเวลา</th><th>ผู้ดำเนินการ</th><th>รายการ</th></tr>
          ${db.audit.slice(0, 10).map(l => `<tr><td>${fmtFull(l.time)}</td><td>${esc(l.who)}</td><td>${esc(l.text)}</td></tr>`).join('')}</table>` : '<p class="empty">ยังไม่มีประวัติ รายการจะแสดงเมื่อมีการอนุมัติ ระงับ หรือแก้ไขการตั้งค่า</p>'}
      </section>
    </div>`;
  }
};
const adminUser = () => userById(me.id) || me;
const cfg = () => db.settings = db.settings || {};
const fmtFull = t => t ? new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const logAudit = text => { (db.audit = db.audit || []).unshift({ time: Date.now(), who: adminUser().name, text }); db.audit.length = Math.min(db.audit.length, 200); };

/* ---------- การแสดงผล ---------- */
function go(v) { cur = v; render(); scrollTo(0, 0); }
function render() {
  app.innerHTML = views[cur]();
  document.querySelectorAll('#nav [data-v]').forEach(a => a.classList.toggle('active', a.dataset.v === cur));
  const p = db.shops.filter(s => s.status === 'pending').length, r = db.reports.filter(x => x.status === 'open').length;
  $('#pendCount').hidden = !p || cfg().notifyShop === false; $('#pendCount').textContent = p;
  $('#repCount').hidden = !r || cfg().notifyReport === false; $('#repCount').textContent = r;
}
window.onDbChange = () => { if (!busy()) render(); };

/* ---------- ฟังก์ชันการทำงาน ---------- */
bind({
  go: d => go(d.v),
  logout: () => confirmLogout('admin'),
  shopSet: d => {
    const s = shopById(d.id), o = ownerOf(s);
    if (d.v === 'suspended' && !confirm('ยืนยันระงับร้าน "' + s.name + '" ?')) return;
    if (d.v === 'approved' && s.status !== 'suspended') s.approvedAt = Date.now();   // ร้านใหม่: ลูกค้าเห็นในส่วน "ร้านค้าใหม่"
    s.status = d.v;
    const msg = { approved: 'ร้านของคุณได้รับอนุมัติให้เปิดใช้งานแล้ว ', rejected: 'คำขอเปิดร้านของคุณถูกปฏิเสธ', suspended: 'ร้านของคุณถูกระงับการใช้งาน' }[d.v];
    if (msg) notify(s.id, msg);
    logAudit(`เปลี่ยนสถานะร้าน "${s.name}" เป็น ${SHOP_STATUS[d.v].text}`);
    save(); render(); toast('อัปเดตสถานะร้านแล้ว');
  },
  userToggle: d => {
    const u = userById(d.id);
    u.suspended = !u.suspended;
    logAudit(`${u.suspended ? 'ระงับ' : 'เปิดใช้งาน'}บัญชีลูกค้า ${u.name}`);
    save(); render();
  },
  resolve: d => {
    const note = prompt('ข้อความตอบกลับ / บันทึกการดำเนินการ');
    if (note === null) return;
    const r = db.reports.find(x => x.id === d.id);
    r.status = 'done'; r.note = note;
    notify(r.userId, 'เรื่องร้องเรียนของคุณได้รับการตรวจสอบแล้ว: ' + (note || 'ดำเนินการเรียบร้อย'));
    logAudit('ปิดเรื่องร้องเรียนและตอบกลับลูกค้า');
    save(); render(); toast('ปิดเรื่องแล้ว');
  },
  backup: () => {
    if (!confirm('ไฟล์สำรองมีข้อมูลส่วนตัวของลูกค้าและรหัสผ่านของทุกบัญชี\nควรเก็บไว้ในที่ปลอดภัยและไม่แชร์ต่อ ดำเนินการต่อหรือไม่?')) return;
    logAudit('สำรองข้อมูลระบบ');
    save();
    const json = JSON.stringify(db), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = 'foodloop-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click(); URL.revokeObjectURL(a.href);
    cfg().backups = [{ time: Date.now(), kb: Math.max(1, Math.round(json.length / 1024)) }, ...(cfg().backups || [])].slice(0, 5);
    save(); render(); toast('ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว');
  },
  pickRestore: () => $('#restoreFile').click(),
  resetData: () => {
    const m = modal(`
      <div class="center">
        <h3>รีเซ็ตข้อมูลทั้งหมด?</h3>
        <p style="margin:8px 0">ร้านค้า ลูกค้า ออเดอร์ และประวัติทั้งหมดจะถูกลบและแทนที่ด้วยข้อมูลตัวอย่าง <b>กู้คืนไม่ได้</b><br>แนะนำให้ดาวน์โหลดไฟล์สำรองก่อน</p>
        <p style="margin-bottom:8px">พิมพ์คำว่า <b>รีเซ็ต</b> เพื่อยืนยัน</p>
        <input id="resetConfirm" autocomplete="off" style="width:100%;padding:10px 14px;border:1.5px solid var(--line);border-radius:12px;font:inherit;text-align:center;margin-bottom:14px">
        <button class="btn btn-light" data-close>ยกเลิก</button>
        <button class="btn btn-danger" id="resetOk" disabled>รีเซ็ตข้อมูล</button>
      </div>`);
    const inp = m.querySelector('#resetConfirm'), ok = m.querySelector('#resetOk');
    inp.oninput = () => { ok.disabled = inp.value.trim() !== 'รีเซ็ต'; };
    ok.onclick = () => { if (!ok.disabled) DB.reset(); };
    inp.focus();
  }
}, {
  adminProfile: f => {
    const a = adminUser(), name = f.name.value.trim(), email = f.email.value.trim();
    if (db.users.some(u => u.id !== me.id && u.email.toLowerCase() === email.toLowerCase())) return toast('อีเมลนี้ถูกใช้แล้ว');
    const emailChanged = email.toLowerCase() !== a.email.toLowerCase();
    if (emailChanged && f.cpw.value !== a.pass) return toast('กรอกรหัสผ่านปัจจุบันให้ถูกต้องเพื่อยืนยันการเปลี่ยนอีเมล');
    if (name !== a.name || emailChanged) logAudit(emailChanged ? 'เปลี่ยนอีเมลผู้ดูแลระบบ' : 'แก้ไขโปรไฟล์ผู้ดูแลระบบ');
    Object.assign(a, { name, email });
    save(); render(); toast('บันทึกโปรไฟล์เรียบร้อยแล้ว');
  },
  adminPass: f => {
    if (f.old.value !== adminUser().pass) return toast('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    if (!pwOk(f).every(Boolean)) return toast('รหัสผ่านใหม่ยังไม่ตรงตามเงื่อนไข');
    adminUser().pass = f.pw.value;
    logAudit('เปลี่ยนรหัสผ่านผู้ดูแลระบบ');
    save(); render(); toast('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
  }
});

/* ตรวจเงื่อนไขรหัสผ่านใหม่: [ยาวพอ, ไม่ซ้ำเดิม, ยืนยันตรงกัน] */
const pwOk = f => [f.pw.value.length >= 6, !!f.pw.value && f.pw.value !== f.old.value, !!f.pw.value && f.pw.value === f.pw2.value];
function checkPw() {
  const f = $('#passForm');
  if (!f) return;
  const ok = pwOk(f);
  document.querySelectorAll('#pwRules li').forEach((li, i) => li.classList.toggle('ok', ok[i]));
  $('#pwBtn').disabled = !(f.old.value && ok.every(Boolean));
}
document.addEventListener('input', e => { if (e.target.closest('#passForm')) checkPw(); });
document.addEventListener('click', e => {
  if (!e.target.hasAttribute('data-eye')) return;
  const inp = e.target.previousElementSibling, show = inp.type === 'password';
  inp.type = show ? 'text' : 'password'; e.target.textContent = show ? 'ซ่อน' : 'แสดง';
});

document.addEventListener('change', e => {
  if (e.target.id === 'signupToggle') {
    cfg().allowShopSignup = e.target.checked;
    logAudit(e.target.checked ? 'เปิดรับสมัครร้านค้าใหม่' : 'ปิดรับสมัครร้านค้าใหม่');
    save(); render(); toast(e.target.checked ? 'เปิดรับสมัครร้านค้าใหม่แล้ว' : 'ปิดรับสมัครร้านค้าใหม่แล้ว');
  }
  if (e.target.id === 'ntShop' || e.target.id === 'ntReport') {
    cfg()[e.target.id === 'ntShop' ? 'notifyShop' : 'notifyReport'] = e.target.checked;
    save(); render(); toast('บันทึกการตั้งค่าการแจ้งเตือนแล้ว');
  }
  if (e.target.id === 'restoreFile' && e.target.files[0]) {
    const reader = new FileReader();
    reader.onload = () => {
      let d;
      try { d = JSON.parse(reader.result); } catch (err) { return toast('ไฟล์ไม่ถูกต้อง'); }
      if (!['users', 'shops', 'products', 'orders', 'reports', 'notifs'].every(k => Array.isArray(d[k]))) return toast('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ FoodLoop');
      if (!confirm('กู้คืนข้อมูลจากไฟล์นี้? ข้อมูลปัจจุบันทั้งหมดจะถูกแทนที่')) return;
      d.carts = d.carts || {};
      db = d; logAudit('กู้คืนข้อมูลจากไฟล์สำรอง'); save();
      if (!userById(me.id)) return Auth.logout('admin');
      render(); toast('กู้คืนข้อมูลเรียบร้อยแล้ว');
    };
    reader.readAsText(e.target.files[0]);
    e.target.value = '';
  }
});

go('dashboard');

