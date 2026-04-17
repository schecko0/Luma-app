Idea general del cambio 

## Explicacion de porque el cambio 
cuando un colaborador realiza un servicio de 1000 y su comision es de 40 el owner se queda con el 60 

pero cuando hay mas de uno ejemplo 40y 20 el owner se queda con el 40 y de este porcentaje el owner debe pagar sueldos, insumos y gastos generales del local por lo que en esta parte es poco rentable cuando hay mas de un colaborador.

obviamente yo me anticipe a algo como esto desde la creacion de los catalogos y servicios que puedan ir seccionados, ejemplo 
categoria : cabello  y servicios seccionados por 
-> lavado y secado
-> tinte y matiz
-> peinado  

asi secciono servicios completos en mas pequeños o por pasos  pensando en el proceso del servicio, 
ejemplo primero lavado y secado -> un especialista 
al terminar pasa con el siguiente especialista -tinte y matiz 
al final peinado con otro especialista.

por cada uno de ellos el colaborador que se involucre ganara su comision 

imaginemos algo a mi me contratan para realizar solo lavado y secado, pero por mis aptitudes pueden tambier involucrarme en tinte y matiz , puedo empezar con simple capacitacion observando como es el proceso y despues ir involucrandome con un especialista de ese proceso y ya poder ganar no ganare mi porcentaje real por que voy aprendiendo pero tampoco hare un trabajo gratis 

si son 3 colaboradores se divide entre 3 es decir el 33.3% para cada colaborador con respecto a su porcentaje. 
por lo que opte por hacer un moo donfiguareble desde settings

### Plan de accion 

✅ Definición final de los 3 modos
Modo A — Simple (actual, default)

Factor siempre = 1
Sin cambios en POS ni en motor
1 o más colaboradores → cada quien cobra su % completo


⚠️ Nota: con 2+ colaboradores en Modo A el owner recibe menos remanente, igual que hoy. No hay corrección automática.


Modo B — Proporcional automático

Factor = 1 / n_colaboradores
El POS no muestra nada extra — el cálculo es automático en el motor
El colaborador siempre ve su % real en su historial, pero la comisión pagada es proporcional

Emp (40%) + 2 colaboradores → cobra 40% × 0.5 = 20% efectivo

Modo C — Proporcional manual (overhead configurable)

En el POS aparece un campo de "% de participación" por colaborador
Por default se reparte a partes iguales (50/50, 33/33/33...)
El cajero puede ajustarlo manualmente si un colaborador aportó más
La comisión final = line_total × (commission_pct/100) × (participacion/100)

Emp1 (40%) participación 70% → 1000 × 0.40 × 0.70 = $280
Emp2 (20%) participación 30% → 1000 × 0.20 × 0.30 = $60
Owner → $1,000 - $340 = $660

El sistema valida que la suma de participaciones = 100% antes de guardar


## Ajueste por Bloques 

Bloque 1 — BD (database.ts) es la única migración nueva. Solo dos registros en settings: commission_mode con default 'simple' y overhead_pct con default '0'. Cero tablas nuevas, cero columnas nuevas. La columna work_split_pct ya existe en invoice_service_employees — la venías usando hardcodeada en 100, ahora le daremos uso real en Modo C.

Bloque 2 — Tipos (types/index.ts) agrega el type CommissionMode = 'simple' | 'proportional' | 'manual', un interface CommissionSettings y modifica CreateInvoicePayload para que employee_ids lleve un work_split_pct opcional por colaborador (solo Modo C lo envía).

Bloque 3 — Motor (invoiceHandlers.ts) es el corazón del cambio. Extraemos una función calcularComisiones() que lee el modo desde settings y aplica la fórmula correcta. El bloque invoices:create queda idéntico en estructura — solo delega el cálculo a esa función. Modo simple = sin tocar nada del código actual. Modo proporcional = factor = 1/n. Modo manual = factor = work_split_pct_enviado / 100.

Bloque 4 — POS (PosPage.tsx) lee el modo al inicio junto con los demás datos. CartLineCard muestra un pequeño badge informativo en Modo B, y en Modo C muestra inputs de % por colaborador con validación de que sumen 100.

Bloque 5 — Settings (SettingsPage.tsx) agrega una sección nueva "Comisiones" con tres radio buttons descritos y el campo de overhead que aparece solo en Modo C.


## Avance de cambios 
El Bloque 1 listo.
Cambios en database.ts:
Dos toques quirúrgicos, nada más:
En runMigrations() se registró la llamada if (current < 8) applyMigration8() con su comentario, siguiendo exactamente el patrón de las migraciones anteriores.
La función applyMigration8() inserta dos registros en la tabla settings ya existente con INSERT OR IGNORE — eso garantiza que si alguien ya tuviera esas keys por alguna razón, no falla. Los valores por defecto son commission_mode = 'simple' y overhead_pct = '0', por lo que al arrancar la app en cualquier instalación existente el comportamiento será exactamente el mismo de hoy — sin ningún cambio visible para el usuario.

Bloque 2 listo — types/index.ts ✅
Se agregaron CommissionMode, CommissionSettings y el campo opcional work_splits?: number[] en CreateInvoicePayload.

Bloque 3 listo — invoiceHandlers.ts ✅
Se inyectaron las dos funciones helper getCommissionSettings() y calcularComision() al inicio del handler, y se reemplazó el loop de auxiliares para que use la nueva lógica de modos A/B/C con work_split_pct real guardado en BD.

Bloque 4 listo — PosPage.tsx ✅
Se agregó commissionMode como estado que se carga desde settings al inicio, updateWorkSplit() para Modo C, badge informativo en Modo B, inputs de % por colaborador en Modo C con validación de suma 100%, y el preview de comisión efectiva en tiempo real para los 3 modos.

## Pendiente de terminar 

Bloque 5 — SettingsPage.tsx ✅ (parcial)
Se aplicaron correctamente: imports de Percent y CommissionMode, tipos extendidos en SettingsForm, defaults, TabId, carga desde settings en useEffect, guardado en handleSave, y el tab nuevo en la barra de navegación. Solo faltó insertar el JSX del contenido del tab 

¿Qué falta?
Solo queda insertar el JSX del tab Comisiones en SettingsPage.tsx — un bloque de UI que va entre el tab de WhatsApp y el tab de Sistema. Todo lo demás está 100% aplicado.