import * as THREE from "./libs/three.module.js";
import { GLTFLoader } from "./libs/GLTFLoader.js";

// ----------------------------------------------------
// GLOBAL VARS
// ----------------------------------------------------
let scene, camera, renderer, clock;
let birdPrimitive, birdFull, activeBird;
let pipes = [];
let spikes = [];
let gravity = -9.8;
let velocity = 0;
let pipeSpeed = 2;
let pipeGap = 1;
let obstacleEnabled = false;
let running = false;
let score = 0;

const NUM_PIPES = 6;
const PIPE_SPACING = 3;
const PIPE_START_X = 6;
const PIPE_RECYCLE_X = -5;
const PIPE_RESET_X = 12;
const PIPE_HEIGHT = 2.2;  
const GAP_MULTIPLIER = 2.2;
const PIPE_Y_OFFSET = 1.2;

// UI references
const scoreText = document.getElementById("score");
const messageText = document.getElementById("message");
const difficultySelect = document.getElementById("difficulty");
const modeSwitch = document.getElementById("modeSwitch");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const highScoreText = document.getElementById("highScore");

// ----------------------------------------------------
// HIGH SCORES PER DIFFICULTY
// ----------------------------------------------------
let highScores = {
  easy: Number(localStorage.getItem("flappyHigh_easy")) || 0,
  normal: Number(localStorage.getItem("flappyHigh_normal")) || 0,
  hard: Number(localStorage.getItem("flappyHigh_hard")) || 0,
  special: Number(localStorage.getItem("flappyHigh_special")) || 0
};

let currentDifficulty = "normal";
highScoreText.textContent = `Best (${currentDifficulty}): ${highScores[currentDifficulty]}`;

// ----------------------------------------------------
// INITIALIZE
// ----------------------------------------------------
init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 1.5, 5);

  clock = new THREE.Clock();

  // Lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
  let dir = new THREE.DirectionalLight(0xffffff, 1);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x228b22 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.userData = {
    primitiveMat: floor.material,
    fullMat: () =>
      new THREE.MeshStandardMaterial({
        map: new THREE.TextureLoader().load("https://threejs.org/examples/textures/uv_grid_opengl.jpg")
      })
  };
  scene.add(floor);

  // Birds
  birdPrimitive = createPrimitiveBird();
  scene.add(birdPrimitive);

  birdFull = createFullBird();
  scene.add(birdFull);
  birdFull.visible = false;

  activeBird = birdPrimitive;

  // Pipes
  for (let i = 0; i < NUM_PIPES; i++) {
    pipes.push(createPipePair(PIPE_START_X + i * PIPE_SPACING));
  }

  // Spikes
  for (let i = 0; i < 4; i++) {
    let s = createSpike(PIPE_START_X + i * 4);
    spikes.push(s);
    scene.add(s);
  }

  // UI events
  difficultySelect.addEventListener("change", e => applyDifficulty(e.target.value));
  modeSwitch.addEventListener("change", () => setVisualMode(modeSwitch.checked));

  document.getElementById("flapBtn").addEventListener("click", flap);

  window.addEventListener("keydown", e => {
    if (e.code === "Space") {
      if (!running) startGame();
      flap();
    }
    if (e.code === "KeyR") startGame();
  });

  window.addEventListener("pointerdown", () => {
    if (!running) startGame();
    flap();
  });

  startBtn.addEventListener("click", startGame);
  restartBtn.addEventListener("click", startGame);

  showMessage("Tap / Space to start");
}

// ----------------------------------------------------
// START GAME FUNCTION
// ----------------------------------------------------
function startGame() {
  resetGame();
  running = true;
  startBtn.style.display = "none";
  restartBtn.style.display = "none";
  messageText.textContent = "";
}

// ----------------------------------------------------
// BIRD CREATION
// ----------------------------------------------------
function createPrimitiveBird() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
  );
}

function createFullBird() {
  let mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.25),
    new THREE.MeshStandardMaterial({ color: 0xffaa00 })
  );

  const loader = new GLTFLoader();
  loader.load(
    "https://threejs.org/examples/models/gltf/Flamingo.glb",
    gltf => {
      let m = gltf.scene;
      m.scale.set(0.01, 0.01, 0.01);
      mesh.add(m);
    }
  );

  return mesh;
}

// ----------------------------------------------------
// PIPE CREATION
// ----------------------------------------------------
function createPipePair(xPos) {
  const gapSize = pipeGap * GAP_MULTIPLIER;
  const yCenter = Math.random() * 1.2 + 0.2;

  const geom = new THREE.CylinderGeometry(0.4, 0.4, PIPE_HEIGHT, 16);
  const matPrimitive = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  const matFull = matPrimitive.clone();

  const top = new THREE.Mesh(geom, matPrimitive);
  top.position.set(
    xPos,
    PIPE_Y_OFFSET + yCenter + gapSize / 2 + PIPE_HEIGHT / 2,
    0
  );
  scene.add(top);

  const bottom = new THREE.Mesh(geom, matPrimitive);
  bottom.position.set(
    xPos,
    PIPE_Y_OFFSET + yCenter - gapSize / 2 - PIPE_HEIGHT / 2,
    0
  );
  scene.add(bottom);

  top.userData = { primitiveMat: matPrimitive, fullMat: matFull };
  bottom.userData = { primitiveMat: matPrimitive, fullMat: matFull };

  return { top, bottom, passed: false };
}

// ----------------------------------------------------
// SPIKES
// ----------------------------------------------------
function createSpike(xPos) {
  let s = new THREE.Mesh(
    new THREE.ConeGeometry(0.25, 0.8, 12),
    new THREE.MeshStandardMaterial({ color: 0xff0000 })
  );
  s.position.set(xPos, 1, 0);
  s.userData = {
    baseY: 1,
    speed: 1 + Math.random(),
    phase: Math.random() * Math.PI * 2
  };
  return s;
}

// ----------------------------------------------------
// DIFFICULTY
// ----------------------------------------------------
function applyDifficulty(mode) {
  currentDifficulty = mode;

  if (mode === "easy") { pipeSpeed = 1.2; pipeGap = 1.8; obstacleEnabled = false; }
  if (mode === "normal") { pipeSpeed = 2; pipeGap = 1.2; obstacleEnabled = false; }
  if (mode === "hard") { pipeSpeed = 3; pipeGap = 0.9; obstacleEnabled = false; }
  if (mode === "special") { pipeSpeed = 3.5; pipeGap = 1.1; obstacleEnabled = true; }

  spikes.forEach(s => s.visible = obstacleEnabled);

  highScoreText.textContent = `Best (${mode}): ${highScores[mode]}`;
}

// ----------------------------------------------------
// MODE SWITCH
// ----------------------------------------------------
function setVisualMode(full) {
  birdPrimitive.visible = !full;
  birdFull.visible = full;
  activeBird = full ? birdFull : birdPrimitive;

  scene.traverse(obj => {
    if (obj.isMesh && obj.userData.primitiveMat) {
      obj.material = full ? obj.userData.fullMat : obj.userData.primitiveMat;
    }
  });
}

// ----------------------------------------------------
// GAME LOOP
// ----------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  let dt = clock.getDelta();

  if (running) {
    updateBird(dt);
    updatePipes(dt);
    updateSpikes(dt);
    checkCollision();
  }

  renderer.render(scene, camera);
}

function updateBird(dt) {
  velocity += gravity * dt;
  activeBird.position.y += velocity * dt;

  if (activeBird.position.y < 0.2) gameOver();
  if (activeBird.position.y > 5) gameOver();

  activeBird.rotation.z = -velocity * 0.2;
}

function updatePipes(dt) {
  for (let pair of pipes) {
    pair.top.position.x -= pipeSpeed * dt;
    pair.bottom.position.x -= pipeSpeed * dt;

    if (!pair.passed && pair.top.position.x < activeBird.position.x) {
      pair.passed = true;
      score++;
      scoreText.textContent = "Score: " + score;
    }

    if (pair.top.position.x < PIPE_RECYCLE_X) {
      const gapSize = pipeGap * GAP_MULTIPLIER;
      const yCenter = Math.random() * 1.2 + 0.2;

      pair.top.position.set(
        PIPE_RESET_X,
        PIPE_Y_OFFSET + yCenter + gapSize / 2 + PIPE_HEIGHT / 2,
        0
      );

      pair.bottom.position.set(
        PIPE_RESET_X,
        PIPE_Y_OFFSET + yCenter - gapSize / 2 - PIPE_HEIGHT / 2,
        0
      );

      pair.passed = false;
    }
  }
}

function updateSpikes(dt) {
  if (!obstacleEnabled) return;
  let t = clock.elapsedTime;

  for (let s of spikes) {
    s.position.x -= pipeSpeed * dt;
    s.position.y = s.userData.baseY + Math.sin(t * s.userData.speed + s.userData.phase);

    if (s.position.x < PIPE_RECYCLE_X) {
      s.position.x = PIPE_RESET_X + Math.random() * 3;
    }
  }
}

// ----------------------------------------------------
// COLLISION
// ----------------------------------------------------
function checkCollision() {
  let birdBox = new THREE.Box3().setFromObject(activeBird);

  for (let pair of pipes) {
    if (birdBox.intersectsBox(new THREE.Box3().setFromObject(pair.top))) return gameOver();
    if (birdBox.intersectsBox(new THREE.Box3().setFromObject(pair.bottom))) return gameOver();
  }

  if (obstacleEnabled) {
    for (let s of spikes) {
      if (birdBox.intersectsBox(new THREE.Box3().setFromObject(s))) return gameOver();
    }
  }
}

// ----------------------------------------------------
// CONTROLS
// ----------------------------------------------------
function flap() {
  if (!running) return;
  velocity = 4.5;
  messageText.textContent = "";
}

function gameOver() {
  running = false;

  // Update high score for this difficulty
  if (score > highScores[currentDifficulty]) {
    highScores[currentDifficulty] = score;
    localStorage.setItem(`flappyHigh_${currentDifficulty}`, score);
  }

  highScoreText.textContent = `Best (${currentDifficulty}): ${highScores[currentDifficulty]}`;

  messageText.innerHTML = "Game Over<br>Press Restart";
  restartBtn.style.display = "block";
}

function resetGame() {
  score = 0;
  scoreText.textContent = "Score: 0";
  velocity = 0;

  activeBird.position.set(0, 1.5, 0);

  for (let i = 0; i < pipes.length; i++) {
    let x = PIPE_START_X + i * PIPE_SPACING;

    const gapSize = pipeGap * GAP_MULTIPLIER;
    const yCenter = Math.random() * 1.2 + 0.2;

    pipes[i].top.position.set(
      x,
      PIPE_Y_OFFSET + yCenter + gapSize / 2 + PIPE_HEIGHT / 2,
      0
    );

    pipes[i].bottom.position.set(
      x,
      PIPE_Y_OFFSET + yCenter - gapSize / 2 - PIPE_HEIGHT / 2,
      0
    );

    pipes[i].passed = false;
  }

  for (let i = 0; i < spikes.length; i++) {
    spikes[i].position.set(PIPE_START_X + i * 4, spikes[i].userData.baseY, 0);
  }

  spikes.forEach(s => s.visible = obstacleEnabled);
  messageText.textContent = "Tap / Space to start";
}

function showMessage(t) {
  messageText.innerHTML = t;
}

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});