# usage-remaining

Plugin de OpenCode que muestra, junto al indicador de contexto de la barra
inferior del prompt, el **porcentaje de cuota de uso de tu cuenta** que te
queda en la ventana actual (p. ej. `· 78% IA`).

> **Sobre la cuota real del plan:** OpenCode no expone en el cliente el límite
> de uso de la cuenta (free tier ni Go). El indicador mide el **consumo local**
> de la ventana (tokens o peticiones) contra el presupuesto que configures.

## Opciones (`~/.config/opencode/opencode.json`)

```json
{
  "plugins": [
    {
      "package": "./plugins/usage-remaining",
      "options": {
        "limit": 1000000,
        "window": "day",
        "unit": "tokens",
        "label": "IA",
        "footer": true,
        "sidebar": false,
        "tokens": false,
        "cache": false,
        "refresh": 30000
      }
    }
  ]
}
```

| Opción | Por defecto | Descripción |
|---|---|---|
| `limit` | `1000000` | Presupuesto de la ventana, en la unidad elegida. |
| `window` | `"day"` | `"day"` (desde la medianoche local) o un número de horas (ventana móvil, p. ej. `5` para los "requests por 5 horas" de Go). |
| `unit` | `"tokens"` | `"tokens"` (entrada + salida + razonamiento) o `"requests"` (llamadas al modelo). |
| `label` | `"IA"` | Texto detrás del porcentaje. |
| `footer` | `true` | Mostrar en la barra inferior del prompt, junto al contexto. |
| `sidebar` | `false` | Mostrar también en la barra lateral. |
| `tokens` | `false` | Añadir el número absoluto que queda: `(12.3k)`. |
| `cache` | `false` | Incluir los tokens de caché (lectura/escritura) en el consumo. |
| `perModel` | `true` | Medir el consumo del **modelo actual** (cada modelo tiene su propia cuota en el free tier). Si es `false`, suma todos los modelos. |
| `refresh` | `30000` | Milisegundos entre refrescos de la estadística. |

## Cuota por modelo

En el free tier cada modelo tiene su propia cuota diaria. Por defecto el indicador
mide el consumo del **modelo actual** de la sesión, así que al cambiar de modelo
el porcentaje se reinicia para ese modelo. Pon `"perModel": false` si prefieres
sumar el consumo de todos los modelos.

## Cómo ajustar el límite

Si usas un modelo gratuito, el límite real lo impone opencode.ai (verás
`"Free usage limit reached..."` al agotarlo). Ajusta `limit` a tu consumo
típico diario (puedes verlo con el propio indicador cuando esté al 100 %).

Si estás en OpenCode Go, usa `window: 5`, `unit: "requests"` y el número de
"requests por 5 horas" del modelo que uses (lista en la consola de Go).

## Color

- Verde: queda más del 25 %.
- Amarillo: queda entre 10 % y 25 %.
- Rojo: queda el 10 % o menos.
