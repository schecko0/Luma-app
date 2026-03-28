import type { ElectronAPI } from '../../preload/preload'

/**
 * Extiende Window para que TypeScript reconozca window.electronAPI
 * inyectada por el script de preload vía contextBridge.
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
