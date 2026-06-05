declare module 'xlsx' {
  export type WorkBook = any
  export const utils: any
  export function read(data: any, opts?: any): any
  export function write(workbook: any, opts?: any): any
}

