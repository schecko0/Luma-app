"use strict";
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const fs = require("fs");
const http = require("http");
const url = require("url");
const googleapis = require("googleapis");
let db;
function log(msg) {
  console.log(`[DB] ${(/* @__PURE__ */ new Date()).toISOString()} ${msg}`);
}
async function initDatabase() {
  const dbPath = path.join(electron.app.getPath("userData"), "luma.db");
  log(`Abriendo base de datos en: ${dbPath}`);
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = -32000");
  db.pragma("temp_store = MEMORY");
  runMigrations();
  log("Base de datos inicializada correctamente.");
}
function getDb() {
  if (!db) throw new Error("Base de datos no inicializada. Llamar initDatabase() primero.");
  return db;
}
function closeDatabase() {
  if (db) {
    db.close();
    log("Conexión a la base de datos cerrada.");
  }
}
function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version     INTEGER PRIMARY KEY,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const current = getCurrentVersion();
  if (current < 1) applyMigration1();
  if (current < 2) applyMigration2();
  if (current < 3) applyMigration3();
  if (current < 4) applyMigration4();
  if (current < 5) applyMigration5();
}
function getCurrentVersion() {
  const row = db.prepare("SELECT MAX(version) as v FROM schema_version").get();
  return (row == null ? void 0 : row.v) ?? 0;
}
function setVersion(v) {
  db.prepare("INSERT OR REPLACE INTO schema_version (version) VALUES (?)").run(v);
}
function applyMigration1() {
  log("Aplicando migración 1: tablas base del sistema...");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK(role IN ('admin', 'employee')) DEFAULT 'employee',
      employee_id   INTEGER,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS error_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      level       TEXT NOT NULL DEFAULT 'error',
      message     TEXT NOT NULL,
      stack       TEXT,
      context     TEXT,
      occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO users (username, password_hash, role)
    VALUES ('admin', 'PENDING_HASH', 'admin');

    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('salon_name',       'Mi Salón'),
      ('salon_currency',   'MXN'),
      ('tax_rate',         '16'),
      ('tax_label',        'IVA'),
      ('theme',            'dark'),
      ('first_run',        'true'),
      ('google_client_id', ''),
      ('google_secret',    '');
  `);
  setVersion(1);
  log("Migración 1 completada.");
}
function applyMigration2() {
  log("Aplicando migración 2: schema completo de negocio...");
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name        TEXT    NOT NULL,
        last_name         TEXT    NOT NULL,
        email             TEXT,
        phone             TEXT,
        phone_country     TEXT    NOT NULL DEFAULT '+52',
        calendar_color    TEXT    NOT NULL DEFAULT 'peacock',
        base_salary       REAL    NOT NULL DEFAULT 0,
        commission_pct    REAL    NOT NULL DEFAULT 0
                            CHECK(commission_pct >= 0 AND commission_pct <= 100),
        google_calendar_id TEXT,
        hire_date         TEXT,
        notes             TEXT,
        photo_path        TEXT,
        is_active         INTEGER NOT NULL DEFAULT 1,
        created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS service_categories (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL UNIQUE,
        description TEXT,
        color       TEXT    NOT NULL DEFAULT '#d4881f',
        icon        TEXT    NOT NULL DEFAULT 'scissors',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        is_active   INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO service_categories (name, icon, color, sort_order) VALUES
        ('Cabello',   'scissors', '#d4881f', 1),
        ('Uñas',      'sparkles', '#e4a73a', 2),
        ('Faciales',  'smile',    '#4caf7d', 3),
        ('Cejas',     'eye',      '#4a90d9', 4),
        ('Masajes',   'wind',     '#9b59b6', 5),
        ('Otros',     'star',     '#8a8070', 6);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id   INTEGER NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
        name          TEXT    NOT NULL,
        description   TEXT,
        price         REAL    NOT NULL DEFAULT 0 CHECK(price >= 0),
        duration_min  INTEGER NOT NULL DEFAULT 60 CHECK(duration_min > 0),
        is_active     INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_services_category ON services(category_id);
      CREATE INDEX IF NOT EXISTS idx_services_active   ON services(is_active);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name          TEXT    NOT NULL,
        last_name           TEXT    NOT NULL,
        email               TEXT,
        phone               TEXT,
        phone_country       TEXT    NOT NULL DEFAULT '+52',
        birthdate           TEXT,
        tax_id              TEXT,
        tax_legal_name      TEXT,
        tax_zip_code        TEXT,
        tax_regime          TEXT,
        tax_use             TEXT,
        notes               TEXT,
        visit_count         INTEGER NOT NULL DEFAULT 0,
        last_visit_at       TEXT,
        photo_path          TEXT,
        is_active           INTEGER NOT NULL DEFAULT 1,
        created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_clients_name   ON clients(last_name, first_name);
      CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(is_active);
      CREATE INDEX IF NOT EXISTS idx_clients_phone  ON clients(phone);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS inventory_products (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT    NOT NULL,
        supplier        TEXT,
        sku             TEXT,
        container_type  TEXT    NOT NULL DEFAULT 'unit',
        volume_ml       REAL,
        pieces          INTEGER,
        cost_price      REAL    NOT NULL DEFAULT 0 CHECK(cost_price >= 0),
        sale_price      REAL    NOT NULL DEFAULT 0 CHECK(sale_price >= 0),
        quantity        REAL    NOT NULL DEFAULT 0 CHECK(quantity >= 0),
        min_stock       REAL    NOT NULL DEFAULT 0,
        notes           TEXT,
        photo_path      TEXT,
        is_active       INTEGER NOT NULL DEFAULT 1,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_inventory_active ON inventory_products(is_active);
      CREATE INDEX IF NOT EXISTS idx_inventory_stock  ON inventory_products(quantity, min_stock);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS cash_registers (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        opened_by               INTEGER NOT NULL REFERENCES users(id),
        closed_by               INTEGER REFERENCES users(id),
        opened_at               TEXT    NOT NULL DEFAULT (datetime('now')),
        closed_at               TEXT,
        initial_cash            REAL    NOT NULL DEFAULT 0,
        final_cash_declared     REAL,
        final_card_declared     REAL,
        final_transfer_declared REAL,
        system_cash             REAL,
        system_card             REAL,
        system_transfer         REAL,
        diff_cash               REAL,
        diff_card               REAL,
        diff_transfer           REAL,
        notes                   TEXT,
        status                  TEXT    NOT NULL DEFAULT 'open'
                                  CHECK(status IN ('open', 'closed')),
        created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_cash_register_status ON cash_registers(status);
      CREATE INDEX IF NOT EXISTS idx_cash_register_opened ON cash_registers(opened_at);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS cash_movement_categories (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL UNIQUE,
        type       TEXT    NOT NULL CHECK(type IN ('in', 'out', 'both')),
        is_active  INTEGER NOT NULL DEFAULT 1
      );
      INSERT OR IGNORE INTO cash_movement_categories (name, type) VALUES
        ('Venta',             'in'),
        ('Préstamo recibido', 'in'),
        ('Otro ingreso',      'in'),
        ('Insumos',           'out'),
        ('Servicios',         'out'),
        ('Nómina',            'out'),
        ('Renta',             'out'),
        ('Publicidad',        'out'),
        ('Mantenimiento',     'out'),
        ('Préstamo pagado',   'out'),
        ('Otro gasto',        'out');

      CREATE TABLE IF NOT EXISTS cash_movements (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        register_id    INTEGER NOT NULL REFERENCES cash_registers(id) ON DELETE RESTRICT,
        category_id    INTEGER REFERENCES cash_movement_categories(id),
        type           TEXT    NOT NULL CHECK(type IN ('in', 'out')),
        payment_method TEXT    NOT NULL DEFAULT 'cash'
                         CHECK(payment_method IN ('cash', 'card', 'transfer')),
        amount         REAL    NOT NULL CHECK(amount > 0),
        description    TEXT,
        reference      TEXT,
        invoice_id     INTEGER,
        created_by     INTEGER REFERENCES users(id),
        created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_movements_register ON cash_movements(register_id);
      CREATE INDEX IF NOT EXISTS idx_movements_date     ON cash_movements(created_at);
      CREATE INDEX IF NOT EXISTS idx_movements_type     ON cash_movements(type);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id                        INTEGER PRIMARY KEY AUTOINCREMENT,
        folio                     TEXT    NOT NULL UNIQUE,
        register_id               INTEGER REFERENCES cash_registers(id),
        client_id                 INTEGER REFERENCES clients(id),
        created_by                INTEGER NOT NULL REFERENCES users(id),
        subtotal                  REAL    NOT NULL DEFAULT 0,
        tax_rate                  REAL    NOT NULL DEFAULT 0,
        tax_amount                REAL    NOT NULL DEFAULT 0,
        total                     REAL    NOT NULL DEFAULT 0,
        status                    TEXT    NOT NULL DEFAULT 'pending'
                                    CHECK(status IN ('pending', 'paid', 'cancelled')),
        requires_official_invoice INTEGER NOT NULL DEFAULT 0,
        cancellation_reason       TEXT,
        cancelled_by              INTEGER REFERENCES users(id),
        cancelled_at              TEXT,
        notes                     TEXT,
        created_at                TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at                TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_invoices_status   ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoices_client   ON invoices(client_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_register ON invoices(register_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_date     ON invoices(created_at);
      CREATE INDEX IF NOT EXISTS idx_invoices_official ON invoices(requires_official_invoice, status);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoice_services (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id   INTEGER NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
        service_id   INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
        service_name TEXT    NOT NULL,
        unit_price   REAL    NOT NULL,
        quantity     INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
        line_total   REAL    NOT NULL,
        notes        TEXT,
        created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_inv_services_invoice ON invoice_services(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_inv_services_service ON invoice_services(service_id);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoice_service_employees (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_service_id INTEGER NOT NULL REFERENCES invoice_services(id) ON DELETE RESTRICT,
        employee_id        INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
        commission_pct     REAL    NOT NULL DEFAULT 0,
        work_split_pct     REAL    NOT NULL DEFAULT 100,
        commission_amount  REAL    NOT NULL DEFAULT 0,
        is_owner           INTEGER NOT NULL DEFAULT 0,
        created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
        UNIQUE(invoice_service_id, employee_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ise_inv_service ON invoice_service_employees(invoice_service_id);
      CREATE INDEX IF NOT EXISTS idx_ise_employee    ON invoice_service_employees(employee_id);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoice_payments (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id     INTEGER NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
        payment_method TEXT    NOT NULL
                         CHECK(payment_method IN ('cash', 'card', 'transfer')),
        amount         REAL    NOT NULL CHECK(amount > 0),
        reference      TEXT,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_payments_invoice ON invoice_payments(invoice_id);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS commission_runs (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        executed_by       INTEGER NOT NULL REFERENCES users(id),
        date_from         TEXT    NOT NULL,
        date_to           TEXT    NOT NULL,
        status            TEXT    NOT NULL DEFAULT 'preview'
                            CHECK(status IN ('preview', 'confirmed')),
        total_commissions REAL    NOT NULL DEFAULT 0,
        total_business    REAL    NOT NULL DEFAULT 0,
        notes             TEXT,
        confirmed_at      TEXT,
        created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_commission_runs_status ON commission_runs(status);
      CREATE INDEX IF NOT EXISTS idx_commission_runs_dates  ON commission_runs(date_from, date_to);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS commission_details (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id               INTEGER NOT NULL REFERENCES commission_runs(id) ON DELETE RESTRICT,
        employee_id          INTEGER NOT NULL REFERENCES employees(id),
        invoice_id           INTEGER NOT NULL REFERENCES invoices(id),
        invoice_service_id   INTEGER NOT NULL REFERENCES invoice_services(id),
        employee_name        TEXT    NOT NULL,
        service_name         TEXT    NOT NULL,
        invoice_folio        TEXT    NOT NULL,
        invoice_date         TEXT    NOT NULL,
        line_total           REAL    NOT NULL,
        work_split_pct       REAL    NOT NULL DEFAULT 100,
        commission_pct       REAL    NOT NULL,
        commission_amount    REAL    NOT NULL,
        is_owner             INTEGER NOT NULL DEFAULT 0,
        base_salary_snapshot REAL    NOT NULL DEFAULT 0,
        created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_comm_details_run      ON commission_details(run_id);
      CREATE INDEX IF NOT EXISTS idx_comm_details_employee ON commission_details(employee_id);
      CREATE INDEX IF NOT EXISTS idx_comm_details_invoice  ON commission_details(invoice_id);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        google_event_id TEXT UNIQUE,
        employee_id     INTEGER REFERENCES employees(id),
        client_id       INTEGER REFERENCES clients(id),
        service_id      INTEGER REFERENCES services(id),
        title           TEXT    NOT NULL,
        description     TEXT,
        start_at        TEXT    NOT NULL,
        end_at          TEXT    NOT NULL,
        all_day         INTEGER NOT NULL DEFAULT 0,
        color           TEXT,
        sync_status     TEXT    NOT NULL DEFAULT 'local'
                          CHECK(sync_status IN ('local','synced','pending_sync','cancelled')),
        last_synced_at  TEXT,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_appointments_start     ON appointments(start_at);
      CREATE INDEX IF NOT EXISTS idx_appointments_employee  ON appointments(employee_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_sync      ON appointments(sync_status);
      CREATE INDEX IF NOT EXISTS idx_appointments_google_id ON appointments(google_event_id);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS google_sync_queue (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id),
        operation      TEXT    NOT NULL CHECK(operation IN ('create','update','delete')),
        payload        TEXT,
        attempts       INTEGER NOT NULL DEFAULT 0,
        last_error     TEXT,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
        next_retry_at  TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_retry ON google_sync_queue(next_retry_at);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoice_sequence (
        id       INTEGER PRIMARY KEY CHECK(id = 1),
        last_seq INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO invoice_sequence (id, last_seq) VALUES (1, 0);
    `);
  });
  migrate();
  setVersion(2);
  log("Migración 2 completada: schema completo de negocio listo.");
}
function applyMigration3() {
  log("Aplicando migración 3: campo role en employees...");
  const migrate = db.transaction(() => {
    db.exec(`
      ALTER TABLE employees ADD COLUMN role TEXT NOT NULL DEFAULT 'employee';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_unique_name
        ON employees(first_name, last_name);
    `);
  });
  migrate();
  setVersion(3);
  log("Migración 3 completada.");
}
function applyMigration4() {
  log("Aplicando migración 4: owner_employee_id + employee_rate_history...");
  const migrate = db.transaction(() => {
    db.exec(`
      ALTER TABLE services ADD COLUMN
        owner_employee_id INTEGER REFERENCES employees(id);
      CREATE INDEX IF NOT EXISTS idx_services_owner ON services(owner_employee_id);
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS employee_rate_history (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id    INTEGER NOT NULL REFERENCES employees(id),
        changed_by     INTEGER NOT NULL REFERENCES users(id),
        old_commission REAL    NOT NULL,
        new_commission REAL    NOT NULL,
        old_salary     REAL    NOT NULL,
        new_salary     REAL    NOT NULL,
        reason         TEXT,
        changed_at     TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_rate_history_employee ON employee_rate_history(employee_id);
      CREATE INDEX IF NOT EXISTS idx_rate_history_date     ON employee_rate_history(changed_at);
    `);
  });
  migrate();
  setVersion(4);
  log("Migración 4 completada.");
}
function applyMigration5() {
  log("Aplicando migración 5: tokens OAuth Google Calendar...");
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS google_oauth_tokens (
        id            INTEGER PRIMARY KEY CHECK(id = 1),
        access_token  TEXT    NOT NULL,
        refresh_token TEXT    NOT NULL,
        token_type    TEXT    NOT NULL DEFAULT 'Bearer',
        expiry_date   INTEGER,              -- timestamp en ms (Unix)
        scope         TEXT,
        connected_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
      );
    `);
    db.exec(`
      INSERT OR IGNORE INTO settings (key, value) VALUES
        ('google_calendar_id', 'primary');
    `);
  });
  migrate();
  setVersion(5);
  log("Migración 5 completada.");
}
let logFile = null;
function setupLogger() {
  const logDir = path.join(electron.app.getPath("userData"), "logs");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  logFile = path.join(logDir, "luma.log");
  writeLog("INFO", "Logger inicializado.");
}
function timestamp() {
  const d = /* @__PURE__ */ new Date();
  const tzoffset = d.getTimezoneOffset() * 6e4;
  return new Date(d.getTime() - tzoffset).toISOString().slice(0, 19).replace("T", " ");
}
function writeLog(level, message, extra) {
  const line = `[${timestamp()}] [${level}] ${message}${extra ? " " + JSON.stringify(extra) : ""}
`;
  if (level === "ERROR") console.error(line.trim());
  else if (level === "AUDIT") console.log(`\x1B[36m${line.trim()}\x1B[0m`);
  else console.log(line.trim());
  if (logFile) {
    try {
      fs.appendFileSync(logFile, line, "utf-8");
    } catch (_) {
    }
  }
}
const logger = {
  info: (msg, extra) => writeLog("INFO", msg, extra),
  warn: (msg, extra) => writeLog("WARN", msg, extra),
  error: (msg, extra) => writeLog("ERROR", msg, extra),
  debug: (msg, extra) => writeLog("DEBUG", msg, extra),
  audit: (msg, extra) => writeLog("AUDIT", msg, extra),
  getLogPath: () => logFile ?? "",
  clearLogs: () => {
    if (logFile && fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, `[${timestamp()}] [INFO] Archivo de log vaciado por el administrador.
`, "utf-8");
      return true;
    }
    return false;
  }
};
function getNextInvoiceFolio() {
  const db2 = getDb();
  const update = db2.prepare(`
    UPDATE invoice_sequence SET last_seq = last_seq + 1 WHERE id = 1
  `);
  const select = db2.prepare(`SELECT last_seq FROM invoice_sequence WHERE id = 1`);
  const getNextFolio = db2.transaction(() => {
    update.run();
    const row = select.get();
    return row.last_seq;
  });
  const seq = getNextFolio();
  return `V-${String(seq).padStart(5, "0")}`;
}
function withTransaction(fn) {
  const db2 = getDb();
  const transaction = db2.transaction(fn);
  return transaction();
}
function nowISO() {
  const d = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${date} ${time}`;
}
function registerAppHandlers(ipcMain) {
  ipcMain.handle("app:ping", () => {
    return { ok: true, version: electron.app.getVersion(), platform: process.platform };
  });
  ipcMain.handle("app:getLogPath", () => {
    return logger.getLogPath();
  });
  ipcMain.handle("app:readLogs", (_event, lines = 200) => {
    const logPath = logger.getLogPath();
    if (!fs.existsSync(logPath)) return "";
    const content = fs.readFileSync(logPath, "utf-8");
    const all = content.split("\n").filter(Boolean);
    return all.slice(-lines).join("\n");
  });
  ipcMain.handle("app:clearLogs", () => {
    const ok = logger.clearLogs();
    if (ok) {
      try {
        getDb().prepare(`
          INSERT INTO error_log (level, message, context, occurred_at) 
          VALUES ('info', 'Archivo luma.log vaciado por el administrador', 'AUDIT', ?)
        `).run(nowISO());
      } catch (_) {
      }
    }
    return ok;
  });
  ipcMain.handle("app:getErrorLogs", (_event, page = 1, pageSize = 20) => {
    try {
      const db2 = getDb();
      const offset = (page - 1) * pageSize;
      const items = db2.prepare(`
        SELECT * FROM error_log 
        ORDER BY occurred_at DESC 
        LIMIT ? OFFSET ?
      `).all(pageSize, offset);
      const total = db2.prepare("SELECT COUNT(*) as count FROM error_log").get().count;
      return { ok: true, data: { items, total, page, pageSize } };
    } catch (err) {
      logger.error("Error al obtener logs de la BD", err);
      return { ok: false, error: "No se pudieron obtener los logs de la base de datos." };
    }
  });
  ipcMain.handle("app:exportDb", async () => {
    try {
      const { filePath, canceled } = await electron.dialog.showSaveDialog({
        title: "Exportar Base de Datos",
        defaultPath: `luma_backup_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.db`,
        filters: [{ name: "SQLite Database", extensions: ["db"] }]
      });
      if (canceled || !filePath) return { ok: false, error: "Cancelado por el usuario" };
      const dbPath = path.join(electron.app.getPath("userData"), "luma.db");
      try {
        const db2 = getDb();
        db2.pragma("wal_checkpoint(FULL)");
      } catch (checkpointErr) {
        logger.error("Error al hacer checkpoint antes de exportar", checkpointErr);
      }
      const now = nowISO();
      try {
        getDb().prepare(`
          INSERT INTO error_log (level, message, context, occurred_at) 
          VALUES ('info', ?, 'AUDIT', ?)
        `).run(`Base de datos exportada a: ${filePath}`, now);
        getDb().pragma("wal_checkpoint(FULL)");
      } catch (_) {
      }
      fs.copyFileSync(dbPath, filePath);
      logger.audit(`Base de datos exportada a: ${filePath}`);
      return { ok: true, data: filePath };
    } catch (err) {
      logger.error("Error exportando BD", err);
      return { ok: false, error: "Error al exportar la base de datos." };
    }
  });
  ipcMain.handle("app:importDb", async () => {
    const dbPath = path.join(electron.app.getPath("userData"), "luma.db");
    const bakPath = dbPath + ".bak";
    try {
      const { filePaths, canceled } = await electron.dialog.showOpenDialog({
        title: "Importar Base de Datos",
        filters: [{ name: "SQLite Database", extensions: ["db"] }],
        properties: ["openFile"]
      });
      if (canceled || filePaths.length === 0) return { ok: false, error: "Cancelado" };
      const newPath = filePaths[0];
      const now = nowISO();
      try {
        getDb().prepare(`
          INSERT INTO error_log (level, message, context, occurred_at) 
          VALUES ('info', ?, 'AUDIT', ?)
        `).run(`Inicio de importación desde: ${newPath}`, now);
      } catch (_) {
      }
      closeDatabase();
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, bakPath);
      }
      fs.copyFileSync(newPath, dbPath);
      try {
        await initDatabase();
        if (fs.existsSync(bakPath)) fs.unlinkSync(bakPath);
        getDb().prepare(`
          INSERT INTO error_log (level, message, context, occurred_at) 
          VALUES ('info', ?, 'AUDIT', ?)
        `).run(`Importación exitosa desde: ${newPath}`, nowISO());
        logger.audit(`Base de datos importada exitosamente desde: ${newPath}`);
        return { ok: true };
      } catch (initErr) {
        logger.error("Error inicializando la base de datos importada, restaurando respaldo...", initErr);
        if (fs.existsSync(bakPath)) {
          fs.copyFileSync(bakPath, dbPath);
          await initDatabase();
        }
        return { ok: false, error: "El archivo no es una base de datos válida de Luma App." };
      }
    } catch (err) {
      logger.error("Error general importando BD", err);
      return { ok: false, error: "Error crítico durante la importación." };
    }
  });
  ipcMain.handle("app:logError", (_event, message, stack) => {
    logger.error(`[Renderer] ${message}`, stack ? { stack } : void 0);
    try {
      const db2 = getDb();
      db2.prepare(`
        INSERT INTO error_log (level, message, stack, context, occurred_at)
        VALUES (?, ?, ?, ?, ?)
      `).run("error", `[Renderer] ${message}`, stack || null, "IPC", nowISO());
    } catch (err) {
      console.error("Fallo al guardar error en DB:", err);
    }
    return { ok: true };
  });
  ipcMain.handle("app:dbReady", () => {
    try {
      const db2 = getDb();
      const result = db2.prepare("SELECT 1 as ok").get();
      return { ready: result.ok === 1 };
    } catch (err) {
      logger.error("DB health check failed", err);
      return { ready: false };
    }
  });
}
function registerEmployeeHandlers(ipcMain) {
  ipcMain.handle("employees:list", (_e, params) => {
    try {
      const db2 = getDb();
      const { page = 1, pageSize = 20, search = "", includeInactive = false } = params;
      const offset = (page - 1) * pageSize;
      const like = `%${search}%`;
      const activeFilter = includeInactive ? "" : "AND e.is_active = 1";
      const rows = db2.prepare(`
        SELECT e.*, (e.first_name || ' ' || e.last_name) AS full_name
        FROM employees e
        WHERE (e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ?)
          ${activeFilter}
        ORDER BY e.first_name ASC
        LIMIT ? OFFSET ?
      `).all(like, like, like, pageSize, offset);
      const { total } = db2.prepare(`
        SELECT COUNT(*) as total FROM employees e
        WHERE (e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ?)
          ${activeFilter}
      `).get(like, like, like);
      return { ok: true, data: { items: rows, total, page, pageSize } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("employees:getById", (_e, id) => {
    try {
      const db2 = getDb();
      const row = db2.prepare(`
        SELECT *, (first_name || ' ' || last_name) AS full_name FROM employees WHERE id = ?
      `).get(id);
      if (!row) return { ok: false, error: "Empleado no encontrado" };
      return { ok: true, data: row };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("employees:create", (_e, data) => {
    try {
      const db2 = getDb();
      const duplicate = db2.prepare(`
        SELECT id FROM employees WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)
      `).get(data.first_name.trim(), data.last_name.trim());
      if (duplicate) return { ok: false, error: `Ya existe un empleado con el nombre "${data.first_name} ${data.last_name}".` };
      const roleError = validateRoleRules(data.role, data.base_salary, data.commission_pct);
      if (roleError) return { ok: false, error: roleError };
      const now = nowISO();
      const result = db2.prepare(`
        INSERT INTO employees (
          first_name, last_name, email, phone, phone_country,
          role, calendar_color, base_salary, commission_pct,
          google_calendar_id, hire_date, notes, photo_path,
          is_active, created_at, updated_at
        ) VALUES (
          @first_name, @last_name, @email, @phone, @phone_country,
          @role, @calendar_color, @base_salary, @commission_pct,
          @google_calendar_id, @hire_date, @notes, @photo_path,
          @is_active, @created_at, @updated_at
        )
      `).run({
        ...data,
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        is_active: data.is_active ? 1 : 0,
        created_at: now,
        updated_at: now
      });
      return { ok: true, data: { id: result.lastInsertRowid } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("employees:update", (_e, id, data, reason) => {
    try {
      const db2 = getDb();
      const current = db2.prepare("SELECT * FROM employees WHERE id = ?").get(id);
      if (!current) return { ok: false, error: "Empleado no encontrado" };
      const firstName = (data.first_name ?? current.first_name).trim();
      const lastName = (data.last_name ?? current.last_name).trim();
      const duplicate = db2.prepare(`
        SELECT id FROM employees WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?) AND id != ?
      `).get(firstName, lastName, id);
      if (duplicate) return { ok: false, error: `Ya existe otro empleado con el nombre "${firstName} ${lastName}".` };
      const role = data.role ?? current.role;
      const base_salary = data.base_salary ?? current.base_salary;
      const commission_pct = data.commission_pct ?? current.commission_pct;
      const roleError = validateRoleRules(role, base_salary, commission_pct);
      if (roleError) return { ok: false, error: roleError };
      const now = nowISO();
      const salaryChanged = base_salary !== current.base_salary;
      const commissionChanged = commission_pct !== current.commission_pct;
      if (salaryChanged || commissionChanged) {
        db2.prepare(`
          INSERT INTO employee_rate_history
            (employee_id, changed_by, old_commission, new_commission, old_salary, new_salary, reason, changed_at)
          VALUES (?, 1, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          current.commission_pct,
          commission_pct,
          current.base_salary,
          base_salary,
          reason ?? null,
          now
        );
      }
      db2.prepare(`
        UPDATE employees SET
          first_name = @first_name, last_name = @last_name, email = @email,
          phone = @phone, phone_country = @phone_country, role = @role,
          calendar_color = @calendar_color, base_salary = @base_salary,
          commission_pct = @commission_pct, google_calendar_id = @google_calendar_id,
          hire_date = @hire_date, notes = @notes, photo_path = @photo_path,
          is_active = @is_active, updated_at = @updated_at
        WHERE id = @id
      `).run({
        first_name: firstName,
        last_name: lastName,
        email: data.email ?? current.email,
        phone: data.phone ?? current.phone,
        phone_country: data.phone_country ?? current.phone_country,
        role,
        calendar_color: data.calendar_color ?? current.calendar_color,
        base_salary,
        commission_pct,
        google_calendar_id: data.google_calendar_id ?? current.google_calendar_id,
        hire_date: data.hire_date ?? current.hire_date,
        notes: data.notes ?? current.notes,
        photo_path: data.photo_path ?? current.photo_path,
        is_active: data.is_active ?? current.is_active ? 1 : 0,
        updated_at: now,
        id
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("employees:getRateHistory", (_e, id) => {
    try {
      const db2 = getDb();
      const rows = db2.prepare(`
        SELECT h.*, u.username AS changed_by_username
        FROM employee_rate_history h
        JOIN users u ON u.id = h.changed_by
        WHERE h.employee_id = ?
        ORDER BY h.changed_at DESC
        LIMIT 50
      `).all(id);
      return { ok: true, data: rows };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("employees:toggle", (_e, id) => {
    try {
      const db2 = getDb();
      const row = db2.prepare("SELECT is_active FROM employees WHERE id = ?").get(id);
      if (!row) return { ok: false, error: "Empleado no encontrado" };
      const newState = row.is_active === 1 ? 0 : 1;
      db2.prepare("UPDATE employees SET is_active = ?, updated_at = ? WHERE id = ?").run(newState, nowISO(), id);
      return { ok: true, data: { is_active: newState === 1 } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("employees:all", () => {
    try {
      const db2 = getDb();
      const rows = db2.prepare(`
        SELECT id, first_name, last_name,
               (first_name || ' ' || last_name) AS full_name,
               role, calendar_color, commission_pct
        FROM employees WHERE is_active = 1
        ORDER BY first_name ASC
      `).all();
      return { ok: true, data: rows };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}
function validateRoleRules(role, base_salary, commission_pct) {
  if (role === "employee") {
    if (!base_salary || base_salary <= 0)
      return "Un empleado debe tener un salario base mayor a $0.";
    if (!commission_pct || commission_pct <= 0)
      return "Un empleado debe tener un porcentaje de comisión mayor a 0%.";
  }
  if (role === "owner") {
    if (!commission_pct || commission_pct <= 0)
      return "El dueño/jefe debe tener un porcentaje de comisión mayor a 0%.";
  }
  return null;
}
function registerServiceHandlers(ipcMain) {
  ipcMain.handle("categories:list", (_e, includeInactive = false) => {
    try {
      const db2 = getDb();
      const rows = db2.prepare(`
        SELECT * FROM service_categories
        ${includeInactive ? "" : "WHERE is_active = 1"}
        ORDER BY sort_order ASC, name ASC
      `).all();
      return { ok: true, data: rows };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("categories:create", (_e, data) => {
    try {
      const db2 = getDb();
      const dup = db2.prepare("SELECT id FROM service_categories WHERE LOWER(name) = LOWER(?)").get(data.name.trim());
      if (dup) return { ok: false, error: `Ya existe la categoría "${data.name}".` };
      const result = db2.prepare(`
        INSERT INTO service_categories (name, description, color, icon, sort_order, is_active, created_at)
        VALUES (@name, @description, @color, @icon, @sort_order, @is_active, @created_at)
      `).run({ ...data, name: data.name.trim(), is_active: data.is_active ? 1 : 0, created_at: nowISO() });
      return { ok: true, data: { id: result.lastInsertRowid } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("categories:update", (_e, id, data) => {
    try {
      const db2 = getDb();
      const cur = db2.prepare("SELECT * FROM service_categories WHERE id = ?").get(id);
      if (!cur) return { ok: false, error: "Categoría no encontrada." };
      const name = (data.name ?? cur.name).trim();
      const dup = db2.prepare("SELECT id FROM service_categories WHERE LOWER(name) = LOWER(?) AND id != ?").get(name, id);
      if (dup) return { ok: false, error: `Ya existe otra categoría con el nombre "${name}".` };
      db2.prepare(`
        UPDATE service_categories SET
          name = @name, description = @description, color = @color,
          icon = @icon, sort_order = @sort_order, is_active = @is_active
        WHERE id = @id
      `).run({
        name,
        description: data.description ?? cur.description,
        color: data.color ?? cur.color,
        icon: data.icon ?? cur.icon,
        sort_order: data.sort_order ?? cur.sort_order,
        is_active: data.is_active ?? cur.is_active ? 1 : 0,
        id
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("categories:toggle", (_e, id) => {
    try {
      const db2 = getDb();
      const row = db2.prepare("SELECT is_active FROM service_categories WHERE id = ?").get(id);
      if (!row) return { ok: false, error: "Categoría no encontrada." };
      const next = row.is_active === 1 ? 0 : 1;
      db2.prepare("UPDATE service_categories SET is_active = ? WHERE id = ?").run(next, id);
      return { ok: true, data: { is_active: next === 1 } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("services:list", (_e, params) => {
    try {
      const db2 = getDb();
      const { page = 1, pageSize = 20, search = "", categoryId, includeInactive = false } = params;
      const offset = (page - 1) * pageSize;
      const like = `%${search}%`;
      const filters = [];
      const args = [like, like];
      if (!includeInactive) filters.push("s.is_active = 1");
      if (categoryId) {
        filters.push("s.category_id = ?");
        args.push(categoryId);
      }
      const where = `WHERE (s.name LIKE ? OR s.description LIKE ?)${filters.length ? " AND " + filters.join(" AND ") : ""}`;
      const rows = db2.prepare(`
        SELECT s.*,
          c.name AS category_name,
          (e.first_name || ' ' || e.last_name) AS owner_name
        FROM services s
        JOIN service_categories c ON c.id = s.category_id
        LEFT JOIN employees e ON e.id = s.owner_employee_id
        ${where}
        ORDER BY c.sort_order ASC, s.name ASC
        LIMIT ? OFFSET ?
      `).all(...args, pageSize, offset);
      const { total } = db2.prepare(`
        SELECT COUNT(*) as total FROM services s ${where}
      `).get(...args);
      return { ok: true, data: { items: rows, total, page, pageSize } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("services:all", () => {
    try {
      const db2 = getDb();
      const rows = db2.prepare(`
        SELECT s.id, s.name, s.price, s.duration_min, s.category_id,
               s.owner_employee_id, c.name AS category_name,
               (e.first_name || ' ' || e.last_name) AS owner_name
        FROM services s
        JOIN service_categories c ON c.id = s.category_id
        LEFT JOIN employees e ON e.id = s.owner_employee_id
        WHERE s.is_active = 1
        ORDER BY c.sort_order ASC, s.name ASC
      `).all();
      return { ok: true, data: rows };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("services:create", (_e, data) => {
    try {
      const db2 = getDb();
      const dup = db2.prepare("SELECT id FROM services WHERE LOWER(name) = LOWER(?) AND category_id = ?").get(data.name.trim(), data.category_id);
      if (dup) return { ok: false, error: `Ya existe el servicio "${data.name}" en esa categoría.` };
      const now = nowISO();
      const result = db2.prepare(`
        INSERT INTO services
          (category_id, name, description, price, duration_min, owner_employee_id, is_active, created_at, updated_at)
        VALUES
          (@category_id, @name, @description, @price, @duration_min, @owner_employee_id, @is_active, @created_at, @updated_at)
      `).run({
        ...data,
        name: data.name.trim(),
        owner_employee_id: data.owner_employee_id ?? null,
        is_active: data.is_active ? 1 : 0,
        created_at: now,
        updated_at: now
      });
      return { ok: true, data: { id: result.lastInsertRowid } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("services:update", (_e, id, data) => {
    try {
      const db2 = getDb();
      const cur = db2.prepare("SELECT * FROM services WHERE id = ?").get(id);
      if (!cur) return { ok: false, error: "Servicio no encontrado." };
      const name = (data.name ?? cur.name).trim();
      const categoryId = data.category_id ?? cur.category_id;
      const dup = db2.prepare("SELECT id FROM services WHERE LOWER(name) = LOWER(?) AND category_id = ? AND id != ?").get(name, categoryId, id);
      if (dup) return { ok: false, error: `Ya existe el servicio "${name}" en esa categoría.` };
      db2.prepare(`
        UPDATE services SET
          category_id = @category_id, name = @name, description = @description,
          price = @price, duration_min = @duration_min,
          owner_employee_id = @owner_employee_id,
          is_active = @is_active, updated_at = @updated_at
        WHERE id = @id
      `).run({
        category_id: categoryId,
        name,
        description: data.description ?? cur.description,
        price: data.price ?? cur.price,
        duration_min: data.duration_min ?? cur.duration_min,
        owner_employee_id: data.owner_employee_id !== void 0 ? data.owner_employee_id ?? null : cur.owner_employee_id ?? null,
        is_active: data.is_active ?? cur.is_active ? 1 : 0,
        updated_at: nowISO(),
        id
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("services:toggle", (_e, id) => {
    try {
      const db2 = getDb();
      const row = db2.prepare("SELECT is_active FROM services WHERE id = ?").get(id);
      if (!row) return { ok: false, error: "Servicio no encontrado." };
      const next = row.is_active === 1 ? 0 : 1;
      db2.prepare("UPDATE services SET is_active = ?, updated_at = ? WHERE id = ?").run(next, nowISO(), id);
      return { ok: true, data: { is_active: next === 1 } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}
function registerClientHandlers(ipcMain) {
  ipcMain.handle("clients:list", (_e, params) => {
    try {
      const db2 = getDb();
      const { page = 1, pageSize = 20, search = "", includeInactive = false } = params;
      const offset = (page - 1) * pageSize;
      const like = `%${search}%`;
      const activeFilter = includeInactive ? "" : "AND is_active = 1";
      const rows = db2.prepare(`
        SELECT *, (first_name || ' ' || last_name) AS full_name
        FROM clients
        WHERE (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?)
          ${activeFilter}
        ORDER BY last_name ASC, first_name ASC
        LIMIT ? OFFSET ?
      `).all(like, like, like, like, pageSize, offset);
      const { total } = db2.prepare(`
        SELECT COUNT(*) as total FROM clients
        WHERE (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR email LIKE ?)
          ${activeFilter}
      `).get(like, like, like, like);
      return { ok: true, data: { items: rows, total, page, pageSize } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("clients:getById", (_e, id) => {
    try {
      const db2 = getDb();
      const row = db2.prepare(`
        SELECT *, (first_name || ' ' || last_name) AS full_name FROM clients WHERE id = ?
      `).get(id);
      if (!row) return { ok: false, error: "Cliente no encontrado." };
      return { ok: true, data: row };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("clients:search", (_e, query) => {
    try {
      const db2 = getDb();
      const like = `%${query}%`;
      const rows = db2.prepare(`
        SELECT id, first_name, last_name,
               (first_name || ' ' || last_name) AS full_name,
               phone, phone_country, email
        FROM clients
        WHERE is_active = 1
          AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ?)
        ORDER BY last_name ASC, first_name ASC
        LIMIT 10
      `).all(like, like, like);
      return { ok: true, data: rows };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("clients:create", (_e, data) => {
    try {
      const db2 = getDb();
      const dup = db2.prepare(`
        SELECT id FROM clients WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)
      `).get(data.first_name.trim(), data.last_name.trim());
      if (dup) return { ok: false, error: `Ya existe un cliente con el nombre "${data.first_name} ${data.last_name}".` };
      const now = nowISO();
      const result = db2.prepare(`
        INSERT INTO clients (
          first_name, last_name, email, phone, phone_country, birthdate,
          tax_id, tax_legal_name, tax_zip_code, tax_regime, tax_use,
          notes, photo_path, is_active, created_at, updated_at
        ) VALUES (
          @first_name, @last_name, @email, @phone, @phone_country, @birthdate,
          @tax_id, @tax_legal_name, @tax_zip_code, @tax_regime, @tax_use,
          @notes, @photo_path, @is_active, @created_at, @updated_at
        )
      `).run({
        ...data,
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        is_active: data.is_active ? 1 : 0,
        created_at: now,
        updated_at: now
      });
      return { ok: true, data: { id: result.lastInsertRowid } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("clients:update", (_e, id, data) => {
    try {
      const db2 = getDb();
      const cur = db2.prepare("SELECT * FROM clients WHERE id = ?").get(id);
      if (!cur) return { ok: false, error: "Cliente no encontrado." };
      const first = (data.first_name ?? cur.first_name).trim();
      const last = (data.last_name ?? cur.last_name).trim();
      const dup = db2.prepare(`
        SELECT id FROM clients WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?) AND id != ?
      `).get(first, last, id);
      if (dup) return { ok: false, error: `Ya existe otro cliente con el nombre "${first} ${last}".` };
      db2.prepare(`
        UPDATE clients SET
          first_name = @first_name, last_name = @last_name, email = @email,
          phone = @phone, phone_country = @phone_country, birthdate = @birthdate,
          tax_id = @tax_id, tax_legal_name = @tax_legal_name, tax_zip_code = @tax_zip_code,
          tax_regime = @tax_regime, tax_use = @tax_use, notes = @notes,
          photo_path = @photo_path, is_active = @is_active, updated_at = @updated_at
        WHERE id = @id
      `).run({
        first_name: first,
        last_name: last,
        email: data.email ?? cur.email,
        phone: data.phone ?? cur.phone,
        phone_country: data.phone_country ?? cur.phone_country,
        birthdate: data.birthdate ?? cur.birthdate,
        tax_id: data.tax_id ?? cur.tax_id,
        tax_legal_name: data.tax_legal_name ?? cur.tax_legal_name,
        tax_zip_code: data.tax_zip_code ?? cur.tax_zip_code,
        tax_regime: data.tax_regime ?? cur.tax_regime,
        tax_use: data.tax_use ?? cur.tax_use,
        notes: data.notes ?? cur.notes,
        photo_path: data.photo_path ?? cur.photo_path,
        is_active: data.is_active ?? cur.is_active ? 1 : 0,
        updated_at: nowISO(),
        id
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("clients:toggle", (_e, id) => {
    try {
      const db2 = getDb();
      const row = db2.prepare("SELECT is_active FROM clients WHERE id = ?").get(id);
      if (!row) return { ok: false, error: "Cliente no encontrado." };
      const next = row.is_active === 1 ? 0 : 1;
      db2.prepare("UPDATE clients SET is_active = ?, updated_at = ? WHERE id = ?").run(next, nowISO(), id);
      return { ok: true, data: { is_active: next === 1 } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}
function registerInventoryHandlers(ipcMain) {
  ipcMain.handle("inventory:list", (_e, params) => {
    try {
      const db2 = getDb();
      const { page = 1, pageSize = 20, search = "", includeInactive = false, lowStockOnly = false } = params;
      const offset = (page - 1) * pageSize;
      const like = `%${search}%`;
      const filters = ["(name LIKE ? OR supplier LIKE ? OR sku LIKE ?)"];
      const args = [like, like, like];
      if (!includeInactive) filters.push("is_active = 1");
      if (lowStockOnly) filters.push("quantity <= min_stock");
      const where = `WHERE ${filters.join(" AND ")}`;
      const rows = db2.prepare(`
        SELECT *, (quantity <= min_stock) AS low_stock
        FROM inventory_products ${where}
        ORDER BY name ASC
        LIMIT ? OFFSET ?
      `).all(...args, pageSize, offset);
      const { total } = db2.prepare(`
        SELECT COUNT(*) as total FROM inventory_products ${where}
      `).get(...args);
      return { ok: true, data: { items: rows, total, page, pageSize } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("inventory:lowStockCount", () => {
    try {
      const db2 = getDb();
      const { count } = db2.prepare(`
        SELECT COUNT(*) as count FROM inventory_products
        WHERE is_active = 1 AND quantity <= min_stock AND min_stock > 0
      `).get();
      return { ok: true, data: count };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("inventory:create", (_e, data) => {
    try {
      const db2 = getDb();
      const dup = db2.prepare("SELECT id FROM inventory_products WHERE LOWER(name) = LOWER(?)").get(data.name.trim());
      if (dup) return { ok: false, error: `Ya existe un producto con el nombre "${data.name}".` };
      const now = nowISO();
      const result = db2.prepare(`
        INSERT INTO inventory_products (
          name, supplier, sku, container_type, volume_ml, pieces,
          cost_price, sale_price, quantity, min_stock,
          notes, photo_path, is_active, created_at, updated_at
        ) VALUES (
          @name, @supplier, @sku, @container_type, @volume_ml, @pieces,
          @cost_price, @sale_price, @quantity, @min_stock,
          @notes, @photo_path, @is_active, @created_at, @updated_at
        )
      `).run({ ...data, name: data.name.trim(), is_active: data.is_active ? 1 : 0, created_at: now, updated_at: now });
      return { ok: true, data: { id: result.lastInsertRowid } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("inventory:update", (_e, id, data) => {
    try {
      const db2 = getDb();
      const cur = db2.prepare("SELECT * FROM inventory_products WHERE id = ?").get(id);
      if (!cur) return { ok: false, error: "Producto no encontrado." };
      const name = (data.name ?? cur.name).trim();
      const dup = db2.prepare("SELECT id FROM inventory_products WHERE LOWER(name) = LOWER(?) AND id != ?").get(name, id);
      if (dup) return { ok: false, error: `Ya existe otro producto con el nombre "${name}".` };
      db2.prepare(`
        UPDATE inventory_products SET
          name = @name, supplier = @supplier, sku = @sku,
          container_type = @container_type, volume_ml = @volume_ml, pieces = @pieces,
          cost_price = @cost_price, sale_price = @sale_price,
          quantity = @quantity, min_stock = @min_stock,
          notes = @notes, photo_path = @photo_path,
          is_active = @is_active, updated_at = @updated_at
        WHERE id = @id
      `).run({
        name,
        supplier: data.supplier ?? cur.supplier,
        sku: data.sku ?? cur.sku,
        container_type: data.container_type ?? cur.container_type,
        volume_ml: data.volume_ml ?? cur.volume_ml,
        pieces: data.pieces ?? cur.pieces,
        cost_price: data.cost_price ?? cur.cost_price,
        sale_price: data.sale_price ?? cur.sale_price,
        quantity: data.quantity ?? cur.quantity,
        min_stock: data.min_stock ?? cur.min_stock,
        notes: data.notes ?? cur.notes,
        photo_path: data.photo_path ?? cur.photo_path,
        is_active: data.is_active ?? cur.is_active ? 1 : 0,
        updated_at: nowISO(),
        id
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("inventory:adjustStock", (_e, id, delta, notes) => {
    try {
      const db2 = getDb();
      const cur = db2.prepare("SELECT quantity FROM inventory_products WHERE id = ?").get(id);
      if (!cur) return { ok: false, error: "Producto no encontrado." };
      const newQty = cur.quantity + delta;
      if (newQty < 0) return { ok: false, error: "El stock no puede quedar negativo." };
      db2.prepare("UPDATE inventory_products SET quantity = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?").run(newQty, notes ?? null, nowISO(), id);
      return { ok: true, data: { quantity: newQty } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("inventory:toggle", (_e, id) => {
    try {
      const db2 = getDb();
      const row = db2.prepare("SELECT is_active FROM inventory_products WHERE id = ?").get(id);
      if (!row) return { ok: false, error: "Producto no encontrado." };
      const next = row.is_active === 1 ? 0 : 1;
      db2.prepare("UPDATE inventory_products SET is_active = ?, updated_at = ? WHERE id = ?").run(next, nowISO(), id);
      return { ok: true, data: { is_active: next === 1 } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}
function registerCashRegisterHandlers(ipcMain) {
  ipcMain.handle("cash:getOpen", () => {
    try {
      const db2 = getDb();
      const row = db2.prepare(`
        SELECT r.*, u.username AS opened_by_username
        FROM cash_registers r
        JOIN users u ON u.id = r.opened_by
        WHERE r.status = 'open'
        ORDER BY r.opened_at DESC LIMIT 1
      `).get();
      return { ok: true, data: row ?? null };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("cash:open", (_e, payload) => {
    try {
      const db2 = getDb();
      const open = db2.prepare("SELECT id FROM cash_registers WHERE status = 'open'").get();
      if (open) return { ok: false, error: "Ya existe una caja abierta. Ciérrala antes de abrir una nueva." };
      const result = db2.prepare(`
        INSERT INTO cash_registers (opened_by, initial_cash, notes, status, opened_at, created_at)
        VALUES (@opened_by, @initial_cash, @notes, 'open', @opened_at, @created_at)
      `).run({
        opened_by: payload.opened_by,
        initial_cash: payload.initial_cash,
        notes: payload.notes ?? null,
        opened_at: nowISO(),
        created_at: nowISO()
      });
      db2.prepare("INSERT INTO error_log (level, message, context, occurred_at) VALUES ('info', ?, 'AUDIT', ?)").run(`Caja abierta (ID ${result.lastInsertRowid}) con fondo inicial de $${payload.initial_cash.toFixed(2)}`, nowISO());
      return { ok: true, data: { id: result.lastInsertRowid } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("cash:close", (_e, payload) => {
    try {
      const db2 = getDb();
      const reg = db2.prepare("SELECT * FROM cash_registers WHERE id = ? AND status = 'open'").get(payload.register_id);
      if (!reg) return { ok: false, error: "Caja no encontrada o ya está cerrada." };
      const calcTotals = (method) => {
        const invoiceTotal = db2.prepare(`
          SELECT COALESCE(SUM(ip.amount), 0) as total
          FROM invoice_payments ip
          JOIN invoices i ON i.id = ip.invoice_id
          WHERE ip.payment_method = ?
            AND i.register_id = ?
            AND i.status != 'cancelled'
        `).get(method, payload.register_id);
        const movIn = db2.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements
          WHERE register_id = ? AND payment_method = ? AND type = 'in'
            AND invoice_id IS NULL
        `).get(payload.register_id, method);
        const movOut = db2.prepare(`
          SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements
          WHERE register_id = ? AND payment_method = ? AND type = 'out'
        `).get(payload.register_id, method);
        return invoiceTotal.total + movIn.total - movOut.total;
      };
      const systemCash = reg.initial_cash + calcTotals("cash");
      const systemCard = calcTotals("card");
      const systemTransfer = calcTotals("transfer");
      const diffCash = payload.final_cash_declared - systemCash;
      const diffCard = payload.final_card_declared - systemCard;
      const diffTransfer = payload.final_transfer_declared - systemTransfer;
      db2.prepare(`
        UPDATE cash_registers SET
          status = 'closed',
          closed_by = @closed_by,
          closed_at = @closed_at,
          final_cash_declared     = @final_cash_declared,
          final_card_declared     = @final_card_declared,
          final_transfer_declared = @final_transfer_declared,
          system_cash     = @system_cash,
          system_card     = @system_card,
          system_transfer = @system_transfer,
          diff_cash     = @diff_cash,
          diff_card     = @diff_card,
          diff_transfer = @diff_transfer,
          notes = @notes
        WHERE id = @id
      `).run({
        closed_by: payload.closed_by,
        closed_at: nowISO(),
        final_cash_declared: payload.final_cash_declared,
        final_card_declared: payload.final_card_declared,
        final_transfer_declared: payload.final_transfer_declared,
        system_cash: systemCash,
        system_card: systemCard,
        system_transfer: systemTransfer,
        diff_cash: diffCash,
        diff_card: diffCard,
        diff_transfer: diffTransfer,
        notes: payload.notes ?? null,
        id: payload.register_id
      });
      const diffStr = `Caja cerrada (ID ${payload.register_id}). Diferencias: Efec: $${diffCash.toFixed(2)}, Tarj: $${diffCard.toFixed(2)}, Trans: $${diffTransfer.toFixed(2)}`;
      db2.prepare("INSERT INTO error_log (level, message, context, occurred_at) VALUES ('info', ?, 'AUDIT', ?)").run(diffStr, nowISO());
      return {
        ok: true,
        data: { systemCash, systemCard, systemTransfer, diffCash, diffCard, diffTransfer }
      };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("cash:listMovements", (_e, register_id, params) => {
    try {
      const db2 = getDb();
      const { page = 1, pageSize = 30 } = params;
      const offset = (page - 1) * pageSize;
      const rows = db2.prepare(`
        SELECT m.*, cat.name AS category_name, u.username AS created_by_username
        FROM cash_movements m
        LEFT JOIN cash_movement_categories cat ON cat.id = m.category_id
        LEFT JOIN users u ON u.id = m.created_by
        WHERE m.register_id = ?
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
      `).all(register_id, pageSize, offset);
      const { total } = db2.prepare(
        "SELECT COUNT(*) as total FROM cash_movements WHERE register_id = ?"
      ).get(register_id);
      return { ok: true, data: { items: rows, total, page, pageSize } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("cash:addMovement", (_e, data) => {
    try {
      const db2 = getDb();
      const reg = db2.prepare("SELECT id FROM cash_registers WHERE id = ? AND status = 'open'").get(data.register_id);
      if (!reg) return { ok: false, error: "La caja no está abierta." };
      if (data.amount <= 0) return { ok: false, error: "El monto debe ser mayor a cero." };
      const result = db2.prepare(`
        INSERT INTO cash_movements
          (register_id, category_id, type, payment_method, amount, description, reference, created_by, created_at)
        VALUES
          (@register_id, @category_id, @type, @payment_method, @amount, @description, @reference, @created_by, @created_at)
      `).run({ ...data, created_at: nowISO() });
      const typeStr = data.type === "in" ? "Entrada" : "Salida";
      db2.prepare("INSERT INTO error_log (level, message, context, occurred_at) VALUES ('info', ?, 'AUDIT', ?)").run(`${typeStr} de caja: $${data.amount.toFixed(2)} - ${data.description || "Sin descripción"}`, nowISO());
      return { ok: true, data: { id: result.lastInsertRowid } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("cash:getCategories", () => {
    try {
      const db2 = getDb();
      const rows = db2.prepare("SELECT * FROM cash_movement_categories WHERE is_active = 1 ORDER BY name ASC").all();
      return { ok: true, data: rows };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("cash:listRegisters", (_e, params) => {
    try {
      const db2 = getDb();
      const { page = 1, pageSize = 20, dateFrom, dateTo } = params;
      const offset = (page - 1) * pageSize;
      const filters = [];
      const args = [];
      if (dateFrom) {
        filters.push("DATE(r.opened_at) >= DATE(?)");
        args.push(dateFrom);
      }
      if (dateTo) {
        filters.push("DATE(r.opened_at) <= DATE(?)");
        args.push(dateTo);
      }
      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const rows = db2.prepare(`
        SELECT r.*,
          u1.username AS opened_by_username,
          u2.username AS closed_by_username,
          (SELECT COALESCE(SUM(ip.amount),0)
           FROM invoice_payments ip JOIN invoices i ON i.id = ip.invoice_id
           WHERE i.register_id = r.id AND i.status != 'cancelled') AS total_sales
        FROM cash_registers r
        JOIN users u1 ON u1.id = r.opened_by
        LEFT JOIN users u2 ON u2.id = r.closed_by
        ${where}
        ORDER BY r.opened_at DESC
        LIMIT ? OFFSET ?
      `).all(...args, pageSize, offset);
      const { total } = db2.prepare(
        `SELECT COUNT(*) as total FROM cash_registers r ${where}`
      ).get(...args);
      return { ok: true, data: { items: rows, total, page, pageSize } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("cash:getSummary", (_e, register_id) => {
    try {
      const db2 = getDb();
      const reg = db2.prepare("SELECT * FROM cash_registers WHERE id = ?").get(register_id);
      if (!reg) return { ok: false, error: "Caja no encontrada." };
      const salesByMethod = db2.prepare(`
        SELECT ip.payment_method, COALESCE(SUM(ip.amount),0) as total
        FROM invoice_payments ip
        JOIN invoices i ON i.id = ip.invoice_id
        WHERE i.register_id = ? AND i.status != 'cancelled'
        GROUP BY ip.payment_method
      `).all(register_id);
      const movements = db2.prepare(`
        SELECT type, payment_method, COALESCE(SUM(amount),0) as total
        FROM cash_movements
        WHERE register_id = ? AND invoice_id IS NULL
        GROUP BY type, payment_method
      `).all(register_id);
      const invoiceCounts = db2.prepare(`
        SELECT status, COUNT(*) as count, COALESCE(SUM(total),0) as total
        FROM invoices WHERE register_id = ?
        GROUP BY status
      `).all(register_id);
      return { ok: true, data: { register: reg, salesByMethod, movements, invoiceCounts } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}
function registerInvoiceHandlers(ipcMain) {
  ipcMain.handle("invoices:create", (_e, payload) => {
    try {
      const db2 = getDb();
      const taxSetting = db2.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get();
      const globalTax = parseFloat((taxSetting == null ? void 0 : taxSetting.value) ?? "0");
      const taxRate = payload.apply_tax ? globalTax : 0;
      const result = withTransaction(() => {
        const subtotal = payload.services.reduce((s, svc) => s + svc.unit_price * svc.quantity, 0);
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;
        const paymentsTotal = payload.payments.reduce((s, p) => s + p.amount, 0);
        if (Math.abs(paymentsTotal - total) > 0.02) {
          throw new Error(
            `El total de pagos ($${paymentsTotal.toFixed(2)}) no coincide con el total de la factura ($${total.toFixed(2)}).`
          );
        }
        const folio = getNextInvoiceFolio();
        const now = nowISO();
        const invoiceResult = db2.prepare(`
          INSERT INTO invoices (
            folio, register_id, client_id, created_by,
            subtotal, tax_rate, tax_amount, total,
            status, requires_official_invoice, notes,
            created_at, updated_at
          ) VALUES (
            @folio, @register_id, @client_id, @created_by,
            @subtotal, @tax_rate, @tax_amount, @total,
            'paid', @requires_official_invoice, @notes,
            @created_at, @updated_at
          )
        `).run({
          folio,
          register_id: payload.register_id,
          client_id: payload.client_id,
          created_by: 1,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          requires_official_invoice: payload.requires_official_invoice ? 1 : 0,
          notes: payload.notes,
          created_at: now,
          updated_at: now
        });
        const invoiceId = invoiceResult.lastInsertRowid;
        for (const svc of payload.services) {
          const lineTotal = svc.unit_price * svc.quantity;
          if (svc.employee_ids.length === 0) {
            const ownerCheck = db2.prepare("SELECT owner_employee_id FROM services WHERE id = ?").get(svc.service_id);
            if (!(ownerCheck == null ? void 0 : ownerCheck.owner_employee_id)) {
              throw new Error(`El servicio "${svc.service_name}" no tiene empleado ni jefe asignado. Asigna al menos uno.`);
            }
          }
          const svcResult = db2.prepare(`
            INSERT INTO invoice_services
              (invoice_id, service_id, service_name, unit_price, quantity, line_total, created_at)
            VALUES
              (@invoice_id, @service_id, @service_name, @unit_price, @quantity, @line_total, @created_at)
          `).run({
            invoice_id: invoiceId,
            service_id: svc.service_id,
            service_name: svc.service_name,
            unit_price: svc.unit_price,
            quantity: svc.quantity,
            line_total: lineTotal,
            created_at: now
          });
          const invServiceId = svcResult.lastInsertRowid;
          let totalAuxCommission = 0;
          for (const empId of svc.employee_ids) {
            const empRow = db2.prepare("SELECT commission_pct, first_name, last_name FROM employees WHERE id = ?").get(empId);
            if (!empRow) continue;
            const commissionAmount = lineTotal * (empRow.commission_pct / 100);
            totalAuxCommission += commissionAmount;
            db2.prepare(`
              INSERT INTO invoice_service_employees
                (invoice_service_id, employee_id, commission_pct, work_split_pct, commission_amount, is_owner, created_at)
              VALUES
                (@invoice_service_id, @employee_id, @commission_pct, 100, @commission_amount, 0, @created_at)
            `).run({
              invoice_service_id: invServiceId,
              employee_id: empId,
              commission_pct: empRow.commission_pct,
              commission_amount: commissionAmount,
              created_at: now
            });
          }
          const serviceRow = db2.prepare("SELECT owner_employee_id FROM services WHERE id = ?").get(svc.service_id);
          if (serviceRow == null ? void 0 : serviceRow.owner_employee_id) {
            const ownerRow = db2.prepare("SELECT commission_pct FROM employees WHERE id = ?").get(serviceRow.owner_employee_id);
            const ownerAmount = lineTotal - totalAuxCommission;
            db2.prepare(`
              INSERT OR IGNORE INTO invoice_service_employees
                (invoice_service_id, employee_id, commission_pct, work_split_pct, commission_amount, is_owner, created_at)
              VALUES
                (@invoice_service_id, @employee_id, @commission_pct, 100, @commission_amount, 1, @created_at)
            `).run({
              invoice_service_id: invServiceId,
              employee_id: serviceRow.owner_employee_id,
              commission_pct: (ownerRow == null ? void 0 : ownerRow.commission_pct) ?? 100,
              commission_amount: Math.max(0, ownerAmount),
              created_at: now
            });
          }
        }
        for (const pmt of payload.payments) {
          db2.prepare(`
            INSERT INTO invoice_payments (invoice_id, payment_method, amount, reference, created_at)
            VALUES (@invoice_id, @payment_method, @amount, @reference, @created_at)
          `).run({
            invoice_id: invoiceId,
            payment_method: pmt.payment_method,
            amount: pmt.amount,
            reference: pmt.reference ?? null,
            created_at: now
          });
          if (payload.register_id) {
            db2.prepare(`
              INSERT INTO cash_movements
                (register_id, type, payment_method, amount, description, invoice_id, created_by, created_at)
              VALUES
                (@register_id, 'in', @payment_method, @amount, @description, @invoice_id, 1, @created_at)
            `).run({
              register_id: payload.register_id,
              payment_method: pmt.payment_method,
              amount: pmt.amount,
              description: `Venta ${folio}`,
              invoice_id: invoiceId,
              created_at: now
            });
          }
        }
        if (payload.client_id) {
          db2.prepare(`
            UPDATE clients SET visit_count = visit_count + 1, last_visit_at = @now, updated_at = @now WHERE id = @id
          `).run({ now, id: payload.client_id });
        }
        db2.prepare(`
          INSERT INTO error_log (level, message, context, occurred_at)
          VALUES ('info', ?, 'AUDIT', ?)
        `).run(`Venta creada: Folio ${folio} por $${total.toFixed(2)}`, now);
        return { invoiceId, folio, total };
      });
      return { ok: true, data: result };
    } catch (err) {
      const msg = String(err).replace("Error: ", "");
      try {
        getDb().prepare("INSERT INTO error_log (level, message, context, occurred_at) VALUES ('warn', ?, 'POS', ?)").run(`Fallo al crear venta: ${msg}`, nowISO());
      } catch (_) {
      }
      return { ok: false, error: msg };
    }
  });
  ipcMain.handle("invoices:list", (_e, params) => {
    try {
      const db2 = getDb();
      const {
        page = 1,
        pageSize = 20,
        search = "",
        status,
        dateFrom,
        dateTo,
        requiresOfficial,
        registerId,
        clientSearch
      } = params;
      const offset = (page - 1) * pageSize;
      const filters = [];
      const args = [];
      if (search) {
        filters.push("(i.folio LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)");
        const like = `%${search}%`;
        args.push(like, like, like);
      }
      if (clientSearch) {
        filters.push("(c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ?)");
        const like = `%${clientSearch}%`;
        args.push(like, like, like);
      }
      if (status) {
        filters.push("i.status = ?");
        args.push(status);
      }
      if (dateFrom) {
        filters.push("DATE(i.created_at) >= DATE(?)");
        args.push(dateFrom);
      }
      if (dateTo) {
        filters.push("DATE(i.created_at) <= DATE(?)");
        args.push(dateTo);
      }
      if (requiresOfficial) {
        filters.push("i.requires_official_invoice = 1");
      }
      if (registerId) {
        filters.push("i.register_id = ?");
        args.push(registerId);
      }
      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const rows = db2.prepare(`
        SELECT i.*,
          (c.first_name || ' ' || c.last_name) AS client_name,
          u.username AS created_by_username
        FROM invoices i
        LEFT JOIN clients c ON c.id = i.client_id
        LEFT JOIN users u   ON u.id = i.created_by
        ${where}
        ORDER BY i.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...args, pageSize, offset);
      const { total } = db2.prepare(
        `SELECT COUNT(*) as total FROM invoices i LEFT JOIN clients c ON c.id = i.client_id ${where}`
      ).get(...args);
      return { ok: true, data: { items: rows, total, page, pageSize } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("invoices:getById", (_e, id) => {
    try {
      const db2 = getDb();
      const invoice = db2.prepare(`
        SELECT i.*, (c.first_name || ' ' || c.last_name) AS client_name, u.username AS created_by_username
        FROM invoices i
        LEFT JOIN clients c ON c.id = i.client_id
        LEFT JOIN users u   ON u.id = i.created_by
        WHERE i.id = ?
      `).get(id);
      if (!invoice) return { ok: false, error: "Factura no encontrada." };
      const services = db2.prepare("SELECT * FROM invoice_services WHERE invoice_id = ?").all(id);
      for (const svc of services) {
        ;
        svc.employees = db2.prepare(`
          SELECT ise.*, (e.first_name || ' ' || e.last_name) AS employee_name
          FROM invoice_service_employees ise
          JOIN employees e ON e.id = ise.employee_id
          WHERE ise.invoice_service_id = ?
        `).all(svc.id);
      }
      const payments = db2.prepare("SELECT * FROM invoice_payments WHERE invoice_id = ?").all(id);
      return { ok: true, data: { ...invoice, services, payments } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("invoices:cancel", (_e, id, reason) => {
    try {
      const db2 = getDb();
      const inv = db2.prepare("SELECT id, status, register_id FROM invoices WHERE id = ?").get(id);
      if (!inv) return { ok: false, error: "Factura no encontrada." };
      if (inv.status === "cancelled") return { ok: false, error: "La factura ya está cancelada." };
      withTransaction(() => {
        const now = nowISO();
        db2.prepare(`
          UPDATE invoices SET status = 'cancelled', cancellation_reason = ?,
            cancelled_by = 1, cancelled_at = ?, updated_at = ?
          WHERE id = ?
        `).run(reason || "Sin motivo", now, now, id);
        if (inv.register_id) {
          const payments = db2.prepare("SELECT * FROM invoice_payments WHERE invoice_id = ?").all(id);
          for (const pmt of payments) {
            db2.prepare(`
              INSERT INTO cash_movements
                (register_id, type, payment_method, amount, description, invoice_id, created_by, created_at)
              VALUES (?, 'out', ?, ?, ?, ?, 1, ?)
            `).run(inv.register_id, pmt.payment_method, pmt.amount, `Cancelación #${id}`, id, now);
          }
        }
        db2.prepare(`
          INSERT INTO error_log (level, message, context, occurred_at)
          VALUES ('info', ?, 'AUDIT', ?)
        `).run(`Venta cancelada: ID ${id}. Motivo: ${reason || "Sin motivo"}`, now);
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("invoices:getTaxRate", () => {
    try {
      const db2 = getDb();
      const row = db2.prepare("SELECT value FROM settings WHERE key = 'tax_rate'").get();
      return { ok: true, data: parseFloat((row == null ? void 0 : row.value) ?? "0") };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}
function registerCommissionHandlers(ipcMain) {
  ipcMain.handle("commissions:preview", (_e, dateFrom, dateTo) => {
    try {
      const db2 = getDb();
      const lines = db2.prepare(`
        SELECT
          i.id          AS invoice_id,
          i.folio       AS invoice_folio,
          i.created_at  AS invoice_date,
          is2.id        AS invoice_service_id,
          is2.service_name,
          is2.line_total,
          ise.employee_id,
          (e.first_name || ' ' || e.last_name) AS employee_name,
          e.commission_pct,
          e.base_salary,
          ise.work_split_pct,
          ise.commission_amount
        FROM invoices i
        JOIN invoice_services is2          ON is2.invoice_id = i.id
        JOIN invoice_service_employees ise ON ise.invoice_service_id = is2.id
        JOIN employees e                   ON e.id = ise.employee_id
        WHERE i.status != 'cancelled'
          AND DATE(i.created_at) >= DATE(?)
          AND DATE(i.created_at) <= DATE(?)
        ORDER BY ise.employee_id, i.created_at ASC
      `).all(dateFrom, dateTo);
      const empMap = /* @__PURE__ */ new Map();
      for (const line of lines) {
        if (!empMap.has(line.employee_id)) {
          empMap.set(line.employee_id, {
            employee_id: line.employee_id,
            employee_name: line.employee_name,
            base_salary: line.base_salary,
            commission_pct: line.commission_pct,
            total_services_amount: 0,
            commission_amount: 0,
            details: []
          });
        }
        const emp = empMap.get(line.employee_id);
        const detail = {
          invoice_folio: line.invoice_folio,
          invoice_date: line.invoice_date,
          service_name: line.service_name,
          line_total: line.line_total,
          work_split_pct: line.work_split_pct,
          commission_pct: line.commission_pct,
          commission_amount: line.commission_amount
        };
        emp.details.push(detail);
        emp.total_services_amount += line.line_total * line.work_split_pct / 100;
        emp.commission_amount += line.commission_amount;
      }
      const employees = Array.from(empMap.values());
      const { total_invoiced } = db2.prepare(`
        SELECT COALESCE(SUM(total), 0) AS total_invoiced
        FROM invoices
        WHERE status != 'cancelled'
          AND DATE(created_at) >= DATE(?)
          AND DATE(created_at) <= DATE(?)
      `).get(dateFrom, dateTo);
      const total_commissions = employees.reduce((s, e) => s + e.commission_amount, 0);
      const total_business = total_invoiced - total_commissions;
      const preview = {
        date_from: dateFrom,
        date_to: dateTo,
        employees,
        total_invoiced,
        total_commissions,
        total_business
      };
      return { ok: true, data: preview };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("commissions:confirm", (_e, dateFrom, dateTo, notes) => {
    try {
      const db2 = getDb();
      const existing = db2.prepare(`
        SELECT id FROM commission_runs
        WHERE status = 'confirmed'
          AND date_from = ? AND date_to = ?
      `).get(dateFrom, dateTo);
      if (existing) return { ok: false, error: "Ya existe un cuadre confirmado para este rango de fechas." };
      const result = withTransaction(() => {
        const now = nowISO();
        const lines = db2.prepare(`
          SELECT
            i.id AS invoice_id, i.folio AS invoice_folio, i.created_at AS invoice_date,
            is2.id AS invoice_service_id, is2.service_name, is2.line_total,
            ise.employee_id, (e.first_name || ' ' || e.last_name) AS employee_name,
            e.commission_pct, e.base_salary, ise.work_split_pct, ise.commission_amount
          FROM invoices i
          JOIN invoice_services is2          ON is2.invoice_id = i.id
          JOIN invoice_service_employees ise ON ise.invoice_service_id = is2.id
          JOIN employees e                   ON e.id = ise.employee_id
          WHERE i.status != 'cancelled'
            AND DATE(i.created_at) >= DATE(?)
            AND DATE(i.created_at) <= DATE(?)
        `).all(dateFrom, dateTo);
        const { total_invoiced } = db2.prepare(`
          SELECT COALESCE(SUM(total), 0) AS total_invoiced FROM invoices
          WHERE status != 'cancelled' AND DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)
        `).get(dateFrom, dateTo);
        const total_commissions = lines.reduce((s, l) => s + l.commission_amount, 0);
        const total_business = total_invoiced - total_commissions;
        const runResult = db2.prepare(`
          INSERT INTO commission_runs
            (executed_by, date_from, date_to, status, total_commissions, total_business, notes, confirmed_at, created_at)
          VALUES (1, @date_from, @date_to, 'confirmed', @total_commissions, @total_business, @notes, @now, @now)
        `).run({ date_from: dateFrom, date_to: dateTo, total_commissions, total_business, notes: notes ?? null, now });
        const runId = runResult.lastInsertRowid;
        const insertDetail = db2.prepare(`
          INSERT INTO commission_details (
            run_id, employee_id, invoice_id, invoice_service_id,
            employee_name, service_name, invoice_folio, invoice_date,
            line_total, work_split_pct, commission_pct, commission_amount,
            base_salary_snapshot, created_at
          ) VALUES (
            @run_id, @employee_id, @invoice_id, @invoice_service_id,
            @employee_name, @service_name, @invoice_folio, @invoice_date,
            @line_total, @work_split_pct, @commission_pct, @commission_amount,
            @base_salary_snapshot, @created_at
          )
        `);
        for (const line of lines) {
          insertDetail.run({
            run_id: runId,
            employee_id: line.employee_id,
            invoice_id: line.invoice_id,
            invoice_service_id: line.invoice_service_id,
            employee_name: line.employee_name,
            service_name: line.service_name,
            invoice_folio: line.invoice_folio,
            invoice_date: line.invoice_date,
            line_total: line.line_total,
            work_split_pct: line.work_split_pct,
            commission_pct: line.commission_pct,
            commission_amount: line.commission_amount,
            base_salary_snapshot: line.base_salary,
            created_at: now
          });
        }
        return { runId, total_commissions, total_business };
      });
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: String(err).replace("Error: ", "") };
    }
  });
  ipcMain.handle("commissions:listRuns", (_e, params) => {
    try {
      const db2 = getDb();
      const { page = 1, pageSize = 20 } = params;
      const offset = (page - 1) * pageSize;
      const rows = db2.prepare(`
        SELECT r.*, u.username AS executed_by_username
        FROM commission_runs r
        JOIN users u ON u.id = r.executed_by
        WHERE r.status = 'confirmed'
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `).all(pageSize, offset);
      const { total } = db2.prepare(
        "SELECT COUNT(*) as total FROM commission_runs WHERE status = 'confirmed'"
      ).get();
      return { ok: true, data: { items: rows, total, page, pageSize } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("commissions:getRunDetail", (_e, runId) => {
    try {
      const db2 = getDb();
      const run = db2.prepare("SELECT * FROM commission_runs WHERE id = ?").get(runId);
      if (!run) return { ok: false, error: "Cuadre no encontrado." };
      const details = db2.prepare(`
        SELECT * FROM commission_details WHERE run_id = ? ORDER BY employee_name, invoice_date ASC
      `).all(runId);
      return { ok: true, data: { run, details } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}
function registerSettingsHandlers(ipcMain) {
  ipcMain.handle("settings:getAll", () => {
    try {
      const db2 = getDb();
      const rows = db2.prepare("SELECT key, value FROM settings").all();
      const obj = {};
      rows.forEach((r) => {
        obj[r.key] = r.value;
      });
      return { ok: true, data: obj };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
  ipcMain.handle("settings:set", (_e, updates) => {
    try {
      const db2 = getDb();
      const now = nowISO();
      const stmt = db2.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)");
      const run = db2.transaction(() => {
        for (const [key, value] of Object.entries(updates)) {
          stmt.run(key, String(value), now);
        }
      });
      run();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}
function registerDashboardHandlers(ipcMain) {
  ipcMain.handle("dashboard:getStats", (_e, dateFrom, dateTo) => {
    try {
      const db2 = getDb();
      const now = /* @__PURE__ */ new Date();
      const from = dateFrom ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const to = dateTo ?? now.toISOString().split("T")[0];
      const sales = db2.prepare(`
        SELECT
          COUNT(*)                          AS invoice_count,
          COALESCE(SUM(subtotal),  0)       AS total_subtotal,
          COALESCE(SUM(tax_amount),0)       AS total_tax,
          COALESCE(SUM(total),     0)       AS total_revenue
        FROM invoices
        WHERE status != 'cancelled'
          AND DATE(created_at) >= DATE(?)
          AND DATE(created_at) <= DATE(?)
      `).get(from, to);
      const salesByMethod = db2.prepare(`
        SELECT ip.payment_method, COALESCE(SUM(ip.amount), 0) AS total
        FROM invoice_payments ip
        JOIN invoices i ON i.id = ip.invoice_id
        WHERE i.status != 'cancelled'
          AND DATE(i.created_at) >= DATE(?)
          AND DATE(i.created_at) <= DATE(?)
        GROUP BY ip.payment_method
      `).all(from, to);
      const commissions = db2.prepare(`
        SELECT COALESCE(SUM(commission_amount), 0) AS total_commissions
        FROM invoice_service_employees ise
        JOIN invoice_services is2 ON is2.id = ise.invoice_service_id
        JOIN invoices i           ON i.id   = is2.invoice_id
        WHERE i.status != 'cancelled'
          AND DATE(i.created_at) >= DATE(?)
          AND DATE(i.created_at) <= DATE(?)
      `).get(from, to);
      const commissionsByEmployee = db2.prepare(`
        SELECT
          e.id,
          (e.first_name || ' ' || e.last_name) AS name,
          e.role,
          e.calendar_color,
          COALESCE(SUM(ise.commission_amount), 0) AS commission_amount,
          COALESCE(SUM(is2.line_total), 0)        AS services_total
        FROM invoice_service_employees ise
        JOIN employees e              ON e.id   = ise.employee_id
        JOIN invoice_services is2     ON is2.id = ise.invoice_service_id
        JOIN invoices i               ON i.id   = is2.invoice_id
        WHERE i.status != 'cancelled'
          AND DATE(i.created_at) >= DATE(?)
          AND DATE(i.created_at) <= DATE(?)
        GROUP BY e.id
        ORDER BY commission_amount DESC
        LIMIT 10
      `).all(from, to);
      const topServices = db2.prepare(`
        SELECT
          is2.service_name,
          COUNT(*)                          AS count,
          COALESCE(SUM(is2.line_total), 0)  AS revenue
        FROM invoice_services is2
        JOIN invoices i ON i.id = is2.invoice_id
        WHERE i.status != 'cancelled'
          AND DATE(i.created_at) >= DATE(?)
          AND DATE(i.created_at) <= DATE(?)
        GROUP BY is2.service_name
        ORDER BY count DESC
        LIMIT 5
      `).all(from, to);
      const cancelled = db2.prepare(`
        SELECT COUNT(*) AS count FROM invoices
        WHERE status = 'cancelled'
          AND DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)
      `).get(from, to);
      const pendingOfficial = db2.prepare(`
        SELECT COUNT(*) AS count FROM invoices
        WHERE requires_official_invoice = 1 AND status = 'paid'
      `).get();
      const uniqueClients = db2.prepare(`
        SELECT COUNT(DISTINCT client_id) AS count FROM invoices
        WHERE status != 'cancelled' AND client_id IS NOT NULL
          AND DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)
      `).get(from, to);
      const dailySales = db2.prepare(`
        SELECT DATE(created_at) AS day, COALESCE(SUM(total), 0) AS total
        FROM invoices
        WHERE status != 'cancelled'
          AND DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `).all(from, to);
      const lowStockCount = db2.prepare(`
        SELECT COUNT(*) AS count FROM inventory_products
        WHERE is_active = 1 AND quantity <= min_stock AND min_stock > 0
      `).get().count;
      return {
        ok: true,
        data: {
          period: { from, to },
          sales,
          salesByMethod,
          commissions,
          commissionsByEmployee,
          topServices,
          cancelled: cancelled.count,
          pendingOfficial: pendingOfficial.count,
          uniqueClients: uniqueClients.count,
          dailySales,
          lowStockCount
        }
      };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });
}
const OAUTH_PORT = 3737;
const REDIRECT_URI = `http://localhost:${OAUTH_PORT}/callback`;
const SCOPES = ["https://www.googleapis.com/auth/calendar"];
function buildOAuthClient() {
  var _a, _b;
  const db2 = getDb();
  const cid = ((_a = db2.prepare("SELECT value FROM settings WHERE key='google_client_id'").get()) == null ? void 0 : _a.value) ?? "";
  const sec = ((_b = db2.prepare("SELECT value FROM settings WHERE key='google_secret'").get()) == null ? void 0 : _b.value) ?? "";
  if (!cid || !sec) throw new Error("Credenciales de Google no configuradas. Ve a Ajustes → Google Calendar.");
  return new googleapis.google.auth.OAuth2(cid, sec, REDIRECT_URI);
}
function loadTokens(oauth2) {
  const db2 = getDb();
  const row = db2.prepare("SELECT * FROM google_oauth_tokens WHERE id = 1").get();
  if (!row) return false;
  oauth2.setCredentials({
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    token_type: row.token_type,
    expiry_date: row.expiry_date ?? void 0,
    scope: row.scope ?? void 0
  });
  oauth2.on("tokens", (tokens) => {
    const db22 = getDb();
    const now2 = nowISO();
    db22.prepare(`
      INSERT OR REPLACE INTO google_oauth_tokens
        (id, access_token, refresh_token, token_type, expiry_date, scope, updated_at)
      VALUES (1, @access_token, @refresh_token, @token_type, @expiry_date, @scope, @now)
    `).run({
      access_token: tokens.access_token ?? row.access_token,
      refresh_token: tokens.refresh_token ?? row.refresh_token,
      token_type: tokens.token_type ?? "Bearer",
      expiry_date: tokens.expiry_date ?? null,
      scope: tokens.scope ?? row.scope,
      now: now2
    });
  });
  return true;
}
function getSalonCalendarId() {
  const row = getDb().prepare("SELECT value FROM settings WHERE key='google_calendar_id'").get();
  return (row == null ? void 0 : row.value) ?? "primary";
}
async function pullFromGoogle(oauth2, dateFrom, dateTo) {
  var _a, _b, _c, _d, _e;
  const db2 = getDb();
  const cal = googleapis.google.calendar({ version: "v3", auth: oauth2 });
  const calId = getSalonCalendarId();
  const now = nowISO();
  const from = dateFrom ? /* @__PURE__ */ new Date(dateFrom + "T00:00:00") : (() => {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - 7);
    return d;
  })();
  const to = dateTo ? /* @__PURE__ */ new Date(dateTo + "T23:59:59") : (() => {
    const d = /* @__PURE__ */ new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d;
  })();
  let imported = 0;
  let updated = 0;
  let pageToken = void 0;
  do {
    const resp = await cal.events.list({
      calendarId: calId,
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 500,
      // máx por página (API permite hasta 2500)
      pageToken
      // undefined en la primera iteración
    });
    pageToken = resp.data.nextPageToken ?? void 0;
    const events = resp.data.items ?? [];
    for (const ev of events) {
      if (!ev.id || !ev.summary) continue;
      if (ev.status === "cancelled") continue;
      const startAt = ((_a = ev.start) == null ? void 0 : _a.dateTime) ?? (((_b = ev.start) == null ? void 0 : _b.date) ? ev.start.date + "T00:00:00" : null);
      const endAt = ((_c = ev.end) == null ? void 0 : _c.dateTime) ?? (((_d = ev.end) == null ? void 0 : _d.date) ? ev.end.date + "T00:00:00" : null);
      if (!startAt || !endAt) continue;
      const existing = db2.prepare("SELECT id FROM appointments WHERE google_event_id = ?").get(ev.id);
      if (existing) {
        db2.prepare(`
          UPDATE appointments SET
            title = ?, start_at = ?, end_at = ?, description = ?,
            sync_status = 'synced', last_synced_at = ?, updated_at = ?
          WHERE google_event_id = ?
        `).run(ev.summary, startAt, endAt, ev.description ?? null, now, now, ev.id);
        updated++;
      } else {
        db2.prepare(`
          INSERT INTO appointments
            (google_event_id, title, description, start_at, end_at,
             all_day, color, sync_status, last_synced_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?)
        `).run(
          ev.id,
          ev.summary,
          ev.description ?? null,
          startAt,
          endAt,
          ((_e = ev.start) == null ? void 0 : _e.date) ? 1 : 0,
          googleColorIdToName(ev.colorId ?? ""),
          now,
          now,
          now
        );
        imported++;
      }
    }
  } while (pageToken);
  return { imported, updated };
}
async function pushToGoogle(appointmentId) {
  const db2 = getDb();
  const apt = db2.prepare(`
    SELECT a.*,
      (e.first_name || ' ' || e.last_name) AS employee_name,
      (c.first_name || ' ' || c.last_name) AS client_name,
      s.name AS service_name
    FROM appointments a
    LEFT JOIN employees e ON e.id = a.employee_id
    LEFT JOIN clients   c ON c.id = a.client_id
    LEFT JOIN services  s ON s.id = a.service_id
    WHERE a.id = ?
  `).get(appointmentId);
  if (!apt || apt.sync_status === "cancelled") return;
  const oauth2 = buildOAuthClient();
  if (!loadTokens(oauth2)) return;
  const cal = googleapis.google.calendar({ version: "v3", auth: oauth2 });
  const calId = getSalonCalendarId();
  const now = nowISO();
  const description = [
    apt.client_name ? `Cliente: ${apt.client_name}` : null,
    apt.service_name ? `Servicio: ${apt.service_name}` : null,
    apt.employee_name ? `Empleado: ${apt.employee_name}` : null,
    apt.description ?? null
  ].filter(Boolean).join("\n");
  const eventBody = {
    summary: apt.title,
    description: description || void 0,
    start: apt.all_day ? { date: apt.start_at.split("T")[0] } : { dateTime: apt.start_at, timeZone: "America/Mexico_City" },
    end: apt.all_day ? { date: apt.end_at.split("T")[0] } : { dateTime: apt.end_at, timeZone: "America/Mexico_City" },
    colorId: colorNameToGoogleId(apt.color)
  };
  if (apt.google_event_id) {
    await cal.events.patch({ calendarId: calId, eventId: apt.google_event_id, requestBody: eventBody });
    db2.prepare("UPDATE appointments SET sync_status=?,last_synced_at=?,updated_at=? WHERE id=?").run("synced", now, now, appointmentId);
  } else {
    const resp = await cal.events.insert({ calendarId: calId, requestBody: eventBody });
    const eventId = resp.data.id ?? null;
    db2.prepare("UPDATE appointments SET google_event_id=?,sync_status=?,last_synced_at=?,updated_at=? WHERE id=?").run(eventId, "synced", now, now, appointmentId);
  }
}
function detectOverlaps(employeeId, startAt, endAt, excludeId) {
  return getDb().prepare(`
    SELECT a.*,
      (e.first_name || ' ' || e.last_name) AS employee_name,
      (c.first_name || ' ' || c.last_name) AS client_name,
      s.name AS service_name
    FROM appointments a
    LEFT JOIN employees e ON e.id = a.employee_id
    LEFT JOIN clients   c ON c.id = a.client_id
    LEFT JOIN services  s ON s.id = a.service_id
    WHERE a.employee_id = ?
      AND a.sync_status != 'cancelled'
      AND a.id != COALESCE(?, -1)
      AND a.start_at < ?
      AND a.end_at   > ?
    ORDER BY a.start_at ASC
  `).all(employeeId, excludeId ?? null, endAt, startAt);
}
function googleColorIdToName(id) {
  const m = { "1": "lavender", "2": "sage", "3": "grape", "4": "flamingo", "5": "banana", "6": "tangerine", "7": "peacock", "8": "graphite", "9": "blueberry", "10": "basil", "11": "tomato" };
  return m[id] ?? "peacock";
}
function colorNameToGoogleId(name) {
  const m = { lavender: "1", sage: "2", grape: "3", flamingo: "4", banana: "5", tangerine: "6", peacock: "7", graphite: "8", blueberry: "9", basil: "10", tomato: "11" };
  return name ? m[name] : void 0;
}
function registerCalendarHandlers(ipcMain) {
  ipcMain.handle("calendar:getStatus", () => {
    var _a;
    try {
      const db2 = getDb();
      const row = db2.prepare("SELECT connected_at, updated_at FROM google_oauth_tokens WHERE id=1").get();
      const cid = ((_a = db2.prepare("SELECT value FROM settings WHERE key='google_client_id'").get()) == null ? void 0 : _a.value) ?? "";
      return { ok: true, data: { connected: !!row, connected_at: (row == null ? void 0 : row.connected_at) ?? null, has_credentials: !!cid, calendar_id: getSalonCalendarId() } };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
  ipcMain.handle("calendar:connect", async () => {
    try {
      const oauth2 = buildOAuthClient();
      const url$1 = oauth2.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES });
      const code = await new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
          try {
            const u = new url.URL(req.url ?? "/", `http://localhost:${OAUTH_PORT}`);
            const code2 = u.searchParams.get("code");
            const error = u.searchParams.get("error");
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Luma</title>
              <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f0d0b;color:#f5f0e8;}
              .box{text-align:center;padding:2rem;border-radius:12px;background:#1a1714;border:1px solid #2e2920;}
              h2{color:${error ? "#dc4a3d" : "#4caf7d"};margin-bottom:1rem;}p{color:#8a8070;}</style></head>
              <body><div class="box"><h2>${error ? "❌ Error" : "✅ ¡Conectado!"}</h2>
              <p>${error ? `Error: ${error}` : "Luma App autorizada. Puedes cerrar esta ventana."}</p>
              </div><script>setTimeout(()=>window.close(),2000)<\/script></body></html>`;
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(html);
            server.close();
            if (error) reject(new Error(`Google rechazó: ${error}`));
            else if (code2) resolve(code2);
            else reject(new Error("Sin código de autorización."));
          } catch (e) {
            reject(e);
          }
        });
        server.listen(OAUTH_PORT, "localhost", () => electron.shell.openExternal(url$1));
        setTimeout(() => {
          server.close();
          reject(new Error("Tiempo de espera agotado."));
        }, 18e4);
      });
      const { tokens } = await oauth2.getToken(code);
      oauth2.setCredentials(tokens);
      const db2 = getDb();
      const now = nowISO();
      db2.prepare(`
        INSERT OR REPLACE INTO google_oauth_tokens
          (id, access_token, refresh_token, token_type, expiry_date, scope, connected_at, updated_at)
        VALUES (1, @access_token, @refresh_token, @token_type, @expiry_date, @scope, @now, @now)
      `).run({
        access_token: tokens.access_token ?? "",
        refresh_token: tokens.refresh_token ?? "",
        token_type: tokens.token_type ?? "Bearer",
        expiry_date: tokens.expiry_date ?? null,
        scope: tokens.scope ?? SCOPES.join(" "),
        now
      });
      let pullResult = { imported: 0, updated: 0 };
      try {
        pullResult = await pullFromGoogle(oauth2);
      } catch (_) {
      }
      return { ok: true, data: pullResult };
    } catch (e) {
      return { ok: false, error: String(e).replace("Error: ", "") };
    }
  });
  ipcMain.handle("calendar:disconnect", () => {
    try {
      getDb().prepare("DELETE FROM google_oauth_tokens WHERE id=1").run();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
  ipcMain.handle("calendar:listCalendars", async () => {
    try {
      const oauth2 = buildOAuthClient();
      if (!loadTokens(oauth2)) return { ok: false, error: "No conectado." };
      const cal = googleapis.google.calendar({ version: "v3", auth: oauth2 });
      const resp = await cal.calendarList.list({ minAccessRole: "writer" });
      return { ok: true, data: (resp.data.items ?? []).map((c) => ({ id: c.id, summary: c.summary, primary: c.primary ?? false, color: c.backgroundColor })) };
    } catch (e) {
      return { ok: false, error: String(e).replace("Error: ", "") };
    }
  });
  ipcMain.handle("calendar:listAppointments", async (_e, dateFrom, dateTo) => {
    try {
      const db2 = getDb();
      const localCount = db2.prepare(`
        SELECT COUNT(*) as n FROM appointments
        WHERE sync_status != 'cancelled'
          AND DATE(start_at) >= DATE(?) AND DATE(start_at) <= DATE(?)
      `).get(dateFrom, dateTo).n;
      if (localCount === 0) {
        const tokenRow = db2.prepare("SELECT id FROM google_oauth_tokens WHERE id=1").get();
        if (tokenRow) {
          try {
            const oauth2 = buildOAuthClient();
            if (loadTokens(oauth2)) {
              await pullFromGoogle(oauth2, dateFrom, dateTo);
            }
          } catch (_) {
          }
        }
      }
      const rows = db2.prepare(`
        SELECT a.*,
          (e.first_name || ' ' || e.last_name) AS employee_name,
          e.calendar_color                      AS employee_color,
          (c.first_name || ' ' || c.last_name) AS client_name,
          s.name                                AS service_name
        FROM appointments a
        LEFT JOIN employees e ON e.id = a.employee_id
        LEFT JOIN clients   c ON c.id = a.client_id
        LEFT JOIN services  s ON s.id = a.service_id
        WHERE a.sync_status != 'cancelled'
          AND DATE(a.start_at) >= DATE(?)
          AND DATE(a.start_at) <= DATE(?)
        ORDER BY a.start_at ASC
      `).all(dateFrom, dateTo);
      return { ok: true, data: rows };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
  ipcMain.handle("calendar:checkOverlaps", (_e, employeeId, startAt, endAt, excludeId) => {
    try {
      if (!employeeId) return { ok: true, data: [] };
      return { ok: true, data: detectOverlaps(employeeId, startAt, endAt, excludeId) };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
  ipcMain.handle("calendar:createAppointment", async (_e, data) => {
    try {
      const db2 = getDb();
      const now = nowISO();
      let overlaps = [];
      if (data.employee_id) overlaps = detectOverlaps(data.employee_id, data.start_at, data.end_at);
      if (overlaps.length > 0 && !data.force)
        return { ok: false, code: "OVERLAP", error: `El empleado ya tiene ${overlaps.length} cita(s) en ese horario.`, data: overlaps };
      const result = db2.prepare(`
        INSERT INTO appointments
          (employee_id, client_id, service_id, title, description,
           start_at, end_at, all_day, color, sync_status, created_at, updated_at)
        VALUES (@employee_id,@client_id,@service_id,@title,@description,
                @start_at,@end_at,@all_day,@color,'local',@now,@now)
      `).run({
        employee_id: data.employee_id ?? null,
        client_id: data.client_id ?? null,
        service_id: data.service_id ?? null,
        title: data.title,
        description: data.description ?? null,
        start_at: data.start_at,
        end_at: data.end_at,
        all_day: data.all_day ? 1 : 0,
        color: data.color ?? null,
        now
      });
      const id = result.lastInsertRowid;
      const tokenRow = db2.prepare("SELECT id FROM google_oauth_tokens WHERE id=1").get();
      if (tokenRow) try {
        await pushToGoogle(id);
      } catch (_) {
      }
      return { ok: true, data: { id, overlaps } };
    } catch (e) {
      return { ok: false, error: String(e).replace("Error: ", "") };
    }
  });
  ipcMain.handle("calendar:updateAppointment", async (_e, id, data) => {
    try {
      const db2 = getDb();
      const cur = db2.prepare("SELECT * FROM appointments WHERE id=?").get(id);
      if (!cur) return { ok: false, error: "Cita no encontrada." };
      const newEmpId = data.employee_id !== void 0 ? data.employee_id : cur.employee_id;
      const newStartAt = data.start_at ?? cur.start_at;
      const newEndAt = data.end_at ?? cur.end_at;
      let overlaps = [];
      if (newEmpId) overlaps = detectOverlaps(newEmpId, newStartAt, newEndAt, id);
      if (overlaps.length > 0 && !data.force)
        return { ok: false, code: "OVERLAP", error: `El empleado ya tiene ${overlaps.length} cita(s) en ese horario.`, data: overlaps };
      const now = nowISO();
      db2.prepare(`
        UPDATE appointments SET
          employee_id=@employee_id, client_id=@client_id, service_id=@service_id,
          title=@title, description=@description, start_at=@start_at, end_at=@end_at,
          all_day=@all_day, color=@color, sync_status='pending_sync', updated_at=@now
        WHERE id=@id
      `).run({
        employee_id: newEmpId,
        client_id: data.client_id !== void 0 ? data.client_id : cur.client_id,
        service_id: data.service_id !== void 0 ? data.service_id : cur.service_id,
        title: data.title ?? cur.title,
        description: data.description ?? cur.description,
        start_at: newStartAt,
        end_at: newEndAt,
        all_day: data.all_day ?? cur.all_day ? 1 : 0,
        color: data.color ?? cur.color,
        now,
        id
      });
      const tokenRow = db2.prepare("SELECT id FROM google_oauth_tokens WHERE id=1").get();
      if (tokenRow) try {
        await pushToGoogle(id);
      } catch (_) {
      }
      return { ok: true, data: { overlaps } };
    } catch (e) {
      return { ok: false, error: String(e).replace("Error: ", "") };
    }
  });
  ipcMain.handle("calendar:cancelAppointment", async (_e, id) => {
    try {
      const db2 = getDb();
      const cur = db2.prepare("SELECT * FROM appointments WHERE id=?").get(id);
      if (!cur) return { ok: false, error: "Cita no encontrada." };
      db2.prepare("UPDATE appointments SET sync_status=?,updated_at=? WHERE id=?").run("cancelled", nowISO(), id);
      if (cur.google_event_id) {
        const tokenRow = db2.prepare("SELECT id FROM google_oauth_tokens WHERE id=1").get();
        if (tokenRow) {
          try {
            const oauth2 = buildOAuthClient();
            loadTokens(oauth2);
            await googleapis.google.calendar({ version: "v3", auth: oauth2 }).events.delete({ calendarId: getSalonCalendarId(), eventId: cur.google_event_id });
          } catch (_) {
          }
        }
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e).replace("Error: ", "") };
    }
  });
  ipcMain.handle("calendar:sync", async () => {
    try {
      const db2 = getDb();
      if (!db2.prepare("SELECT id FROM google_oauth_tokens WHERE id=1").get()) return { ok: false, error: "No conectado." };
      const pending = db2.prepare("SELECT id FROM appointments WHERE sync_status='pending_sync' ORDER BY updated_at ASC LIMIT 50").all();
      let synced = 0;
      let errors = 0;
      for (const row of pending) {
        try {
          await pushToGoogle(row.id);
          synced++;
        } catch (_) {
          errors++;
        }
      }
      return { ok: true, data: { synced, errors, total: pending.length } };
    } catch (e) {
      return { ok: false, error: String(e).replace("Error: ", "") };
    }
  });
  ipcMain.handle("calendar:pull", async (_e, dateFrom, dateTo) => {
    try {
      const oauth2 = buildOAuthClient();
      if (!loadTokens(oauth2)) return { ok: false, error: "No conectado a Google Calendar." };
      const result = await pullFromGoogle(oauth2, dateFrom, dateTo);
      return { ok: true, data: result };
    } catch (e) {
      return { ok: false, error: String(e).replace("Error: ", "") };
    }
  });
}
function registerAllHandlers(ipcMain) {
  registerAppHandlers(ipcMain);
  registerEmployeeHandlers(ipcMain);
  registerServiceHandlers(ipcMain);
  registerClientHandlers(ipcMain);
  registerInventoryHandlers(ipcMain);
  registerCashRegisterHandlers(ipcMain);
  registerInvoiceHandlers(ipcMain);
  registerCommissionHandlers(ipcMain);
  registerSettingsHandlers(ipcMain);
  registerDashboardHandlers(ipcMain);
  registerCalendarHandlers(ipcMain);
}
const isDev = !electron.app.isPackaged;
let mainWindow = null;
async function createWindow() {
  const preloadPath = path.join(__dirname, "../preload/preload.js");
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#0f0d0b",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow == null ? void 0 : mainWindow.show();
    if (isDev) {
      mainWindow == null ? void 0 : mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  });
  if (isDev) {
    await mainWindow.loadURL("http://localhost:5173");
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.webContents.setWindowOpenHandler(({ url: url2 }) => {
    electron.shell.openExternal(url2);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
electron.app.whenReady().then(async () => {
  setupLogger();
  try {
    await initDatabase();
  } catch (err) {
    console.error("[Main] Error al inicializar base de datos:", err);
  }
  registerAllHandlers(electron.ipcMain);
  await createWindow();
  electron.app.on("activate", async () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
//# sourceMappingURL=main.js.map
