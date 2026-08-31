async function test() {
  try {
    const res = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@erp.com', password: 'admin123' })
    });
    const data = await res.json();
    console.log('HTTP Status:', res.status);
    console.log('Login Response:', JSON.stringify(data, null, 2));

    if (data.data?.accessToken) {
      const meRes = await fetch('http://localhost:4000/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${data.data.accessToken}` }
      });
      const meData = await meRes.json();
      console.log('Me HTTP Status:', meRes.status);
      console.log('Me Response User:', meData.data?.user);
      console.log('Me Response Role:', meData.data?.role);
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}

test();
