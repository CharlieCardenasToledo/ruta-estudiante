export type UserRole = 'student' | 'admin' | 'teacher'

export type EstadoAcademico = 'en_curso' | 'graduado' | 'no_continua' | 'cambio_carrera'

export type SkillType = 'advanced_skill' | 'programmer_certificate'
export type RequirementType = 'advanced_skill' | 'programmer_certificate' | 'master_class'

/** Requisito de malla — define QUÉ skill es obligatorio, sin ciclo */
export interface MallaRequirement {
  id: string
  type: RequirementType
  skillId: string
  name: string
}

/** Requisito de cohorte — define QUÉ skill + CUÁNDO (ciclo específico) */
export interface CohortRequirement {
  id: string
  type: RequirementType
  skillId: string
  name: string
  ciclo: string
}

export interface AppUser {
  uid: string
  email: string
  displayName: string
  role: UserRole
  schoolId: string
  campusId: string
  cedula?: string
  malla?: string
  cohortId?: string
  currentCycle?: number
  ciclo?: string
  estadoAcademico?: EstadoAcademico
  cycleStatus?: 'active' | 'lost'
  createdAt: Date
}

export interface Cohort {
  id: string
  name: string
  malla?: string
  /** Inicio del período académico de entrada de la cohorte */
  startDate: Date
  /** Fin del período académico de entrada de la cohorte */
  endDate: Date
  /** Fecha estimada en que los estudiantes de esta cohorte se graduarán */
  graduationDate?: Date
  internshipHoursRequired: number
  internshipPeriods: number
  schoolId: string
  /** Requisitos con ciclo asignado — configurados por cohorte */
  requirements?: CohortRequirement[]
}

export type MilestoneType =
  | 'english_level'
  | 'advanced_skill'
  | 'gec'
  | 'programmer_certificate'
  | 'malla_academica'
  | 'mejor_promedio'
  | 'recognition'
  | 'master_class'

export type MilestoneStatus = 'pending' | 'approved' | 'rejected'

export interface Milestone {
  id: string
  studentId: string
  type: MilestoneType
  title: string
  status: MilestoneStatus
  fileUrl?: string
  score?: number
  rejectionReason?: string
  issuedByAdmin?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface MasterClassCatalogItem {
  id: string
  title: string
  date?: Date
  schoolId: string
  createdAt: Date
}

export interface SkillCatalogItem {
  id: string
  name: string
  type: SkillType
  schoolId: string
  createdAt: Date
}

export interface MallaConfig {
  id: string
  malla: string
  schoolId: string
  requirements: MallaRequirement[]
}

export interface Empresa {
  id: string
  nombre: string
  direccion: string
  telefono: string
  representante: string
  email?: string
  sector?: string
  schoolId: string
  createdAt: Date
}

export interface HorarioDia {
  dia: string
  horaEntrada: string
  horaSalida: string
}

export interface HorarioSemanal {
  dias: HorarioDia[]
}

export interface Internship {
  id: string
  studentId: string
  cohortId: string
  period: number
  totalHoursApproved: number
  totalHoursDeclared: number
  tutorId?: string
  empresaId?: string
  horarioSemanal?: HorarioSemanal
  fechaInicio?: Date
  startDate?: Date
}

export interface HoursLog {
  id: string
  internshipId: string
  studentId: string
  date: Date
  hours: number
  activity: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: Date
}

export interface VisitLog {
  id: string
  internshipId: string
  tutorId: string
  studentId: string
  date: Date
  observations: string
  performanceLevel: 'deficiente' | 'regular' | 'bueno' | 'excelente'
  presente?: boolean
  registradoPor?: 'admin' | 'teacher'
  createdAt: Date
}
