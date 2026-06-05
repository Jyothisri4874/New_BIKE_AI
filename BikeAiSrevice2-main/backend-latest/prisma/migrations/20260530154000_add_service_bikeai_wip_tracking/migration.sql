-- CreateTable
CREATE TABLE `service_bikeai_customer_vehicle_tracking` (
    `id` VARCHAR(191) NOT NULL,
    `service_center_id` VARCHAR(191) NOT NULL,
    `dealer_dms_job_no` VARCHAR(191) NOT NULL,
    `customer_name` VARCHAR(191) NOT NULL,
    `customer_mobile` VARCHAR(191) NOT NULL,
    `vehicle_number` VARCHAR(191) NOT NULL,
    `vehicle_model` VARCHAR(191) NULL,
    `service_type` VARCHAR(191) NOT NULL,
    `customer_complaint` TEXT NULL,
    `current_status` VARCHAR(191) NOT NULL DEFAULT 'received',
    `tracking_code` VARCHAR(191) NOT NULL,
    `tracking_url` TEXT NOT NULL,
    `qr_code_url` TEXT NULL,
    `pdf_url` TEXT NULL,
    `assigned_advisor_id` VARCHAR(191) NULL,
    `assigned_technician_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `service_bikeai_tracking_code_key`(`tracking_code`),
    UNIQUE INDEX `service_bikeai_center_dms_job_key`(`service_center_id`, `dealer_dms_job_no`),
    INDEX `service_bikeai_center_status_idx`(`service_center_id`, `current_status`),
    INDEX `service_bikeai_tracking_code_idx`(`tracking_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
