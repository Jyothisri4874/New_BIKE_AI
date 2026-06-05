-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NULL,
    `fullName` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `role` ENUM('admin', 'dealer', 'customer', 'technician', 'service_advisor', 'crm_executive') NOT NULL DEFAULT 'customer',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `staffOfDealerId` VARCHAR(191) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_phone_key`(`phone`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_staffOfDealerId_idx`(`staffOfDealerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Dealer` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` TEXT NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `gstNumber` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `logoUrl` VARCHAR(191) NULL,
    `status` ENUM('pending', 'active', 'suspended', 'rejected') NOT NULL DEFAULT 'pending',
    `rating` DOUBLE NOT NULL DEFAULT 0,
    `totalReviews` INTEGER NOT NULL DEFAULT 0,
    `brands` JSON NULL,
    `services` JSON NULL,
    `openTime` VARCHAR(191) NULL,
    `closeTime` VARCHAR(191) NULL,
    `lat` DOUBLE NULL,
    `lng` DOUBLE NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `workshopType` VARCHAR(191) NULL,
    `isEvCapable` BOOLEAN NOT NULL DEFAULT false,
    `isRsaEnabled` BOOLEAN NOT NULL DEFAULT false,
    `isPickupEnabled` BOOLEAN NOT NULL DEFAULT false,
    `isExpressCenter` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Dealer_city_idx`(`city`),
    INDEX `Dealer_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `preferredDealerId` VARCHAR(191) NULL,
    `loyaltyScore` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Customer_userId_key`(`userId`),
    INDEX `Customer_phone_idx`(`phone`),
    INDEX `Customer_preferredDealerId_idx`(`preferredDealerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VehicleOem` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `logoUrl` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `VehicleOem_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VehicleModel` (
    `id` VARCHAR(191) NOT NULL,
    `oemId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `segment` VARCHAR(191) NULL,
    `fuelType` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `VehicleModel_oemId_name_key`(`oemId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VehicleVariant` (
    `id` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `year` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `VehicleVariant_modelId_name_year_key`(`modelId`, `name`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vehicle` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `oemId` VARCHAR(191) NULL,
    `modelId` VARCHAR(191) NULL,
    `variantId` VARCHAR(191) NULL,
    `registrationNo` VARCHAR(191) NULL,
    `chassisNo` VARCHAR(191) NULL,
    `engineNo` VARCHAR(191) NULL,
    `manufactureYear` INTEGER NULL,
    `fuelType` VARCHAR(191) NULL,
    `colour` VARCHAR(191) NULL,
    `odometerKm` INTEGER NULL,
    `insuranceExpiry` DATETIME(3) NULL,
    `pucExpiry` DATETIME(3) NULL,
    `amcExpiry` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Vehicle_registrationNo_key`(`registrationNo`),
    INDEX `Vehicle_customerId_idx`(`customerId`),
    INDEX `Vehicle_registrationNo_idx`(`registrationNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Booking` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `dealerId` VARCHAR(191) NOT NULL,
    `vehicleId` VARCHAR(191) NULL,
    `serviceType` VARCHAR(191) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `status` ENUM('pending', 'confirmed', 'in_progress', 'ready_for_delivery', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
    `notes` TEXT NULL,
    `reportedIssues` JSON NULL,
    `estimatedCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `finalCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Booking_dealerId_status_idx`(`dealerId`, `status`),
    INDEX `Booking_customerId_idx`(`customerId`),
    INDEX `Booking_scheduledAt_idx`(`scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BookingTimeline` (
    `id` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `actorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BookingTimeline_bookingId_idx`(`bookingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JobCard` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `bookingId` VARCHAR(191) NULL,
    `dealerId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `vehicleId` VARCHAR(191) NOT NULL,
    `advisorId` VARCHAR(191) NULL,
    `technicianId` VARCHAR(191) NULL,
    `status` ENUM('open', 'in_progress', 'qc', 'ready', 'delivered', 'cancelled') NOT NULL DEFAULT 'open',
    `priority` INTEGER NOT NULL DEFAULT 3,
    `odometerKm` INTEGER NULL,
    `fuelLevel` VARCHAR(191) NULL,
    `complaint` TEXT NULL,
    `estimateTotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `estimatedReady` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `JobCard_number_key`(`number`),
    UNIQUE INDEX `JobCard_bookingId_key`(`bookingId`),
    INDEX `JobCard_dealerId_status_idx`(`dealerId`, `status`),
    INDEX `JobCard_customerId_idx`(`customerId`),
    INDEX `JobCard_technicianId_idx`(`technicianId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JobCardItem` (
    `id` VARCHAR(191) NOT NULL,
    `jobCardId` VARCHAR(191) NOT NULL,
    `kind` ENUM('labour', 'part') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `partNumber` VARCHAR(191) NULL,
    `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JobCardItem_jobCardId_idx`(`jobCardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdditionalWorkApproval` (
    `id` VARCHAR(191) NOT NULL,
    `jobCardId` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `estimate` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `mediaUrls` JSON NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'expired') NOT NULL DEFAULT 'pending',
    `channel` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdditionalWorkApproval_jobCardId_idx`(`jobCardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `jobCardId` VARCHAR(191) NULL,
    `dealerId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `status` ENUM('draft', 'issued', 'paid', 'void') NOT NULL DEFAULT 'draft',
    `issuedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Invoice_number_key`(`number`),
    UNIQUE INDEX `Invoice_jobCardId_key`(`jobCardId`),
    INDEX `Invoice_dealerId_status_idx`(`dealerId`, `status`),
    INDEX `Invoice_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `method` ENUM('cash', 'upi', 'card', 'wallet', 'bank') NOT NULL,
    `reference` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Payment_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_staffOfDealerId_fkey` FOREIGN KEY (`staffOfDealerId`) REFERENCES `Dealer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Dealer` ADD CONSTRAINT `Dealer_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_preferredDealerId_fkey` FOREIGN KEY (`preferredDealerId`) REFERENCES `Dealer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleModel` ADD CONSTRAINT `VehicleModel_oemId_fkey` FOREIGN KEY (`oemId`) REFERENCES `VehicleOem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VehicleVariant` ADD CONSTRAINT `VehicleVariant_modelId_fkey` FOREIGN KEY (`modelId`) REFERENCES `VehicleModel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vehicle` ADD CONSTRAINT `Vehicle_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_dealerId_fkey` FOREIGN KEY (`dealerId`) REFERENCES `Dealer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingTimeline` ADD CONSTRAINT `BookingTimeline_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JobCard` ADD CONSTRAINT `JobCard_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JobCard` ADD CONSTRAINT `JobCard_dealerId_fkey` FOREIGN KEY (`dealerId`) REFERENCES `Dealer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JobCard` ADD CONSTRAINT `JobCard_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JobCard` ADD CONSTRAINT `JobCard_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `Vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JobCard` ADD CONSTRAINT `JobCard_advisorId_fkey` FOREIGN KEY (`advisorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JobCard` ADD CONSTRAINT `JobCard_technicianId_fkey` FOREIGN KEY (`technicianId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JobCardItem` ADD CONSTRAINT `JobCardItem_jobCardId_fkey` FOREIGN KEY (`jobCardId`) REFERENCES `JobCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdditionalWorkApproval` ADD CONSTRAINT `AdditionalWorkApproval_jobCardId_fkey` FOREIGN KEY (`jobCardId`) REFERENCES `JobCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_jobCardId_fkey` FOREIGN KEY (`jobCardId`) REFERENCES `JobCard`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_dealerId_fkey` FOREIGN KEY (`dealerId`) REFERENCES `Dealer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
