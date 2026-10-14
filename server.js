"use strict";
// PetalHub server — Node 18+ with MySQL (mysql2). Setup: see README.md
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const mysql = require("mysql2/promise");
const PORT = process.env.PORT || 3000;
const pool = mysql.createPool({ host: process.env.DB_HOST || "localhost", port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME || "petalhub", connectionLimit: 10, decimalNumbers: true });
const q = async (sql, args) => (await pool.query(sql, args))[0];
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const STATIC_OK = /^\/(index\.html|style\.css|script\.js|flowers\/[\w-]+\.(png|jpg|svg))$/;
const FLOW = ["Pending", "Preparing", "Ready", "Completed"];
const sha = s => crypto.createHash("sha256").update(s).digest("hex");

/* ---------- passwords & sessions ---------- */
const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString("hex");
const pwOk = (u, pw) => crypto.timingSafeEqual(Buffer.from(hashPw(pw, u.salt), "hex"), Buffer.from(u.password_hash, "hex"));
async function addUser(name, email, pw, role, question, answer){
  const salt = crypto.randomBytes(16).toString("hex"), ss = answer ? crypto.randomBytes(16).toString("hex") : null;
  return (await pool.query("INSERT INTO users (name, email, salt, password_hash, role, security_question, security_salt, security_hash) VALUES (?,?,?,?,?,?,?,?)",
    [name, email, salt, hashPw(pw, salt), role, answer ? question : null, ss, answer ? hashPw(answer.trim().toLowerCase(), ss) : null]))[0].insertId;
}
async function init(){
  await q("SELECT 1 FROM users LIMIT 1"); // fails clearly if schema.sql was not run
  const addCol = async (t, c, def) => { if (!(await q("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?", [t, c])).length) await q("ALTER TABLE " + t + " ADD COLUMN " + c + " " + def); };
  await addCol("products", "active", "TINYINT(1) NOT NULL DEFAULT 1");
  await addCol("products", "description", "VARCHAR(300) NOT NULL DEFAULT ''");
  await addCol("users", "security_question", "VARCHAR(120) NULL");
  await addCol("users", "security_salt", "CHAR(32) NULL");
  await addCol("users", "security_hash", "CHAR(128) NULL");
  if ((await q("SELECT id FROM users WHERE role='admin' LIMIT 1")).length) return;
  const email = (process.env.ADMIN_EMAIL || "admin@petalhub.com").toLowerCase();
  const pw = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
  await addUser("Admin", email, pw, "admin");
  console.log("Admin account created: " + email + (process.env.ADMIN_PASSWORD ? "" : "  password: " + pw + "  (shown once — write it down)"));
}
async function authUser(req){
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || ""); if (!m) return null;
  return (await q("SELECT u.id, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > NOW()", [sha(m[1])]))[0] || null;
}
async function startSession(res, u){
  const t = crypto.randomBytes(24).toString("hex");
  await q("DELETE FROM sessions WHERE expires_at < NOW()");
  await q("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))", [sha(t), u.id]);
  send(res, 200, { token: t, user: { name: u.name, email: u.email, role: u.role } });
}

/* ---------- helpers ---------- */
function send(res, code, obj){ res.writeHead(code, { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); }
function readBody(req){ return new Promise((ok, no) => { let b = ""; req.on("data", c => { b += c; if (b.length > 100000){ no({ code: 413, msg: "Request too large." }); req.destroy(); } }); req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no({ code: 400, msg: "Invalid JSON." }); } }); }); }
const tries = {};
function throttled(ip){ const t = tries[ip] = tries[ip] && tries[ip].reset > Date.now() ? tries[ip] : { n: 0, reset: Date.now() + 3e5 }; return ++t.n > 10; }
const str = (v, n) => typeof v === "string" ? v.trim().slice(0, n) : "";
const pub = p => ({ id: p.id, name: p.name, desc: p.description || "", price: Number(p.price), stock: p.qty + " " + p.unit });
const toOrder = (r, items) => ({ code: r.code, date: new Date(r.created_at).toISOString(), customer: r.customer, email: r.email, total: Number(r.total), status: r.status,
  items: items.filter(i => i.order_code === r.code).map(i => ({ id: i.id, name: i.name, qty: i.qty, price: Number(i.price) })),
  fulfillment: r.fulfillment, address: { street: r.street, city: r.city, zip: r.zip }, payment: r.payment });
async function tx(fn){
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const out = await fn(conn); await conn.commit(); return out; }
  catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
}

/* ---------- API ---------- */
async function api(req, res, url){
  const ip = req.socket.remoteAddress, m = req.method;
  if (m === "GET" && url === "/api/products") return send(res, 200, (await q("SELECT id, name, description, price, qty, unit FROM products WHERE active = 1 ORDER BY id")).map(pub));
  const me = await authUser(req);
  if (m === "GET" && url === "/api/me") return me ? send(res, 200, { user: { name: me.name, email: me.email, role: me.role } }) : send(res, 401, { error: "Please log in." });
  if (m === "POST" && url === "/api/logout"){ const t = /^Bearer (.+)$/.exec(req.headers.authorization || ""); if (t) await q("DELETE FROM sessions WHERE token_hash = ?", [sha(t[1])]); return send(res, 200, {}); }
  if (m === "POST" && (url === "/api/register" || url === "/api/login")){
    if (throttled(ip)) return send(res, 429, { error: "Too many attempts. Try again in a few minutes." });
    const b = await readBody(req), email = str(b.email, 200).toLowerCase(), pw = typeof b.pass === "string" ? b.pass : "";
    if (url === "/api/login"){
      const u = (await q("SELECT * FROM users WHERE email = ?", [email]))[0];
      return u && pwOk(u, pw) ? startSession(res, u) : send(res, 401, { error: "Incorrect email or password." });
    }
    const name = str(b.name, 80);
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: "Enter your name and a valid email." });
    if (pw.length < 6) return send(res, 400, { error: "Password must be at least 6 characters." });
    if ((await q("SELECT id FROM users WHERE email = ?", [email])).length) return send(res, 409, { error: "An account with that email already exists. Please log in." });
    const question = str(b.question, 120), answer = str(b.answer, 100);
    if (!question || answer.length < 2) return send(res, 400, { error: "Choose a security question and give an answer." });
    const id = await addUser(name, email, pw, "customer", question, answer);
    return startSession(res, { id, name, email, role: "customer" });
  }
  if (m === "GET" && url === "/api/orders/mine"){
    if (!me) return send(res, 401, { error: "Please log in." });
    const rows = await q("SELECT o.*, u.name AS customer, u.email FROM orders o JOIN users u ON u.id = o.user_id WHERE o.user_id = ? ORDER BY o.created_at DESC, o.code DESC", [me.id]);
    const items = rows.length ? await q("SELECT order_code, product_id AS id, name, qty, price FROM order_items WHERE order_code IN (?)", [rows.map(r => r.code)]) : [];
    return send(res, 200, rows.map(r => toOrder(r, items)));
  }
  if (m === "POST" && url === "/api/forgot"){
    if (throttled(ip)) return send(res, 429, { error: "Too many attempts. Try again in a few minutes." });
    const email = str((await readBody(req)).email, 200).toLowerCase();
    const u = (await q("SELECT security_question FROM users WHERE email = ? AND role = 'customer'", [email]))[0];
    return send(res, 200, { question: u && u.security_question ? u.security_question : null });
  }
  if (m === "POST" && url === "/api/reset-password"){
    if (throttled(ip)) return send(res, 429, { error: "Too many attempts. Try again in a few minutes." });
    const b = await readBody(req), email = str(b.email, 200).toLowerCase(), pw = typeof b.password === "string" ? b.password : "";
    if (pw.length < 6) return send(res, 400, { error: "Password must be at least 6 characters." });
    const u = (await q("SELECT id, security_salt, security_hash FROM users WHERE email = ? AND role = 'customer'", [email]))[0];
    const ans = Buffer.from(hashPw(str(b.answer, 100).toLowerCase(), (u && u.security_salt) || "x"), "hex");
    if (!u || !u.security_hash || !crypto.timingSafeEqual(ans, Buffer.from(u.security_hash, "hex"))) return send(res, 400, { error: "Incorrect answer." });
    const salt = crypto.randomBytes(16).toString("hex");
    await q("UPDATE users SET salt = ?, password_hash = ? WHERE id = ?", [salt, hashPw(pw, salt), u.id]);
    await q("DELETE FROM sessions WHERE user_id = ?", [u.id]);
    return send(res, 200, {});
  }
  if (m === "POST" && url === "/api/orders"){
    if (!me) return send(res, 401, { error: "Please log in to place an order." });
    const b = await readBody(req), want = {};
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 50) return send(res, 400, { error: "Your cart is empty." });
    for (const i of b.items){ const id = Number(i.id), n = Number(i.qty); if (!Number.isInteger(id) || !Number.isInteger(n) || n < 1 || n > 99) return send(res, 400, { error: "Invalid cart." }); want[id] = (want[id] || 0) + n; }
    const delivery = b.fulfillment === "delivery";
    if (!delivery && b.fulfillment !== "pickup") return send(res, 400, { error: "Choose pickup or delivery." });
    const a = b.address || {}, ad = delivery ? { street: str(a.street, 200), city: str(a.city, 100), zip: str(a.zip, 20) } : { street: "", city: "", zip: "" };
    if (delivery && (!ad.street || !ad.city)) return send(res, 400, { error: "Enter a delivery address." });
    const pay = { card: "Credit / debit card", wallet: "GCash / e-wallet", cash: delivery ? "Cash on delivery" : "Cash on pickup" }[b.payment];
    if (!pay) return send(res, 400, { error: "Choose a payment method." });
    const code = await tx(async c => {
      const ids = Object.keys(want).map(Number);
      const [prods] = await c.query("SELECT id, name, price, qty FROM products WHERE id IN (?) AND active = 1 ORDER BY id FOR UPDATE", [ids]);
      if (prods.length !== ids.length) throw { code: 400, msg: "Unknown product." };
      for (const p of prods) if (want[p.id] > p.qty) throw { code: 409, msg: p.qty ? "Only " + p.qty + " left of " + p.name + "." : p.name + " is out of stock." };
      const total = Math.round(prods.reduce((s, p) => s + Number(p.price) * want[p.id], 0) * 100) / 100;
      let oc; for (;;){ oc = "PH-" + crypto.randomInt(100000, 1000000); if (!(await c.query("SELECT 1 FROM orders WHERE code = ?", [oc]))[0].length) break; }
      await c.query("INSERT INTO orders (code, user_id, total, fulfillment, street, city, zip, payment) VALUES (?,?,?,?,?,?,?,?)", [oc, me.id, total, b.fulfillment, ad.street, ad.city, ad.zip, pay]);
      for (const p of prods){
        await c.query("INSERT INTO order_items (order_code, product_id, name, qty, price) VALUES (?,?,?,?,?)", [oc, p.id, p.name, want[p.id], p.price]);
        await c.query("UPDATE products SET qty = qty - ? WHERE id = ?", [want[p.id], p.id]);
      }
      return oc;
    });
    return send(res, 201, { code });
  }
  if (url.startsWith("/api/admin/")){
    if (!me || me.role !== "admin") return send(res, 403, { error: "Admin access only." });
    if (m === "GET" && url === "/api/admin/orders"){
      const rows = await q("SELECT o.*, u.name AS customer, u.email FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC, o.code DESC");
      const items = rows.length ? await q("SELECT order_code, product_id AS id, name, qty, price FROM order_items WHERE order_code IN (?)", [rows.map(r => r.code)]) : [];
      return send(res, 200, rows.map(r => toOrder(r, items)));
    }
    if (m === "GET" && url === "/api/admin/customers") return send(res, 200, await q("SELECT name, email FROM users WHERE role = 'customer' ORDER BY id"));
    let r = /^\/api\/admin\/orders\/(PH-\d+)$/.exec(url);
    if (m === "PATCH" && r){
      const s = (await readBody(req)).status;
      const out = await tx(async c => {
        const [[o]] = await c.query("SELECT status FROM orders WHERE code = ? FOR UPDATE", [r[1]]);
        if (!o) throw { code: 404, msg: "Order not found." };
        const i = FLOW.indexOf(o.status);
        if (s === "Cancelled" && i >= 0 && i < FLOW.length - 1){
          const [its] = await c.query("SELECT product_id, qty FROM order_items WHERE order_code = ?", [r[1]]);
          for (const it of its) await c.query("UPDATE products SET qty = qty + ? WHERE id = ?", [it.qty, it.product_id]);
        } else if (!(i >= 0 && s === FLOW[i + 1])) throw { code: 400, msg: "That status change isn't allowed." };
        await c.query("UPDATE orders SET status = ? WHERE code = ?", [s, r[1]]);
        return { code: r[1], status: s };
      });
      return send(res, 200, out);
    }
    if (m === "POST" && url === "/api/admin/products"){
      const b = await readBody(req), name = str(b.name, 80);
      if (!name || typeof b.price !== "number" || !(b.price >= 0 && b.price <= 1e5) || !Number.isInteger(b.qty) || b.qty < 0 || b.qty > 1e5) return send(res, 400, { error: "Enter a name, a valid price and a quantity." });
      const id = (await q("SELECT COALESCE(MAX(id), 0) + 1 AS n FROM products"))[0].n;
      await q("INSERT INTO products (id, name, price, qty, unit, description) VALUES (?,?,?,?,?,?)", [id, name, b.price, b.qty, "bunches available", str(b.desc, 300)]);
      return send(res, 201, { id });
    }
    r = /^\/api\/admin\/products\/(\d+)$/.exec(url);
    if (m === "DELETE" && r){ await q("UPDATE products SET active = 0 WHERE id = ?", [Number(r[1])]); return send(res, 200, {}); }
    if (m === "PUT" && r){
      const b = await readBody(req), id = Number(r[1]);
      if (typeof b.price !== "number" || !(b.price >= 0 && b.price <= 1e5) || !Number.isInteger(b.qty) || b.qty < 0 || b.qty > 1e5) return send(res, 400, { error: "Enter a valid price and quantity." });
      if (!(await q("SELECT id FROM products WHERE id = ?", [id])).length) return send(res, 404, { error: "Product not found." });
      await q("UPDATE products SET price = ?, qty = ? WHERE id = ?", [b.price, b.qty, id]);
      return send(res, 200, pub((await q("SELECT id, price, qty, unit FROM products WHERE id = ?", [id]))[0]));
    }
  }
  send(res, 404, { error: "Not found." });
}

http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  if (url.startsWith("/api/")) return api(req, res, url).catch(e => { if (typeof e.code !== "number") console.error(e); send(res, typeof e.code === "number" ? e.code : 500, { error: e.msg || "Server error." }); });
  const p = url === "/" ? "/index.html" : url;
  if (!STATIC_OK.test(p)){ res.writeHead(404); return res.end("Not found"); }
  fs.readFile(path.join(__dirname, p), (err, buf) => {
    if (err){ res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(p)], "X-Content-Type-Options": "nosniff" }); res.end(buf);
  });
}).listen(PORT, () => console.log("PetalHub running at http://localhost:" + PORT));
init().catch(e => { console.error("Cannot use the MySQL database:", e.message, "\nDid you run schema.sql and set DB_USER / DB_PASSWORD?"); process.exit(1); });
