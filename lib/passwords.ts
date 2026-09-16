import 'server-only'

import { randomInt } from 'node:crypto'

/// Coste de bcrypt para todas las contraseñas. 12 rondas son unos 250 ms por
/// hash: imperceptible al entrar, caro para quien pruebe millones.
export const BCRYPT_COST = 12

// Sin 0/o, 1/l/i: la contraseña temporal se dicta por teléfono o se copia a
// mano, y esos pares se confunden.
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789'

/// Contraseña temporal para entregar a mano, como `k7mq-x3vd-p9ra`.
///
/// Sale de `crypto.randomInt` y no de `Math.random`: este último no es un
/// generador criptográfico, y sus valores se pueden predecir a partir de otros
/// que haya generado el mismo proceso. Doce caracteres de 31 posibles son unos
/// 59 bits, de sobra para algo protegido además por bcrypt.
export function generateTemporaryPassword(): string {
  const bloque = () =>
    Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('')
  return `${bloque()}-${bloque()}-${bloque()}`
}
