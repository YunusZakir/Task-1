const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const app = express();
const PORT = 4000;
const SECRET = "yunus_secret_key";
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
let users = [];
let tables = [];
const auth = (req, res, next) => {
    req.user = jwt.verify((req.headers.authorization || "").split(" ")[1], SECRET);
    next();
};
app.post("/api/signup", async (req, res) => {
  let { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });
  if (users.find(u => u.username === username)) return res.status(400).json({ error: "User exists" });
  let user = { id: Date.now() + "", username, passwordHash: await bcrypt.hash(password, 10) };
  users.push(user);
  res.json({ token: jwt.sign({ id: user.id, username }, SECRET), username });
});
app.post("/api/login", async (req, res) => {
  let { username, password } = req.body;
  let user = users.find(u => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(400).json({ error: "Invalid credentials" });
  res.json({ token: jwt.sign({ id: user.id, username }, SECRET), username });
});
app.post("/api/tables", auth, (req, res) => {
  let { id, name, rows, cols, cells } = req.body;
  let now = new Date().toISOString();
  if (id) {
    let t = tables.find(t => t.id === id && t.ownerId === req.user.id);
    if (!t) return res.status(404).json({ error: "Not found" });
    Object.assign(t, { name, rows, cols, cells, updatedAt: now });
    return res.json(t);
  }
  let t = { id: Date.now() + "", ownerId: req.user.id, name, rows, cols, cells, createdAt: now, updatedAt: now };
  tables.push(t);
  res.json(t);
});
app.get("/api/tables", auth, (req, res) =>
  res.json(tables.filter(t => t.ownerId === req.user.id))
);
app.get("/api/tables/:id", auth, (req, res) => {
  let t = tables.find(t => t.id === req.params.id && t.ownerId === req.user.id);
  t ? res.json(t) : res.status(404).json({ error: "Not found" });
});
app.delete("/api/tables/:id", auth, (req, res) => {
  let i = tables.findIndex(t => t.id === req.params.id && t.ownerId === req.user.id);
  if (i < 0) return res.status(404).json({ error: "Not found" });
  tables.splice(i, 1);
  res.json({ ok: true });
});
app.get("/api/ping", (req, res) => res.json({ ok: true }));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log("Server running on", PORT));