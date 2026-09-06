-- Reparto los permisos de adjuntos entre los roles que ya existían.
--
-- Al añadir 'attachment:upload' y 'attachment:delete' al catálogo del código,
-- los equipos nuevos los recibieron a través de DEFAULT_ROLES, pero los roles
-- ya guardados en la base conservaron su lista tal cual. Resultado: en una
-- organización creada antes, nadie —ni el administrador— veía el botón de
-- adjuntar.
--
-- El criterio no es «dárselo a todos»: los adjuntos siguen la misma regla que
-- los comentarios, que es la acción análoga.
--
--   attachment:upload  → a quien ya puede comentar (participa en la tarea).
--   attachment:delete  → a quien ya puede borrar comentarios ajenos, que es el
--                        permiso sensible equivalente.
--
-- Un rol de solo lectura no gana nada, que es lo correcto.

UPDATE "TeamRole"
SET "permissions" = array_append("permissions", 'attachment:upload')
WHERE 'comment:create' = ANY("permissions")
  AND NOT ('attachment:upload' = ANY("permissions"));

UPDATE "TeamRole"
SET "permissions" = array_append("permissions", 'attachment:delete')
WHERE 'comment:delete' = ANY("permissions")
  AND NOT ('attachment:delete' = ANY("permissions"));

-- El rol de sistema de cada organización lleva todo, por definición. A partir de
-- ahora el código lo resuelve así en tiempo de lectura (ver lib/dal.ts), pero se
-- deja también la fila coherente para que la pantalla de roles muestre lo mismo
-- que se aplica.
UPDATE "TeamRole"
SET "permissions" = ARRAY[
    'project:create','project:update','project:delete',
    'task:create','task:update','task:move','task:assign','task:delete',
    'comment:create','comment:delete',
    'attachment:upload','attachment:delete',
    'member:invite','member:approve','member:update_role','member:remove',
    'role:manage','org:update'
]::TEXT[]
WHERE "isSystem" = true;
