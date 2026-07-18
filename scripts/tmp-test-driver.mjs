/* Accounting test driver: seeds known data via the real APIs, then validates
   every report + dashboard against independently computed expectations. */
const BASE = 'http://localhost:4000';
let TOKEN = '';
const results = [];
const check = (name, cond, detail = '') => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const near = (a, b, eps = 0.01) => Math.abs(a - b) < eps;

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

// ── Login ──
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@erp.com', password: 'admin123' }),
});
const lb = await login.json();
TOKEN = lb.accessToken || lb.token || lb.data?.accessToken || lb.data?.token;
if (!TOKEN) { console.error('LOGIN FAILED', JSON.stringify(lb).slice(0, 300)); process.exit(1); }
console.log('== Logged in as admin ==');

// Account codes
const CASH = '1010103', HBL = '1010102';
const accountsRes = await api('GET', '/api/v1/accounts');
const accById = {};
for (const a of accountsRes.body.data) accById[a.code] = a.id;
const HBL_ID = accById[HBL];

// ── Seed data ─────────────────────────────────────────────
// Membership fees via revenue-collections (real module flow)
const membershipFees = [
  { amount: 500,  pm: 'CASH', date: '2026-02-10' },
  { amount: 1200, pm: 'BANK', date: '2026-03-15' },
  { amount: 2500, pm: 'CASH', date: '2026-05-20' },
  { amount: 3800, pm: 'BANK', date: '2025-08-05' },
  { amount: 5000, pm: 'CASH', date: '2025-10-12' },
];
// Zakat receipts via revenue-collections
const zakats = [
  { amount: 10000, pm: 'CASH', date: '2026-01-15' },
  { amount: 25000, pm: 'BANK', date: '2025-09-01' },
  { amount: 15000, pm: 'CASH', date: '2026-04-10' },
];
// Other income via journal entries (BR)
const otherIncome = [
  { amount: 8000,  code: '3010101', pmCode: HBL,  date: '2026-06-01', name: 'Bagh-e-Hajiani Garden' },
  { amount: 12000, code: '3010102', pmCode: CASH, date: '2025-11-20', name: 'Sadaya Hall' },
];
// Expenses via journal entries (BP)
const expenses = [
  { amount: 20000, code: '4010101', pmCode: HBL,  date: '2026-01-31', name: 'Staff Salary' },
  { amount: 15000, code: '4040101', pmCode: CASH, date: '2026-02-01', name: 'Building Rent' },
  { amount: 3500,  code: '4040201', pmCode: HBL,  date: '2025-08-15', name: 'Rates & Taxes' },
  { amount: 4200,  code: '4050101', pmCode: CASH, date: '2025-09-10', name: 'Bus Repairs' },
  { amount: 2800,  code: '4050102', pmCode: CASH, date: '2026-03-05', name: 'Generator Repairs' },
  { amount: 7500,  code: '4050103', pmCode: HBL,  date: '2026-04-18', name: 'Hall Repairs' },
  { amount: 5000,  code: '4070101', pmCode: HBL,  date: '2025-12-01', name: 'Legal Fees' },
  { amount: 6000,  code: '4080102', pmCode: CASH, date: '2026-05-25', name: 'Security' },
  { amount: 1000,  code: '4080104', pmCode: CASH, date: '2025-10-30', name: 'Generator Fuel' },
  { amount: 2350,  code: '4080105', pmCode: CASH, date: '2026-06-15', name: 'Meeting Expenses' },
];

console.log('\n== Seeding income ==');
let i = 0;
for (const f of membershipFees) {
  const r = await api('POST', '/api/v1/revenue-collections', {
    category: 'Membership Fee', title: `Test Member ${++i}`, amount: f.amount,
    paymentMethod: f.pm, bankAccountId: f.pm === 'BANK' ? HBL_ID : undefined, eventDate: f.date,
  });
  check(`seed membership fee Rs ${f.amount} (${f.pm})`, r.status === 200 || r.status === 201, r.status !== 200 && r.status !== 201 ? JSON.stringify(r.body).slice(0, 150) : '');
}
i = 0;
for (const z of zakats) {
  const r = await api('POST', '/api/v1/revenue-collections', {
    category: 'Zakat', title: `Zakat Donor ${++i}`, amount: z.amount,
    paymentMethod: z.pm, bankAccountId: z.pm === 'BANK' ? HBL_ID : undefined, eventDate: z.date,
  });
  check(`seed zakat Rs ${z.amount} (${z.pm})`, r.status === 200 || r.status === 201, r.status !== 200 && r.status !== 201 ? JSON.stringify(r.body).slice(0, 150) : '');
}
for (const o of otherIncome) {
  const r = await api('POST', '/api/v1/journal-entries', {
    postingDate: o.date, reference: `Other income ${o.name}`, description: `Hall income ${o.name}`,
    status: 'Posted', voucherType: 'BR',
    lines: [
      { accountCode: o.pmCode, debit: o.amount, credit: 0 },
      { accountCode: o.code, debit: 0, credit: o.amount },
    ],
  });
  check(`seed other income Rs ${o.amount} (${o.name})`, r.status === 200 || r.status === 201, r.status >= 400 ? JSON.stringify(r.body).slice(0, 150) : '');
}

console.log('\n== Seeding expenses ==');
for (const e of expenses) {
  const r = await api('POST', '/api/v1/journal-entries', {
    postingDate: e.date, reference: `Expense ${e.name}`, description: `${e.name} payment`,
    status: 'Posted', voucherType: 'BP',
    lines: [
      { accountCode: e.code, debit: e.amount, credit: 0 },
      { accountCode: e.pmCode, debit: 0, credit: e.amount },
    ],
  });
  check(`seed expense Rs ${e.amount} (${e.name})`, r.status === 200 || r.status === 201, r.status >= 400 ? JSON.stringify(r.body).slice(0, 150) : '');
}

// ── Expected values ──
const EXP = {
  membership: 13000, zakat: 50000, other: 20000,
  totalRevenue: 83000, totalExpense: 67350, netIncome: 15650,
  cash: 13650, bank: 2000,
};

// ── Income Statement ──
console.log('\n== Income Statement ==');
const is1 = (await api('GET', '/api/v1/reports/income-statement')).body.data;
check('IS total revenue = 83,000', near(is1.summary.totalRevenue, EXP.totalRevenue), `got ${is1.summary.totalRevenue}`);
check('IS total expense = 67,350', near(is1.summary.totalExpense, EXP.totalExpense), `got ${is1.summary.totalExpense}`);
check('IS net income = 15,650', near(is1.summary.netIncome, EXP.netIncome), `got ${is1.summary.netIncome}`);
const memberLine = is1.revenues.find(r => r.accountName === 'Membership Fee');
check('IS Membership Fee line = 13,000', memberLine && near(memberLine.balance, EXP.membership), `got ${memberLine?.balance}`);
const zakatLine = is1.revenues.find(r => r.accountName.includes('Zakat'));
check('IS Zakat line = 50,000', zakatLine && near(zakatLine.balance, EXP.zakat), `got ${zakatLine?.balance}`);
const salaryLine = is1.expenses.find(r => r.accountName === 'Staff Salary');
check('IS Staff Salary line = 20,000', salaryLine && near(salaryLine.balance, 20000), `got ${salaryLine?.balance}`);

// ── Balance Sheet ──
console.log('\n== Balance Sheet ==');
const bs = (await api('GET', '/api/v1/reports/balance-sheet')).body.data;
check('BS total assets = 15,650', near(bs.summary.totalAssets, EXP.netIncome), `got ${bs.summary.totalAssets}`);
check('BS A = L + E (isBalanced)', bs.summary.isBalanced, `A=${bs.summary.totalAssets} L+E=${bs.summary.totalLiabilitiesAndEquity}`);
const cashLine = bs.assets.find(a => a.glCode === CASH);
check('BS Cash in Hand = 13,650', cashLine && near(cashLine.balance, EXP.cash), `got ${cashLine?.balance}`);
const hblLine = bs.assets.find(a => a.glCode === HBL);
check('BS HBL Bank = 2,000', hblLine && near(hblLine.balance, EXP.bank), `got ${hblLine?.balance}`);
check('BS equity includes net income 15,650', near(bs.summary.totalEquity, EXP.netIncome), `got ${bs.summary.totalEquity}`);

// ── Trial Balance ──
console.log('\n== Trial Balance ==');
const tb = (await api('GET', '/api/v1/reports/trial-balance')).body.data;
check('TB debits = credits (isBalanced)', tb.summary.isBalanced, `D=${tb.summary.totalDebit} C=${tb.summary.totalCredit}`);
check('TB total debit = 83,000', near(tb.summary.totalDebit, 83000), `got ${tb.summary.totalDebit}`);
const tbCash = tb.entries.find(e => e.glCode === CASH);
check('TB Cash debit = 13,650', tbCash && near(tbCash.debit, EXP.cash), `got ${tbCash?.debit}`);
const tbMember = tb.entries.find(e => e.accountName === 'Membership Fee');
check('TB Membership Fee credit = 13,000', tbMember && near(tbMember.credit, EXP.membership), `got ${tbMember?.credit}`);

// ── Cash Flow ──
console.log('\n== Cash Flow ==');
const cfRes = await api('GET', '/api/v1/reports/cash-flow');
if (cfRes.status === 200) {
  console.log('cash-flow raw:', JSON.stringify(cfRes.body.data?.summary ?? cfRes.body.data ?? cfRes.body).slice(0, 600));
} else {
  check('Cash Flow endpoint reachable', false, `status ${cfRes.status}`);
}

// ── General Ledger: Cash running balance ──
console.log('\n== General Ledger (Cash in Hand) ==');
const gl = (await api('GET', `/api/v1/general-ledger?glCode=${CASH}`)).body.data;
const glEntries = gl.entries || gl;
const cashTxns = Array.isArray(glEntries) ? glEntries : [];
let running = 0;
let sumD = 0, sumC = 0;
for (const e of cashTxns) { sumD += Number(e.debit) || 0; sumC += Number(e.credit) || 0; }
running = sumD - sumC;
check('GL Cash: sum(D)-sum(C) = 13,650', near(running, EXP.cash), `D=${sumD} C=${sumC} net=${running}`);
check('GL Cash: entry count = 12', cashTxns.length === 12, `got ${cashTxns.length}`);
// Date-filtered GL: 2026 only (opening balance should equal 2025 net cash)
const gl26 = (await api('GET', `/api/v1/general-ledger?glCode=${CASH}&startDate=2026-01-01&endDate=2026-12-31`)).body.data;
console.log('GL 2026 openingBalance for cash:', JSON.stringify(gl26.openingBalance ?? gl26.summary ?? {}).slice(0, 200));
// Expected 2025 cash net: +5000 (fee) +12000 (hall) -4200 -1000 = 11,800
if (gl26.openingBalance !== undefined) {
  check('GL Cash 2026 opening = 11,800 (2025 activity)', near(Number(gl26.openingBalance), 11800), `got ${gl26.openingBalance}`);
}

// ── Dashboard ──
console.log('\n== Dashboard ==');
const dash = (await api('GET', '/api/v1/dashboard/stats')).body.data;
check('Dash totalRevenue = 83,000', near(dash.summary.totalRevenue, EXP.totalRevenue), `got ${dash.summary.totalRevenue}`);
check('Dash totalExpense = 67,350', near(dash.summary.totalExpense, EXP.totalExpense), `got ${dash.summary.totalExpense}`);
check('Dash netIncome = 15,650', near(dash.summary.netIncome, EXP.netIncome), `got ${dash.summary.netIncome}`);
check('Dash cashBalance = 13,650', near(dash.summary.cashBalance, EXP.cash), `got ${dash.summary.cashBalance}`);
check('Dash bankBalance = 2,000', near(dash.summary.bankBalance, EXP.bank), `got ${dash.summary.bankBalance}`);
check('Dash accounting equation balanced', dash.summary.isEquationBalanced, JSON.stringify({ A: dash.summary.totalAssets, L: dash.summary.totalLiabilities, E: dash.summary.totalEquity, NI: dash.summary.netIncome }));

// ── Error conditions ──
console.log('\n== Error conditions ==');
const imb = await api('POST', '/api/v1/journal-entries', {
  postingDate: '2026-07-01', reference: 'Imbalanced test', status: 'Posted',
  lines: [
    { accountCode: '4010101', debit: 100, credit: 0 },
    { accountCode: CASH, debit: 0, credit: 50 },
  ],
});
check('Imbalanced JE rejected (4xx)', imb.status >= 400, `status ${imb.status}: ${JSON.stringify(imb.body?.error?.message ?? imb.body).slice(0, 120)}`);

const noAcc = await api('POST', '/api/v1/journal-entries', {
  postingDate: '2026-07-01', reference: 'Blank account test', status: 'Posted',
  lines: [
    { debit: 100, credit: 0 },
    { accountCode: CASH, debit: 0, credit: 100 },
  ],
});
check('JE with blank account rejected (4xx)', noAcc.status >= 400, `status ${noAcc.status}: ${JSON.stringify(noAcc.body?.error?.message ?? noAcc.body).slice(0, 120)}`);

const noLines = await api('POST', '/api/v1/journal-entries', { postingDate: '2026-07-01', reference: 'No lines', lines: [] });
check('JE with no lines rejected (4xx)', noLines.status >= 400, `status ${noLines.status}`);

// Confirm the failed postings did NOT corrupt balances
const dashAfterErr = (await api('GET', '/api/v1/dashboard/stats')).body.data;
check('Balances unchanged after rejected entries', near(dashAfterErr.summary.cashBalance, EXP.cash) && near(dashAfterErr.summary.totalExpense, EXP.totalExpense),
  `cash=${dashAfterErr.summary.cashBalance} exp=${dashAfterErr.summary.totalExpense}`);

// ── Live testing: post one cash income + one bank expense, verify deltas everywhere ──
console.log('\n== Live testing ==');
const live1 = await api('POST', '/api/v1/revenue-collections', {
  category: 'Membership Fee', title: 'Live Test Member', amount: 1000, paymentMethod: 'CASH', eventDate: '2026-07-18',
});
check('live membership fee Rs 1,000 cash posted', live1.status === 200 || live1.status === 201, JSON.stringify(live1.body?.error ?? '').slice(0, 100));

const live2 = await api('POST', '/api/v1/journal-entries', {
  postingDate: '2026-07-18', reference: 'Live bank charges', description: 'Bank charges live test',
  status: 'Posted', voucherType: 'BP',
  lines: [
    { accountCode: '4080103', debit: 500, credit: 0 },
    { accountCode: HBL, debit: 0, credit: 500 },
  ],
});
check('live bank charges Rs 500 bank posted', live2.status === 200 || live2.status === 201, JSON.stringify(live2.body?.error ?? '').slice(0, 100));

const dash2 = (await api('GET', '/api/v1/dashboard/stats')).body.data;
check('Dash live: revenue 83,000 → 84,000', near(dash2.summary.totalRevenue, 84000), `got ${dash2.summary.totalRevenue}`);
check('Dash live: expense 67,350 → 67,850', near(dash2.summary.totalExpense, 67850), `got ${dash2.summary.totalExpense}`);
check('Dash live: cash 13,650 → 14,650', near(dash2.summary.cashBalance, 14650), `got ${dash2.summary.cashBalance}`);
check('Dash live: bank 2,000 → 1,500', near(dash2.summary.bankBalance, 1500), `got ${dash2.summary.bankBalance}`);
check('Dash live: netIncome = 16,150', near(dash2.summary.netIncome, 16150), `got ${dash2.summary.netIncome}`);

const is2 = (await api('GET', '/api/v1/reports/income-statement')).body.data;
check('IS live matches dashboard', near(is2.summary.totalRevenue, dash2.summary.totalRevenue) && near(is2.summary.totalExpense, dash2.summary.totalExpense),
  `IS rev=${is2.summary.totalRevenue} exp=${is2.summary.totalExpense}`);
const bs2 = (await api('GET', '/api/v1/reports/balance-sheet')).body.data;
check('BS live still balanced', bs2.summary.isBalanced, `A=${bs2.summary.totalAssets} L+E=${bs2.summary.totalLiabilitiesAndEquity}`);
const memberLine2 = is2.revenues.find(r => r.accountName === 'Membership Fee');
check('IS live: Membership Fee line = 14,000', memberLine2 && near(memberLine2.balance, 14000), `got ${memberLine2?.balance}`);
const bankChargesLine = is2.expenses.find(r => r.accountName === 'Bank Charges');
check('IS live: Bank Charges line appears = 500', bankChargesLine && near(bankChargesLine.balance, 500), `got ${bankChargesLine?.balance}`);
const tb2 = (await api('GET', '/api/v1/reports/trial-balance')).body.data;
check('TB live still balanced', tb2.summary.isBalanced, `D=${tb2.summary.totalDebit} C=${tb2.summary.totalCredit}`);

// ── Summary ──
const fails = results.filter(r => !r.pass);
console.log(`\n===== ${results.length - fails.length}/${results.length} checks passed =====`);
if (fails.length) {
  console.log('FAILURES:');
  for (const f of fails) console.log(` - ${f.name}: ${f.detail}`);
}
