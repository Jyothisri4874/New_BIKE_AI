-- CreateTable
CREATE TABLE `ChatBackupSession` (
    `id` VARCHAR(191) NOT NULL,
    `sessionKey` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `chatbotType` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChatBackupSession_sessionKey_key`(`sessionKey`),
    INDEX `ChatBackupSession_source_chatbotType_idx`(`source`, `chatbotType`),
    INDEX `ChatBackupSession_userId_idx`(`userId`),
    INDEX `ChatBackupSession_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatBackupMessage` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `sender` ENUM('user', 'assistant') NOT NULL,
    `message` TEXT NOT NULL,
    `location` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatBackupMessage_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ChatBackupMessage` ADD CONSTRAINT `ChatBackupMessage_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `ChatBackupSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
