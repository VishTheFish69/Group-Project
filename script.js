import * as THREE from "./libs/three.module.js";
import { GLTFLoader } from "./libs/GLTFLoader.js";

let scene, camera, renderer, clock;
let birdPrimitive, birdFull, activeBird;
let birdCollider;
let pipes = [];
let spikes = [];
let spikePrototypeMaterial;
let spikeBirdMaterial;
let scarecrowModel;
let cloudModel;
let groundTextureProcedural;
let groundTextureFull;
let groundTextureActive;
let groundMesh;
let groundScroll = 0;
let birdShadow;
let gravity = -9.8;
let velocity = 0;
let pipeSpeed = 2;
let pipeGap = 1;
let clouds = [];
let obstacleEnabled = false;
let running = false;
let score = 0;
let birdMixer;
let birdAnchor;
let birdTrail = [];
const MAX_TRAIL = 18;

const NUM_PIPES = 6;
const PIPE_SPACING = 3;
const PIPE_START_X = 6;
const PIPE_RECYCLE_X = -5;
const PIPE_RESET_X = 12;
const PIPE_HEIGHT = 2.2;
const CLOUD_RECYCLE_X = -8;
const CLOUD_RESET_X = 12;
const GROUND_SIZE = 40;
const GROUND_REPEAT = 12;
const GAP_MULTIPLIER = 2.2;
const PIPE_Y_OFFSET = 1.2;
const PIPE_ROTATION_SPEED = 1.2;
const textureLoader = new THREE.TextureLoader();
const pipeTexture = textureLoader.load("./textures/greenpipe.png");
pipeTexture.wrapS = THREE.RepeatWrapping;
pipeTexture.wrapT = THREE.RepeatWrapping;

pipeTexture.repeat.set(2, 1);

pipeTexture.colorSpace = THREE.SRGBColorSpace;


const scoreText = document.getElementById("score");
const messageText = document.getElementById("message");
const difficultySelect = document.getElementById("difficulty");
const modeSwitch = document.getElementById("modeSwitch");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const highScoreText = document.getElementById("highScore");

let highScores = {
  easy: Number(localStorage.getItem("flappyHigh_easy")) || 0,
  normal: Number(localStorage.getItem("flappyHigh_normal")) || 0,
  hard: Number(localStorage.getItem("flappyHigh_hard")) || 0,
  special: Number(localStorage.getItem("flappyHigh_special")) || 0
};

let currentDifficulty = "normal";
highScoreText.textContent = `Best (${currentDifficulty}): ${highScores[currentDifficulty]}`;

init();
animate();

function spawnBirdTrail() {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: 0xffffaa,
      transparent: true,
      opacity: 0.6
    })
  );

  sprite.position.set(
    birdAnchor.position.x - 0.2,
    birdAnchor.position.y,
    birdAnchor.position.z
  );

  sprite.scale.set(0.22, 0.22, 0.22);

  sprite.userData.velocity = new THREE.Vector3(
    -0.6,
    -0.02 + Math.random() * 0.04,
    0
  );

  scene.add(sprite);
  birdTrail.push(sprite);

  if (birdTrail.length > MAX_TRAIL) {
    scene.remove(birdTrail.shift());
  }
}

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

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
  let dir = new THREE.DirectionalLight(0xffffff, 1);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  groundTextureProcedural = createGroundTexture();
  groundTextureProcedural.wrapS = THREE.RepeatWrapping;
  groundTextureProcedural.wrapT = THREE.RepeatWrapping;
  groundTextureProcedural.repeat.set(GROUND_REPEAT, GROUND_REPEAT);
  groundTextureProcedural.anisotropy = renderer.capabilities.getMaxAnisotropy();
  groundTextureActive = groundTextureProcedural;
  groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    new THREE.MeshStandardMaterial({
      map: groundTextureActive,
      roughness: 0.9,
      metalness: 0.0
    })
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0;
  scene.add(groundMesh);
  loadGroundTextureFull();

  birdShadow = createBirdShadow();
  scene.add(birdShadow);

  loadCloudModel();

  let startX = -2;
  for (let i = 0; i < 14; i++) {
    const jitter = Math.random() * 0.5;
    clouds.push(createCloudCluster(startX + i * 1.5 + jitter));
  }

  birdAnchor = new THREE.Object3D();
  scene.add(birdAnchor);

  birdPrimitive = createPrimitiveBird();
  birdAnchor.add(birdPrimitive);

  birdFull = createFullBird();
  birdAnchor.add(birdFull);
  birdFull.visible = false;

  activeBird = birdPrimitive;

  birdCollider = new THREE.Mesh(
    new THREE.SphereGeometry(0.25),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  scene.add(birdCollider);

  spikePrototypeMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  loadBirdSpikeMaterial();

  for (let i = 0; i < NUM_PIPES; i++) {
    pipes.push(createPipePair(PIPE_START_X + i * PIPE_SPACING));
  }

  for (let i = 0; i < 4; i++) {
    let s = createSpike(PIPE_START_X + i * 4);
    spikes.push(s);
    scene.add(s);
  }
  applySpikeMaterial(modeSwitch.checked);

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

function startGame() {
  resetGame();
  running = true;
  startBtn.style.display = "none";
  restartBtn.style.display = "none";
  messageText.textContent = "";
}

function createPrimitiveBird() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffff00 })
  );
}

function createFullBird() {
  const group = new THREE.Group();

  const loader = new GLTFLoader();
  loader.load(
    "https://threejs.org/examples/models/gltf/Flamingo.glb",
    gltf => {
      const bird = gltf.scene;

      bird.scale.set(0.01, 0.01, 0.01);
      bird.rotation.y = Math.PI / 2;
      bird.position.y = -0.15;

      group.add(bird);

      birdMixer = new THREE.AnimationMixer(bird);
      birdMixer.clipAction(gltf.animations[0]).play();
    }
  );

  return group;
}

function createPipePair(xPos) {
  const gapSize = pipeGap * GAP_MULTIPLIER;
  const yCenter = Math.random() * 1.2 + 0.2;

  const geom = new THREE.CylinderGeometry(0.4, 0.4, PIPE_HEIGHT, 16);
  const mat = new THREE.MeshStandardMaterial({
  map: pipeTexture,
  roughness: 0.5,
  metalness: 0.05
});

  const top = new THREE.Mesh(geom, mat);
  const bottom = new THREE.Mesh(geom, mat);

  top.position.set(
    xPos,
    PIPE_Y_OFFSET + yCenter + gapSize / 2 + PIPE_HEIGHT / 2,
    0
  );

  bottom.position.set(
    xPos,
    PIPE_Y_OFFSET + yCenter - gapSize / 2 - PIPE_HEIGHT / 2,
    0
  );

  scene.add(top);
  scene.add(bottom);

  return { top, bottom, passed: false };
}

function createCloudCluster(xPos) {
  const group = new THREE.Group();
  group.position.set(
    xPos,
    2 + Math.random() * 2.2,
    -1.5
  );
  group.userData.speedMultiplier = 0.5 + Math.random() * 0.35;
  setCloudVisual(group, modeSwitch.checked && cloudModel);
  scene.add(group);
  return group;
}

function setCloudVisual(group, fullMode) {
  group.clear();

  if (fullMode && cloudModel) {
    const mesh = cloudModel.clone(true);
    mesh.scale.set(0.003, 0.003, 0.003);
    mesh.position.set(0, 0, 0);
    group.add(mesh);
    group.userData.fullVisual = true;
    return;
  }

  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7
  });

  for (let i = 0; i < 3; i++) {
    const radius = 0.35 + Math.random() * 0.35;
    const circle = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), material);
    circle.position.set(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.25,
      0
    );
    group.add(circle);
  }
  group.userData.fullVisual = false;
}

function applyCloudVisualMode(fullMode) {
  clouds.forEach(c => setCloudVisual(c, fullMode && cloudModel));
}

function loadCloudModel() {
  const loader = new GLTFLoader();
  loader.load(
    "./objs/cloud.glb",
    gltf => {
      const group = new THREE.Group();
      gltf.scene.traverse(child => {
        if (child.isMesh) {
          const mesh = child.clone();
          mesh.geometry = mesh.geometry.clone();
          mesh.material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.82,
            depthWrite: false,
            side: THREE.DoubleSide
          });
          group.add(mesh);
        }
      });
      cloudModel = group;
      if (modeSwitch.checked) applyCloudVisualMode(true);
    },
    undefined,
    err => {
      console.error("[Cloud] Failed to load GLB", err);
      alert(`Cloud model failed to load: ${err.message || err}`);
    }
  );
}

function createGroundTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#2c9c3a";
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 32) {
    ctx.fillStyle = y % 64 === 0 ? "#2da341" : "#278e36";
    ctx.fillRect(0, y, size, 32);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  for (let y = 0; y < size; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.arc(size / 2, size / 2, 26, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const alpha = 0.05 + Math.random() * 0.08;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function loadGroundTextureFull() {
  textureLoader.load(
    "./objs/tiling-grass-texture.webp",
    tex => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(GROUND_REPEAT, GROUND_REPEAT);
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.colorSpace = THREE.SRGBColorSpace;
      groundTextureFull = tex;
      if (modeSwitch.checked) applyGroundVisualMode(true);
    },
    undefined,
    err => console.error("[Ground] Failed to load full ground texture", err)
  );
}

function applyGroundVisualMode(fullMode) {
  const target =
    fullMode && groundTextureFull ? groundTextureFull : groundTextureProcedural;
  if (!target || !groundMesh) return;
  groundTextureActive = target;
  groundMesh.material.map = target;
  groundMesh.material.needsUpdate = true;
  groundTextureActive.offset.set(groundScroll, 0);
  groundTextureActive.repeat.set(GROUND_REPEAT, GROUND_REPEAT);
}

function createBirdShadow() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grd = ctx.createRadialGradient(
    size / 2,
    size / 2,
    10,
    size / 2,
    size / 2,
    size / 2
  );
  grd.addColorStop(0, "rgba(0,0,0,0.35)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01;
  mesh.renderOrder = 2;
  return mesh;
}

function createSpike(xPos) {
  const material =
    modeSwitch.checked && spikeBirdMaterial
      ? spikeBirdMaterial
      : spikePrototypeMaterial;
  let s = new THREE.Mesh(
    new THREE.ConeGeometry(0.25, 0.8, 12),
    material
  );
  s.position.set(xPos, 1, 0);
  s.userData = {
    baseY: 1,
    speed: 1 + Math.random(),
    phase: Math.random() * Math.PI * 2,
    visual: null
  };
  return s;
}

function loadBirdSpikeMaterial() {
  const loader = new GLTFLoader();
  loader.load(
    "./objs/Scarecrow.glb",
    gltf => {
      scarecrowModel = gltf.scene;
      spikeBirdMaterial = new THREE.MeshStandardMaterial({
        transparent: true,
        opacity: 0
      });

      applySpikeMaterial(modeSwitch.checked);
    },
    undefined,
    err => {
      spikeBirdMaterial = createFallbackBirdMaterial();
      console.error(
        "[Spikes] Failed to load Scarecrow GLB; using fallback material",
        err
      );
      applySpikeMaterial(modeSwitch.checked);
    }
  );
}

function createFallbackBirdMaterial() {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.6, 0.6, 0.6),
    roughness: 0.5,
    metalness: 0.1
  });
}

function applySpikeMaterial(fullMode) {
  const mat =
    fullMode && spikeBirdMaterial ? spikeBirdMaterial : spikePrototypeMaterial;
  spikes.forEach(s => {
    s.material = mat;
    if (fullMode) {
      s.material.transparent = true;
      s.material.opacity = 0;
      ensureSpikeVisual(s);
      if (s.userData.visual) s.userData.visual.visible = true;
    } else {
      s.material.transparent = false;
      s.material.opacity = 1;
      if (s.userData.visual) s.userData.visual.visible = false;
    }
  });
}

function ensureSpikeVisual(spike) {
  if (!scarecrowModel) return;
  if (spike.userData.visual) return;

  const visual = scarecrowModel.clone(true);
  visual.scale.set(0.35, 0.35, 0.35);
  visual.position.set(0, -0.15, 0);
  visual.rotation.y = -Math.PI * 0.25;
  spike.add(visual);
  spike.userData.visual = visual;
}

function applyDifficulty(mode) {
  currentDifficulty = mode;

  if (mode === "easy") { pipeSpeed = 1.2; pipeGap = 1.8; obstacleEnabled = false; }
  if (mode === "normal") { pipeSpeed = 2; pipeGap = 1.2; obstacleEnabled = false; }
  if (mode === "hard") { pipeSpeed = 3; pipeGap = 0.9; obstacleEnabled = false; }
  if (mode === "special") { pipeSpeed = 3.5; pipeGap = 1.1; obstacleEnabled = true; }

  spikes.forEach(s => s.visible = obstacleEnabled);
  applySpikeMaterial(modeSwitch.checked);
  highScoreText.textContent = `Best (${mode}): ${highScores[mode]}`;
}

function setVisualMode(full) {
  birdPrimitive.visible = !full;
  birdFull.visible = full;
  activeBird = full ? birdFull : birdPrimitive;
  applySpikeMaterial(full);
  applyCloudVisualMode(full);
  applyGroundVisualMode(full);
}

function animate() {
  requestAnimationFrame(animate);
  let dt = clock.getDelta();
  if (birdMixer) birdMixer.update(dt);
  if (running) {
    updateBird(dt);
    spawnBirdTrail();
    updateClouds(dt);
    updateGround(dt);

    for (let i = birdTrail.length - 1; i >= 0; i--) {
      const p = birdTrail[i];

      p.position.addScaledVector(p.userData.velocity, dt);

      p.material.opacity *= 0.92;

      if (p.material.opacity < 0.05) {
        scene.remove(p);
        birdTrail.splice(i, 1);
      }
    }
    updatePipes(dt);
    updateSpikes(dt);
    checkCollision();
  }

  renderer.render(scene, camera);
}

function updateBird(dt) {
  velocity += gravity * dt;
  birdAnchor.position.y += velocity * dt;
  birdCollider.position.copy(birdAnchor.position);
  birdAnchor.rotation.z = -velocity * 0.2;
  if (birdAnchor.position.y < 0.2) gameOver();
  if (birdAnchor.position.y > 5) gameOver();

  activeBird.rotation.z = -velocity * 0.2;

  if (birdShadow) {
    birdShadow.position.set(birdAnchor.position.x, 0.01, birdAnchor.position.z);
    birdShadow.visible = true;
  }
}

function updatePipes(dt) {
  for (let pair of pipes) {
    pair.top.position.x -= pipeSpeed * dt;
    pair.bottom.position.x -= pipeSpeed * dt;
    
    if (activeBird === birdFull) {
      pair.top.rotation.y += 0.5 * dt;
      pair.bottom.rotation.y += 0.5 * dt;
    } else {
      pair.top.rotation.set(0, 0, 0);
      pair.bottom.rotation.set(0, 0, 0);
    }

    pair.top.rotation.y += PIPE_ROTATION_SPEED * dt;
    pair.bottom.rotation.y += PIPE_ROTATION_SPEED * dt;

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

function updateClouds(dt) {
  let furthestX = -Infinity;

  for (let cloud of clouds) {
    cloud.position.x -= pipeSpeed * cloud.userData.speedMultiplier * dt;
    furthestX = Math.max(furthestX, cloud.position.x);
  }

  for (let cloud of clouds) {
    if (cloud.position.x < CLOUD_RECYCLE_X) {
      const spacing = 1.2 + Math.random() * 1.8;
      cloud.position.x = furthestX + spacing;
      cloud.position.y = 2 + Math.random() * 2.2;
      cloud.userData.speedMultiplier = 0.5 + Math.random() * 0.35;
      furthestX = cloud.position.x;
    }
  }
}

function updateGround(dt) {
  if (!groundTextureActive) return;
  const scroll = pipeSpeed * dt * (GROUND_REPEAT / GROUND_SIZE);
  groundScroll += scroll;
  groundTextureActive.offset.x = groundScroll;
}

function checkCollision() {
  let birdBox = new THREE.Box3().setFromObject(birdCollider);

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

function flap() {
  if (!running) return;
  velocity = 4.5;
}

function gameOver() {
  running = false;

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

  birdAnchor.position.set(0, 2.5, 0);
  birdCollider.position.copy(activeBird.position);

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
  let startX = -2;
  for (let i = 0; i < clouds.length; i++) {
    const jitter = Math.random() * 0.5;
    clouds[i].position.set(
      startX + i * 1.5 + jitter,
      2 + Math.random() * 2.2,
      -1.5
    );
    clouds[i].userData.speedMultiplier = 0.5 + Math.random() * 0.35;
  }
  groundScroll = 0;
  if (groundTextureActive) groundTextureActive.offset.set(0, 0);
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
