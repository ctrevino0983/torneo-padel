# 🎾 Torneo de Pádel

App web **estática (HTML/CSS/JavaScript puro, sin build)** para organizar un torneo de pádel: equipos, rondas, calendario Round Robin, resultados, posiciones y fase final. El estado se guarda en `localStorage` (clave `torneo-padel:v1`).

## Archivos
- `index.html`, `styles.css`, `app.js`: toda la aplicación.
- `tournament.test.js`: pruebas de la lógica (`npm test`, requiere Node 18+).

## Funciones
- Agregar, editar y quitar equipos (Jugador 1 / Jugador 2).
- Rondas generadas a partir de los equipos registrados ("Generar rondas"; "Volver a generar" mezcla el orden). No hay sorteo aparte de jugadores.
- Calendario Round Robin (mínimo 3 equipos); con número impar hay descansos (*bye*). Partidos de 30 min, canchas y hora de inicio configurables.
- Captura/edición de resultados (sets y juegos) y tabla de posiciones: 3 pts por victoria, desempate por diferencia de sets y de juegos.
- Fase final con los 4 mejores: semifinales, final, tercer lugar y podio.
- Interfaz adaptada a móviles.

## Uso local
Abre `index.html` directamente en el navegador, o sirve la carpeta con un servidor estático:
```bash
npm start        # http://localhost:8080  (python3 -m http.server 8080)
npm test         # pruebas de la lógica
```
Desde el celular: abre la URL de GitHub Pages, o en la misma red WiFi usa la IP de tu equipo con el puerto 8080.

## Publicar en GitHub Pages
**Opción A (workflow incluido):** en **Settings → Pages → Source: GitHub Actions**; cada push a `main` ejecuta `.github/workflows/deploy.yml`, que prueba y publica los tres archivos.

**Opción B (sin Actions):** en **Settings → Pages → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.

La app queda en `https://<usuario>.github.io/torneo-padel/`. Todas las rutas son relativas, por lo que funciona bajo cualquier subruta.

## Notas de compatibilidad
Se migró desde React/Vite. Los datos guardados con la versión anterior (`torneo-padel:v1`) se siguen leyendo; el campo obsoleto `pool` se descarta.
