-- Restablecer contraseñas.
--
-- Solo añade, no transforma nada: el código que ya está desplegado ignora la
-- columna nueva y no usa el valor nuevo del enum, así que esta migración se
-- puede aplicar antes de desplegar sin romper la versión que está sirviendo.

-- Versión de sesión. Las cookies anteriores no la llevan y se leen como 0, que
-- es el valor por defecto: nadie pierde la sesión al aplicar esto.
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Un restablecimiento queda en la actividad del equipo con quién lo hizo.
ALTER TYPE "ActivityType" ADD VALUE 'MEMBER_PASSWORD_RESET';
