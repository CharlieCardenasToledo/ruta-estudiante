# Documento de Diseño y Arquitectura: Sistema Ruta Estudiante UIDE

## 1. Visión General del Proyecto

**Objetivo:** Desarrollar un sistema web integral (Stand-alone) para registrar, validar y hacer seguimiento a la "ruta académica y profesional" de los estudiantes de la UIDE.
**Fase 1 (MVP):** Escuela de Ingeniería en Sistemas de Información (Campus Loja).
**Escalabilidad:** Diseñado desde el día uno con arquitectura Multitenant para expandirse a todas las escuelas del campus Loja (Fase 2) y a nivel nacional en todos los campus UIDE (Fase 3) sin necesidad de reescribir el código base.

---

## 2. Stack Tecnológico (Fase 1)

- **Frontend:** React + Vite con Tailwind CSS
- **Backend / Base de Datos:** Firebase (Cloud Firestore - NoSQL)
- **Autenticación:** Firebase Authentication (Email/Password — el admin crea las cuentas)
- **Notificaciones / Lógica en la Nube:** Firebase Cloud Functions + Nodemailer con SMTP Office 365 de la UIDE
- **Almacenamiento de Archivos:** Firebase Cloud Storage (PDFs e imágenes de certificados)
- **Hosting:** Firebase Hosting

> **Nota:** Las credenciales SMTP de Office 365 deben solicitarse al departamento de TI de la UIDE.

---

## 3. Identidad Visual

- **Logo:** UIDE (Powered by Arizona State University®)
- **Color Primario:** Carmesí `#8B0045`
- **Color Acento:** Dorado `#E8A020`
- **Fondo:** Blanco `#FFFFFF`

---

## 4. Arquitectura de la Base de Datos (Multitenant)

Estructura jerárquica en Firestore:

- **`campuses`** (ej. Loja, Quito)
  - **`faculties`** (ej. Ingeniería)
    - **`schools`** (ej. Sistemas de Información)
      - **`students`** (documento principal del estudiante)

### Colecciones principales:

#### `users`

Perfiles del sistema. Roles: `student`, `admin`, `teacher`. Asociados a Campus/Escuela.
Campos relevantes:

- `role`, `schoolId`, `campusId`
- `cohortId` (cohorte de ingreso del estudiante)
- `currentCycle` (ciclo académico actual, calculado automáticamente desde la cohorte)
- `cycleStatus`: `active` | `lost` (el admin lo marca manualmente si el estudiante pierde el ciclo)

#### `cohorts`

Configuración por cohorte académica (administrable por el admin).

- `name` (ej. "Abril – Agosto 2023")
- `startDate`, `endDate`
- `internshipHoursRequired` (total de horas requeridas para prácticas, configurable)
- `internshipPeriods` (número de períodos de prácticas: Prácticas I, II, etc.)

#### `academicPeriods`

Períodos académicos globales del sistema. Catálogo base:

- Abril – Agosto 2023
- Noviembre 2023 – Marzo 2024
- Abril – Agosto 2024
- Octubre 2024 – Febrero 2025
- Mayo – Agosto 2025
- Octubre 2025 – Febrero 2026
- _(extensible por el admin)_

#### `milestones`

Hitos/certificados del estudiante. Estados: `pending` | `approved` | `rejected`.
Tipos (`type`):

| Tipo                     | Subido por                            | Aprobado por                                         |
| ------------------------ | ------------------------------------- | ---------------------------------------------------- |
| `english_level`          | Estudiante (PDF)                      | Admin                                                |
| `advanced_skill`         | Estudiante (PDF)                      | Admin — se permiten N certificados                   |
| `gec`                    | Admin                                 | N/A — es un puntaje numérico (0–100)                 |
| `programmer_certificate` | Estudiante (PDF)                      | Admin — niveles: Junior, Semi Senior, Senior, Agile  |
| `malla_academica`        | Admin (emite manualmente)             | N/A                                                  |
| `mejor_promedio`         | Admin (emite manualmente por cohorte) | N/A                                                  |
| `recognition`            | Admin                                 | N/A — ej. Reto GAD Innova                            |
| `master_class`           | Admin/Tutor                           | N/A — registra si el estudiante tiene el certificado |

#### `masterClassCatalog`

Catálogo dinámico de Master Classes. El admin puede agregar nuevas.
Ejemplos iniciales:

- Curiosity Catalyst: Fueling Innovation, Creativity, and Success
- AI and the Law: Innovation Meets Ethics
- A Practitioner's Guide to Generative AI
- Business Strategies for the Creative Entrepreneur
- Energy: The Foundation of Our Global Future
- Shaping a Sustainable Tomorrow through Future-Oriented Thinking
- Reimagining Reality
- Harnessing AI to Fight the Diabetes Epidemic
- Decoding Disease: The Power of Mathematical Models in Modern Medicine
- Performing under Uncertainty
- Entrepreneurial Mindset: Your Competitive Advantage as a Technology Innovator
- Innovation in Conservation
- The Contradictions of Nuclear Power
- When Patients Hold the Key: Reimagining Control of Sensitive Health Records
- Social Determinants of Health and Impact on Health Outcomes
- Going Beyond Cultural Competence
- The Rise and Fall of the Esports Industry

#### `internships`

Prácticas preprofesionales por estudiante. Las horas totales requeridas se toman de la cohorte.

- Subcolección `hours_logs`: horas registradas por el estudiante (estado `pending` hasta que el tutor apruebe)
- Subcolección `visits_logs`: reportes de visita registrados por el tutor

---

## 5. Roles y Permisos (RBAC)

### Estudiante (`student`)

- Acceso a su propio Dashboard de Ruta
- Sube certificados PDF/imagen: Inglés, Advanced Skill, Certificado Programador
- Registra horas de prácticas preprofesionales (quedan en `pending` hasta aprobación del tutor)
- Ve su ciclo académico actual y estado (activo / perdido)
- Recibe notificaciones por email sobre aprobaciones/rechazos

### Administrador / Coordinador (`admin`)

- Crea cuentas de estudiantes y tutores manualmente (el sistema envía credenciales por email)
- Accede a todos los estudiantes de su Escuela/Campus
- Aprueba o rechaza certificados subidos por estudiantes
- Emite manualmente: GEC (puntaje), Certificado Malla Académica, Mejor Promedio, Reconocimientos
- Marca si un estudiante perdió su ciclo académico
- Configura cohortes: nombre, fechas, horas requeridas de prácticas, número de períodos
- Gestiona el catálogo de Master Classes (agregar nuevas)

### Tutor / Responsable de Prácticas (`teacher`)

- Registra si un estudiante tiene el certificado de una Master Class
- Aprueba o rechaza los registros de horas de prácticas de sus estudiantes asignados
- Registra reportes de "Visitas in situ" (observaciones, fecha, nivel de desempeño)
- Visualiza el progreso de horas de prácticas de sus estudiantes

---

## 6. Ciclo Académico Automático

- El sistema calcula automáticamente el ciclo en el que debería estar el estudiante en base a su cohorte de ingreso y los períodos académicos registrados.
- El campo `cycleStatus` se actualiza manualmente por el admin si el estudiante pierde el ciclo (`lost`).
- El dashboard del estudiante muestra su ciclo actual y su estado.

---

## 7. Flujos de Trabajo Principales (Core Workflows)

### 7.1. Alta de Estudiante (por Admin)

1. El admin crea la cuenta del estudiante en el sistema (nombre, email, cohorte, escuela).
2. Firebase Authentication crea el usuario.
3. Una Cloud Function envía un email al estudiante (SMTP Office 365) con sus credenciales de acceso.

### 7.2. Aprobación de Certificados

1. El estudiante sube un PDF desde su Dashboard.
2. El documento se crea en Firestore con estado `pending`.
3. El admin recibe alerta en su panel y revisa el PDF.
4. Si aprueba → estado `approved`; si rechaza → estado `rejected` con motivo.
5. Una Cloud Function envía email de notificación al estudiante.

### 7.3. Seguimiento de Prácticas Preprofesionales (Flujo Dual)

1. **Estudiante:** Registra horas semanales/mensuales (fecha, actividad). Quedan en `pending`.
2. **Tutor:** Aprueba o rechaza las horas declaradas. Solo las aprobadas suman al total.
3. **Tutor:** Registra reportes de visita in situ (observaciones, desempeño, fecha).
4. El admin visualiza ambos lados: horas aprobadas y reportes del tutor.
5. Las horas requeridas para completar prácticas son configurables por cohorte.

### 7.4. Registro de Master Class

1. El tutor/admin selecciona un estudiante y una Master Class del catálogo.
2. Marca si el estudiante tiene o no el certificado de esa sesión.
3. El dashboard del estudiante refleja el registro.

---

## 8. Firebase — Proyecto Existente

- **Project ID:** `estudainte-uide`
- **Auth Domain:** `estudainte-uide.firebaseapp.com`
- **Storage Bucket:** `estudainte-uide.firebasestorage.app`
- Servicios a activar: Firestore, Authentication (Email/Password), Storage, Cloud Functions

> **Seguridad:** No incluir el archivo de configuración de Firebase en repositorios públicos.

---

## 9. Roadmap de Implementación

### Sprint 1 — Base del sistema ✅ EN PROGRESO

- [x] Proyecto Vite + React + TypeScript creado en `D:\Proyectos UIDE\ruta-estudiante\`
- [x] Tailwind CSS v4 configurado con paleta UIDE (carmesí `#8B0045`, dorado `#E8A020`)
- [x] Firebase SDK integrado — `src/lib/firebase.ts` (Auth, Firestore, Storage)
- [x] Tipos TypeScript definidos — `src/types/index.ts` (AppUser, Milestone, Internship, etc.)
- [x] AuthContext con `onAuthStateChanged` + carga de rol desde Firestore — `src/contexts/AuthContext.tsx`
- [x] Sistema de Login funcional (Email/Password + validación Zod) — `src/pages/auth/LoginPage.tsx`
- [x] ProtectedRoute por rol (student/admin/teacher) — `src/components/ProtectedRoute.tsx`
- [x] Layout compartido con sidebar UIDE + logout — `src/components/Layout.tsx`
- [x] Dashboard placeholder: Estudiante, Admin, Tutor — `src/pages/*/`
- [x] Enrutamiento completo en `src/App.tsx` (redirige por rol automáticamente)
- [ ] **PENDIENTE:** Pantalla de creación de usuarios (admin crea estudiantes/tutores)
- [ ] **PENDIENTE:** Reglas de seguridad Firestore (RBAC)
- [ ] **PENDIENTE:** Cloud Function — email de bienvenida (SMTP Office 365)

> **Para arrancar la siguiente sesión:** `npm run dev` en `D:\Proyectos UIDE\ruta-estudiante\`
>
> **Bootstrapping del primer admin:** Crear usuario en Firebase Console → Authentication, luego crear documento en Firestore `users/{uid}` con campos: `displayName`, `role: "admin"`, `schoolId: "sistemas-loja"`, `campusId: "loja"`, `email`.

### Sprint 2 — Dashboard Estudiante

- Dashboard de Ruta del Estudiante (ciclo académico, estado, progreso)
- Módulo de subida de certificados (Inglés, Advanced Skill, Programador)
- Módulo de registro de horas de prácticas

### Sprint 3 — Dashboard Admin y Tutor

- Dashboard Admin: lista de estudiantes, filtros por cohorte/ciclo
- Módulo de aprobación/rechazo de certificados
- Emisión manual de certificados (GEC, Malla Académica, Mejor Promedio, Reconocimientos)
- Dashboard Tutor: aprobación de horas, registro de visitas, registro de Master Class
- Cloud Functions: notificaciones por email al aprobar/rechazar

### Sprint 4 — Configuración y Catálogos

- Gestión de cohortes (horas requeridas, períodos de prácticas)
- Gestión del catálogo de Master Classes
- Gestión de períodos académicos

### Pruebas y QA

- Pruebas internas en la Escuela de Sistemas (Campus Loja)

### Lanzamiento MVP (Fase 1)

claude --resume 02f4c4cf-0181-4650-8ba4-ca853f55eae4
