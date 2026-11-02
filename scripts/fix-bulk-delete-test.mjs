import fs from 'fs';

let code = fs.readFileSync('tests/api/donors-bulk-delete.test.ts', 'utf8');
code = code.replace(/\r\n/g, '\n');

const oldMakeUser = `  async function makeUser(roleName: string) {
    const role = await prisma.role.findFirst({ where: { name: roleName } });
    if (!role) throw new Error(\`Seeded role "\${roleName}" not found — run prisma db seed first.\`);
    return prisma.user.create({
      data: {
        email: \`test_bulkdelete_\${roleName.replace(/\\s+/g, '_').toLowerCase()}_\${Date.now()}@erp.com\`,
        password: 'hashed_password',
        fullName: \`Test \${roleName}\`,
        roleId: role.id,
        isActive: true,
      },
    });
  }`;

const newMakeUser = `  async function makeUser(roleName: string) {
    let role = await prisma.role.findFirst({
      where: { name: { in: [roleName, \`\${roleName} Role\`, 'Donation and Zakat Manager'], mode: 'insensitive' } }
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          name: roleName,
          description: \`\${roleName} test role\`,
          isPrivileged: roleName.toLowerCase().includes('admin')
        }
      });
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
  }`;

code = code.replace(oldMakeUser, newMakeUser);
fs.writeFileSync('tests/api/donors-bulk-delete.test.ts', code, 'utf8');
console.log('Updated makeUser in donors-bulk-delete.test.ts');
