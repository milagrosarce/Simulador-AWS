const config = {
  cpuRef: 60,
  cpuMin: 50,
  cpuMax: 70,
  kp: 0.4,
  controlThreshold: 8,
  minEc2: 4,
  maxEc2: 10,
  initialEc2: 4,
  maxRpsPerEc2: 2000,
  nominalRpsPerEc2: 1200,
  cloudWatchPeriod: 10,
  warmUpTime: 12,
  cooldown: 10,
  historyLimit: 180,
};

const elements = {
  toggleRun: document.querySelector("#toggleRun"),
  stepOnce: document.querySelector("#stepOnce"),
  resetSimulation: document.querySelector("#resetSimulation"),
  kpInput: document.querySelector("#kpInput"),
  requestInput: document.querySelector("#requestInput"),
  speedInput: document.querySelector("#speedInput"),
  kpLabel: document.querySelector("#kpLabel"),
  requestLabel: document.querySelector("#requestLabel"),
  speedLabel: document.querySelector("#speedLabel"),
  timeValue: document.querySelector("#timeValue"),
  rpsValue: document.querySelector("#rpsValue"),
  cpuValue: document.querySelector("#cpuValue"),
  errorValue: document.querySelector("#errorValue"),
  controlValue: document.querySelector("#controlValue"),
  ec2Value: document.querySelector("#ec2Value"),
  pendingValue: document.querySelector("#pendingValue"),
  lastEventValue: document.querySelector("#lastEventValue"),
  eventLog: document.querySelector("#eventLog"),
  cpuChart: document.querySelector("#cpuChart"),
  rpsChart: document.querySelector("#rpsChart"),
  ec2Chart: document.querySelector("#ec2Chart"),
  blackFriday: document.querySelector("#blackFriday"),
  trafficSpike: document.querySelector("#trafficSpike"),
  lowDemand: document.querySelector("#lowDemand"),
  instanceFailure: document.querySelector("#instanceFailure"),
};

const state = {
  running: true,
  t: 0,
  activeEc2: config.initialEc2,
  pendingInstances: [],
  lastScalingTime: -999,
  baseRps: config.nominalRpsPerEc2 * config.initialEc2,
  perturbations: [],
  history: [],
  events: [],
  intervalId: null,
  lastBlockedScaleInTime: -999,
};

function formatNumber(value) {
  return Math.round(value).toLocaleString("es-AR");
}

function addEvent(label) {
  const entry = `t=${state.t}s - ${label}`;
  elements.lastEventValue.textContent = label;
  state.events.unshift(entry);
  state.events = state.events.slice(0, 12);
  elements.eventLog.innerHTML = state.events
    .map((event) => `<li>${event}</li>`)
    .join("");
}

function addPerturbation(name, deltaRps, duration) {
  state.perturbations.push({
    name,
    deltaRps,
    endTime: state.t + duration,
  });
  addEvent(`${name} (${deltaRps > 0 ? "+" : ""}${formatNumber(deltaRps)} RPS)`);
}

function calculatePerturbationRps() {
  state.perturbations = state.perturbations.filter((item) => item.endTime > state.t);
  return state.perturbations.reduce((total, item) => total + item.deltaRps, 0);
}

function calculateRps() {
  const warmStart = state.t < 20 ? state.t / 20 : 1;
  const randomNoise = 1 + (Math.sin(state.t * 0.37) * 0.06) + (Math.cos(state.t * 0.11) * 0.04);
  const demand = (state.baseRps * warmStart * randomNoise) + calculatePerturbationRps();
  return Math.max(demand, 0);
}

function calculateCpu(rps) {
  if (state.activeEc2 <= 0) {
    return 100;
  }

  return Math.min((rps / (state.activeEc2 * config.maxRpsPerEc2)) * 100, 100);
}

function evaluateController(cpu) {
  const error = cpu - config.cpuRef;
  const controlSignal = config.kp * error;
  let action = 0;
  let event = "";

  if (state.t - state.lastScalingTime < config.cooldown) {
    return { error, controlSignal, action, event };
  }

  if (
    controlSignal >= config.controlThreshold &&
    cpu > config.cpuMax &&
    state.activeEc2 + state.pendingInstances.length < config.maxEc2
  ) {
    const desiredInstances = Math.ceil(controlSignal / config.controlThreshold);
    const availableSlots = config.maxEc2 - state.activeEc2 - state.pendingInstances.length;
    const pendingCorrection = state.pendingInstances.length;
    action = Math.min(
      Math.max(desiredInstances - pendingCorrection, 0),
      availableSlots,
    );
    if (action === 0) {
      event = "Scale-out cubierto por EC2 pendiente";
      return { error, controlSignal, action, event };
    }

    for (let i = 0; i < action; i += 1) {
      state.pendingInstances.push(state.t + config.warmUpTime);
    }
    state.lastScalingTime = state.t;
    event = `Scale-out solicitado (+${action} EC2)`;
  }

  if (
    controlSignal <= -config.controlThreshold &&
    cpu < config.cpuMin
  ) {
    if (state.activeEc2 <= config.minEc2) {
      if (state.t - state.lastBlockedScaleInTime >= 30) {
        state.lastBlockedScaleInTime = state.t;
        event = `Scale-in bloqueado: minimo ${config.minEc2} EC2`;
      }
      return { error, controlSignal, action, event };
    }

    const desiredInstances = Math.ceil(Math.abs(controlSignal) / config.controlThreshold);
    const removableInstances = state.activeEc2 - config.minEc2;
    const instancesToRemove = Math.min(desiredInstances, removableInstances);
    action = -instancesToRemove;
    state.activeEc2 -= instancesToRemove;
    state.lastScalingTime = state.t;
    event = `Scale-in ejecutado (${action} EC2 activas)`;
  }

  return { error, controlSignal, action, event };
}

function processPendingInstances() {
  const readyInstances = state.pendingInstances.filter((readyAt) => readyAt <= state.t);
  if (readyInstances.length > 0) {
    state.activeEc2 += readyInstances.length;
    addEvent("Warm-up finalizado");
  }

  state.pendingInstances = state.pendingInstances.filter((readyAt) => readyAt > state.t);
}

function tick() {
  state.t += 1;
  processPendingInstances();

  const rps = calculateRps();
  const cpu = calculateCpu(rps);
  let controller = {
    error: cpu - config.cpuRef,
    controlSignal: config.kp * (cpu - config.cpuRef),
    action: 0,
    event: "",
  };

  if (state.t !== 0 && state.t % config.cloudWatchPeriod === 0) {
    controller = evaluateController(cpu);
    if (controller.event) {
      addEvent(controller.event);
    }
  }

  const snapshot = {
    time: state.t,
    rps,
    cpu,
    error: controller.error,
    controlSignal: controller.controlSignal,
    activeEc2: state.activeEc2,
    pendingEc2: state.pendingInstances.length,
    totalEc2: state.activeEc2 + state.pendingInstances.length,
    action: controller.action,
  };

  state.history.push(snapshot);
  state.history = state.history.slice(-config.historyLimit);
  render(snapshot);
}

function drawChart(canvas, series, options) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = { top: 16, right: 18, bottom: 26, left: 48 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const minY = options.minY;
  const maxY = Math.max(options.maxY, minY + 1);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfcfe";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#d9e0e7";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#697783";
  ctx.font = "12px Inter, system-ui, sans-serif";

  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (plotHeight / 4) * i;
    const value = maxY - ((maxY - minY) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(Math.round(value).toString(), 8, y + 4);
  }

  if (options.referenceLines) {
    options.referenceLines.forEach((line) => {
      const y = padding.top + plotHeight - ((line.value - minY) / (maxY - minY)) * plotHeight;
      ctx.strokeStyle = line.color;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  const lines = Number.isFinite(series[0])
    ? [{ values: series, color: options.color, dashed: false }]
    : series;

  if (lines.every((line) => line.values.length < 2)) {
    return;
  }

  lines.forEach((line) => {
    if (line.values.length < 2) {
      return;
    }

    ctx.strokeStyle = line.color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(line.dashed ? [7, 5] : []);
    ctx.beginPath();

    line.values.forEach((point, index) => {
      const x = padding.left + (index / (config.historyLimit - 1)) * plotWidth;
      const y = padding.top + plotHeight - ((point - minY) / (maxY - minY)) * plotHeight;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
    ctx.setLineDash([]);
  });
}

function render(snapshot) {
  elements.timeValue.textContent = `${snapshot.time} s`;
  elements.rpsValue.textContent = formatNumber(snapshot.rps);
  elements.cpuValue.textContent = `${snapshot.cpu.toFixed(1)}%`;
  elements.errorValue.textContent = snapshot.error.toFixed(1);
  elements.controlValue.textContent = snapshot.controlSignal.toFixed(1);
  elements.ec2Value.textContent = `${snapshot.activeEc2}`;
  elements.pendingValue.textContent = `${snapshot.pendingEc2}`;

  const cpuSeries = state.history.map((item) => item.cpu);
  const rpsSeries = state.history.map((item) => item.rps);
  const activeEc2Series = state.history.map((item) => item.activeEc2);
  const pendingEc2Series = state.history.map((item) => item.pendingEc2);

  drawChart(elements.cpuChart, cpuSeries, {
    minY: 0,
    maxY: 100,
    color: "#2563eb",
    referenceLines: [
      { value: config.cpuRef, color: "#dc2626" },
      { value: config.cpuMin, color: "#16a34a" },
      { value: config.cpuMax, color: "#f59e0b" },
    ],
  });

  drawChart(elements.rpsChart, rpsSeries, {
    minY: 0,
    maxY: Math.max(12000, ...rpsSeries) * 1.08,
    color: "#f59e0b",
  });

  drawChart(elements.ec2Chart, [
    { values: activeEc2Series, color: "#16a34a", dashed: false },
    { values: pendingEc2Series, color: "#2563eb", dashed: true },
  ], {
    minY: 0,
    maxY: config.maxEc2,
    color: "#16a34a",
  });
}

function restartTimer() {
  if (state.intervalId) {
    window.clearInterval(state.intervalId);
  }

  const delay = 1000 / Number(elements.speedInput.value);
  state.intervalId = window.setInterval(() => {
    if (state.running) {
      tick();
    }
  }, delay);
}

function resetSimulation() {
  state.running = true;
  state.t = 0;
  state.activeEc2 = config.initialEc2;
  state.pendingInstances = [];
  state.lastScalingTime = -999;
  state.baseRps = Number(elements.requestInput.value);
  state.perturbations = [];
  state.history = [];
  state.events = [];
  state.lastBlockedScaleInTime = -999;
  elements.toggleRun.textContent = "Pausar";
  addEvent("Simulacion reiniciada");
  tick();
}

elements.toggleRun.addEventListener("click", () => {
  state.running = !state.running;
  elements.toggleRun.textContent = state.running ? "Pausar" : "Reanudar";
});

elements.stepOnce.addEventListener("click", () => {
  state.running = false;
  elements.toggleRun.textContent = "Reanudar";
  tick();
});

elements.resetSimulation.addEventListener("click", resetSimulation);

elements.kpInput.addEventListener("input", (event) => {
  config.kp = Number(event.target.value);
  elements.kpLabel.textContent = config.kp.toFixed(2);
});

elements.requestInput.addEventListener("input", (event) => {
  state.baseRps = Number(event.target.value);
  elements.requestLabel.textContent = formatNumber(state.baseRps);
});

elements.speedInput.addEventListener("input", (event) => {
  elements.speedLabel.textContent = `${event.target.value}x`;
  restartTimer();
});

elements.blackFriday.addEventListener("click", () => {
  addPerturbation("Black Friday", 7000, 90);
});

elements.trafficSpike.addEventListener("click", () => {
  addPerturbation("Pico de requests", 3500, 45);
});

elements.lowDemand.addEventListener("click", () => {
  addPerturbation("Baja demanda", -2500, 70);
});

elements.instanceFailure.addEventListener("click", () => {
  if (state.activeEc2 > 0) {
    state.activeEc2 -= 1;
    state.pendingInstances.push(state.t + config.warmUpTime);
    addEvent("Falla EC2: reemplazo pendiente");
  } else {
    addEvent("Falla EC2 bloqueada");
  }
});

elements.requestLabel.textContent = formatNumber(state.baseRps);
restartTimer();
resetSimulation();
