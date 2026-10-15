# Correos y Blog: galería para tu clienta

Una página sencilla donde tu clienta ve tus **correos (newsletters)** y **artículos de blog** hechos en HTML y CSS.
Es 100% estática: HTML, CSS y JavaScript simple. No tiene servidor, base de datos ni contraseñas.

## Cómo funciona

1. Subes un archivo `.html` a la carpeta **`correos/`** o **`blog/`** en GitHub.
2. Render ve el cambio y vuelve a publicar el sitio solo (tarda 1 o 2 minutos).
3. Tu clienta abre el link de Render y ve todo en tarjetas. Con un clic lo abre completo y puede cambiar entre **Escritorio** y **Móvil**.

## Subir un correo o artículo desde el navegador

1. En GitHub, abre la carpeta `correos` (o `blog`).
2. Pulsa **Add file → Upload files** y arrastra tu `.html` (y sus imágenes, si tiene).
3. Pulsa **Commit changes**. Listo.

Para borrar uno, ábrelo en GitHub y elige el menú **…** → **Delete file**.

Consejos:

- El título de la tarjeta sale de la etiqueta `<title>` del HTML. Si no tiene, se usa el nombre del archivo.
- Si el nombre del archivo empieza con la fecha (`2026-10-15-newsletter-octubre.html`), la tarjeta muestra la fecha y aparece ordenada (lo más nuevo primero).
- Imágenes: usa el link completo (`https://…`) o súbelas a la misma carpeta y usa solo el nombre (`<img src="foto.jpg">`).
- Cada correo o artículo tiene su propio link, por ejemplo
  `https://newsletters-0bq1.onrender.com/#correos/2026-10-15-newsletter-octubre.html`.
  Puedes mandárselo directo a tu clienta.
- Los archivos de ejemplo (`…-ejemplo-…`) son para que veas cómo queda; bórralos cuando subas los tuyos.

## Configuración en Render (solo una vez)

En Render, entra al servicio **Newsletters**, luego **Settings → Build & Deploy**, y deja esto:

| Campo             | Valor           |
| ----------------- | --------------- |
| Branch            | `main`          |
| Root Directory    | *(vacío)*       |
| Build Command     | `npm run build` |
| Publish Directory | `./`            |
| Auto-Deploy       | On Commit (Sí)  |

Guarda y pulsa **Manual Deploy → Clear build cache & deploy**.

`npm run build` solo ejecuta `build.js`, que hace la lista de archivos (`contenido.js`) para la página.
No instala nada y no necesita variables de entorno.

### ¿Por qué fallaba?

El servicio en Render es un **Static Site**, pero el código anterior era un **servidor Node (Express)**.
Necesitaba un token de GitHub y contraseñas en variables de entorno, y un Static Site no puede ejecutar un servidor.
Por eso el deploy terminaba con *"Exited with status 1 while building your code"*.
Ahora todo es estático, y eso es justo lo que publica un Static Site.

## Personalizar (opcional)

- **Botón "Enviar comentarios"**: en `app.js`, línea 6, escribe tu correo entre las comillas:
  `const CORREO_COMENTARIOS = "tu@correo.com";`
  Tu clienta verá un botón que abre su correo con el título de la pieza ya puesto.
- **Colores**: al principio de `estilos.css`.
- **Textos de la portada**: en `index.html`.

## Privacidad

Cualquiera que tenga el link puede ver el contenido (no hay contraseña).
La página le pide a Google y a otros buscadores que no la indexen (`robots.txt` y `noindex`).
Si el repositorio de GitHub es público, los archivos también se pueden ver en GitHub.

## Archivos

```
index.html     portada y visor (lo que ve tu clienta)
estilos.css    diseño
app.js         JavaScript simple: tarjetas, filtros y visor
correos/       ← aquí subes los correos .html
blog/          ← aquí subes los artículos .html
build.js       lo ejecuta Render: crea la lista contenido.js (no hay que tocarlo)
package.json   solo define "npm run build"
render.yaml    la misma configuración de Render, por si un día creas el servicio como Blueprint
robots.txt     pide a los buscadores que no indexen el sitio
```
