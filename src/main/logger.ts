import fs from 'fs'
import path from 'path'
import { app } from 'electron'

let logFile: string | null = null

export function setupLogger() {
  const logDir = path.join(app.getPath('userData'), 'logs')
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }
  logFile = path.join(logDir, 'luma.log')
  writeLog('INFO', 'Logger inicializado.')
}

function timestamp(): string {
  const d = new Date()
  const tzoffset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tzoffset).toISOString().slice(0, 19).replace('T', ' ')
}

function writeLog(level: string, message: string, extra?: unknown) {
  const line = `[${timestamp()}] [${level}] ${message}${extra ? ' ' + JSON.stringify(extra) : ''}\n`
  if (level === 'ERROR') console.error(line.trim())
  else if (level === 'AUDIT') console.log(`\x1b[36m${line.trim()}\x1b[0m`) // Cian para auditoría
  else console.log(line.trim())

  if (logFile) {
    try { fs.appendFileSync(logFile, line, 'utf-8') } catch (_) { /* silencioso */ }
  }
}

export const logger = {
  info:       (msg: string, extra?: unknown) => writeLog('INFO',  msg, extra),
  warn:       (msg: string, extra?: unknown) => writeLog('WARN',  msg, extra),
  error:      (msg: string, extra?: unknown) => writeLog('ERROR', msg, extra),
  debug:      (msg: string, extra?: unknown) => writeLog('DEBUG', msg, extra),
  audit:      (msg: string, extra?: unknown) => writeLog('AUDIT', msg, extra),
  getLogPath: () => logFile ?? '',
  clearLogs:  () => {
    if (logFile && fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, `[${timestamp()}] [INFO] Archivo de log vaciado por el administrador.\n`, 'utf-8')
      return true
    }
    return false
  }
}
