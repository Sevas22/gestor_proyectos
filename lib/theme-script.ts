/// Se inyecta en <head> y corre antes del primer pintado, para que quien eligió
/// tema oscuro no vea un fogonazo blanco mientras carga el JavaScript.
/// Vive en su propio módulo (sin 'use client') para que el layout del servidor
/// pueda importarlo sin arrastrar el componente del conmutador.
export const themeScript = `
try {
  var t = localStorage.getItem('gestor-theme');
  if (t === 'light' || t === 'dark') document.documentElement.classList.add(t);
} catch (e) {}
`
