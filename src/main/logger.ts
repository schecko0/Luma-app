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
  return new Date().toISOString()
}

function writeLog(level: string, message: string, extra?: unknown) {
  const line = `[${timestamp()}] [${level}] ${message}${extra ? ' ' + JSON.stringify(extra) : ''}\n`
  if (level === 'ERROR') console.error(line.trim())
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
  getLogPath: () => logFile ?? '',
}
