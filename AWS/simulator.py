import numpy as np

from config import (
    CPU_REF,
    CPU_MIN,
    CPU_MAX,
    KP,
    CONTROL_THRESHOLD,
    MIN_EC2,
    MAX_EC2,
    INITIAL_EC2,
    MAX_RPS_PER_EC2,
    NOMINAL_RPS_PER_EC2,
    TOTAL_TIME,
    SCAN_TIME,
    CLOUDWATCH_PERIOD,
    WARM_UP_TIME,
    COOLDOWN,
    RANDOM_SEED,
)


def generate_rps(t):
    """
    Genera la carga de requests por segundo.
    Representa la demanda de usuarios sobre la aplicación.
    """
    if t < 20:
        return (t / 20) * NOMINAL_RPS_PER_EC2 * 4

    base = np.random.uniform(0.90, 1.10) * NOMINAL_RPS_PER_EC2 * 4

    # Perturbación 1: evento masivo / campaña
    if 80 <= t <= 130:
        base += 3500

    # Perturbación 2: pico fuerte de tráfico
    if 170 <= t <= 210:
        base += 4500

    # Perturbación 3: baja de demanda
    if 240 <= t <= 280:
        base -= 2500

    return max(base, 0)


def instance_failure(t):
    """
    Simula una falla puntual de una instancia EC2.
    """
    return t == 150


def calculate_cpu(rps, active_ec2):
    """
    Calcula CPU Utilization promedio del Auto Scaling Group.
    """
    if active_ec2 <= 0:
        return 100

    cpu = (rps / (active_ec2 * MAX_RPS_PER_EC2)) * 100
    return min(cpu, 100)


def scaling_decision(cpu, active_ec2, last_scaling_time, t):
    """
    Representa una Target Tracking Scaling Policy como control P.
    """
    error = cpu - CPU_REF
    control_signal = KP * error

    if t - last_scaling_time < COOLDOWN:
        return 0, control_signal, error

    if (
        control_signal >= CONTROL_THRESHOLD
        and cpu > CPU_MAX
        and active_ec2 < MAX_EC2
    ):
        return 1, control_signal, error  # scale-out

    if (
        control_signal <= -CONTROL_THRESHOLD
        and cpu < CPU_MIN
        and active_ec2 > MIN_EC2
    ):
        return -1, control_signal, error  # scale-in

    return 0, control_signal, error


def run_simulation():
    """
    Ejecuta la simulación completa.
    """
    np.random.seed(RANDOM_SEED)

    active_ec2 = INITIAL_EC2
    pending_instances = []
    last_scaling_time = -999
    control_signal = 0

    results = {
        "time": [],
        "rps": [],
        "cpu": [],
        "active_ec2": [],
        "pending_ec2": [],
        "total_ec2": [],
        "action": [],
        "event": [],
        "error": [],
        "control_signal": [],
    }

    for t in range(0, TOTAL_TIME + 1, SCAN_TIME):

        event = ""

        # Instancias que terminan warm-up
        ready_instances = [ready for ready in pending_instances if ready <= t]
        if ready_instances:
            active_ec2 += len(ready_instances)
            event = "Warm-up finalizado"

        pending_instances = [ready for ready in pending_instances if ready > t]

        # Falla puntual de instancia. Puede bajar temporalmente del minimo deseado.
        if instance_failure(t) and active_ec2 > 0:
            active_ec2 -= 1
            pending_instances.append(t + WARM_UP_TIME)
            event = "Falla de instancia EC2: reemplazo pendiente"

        rps = generate_rps(t)
        cpu = calculate_cpu(rps, active_ec2)

        action = 0
        error = cpu - CPU_REF

        # CloudWatch evalúa cada CLOUDWATCH_PERIOD segundos
        if t != 0 and t % CLOUDWATCH_PERIOD == 0:
            action, control_signal, error = scaling_decision(
                cpu,
                active_ec2,
                last_scaling_time,
                t,
            )

            if action == 1:
                pending_instances.append(t + WARM_UP_TIME)
                last_scaling_time = t
                event = "Scale-out solicitado"

            elif action == -1:
                active_ec2 -= 1
                last_scaling_time = t
                event = "Scale-in ejecutado"

        results["time"].append(t)
        results["rps"].append(rps)
        results["cpu"].append(cpu)
        results["active_ec2"].append(active_ec2)
        results["pending_ec2"].append(len(pending_instances))
        results["total_ec2"].append(active_ec2 + len(pending_instances))
        results["action"].append(action)
        results["event"].append(event)
        results["error"].append(error)
        results["control_signal"].append(control_signal)

    return results
