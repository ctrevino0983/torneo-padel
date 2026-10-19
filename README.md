# 🎾 Torneo de Pádel

App web (Vite + React) para organizar un torneo de pádel: equipos, calendario Round Robin, resultados, posiciones y fase final. El estado se guarda en `localStorage`.

## Funciones
- Agregar, editar y quitar equipos (mínimo 3).
- Calendario Round Robin (método del círculo); con número impar de equipos hay descansos (*bye*).
- Partidos de 30 minutos en franjas horarias, con canchas configurables; un equipo nunca juega dos partidos a la vez.
- Captura de resultados (sets y juegos) y tabla de posiciones: 3 pts por victoria, desempate por diferencia de sets y de juegos.
- Fase final con los 4 mejores: semifinales (1º vs 4º, 2º vs 3º), final y tercer lugar.

## Uso local
```bash
npm install
npm run dev      # desarrollo
npm test         # pruebas de la lógica
npm run build    # build de producción en dist/
```

## Uso desde el celular
- Abre la URL de GitHub Pages (ver abajo) en el navegador del celular, o
- en la misma red WiFi ejecuta `npm run dev -- --host` y abre en el celular la URL `Network` que muestra Vite.

Las rondas se generan con los equipos registrados (botón "Generar rondas"; "Volver a generar" mezcla el orden para variar los emparejamientos).

## Despliegue en GitHub Pages
1. En el repositorio: **Settings → Pages → Source: GitHub Actions**.
2. Haz push a `main`; el workflow `.github/workflows/deploy.yml` ejecuta pruebas, build y publica.
3. La app queda en `https://<usuario>.github.io/torneo-padel/`.

`vite.config.js` usa `base: './'`, por lo que funciona en cualquier subruta.
