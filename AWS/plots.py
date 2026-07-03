from pathlib import Path

import matplotlib.pyplot as plt

from config import CPU_REF, CPU_MIN, CPU_MAX


SCENARIOS = [
    {
        "filename": "escenario_1_inicializacion.png",
        "title": "Escenario 1 - Inicializacion del sistema",
        "start": 0,
        "end": 60,
    },
    {
        "filename": "escenario_2_aumento_trafico.png",
        "title": "Escenario 2 - Aumento repentino de trafico",
        "start": 70,
        "end": 130,
    },
    {
        "filename": "escenario_3_scale_out.png",
        "title": "Escenario 3 - Scale-out y warm-up",
        "start": 110,
        "end": 150,
    },
    {
        "filename": "escenario_4_disminucion_carga.png",
        "title": "Escenario 4 - Disminucion de carga",
        "start": 230,
        "end": 280,
    },
    {
        "filename": "escenario_5_scale_in.png",
        "title": "Escenario 5 - Scale-in",
        "start": 230,
        "end": 300,
    },
]


def filter_results_by_time(results, start, end):
    indexes = [
        index
        for index, current_time in enumerate(results["time"])
        if start <= current_time <= end
    ]

    return {
        key: [values[index] for index in indexes]
        for key, values in results.items()
    }


def plot_results(results, title, output_path):
    time = results["time"]
    cpu = results["cpu"]
    active_ec2 = results["active_ec2"]
    pending_ec2 = results["pending_ec2"]
    rps = results["rps"]

    plt.figure(figsize=(15, 10))
    plt.suptitle(title, fontsize=14, fontweight="bold")

    # ----------------------------------------
    # CPU Utilization
    # ----------------------------------------
    plt.subplot(3, 1, 1)

    plt.plot(time, cpu, linewidth=2, label="CPU Utilization")

    plt.axhline(
        CPU_REF,
        color="red",
        linestyle="--",
        label="SetPoint (60%)"
    )

    plt.axhline(
        CPU_MIN,
        color="green",
        linestyle="--",
        label="Límite inferior (50%)"
    )

    plt.axhline(
        CPU_MAX,
        color="orange",
        linestyle="--",
        label="Límite superior (70%)"
    )

    plt.title("CPU Utilization del Auto Scaling Group")
    plt.ylabel("CPU (%)")
    plt.grid(True)
    plt.legend()

    # ----------------------------------------
    # Instancias EC2
    # ----------------------------------------
    plt.subplot(3, 1, 2)

    plt.plot(
        time,
        active_ec2,
        linewidth=2,
        label="Instancias EC2 activas"
    )

    plt.plot(
        time,
        pending_ec2,
        linewidth=2,
        linestyle="--",
        label="Instancias EC2 pendientes"
    )

    plt.title("Cantidad de instancias EC2")
    plt.ylabel("Instancias")
    plt.grid(True)
    plt.legend()

    # ----------------------------------------
    # Requests
    # ----------------------------------------
    plt.subplot(3, 1, 3)

    plt.plot(
        time,
        rps,
        linewidth=2,
        label="Requests por segundo (RPS)"
    )

    plt.title("Carga de trabajo")
    plt.xlabel("Tiempo (s)")
    plt.ylabel("RPS")
    plt.grid(True)
    plt.legend()

    plt.tight_layout(rect=[0, 0, 1, 0.96])
    plt.savefig(output_path, dpi=300)
    plt.close()


def generate_plots(results):
    """
    Genera los gráficos de la simulación.
    """
    output_dir = Path("outputs")
    output_dir.mkdir(exist_ok=True)

    plot_results(
        results,
        "Simulacion completa de Auto Scaling en AWS",
        output_dir / "simulacion_aws.png",
    )

    scenario_dir = output_dir / "escenarios"
    scenario_dir.mkdir(exist_ok=True)

    for scenario in SCENARIOS:
        scenario_results = filter_results_by_time(
            results,
            scenario["start"],
            scenario["end"],
        )
        plot_results(
            scenario_results,
            scenario["title"],
            scenario_dir / scenario["filename"],
        )
