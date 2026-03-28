import type { IpcMain } from 'electron'
import { registerAppHandlers }          from './appHandlers'
import { registerEmployeeHandlers }     from './employeeHandlers'
import { registerServiceHandlers }      from './serviceHandlers'
import { registerClientHandlers }       from './clientHandlers'
import { registerInventoryHandlers }    from './inventoryHandlers'
import { registerCashRegisterHandlers } from './cashRegisterHandlers'
import { registerInvoiceHandlers }      from './invoiceHandlers'
import { registerCommissionHandlers }   from './commissionHandlers'
import { registerSettingsHandlers, registerDashboardHandlers } from './settingsHandlers'
import { registerCalendarHandlers }     from './calendarHandlers'

export function registerAllHandlers(ipcMain: IpcMain) {
  registerAppHandlers(ipcMain)
  registerEmployeeHandlers(ipcMain)
  registerServiceHandlers(ipcMain)
  registerClientHandlers(ipcMain)
  registerInventoryHandlers(ipcMain)
  registerCashRegisterHandlers(ipcMain)
  registerInvoiceHandlers(ipcMain)
  registerCommissionHandlers(ipcMain)
  registerSettingsHandlers(ipcMain)
  registerDashboardHandlers(ipcMain)
  registerCalendarHandlers(ipcMain)
}
