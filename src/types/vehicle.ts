export interface VehicleOEM {
  id: string
  name: string
  slug: string
  logo_url: string | null
  country: string
  is_ev_brand: boolean
  sort_order: number
  is_active: boolean
}

export interface VehicleModel {
  id: string
  oem_id: string
  name: string
  slug: string
  segment: string
  fuel_types: string[]
  start_year: number
  end_year: number | null
  sort_order: number
  is_active: boolean
}

export interface VehicleVariant {
  id: string
  model_id: string
  name: string
  fuel_type: string
  displacement_cc: number | null
  is_active: boolean
}

export interface VehicleSelection {
  oem: VehicleOEM | null
  model: VehicleModel | null
  year: number | null
  fuelType: string | null
  serviceType: string | null
  vehicleNumber: string
  odometerKm: string
}

export interface ServiceInterval {
  id: string
  model_id: string
  interval_km: number
  interval_months: number
  service_type: string
  description: string
}

export const SERVICE_CATEGORIES = [
  { value: 'free_service',      label: 'Free Service',       description: 'Complimentary scheduled service' },
  { value: 'general_service',   label: 'General Service',    description: 'Routine maintenance & oil change' },
  { value: 'paid_service',      label: 'Paid Service',       description: 'Standard paid servicing' },
  { value: 'minor_service',     label: 'Minor Service',      description: 'Air filter, spark plug, minor checks' },
  { value: 'major_service',     label: 'Major Service',      description: 'Full tune-up, all fluids, wear parts' },
  { value: 'breakdown_service', label: 'Breakdown Service',  description: 'Emergency breakdown assistance' },
  { value: 'specific_complaint',label: 'Specific Complaint', description: 'Diagnose and fix a reported issue' },
] as const

export type ServiceCategoryValue = typeof SERVICE_CATEGORIES[number]['value']

export const FUEL_TYPE_LABELS: Record<string, string> = {
  petrol:   'Petrol',
  electric: 'Electric (EV)',
  cng:      'CNG',
}

// OEM brand color accents for the brand card UI
export const OEM_COLORS: Record<string, { primary: string; bg: string }> = {
  'hero':          { primary: '#e31e24', bg: '#fef2f2' },
  'honda':         { primary: '#cc0000', bg: '#fef2f2' },
  'tvs':           { primary: '#0066b2', bg: '#eff6ff' },
  'bajaj':         { primary: '#003087', bg: '#eff6ff' },
  'yamaha':        { primary: '#0d1b5e', bg: '#eef2f8' },
  'royal-enfield': { primary: '#8b0000', bg: '#fef2f2' },
  'suzuki':        { primary: '#005aab', bg: '#eff6ff' },
  'ktm':           { primary: '#e84612', bg: '#fff4ef' },
  'ather':         { primary: '#00c853', bg: '#f0fdf4' },
  'ola-electric':  { primary: '#0a0a0a', bg: '#f9fafb' },
  'ampere':        { primary: '#6d28d9', bg: '#f5f3ff' },
  'pure-ev':       { primary: '#0284c7', bg: '#f0f9ff' },
  'revolt':        { primary: '#dc2626', bg: '#fef2f2' },
  'ultraviolette': { primary: '#7c3aed', bg: '#f5f3ff' },
}

export function getYearRange(startYear: number, endYear?: number | null): number[] {
  const end = endYear ?? new Date().getFullYear()
  const years: number[] = []
  for (let y = end; y >= startYear; y--) {
    years.push(y)
  }
  return years
}
