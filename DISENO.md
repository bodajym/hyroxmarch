# RX/27 · Dirección de arte «Termografía» (nov 2026)

## 1. Tres direcciones exploradas

| | Dorsal | Termografía ✅ | Cronógrafo |
|---|---|---|---|
| Idea | La app es tu dorsal de carrera impreso | La app es una cámara térmica de tu día | La app es un cronógrafo suizo |
| Referencias | Carteles suizos, dorsales, revistas de running | Imagen térmica FLIR, Lusion, Active Theory | Relojería, esferas de cronógrafo, Things 3 |
| Paleta | Papel, tinta negra y amarillo HYROX | Carbón y espectro térmico (violeta → magenta → brasa → amarillo); claro en «papel térmico» | Esfera blanca, negro y rojo segundero |
| Tipografía | Grotesca condensada + serif de revista | Bricolage Grotesque (condensada) + Instrument Serif itálica + JetBrains Mono | Grotesca neutra + mono |
| Momento firma | El dorsal se arranca al cerrar la semana | Un halo térmico vivo que se calienta si te pasas de hidratos, saturada o kcal | La cuenta atrás como aguja que barre |
| Primeros 3 s | Impacto de cartel | Ves de un vistazo si hoy vas frío (en plan) o al rojo | Precisión y calma |

**Elegida: Termografía.** Es la única en la que el efecto visual lleva un dato: la temperatura del día te dice, antes de leer nada, si vas en plan. Encaja con la dieta keto y con el control de saturada.

## 2. Plano maestro

- **Tokens:** colores de claro y oscuro diseñados por separado; escala fluida con clamp(); espaciado de 4 a 72; radios 6/10/16/24/pill; elevación e-1 y e-2; grano con feTurbulence; curvas --ease-out-expo, --ease-out-quart, --ease-in-out, --spring-soft y --spring-pop; variable --heat (0-1) calculada con los datos del día.
- **Composición:** cifra gigante condensada con «días» en serif itálica; el hero completo solo en Hoy; en las demás vistas se pliega a una banda para que el contenido aparezca en 3 segundos. La primera letra de cada titular en serif color brasa como detalle de revista.
- **Narrativa:**
  - Al cargar (una vez por sesión): intro de marca en 1,2 s con revelado por máscara y barra térmica.
  - Al apuntar una comida: check SVG trazado, chispas térmicas, vibración y la comida nueva se ilumina.
  - Al apuntar todo el menú: «Día cerrado» en tipografía cinética con brasas que suben.
  - Al pasarte de saturada: aviso con trazo, contador revelado y vibración.
- **Movimiento:**
  - Entradas: 0,6-0,9 s con ease-out-expo.
  - Botones: spring-pop a 0,35 s.
  - Barras: 0,9-1 s con ease-out-expo.
  - Halo: 30 fps, se pausa fuera de pantalla y con la pestaña oculta.
- **Nunca se mueve:** formularios, cifras que editas, tablas y navegación.
- **Movimiento reducido:** sin intro, sin chispas, sin rebotes ni desplazamientos. Solo fundidos, y el halo queda como imagen fija.
- **Orden de construcción:** tokens → tipografía → barra y hero → superficies → controles → halo → intro → momentos → ajustes responsive → crítica.

## 3. Crítica del jurado

Puntuación de la primera pasada: diseño 7, usabilidad 6, creatividad 8, contenido 8. Después de las correcciones: 8,5 / 8 / 8,5 / 8.

Corregido:
1. El hero de 750 px tapaba el contenido en todas las vistas. Ahora se pliega fuera de Hoy.
2. El chevron del select se repetía en mosaico.
3. La lectura térmica se partía en dos líneas en el móvil.
4. La etiqueta «HOY» de la tira chocaba con la lectura térmica en la banda.
5. El velo de la celebración dejaba leer el contenido de detrás.
6. La celebración enfriaba el halo aunque te hubieras pasado; ya no miente.
7. Un dígito en serif en «96,6 kg» quedaba raro; se desactiva en Progreso.
8. Las pestañas se partían en tablet.
9. Quedaban titulares en mayúsculas con otra voz; se han unificado.
10. El icono de la fecha nativa era distinto en cada navegador; ahora es propio.
11. Bug previo: «actualizado undefined» en el plan del coach.

## 4. Checklist

- [x] Lógica, claves de localStorage y modelo de datos sin tocar (solo CSS y un módulo FX que se engancha a render()).
- [x] Datos guardados legibles (rx27-data-v1).
- [x] Intro, check, chispas, celebración, halo y aviso de saturada: probados con Playwright.
- [x] Movimiento reducido: sin intro ni chispas; la celebración aparece sin animación.
- [x] Móvil 390, tablet 820 y escritorio 1280, en claro y en oscuro.
- [x] Vista compartida (Javigotchi) sin errores.
- [x] Cero errores de consola.
