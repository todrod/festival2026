-- AlterTable
ALTER TABLE `Volunteer`
  ADD COLUMN `status` ENUM('PENDING','VERIFIED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `verificationMethod` ENUM('EMAIL','SMS') NOT NULL DEFAULT 'EMAIL',
  ADD COLUMN `verifiedAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `OtpChallenge` (
  `id` VARCHAR(191) NOT NULL,
  `volunteerId` VARCHAR(191) NOT NULL,
  `method` ENUM('EMAIL','SMS') NOT NULL,
  `destination` VARCHAR(191) NOT NULL,
  `codeHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `consumedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `OtpChallenge_volunteerId_createdAt_idx`(`volunteerId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OtpChallenge`
  ADD CONSTRAINT `OtpChallenge_volunteerId_fkey`
  FOREIGN KEY (`volunteerId`) REFERENCES `Volunteer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
