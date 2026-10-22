# OpenCode custom plugins

Colección de plugins personalizados para [OpenCode](https://opencode.ai).

## usage-remaining

Muestra junto al indicador de contexto de la barra inferior del prompt el
**porcentaje de cuota de uso de la cuenta (no del contexto)** que te queda en la ventana actual
(p. ej. `· 78% IA`).

- Mide el consumo local (tokens o peticiones) de la ventana actual contra un
  presupuesto configurable.
- Color por porcentaje restante: verde >25 %, amarillo 10–25 %, rojo ≤10 %.
- Opciones configurables en `~/.config/opencode/opencode.json`.

Ver [usage-remaining/README.md](./usage-remaining/README.md) para detalles.
