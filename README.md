# Plomo en el Mantaro

Recorrido interactivo en 3D del proyecto de Investigación Formativa (FQIQ-UNMSM, 2026-II):
plomo en el agua del río Mantaro (Junín) y la propuesta de un hidrogel de almidón de árbol de pan (*Artocarpus altilis*).

Integrantes: Samuel Benjamín Barrón Márquez, Isai Severiano Felix Sopla, Lucas Leonardo Salazar Ochoa.

## Cómo usarlo
- **Recorrer bajando:** cada sección cambia la escena.
- **Presentar:** pantalla completa; avanza solo cada 20 segundos (pausa con el botón ❚❚ o la tecla P); avanzar a mano con clic, flecha derecha o espacio; retroceder con flecha izquierda; salir con Esc.
- **Explorar 3D:** girar y acercar el relieve con el mouse.
- **Realista / Holograma:** cambiar el estilo del relieve en cualquier escena.

## Publicar en GitHub Pages
1. Crear un repositorio público en GitHub (por ejemplo `plomo-mantaro`).
2. Subir todo el contenido de esta carpeta: `index.html`, `app.js`, la carpeta `assets/` y `.nojekyll`.
3. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)` → **Save**.
4. En uno o dos minutos la página queda en `https://TU-USUARIO.github.io/plomo-mantaro/`.

## Abrirlo sin internet
No funciona con doble clic sobre `index.html`, porque el navegador bloquea la carga de los datos desde archivos locales.
En la carpeta, ejecutar `python -m http.server 8000` y abrir `http://localhost:8000`.
Aun así necesita internet la primera vez para descargar Three.js y las fuentes.

## Datos
- Relieve: SRTM (AWS Terrain Tiles). Exageración vertical ×1,5 en la vista realista y mayor en la holográfica.
- Imagen: Sentinel-2 cloudless 2016, EOX IT Services GmbH (contiene datos Copernicus Sentinel modificados), CC BY 4.0.
- El trazado del río y las altitudes del tramo son aproximados (elaboración propia). La vista microscópica es un esquema ilustrativo.
- Referencias completas al final de la página.
