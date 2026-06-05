import crypto from "crypto";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

type TrackingRecord = Awaited<ReturnType<typeof prisma.serviceBikeaiCustomerVehicleTracking.findUnique>>;

export interface CreateWipTrackingInput {
  service_center_id: string;
  dealer_dms_job_no: string;
  customer_name: string;
  customer_mobile: string;
  vehicle_number: string;
  vehicle_model?: string;
  service_type: string;
  customer_complaint?: string;
  current_status?: string;
  tracking_code?: string;
  tracking_url?: string;
  qr_code_url?: string;
  pdf_url?: string;
  assigned_advisor_id?: string;
  assigned_technician_id?: string;
}

function generateTrackingCode() {
  return `wip_${crypto.randomBytes(18).toString("hex")}`;
}

function buildQrCodeUrl(trackingUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(trackingUrl)}`;
}

function normalize(record: NonNullable<TrackingRecord>) {
  return {
    id: record.id,
    service_center_id: record.serviceCenterId,
    dealer_dms_job_no: record.dealerDmsJobNo,
    customer_name: record.customerName,
    customer_mobile: record.customerMobile,
    vehicle_number: record.vehicleNumber,
    vehicle_model: record.vehicleModel,
    service_type: record.serviceType,
    customer_complaint: record.customerComplaint,
    current_status: record.currentStatus,
    tracking_code: record.trackingCode,
    tracking_url: record.trackingUrl,
    qr_code_url: record.qrCodeUrl,
    pdf_url: record.pdfUrl,
    assigned_advisor_id: record.assignedAdvisorId,
    assigned_technician_id: record.assignedTechnicianId,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export const WipTrackingService = {
  async create(input: CreateWipTrackingInput, apiBaseUrl: string) {
    const trackingCode = input.tracking_code || generateTrackingCode();
    const trackingUrl = input.tracking_url || `${apiBaseUrl}/api/service/track/${trackingCode}`;
    const qrCodeUrl = input.qr_code_url || buildQrCodeUrl(trackingUrl);

    try {
      const record = await prisma.serviceBikeaiCustomerVehicleTracking.create({
        data: {
          serviceCenterId: input.service_center_id,
          dealerDmsJobNo: input.dealer_dms_job_no,
          customerName: input.customer_name,
          customerMobile: input.customer_mobile,
          vehicleNumber: input.vehicle_number,
          vehicleModel: input.vehicle_model,
          serviceType: input.service_type,
          customerComplaint: input.customer_complaint,
          currentStatus: input.current_status || "received",
          trackingCode,
          trackingUrl,
          qrCodeUrl,
          pdfUrl: input.pdf_url,
          assignedAdvisorId: input.assigned_advisor_id,
          assignedTechnicianId: input.assigned_technician_id,
        },
      });
      return normalize(record);
    } catch (err: any) {
      if (err?.code === "P2002") throw ApiError.conflict("Tracking record already exists");
      throw err;
    }
  },

  async getById(id: string) {
    const record = await prisma.serviceBikeaiCustomerVehicleTracking.findUnique({ where: { id } });
    if (!record) throw ApiError.notFound("WIP tracking record");
    return normalize(record);
  },

  async getByTrackingCode(trackingCode: string) {
    const record = await prisma.serviceBikeaiCustomerVehicleTracking.findUnique({
      where: { trackingCode },
    });
    if (!record) throw ApiError.notFound("Tracking record");
    return normalize(record);
  },
};
