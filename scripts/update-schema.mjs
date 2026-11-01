import fs from 'fs';

const filePath = 'prisma/schema.prisma';
let code = fs.readFileSync(filePath, 'utf8');
code = code.replace(/\r\n/g, '\n');

// 1. Remove misplaced fields from Beneficiary
code = code.replace(
  /\n\s*membershipType\s+String\?[^\n]*\n\s*feeAmount\s+Float\?[^\n]*\n\s*startDate\s+String\?[^\n]*\n\s*expiryDate\s+String\?[^\n]*/,
  ''
);
code = code.replace(
  /\n\s*revenueCollections\s+RevenueCollection\[\]\s+@relation\("MemberRevenueCollections"\)/,
  ''
);

// 2. Add to Member
if (!code.includes('model Member {\n  id              String               @id @default(uuid()) @map("_id")\n  memberNo        String?              @unique\n  fullName        String\n  fatherName      String?\n  cnic            String?              @unique\n  dob             String?\n  address         String?\n  mobile          String?\n  email           String?\n  city            String?\n  area            String?\n  ghamName        String?\n  education       String?\n  profession      String?\n  company         String?\n  doi             String?\n  photoUrl        String?\n  cnicFrontUrl    String?\n  cnicBackUrl     String?\n  membershipType  String?')) {
  code = code.replace(
    '  cnicBackUrl     String?\n  isActive        Boolean              @default(true)',
    '  cnicBackUrl     String?\n  membershipType  String?              @default("Regular")\n  feeAmount       Float?               @default(500)\n  startDate       String?\n  expiryDate      String?\n  isActive        Boolean              @default(true)'
  );
  code = code.replace(
    '  zakatCards      ZakatCard[]\n  familyLinksFrom FamilyRelationship[]',
    '  revenueCollections RevenueCollection[] @relation("MemberRevenueCollections")\n  zakatCards      ZakatCard[]\n  familyLinksFrom FamilyRelationship[]'
  );
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully normalized and updated schema.prisma');
