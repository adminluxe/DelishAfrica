/*
  Warnings:

  - A unique constraint covering the columns `[merchantId,name]` on the table `MenuItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_merchantId_name_key" ON "MenuItem"("merchantId", "name");
