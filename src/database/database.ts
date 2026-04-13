import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db: Database.Database

function log(msg: string) {
  console.log(`[DB] ${new Date().toISOString()} ${msg}`)
}

export async function initDatabase(): Promise<void> {
  const dbPath = path.join(app.getPath('userData'), 'luma.db')
  log(`Abriendo base de datos en: ${dbPath}`)

  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000') // <-- CRÍTICO: Esperar hasta 5 segundos si está ocupada
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = -32000')
  db.pragma('temp_store = MEMORY')

  runMigrations()
  log('Base de datos inicializada correctamente.')
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Base de datos no inicializada. Llamar initDatabase() primero.')
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    log('Conexión a la base de datos cerrada.')
  }
}

// ── Migraciones ──────────────────────────────────────────────────────────────

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version     INTEGER PRIMARY KEY,
      applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const current = getCurrentVersion()

  if (current < 1) applyMigration1()
  if (current < 2) applyMigration2()
  if (current < 3) applyMigration3()
  if (current < 4) applyMigration4()
  if (current < 5) applyMigration5()   // ← Google OAuth tokens del salón
  if (current < 6) applyMigration6()   // ← WhatsApp reminder log + settings
}

function getCurrentVersion(): number {
  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null }
  return row?.v ?? 0
}

function setVersion(v: number) {
  db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(v)
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRACIÓN 1 — Tablas base del sistema
// ─────────────────────────────────────────────────────────────────────────────
function applyMigration1() {
  log('Aplicando migración 1: tablas base del sistema...')
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
  `)
  setVersion(1)
  log('Migración 1 completada.')
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRACIÓN 2 — Schema completo de negocio
// ─────────────────────────────────────────────────────────────────────────────
function applyMigration2() {
  log('Aplicando migración 2: schema completo de negocio...')

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
    `)

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
    `)

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
    `)

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
    `)

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
    `)

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
    `)

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
    `)

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
    `)

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
    `)

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
    `)

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
    `)

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
    `)

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
    `)

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
    `)

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
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS invoice_sequence (
        id       INTEGER PRIMARY KEY CHECK(id = 1),
        last_seq INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO invoice_sequence (id, last_seq) VALUES (1, 0);
    `)

  })

  migrate()
  setVersion(2)
  log('Migración 2 completada: schema completo de negocio listo.')
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRACIÓN 3 — Agregar campo "role" a employees + índice de nombre único
// ─────────────────────────────────────────────────────────────────────────────
function applyMigration3() {
  log('Aplicando migración 3: campo role en employees...')
  const migrate = db.transaction(() => {
    db.exec(`
      ALTER TABLE employees ADD COLUMN role TEXT NOT NULL DEFAULT 'employee';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_unique_name
        ON employees(first_name, last_name);
    `)
  })
  migrate()
  setVersion(3)
  log('Migración 3 completada.')
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRACIÓN 4 — owner_employee_id en services + historial de tarifas
// ─────────────────────────────────────────────────────────────────────────────
function applyMigration4() {
  log('Aplicando migración 4: owner_employee_id + employee_rate_history...')
  const migrate = db.transaction(() => {
    db.exec(`
      ALTER TABLE services ADD COLUMN
        owner_employee_id INTEGER REFERENCES employees(id);
      CREATE INDEX IF NOT EXISTS idx_services_owner ON services(owner_employee_id);
    `)
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
    `)
  })
  migrate()
  setVersion(4)
  log('Migración 4 completada.')
}

// ─────────────────────────────────────────────────────────────────────────────
// MIGRACIÓN 5 — Tokens OAuth2 de Google Calendar (cuenta única del salón)
// ─────────────────────────────────────────────────────────────────────────────
function applyMigration5() {
  log('Aplicando migración 5: tokens OAuth Google Calendar...')
  const migrate = db.transaction(() => {
    // Tabla para guardar el token OAuth2 del salón
    // Un solo registro (id=1). access_token se renueva automáticamente
    // con el refresh_token cuando expira.
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
    `)

    // Agregar seeds de settings para el calendar_id del salón
    // (El admin elige qué calendario de Google usar para el salón)
    db.exec(`
      INSERT OR IGNORE INTO settings (key, value) VALUES
        ('google_calendar_id', 'primary');
    `)
  })
  migrate()
  setVersion(5)
  log('Migración 5 completada.')
}



// ─────────────────────────────────────────────────────────────────────────────
// MIGRACIÓN 6 — WhatsApp: log de recordatorios + settings de plantillas
// ─────────────────────────────────────────────────────────────────────────────
function applyMigration6() {
  log('Aplicando migración 6: WhatsApp reminder log + settings...')
  const migrate = db.transaction(() => {

    // Registro de cada mensaje enviado (evita duplicados y sirve de auditoría)
    db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_reminder_log (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        appointment_id  INTEGER NOT NULL REFERENCES appointments(id),
        client_id       INTEGER REFERENCES clients(id),
        phone           TEXT    NOT NULL,
        reminder_type   TEXT    NOT NULL
                          CHECK(reminder_type IN ('1d', '3d', '7d', 'manual')),
        message_preview TEXT    NOT NULL,
        status          TEXT    NOT NULL DEFAULT 'pending'
                          CHECK(status IN ('pending', 'sent', 'failed', 'skipped')),
        error_message   TEXT,
        sent_at         TEXT,
        created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_wa_log_appointment ON whatsapp_reminder_log(appointment_id);
      CREATE INDEX IF NOT EXISTS idx_wa_log_status      ON whatsapp_reminder_log(status);
      CREATE INDEX IF NOT EXISTS idx_wa_log_date        ON whatsapp_reminder_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_wa_log_type_appt   ON whatsapp_reminder_log(reminder_type, appointment_id);
    `)

    // Seeds de settings para WhatsApp
    db.exec(`
      INSERT OR IGNORE INTO settings (key, value) VALUES
        ('wa_enabled',           'false'),
        ('wa_reminder_1d',       'true'),
        ('wa_reminder_3d',       'true'),
        ('wa_reminder_7d',       'false'),
        ('wa_max_per_day',       '60'),
        ('wa_delay_seconds',     '12'),
        ('wa_send_hour',         '9'),
        ('wa_template_1d',       'Hola {nombre}, te recordamos tu cita en {salon} mañana a las {hora} con {empleado} para {servicio}. ¿Confirmas tu asistencia? Responde SI o NO.'),
        ('wa_template_3d',       'Hola {nombre}, tu cita en {salon} es el {fecha} a las {hora}. Si necesitas cancelar o reagendar, aún hay tiempo. Responde NO para liberar tu espacio.'),
        ('wa_template_7d',       'Hola {nombre}, te recordamos tu cita el {fecha} a las {hora} en {salon}. Cualquier cambio avísanos con tiempo. ¡Te esperamos!')
        ('wa_confirm_on_create',  'false'),
        ('wa_template_confirm',   '¡Hola {nombre}! ✅ Tu cita en {salon} ha sido confirmada.\n\n📅 {fecha}\n🕐 {hora}\n✂️ {servicio}\n👤 {empleado}\n\n¡Te esperamos!'),
        ('wa_logo_path',          '');
        `)
  })
  migrate()
  setVersion(6)
  log('Migración 6 completada.')
}
