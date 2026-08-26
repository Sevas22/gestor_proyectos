-- Los roles dejan de ser un enum del esquema y pasan a ser filas de cada
-- organización, con su lista de permisos.
--
-- El orden importa. La migración que genera Prisma automáticamente hace
-- DROP COLUMN "role" y ADD COLUMN "roleId" NOT NULL de una vez: eso falla con
-- la tabla llena, y aunque no fallara perdería qué rol tenía cada persona.
-- Aquí se crea la tabla, se rellenan los roles equivalentes a los cuatro
-- valores del enum, se traduce cada membresía, y solo entonces se retira la
-- columna vieja.

-- 1. Tabla de roles ----------------------------------------------------------

CREATE TABLE "TeamRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "permissions" TEXT[],
    "colorSeed" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamRole_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamRole_orgId_idx" ON "TeamRole"("orgId");
CREATE UNIQUE INDEX "TeamRole_orgId_name_key" ON "TeamRole"("orgId", "name");

ALTER TABLE "TeamRole" ADD CONSTRAINT "TeamRole_orgId_fkey"
    FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Un juego de roles por organización, equivalente al enum anterior --------
-- Los ids se derivan del id de la organización para que la traducción del paso
-- siguiente pueda encontrarlos sin generar identificadores aleatorios en SQL.

INSERT INTO "TeamRole" ("id", "name", "description", "permissions", "colorSeed", "isSystem", "orgId", "updatedAt")
SELECT
    'role_' || o."id" || '_admin',
    'Administrador',
    'Control total: proyectos, tareas, miembros, roles y ajustes de la organización.',
    ARRAY[
        'project:create','project:update','project:delete',
        'task:create','task:update','task:move','task:assign','task:delete',
        'comment:create','comment:delete',
        'member:invite','member:approve','member:update_role','member:remove',
        'role:manage','org:update'
    ]::TEXT[],
    0,
    -- Rol de sistema: no se puede borrar ni dejar sin permisos de gestión.
    true,
    o."id",
    CURRENT_TIMESTAMP
FROM "Organization" o;

INSERT INTO "TeamRole" ("id", "name", "description", "permissions", "colorSeed", "isSystem", "orgId", "updatedAt")
SELECT
    'role_' || o."id" || '_manager',
    'Gestor de proyecto',
    'Crea y gestiona proyectos y tareas. Puede dar de alta miembros.',
    ARRAY[
        'project:create','project:update','project:delete',
        'task:create','task:update','task:move','task:assign','task:delete',
        'comment:create','comment:delete',
        'member:invite'
    ]::TEXT[],
    1,
    false,
    o."id",
    CURRENT_TIMESTAMP
FROM "Organization" o;

INSERT INTO "TeamRole" ("id", "name", "description", "permissions", "colorSeed", "isSystem", "orgId", "updatedAt")
SELECT
    'role_' || o."id" || '_developer',
    'Desarrollador',
    'Crea y actualiza tareas, las mueve en el tablero y comenta.',
    ARRAY['task:create','task:update','task:move','task:assign','comment:create']::TEXT[],
    2,
    false,
    o."id",
    CURRENT_TIMESTAMP
FROM "Organization" o;

INSERT INTO "TeamRole" ("id", "name", "description", "permissions", "colorSeed", "isSystem", "orgId", "updatedAt")
SELECT
    'role_' || o."id" || '_viewer',
    'Observador',
    'Solo lectura. No puede modificar nada.',
    ARRAY[]::TEXT[],
    3,
    false,
    o."id",
    CURRENT_TIMESTAMP
FROM "Organization" o;

-- 3. Traducir cada membresía -------------------------------------------------

ALTER TABLE "Membership" ADD COLUMN "roleId" TEXT;

UPDATE "Membership" m
SET "roleId" = 'role_' || m."orgId" || '_' || (
    CASE m."role"
        WHEN 'ADMIN'     THEN 'admin'
        WHEN 'MANAGER'   THEN 'manager'
        WHEN 'DEVELOPER' THEN 'developer'
        WHEN 'VIEWER'    THEN 'viewer'
    END
);

-- Red de seguridad: si algo quedara sin traducir, que la migración falle aquí
-- y no más adelante con datos a medias.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "Membership" WHERE "roleId" IS NULL) THEN
        RAISE EXCEPTION 'Hay membresías sin rol traducido; se aborta la migración.';
    END IF;
END $$;

ALTER TABLE "Membership" ALTER COLUMN "roleId" SET NOT NULL;

CREATE INDEX "Membership_roleId_idx" ON "Membership"("roleId");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "TeamRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Retirar lo viejo --------------------------------------------------------

ALTER TABLE "Membership" DROP COLUMN "role";
DROP TYPE "Role";
