/*
  Warnings:

  - You are about to drop the column `seat` on the `Booking` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "seat",
ADD COLUMN     "amount" INTEGER,
ADD COLUMN     "paymentIntentId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PENDING';
