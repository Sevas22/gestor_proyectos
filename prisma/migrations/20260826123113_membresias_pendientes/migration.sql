-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE');

-- DropIndex
DROP INDEX "Membership_orgId_idx";

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Membership_orgId_status_idx" ON "Membership"("orgId", "status");


-- Backfill: las membresías que ya existían son de gente que estaba dentro
-- antes de que existiera la aprobación, así que quedan ACTIVE.
-- Sin esto, el DEFAULT 'PENDING' dejaría a todo el equipo — administradores
-- incluidos — fuera de su propia organización.
UPDATE "Membership" SET "status" = 'ACTIVE';
