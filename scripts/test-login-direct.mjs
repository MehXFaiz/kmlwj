import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

import * as authService from '../api/_services/auth.service.js';

async function testLogin() {
  try {
    const result = await authService.login({
      email: 'admin@erp.com',
      password: 'admin123',
    });
    console.log('Login succeeded! Access Token:', !!result.accessToken, 'User:', result.user);
  } catch (err) {
    console.error('Login error:', err);
  }
}

testLogin();
