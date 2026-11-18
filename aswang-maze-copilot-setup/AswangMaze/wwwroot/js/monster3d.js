import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";

const canvas = document.querySelector("#monster-canvas");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#020106");
scene.fog = new THREE.FogExp2("#020106", 0.075);

const camera = new THREE.PerspectiveCamera(
  48,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 2.6, 8.5);
camera.lookAt(0, 2.1, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const controls = new OrbitControls(camera, canvas);
controls.enablePan = false;
controls.enableDamping = true;
controls.target.set(0, 2, 0);
controls.minDistance = 4;
controls.maxDistance = 11;
controls.minPolarAngle = Math.PI * 0.28;
controls.maxPolarAngle = Math.PI * 0.62;

scene.add(new THREE.HemisphereLight("#5d5a89", "#08020c", 1.1));

const rimLight = new THREE.PointLight("#b3003f", 15, 10, 2);
rimLight.position.set(-3, 4, 2);
rimLight.castShadow = true;
scene.add(rimLight);

const eyeLight = new THREE.PointLight("#ff163f", 8, 5, 2);
eyeLight.position.set(0, 2.9, 1.25);
scene.add(eyeLight);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(14, 64),
  new THREE.MeshStandardMaterial({
    color: "#08070d",
    roughness: 0.92,
    metalness: 0.05
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.02;
floor.receiveShadow = true;
scene.add(floor);

const monster = new THREE.Group();
monster.position.y = 0;
scene.add(monster);

const skin = new THREE.MeshStandardMaterial({
  color: "#26131f",
  roughness: 0.82,
  metalness: 0.08
});
const darkSkin = new THREE.MeshStandardMaterial({
  color: "#0d080e",
  roughness: 1
});
const wound = new THREE.MeshStandardMaterial({
  color: "#8f102c",
  roughness: 0.62,
  emissive: "#220008",
  emissiveIntensity: 0.4
});
const bone = new THREE.MeshStandardMaterial({
  color: "#d4c4a4",
  roughness: 0.7
});
const eyeMaterial = new THREE.MeshStandardMaterial({
  color: "#ffbac2",
  emissive: "#ff003d",
  emissiveIntensity: 7
});

function mesh(geometry, material, position, scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  monster.add(object);
  return object;
}

const torso = mesh(
  new THREE.CapsuleGeometry(0.82, 1.55, 8, 16),
  skin,
  [0, 2.35, 0],
  [0.92, 1.2, 0.58]
);

const ribCage = mesh(
  new THREE.TorusGeometry(0.62, 0.075, 6, 18, Math.PI),
  wound,
  [0, 2.35, -0.52],
  [1, 1, 0.7]
);
ribCage.rotation.x = Math.PI / 2;
ribCage.rotation.z = Math.PI;

const neck = mesh(
  new THREE.CylinderGeometry(0.26, 0.35, 0.42, 8),
  darkSkin,
  [0, 3.45, 0]
);

const head = mesh(
  new THREE.SphereGeometry(0.8, 16, 12),
  skin,
  [0, 4.12, 0],
  [0.82, 1.06, 0.78]
);

const jaw = mesh(
  new THREE.ConeGeometry(0.5, 0.72, 8),
  darkSkin,
  [0, 3.72, -0.64],
  [1, 0.82, 0.8]
);
jaw.rotation.x = Math.PI / 2;

const mouth = mesh(
  new THREE.TorusGeometry(0.27, 0.07, 6, 16, Math.PI * 1.55),
  wound,
  [0, 3.78, -0.91],
  [1, 0.7, 1]
);
mouth.rotation.x = Math.PI / 2;
mouth.rotation.z = Math.PI * 0.25;

function addEye(x) {
  const eye = mesh(
    new THREE.SphereGeometry(0.105, 12, 8),
    eyeMaterial,
    [x, 4.22, -0.72],
    [1, 1, 0.42]
  );
  eye.userData.baseX = x;
  return eye;
}

const leftEye = addEye(-0.27);
const rightEye = addEye(0.27);

function addHorn(x, rotationZ) {
  const horn = mesh(
    new THREE.ConeGeometry(0.2, 1.0, 8),
    bone,
    [x, 4.82, 0],
    [1, 1.25, 1]
  );
  horn.rotation.z = rotationZ;
  horn.rotation.x = -0.16;
}

addHorn(-0.43, -0.5);
addHorn(0.43, 0.5);

function addArm(x, rotationZ) {
  const shoulder = mesh(
    new THREE.CapsuleGeometry(0.25, 1.3, 6, 10),
    skin,
    [x, 2.75, 0],
    [1, 1, 0.8]
  );
  shoulder.rotation.z = rotationZ;

  const hand = mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    darkSkin,
    [x * 1.23, 1.72, -0.02],
    [0.8, 1.2, 0.7]
  );

  for (let index = 0; index < 3; index++) {
    const claw = mesh(
      new THREE.ConeGeometry(0.06, 0.48, 6),
      bone,
      [x * 1.23 + (index - 1) * 0.12, 1.25, -0.1],
      [1, 1, 1]
    );
    claw.rotation.x = -0.22;
  }

  return { shoulder, hand };
}

const leftArm = addArm(-1.0, -0.4);
const rightArm = addArm(1.0, 0.4);

function addLeg(x) {
  const leg = mesh(
    new THREE.CapsuleGeometry(0.28, 1.45, 6, 10),
    darkSkin,
    [x, 0.9, 0],
    [1, 1, 0.86]
  );
  leg.rotation.z = x < 0 ? -0.08 : 0.08;
  return leg;
}

addLeg(-0.38);
addLeg(0.38);

function addTentacle(angle, length) {
  const points = [];
  for (let index = 0; index <= 8; index++) {
    const progress = index / 8;
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * progress * length + Math.sin(progress * 7) * 0.08,
        0.3 - progress * 0.5 + Math.cos(progress * 6) * 0.08,
        Math.sin(angle) * progress * length
      )
    );
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const tentacle = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 18, 0.11, 6, false),
    darkSkin
  );
  tentacle.castShadow = true;
  monster.add(tentacle);
}

addTentacle(-2.8, 1.6);
addTentacle(-2.1, 1.8);
addTentacle(-1.1, 1.55);
addTentacle(-0.35, 1.7);

const clock = new THREE.Clock();
function animate() {
  const elapsed = clock.getElapsedTime();
  const breathing = Math.sin(elapsed * 2.4) * 0.025;
  monster.scale.y = 1 + breathing;
  monster.position.y = Math.sin(elapsed * 1.2) * 0.045;
  monster.rotation.y = Math.sin(elapsed * 0.7) * 0.05;
  leftArm.shoulder.rotation.x = Math.sin(elapsed * 1.8) * 0.08;
  rightArm.shoulder.rotation.x = -Math.sin(elapsed * 1.8) * 0.08;
  jaw.rotation.z = Math.sin(elapsed * 2.1) * 0.035;
  eyeLight.intensity = 7 + Math.sin(elapsed * 8) * 2;

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
