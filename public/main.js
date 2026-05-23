// --- State ---
let role = null; // null | "left" | "right"
let hasBall = false;

let viewW = window.innerWidth;
let viewH = 450;
let worldW = viewW * 2;
let worldH = viewH;

let viewport = null;
const gravity = 900;
const ballSearchDistance = 80;
const windows = {
  left: { width: 0, height: 0 },
  right: { width: 0, height: 0 },
};

let ballTarget = 30;
let gateSize = 38;
let openGateSize = gateSize;
let gateCenterY = 100;
let selectedLimit = 6;
let selectedBalls = [];
const gateWidth = 10;

// --- Shared channel: this is the main feature for cross-tab synchronisation ---
const channel = new BroadcastChannel("shared-ball");

// --- Canvas ---
const canvas = document.getElementById("c");
canvas.width = viewW;
canvas.height = viewH;

const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");

function randColorHSL() {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h}, 70%, 60%)`;
}

function generateBall(i) {
  const randomX = 60 + Math.random() * 180;
  const randomY = 50 + Math.random() * 120;
  return {
    id: Date.now() + "-" + i + "-" + Math.random(),
    number: i + 1,
    x: randomX,
    y: randomY,
    vx: 260 + Math.random() * 120,
    vy: 80 + Math.random() * 80,
    r: 20,
    color: randColorHSL(),
    rebounceCounter: 0,
    selected: false,
  };
}

let balls = [];

function resetBalls() {
  balls = [];
  selectedBalls = [];
  gateSize = openGateSize;

  for (let i = 0; i < ballTarget; i++) {
    balls.push(generateBall(i));
  }

  closeGateIfSelectedFull();
  publishState();
  updateHud();
}

function changeBallTarget(amount) {
  ballTarget = Math.max(1, Math.min(30, ballTarget + amount));
  selectedLimit = Math.min(selectedLimit, ballTarget);

  while (balls.filter((ball) => !ball.selected).length < ballTarget) {
    balls.push(generateBall(balls.length));
  }

  while (balls.filter((ball) => !ball.selected).length > ballTarget) {
    const lastActiveIndex = balls
      .map((ball) => ball.selected)
      .lastIndexOf(false);
    if (lastActiveIndex === -1) break;
    balls.splice(lastActiveIndex, 1);
  }

  publishState();
  updateHud();
}

function publishWindow() {
  if (!role) return;

  channel.postMessage({
    type: "WINDOW_STATE",
    payload: {
      role,
      width: window.innerWidth,
      height: window.innerHeight,
    },
  });
}

function handleWindowState(payload) {
  windows[payload.role] = {
    width: payload.width,
    height: payload.height,
  };

  recalculateLayout();
}

function recalculateLayout() {
  const leftW = windows.left.width;
  const rightW = windows.right.width;

  if (!leftW || !rightW) {
    if (role === "left") {
      viewport = { x: 0, y: 0, w: viewW, h: viewH };
      worldW = viewW;
      worldH = viewH;
    }
    if (role === "right") {
      viewport = { x: viewW, y: 0, w: viewW, h: viewH };
      worldW = viewW * 2;
      worldH = viewH;
    }
    canvas.width = viewport.w;
    canvas.height = viewport.h;
    return;
  }

  worldW = leftW + rightW;
  worldH = Math.min(windows.left.height, windows.right.height);

  if (role === "left") {
    viewport = {
      x: 0,
      y: 0,
      w: leftW,
      h: worldH,
    };
  }

  if (role === "right") {
    viewport = {
      x: leftW,
      y: 0,
      w: rightW,
      h: worldH,
    };
  }

  canvas.width = viewport.w;
  canvas.height = viewport.h;
}

function getGate() {
  const leftW = windows.left.width || viewW;
  const rightW = windows.right.width || viewW;
  const gateX = leftW + rightW / 2;
  const gateTop = gateCenterY - gateSize / 2;
  const gateBottom = gateCenterY + gateSize / 2;

  return { x: gateX, top: gateTop, bottom: gateBottom };
}

// --- UI ---
const startLeftBtn = document.getElementById("startLeftBtn");
const decreaseBallBtn = document.getElementById("decreaseBallBtn");
const increaseBallBtn = document.getElementById("increaseBallBtn");
const resetBallBtn = document.getElementById("resetBallBtn");
const gateSizeInput = document.getElementById("gateSizeInput");
const gateSizeText = document.getElementById("gateSizeText");
const selectedLimitInput = document.getElementById("gateYInput");
const selectedLimitText = document.getElementById("gateYText");
const ballCountText = document.getElementById("ballCountText");

startLeftBtn.addEventListener("click", () => {
  if (role !== null) return;

  role = "left";
  hasBall = true;

  setupLayout();
  publishWindow();
  startLeftBtn?.remove();
  document.getElementById("controller-tools").classList.remove("d-none");

  channel.postMessage({
    type: "ROLE_CLAIM",
    payload: {
      role: "left",
    },
  });

  resetBalls();
  updateHud();
});

decreaseBallBtn.addEventListener("click", () => {
  if (role !== "left") return;
  changeBallTarget(-1);
});

increaseBallBtn.addEventListener("click", () => {
  if (role !== "left") return;
  changeBallTarget(1);
});

resetBallBtn.addEventListener("click", () => {
  if (role !== "left") return;
  resetBalls();
});

gateSizeInput.addEventListener("input", () => {
  if (role !== "left") return;
  gateSize = Number(gateSizeInput.value);
  openGateSize = gateSize;
  closeGateIfSelectedFull();
  publishState();
  updateHud();
});

selectedLimitInput.addEventListener("input", () => {
  if (role !== "left") return;
  selectedLimit = Number(selectedLimitInput.value);
  closeGateIfSelectedFull();
  publishState();
  updateHud();
});

// --- Layout ---
function setupLayout() {
  viewW = window.innerWidth;
  viewH = 450;

  canvas.width = viewW;
  canvas.height = viewH;

  worldW = viewW * 2;
  worldH = viewH;

  if (role) {
    windows[role] = {
      width: viewW,
      height: viewH,
    };
  }

  if (gateSizeInput) gateSizeInput.max = viewH;
  if (selectedLimitInput) selectedLimitInput.max = ballTarget;

  recalculateLayout();
}

function updateHud() {
  const shownRole =
    role === "left" ? "Controller" : role === "right" ? "Follower" : "none";
  hud.textContent = `role=${shownRole} | N=${ballTarget} | M=${gateSize}x${gateWidth} | gateY=${Math.round(gateCenterY)} | selected=${selectedBalls.length}`;

  if (ballCountText) ballCountText.textContent = ballTarget;
  if (gateSizeText) gateSizeText.textContent = gateSize;
  if (gateSizeInput) gateSizeInput.value = gateSize;
  if (selectedLimitText) selectedLimitText.textContent = selectedLimit;
  if (selectedLimitInput) {
    selectedLimitInput.max = ballTarget;
    selectedLimitInput.value = selectedLimit;
  }
}

function updateGateY(now) {
  const maxY = worldH / 4;
  const t = now / 1000;
  gateCenterY = ((Math.sin(t * 2) + 1) / 2) * maxY;
}

// --- Physics and gate selection ---
function stepPhysics(dt) {
  const gate = getGate();

  for (const ball of balls) {
    if (ball.selected) continue;

    const oldX = ball.x;
    ball.x += ball.vx * dt;
    ball.vy += gravity * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx *= -1;
    }

    if (ball.x + ball.r > worldW) {
      ball.x = worldW - ball.r;
      ball.vx *= -1;
    }

    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy *= -1;
    }

    if (ball.y + ball.r > worldH) {
      ball.y = worldH - ball.r;
      ball.vy *= -0.8;
    }

    if (Math.abs(ball.y + ball.r - worldH) < 0.00001) {
      ball.rebounceCounter += 1;
    }

    if (ball.rebounceCounter >= 80 * (1 + Math.random())) {
      ball.vy = 800 + 200 * Math.random();
      ball.rebounceCounter = 0;
      if (ball.color === "#fff") {
        ball.color = randColorHSL();
      } else {
        ball.color = "#fff";
      }
    }

    const isCrossingGateLine = oldX < gate.x && ball.x >= gate.x;
    const isInsideGate = ball.y > gate.top && ball.y < gate.bottom;

    if (isCrossingGateLine && isInsideGate) {
      selectBall(ball);
      continue;
    }

    const hittingClosedGate =
      ball.x + ball.r > gate.x &&
      ball.x - ball.r < gate.x &&
      !(ball.y > gate.top && ball.y < gate.bottom);

    if (hittingClosedGate) {
      ball.x = gate.x - ball.r;
      ball.vx = -Math.abs(ball.vx);
    }
  }

  handleBallCollision();
}

function handleBallCollision() {
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const b = balls[j];

      if (a.selected || b.selected) continue;

      const dx = a.x - b.x;
      const dy = a.y - b.y;

      if (
        Math.abs(dx) > ballSearchDistance ||
        Math.abs(dy) > ballSearchDistance
      ) {
        continue;
      }

      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < a.r + b.r) {
        if (Math.abs(a.y + a.r - worldH) < (2 * worldH) / 10) {
          a.rebounceCounter += 10;
        }
        if (Math.abs(b.y + b.r - worldH) < (2 * worldH) / 10) {
          b.rebounceCounter += 10;
        }

        const minDistance = a.r + b.r;
        const safeDistance = distance || 1;
        const overlap = minDistance - safeDistance;
        const pushX = (dx / safeDistance) * (overlap / 2);
        const pushY = (dy / safeDistance) * (overlap / 2);

        a.x += pushX;
        a.y += pushY;
        b.x -= pushX;
        b.y -= pushY;

        const oldVx = a.vx;
        const oldVy = a.vy;

        a.vx = b.vx;
        a.vy = b.vy;
        b.vx = oldVx;
        b.vy = oldVy;
      }
    }
  }
}

function selectBall(ball) {
  ball.selected = true;
  selectedBalls.push(ball);

  const resultX = getGate().x + 80 + (selectedBalls.length % 4) * 48;
  const resultY = 70 + Math.floor(selectedBalls.length / 4) * 48;
  ball.x = resultX;
  ball.y = resultY;
  ball.vx = 0;
  ball.vy = 0;
  closeGateIfSelectedFull();
}

function closeGateIfSelectedFull() {
  if (selectedBalls.length >= selectedLimit) {
    gateSize = 0;
  }
}

// --- Render ---
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (role === null || hasBall === false || viewport === null) {
    drawWaitingText();
    return;
  }

  drawBackground();
  drawGate();

  for (const ball of balls) {
    const sx = ball.x - viewport.x;
    const sy = ball.y - viewport.y;

    if (sx < -60 || sx > canvas.width + 60) continue;

    ctx.beginPath();
    ctx.arc(sx, sy, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = ball.selected ? "#ffe066" : ball.color;
    ctx.fill();
    ctx.strokeStyle = ball.selected ? "#222" : "#ffffff55";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#111";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ball.number, sx, sy);
  }

  ctx.strokeStyle = "#333";
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
}

function drawWaitingText() {
  ctx.fillStyle = "#ddd";
  ctx.font = "20px Arial";
  ctx.fillText("Open two windows, then choose the left controller.", 40, 80);
}

function drawBackground() {
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawGate() {
  if (role !== "right") return;

  const gate = getGate();
  const x = gate.x - viewport.x;

  // The follower has a centre wall, but the middle gap lets winning balls pass.
  ctx.strokeStyle = "#e03131";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, gate.top - viewport.y);
  ctx.moveTo(x, gate.bottom - viewport.y);
  ctx.lineTo(x, canvas.height);
  ctx.stroke();

  ctx.strokeStyle = "#51cf66";
  ctx.lineWidth = 3;
  ctx.strokeRect(x - gateWidth, gate.top - viewport.y, 2 * gateWidth, gateSize);

  ctx.fillStyle = "#ffffffcc";
  ctx.font = "14px Arial";
  ctx.fillText(
    `gate M=${gateSize}x${gateWidth}, Y=${gateCenterY.toFixed(6)}`,
    x + 20,
    gate.top - viewport.y + 20,
  );
}

// --- Broadcast ---
function publishState() {
  if (role !== "left") return;

  channel.postMessage({
    type: "BALL_STATE",
    payload: {
      balls,
      ballTarget,
      gateSize,
      openGateSize,
      gateCenterY,
      selectedLimit,
      selectedBalls,
    },
  });
}

// --- Receive (main function to handle events) ---
channel.onmessage = (event) => {
  const message = event.data;

  if (message.type === "ROLE_CLAIM") {
    handleRoleClaim(message.payload);
    return;
  }

  if (message.type === "BALL_STATE") {
    handleBallState(message.payload);
    return;
  }

  if (message.type === "WINDOW_STATE") {
    handleWindowState(message.payload);
    return;
  }

  if (message.type === "HELLO") {
    if (role === "left") {
      channel.postMessage({ type: "ROLE_CLAIM", payload: { role: "left" } });
      publishWindow();
      publishState();
    }
  }
};

function handleRoleClaim(payload) {
  if (payload.role !== "left") return;

  if (role === null) {
    role = "right";
    hasBall = true;

    setupLayout();
    publishWindow();
    updateHud();
    document.getElementById("control-area").innerHTML =
      "Follower window: receiving controller state";
    return;
  }

  if (role === "left") {
    return;
  }

  if (role === "right") {
    document.getElementById("control-area").innerHTML =
      "Follower window: receiving controller state";
    return;
  }
}

function handleBallState(payload) {
  if (role !== "right") return;

  balls = payload.balls;
  ballTarget = payload.ballTarget;
  gateSize = payload.gateSize;
  openGateSize = payload.openGateSize;
  gateCenterY = payload.gateCenterY;
  selectedLimit = payload.selectedLimit;
  selectedBalls = payload.selectedBalls;
  updateHud();
}

// --- Loop ---
let last = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (role === "left") {
    updateGateY(now);
    stepPhysics(dt);
    publishState();
  }

  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

channel.postMessage({ type: "HELLO" });

window.addEventListener("resize", () => {
  if (!role) return;

  setupLayout();
  publishWindow();
  publishState();
});
