import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function norm(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')
}

function emailFromName(fullName) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 3) return ''
  const apellido1 = norm(parts[0])
  const apellido2 = norm(parts[1])
  const nombre1 = norm(parts[2])
  return `${nombre1.slice(0, 2)}${apellido1}${apellido2.slice(0, 2)}@uide.edu.ec`
}

const tsvPath = resolve(__dirname, '../public/estudiantes-uide.tsv')
const raw = readFileSync(tsvPath, 'utf-8')
const lines = raw.split('\n').filter(l => l.trim())

const header = lines[0]
const rows = lines.slice(1)

const emailCount = {}
const outLines = ['Cédula\tNombre Completo\tCorreo\tMALLA\tESTADO\tCiclo académico']

for (const line of rows) {
  const cols = line.split('\t')
  const cedula = (cols[0] ?? '').trim()
  const nombre = (cols[1] ?? '').trim()
  const malla  = (cols[2] ?? '').trim()
  const estado = (cols[3] ?? '').trim()
  const ciclo  = (cols[4] ?? '').trim()

  let email = emailFromName(nombre)

  // Handle duplicates by appending a number
  if (email) {
    emailCount[email] = (emailCount[email] ?? 0) + 1
    if (emailCount[email] > 1) {
      const base = email.replace('@uide.edu.ec', '')
      email = `${base}${emailCount[email]}@uide.edu.ec`
    }
  }

  outLines.push(`${cedula}\t${nombre}\t${email}\t${malla}\t${estado}\t${ciclo}`)
}

writeFileSync(tsvPath, outLines.join('\n'), 'utf-8')
console.log(`✓ ${rows.length} estudiantes procesados`)

// Show duplicates
const dups = Object.entries(emailCount).filter(([, n]) => n > 1)
if (dups.length) {
  console.log('\n⚠ Correos con duplicados (se les añadió número):')
  dups.forEach(([email, n]) => console.log(`  ${email} → ${n} estudiantes`))
}
