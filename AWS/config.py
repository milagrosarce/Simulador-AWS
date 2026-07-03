# Parametros generales de la simulacion

CPU_REF = 60          # Setpoint de CPU (%)
CPU_MIN = 50          # Limite inferior aceptable (%)
CPU_MAX = 70          # Limite superior aceptable (%)

KP = 0.40             # Ganancia proporcional del controlador P
CONTROL_THRESHOLD = 8 # Umbral minimo para ejecutar una accion

MIN_EC2 = 4           # Cantidad minima de instancias EC2
MAX_EC2 = 10          # Cantidad maxima de instancias EC2
INITIAL_EC2 = 4       # Instancias iniciales

MAX_RPS_PER_EC2 = 2000      # Capacidad maxima por instancia
NOMINAL_RPS_PER_EC2 = 1200  # Carga nominal por instancia

TOTAL_TIME = 300      # Duracion total de la simulacion en segundos
SCAN_TIME = 1         # Paso de simulacion

CLOUDWATCH_PERIOD = 60  # CloudWatch mide cada 60 segundos
WARM_UP_TIME = 20       # Tiempo simplificado de warm-up
COOLDOWN = 10           # Tiempo minimo entre acciones de escalamiento

RANDOM_SEED = 42        # Para que los resultados sean reproducibles
