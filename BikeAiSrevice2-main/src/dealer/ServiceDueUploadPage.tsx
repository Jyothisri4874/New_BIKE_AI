import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { WorkBook } from 'xlsx'
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Database,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Save,
  ShieldCheck,
  Table2,
  Upload,
  XCircle,
} from 'lucide-react'
import { api, safeGet } from '../lib/api'
import { useDealerAuth } from '../hooks/useDealerAuth'
import { resolveDealerServiceCenter } from './resolveDealerServiceCenter'

type SystemFieldKey =
  | 'customer_name'
  | 'mobile_number'
  | 'vehicle_number'
  | 'oem_brand'
  | 'vehicle_model'
  | 'date_of_sale'
  | 'current_km'
  | 'service_type'
  | 'service_center_id'
  | 'whatsapp_consent'
  | 'sms_consent'
  | 'alternate_number'
  | 'email'
  | 'city'
  | 'area_pincode'
  | 'preferred_language'
  | 'fuel_type'
  | 'chassis_number'
  | 'engine_number'
  | 'last_service_date'
  | 'last_service_km'
  | 'service_advisor'
  | 'branch_name'
  | 'crm_notes'
  | 'preferred_channel'

interface SystemField {
  key: SystemFieldKey
  label: string
  required: boolean
}

interface DealerCenter {
  id: string
  name: string
  city: string
  state?: string | null
  pincode?: string | null
}

interface OEM {
  id: string
  name: string
}

interface VehicleModel {
  id: string
  name: string
  oem_id: string
}

interface ServiceIntervalRule {
  id: string
  service_center_id: string
  service_type: string
  rule_type: string
  interval_days: number | null
  interval_km: number | null
  is_active: boolean
}

type VehicleServiceType = 'free' | 'paid' | 'periodic'

interface ImportedServiceType {
  label: string
  vehicleServiceType: VehicleServiceType
  bookingServiceType: 'free_service' | 'paid_service' | 'general_service'
  ruleTypes: string[]
}

interface ImportTemplate {
  id: string
  service_center_id: string
  name: string
  source_label: string | null
  sheet_name: string | null
  header_signature: string
  mapping: ColumnMapping | null
}

interface SourceRow {
  rowNumber: number
  cells: Record<string, string>
}

interface ParsedImportData {
  serviceCenterId: string
  serviceCenterName: string
  serviceCenterCity: string
  serviceCenterPincode: string
  customerName: string
  mobileNumber: string
  alternateNumber: string
  email: string
  city: string
  areaOrPincode: string
  preferredLanguage: string
  preferredChannel: string
  vehicleNumber: string
  oemId: string
  oemName: string
  modelId: string
  modelName: string
  dateOfSale: string
  currentKm: number
  serviceType: VehicleServiceType
  serviceTypeLabel: string
  whatsappConsent: boolean
  smsConsent: boolean
  fuelType: string
  chassisNumber: string
  engineNumber: string
  lastServiceDate: string | null
  lastServiceKm: number | null
  serviceAdvisor: string
  branchName: string
  crmNotes: string
  intervalDays: number
  intervalKm: number
  nextServiceDate: string
  nextServiceKm: number
}

interface ValidatedRow {
  source: SourceRow
  values: Partial<Record<SystemFieldKey, string>>
  status: 'valid' | 'failed'
  reasons: string[]
  data: ParsedImportData | null
}

interface ExistingCustomer {
  id: string
  full_name: string
  phone: string
  whatsapp_number: string | null
  alternate_phone?: string | null
  email: string | null
  city: string | null
  pincode: string | null
  area?: string | null
  preferred_center_id?: string | null
  customer_notes: string | null
}

interface ExistingVehicle {
  id: string
  customer_id: string
  registration_number: string
}

interface ImportSummary {
  totalRows: number
  validRows: number
  failedRows: number
  customersCreated: number
  customersUpdated: number
  vehiclesCreated: number
  vehiclesUpdated: number
  remindersGenerated: number
  queuedNotifications: number
}

type ColumnMapping = Partial<Record<string, SystemFieldKey>>
type XlsxModule = typeof import('xlsx')

const SYSTEM_FIELDS: SystemField[] = [
  { key: 'customer_name', label: 'Customer Name', required: true },
  { key: 'mobile_number', label: 'Mobile Number', required: true },
  { key: 'vehicle_number', label: 'Vehicle Number', required: true },
  { key: 'oem_brand', label: 'OEM / Brand', required: true },
  { key: 'vehicle_model', label: 'Vehicle Model', required: true },
  { key: 'date_of_sale', label: 'Date of Sale', required: true },
  { key: 'current_km', label: 'Current KM', required: true },
  { key: 'service_type', label: 'Service Type', required: true },
  { key: 'service_center_id', label: 'Service Center ID', required: false },
  { key: 'whatsapp_consent', label: 'WhatsApp Consent', required: true },
  { key: 'sms_consent', label: 'SMS Consent', required: true },
  { key: 'alternate_number', label: 'Alternate Number', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'area_pincode', label: 'Area/Pincode', required: false },
  { key: 'preferred_language', label: 'Preferred Language', required: false },
  { key: 'fuel_type', label: 'Fuel Type', required: false },
  { key: 'chassis_number', label: 'Chassis Number', required: false },
  { key: 'engine_number', label: 'Engine Number', required: false },
  { key: 'last_service_date', label: 'Last Service Date', required: false },
  { key: 'last_service_km', label: 'Last Service KM', required: false },
  { key: 'service_advisor', label: 'Service Advisor', required: false },
  { key: 'branch_name', label: 'Branch Name', required: false },
  { key: 'crm_notes', label: 'CRM Notes', required: false },
  { key: 'preferred_channel', label: 'Preferred Channel', required: false },
]

const HEADER_ALIASES: Record<SystemFieldKey, string[]> = {
  customer_name: ['cust name', 'customer', 'customer name', 'name', 'owner name', 'custname'],
  mobile_number: ['mobile', 'mobile no', 'mobile number', 'phone', 'phone no', 'phone number', 'contact', 'contact no', 'contact number'],
  vehicle_number: ['vehicle no', 'vehicle number', 'reg no', 'registration no', 'registration number', 'number plate', 'vehicle registration'],
  oem_brand: ['oem', 'brand', 'make', 'manufacturer', 'vehicle brand', 'company'],
  vehicle_model: ['model', 'vehicle', 'vehicle model', 'bike model', 'variant', 'product'],
  date_of_sale: ['sale dt', 'sale date', 'date of sale', 'retail date', 'invoice date', 'purchase date', 'sold date'],
  current_km: ['current km', 'km', 'odometer', 'odometer km', 'odo', 'running km', 'current odometer'],
  service_type: ['service type', 'service', 'service no', 'service number', 'service category', 'due service', 'free service', 'paid service'],
  service_center_id: ['service center id', 'workshop id', 'dealer id', 'branch id', 'center id'],
  whatsapp_consent: ['whatsapp consent', 'wa consent', 'whatsapp opt in', 'whatsapp opt-in', 'wa opt in'],
  sms_consent: ['sms consent', 'sms opt in', 'sms opt-in'],
  alternate_number: ['alternate number', 'alt number', 'alternate mobile', 'secondary mobile'],
  email: ['email', 'email id', 'mail'],
  city: ['city', 'town'],
  area_pincode: ['area', 'pincode', 'pin code', 'zip', 'area pincode'],
  preferred_language: ['language', 'preferred language', 'customer language'],
  fuel_type: ['fuel', 'fuel type'],
  chassis_number: ['chassis', 'chassis no', 'chassis number', 'vin'],
  engine_number: ['engine', 'engine no', 'engine number'],
  last_service_date: ['last service date', 'last svc date', 'last serviced date'],
  last_service_km: ['last service km', 'last svc km', 'last serviced km'],
  service_advisor: ['service advisor', 'advisor', 'sa'],
  branch_name: ['branch', 'branch name', 'dealer branch', 'workshop name', 'service center', 'service center name', 'dealer name'],
  crm_notes: ['notes', 'crm notes', 'remarks', 'customer remarks'],
  preferred_channel: ['preferred channel', 'channel', 'communication channel'],
}

const EMPTY_SUMMARY: ImportSummary = {
  totalRows: 0,
  validRows: 0,
  failedRows: 0,
  customersCreated: 0,
  customersUpdated: 0,
  vehiclesCreated: 0,
  vehiclesUpdated: 0,
  remindersGenerated: 0,
  queuedNotifications: 0,
}

export default function ServiceDueUploadPage() {
  const { user, profile } = useDealerAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [center, setCenter] = useState<DealerCenter | null>(null)
  const [serviceCenters, setServiceCenters] = useState<DealerCenter[]>([])
  const [oems, setOems] = useState<OEM[]>([])
  const [models, setModels] = useState<VehicleModel[]>([])
  const [intervalRules, setIntervalRules] = useState<ServiceIntervalRule[]>([])
  const [templates, setTemplates] = useState<ImportTemplate[]>([])
  const [workbook, setWorkbook] = useState<WorkBook | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [sheetName, setSheetName] = useState('')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<SourceRow[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [templateName, setTemplateName] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [runtimeFailures, setRuntimeFailures] = useState<ValidatedRow[]>([])
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const allowed = profile ? ['dealer', 'crm', 'service_manager'].includes(profile.role) : false

  useEffect(() => {
    loadBootstrap()
  }, [user?.id, profile?.role])

  const loadBootstrap = async () => {
    if (!user || !profile) return
    setLoading(true)
    setError('')
    setNotice('')

    if (!['dealer', 'crm', 'service_manager'].includes(profile.role)) {
      setLoading(false)
      return
    }

    const resolved = await resolveDealerServiceCenter(user, 'id,name,city')
    if (resolved.error || !resolved.center) {
      setError(resolved.error || 'No workshop is linked to this dealer account.')
      setLoading(false)
      return
    }

    const dealerCenter = resolved.center as DealerCenter
    setCenter(dealerCenter)

    let linkedCenters = [dealerCenter]
    if (profile.role === 'dealer') {
      const branches = await safeGet<DealerCenter[]>(
        `/api/service-centers/owned?ownerId=${encodeURIComponent(user.id)}&columns=${encodeURIComponent('id,name,city,state,pincode')}`,
        [],
      )
      if (branches.length) linkedCenters = branches
    } else {
      const assigned = await safeGet<DealerCenter | null>(
        `/api/service-centers/${encodeURIComponent(dealerCenter.id)}?columns=${encodeURIComponent('id,name,city,state,pincode')}`,
        null,
      )
      if (assigned) linkedCenters = [assigned]
    }

    const linkedCenterIds = linkedCenters.map(item => item.id)
    setServiceCenters(linkedCenters)

    const [oemsData, modelsData, rulesByCenter, templatesData] = await Promise.all([
      safeGet<OEM[]>('/api/vehicle-oems', []),
      safeGet<VehicleModel[]>('/api/vehicle-models', []),
      Promise.all(linkedCenterIds.map(centerId => (
        safeGet<ServiceIntervalRule[]>(
          `/api/crm/interval-rules?serviceCenterId=${encodeURIComponent(centerId)}&isActive=true`,
          [],
        )
      ))),
      safeGet<ImportTemplate[]>(
        `/api/crm/service-due-import-templates?serviceCenterId=${encodeURIComponent(dealerCenter.id)}`,
        [],
      ),
    ])

    setOems(oemsData || [])
    setModels(modelsData || [])
    setIntervalRules(rulesByCenter.flat())
    setTemplates(templatesData || [])
    setLoading(false)
  }

  const validation = useMemo(() => {
    return validateRows(rows, mapping, oems, models, intervalRules, serviceCenters, center?.id || '')
  }, [rows, mapping, oems, models, intervalRules, serviceCenters, center?.id])

  const allFailures = useMemo(() => [...validation.failedRows, ...runtimeFailures], [validation.failedRows, runtimeFailures])
  const mappedFieldKeys = new Set(Object.values(mapping).filter(Boolean))
  const missingRequired = SYSTEM_FIELDS.filter(field => field.required && field.key !== 'service_center_id' && !mappedFieldKeys.has(field.key))

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !['xlsx', 'xls', 'csv'].includes(extension)) {
      setError('Unsupported file. Upload .xlsx, .xls, or .csv.')
      return
    }

    setError('')
    setNotice('')
    setImportSummary(null)
    setRuntimeFailures([])
    setFileName(file.name)
    setSourceLabel(extension === 'csv' ? 'Generic CSV' : 'OEM Excel')

    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const parsed = XLSX.read(buffer, { type: 'array', cellDates: true })
      setWorkbook(parsed)
      setSheetNames(parsed.SheetNames)
      const firstSheet = parsed.SheetNames[0] || ''
      setSheetName(firstSheet)
      loadSheet(parsed, firstSheet, templates, XLSX)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the uploaded file.')
      setWorkbook(null)
      setSheetNames([])
      setHeaders([])
      setRows([])
      setMapping({})
    }
  }

  const handleSheetChange = (nextSheet: string) => {
    if (!workbook) return
    setSheetName(nextSheet)
    setImportSummary(null)
    setRuntimeFailures([])
    import('xlsx').then(XLSX => loadSheet(workbook, nextSheet, templates, XLSX)).catch(err => {
      setError(err instanceof Error ? err.message : 'Could not load the spreadsheet parser.')
    })
  }

  const loadSheet = (book: WorkBook, selectedSheet: string, availableTemplates: ImportTemplate[], XLSX: XlsxModule) => {
    const sheet = book.Sheets[selectedSheet]
    if (!sheet) {
      setError('Selected sheet was not found in the workbook.')
      return
    }

    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false, raw: false }) as unknown[][]
    const headerIndex = matrix.findIndex(row => row.map(cellText).filter(Boolean).length >= 2)
    if (headerIndex < 0) {
      setError('No usable header row was detected.')
      setHeaders([])
      setRows([])
      setMapping({})
      return
    }

    const headerRow = matrix[headerIndex].map(cellText)
    const columnIndexes = headerRow
      .map((header, index) => ({ header, index }))
      .filter(item => item.header)

    const uniqueHeaders = makeUniqueHeaders(columnIndexes.map(item => item.header))
    const sourceRows = matrix.slice(headerIndex + 1)
      .map((row, rowOffset) => {
        const cells: Record<string, string> = {}
        columnIndexes.forEach((column, headerOffset) => {
          cells[uniqueHeaders[headerOffset]] = cellText(row[column.index])
        })
        return { rowNumber: headerIndex + rowOffset + 2, cells }
      })
      .filter(row => Object.values(row.cells).some(Boolean))

    const auto = buildAutoMapping(uniqueHeaders, availableTemplates)
    setHeaders(uniqueHeaders)
    setRows(sourceRows)
    setMapping(auto.mapping)
    setTemplateName(auto.template?.name || '')
    setNotice(auto.message)
  }

  const updateMapping = (header: string, field: SystemFieldKey | '') => {
    setImportSummary(null)
    setRuntimeFailures([])
    setMapping(current => {
      const next = { ...current }
      Object.keys(next).forEach(key => {
        if (field && next[key] === field) delete next[key]
      })
      if (!field) delete next[header]
      else next[header] = field
      return next
    })
  }

  const saveTemplate = async () => {
    if (!center || !user) return
    const cleanName = templateName.trim()
    if (!cleanName) {
      setError('Template name is required.')
      return
    }
    setSavingTemplate(true)
    setError('')
    const payload = {
      service_center_id: center.id,
      name: cleanName,
      source_label: sourceLabel || cleanName,
      sheet_name: sheetName,
      header_signature: headerSignature(headers),
      mapping,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    }
    const existing = templates.find(item => item.name.toLowerCase() === cleanName.toLowerCase())
    try {
      if (existing) await api.patch(`/api/crm/service-due-import-templates/${encodeURIComponent(existing.id)}`, payload)
      else await api.post('/api/crm/service-due-import-templates', payload)
      setNotice(`Saved mapping template: ${cleanName}`)
      await loadBootstrap()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save mapping template.')
    }
    setSavingTemplate(false)
  }

  const downloadSampleTemplate = async () => {
    const XLSX = await import('xlsx')
    const worksheet = XLSX.utils.aoa_to_sheet([SYSTEM_FIELDS.map(field => field.label)])
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, worksheet, 'Service Due Import')
    const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' })
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'bikeai-service-due-import-template.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  }

  const processImport = async () => {
    if (!center || !user || processing) return
    const validRows = validation.validRows.filter(row => row.data)
    if (validRows.length === 0) {
      setError('No valid rows are ready to import.')
      return
    }

    setProcessing(true)
    setError('')
    setNotice('')
    setRuntimeFailures([])
    const summary: ImportSummary = {
      ...EMPTY_SUMMARY,
      totalRows: rows.length,
      validRows: validation.validRows.length,
      failedRows: validation.failedRows.length,
    }
    const processingFailures: ValidatedRow[] = []
    const importCenterIds = unique(validRows.map(row => row.data?.serviceCenterId || center.id))

    const [customersByCenter, vehiclesByCenter] = await Promise.all([
      Promise.all(importCenterIds.map(serviceCenterId => (
        safeGet<ExistingCustomer[]>(
          `/api/crm/customers?serviceCenterId=${encodeURIComponent(serviceCenterId)}&role=customer`,
          [],
        )
      ))),
      Promise.all(importCenterIds.map(serviceCenterId => (
        safeGet<ExistingVehicle[]>(
          `/api/crm/vehicles?serviceCenterId=${encodeURIComponent(serviceCenterId)}`,
          [],
        )
      ))),
    ])

    const customerByPhone = new Map<string, ExistingCustomer>()
    customersByCenter.flat().forEach(customer => {
      ;[customer.phone, customer.whatsapp_number || '', customer.alternate_phone || ''].forEach(phone => {
        const digits = normalizePhone(phone)
        const centerScopedKey = `${customer.preferred_center_id || center.id}:${digits}`
        if (digits && !customerByPhone.has(centerScopedKey)) customerByPhone.set(centerScopedKey, customer)
      })
    })

    const vehicleByNumber = new Map<string, ExistingVehicle>()
    vehiclesByCenter.flat().forEach(vehicle => {
      const key = normalizeVehicleNumber(vehicle.registration_number)
      if (key) vehicleByNumber.set(key, vehicle)
    })

    for (const row of validRows) {
      const data = row.data
      if (!data) continue
      try {
        const customerKey = `${data.serviceCenterId}:${data.mobileNumber}`
        let customer = customerByPhone.get(customerKey)
        const customerPayload = {
          full_name: data.customerName,
          phone: data.mobileNumber,
          whatsapp_number: data.mobileNumber,
          alternate_phone: data.alternateNumber || null,
          email: data.email || null,
          city: data.city || data.serviceCenterCity || null,
          pincode: pickPincode(data.areaOrPincode) || data.serviceCenterPincode || null,
          area: data.areaOrPincode || data.serviceCenterCity || null,
          preferred_language: data.preferredLanguage || null,
          preferred_channel: data.preferredChannel || null,
          customer_notes: data.crmNotes || customer?.customer_notes || '',
          preferred_center_id: data.serviceCenterId,
          whatsapp_consent: data.whatsappConsent,
          sms_consent: data.smsConsent,
          role: 'customer',
          lead_status: 'active',
          is_active: true,
          updated_at: new Date().toISOString(),
        }

        if (customer) {
          await api.patch(`/api/crm/customers/${encodeURIComponent(customer.id)}`, customerPayload)
          customer = { ...customer, ...customerPayload, id: customer.id } as ExistingCustomer
          summary.customersUpdated += 1
        } else {
          const id = crypto.randomUUID()
          const insertedCustomer = await api.post<ExistingCustomer>('/api/crm/customers', { id, ...customerPayload })
          customer = (insertedCustomer || { id, ...customerPayload }) as ExistingCustomer
          summary.customersCreated += 1
        }

        customerByPhone.set(customerKey, customer)
        if (data.alternateNumber) customerByPhone.set(`${data.serviceCenterId}:${data.alternateNumber}`, customer)

        const vehicleKey = normalizeVehicleNumber(data.vehicleNumber)
        const existingVehicle = vehicleByNumber.get(vehicleKey)
        const vehiclePayload = {
          customer_id: customer.id,
          registration_number: data.vehicleNumber,
          oem_id: data.oemId,
          model_id: data.modelId,
          fuel_type: data.fuelType || 'petrol',
          odometer_km: data.currentKm,
          preferred_center_id: data.serviceCenterId,
          date_of_sale: data.dateOfSale,
          purchase_date: data.dateOfSale,
          next_service_date: data.nextServiceDate,
          next_service_km: data.nextServiceKm,
          last_service_date: data.lastServiceDate,
          last_service_odometer_km: data.lastServiceKm || 0,
          last_service_type: data.serviceType,
          service_due_type_label: data.serviceTypeLabel,
          service_interval_days: data.intervalDays,
          service_interval_km: data.intervalKm,
          chassis_number: data.chassisNumber,
          engine_number: data.engineNumber,
          service_advisor: data.serviceAdvisor,
          branch_name: data.branchName || data.serviceCenterName,
          customer_status: 'active',
          is_active: true,
          updated_at: new Date().toISOString(),
        }

        if (existingVehicle) {
          await api.patch(`/api/crm/vehicles/${encodeURIComponent(existingVehicle.id)}`, vehiclePayload)
          summary.vehiclesUpdated += 1
        } else {
          const insertedVehicle = await api.post<ExistingVehicle>('/api/crm/vehicles', vehiclePayload)
          if (insertedVehicle) vehicleByNumber.set(vehicleKey, insertedVehicle as ExistingVehicle)
          summary.vehiclesCreated += 1
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'Import failed for this row.'
        processingFailures.push({ ...row, status: 'failed', reasons: [reason] })
        summary.failedRows += 1
      }
    }

    if (summary.customersCreated + summary.customersUpdated + summary.vehiclesCreated + summary.vehiclesUpdated > 0) {
      const today = isoDate(new Date())
      for (const serviceCenterId of importCenterIds) {
        try {
          const generated = await api.post<{ generated?: number }>('/api/crm/service-due-reminders/generate', {
            service_center_id: serviceCenterId,
            as_of: today,
          })
          summary.remindersGenerated += Number(generated?.generated || 0)
        } catch (err) {
          setNotice(`Reminder generation warning: ${err instanceof Error ? err.message : 'request failed'}`)
        }

        try {
          const queued = await api.post<{ queued?: number }>('/api/crm/service-due-reminders/queue', {
            service_center_id: serviceCenterId,
            now: new Date().toISOString(),
          })
          summary.queuedNotifications += Number(queued?.queued || 0)
        } catch (err) {
          setNotice(`Notification queue warning: ${err instanceof Error ? err.message : 'request failed'}`)
        }
      }
    }

    setRuntimeFailures(processingFailures)
    setImportSummary(summary)

    await api.post('/api/crm/service-due-import-batches', {
      service_center_id: center.id,
      file_name: fileName,
      sheet_name: sheetName,
      total_rows: summary.totalRows,
      valid_rows: summary.validRows,
      failed_rows: summary.failedRows,
      summary,
      failed_details: [...validation.failedRows, ...processingFailures].map(row => ({
        row_number: row.source.rowNumber,
        reasons: row.reasons,
        vehicle_number: row.values.vehicle_number || '',
        mobile_number: row.values.mobile_number || '',
      })),
      created_by: user.id,
    })

    setProcessing(false)
  }

  if (loading) {
    return (
      <div style={S.centered}>
        <span style={S.loader} />
        <span>Loading service due upload...</span>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div style={S.root}>
        <div style={S.alert}>
          <ShieldCheck size={18} />
          <span>Only dealer owners, CRM staff, and service managers can access this import page.</span>
        </div>
      </div>
    )
  }

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <div style={S.breadcrumb}>
            <Link to="/dealer/crm" style={S.breadcrumbLink}>Dealer CRM</Link>
            <ChevronRight size={14} />
            <span>Service Due Upload</span>
          </div>
          <h1 style={S.title}>Service Due Upload</h1>
          <p style={S.sub}>{center ? `${center.name}${center.city ? `, ${center.city}` : ''}` : 'Dealer workshop'} | .xlsx, .xls, .csv, Google Sheets export</p>
        </div>
        <div style={S.headerActions}>
          <button type="button" style={S.outlineBtn} onClick={downloadSampleTemplate}>
            <Download size={15} /> Download Sample Template
          </button>
          <button type="button" style={S.primaryBtn} onClick={() => fileInputRef.current?.click()}>
            <Upload size={15} /> Upload Sheet
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />
        </div>
      </div>

      {error && <div style={S.error}><AlertTriangle size={16} /> {error}</div>}
      {notice && <div style={S.notice}><CheckCircle size={16} /> {notice}</div>}

      <div style={S.stepGrid}>
        <StepCard icon={<FileSpreadsheet size={18} />} title="Upload" value={fileName || 'No file selected'} active={Boolean(fileName)} />
        <StepCard icon={<Table2 size={18} />} title="Headers" value={headers.length ? `${headers.length} detected` : 'Waiting'} active={headers.length > 0} />
        <StepCard icon={<Database size={18} />} title="Validation" value={`${validation.validRows.length} valid / ${validation.failedRows.length} failed`} active={rows.length > 0} />
      </div>

      <div style={S.panel}>
        <div style={S.panelHead}>
          <div>
            <h2 style={S.panelTitle}>Upload Source</h2>
            <p style={S.panelSub}>Honda, Hero, TVS, OEM MIS, dealer DMS, or generic sheets.</p>
          </div>
          {sheetNames.length > 0 && (
            <label style={S.fieldLabel}>
              Sheet
              <select style={S.select} value={sheetName} onChange={event => handleSheetChange(event.target.value)}>
                {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
          )}
        </div>
      </div>

      {headers.length > 0 && (
        <div style={S.panel}>
          <div style={S.panelHead}>
            <div>
              <h2 style={S.panelTitle}>Column Mapping</h2>
              <p style={S.panelSub}>Rows can map Branch Name or Service Center ID; blank rows use the current dealer center.</p>
            </div>
            <div style={S.templateActions}>
              <input style={S.input} value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder="Template name" />
              <input style={S.input} value={sourceLabel} onChange={event => setSourceLabel(event.target.value)} placeholder="Source label" />
              <button type="button" style={S.outlineBtn} onClick={saveTemplate} disabled={savingTemplate}>
                {savingTemplate ? <RefreshCw size={15} /> : <Save size={15} />} Save Template
              </button>
            </div>
          </div>

          {missingRequired.length > 0 && (
            <div style={S.warnLine}>
              <AlertTriangle size={15} />
              Missing mappings: {missingRequired.map(field => field.label).join(', ')}
            </div>
          )}

          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Uploaded Column</th>
                  <th style={S.th}>System Field</th>
                  <th style={S.th}>Preview</th>
                </tr>
              </thead>
              <tbody>
                {headers.map(header => (
                  <tr key={header} style={S.tr}>
                    <td style={S.td}>
                      <strong>{header}</strong>
                    </td>
                    <td style={S.td}>
                      <select style={S.selectFull} value={mapping[header] || ''} onChange={event => updateMapping(header, event.target.value as SystemFieldKey | '')}>
                        <option value="">Do not import</option>
                        <optgroup label="Mandatory">
                          {SYSTEM_FIELDS.filter(field => field.required).map(field => (
                            <option key={field.key} value={field.key}>{field.label}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Optional">
                          {SYSTEM_FIELDS.filter(field => !field.required).map(field => (
                            <option key={field.key} value={field.key}>{field.label}</option>
                          ))}
                        </optgroup>
                      </select>
                    </td>
                    <td style={S.tdMuted}>{rows.slice(0, 3).map(row => row.cells[header]).filter(Boolean).join(' | ') || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div style={S.panel}>
          <div style={S.panelHead}>
            <div>
              <h2 style={S.panelTitle}>Validation Preview</h2>
              <p style={S.panelSub}>{rows.length} rows checked against customer, vehicle, OEM, model, date, KM, consent, and duplicate rules.</p>
            </div>
            <button type="button" style={S.primaryBtn} onClick={processImport} disabled={processing || validation.validRows.length === 0}>
              {processing ? <RefreshCw size={15} /> : <Database size={15} />} {processing ? 'Importing...' : 'Import Valid Rows'}
            </button>
          </div>

          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Row</th>
                  <th style={S.th}>Customer</th>
                  <th style={S.th}>Mobile</th>
                  <th style={S.th}>Vehicle</th>
                  <th style={S.th}>OEM / Model</th>
                  <th style={S.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {validation.rows.slice(0, 80).map(row => (
                  <tr key={row.source.rowNumber} style={S.tr}>
                    <td style={S.td}>{row.source.rowNumber}</td>
                    <td style={S.td}>{row.values.customer_name || '-'}</td>
                    <td style={S.td}>{row.values.mobile_number || '-'}</td>
                    <td style={S.td}>{row.values.vehicle_number || '-'}</td>
                    <td style={S.td}>{[row.values.oem_brand, row.values.vehicle_model].filter(Boolean).join(' / ') || '-'}</td>
                    <td style={S.td}>
                      {row.status === 'valid'
                        ? <span style={S.validBadge}><CheckCircle size={13} /> Valid</span>
                        : <span style={S.failBadge}><XCircle size={13} /> {row.reasons.join('; ')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importSummary && (
        <div style={S.panel}>
          <div style={S.panelHead}>
            <div>
              <h2 style={S.panelTitle}>Import Summary</h2>
              <p style={S.panelSub}>Imported into {unique(validation.validRows.map(row => row.data?.serviceCenterName || center?.name || '')).filter(Boolean).join(', ')}.</p>
            </div>
          </div>
          <div style={S.summaryGrid}>
            <Metric label="Total Rows" value={importSummary.totalRows} />
            <Metric label="Valid Rows" value={importSummary.validRows} />
            <Metric label="Failed Rows" value={importSummary.failedRows} danger={importSummary.failedRows > 0} />
            <Metric label="Customers Created" value={importSummary.customersCreated} />
            <Metric label="Customers Updated" value={importSummary.customersUpdated} />
            <Metric label="Vehicles Created" value={importSummary.vehiclesCreated} />
            <Metric label="Vehicles Updated" value={importSummary.vehiclesUpdated} />
            <Metric label="Reminders Generated" value={importSummary.remindersGenerated} />
            <Metric label="Queued Notifications" value={importSummary.queuedNotifications} />
          </div>
        </div>
      )}

      {allFailures.length > 0 && (
        <div style={S.panel}>
          <div style={S.panelHead}>
            <div>
              <h2 style={S.panelTitle}>Failed Rows</h2>
              <p style={S.panelSub}>Rows are not imported until these reasons are fixed.</p>
            </div>
          </div>
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Row</th>
                  <th style={S.th}>Mobile</th>
                  <th style={S.th}>Vehicle</th>
                  <th style={S.th}>Reasons</th>
                </tr>
              </thead>
              <tbody>
                {allFailures.map(row => (
                  <tr key={`${row.source.rowNumber}-${row.reasons.join('|')}`} style={S.tr}>
                    <td style={S.td}>{row.source.rowNumber}</td>
                    <td style={S.td}>{row.values.mobile_number || '-'}</td>
                    <td style={S.td}>{row.values.vehicle_number || '-'}</td>
                    <td style={S.td}>{row.reasons.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StepCard({ icon, title, value, active }: { icon: ReactNode; title: string; value: string; active: boolean }) {
  return (
    <div style={{ ...S.stepCard, borderColor: active ? '#bbf7d0' : '#e5e7eb' }}>
      <div style={{ ...S.stepIcon, background: active ? '#f0fdf4' : '#f8fafc', color: active ? '#059669' : '#64748b' }}>{icon}</div>
      <div>
        <div style={S.stepTitle}>{title}</div>
        <div style={S.stepValue}>{value}</div>
      </div>
    </div>
  )
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div style={S.metric}>
      <div style={{ ...S.metricValue, color: danger ? '#dc2626' : '#0f2044' }}>{value}</div>
      <div style={S.metricLabel}>{label}</div>
    </div>
  )
}

function validateRows(
  sourceRows: SourceRow[],
  mapping: ColumnMapping,
  oems: OEM[],
  models: VehicleModel[],
  rules: ServiceIntervalRule[],
  serviceCenters: DealerCenter[],
  defaultCenterId: string,
) {
  const vehicleFirstRow = new Map<string, number>()
  sourceRows.forEach(row => {
    const values = mappedValues(row, mapping)
    const vehicle = normalizeVehicleNumber(values.vehicle_number || '')
    if (vehicle && !vehicleFirstRow.has(vehicle)) vehicleFirstRow.set(vehicle, row.rowNumber)
  })

  const rows = sourceRows.map<ValidatedRow>(source => {
    const values = mappedValues(source, mapping)
    const reasons: string[] = []
    const customerName = clean(values.customer_name)
    const mobileNumber = normalizePhone(values.mobile_number || '')
    const vehicleNumber = normalizeVehicleNumber(values.vehicle_number || '')
    const oemName = clean(values.oem_brand)
    const modelName = clean(values.vehicle_model)
    const dateOfSale = parseDateValue(values.date_of_sale || '')
    const currentKm = parseKm(values.current_km || '')
    const serviceType = parseImportServiceType(values.service_type || '')
    const whatsappConsent = parseConsent(values.whatsapp_consent || '')
    const smsConsent = parseConsent(values.sms_consent || '')
    const serviceCenterValue = clean(values.service_center_id)
    const branchName = clean(values.branch_name)
    const rowCenter = resolveImportServiceCenter(serviceCenterValue, branchName, serviceCenters, defaultCenterId)

    if (!customerName) reasons.push('missing customer name')
    if (!mobileNumber) reasons.push('missing mobile')
    else if (mobileNumber.length < 10) reasons.push('invalid mobile')
    if (!vehicleNumber) reasons.push('missing vehicle number')
    if (!oemName) reasons.push('missing OEM')
    if (!modelName) reasons.push('missing model')
    if (!dateOfSale) reasons.push('invalid date')
    else if (new Date(`${dateOfSale}T00:00:00`) > startOfToday()) reasons.push('date of sale cannot be future')
    if (currentKm == null) reasons.push('invalid KM')
    if (!serviceType) reasons.push('invalid service type')
    if (whatsappConsent !== true) reasons.push('missing consent')
    if (smsConsent !== true) reasons.push('missing SMS consent')
    if (serviceCenterValue && !rowCenter) reasons.push('invalid service center id')
    if (!serviceCenterValue && branchName && !rowCenter) reasons.push('invalid branch name')
    if (vehicleNumber && vehicleFirstRow.get(vehicleNumber) !== source.rowNumber) reasons.push('duplicate vehicle in file')

    const oem = findOem(oemName, oems)
    if (oemName && !oem) reasons.push(`invalid OEM: ${oemName} is missing from DB`)
    const model = oem ? findModel(modelName, oem.id, models) : null
    if (oem && modelName && !model) reasons.push(`invalid model: ${oem.name} / ${modelName} is missing from DB`)

    const lastServiceDateText = clean(values.last_service_date)
    const lastServiceDate = lastServiceDateText ? parseDateValue(lastServiceDateText) : null
    if (lastServiceDateText && !lastServiceDate) reasons.push('invalid last service date')

    const lastServiceKmText = clean(values.last_service_km)
    const lastServiceKm = lastServiceKmText ? parseKm(lastServiceKmText) : null
    if (lastServiceKmText && lastServiceKm == null) reasons.push('invalid last service KM')

    if (reasons.length || !rowCenter || !oem || !model || !dateOfSale || currentKm == null || !serviceType || whatsappConsent == null || smsConsent == null) {
      return { source, values, status: 'failed', reasons: unique(reasons), data: null }
    }

    const interval = pickIntervalRule(rules, rowCenter.id, serviceType)
    const intervalDays = interval.intervalDays
    const intervalKm = interval.intervalKm

    return {
      source,
      values,
      status: 'valid',
      reasons: [],
      data: {
        serviceCenterId: rowCenter.id,
        serviceCenterName: rowCenter.name,
        serviceCenterCity: rowCenter.city || '',
        serviceCenterPincode: rowCenter.pincode || '',
        customerName,
        mobileNumber,
        alternateNumber: normalizePhone(values.alternate_number || ''),
        email: clean(values.email),
        city: clean(values.city),
        areaOrPincode: clean(values.area_pincode),
        preferredLanguage: clean(values.preferred_language),
        preferredChannel: clean(values.preferred_channel),
        vehicleNumber,
        oemId: oem.id,
        oemName: oem.name,
        modelId: model.id,
        modelName: model.name,
        dateOfSale,
        currentKm,
        serviceType: serviceType.vehicleServiceType,
        serviceTypeLabel: serviceType.label,
        whatsappConsent,
        smsConsent,
        fuelType: normalizeFuel(values.fuel_type || ''),
        chassisNumber: clean(values.chassis_number),
        engineNumber: clean(values.engine_number),
        lastServiceDate,
        lastServiceKm,
        serviceAdvisor: clean(values.service_advisor),
        branchName,
        crmNotes: clean(values.crm_notes),
        intervalDays,
        intervalKm,
        nextServiceDate: addDays(dateOfSale, intervalDays),
        nextServiceKm: intervalKm,
      },
    }
  })

  return {
    rows,
    validRows: rows.filter(row => row.status === 'valid'),
    failedRows: rows.filter(row => row.status === 'failed'),
  }
}

function mappedValues(row: SourceRow, mapping: ColumnMapping) {
  const values: Partial<Record<SystemFieldKey, string>> = {}
  Object.entries(mapping).forEach(([header, field]) => {
    if (field) values[field] = row.cells[header] || ''
  })
  return values
}

function buildAutoMapping(headers: string[], templates: ImportTemplate[]) {
  const exactSignature = headerSignature(headers)
  const exact = templates.find(template => template.header_signature === exactSignature && template.mapping)
  if (exact?.mapping) {
    return { mapping: filterTemplateMapping(exact.mapping, headers), template: exact, message: `Applied saved template: ${exact.name}` }
  }

  const headerSet = new Set(headers.map(normalizeHeader))
  const scored = templates
    .filter(template => template.mapping)
    .map(template => {
      const score = Object.keys(template.mapping || {}).filter(header => headerSet.has(normalizeHeader(header))).length
      return { template, score }
    })
    .sort((a, b) => b.score - a.score)[0]

  if (scored && scored.score >= 4 && scored.template.mapping) {
    return { mapping: filterTemplateMapping(scored.template.mapping, headers), template: scored.template, message: `Applied closest template: ${scored.template.name}` }
  }

  const aliasMapping: ColumnMapping = {}
  headers.forEach(header => {
    const field = guessField(header)
    if (field && !Object.values(aliasMapping).includes(field)) aliasMapping[header] = field
  })
  return { mapping: aliasMapping, template: null, message: Object.keys(aliasMapping).length ? 'Auto-mapped known OEM columns.' : '' }
}

function filterTemplateMapping(templateMapping: ColumnMapping, headers: string[]) {
  const next: ColumnMapping = {}
  headers.forEach(header => {
    const exact = templateMapping[header]
    if (exact) {
      next[header] = exact
      return
    }
    const match = Object.keys(templateMapping).find(savedHeader => normalizeHeader(savedHeader) === normalizeHeader(header))
    if (match && templateMapping[match]) next[header] = templateMapping[match]
  })
  return next
}

function guessField(header: string): SystemFieldKey | null {
  const normalized = normalizeHeader(header)
  const found = SYSTEM_FIELDS.find(field => HEADER_ALIASES[field.key].some(alias => normalizeHeader(alias) === normalized))
  return found?.key || null
}

function cellText(value: unknown) {
  if (value == null) return ''
  if (value instanceof Date) return isoDate(value)
  return String(value).trim()
}

function makeUniqueHeaders(sourceHeaders: string[]) {
  const seen = new Map<string, number>()
  return sourceHeaders.map(header => {
    const count = seen.get(header) || 0
    seen.set(header, count + 1)
    return count ? `${header} (${count + 1})` : header
  })
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function headerSignature(sourceHeaders: string[]) {
  return sourceHeaders.map(normalizeHeader).join('|')
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function clean(value: string | undefined) {
  return String(value || '').trim()
}

function normalizePhone(value: string) {
  const digits = clean(value).replace(/[^0-9]/g, '')
  if (digits.length > 10 && digits.startsWith('91')) return digits.slice(-10)
  return digits
}

function normalizeVehicleNumber(value: string) {
  return clean(value).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function parseKm(value: string) {
  const text = clean(value).replace(/,/g, '')
  if (!text) return null
  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed)
}

function parseConsent(value: string) {
  const normalized = clean(value).toLowerCase()
  if (!normalized) return null
  if (['yes', 'y', 'true', '1', 'consent', 'opt in', 'opt-in', 'allowed'].includes(normalized)) return true
  if (['no', 'n', 'false', '0', 'denied', 'opt out', 'opt-out'].includes(normalized)) return false
  return null
}

function parseImportServiceType(value: string): ImportedServiceType | null {
  const normalized = normalizeName(value)
  if (!normalized) return null

  if (['1stfree', 'firstfree', 'free1', '1free', '1stservice', 'firstservice'].includes(normalized)) {
    return { label: '1st Free', vehicleServiceType: 'free', bookingServiceType: 'free_service', ruleTypes: ['first_service', 'free_service'] }
  }
  if (['2ndfree', 'secondfree', 'free2', '2free', '2ndservice', 'secondservice'].includes(normalized)) {
    return { label: '2nd Free', vehicleServiceType: 'free', bookingServiceType: 'free_service', ruleTypes: ['second_service', 'free_service'] }
  }
  if (['3rdfree', 'thirdfree', 'free3', '3free', '3rdservice', 'thirdservice'].includes(normalized)) {
    return { label: '3rd Free', vehicleServiceType: 'free', bookingServiceType: 'free_service', ruleTypes: ['third_service', 'free_service'] }
  }
  if (['free', 'freeservice'].includes(normalized)) {
    return { label: '1st Free', vehicleServiceType: 'free', bookingServiceType: 'free_service', ruleTypes: ['free_service', 'first_service'] }
  }
  if (['paid', 'paidservice'].includes(normalized)) {
    return { label: 'Paid', vehicleServiceType: 'paid', bookingServiceType: 'paid_service', ruleTypes: ['paid_service'] }
  }
  if (['general', 'generalservice', 'periodic', 'regular', 'regularservice'].includes(normalized)) {
    return { label: 'General', vehicleServiceType: 'periodic', bookingServiceType: 'general_service', ruleTypes: ['periodic'] }
  }

  return null
}

function parseDateValue(value: string) {
  const text = clean(value)
  if (!text) return null
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (iso) return validIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const indian = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/)
  if (indian) {
    const year = Number(indian[3].length === 2 ? `20${indian[3]}` : indian[3])
    return validIsoDate(year, Number(indian[2]), Number(indian[1]))
  }
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return isoDate(parsed)
}

function validIsoDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return isoDate(date)
}

function isoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return isoDate(date)
}

function findOem(value: string, oems: OEM[]) {
  const key = normalizeName(value)
  return oems.find(oem => normalizeName(oem.name) === key) || null
}

function findModel(value: string, oemId: string, models: VehicleModel[]) {
  const key = normalizeName(value)
  return models.find(model => model.oem_id === oemId && normalizeName(model.name) === key) || null
}

function resolveImportServiceCenter(serviceCenterValue: string, branchName: string, serviceCenters: DealerCenter[], defaultCenterId: string) {
  if (serviceCenterValue) {
    const idMatch = serviceCenters.find(center => center.id === serviceCenterValue)
    if (idMatch) return idMatch
    const nameMatch = serviceCenters.find(center => normalizeName(center.name) === normalizeName(serviceCenterValue))
    if (nameMatch) return nameMatch
    return null
  }

  if (branchName) {
    return serviceCenters.find(center => normalizeName(center.name) === normalizeName(branchName)) || null
  }

  return serviceCenters.find(center => center.id === defaultCenterId) || serviceCenters[0] || null
}

function pickIntervalRule(rules: ServiceIntervalRule[], serviceCenterId: string, serviceType: ImportedServiceType) {
  const scopedRules = rules.filter(item => item.service_center_id === serviceCenterId && item.is_active)
  const rule = serviceType.ruleTypes
    .map(ruleType => scopedRules.find(item => item.rule_type === ruleType))
    .find(Boolean) ||
    scopedRules.find(item => item.service_type === serviceType.vehicleServiceType) ||
    scopedRules.find(item => item.service_type === 'periodic') ||
    scopedRules.find(item => item.rule_type === 'periodic')
  return {
    intervalDays: rule?.interval_days || 90,
    intervalKm: rule?.interval_km || 3000,
  }
}

function normalizeFuel(value: string) {
  const text = clean(value).toLowerCase()
  if (!text) return 'petrol'
  if (['petrol', 'diesel', 'ev', 'electric', 'cng', 'hybrid'].includes(text)) return text === 'electric' ? 'ev' : text
  return text
}

function pickPincode(value: string) {
  return clean(value).match(/\b\d{6}\b/)?.[0] || ''
}

function unique(values: string[]) {
  return [...new Set(values)]
}

const S: Record<string, CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1240px' },
  centered: { minHeight: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#64748b', fontSize: '13px' },
  loader: { width: '26px', height: '26px', borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#059669', animation: 'spin 0.8s linear infinite' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b', fontSize: '12px', fontWeight: 700, marginBottom: '6px' },
  breadcrumbLink: { color: '#2563eb', textDecoration: 'none' },
  title: { fontSize: '24px', fontWeight: 900, color: '#0f2044', margin: 0 },
  sub: { margin: '4px 0 0', color: '#64748b', fontSize: '13px' },
  headerActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  primaryBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', minHeight: '38px', padding: '9px 14px', border: 0, borderRadius: '8px', background: '#059669', color: 'white', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  outlineBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', minHeight: '38px', padding: '9px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', color: '#334155', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  error: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', borderRadius: '10px', fontSize: '13px', fontWeight: 700 },
  notice: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#047857', borderRadius: '10px', fontSize: '13px', fontWeight: 700 },
  alert: { display: 'flex', alignItems: 'center', gap: '8px', padding: '14px', border: '1px solid #e5e7eb', background: 'white', color: '#0f2044', borderRadius: '10px', fontSize: '13px', fontWeight: 800 },
  stepGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' },
  stepCard: { display: 'flex', alignItems: 'center', gap: '11px', padding: '13px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px' },
  stepIcon: { width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepTitle: { color: '#64748b', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' },
  stepValue: { color: '#0f2044', fontSize: '13px', fontWeight: 900, marginTop: '2px', wordBreak: 'break-word' },
  panel: { background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' },
  panelHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' },
  panelTitle: { margin: 0, color: '#0f2044', fontSize: '17px', fontWeight: 900 },
  panelSub: { margin: '3px 0 0', color: '#64748b', fontSize: '12.5px' },
  fieldLabel: { display: 'flex', flexDirection: 'column', gap: '5px', color: '#64748b', fontSize: '12px', fontWeight: 800 },
  select: { minWidth: '180px', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', color: '#0f2044', fontSize: '13px', fontFamily: 'inherit' },
  selectFull: { width: '100%', minWidth: '210px', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', color: '#0f2044', fontSize: '13px', fontFamily: 'inherit' },
  input: { minWidth: '170px', padding: '9px 11px', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#0f2044', fontSize: '13px', fontFamily: 'inherit' },
  templateActions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  warnLine: { display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 10px', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '12.5px', fontWeight: 800, marginBottom: '12px' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', padding: '10px 11px', borderBottom: '1px solid #e5e7eb', color: '#94a3b8', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px 11px', color: '#334155', fontSize: '13px', verticalAlign: 'middle' },
  tdMuted: { padding: '10px 11px', color: '#64748b', fontSize: '12px', verticalAlign: 'middle', maxWidth: '420px' },
  validBadge: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '999px', background: '#f0fdf4', color: '#059669', fontSize: '12px', fontWeight: 900, whiteSpace: 'nowrap' },
  failBadge: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '999px', background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: 900, maxWidth: '520px' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' },
  metric: { padding: '13px', border: '1px solid #e5e7eb', borderRadius: '10px', background: '#f8fafc' },
  metricValue: { fontSize: '24px', fontWeight: 900, lineHeight: 1 },
  metricLabel: { marginTop: '5px', color: '#64748b', fontSize: '12px', fontWeight: 800 },
}
