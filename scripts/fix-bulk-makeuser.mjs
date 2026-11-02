import fs from 'fs';

let code = fs.readFileSync('tests/api/donors-bulk-delete.test.ts', 'utf8');
code = code.replace(/\r\n/g, '\n');

const targetFuncStart = '  async function makeUser(roleName: string) {';
const targetFuncEnd = '  async function makeDonors(count: number) {';

const funcIndex = code.indexOf(targetFuncStart);
const endIndex = code.indexOf(targetFuncEnd);

const newMakeUser = `  async function makeUser(roleName: string) {
    let role = await prisma.role.findFirst({
      where: { name: roleName }
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          name: roleName,
          description: \`\${roleName} test role\`,
          isPrivileged: roleName === 'Admin' || roleName === 'Super Admin'
        }
      });
    }
    if (roleName === 'Manager') {
      const perm = await prisma.permission.findFirst({ where: { name: 'MANAGE_DONORS' } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          create: { roleId: role.id, permissionId: perm.id },
          update: {}
        });
      }
    }
    return prisma.user.create({
      data: {
        email: \`test_bulkdelete_\${roleName.replace(/\\s+/g, '_').toLowerCase()}_\${Date.now()}@erp.com\`,
        password: 'hashed_password',
        fullName: \`Test \${roleName}\`,
        roleId: role.id,
        isActive: true,
      },
    });
  }

`;

code = code.slice(0, funcIndex) + newMakeUser + code.slice(endIndex);
fs.writeFileSync('tests/api/donors-bulk-delete.test.ts', code, 'utf8');
console.log('Updated makeUser in donors-bulk-delete.test.ts successfully');
