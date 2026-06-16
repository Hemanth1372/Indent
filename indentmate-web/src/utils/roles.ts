export function normalizeRole(value: unknown) {
  return String(value ?? '').trim().toUpperCase()
}

export function isPortalAdminRole(value: unknown) {
  const role = normalizeRole(value)

  return (
    role === 'SUPER ADMIN' ||
    role.includes('SUPER ADMIN') ||
    role === 'ADMINISTRATOR' ||
    role.includes('ADMINISTRATOR') ||
    role === 'ADMIN' ||
    role.startsWith('ADMIN ') ||
    role.includes('(ADMIN)')
  )
}

export function isFieldRole(value: unknown) {
  const role = normalizeRole(value)

  return (
    role === 'SIE' ||
    role === 'STE' ||
    role === 'SER' ||
    role === 'SRE' ||
    role.includes('(SIE)') ||
    role.includes('(STE)') ||
    role.includes('(SER)') ||
    role.includes('(SRE)') ||
    role.includes('SITE ENGINEER') ||
    role.includes('STE ENGINEER') ||
    role.includes('SITE INCHARGE ENGINEER') ||
    role.includes('SITE IN-CHARGE ENGINEER') ||
    role.includes('SITE IN CHARGE ENGINEER') ||
    role.includes('SITE RECEIVING') ||
    role.includes('SERVICE ENGINEER')
  )
}
