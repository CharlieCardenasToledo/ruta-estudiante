import { initializeApp, getApps } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, firebaseConfig } from './firebase'
import type { UserRole, EstadoAcademico } from '../types'

const secondaryApp =
  getApps().find((a) => a.name === 'secondary') ??
  initializeApp(firebaseConfig, 'secondary')

const secondaryAuth = getAuth(secondaryApp)

export interface CreateUserParams {
  email: string
  password: string
  displayName: string
  role: UserRole
  cohortId?: string
  cedula?: string
  malla?: string
  ciclo?: string
  currentCycle?: number
  estadoAcademico?: EstadoAcademico
}

export async function createAppUser({
  email, password, displayName, role,
  cohortId, cedula, malla, ciclo, currentCycle, estadoAcademico,
}: CreateUserParams): Promise<string> {
  const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, password)
  await signOut(secondaryAuth)

  await setDoc(doc(db, 'users', user.uid), {
    email,
    displayName,
    role,
    schoolId: 'sistemas-loja',
    campusId: 'loja',
    ...(cohortId ? { cohortId } : {}),
    ...(cedula ? { cedula } : {}),
    ...(malla ? { malla } : {}),
    ...(ciclo ? { ciclo } : {}),
    ...(currentCycle ? { currentCycle } : {}),
    ...(estadoAcademico ? { estadoAcademico } : { estadoAcademico: 'en_curso' }),
    cycleStatus: 'active',
    createdAt: serverTimestamp(),
  })

  return user.uid
}

export function generatePassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
