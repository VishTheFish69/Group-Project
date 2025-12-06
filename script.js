import * as THREE from "/libs/three.module.js";
import { GLTFLoader } from "/libs/GLTFLoader.js";

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
let pipeGap = 1.2;
let obstacleEnabled = false;
let running = true;
let score = 0;

const NUM_PIPES = 6;
const PIPE_SPACING = 3;
const PIPE_START_X = 6;
const PIPE_RECYCLE_X = -5;
const PIPE_RESET_X = 12;

// UI references
const scoreText = document.getElementById("score");
const messageText = document.getElementById("message");
const difficultySelect = document.getElementById("difficulty");
const modeSwitch = document.getElementById("modeSwitch");

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

  // Spikes (special mode only)
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
    if (e.code === "Space") flap();
    if (e.code === "KeyR") resetGame();
  });
  window.addEventListener("pointerdown", flap);

  showMessage("Tap / Space to start");
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
  const yCenter = Math.random() * 2 - 0.3;

  let geom = new THREE.CylinderGeometry(0.4, 0.4, 5, 16);

  let matPrimitive = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  let matFull = matPrimitive.clone();

  let top = new THREE.Mesh(geom, matPrimitive);
  top.position.set(xPos, yCenter + pipeGap, 0);
  scene.add(top);

  let bottom = new THREE.Mesh(geom, matPrimitive);
  bottom.position.set(xPos, yCenter - pipeGap - 5, 0);
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
  if (mode === "easy") { pipeSpeed = 1.2; pipeGap = 1.8; obstacleEnabled = false; }
  if (mode === "normal") { pipeSpeed = 2; pipeGap = 1.2; obstacleEnabled = false; }
  if (mode === "hard") { pipeSpeed = 3; pipeGap = 0.9; obstacleEnabled = false; }
  if (mode === "special") { pipeSpeed = 3.5; pipeGap = 1.1; obstacleEnabled = true; }
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
      let newY = Math.random() * 2 - 0.3;
      let x = PIPE_RESET_X;
      pair.top.position.set(x, newY + pipeGap, 0);
      pair.bottom.position.set(x, newY - pipeGap - 5, 0);
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
  messageText.innerHTML = "Game Over<br>Press R to Restart";
}

function resetGame() {
  running = true;
  score = 0;
  scoreText.textContent = "Score: 0";
  velocity = 0;
  activeBird.position.set(0, 1.5, 0);
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