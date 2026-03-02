-- AlterTable
ALTER TABLE "blacklist_users" ADD COLUMN     "village_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "blacklist_users_user_id_village_id_key" ON "blacklist_users"("user_id", "village_id");

-- AddForeignKey
ALTER TABLE "blacklist_users" ADD CONSTRAINT "blacklist_users_village_id_fkey" FOREIGN KEY ("village_id") REFERENCES "villages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
