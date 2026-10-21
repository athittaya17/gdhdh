/* =====================================================
   FoodLoop - ล็อกอิน / สมัครสมาชิก (ใช้ร่วม 3 บทบาท)
   บทบาทอ่านจาก <body data-role="customer|shop|admin">
   ===================================================== */
const role = document.body.dataset.role;
const HOME = { customer: 'customer-home.html', shop: 'shop-home.html', admin: 'admin-home.html' };

if (Auth.cur(role)) location.replace(HOME[role]);

const loginBox = $('#loginBox'), regBox = $('#regBox');
const msg = (el, text, ok) => { el.textContent = text; el.classList.toggle('ok-msg', !!ok); };

/* สลับระหว่างเข้าสู่ระบบ <-> สมัครสมาชิก */
document.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => {
  const reg = b.dataset.show === 'reg';
  loginBox.hidden = reg;
  if (regBox) regBox.hidden = !reg;
}));

/* เข้าสู่ระบบ */
$('#loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const r = Auth.login(role, f.email.value, f.pass.value);
  if (r.err) return msg($('#loginErr'), r.err);
  location.href = HOME[role];
});

/* สมัครสมาชิก */
const regForm = $('#regForm');
if (regForm) regForm.addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target, email = f.email.value.trim();
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) return msg($('#regErr'), 'อีเมลนี้ถูกใช้แล้ว');
  if (f.pass.value.length < 4) return msg($('#regErr'), 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');

  if (role === 'customer') {
    const u = { id: uid(), role, name: f.name.value.trim(), email, pass: f.pass.value, phone: f.phone.value.trim() };
    db.users.push(u); save();
    Auth.login(role, email, f.pass.value);
    location.href = HOME[role];
  } else if (role === 'shop') {
    if ((db.settings || {}).allowShopSignup === false) return msg($('#regErr'), 'ขณะนี้ปิดรับสมัครร้านค้าใหม่ชั่วคราว');
    const s = { id: uid(), name: f.shopName.value.trim(), rating: 0, reviews: 0, dist: 1, status: 'pending', tag: '',
      pickup: '17:00 - 19:00', address: f.address.value.trim(), open: true };
    db.shops.push(s);
    db.users.push({ id: uid(), role, name: f.name.value.trim(), email, pass: f.pass.value, shopId: s.id });
    notify('admin', 'ร้านใหม่ "' + s.name + '" สมัครเข้าร่วม รอการอนุมัติ');
    save();
    f.reset();
    regBox.hidden = true; loginBox.hidden = false;
    msg($('#loginErr'), 'สมัครสำเร็จ! กรุณารอผู้ดูแลระบบอนุมัติร้านค้า', true);
  }
});

