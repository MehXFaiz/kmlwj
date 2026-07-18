const BASE = 'http://localhost:4000';

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@erp.com', password: 'admin123' }),
});
const loginBody = await login.json();
if (!login.ok) { console.error('LOGIN FAILED', loginBody); process.exit(1); }
const token = loginBody.accessToken || loginBody.token || loginBody.data?.accessToken || loginBody.data?.token;
console.log('login keys:', Object.keys(loginBody), 'token?', !!token);

const res = await fetch(`${BASE}/api/v1/accounts`, { headers: { Authorization: `Bearer ${token}` } });
const body = await res.json();
const accounts = body.data || [];
const leaves = accounts.filter(a => !accounts.some(b => b.parentId === a.id));
for (const a of leaves) {
  console.log(`${a.glCode}\t${a.accountType?.name || a.accountTypeName || '?'}\t${a.accountLevel}\t${a.accountName}\tbal=${a.currentBalance}`);
}
console.log('total accounts:', accounts.length, 'leaves:', leaves.length);
