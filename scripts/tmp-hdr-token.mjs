// TEMPORARY — mints a dev token to view the header in the browser preview.
import dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const u = await prisma.user.findFirst({ where: { role: { name: { in: ['Super Admin', 'Admin'] } } }, include: { role: true } });
console.log('RESULT ' + jwt.sign({ sub: u.id, email: u.email, role: u.role.name }, process.env.JWT_SECRET, { expiresIn: '1h' }));
await prisma.$disconnect();
