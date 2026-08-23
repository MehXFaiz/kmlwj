-- AlterTable
ALTER TABLE "Role" ADD COLUMN "isPrivileged" BOOLEAN NOT NULL DEFAULT false;

-- Mark Super Admin and Admin as privileged
UPDATE "Role" SET "isPrivileged" = true WHERE name IN ('Super Admin', 'Admin');
