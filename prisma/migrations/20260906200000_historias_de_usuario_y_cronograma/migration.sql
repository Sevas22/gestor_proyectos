-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "storyId" TEXT;

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "asA" TEXT NOT NULL DEFAULT '',
    "iWant" TEXT NOT NULL DEFAULT '',
    "soThat" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" "StoryStatus" NOT NULL DEFAULT 'PLANNED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "colorSeed" INTEGER NOT NULL DEFAULT 0,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Story_projectId_startDate_idx" ON "Story"("projectId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "Story_projectId_number_key" ON "Story"("projectId", "number");

-- CreateIndex
CREATE INDEX "Task_storyId_idx" ON "Task"("storyId");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Permisos de las historias, repartidos entre los roles que ya existen.
--
-- Planificar es una tarea de gestión, así que siguen la misma regla que los
-- proyectos: quien ya puede crear un proyecto puede crear historias, y así con
-- editar y borrar. Un rol que solo ejecuta tareas no gana nada.
--
-- El rol de sistema se resuelve con todos los permisos en tiempo de lectura
-- (lib/dal.ts), pero se deja también la fila coherente para que la pantalla de
-- roles muestre lo mismo que se aplica.

UPDATE "TeamRole" SET "permissions" = array_append("permissions", 'story:create')
WHERE 'project:create' = ANY("permissions") AND NOT ('story:create' = ANY("permissions"));

UPDATE "TeamRole" SET "permissions" = array_append("permissions", 'story:update')
WHERE 'project:update' = ANY("permissions") AND NOT ('story:update' = ANY("permissions"));

UPDATE "TeamRole" SET "permissions" = array_append("permissions", 'story:delete')
WHERE 'project:delete' = ANY("permissions") AND NOT ('story:delete' = ANY("permissions"));

UPDATE "TeamRole"
SET "permissions" = ARRAY[
    'project:create','project:update','project:delete',
    'story:create','story:update','story:delete',
    'task:create','task:update','task:move','task:assign','task:delete',
    'comment:create','comment:delete',
    'attachment:upload','attachment:delete',
    'member:invite','member:approve','member:update_role','member:remove',
    'role:manage','org:update'
]::TEXT[]
WHERE "isSystem" = true;
