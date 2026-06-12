function norm(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')
}

// Name format from spreadsheet: "Apellido1 Apellido2 Nombre1 [Nombre2...]"
export function emailFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 3) return ''
  const apellido1 = norm(parts[0])
  const apellido2 = norm(parts[1])
  const nombre1 = norm(parts[2])
  return `${nombre1.slice(0, 2)}${apellido1}${apellido2.slice(0, 2)}@uide.edu.ec`
}

export function mallaToId(malla: string): string {
  if (malla.includes('2019')) return 'itil-2019'
  if (malla.includes('2023')) return 'itil-2023'
  if (malla.includes('2025')) return 'sinl-2025'
  return norm(malla).replace(/\s+/g, '-')
}

export function estadoToKey(estado: string): EstadoAcademico {
  const map: Record<string, EstadoAcademico> = {
    'en curso': 'en_curso',
    'graduado': 'graduado',
    'no continua': 'no_continua',
    'cambio de carrera': 'cambio_carrera',
  }
  return map[estado.toLowerCase().trim()] ?? 'en_curso'
}

export function cicloToNumber(ciclo: string): number {
  const map: Record<string, number> = {
    primero: 1, segundo: 2, tercero: 3, cuarto: 4,
    quinto: 5, sexto: 6, septimo: 7, octavo: 8, graduado: 9,
  }
  return map[norm(ciclo)] ?? 0
}

export type EstadoAcademico = 'en_curso' | 'graduado' | 'no_continua' | 'cambio_carrera'
