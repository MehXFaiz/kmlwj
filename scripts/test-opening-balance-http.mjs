async function test() {
  try {
    // 1. Login
    const loginRes = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@erp.com', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.data?.accessToken;
    console.log('Login status:', loginRes.status, 'Token acquired:', !!token);

    if (!token) return;

    // 2. Fetch Opening Balances
    const obRes = await fetch('http://localhost:4000/api/v1/opening-balances?financialYear=FY%202026-2027', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const obData = await obRes.json();
    console.log('Opening Balances Status:', obRes.status);
    console.log('Opening Balances Batch Status:', obData.data?.batch?.status);
    console.log('Opening Balances Total Lines:', obData.data?.batch?.lines?.length);
    console.log('Accounts Available:', obData.data?.accounts?.length);

    // 3. Fetch Accounts
    const accRes = await fetch('http://localhost:4000/api/v1/accounts', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const accData = await accRes.json();
    console.log('Accounts API Status:', accRes.status, 'Total Accounts:', accData.data?.length);
  } catch (err) {
    console.error('Test error:', err);
  }
}

test();
