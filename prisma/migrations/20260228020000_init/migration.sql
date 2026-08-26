-- CreateTable
CREATE TABLE `Volunteer` (
    `id` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `dob` DATETIME(3) NOT NULL,
    `ageConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `emergencyContactName` VARCHAR(191) NOT NULL,
    `emergencyContactPhone` VARCHAR(191) NOT NULL,
    `gender` ENUM('FEMALE', 'MALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY') NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'English',
    `textOk` BOOLEAN NOT NULL DEFAULT false,
    `emailOk` BOOLEAN NOT NULL DEFAULT true,
    `yearsExperience` INTEGER NOT NULL DEFAULT 0,
    `willingAnyBoothDay` BOOLEAN NOT NULL DEFAULT false,
    `willingAnyBoothNight` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Volunteer_lastName_firstName_idx`(`lastName`, `firstName`),
    UNIQUE INDEX `Volunteer_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VolunteerAcknowledgement` (
    `id` VARCHAR(191) NOT NULL,
    `volunteerId` VARCHAR(191) NOT NULL,
    `age18Plus` BOOLEAN NOT NULL,
    `standingWalking` BOOLEAN NOT NULL,
    `heavyLift50` BOOLEAN NOT NULL,
    `cashHandling` BOOLEAN NOT NULL,
    `outdoorSun` BOOLEAN NOT NULL,
    `liabilityAcknowledged` BOOLEAN NOT NULL,
    `foodRulesAcknowledged` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `VolunteerAcknowledgement_volunteerId_key`(`volunteerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Event` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shift` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `shiftType` ENUM('BOOTH_DAY', 'BOOTH_NIGHT', 'HALL_EARLY_SETUP', 'HALL_BERRY_HULLERS', 'HALL_BERRY_PRODUCTION', 'HALL_UNIFORMS_AM', 'HALL_UNIFORMS_PM', 'HALL_HEAVY_HALL', 'HALL_BUCKET_WASHERS', 'HALL_DRIVERS') NOT NULL,
    `module` ENUM('BOOTH', 'HALL') NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `arrivalAt` DATETIME(3) NULL,
    `conflictStartAt` DATETIME(3) NOT NULL,
    `conflictEndAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Shift_date_module_idx`(`date`, `module`),
    UNIQUE INDEX `Shift_date_shiftType_key`(`date`, `shiftType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `module` ENUM('BOOTH', 'HALL') NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `requiresStanding` BOOLEAN NOT NULL DEFAULT false,
    `requiresHeavyLift` BOOLEAN NOT NULL DEFAULT false,
    `requiresCash` BOOLEAN NOT NULL DEFAULT false,
    `requiresOutdoor` BOOLEAN NOT NULL DEFAULT false,
    `requiresTraining` BOOLEAN NOT NULL DEFAULT false,
    `requiresApproval` BOOLEAN NOT NULL DEFAULT false,
    `requiredGender` ENUM('FEMALE', 'MALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY') NULL,
    `manualOnly` BOOLEAN NOT NULL DEFAULT false,
    `isRelief` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `Role_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Availability` (
    `id` VARCHAR(191) NOT NULL,
    `volunteerId` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Availability_shiftId_idx`(`shiftId`),
    UNIQUE INDEX `Availability_volunteerId_shiftId_key`(`volunteerId`, `shiftId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Preference` (
    `id` VARCHAR(191) NOT NULL,
    `volunteerId` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `rank` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Preference_shiftId_roleId_idx`(`shiftId`, `roleId`),
    UNIQUE INDEX `Preference_volunteerId_shiftId_roleId_key`(`volunteerId`, `shiftId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Training` (
    `id` VARCHAR(191) NOT NULL,
    `volunteerId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `trained` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Training_volunteerId_roleId_key`(`volunteerId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Approval` (
    `id` VARCHAR(191) NOT NULL,
    `volunteerId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `approved` BOOLEAN NOT NULL DEFAULT false,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Approval_volunteerId_roleId_key`(`volunteerId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Assignment` (
    `id` VARCHAR(191) NOT NULL,
    `volunteerId` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `source` ENUM('AUTO', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `forceAssigned` BOOLEAN NOT NULL DEFAULT false,
    `overrideReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Assignment_shiftId_roleId_idx`(`shiftId`, `roleId`),
    INDEX `Assignment_volunteerId_idx`(`volunteerId`),
    UNIQUE INDEX `Assignment_volunteerId_shiftId_roleId_key`(`volunteerId`, `shiftId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoleTarget` (
    `id` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `target` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RoleTarget_shiftId_roleId_key`(`shiftId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VolunteerAcknowledgement` ADD CONSTRAINT `VolunteerAcknowledgement_volunteerId_fkey` FOREIGN KEY (`volunteerId`) REFERENCES `Volunteer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shift` ADD CONSTRAINT `Shift_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Availability` ADD CONSTRAINT `Availability_volunteerId_fkey` FOREIGN KEY (`volunteerId`) REFERENCES `Volunteer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Availability` ADD CONSTRAINT `Availability_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `Shift`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Preference` ADD CONSTRAINT `Preference_volunteerId_fkey` FOREIGN KEY (`volunteerId`) REFERENCES `Volunteer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Preference` ADD CONSTRAINT `Preference_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `Shift`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Preference` ADD CONSTRAINT `Preference_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Training` ADD CONSTRAINT `Training_volunteerId_fkey` FOREIGN KEY (`volunteerId`) REFERENCES `Volunteer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Training` ADD CONSTRAINT `Training_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval` ADD CONSTRAINT `Approval_volunteerId_fkey` FOREIGN KEY (`volunteerId`) REFERENCES `Volunteer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Approval` ADD CONSTRAINT `Approval_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assignment` ADD CONSTRAINT `Assignment_volunteerId_fkey` FOREIGN KEY (`volunteerId`) REFERENCES `Volunteer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assignment` ADD CONSTRAINT `Assignment_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `Shift`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assignment` ADD CONSTRAINT `Assignment_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoleTarget` ADD CONSTRAINT `RoleTarget_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `Shift`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoleTarget` ADD CONSTRAINT `RoleTarget_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

