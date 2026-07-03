# Simulador de Auto Scaling en AWS

Este proyecto simula el comportamiento de un Auto Scaling Group de EC2 ante cambios de carga, picos de requests, warm-up de instancias, cooldown y una falla puntual.

## Archivos principales

- `main.py`: ejecuta la simulacion, imprime un resumen y genera los graficos.
- `simulator.py`: contiene la logica de carga, CPU, eventos y controlador proporcional.
- `plots.py`: genera el grafico general y los graficos por escenario.
- `config.py`: centraliza los parametros de la simulacion.

## Instalacion

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Para la interfaz web interactiva se requiere tener Node.js instalado.

## Ejecucion

```bash
python3 main.py
```

Al finalizar, el programa muestra un resumen por consola y guarda el grafico en:

```text
outputs/simulacion_aws.png
```

Tambien genera graficos separados por escenario en:

```text
outputs/escenarios/
```

## Simulacion interactiva

Tambien se incluye una version web interactiva en `index.html`.
Permite pausar, avanzar paso a paso, modificar `Kp`, cambiar los requests base, ajustar la velocidad y aplicar perturbaciones como Black Friday, picos de requests, baja demanda y falla de una instancia EC2.

En la version web interactiva se utilizan tiempos de evaluacion y warm-up mas cortos que en la simulacion estatica en Python. Esto se realizo con el objetivo de facilitar la visualizacion en tiempo real de la respuesta del sistema ante cambios de carga y perturbaciones. La logica de control se mantiene equivalente: CloudWatch evalua periodicamente la CPU, el controlador proporcional calcula la accion de control y el Auto Scaling Group incorpora o elimina instancias EC2 respetando los limites definidos.

Para usarla con servidor local:

```bash
npm start
```

Luego abrir:

```text
http://localhost:8000
```

## Supuestos del modelo

- CloudWatch evalua la metrica de CPU cada `CLOUDWATCH_PERIOD` segundos.
- Las instancias nuevas tardan `WARM_UP_TIME` segundos en estar activas.
- El grupo respeta los limites `MIN_EC2` y `MAX_EC2`.
- Ante una falla EC2, las instancias activas pueden quedar temporalmente por debajo de `MIN_EC2` mientras se inicia una instancia de reemplazo.
- La CPU se calcula a partir de la relacion entre requests por segundo e instancias activas.
- La politica de escalamiento usa un controlador proporcional:
  `control = KP * error`.
- El error se calcula como la diferencia entre la CPU medida y el setpoint `CPU_REF`.
- `RANDOM_SEED` permite repetir los mismos resultados en cada ejecucion.

## Resultado esperado

La simulacion permite observar como el grupo escala ante picos de trafico, como responde a una falla de instancia y cuando ejecuta scale-in al bajar la demanda.

