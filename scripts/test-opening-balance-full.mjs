async function test() {
  const loginRes = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@erp.com', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;

  const obRes = await fetch('http://localhost:4000/api/v1/opening-balances?financialYear=FY%202026-2027', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const obData = await obRes.json();
  console.log('HTTP Status:', obRes.status);
  console.log('Opening balances data:', JSON.stringify(obData, null, 2));
}

test();
