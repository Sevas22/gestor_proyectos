-- Dos cambios: una tarea puede tener varios responsables, y puede llevar
-- archivos adjuntos.
--
-- El orden importa otra vez. La migración que genera Prisma sola hace
-- DROP COLUMN "assigneeId" antes de crear la tabla puente: eso perdería quién
-- lleva cada tarea. Aquí se crea la tabla, se copian las asignaciones que ya
-- existen, y solo entonces se retira la columna.

-- 1. Tabla puente de responsables ------------------------------------------
-- Relación implícita de Prisma: "A" es Task, "B" es User (orden alfabético de
-- los modelos). Los nombres los fija Prisma, no se pueden elegir.

CREATE TABLE "_TaskAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TaskAssignees_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_TaskAssignees_B_index" ON "_TaskAssignees"("B");

-- 2. Trasladar las asignaciones actuales ------------------------------------

INSERT INTO "_TaskAssignees" ("A", "B")
SELECT "id", "assigneeId" FROM "Task" WHERE "assigneeId" IS NOT NULL;

-- Red de seguridad: si el traslado no cuadra, que falle aquí y no con datos a
-- medias más adelante.
DO $$
DECLARE
    antes INTEGER;
    despues INTEGER;
BEGIN
    SELECT COUNT(*) INTO antes FROM "Task" WHERE "assigneeId" IS NOT NULL;
    SELECT COUNT(*) INTO despues FROM "_TaskAssignees";
    IF antes <> despues THEN
        RAISE EXCEPTION 'Se esperaban % asignaciones y se trasladaron %; se aborta.', antes, despues;
    END IF;
END $$;

-- 3. Retirar la columna vieja -----------------------------------------------

ALTER TABLE "Task" DROP CONSTRAINT "Task_assigneeId_fkey";
DROP INDEX "Task_assigneeId_idx";
ALTER TABLE "Task" DROP COLUMN "assigneeId";

ALTER TABLE "_TaskAssignees" ADD CONSTRAINT "_TaskAssignees_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_TaskAssignees" ADD CONSTRAINT "_TaskAssignees_B_fkey"
    FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Adjuntos ----------------------------------------------------------------
-- El contenido va en una columna BYTEA de esta misma base. Nunca se debe leer
-- "data" en un listado: ver el comentario del modelo en schema.prisma.

CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "taskId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Attachment_taskId_idx" ON "Attachment"("taskId");

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
