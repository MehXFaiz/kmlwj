import fs from 'fs';

let code = fs.readFileSync('api/_v1/auth/me.ts', 'utf8');
code = code.replace(/\r\n/g, '\n');

code = code.replace(
  'permissions: structuredPermissions,\n      rawPermissions: Array.from(permissionSet),',
  'permissions: Array.from(permissionSet),\n      structuredPermissions,\n      rawPermissions: Array.from(permissionSet),'
);

fs.writeFileSync('api/_v1/auth/me.ts', code, 'utf8');
console.log('Successfully updated api/_v1/auth/me.ts permissions field');
