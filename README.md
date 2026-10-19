# miequipoaldia.com — web principal

Página de presentación de Mi Equipo Al Día. Es HTML estático: no necesita `npm install` ni compilar.
Está separada de la app de Marianistas (`Juvenil-A-Marianistas`).

## Puesta en marcha
1. Supabase > SQL Editor: ejecuta `sql/interesados.sql` (crea la tabla del formulario).
2. GitHub: crea el repo `miequipoaldia-web` y sube esta carpeta.
3. Vercel > Add New > Project > importa el repo (Framework: Other, sin build).
4. Vercel > proyecto > Settings > Domains: añade `miequipoaldia.com` y `www.miequipoaldia.com`.

Los apuntados se ven en Supabase > Table Editor > `interesados`.
