import Link from 'next/link'
import { FolderKanban } from 'lucide-react'

export default function ProjectNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-6 py-24 text-center">
      <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-accent text-muted-foreground">
        <FolderKanban className="size-5" />
      </div>
      <h1 className="text-xl font-bold tracking-tight">Este proyecto no existe</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        O se eliminó, o pertenece a otra organización. Revisa el enlace o vuelve al listado.
      </p>
      <Link
        href="/projects"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Ver proyectos
      </Link>
    </div>
  )
}
