from simulator import run_simulation
from plots import generate_plots


def print_summary(results):
    print("Simulación finalizada")
    print("-----------------------------------")
    print(f"Tiempo total simulado: {results['time'][-1]} segundos")
    print(f"CPU máxima alcanzada: {max(results['cpu']):.2f}%")
    print(f"CPU mínima alcanzada: {min(results['cpu']):.2f}%")
    print(f"Máxima cantidad de instancias EC2 activas: {max(results['active_ec2'])}")
    print(f"Mínima cantidad de instancias EC2 activas: {min(results['active_ec2'])}")
    print(f"Máxima cantidad total de instancias EC2: {max(results['total_ec2'])}")
    print(f"Señal de control final: {results['control_signal'][-1]:.2f}")
    print("-----------------------------------")

    print("Eventos relevantes:")
    for t, event in zip(results["time"], results["event"]):
        if event:
            print(f"t={t}s -> {event}")


def main():
    results = run_simulation()
    print_summary(results)
    generate_plots(results)


if __name__ == "__main__":
    main()
