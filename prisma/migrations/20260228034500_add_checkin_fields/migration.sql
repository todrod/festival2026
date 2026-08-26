-- AlterTable
ALTER TABLE `Assignment`
  ADD COLUMN `checkedInAt` DATETIME(3) NULL,
  ADD COLUMN `noShow` BOOLEAN NOT NULL DEFAULT false;
