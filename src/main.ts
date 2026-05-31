// ╔══════════════════════════════════════════════════╗
// ║  🦋 洛伦兹吸引子 — Lorenz Attractor 3D          ║
// ║  Three.js · RK4积分 · 多轨迹 · 蝴蝶效应 · 混沌    ║
// ╚══════════════════════════════════════════════════╝

import * as THREE from 'three';

// ========== 洛伦兹系统参数 ==========
const sigma = 10;
const rho = 28;
const beta = 8 / 3;
const dt = 0.004;       // 积分步长
const TRAIL_LEN = 2500; // 每条轨迹点数
const TRAJECTORIES = 12; // 轨迹数量
const SCALE = 0.35;     // 缩放系数

// ========== 场景 ==========
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020212);
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 200);
camera.position.set(0, 5, 35);
camera.lookAt(0, 0, 12);

// 浅色参考平面
const planeG = new THREE.PlaneGeometry(60, 60);
const planeM = new THREE.MeshBasicMaterial({ color: 0x0a0a20, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
const plane = new THREE.Mesh(planeG, planeM);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -15;
scene.add(plane);

// ========== 轨迹系统 ==========
interface Trail {
  x: number; y: number; z: number;
  points: Float32Array;
  colors: Float32Array;
  idx: number;
  geom: THREE.BufferGeometry;
  line: THREE.Line;
  head: THREE.Mesh; // 头部光点
}

const trails: Trail[] = [];
const color = new THREE.Color();

for (let t = 0; t < TRAJECTORIES; t++) {
  // 初始条件微扰: 经典起点(1,1,1)附近
  const x = 1 + (Math.random() - 0.5) * 0.1;
  const y = 1 + (Math.random() - 0.5) * 0.1;
  const z = 1 + (Math.random() - 0.5) * 0.1;

  const points = new Float32Array(TRAIL_LEN * 3);
  const colors = new Float32Array(TRAIL_LEN * 3);
  // 初始化为起始点
  for (let i = 0; i < TRAIL_LEN; i++) {
    points[i * 3] = x * SCALE;
    points[i * 3 + 1] = y * SCALE;
    points[i * 3 + 2] = z * SCALE;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(points, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 1, transparent: true, opacity: 0.8 });
  const line = new THREE.Line(geom, mat);
  scene.add(line);

  // 头部光点
  const headG = new THREE.SphereGeometry(0.08, 8, 8);
  const headM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const head = new THREE.Mesh(headG, headM);
  scene.add(head);

  trails.push({ x, y, z, points, colors, idx: TRAIL_LEN - 1, geom, line, head });
}

// ========== RK4单步 ==========
function lorenz(x: number, y: number, z: number): [number, number, number] {
  return [sigma * (y - x), x * (rho - z) - y, x * y - beta * z];
}

function rk4step(trail: Trail) {
  const h = dt;
  const [k1x, k1y, k1z] = lorenz(trail.x, trail.y, trail.z);
  const [k2x, k2y, k2z] = lorenz(trail.x + h / 2 * k1x, trail.y + h / 2 * k1y, trail.z + h / 2 * k1z);
  const [k3x, k3y, k3z] = lorenz(trail.x + h / 2 * k2x, trail.y + h / 2 * k2y, trail.z + h / 2 * k2z);
  const [k4x, k4y, k4z] = lorenz(trail.x + h * k3x, trail.y + h * k3y, trail.z + h * k3z);
  trail.x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
  trail.y += (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
  trail.z += (h / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);
}

// ========== 交互 ==========
let dragging = false, pmx = 0, pmy = 0;
let rotY = 0, rotX = 0.5, zoom = 35, autoR = true;
let tgtY = rotY, tgtX = rotX, tgtZ = zoom;

renderer.domElement.addEventListener('mousedown', e => { dragging = true; pmx = e.clientX; pmy = e.clientY; });
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  tgtY += (e.clientX - pmx) * 0.005;
  tgtX += (e.clientY - pmy) * 0.005;
  tgtX = Math.max(-1.5, Math.min(1.5, tgtX));
  autoR = false; pmx = e.clientX; pmy = e.clientY;
});
renderer.domElement.addEventListener('wheel', e => {
  tgtZ += e.deltaY * 0.03; tgtZ = Math.max(8, Math.min(80, tgtZ));
  e.preventDefault();
}, { passive: false });
window.addEventListener('keydown', e => { if (e.key === ' ') { autoR = !autoR; e.preventDefault(); } });

// ========== 主循环 ==========
const clock = new THREE.Clock();
let stepAccum = 0;

function loop() {
  const frameDt = Math.min(clock.getDelta(), 0.1);

  // 每帧计算多步RK4
  stepAccum += frameDt;
  let stepsThisFrame = 0;
  while (stepAccum >= dt && stepsThisFrame < 80) {
    stepAccum -= dt;
    for (const t of trails) {
      rk4step(t);

      // 循环缓冲区
      t.idx = (t.idx + 1) % TRAIL_LEN;
      t.points[t.idx * 3] = t.x * SCALE;
      t.points[t.idx * 3 + 1] = t.y * SCALE;
      t.points[t.idx * 3 + 2] = t.z * SCALE;
    }
    stepsThisFrame++;
  }

  // 更新颜色和头部位置
  const hueBase = performance.now() * 0.00003; // 颜色随时间流动
  for (let ti = 0; ti < trails.length; ti++) {
    const t = trails[ti];
    const hue = (hueBase + ti / trails.length) % 1;

    // 更新所有点颜色(渐变)
    for (let i = 0; i < TRAIL_LEN; i++) {
      const age = ((t.idx - i + TRAIL_LEN) % TRAIL_LEN) / TRAIL_LEN;
      color.setHSL((hue + age * 0.2) % 1, 1, 0.3 + age * 0.5);
      t.colors[i * 3] = color.r;
      t.colors[i * 3 + 1] = color.g;
      t.colors[i * 3 + 2] = color.b;
    }

    t.geom.attributes.position.needsUpdate = true;
    t.geom.attributes.color.needsUpdate = true;

    // 头部光点
    t.head.position.set(t.x * SCALE, t.y * SCALE, t.z * SCALE);
    color.setHSL(hue, 0.5, 0.9);
    (t.head.material as THREE.MeshBasicMaterial).color.copy(color);
  }

  // 相机
  if (autoR) tgtY += frameDt * 0.2;
  rotY += (tgtY - rotY) * 4 * frameDt;
  rotX += (tgtX - rotX) * 4 * frameDt;
  zoom += (tgtZ - zoom) * 4 * frameDt;
  camera.position.set(
    Math.cos(rotY) * Math.cos(rotX) * zoom,
    Math.sin(rotX) * zoom,
    Math.sin(rotY) * Math.cos(rotX) * zoom
  );
  camera.lookAt(0, 0, 12);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(loop);
console.log('🦋 洛伦兹吸引子 — σ=10 ρ=28 β=8/3 — 12条轨迹');
