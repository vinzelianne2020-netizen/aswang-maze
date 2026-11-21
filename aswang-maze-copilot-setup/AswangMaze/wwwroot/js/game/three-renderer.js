import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DEFAULT_SETTINGS } from "./settings.js";

export class ThreeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#030306");
    this.scene.fog = new THREE.FogExp2("#030306", 0.075);

    this.camera = new THREE.PerspectiveCamera(
      78,
      window.innerWidth / window.innerHeight,
      0.05,
      100
    );
    this.camera.position.set(1.5, 1.6, 1.5);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.physicallyCorrectLights = true;
    this.applySettings(DEFAULT_SETTINGS);

    this.scene.add(new THREE.AmbientLight("#8a8299", 0.12));
    const fillLight = new THREE.HemisphereLight("#9eb6d9", "#160d12", 0.3);
    this.scene.add(fillLight);

    this.flashlight = new THREE.SpotLight(
      "#dbe3ff",
      70,
      18,
      Math.PI / 3.25,
      0.72,
      1.25
    );
    this.flashlight.visible = false;
    this.flashlight.position.set(0, 0, 0);
    this.flashlight.target.position.set(0, 0, -1);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.camera.near = 0.1;
    this.flashlight.shadow.camera.far = 12;
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);
    this.scene.add(this.camera);
    this.viewModel = new THREE.Group();
    this.viewModel.position.set(0.42, -0.42, -0.78);
    this.camera.add(this.viewModel);
    this.viewModelItem = null;
    this.viewModelItemType = null;
    this.weaponParts = null;
    this.viewModelRecoil = 0;
    this.cameraKick = 0;
    this.muzzleFlashTimer = 0;
    this.effectParticles = [];
    this.shellCasings = [];
    this.effectParticleGeometry = new THREE.SphereGeometry(0.025, 6, 5);
    this.shellGeometry = new THREE.CylinderGeometry(0.018, 0.018, 0.085, 8);
    this.shellMaterial = new THREE.MeshStandardMaterial({
      color: "#b78338",
      roughness: 0.34,
      metalness: 0.82
    });
    this.muzzleFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 8, 6),
      new THREE.MeshBasicMaterial({ color: "#ffb14d", transparent: true, opacity: 0.95 })
    );
    this.muzzleFlash.position.set(0.42, -0.3, -1.38);
    this.muzzleFlash.scale.set(0.8, 0.8, 2.8);
    this.muzzleFlash.visible = false;
    this.camera.add(this.muzzleFlash);
    this.muzzleLight = new THREE.PointLight("#ff9d47", 0, 5, 2);
    this.muzzleLight.position.copy(this.muzzleFlash.position);
    this.camera.add(this.muzzleLight);
    this.movementPhase = 0;
    this.movementBlend = 0;
    this.cameraBaseY = 1.6;
    this.viewModelLight = new THREE.PointLight("#ffc48a", 0, 2.5, 2);
    this.viewModelLight.position.set(0, 0.04, -0.65);
    this.camera.add(this.viewModelLight);
    const viewModelFill = new THREE.PointLight("#c6d5f2", 1.1, 2.5, 2);
    viewModelFill.position.set(0.35, -0.15, -0.35);
    this.camera.add(viewModelFill);
    this.createFirstPersonHand();

    this.enemyMeshes = new Map();
    this.enemyModels = new Map();
    this.enemyMixers = new Map();
    this.enemyActions = new Map();
    this.enemyModelTemplate = null;
    this.enemyModelLoading = null;
    this.loadEnemyModel();
    this.keyMeshes = new Map();
    this.pickupMeshes = new Map();
    this.elapsed = 0;

    window.addEventListener("resize", () => this.resize());
  }

  buildMaze(level, props = []) {
    if (this.mazeGroup) this.scene.remove(this.mazeGroup);
    this.mazeLights = [];
    const fogDistance = level.fogDistance || 8;
    this.scene.fog.density = 0.075 * Math.pow(8 / fogDistance, 2);
    this.mazeGroup = new THREE.Group();
    this.scene.add(this.mazeGroup);

    const wallGeometry = new THREE.BoxGeometry(1, 3, 1);
    const wallTexture = this.createWallTexture();
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: "#77727b",
      map: wallTexture,
      bumpMap: wallTexture,
      bumpScale: 0.055,
      roughness: 0.98,
      metalness: 0.02
    });
    const bloodMaterials = this.createBloodMaterials();

    const wallCount = level.map.reduce(
      (count, row) => count +
        row.reduce((rowCount, tile) => rowCount + (tile === 1 ? 1 : 0), 0),
      0
    );
    const walls = new THREE.InstancedMesh(
      wallGeometry,
      wallMaterial,
      wallCount
    );
    walls.castShadow = true;
    walls.receiveShadow = true;

    const matrix = new THREE.Matrix4();
    let wallIndex = 0;
    const wallCells = [];
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (level.map[y][x] !== 1) continue;
        matrix.makeTranslation(x + 0.5, 1.5, y + 0.5);
        walls.setMatrixAt(wallIndex++, matrix);
        wallCells.push({ x, y });
      }
    }
    walls.instanceMatrix.needsUpdate = true;
    this.mazeGroup.add(walls);
    walls.userData.surfaceType = "plaster";
    this.addBloodDecals(level, wallCells, bloodMaterials);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(level.width, level.height),
      new THREE.MeshStandardMaterial({
        color: "#111119",
        roughness: 1
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(level.width / 2, 0, level.height / 2);
    floor.receiveShadow = true;
    floor.userData.surfaceType = "stone";
    this.mazeGroup.add(floor);

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(level.width, level.height),
      new THREE.MeshStandardMaterial({
        color: "#09090e",
        roughness: 1,
        side: THREE.DoubleSide
      })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(level.width / 2, 3, level.height / 2);
    ceiling.receiveShadow = true;
    this.mazeGroup.add(ceiling);

    this.addEnvironmentalProps(props);
    this.addDeadBodies(level, props);
    this.createExitDoor(level);
    this.addMazeLights(level);
    this.createFlickerLight();
  }

  addEnvironmentalProps(props) {
    const materials = {
      metal: new THREE.MeshStandardMaterial({ color: "#343239", roughness: 0.78, metalness: 0.48 }),
      rustyMetal: new THREE.MeshStandardMaterial({ color: "#493834", roughness: 0.88, metalness: 0.25 }),
      wood: new THREE.MeshStandardMaterial({ color: "#49372e", roughness: 0.92 }),
      trim: new THREE.MeshStandardMaterial({ color: "#211f23", roughness: 0.86, metalness: 0.2 }),
      bag: new THREE.MeshStandardMaterial({ color: "#111619", roughness: 0.94 }),
      pot: new THREE.MeshStandardMaterial({ color: "#684537", roughness: 0.92 }),
      potRim: new THREE.MeshStandardMaterial({ color: "#9b6849", roughness: 0.86 }),
      crate: new THREE.MeshStandardMaterial({ color: "#614a31", roughness: 0.95 })
    };
    const addBox = (parent, geometry, material, position) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.surfaceType = material.metalness > 0.4 ? "metal" : "wood";
      parent.add(mesh);
      return mesh;
    };
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const propsGroup = new THREE.Group();
    this.mazeGroup.add(propsGroup);

    for (const prop of props) {
      const group = new THREE.Group();
      group.position.set(prop.x, 0, prop.y);
      group.rotation.y = prop.rotation;
      propsGroup.add(group);
      prop.mesh = group;

      if (prop.type === "locker" || prop.type === "cabinet") {
        const locker = prop.type === "locker";
        const width = locker ? 0.72 : 0.78;
        const height = locker ? 2.05 : 1.45;
        const depth = locker ? 0.55 : 0.62;
        const bodyMaterial = locker ? materials.metal : materials.wood;
        addBox(group, boxGeometry, bodyMaterial, [0, height / 2, 0])
          .scale.set(width, height, depth);
        addBox(group, boxGeometry, materials.trim, [0, height / 2, depth / 2 + 0.018])
          .scale.set(width * 0.96, height * 0.96, 0.04);
        addBox(group, boxGeometry, locker ? materials.metal : materials.rustyMetal,
          [0, height / 2, depth / 2 + 0.034])
          .scale.set(width * 0.92, height * 0.92, 0.025);
        const doorMaterial = locker ? materials.metal : materials.wood;
        for (const side of [-1, 1]) {
          const door = addBox(
            group,
            boxGeometry,
            doorMaterial,
            [side * width * 0.235, height / 2, depth / 2 + 0.055]
          );
          door.scale.set(width * 0.46, height * 0.94, 0.035);
          const handle = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 8, 8),
            materials.rustyMetal
          );
          handle.position.set(side * width * 0.08, height * 0.51, depth / 2 + 0.09);
          group.add(handle);
        }
        if (locker) {
          for (let vent = 0; vent < 5; vent++) {
            addBox(group, boxGeometry, materials.trim,
              [-0.12, height * 0.78 + vent * 0.055, depth / 2 + 0.078])
              .scale.set(0.24, 0.018, 0.012);
          }
        }
      } else if (prop.type === "bed") {
        const frameMaterial = new THREE.MeshStandardMaterial({
          color: "#372d2a",
          roughness: 0.88,
          metalness: 0.12
        });
        addBox(group, boxGeometry, frameMaterial, [0, 0.22, 0]).scale.set(0.9, 0.16, 1.35);
        const mattress = new THREE.Mesh(
          new THREE.BoxGeometry(0.82, 0.25, 1.27),
          new THREE.MeshStandardMaterial({ color: "#a3978e", roughness: 1 })
        );
        mattress.position.y = 0.42;
        mattress.castShadow = true;
        mattress.receiveShadow = true;
        group.add(mattress);
        addBox(group, boxGeometry, frameMaterial, [0, 0.68, -0.61])
          .scale.set(0.92, 0.9, 0.12);
        for (const x of [-0.36, 0.36]) {
          addBox(group, boxGeometry, frameMaterial, [x, 0.12, -0.55])
            .scale.set(0.12, 0.24, 0.12);
          addBox(group, boxGeometry, frameMaterial, [x, 0.12, 0.55])
            .scale.set(0.12, 0.24, 0.12);
        }
        const pillow = new THREE.Mesh(
          new THREE.BoxGeometry(0.62, 0.12, 0.32),
          new THREE.MeshStandardMaterial({ color: "#ddd2c4", roughness: 0.96 })
        );
        pillow.position.set(0, 0.61, -0.38);
        pillow.rotation.x = -0.08;
        group.add(pillow);
      } else if (prop.type === "garbage") {
        for (let bagIndex = 0; bagIndex < 3; bagIndex++) {
          const bag = new THREE.Mesh(
            new THREE.SphereGeometry(0.23 + bagIndex * 0.012, 12, 9),
            materials.bag
          );
          bag.position.set(
            (bagIndex - 1) * 0.18,
            0.2 + (bagIndex % 2) * 0.05,
            (bagIndex % 2) * 0.12
          );
          bag.scale.set(1, 0.82, 0.92);
          bag.rotation.z = (bagIndex - 1) * 0.22;
          bag.castShadow = true;
          bag.receiveShadow = true;
          group.add(bag);
        }
        const tie = new THREE.Mesh(
          new THREE.ConeGeometry(0.055, 0.13, 7),
          materials.trim
        );
        tie.position.set(0, 0.48, 0.02);
        group.add(tie);
      } else if (prop.type === "pot") {
        const pot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.21, 0.34, 12),
          materials.pot
        );
        pot.position.y = 0.17;
        pot.castShadow = true;
        pot.receiveShadow = true;
        group.add(pot);
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.15, 0.025, 8, 14),
          materials.potRim
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.34;
        group.add(rim);
      } else if (prop.type === "crate") {
        addBox(group, boxGeometry, materials.crate, [0, 0.25, 0]).scale.set(0.48, 0.5, 0.48);
        for (const y of [0.09, 0.42]) {
          addBox(group, boxGeometry, materials.wood, [0, y, 0.25]).scale.set(0.42, 0.045, 0.035);
        }
      } else {
        const bucket = new THREE.Mesh(
          new THREE.CylinderGeometry(0.17, 0.13, 0.36, 12, 1, true),
          materials.metal
        );
        bucket.position.y = 0.18;
        group.add(bucket);
        const handle = new THREE.Mesh(
          new THREE.TorusGeometry(0.17, 0.018, 6, 12, Math.PI),
          materials.rustyMetal
        );
        handle.position.y = 0.37;
        group.add(handle);
      }
    }
  }

  addDeadBodies(level, props) {
    const occupied = [
      level.start,
      level.exit,
      ...level.keys,
      ...level.spawns,
      ...props
    ];
    const candidates = [];
    for (let y = 2; y < level.height - 2; y++) {
      for (let x = 2; x < level.width - 2; x++) {
        if (level.map[y][x] !== 0) continue;
        if (occupied.some((point) => Math.hypot(x + 0.5 - point.x, y + 0.5 - point.y) < 2.2)) {
          continue;
        }
        candidates.push({ x, y });
      }
    }
    for (let index = candidates.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      [candidates[index], candidates[swap]] = [candidates[swap], candidates[index]];
    }

    const bodyCount = Math.min(5, Math.max(2, Math.floor(level.width * level.height / 1100)));
    const bodyGroup = new THREE.Group();
    bodyGroup.name = "environmental-remains";
    this.mazeGroup.add(bodyGroup);
    for (let index = 0; index < bodyCount && index < candidates.length; index++) {
      const cell = candidates[index];
      const pose = index % 3 === 1 ? "slumped" : "fallen";
      const group = new THREE.Group();
      group.position.set(cell.x + 0.5, 0, cell.y + 0.5);
      group.rotation.y = Math.random() * Math.PI * 2;
      bodyGroup.add(group);

      const clothes = new THREE.MeshStandardMaterial({
        color: ["#302b2b", "#39352f", "#242a2d", "#46332d"][index % 4],
        roughness: 0.98
      });
      const skin = new THREE.MeshStandardMaterial({
        color: ["#65564c", "#746258", "#514941"][index % 3],
        roughness: 1
      });
      const torso = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.16, 0.42, 3, 7),
        clothes
      );
      torso.castShadow = true;
      torso.receiveShadow = true;
      torso.position.set(0, pose === "slumped" ? 0.52 : 0.22, 0);
      torso.rotation.z = pose === "slumped"
        ? 0.3 + Math.random() * 0.25
        : Math.PI / 2 + (Math.random() - 0.5) * 0.24;
      group.add(torso);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 9, 7), skin);
      head.scale.set(0.88, 1.05, 0.95);
      head.position.set(
        pose === "slumped" ? 0.06 : 0.36,
        pose === "slumped" ? 0.91 : 0.22,
        0
      );
      head.castShadow = true;
      group.add(head);

      const limbGeometry = new THREE.CapsuleGeometry(0.055, 0.28, 2, 6);
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(limbGeometry, clothes);
        arm.position.set(
          pose === "slumped" ? side * 0.19 : 0.04,
          pose === "slumped" ? 0.33 : 0.15,
          side * 0.2
        );
        arm.rotation.z = pose === "slumped" ? side * 0.16 : 0.58 + side * 0.3;
        arm.castShadow = true;
        group.add(arm);

        const leg = new THREE.Mesh(limbGeometry, clothes);
        leg.position.set(
          pose === "slumped" ? side * 0.11 : -0.3,
          pose === "slumped" ? 0.14 : 0.12,
          side * 0.12
        );
        leg.rotation.z = pose === "slumped" ? -side * 0.08 : -0.24 + side * 0.3;
        leg.castShadow = true;
        group.add(leg);
      }
    }
  }

  createExitDoor(level) {
    if (this.exitDoorGroup) this.mazeGroup.remove(this.exitDoorGroup);
    const exitX = Math.floor(level.exit.x);
    const exitY = Math.floor(level.exit.y);
    const openX = Number(level.map[exitY]?.[exitX - 1] === 0) +
      Number(level.map[exitY]?.[exitX + 1] === 0);
    const openY = Number(level.map[exitY - 1]?.[exitX] === 0) +
      Number(level.map[exitY + 1]?.[exitX] === 0);
    const oneSidedX = openX === 1;
    const oneSidedY = openY === 1;
    const horizontalHall = oneSidedX && !oneSidedY
      ? true
      : oneSidedY && !oneSidedX
        ? false
        : openX >= openY;
    const acrossX = horizontalHall ? 0 : 1;
    const acrossY = horizontalHall ? 1 : 0;
    let openingWidth = 1;
    for (const direction of [-1, 1]) {
      let step = 1;
      while (
        level.map[exitY + acrossY * step * direction]?.[
          exitX + acrossX * step * direction
        ] === 0
      ) {
        openingWidth++;
        step++;
      }
    }
    const doorWidth = Math.max(0.9, Math.min(5, openingWidth - 0.2));
    const door = new THREE.Group();
    door.position.set(level.exit.x, 0, level.exit.y);
    door.rotation.y = horizontalHall ? Math.PI / 2 : 0;
    this.mazeGroup.add(door);
    this.exitDoorGroup = door;

    const frameMaterial = new THREE.MeshStandardMaterial({
      color: "#30272a",
      roughness: 0.86,
      metalness: 0.18
    });
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: "#392b28",
      roughness: 0.9,
      metalness: 0.08
    });
    const ironMaterial = new THREE.MeshStandardMaterial({
      color: "#89817a",
      roughness: 0.48,
      metalness: 0.82,
      emissive: "#372b1c",
      emissiveIntensity: 0.18
    });
    const box = new THREE.BoxGeometry(1, 1, 1);
    const addBox = (parent, material, size, position) => {
      const mesh = new THREE.Mesh(box, material);
      mesh.scale.set(...size);
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const hingeX = -doorWidth / 2;
    addBox(door, frameMaterial, [0.12, 2.55, 0.18], [hingeX, 1.27, 0]);
    addBox(door, frameMaterial, [0.12, 2.55, 0.18], [-hingeX, 1.27, 0]);
    addBox(door, frameMaterial, [doorWidth + 0.24, 0.14, 0.2], [0, 2.55, 0]);

    const leafPivot = new THREE.Group();
    leafPivot.position.set(hingeX + 0.06, 0, 0);
    door.add(leafPivot);
    const leafWidth = doorWidth - 0.12;
    addBox(leafPivot, doorMaterial, [leafWidth, 2.35, 0.12], [leafWidth / 2, 1.18, 0]);
    for (const y of [0.42, 0.94, 1.47, 1.98]) {
      addBox(leafPivot, frameMaterial, [leafWidth * 0.78, 0.035, 0.03],
        [leafWidth / 2, y, 0.078]);
    }
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), ironMaterial);
    knob.position.set(leafWidth - 0.2, 1.15, 0.11);
    leafPivot.add(knob);

    this.exitLocks = [];
    for (const y of [1.55, 0.82]) {
      const lock = new THREE.Group();
      lock.position.set(leafWidth - 0.4, y, 0.105);
      leafPivot.add(lock);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.08), ironMaterial);
      body.castShadow = true;
      lock.add(body);
      const shackle = new THREE.Mesh(
        new THREE.TorusGeometry(0.075, 0.018, 8, 14, Math.PI),
        ironMaterial
      );
      shackle.position.y = 0.14;
      shackle.rotation.z = Math.PI;
      lock.add(shackle);
      this.exitLocks.push(lock);
    }
    this.exitDoorLeaf = leafPivot;
    this.exitDoorAngle = 0;
    this.exitDoorTarget = 0;
  }

  syncExit(keysCollected, keysRequired = 2) {
    if (!this.exitDoorLeaf) return;
    this.exitLocks.forEach((lock, index) => {
      lock.visible = index >= keysCollected;
    });
    this.exitDoorTarget = keysCollected >= keysRequired ? Math.PI / 2 : 0;
  }

  applySettings(settings) {
    const pixelRatio = settings.quality === "low"
      ? Math.min(window.devicePixelRatio, 0.8)
      : settings.quality === "medium"
        ? Math.min(window.devicePixelRatio, 1)
        : Math.min(window.devicePixelRatio, 1.5);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.toneMappingExposure = settings.brightness;
    this.renderer.shadowMap.enabled = settings.quality !== "low";
    this.scene.traverse((object) => {
      if (object.isLight && object.castShadow) {
        object.castShadow = settings.quality === "high";
      }
    });
    this.reducedFlashing = settings.reducedFlashing;
  }

  addMazeLights(level) {
    const candidates = [];
    for (let y = 1; y < level.height - 1; y++) {
      for (let x = 1; x < level.width - 1; x++) {
        if (level.map[y][x] !== 0) continue;
        const seed = (x * 73856093 ^ y * 19349663) >>> 0;
        if (seed % 3 === 0) candidates.push({ x, y, seed });
      }
    }

    candidates.sort((a, b) => a.seed - b.seed);
    const positions = [];
    for (const candidate of candidates) {
      if (positions.length >= 24) break;
      if (positions.some((light) =>
        Math.hypot(candidate.x - light.x, candidate.y - light.y) < 4.5
      )) continue;
      positions.push(candidate);
    }

    const fixtureGeometry = new THREE.BoxGeometry(0.42, 0.06, 0.24);
    const colors = ["#ffd7a0", "#d9e5ff", "#ffb5a2"];
    for (const { x, y, seed } of positions) {
      const color = colors[seed % colors.length];
      const fixtureMaterial = new THREE.MeshStandardMaterial({
        color: "#29252a",
        emissive: color,
        emissiveIntensity: 2.4,
        roughness: 0.72
      });
      const fixture = new THREE.Mesh(fixtureGeometry, fixtureMaterial);
      fixture.position.set(x + 0.5, 2.94, y + 0.5);
      this.mazeGroup.add(fixture);

      const light = new THREE.PointLight(
        color,
        22 + (seed % 1200) / 100,
        8,
        2
      );
      light.position.set(x + 0.5, 2.78, y + 0.5);
      this.mazeGroup.add(light);
      this.mazeLights.push({
        light,
        fixtureMaterial,
        baseIntensity: light.intensity,
        phase: (seed % 628) / 100,
        flickerTime: 0,
        blinking: seed % 4 === 0,
        blinkPeriod: 1.4 + (seed % 17) / 10
      });
    }
  }

  createWallTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    context.fillStyle = "#77727b";
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 5200; i++) {
      const shade = Math.floor(Math.random() * 70);
      const alpha = 0.035 + Math.random() * 0.13;
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade + 8}, ${alpha})`;
      const size = 1 + Math.random() * 5;
      context.fillRect(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        size,
        size
      );
    }

    for (let i = 0; i < 46; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      context.strokeStyle = `rgba(15, 14, 20, ${0.08 + Math.random() * 0.14})`;
      context.lineWidth = 1 + Math.random() * 2;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + (Math.random() - 0.5) * 28, y + 8 + Math.random() * 36);
      context.stroke();
    }

    for (let i = 0; i < 28; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const radius = 12 + Math.random() * 48;
      const stain = context.createRadialGradient(x, y, 1, x, y, radius);
      stain.addColorStop(0, `rgba(27, 38, 30, ${0.08 + Math.random() * 0.13})`);
      stain.addColorStop(1, "rgba(25, 34, 29, 0)");
      context.fillStyle = stain;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    for (let patch = 0; patch < 9; patch++) {
      const centerX = Math.random() * canvas.width;
      const centerY = Math.random() * canvas.height;
      const mossColor = Math.random() < 0.5 ? "35, 67, 39" : "59, 72, 43";
      const width = 12 + Math.random() * 34;
      const height = 14 + Math.random() * 42;
      const moss = context.createRadialGradient(
        centerX,
        centerY,
        1,
        centerX,
        centerY,
        Math.max(width, height)
      );
      moss.addColorStop(0, `rgba(${mossColor}, ${0.24 + Math.random() * 0.2})`);
      moss.addColorStop(0.55, `rgba(${mossColor}, 0.12)`);
      moss.addColorStop(1, `rgba(${mossColor}, 0)`);
      context.fillStyle = moss;
      context.save();
      context.translate(centerX, centerY);
      context.rotate((Math.random() - 0.5) * 0.8);
      context.scale(width / height, 1);
      context.fillRect(-height, -height, height * 2, height * 2);
      context.restore();

      context.fillStyle = `rgba(19, 39, 25, ${0.12 + Math.random() * 0.1})`;
      for (let fleck = 0; fleck < 18; fleck++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * width;
        context.beginPath();
        context.ellipse(
          centerX + Math.cos(angle) * radius,
          centerY + Math.sin(angle) * radius,
          1 + Math.random() * 3,
          1 + Math.random() * 5,
          angle,
          0,
          Math.PI * 2
        );
        context.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  createBloodMaterials() {
    return Array.from({ length: 4 }, (_, variant) => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const context = canvas.getContext("2d");
      const colors = ["#6e0711", "#850b16", "#57050d", "#9a101b"];
      const color = colors[variant];

      const stain = context.createRadialGradient(64, 58, 4, 64, 58, 48);
      stain.addColorStop(0, `${color}e8`);
      stain.addColorStop(0.58, `${color}bf`);
      stain.addColorStop(1, `${color}00`);
      context.fillStyle = stain;
      context.beginPath();
      context.ellipse(64, 58, 40, 27, (Math.random() - 0.5) * 0.5, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = `${color}c9`;
      for (let i = 0; i < 22; i++) {
        const x = 30 + Math.random() * 68;
        const y = 35 + Math.random() * 46;
        const radius = 2 + Math.random() * 8;
        context.beginPath();
        context.ellipse(x, y, radius, radius * (0.45 + Math.random() * 0.7), Math.random(), 0, Math.PI * 2);
        context.fill();
      }

      context.fillStyle = `${color}d8`;
      for (let i = 0; i < 3; i++) {
        const x = 42 + Math.random() * 44;
        const startY = 65 + Math.random() * 17;
        const length = 20 + Math.random() * 37;
        const width = 2 + Math.random() * 5;
        context.beginPath();
        context.moveTo(x - width, startY);
        context.quadraticCurveTo(x, startY + length * 0.45, x + width * 0.4, startY + length);
        context.quadraticCurveTo(x + width * 1.5, startY + length + 4, x + width, startY + length * 0.55);
        context.closePath();
        context.fill();
      }

      for (let i = 0; i < 32; i++) {
        context.globalAlpha = 0.45 + Math.random() * 0.5;
        context.fillStyle = color;
        context.beginPath();
        context.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2.5, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.025,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1
      });
    });
  }

  addBloodDecals(level, wallCells, materials) {
    const decalGeometry = new THREE.PlaneGeometry(1, 1);
    const faceDirections = [
      { dx: 0, dy: 1, angle: 0, axis: "z", sign: 1 },
      { dx: 0, dy: -1, angle: Math.PI, axis: "z", sign: -1 },
      { dx: 1, dy: 0, angle: Math.PI / 2, axis: "x", sign: 1 },
      { dx: -1, dy: 0, angle: -Math.PI / 2, axis: "x", sign: -1 }
    ];

    for (const { x, y } of wallCells) {
      for (const face of faceDirections) {
        if (level.map[y + face.dy]?.[x + face.dx] === 1 || Math.random() > 0.42) {
          continue;
        }

        const decal = new THREE.Mesh(
          decalGeometry,
          materials[Math.floor(Math.random() * materials.length)]
        );
        const width = 0.28 + Math.random() * 0.5;
        const height = 0.38 + Math.random() * 0.9;
        decal.scale.set(width, height, 1);
        decal.position.set(x + 0.5, 0.35 + Math.random() * 2.15, y + 0.5);
        if (face.axis === "x") {
          decal.position.x += face.sign * 0.506;
          decal.rotation.y = face.angle;
        } else {
          decal.position.z += face.sign * 0.506;
          decal.rotation.y = face.angle;
        }
        this.mazeGroup.add(decal);

        if (Math.random() < 0.22) {
          const second = decal.clone();
          second.material = materials[Math.floor(Math.random() * materials.length)];
          second.scale.set(width * 0.55, height * 0.55, 1);
          second.position.y = Math.max(0.25, decal.position.y - height * 0.4);
          if (face.axis === "x") {
            second.position.z += (Math.random() - 0.5) * 0.18;
          } else {
            second.position.x += (Math.random() - 0.5) * 0.18;
          }
          this.mazeGroup.add(second);
        }
      }
    }
  }

  createFlickerLight() {
    if (this.flickerLight) this.scene.remove(this.flickerLight);
    this.flickerLight = new THREE.PointLight("#a32842", 2.2, 7, 2);
    this.flickerLight.position.set(0, 2.4, 0);
    this.scene.add(this.flickerLight);
  }

  loadEnemyModel() {
    this.enemyModelLoading = new Promise((resolve, reject) => {
      new GLTFLoader().load(
        "/dist/models/aswang.gltf",
        (gltf) => {
          this.enemyModelTemplate = gltf;
          resolve(gltf);
        },
        undefined,
        reject
      );
    });
  }

  syncPlayer(player, grabbedEnemy = null) {
    if (grabbedEnemy) {
      this.camera.position.set(player.x, 1.45, player.y);
      this.camera.lookAt(grabbedEnemy.x, 1.05, grabbedEnemy.y);
      return;
    }

    this.cameraBaseY = 1.6 + (player.jumpHeight || 0);
    this.camera.position.set(player.x, this.cameraBaseY, player.y);
    const horizontalLook = Math.cos(player.pitch || 0);
    this.camera.lookAt(
      player.x + player.dirX * horizontalLook,
      1.6 + Math.sin(player.pitch || 0),
      player.y + player.dirY * horizontalLook
    );
  }

  syncKeys(keys) {
    for (const key of keys) {
      let mesh = this.keyMeshes.get(key);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.18),
          new THREE.MeshStandardMaterial({
            color: "#ffd64d",
            emissive: "#a86800",
            emissiveIntensity: 1.4,
            roughness: 0.35
          })
        );
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.keyMeshes.set(key, mesh);
      }
      mesh.visible = !key.collected;
      if (!key.collected) {
        mesh.position.set(
          key.x,
          0.75 + Math.sin(this.elapsed * 2 + key.x) * 0.08,
          key.y
        );
      }
    }
  }

  syncPickups(pickups) {
    const labels = {
      gun: "GUN",
      map: "MAP",
      flashlight: "LGT",
      ammo: "AMMO",
      battery: "CELL"
    };

    for (const pickup of pickups) {
      let group = this.pickupMeshes.get(pickup);
      if (!group) {
        group = new THREE.Group();
        const model = this.createItemModel(pickup.type);
        group.add(model);

        const labelCanvas = document.createElement("canvas");
        labelCanvas.width = 128;
        labelCanvas.height = 48;
        const context = labelCanvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.font = "bold 28px monospace";
        context.textAlign = "center";
        context.fillText(labels[pickup.type], 64, 32);
        const label = new THREE.Sprite(new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(labelCanvas),
          transparent: true,
          depthTest: true,
          depthWrite: false
        }));
        label.scale.set(0.8, 0.3, 1);
        label.position.y = 0.42;
        group.userData.label = label;
        group.add(label);
        this.scene.add(group);
        this.pickupMeshes.set(pickup, group);
      }

      group.visible = !pickup.collected;
      const distance = Math.hypot(
        this.camera.position.x - pickup.x,
        this.camera.position.z - pickup.y
      );
      if (group.userData.label) {
        group.userData.label.visible = !pickup.collected && distance <= 2.8;
      }
      if (!pickup.collected) {
        group.position.set(
          pickup.x,
          0.32 + Math.sin(this.elapsed * 2.5 + pickup.x) * 0.07,
          pickup.y
        );
        group.rotation.y = this.elapsed * 0.45 + pickup.x;
      }
    }
  }

  createFirstPersonHand() {
    const sleeveMaterial = new THREE.MeshStandardMaterial({
      color: "#29232a",
      roughness: 0.88,
      metalness: 0.04
    });
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: "#b47f68",
      roughness: 0.72,
      metalness: 0
    });
    const gloveMaterial = new THREE.MeshStandardMaterial({
      color: "#39343a",
      roughness: 0.82
    });
    const cuffMaterial = new THREE.MeshStandardMaterial({
      color: "#65505a",
      roughness: 0.7,
      metalness: 0.12
    });

    const addCapsuleBetween = (parent, start, end, radius, material) => {
      const startPoint = new THREE.Vector3(...start);
      const endPoint = new THREE.Vector3(...end);
      const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(radius, Math.max(0.01, direction.length() - radius * 2), 4, 8),
        material
      );
      mesh.position.copy(startPoint).add(endPoint).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    addCapsuleBetween(
      this.viewModel,
      [0.29, -0.62, -0.12],
      [0.03, -0.25, -0.58],
      0.115,
      sleeveMaterial
    );
    addCapsuleBetween(
      this.viewModel,
      [0.03, -0.25, -0.58],
      [-0.015, -0.17, -0.69],
      0.09,
      cuffMaterial
    );
    addCapsuleBetween(
      this.viewModel,
      [-0.015, -0.17, -0.69],
      [-0.015, -0.115, -0.83],
      0.068,
      skinMaterial
    );

    const palm = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 10),
      skinMaterial
    );
    palm.position.set(-0.02, -0.12, -0.87);
    palm.scale.set(1, 0.75, 1.18);
    palm.castShadow = true;
    this.viewModel.add(palm);

    for (let finger = 0; finger < 4; finger++) {
      const x = -0.08 + finger * 0.045;
      const length = finger === 1 || finger === 2 ? 0.14 : 0.12;
      addCapsuleBetween(
        this.viewModel,
        [x, -0.11, -0.91],
        [x + 0.012, -0.13, -0.91 - length],
        0.021,
        gloveMaterial
      );
    }
    addCapsuleBetween(
      this.viewModel,
      [0.045, -0.105, -0.87],
      [0.105, -0.14, -0.96],
      0.025,
      gloveMaterial
    );

    const gloveCuff = new THREE.Mesh(
      new THREE.TorusGeometry(0.072, 0.012, 8, 16),
      cuffMaterial
    );
    gloveCuff.position.set(-0.015, -0.17, -0.81);
    this.viewModel.add(gloveCuff);
  }

  createItemModel(type) {
    const group = new THREE.Group();
    const makeMaterial = (color, options = {}) => new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? 0.48,
      metalness: options.metalness ?? 0.15,
      emissive: options.emissive || "#000000",
      emissiveIntensity: options.emissiveIntensity || 0
    });
    const polymer = makeMaterial("#25272b", { roughness: 0.75 });
    const metal = makeMaterial("#737c83", { metalness: 0.82, roughness: 0.28 });
    const darkMetal = makeMaterial("#343a40", { metalness: 0.7, roughness: 0.34 });
    const brass = makeMaterial("#bb8035", { metalness: 0.75, roughness: 0.3 });
    const accent = makeMaterial("#912b35", { roughness: 0.55 });

    const addBox = (parent, material, size, position) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const addCylinder = (parent, material, radiusTop, radiusBottom, height, position, rotation = [0, 0, 0]) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 12),
        material
      );
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    if (type === "gun") {
      addBox(group, polymer, [0.32, 0.14, 0.52], [0, 0.06, 0]);
      const slide = addBox(group, metal, [0.29, 0.095, 0.35], [0, 0.145, -0.04]);
      addCylinder(group, darkMetal, 0.045, 0.045, 0.35, [0, 0.12, -0.43], [Math.PI / 2, 0, 0]);
      addBox(group, polymer, [0.16, 0.27, 0.18], [0.015, -0.13, 0.13]);
      const magazine = addBox(group, darkMetal, [0.12, 0.16, 0.17], [0.015, -0.225, 0.13]);
      addBox(group, metal, [0.075, 0.045, 0.045], [0, 0.22, -0.06]);
      const trigger = new THREE.Mesh(
        new THREE.TorusGeometry(0.075, 0.012, 6, 12, Math.PI),
        metal
      );
      trigger.position.set(0, -0.045, 0.12);
      trigger.rotation.x = Math.PI / 2;
      group.add(trigger);
      for (const x of [-0.13, 0.13]) {
        addBox(group, darkMetal, [0.018, 0.07, 0.12], [x, 0.08, 0.03]);
      }
      group.userData.reloadParts = {
        slide,
        slidePosition: slide.position.clone(),
        magazine,
        magazinePosition: magazine.position.clone()
      };
    } else if (type === "flashlight") {
      const body = addCylinder(group, polymer, 0.09, 0.075, 0.58, [0, 0, 0], [Math.PI / 2, 0, 0]);
      body.rotation.z = Math.PI / 2;
      addCylinder(group, darkMetal, 0.12, 0.1, 0.13, [0.32, 0, 0], [0, 0, Math.PI / 2]);
      addCylinder(
        group,
        makeMaterial("#b9dcff", { emissive: "#66aaff", emissiveIntensity: 2, metalness: 0.25 }),
        0.083,
        0.083,
        0.018,
        [0.395, 0, 0],
        [0, 0, Math.PI / 2]
      );
      for (const x of [-0.18, -0.08, 0.02]) {
        addCylinder(group, darkMetal, 0.095, 0.095, 0.018, [x, 0, 0], [0, 0, Math.PI / 2]);
      }
      addBox(group, accent, [0.07, 0.045, 0.025], [-0.15, 0.08, 0]);
      group.rotation.z = -0.2;
    } else if (type === "map") {
      const paper = makeMaterial("#c5b88d", { roughness: 0.94, metalness: 0 });
      addBox(group, darkMetal, [0.54, 0.035, 0.42], [0, 0, 0]);
      addBox(group, paper, [0.49, 0.012, 0.37], [0, 0.024, 0]);
      const routeMaterial = makeMaterial("#75414a", { roughness: 0.9, metalness: 0 });
      for (let i = 0; i < 4; i++) {
        addBox(group, routeMaterial, [0.025, 0.006, 0.31], [-0.17 + i * 0.105, 0.034, 0]);
      }
      for (let i = 0; i < 3; i++) {
        addBox(group, routeMaterial, [0.43, 0.006, 0.018], [0, 0.035, -0.11 + i * 0.1]);
      }
      addCylinder(group, brass, 0.04, 0.04, 0.018, [0.21, 0.035, 0.15]);
    } else if (type === "battery") {
      addCylinder(group, makeMaterial("#285b65", { roughness: 0.35 }), 0.11, 0.11, 0.34, [0, 0, 0]);
      addCylinder(group, brass, 0.09, 0.09, 0.035, [0, 0.185, 0]);
      addCylinder(group, darkMetal, 0.105, 0.105, 0.025, [0, -0.17, 0]);
      addBox(group, makeMaterial("#b9e2dd", { roughness: 0.62, metalness: 0 }), [0.012, 0.12, 0.14], [0, 0, 0.105]);
      for (const y of [-0.08, 0.08]) {
        addCylinder(group, metal, 0.113, 0.113, 0.014, [0, y, 0]);
      }
    } else if (type === "ammo") {
      addBox(group, polymer, [0.38, 0.25, 0.29], [0, 0, 0]);
      addBox(group, accent, [0.39, 0.07, 0.3], [0, 0.06, 0]);
      for (let i = -1; i <= 1; i++) {
        addCylinder(group, brass, 0.045, 0.045, 0.22, [i * 0.105, 0.17, 0], [0.1, 0, 0]);
      }
      addBox(group, makeMaterial("#d8c8a4", { metalness: 0 }), [0.22, 0.08, 0.012], [0, -0.01, 0.151]);
      for (let x = -0.075; x <= 0.076; x += 0.075) {
        addBox(group, brass, [0.018, 0.018, 0.016], [x, -0.01, 0.163]);
      }
    }

    group.traverse((object) => {
      if (object.isMesh) object.castShadow = true;
    });
    return group;
  }

  setEquippedItem(type, inventory) {
    const available =
      (type === "gun" && inventory.gun > 0) ||
      (type === "map" && inventory.map > 0) ||
      (type === "flashlight" && inventory.flashlight > 0) ||
      (type === "ammo" && inventory.ammo > 0);
    if (this.viewModelItemType === type && Boolean(this.viewModelItem) === available) return;

    if (this.viewModelItem) {
      this.viewModel.remove(this.viewModelItem);
      this.viewModelItem.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      });
      this.viewModelItem = null;
    }
    this.weaponParts = null;
    this.viewModelItemType = type;
    if (!available) return;

    const item = this.createItemModel(type);
    item.position.set(0, 0.035, -0.28);
    item.scale.setScalar(type === "map" ? 0.72 : type === "gun" ? 0.72 : 0.82);
    if (type === "gun") item.rotation.x = -0.08;
    if (type === "flashlight") item.rotation.y = -Math.PI / 2;
    if (type === "map") item.rotation.x = -0.15;
    this.viewModel.add(item);
    this.viewModelItem = item;
    this.weaponParts = item.userData.reloadParts || null;
  }

  finishReload() {
    if (!this.weaponParts) return;
    this.weaponParts.magazine.visible = true;
    this.weaponParts.magazine.position.copy(this.weaponParts.magazinePosition);
    this.weaponParts.slide.position.copy(this.weaponParts.slidePosition);
  }

  fireViewModel(impactTarget = null) {
    if (this.viewModelItemType !== "gun" || !this.viewModelItem) return;
    this.viewModelRecoil = 0.12;
    this.cameraKick = 0.055;
    this.muzzleFlashTimer = 0.055;
    this.muzzleFlash.visible = true;
    this.muzzleFlash.material.opacity = 0.8 + Math.random() * 0.2;
    this.muzzleFlash.scale.set(
      0.65 + Math.random() * 0.7,
      0.65 + Math.random() * 0.7,
      2.2 + Math.random() * 1.4
    );
    this.muzzleLight.intensity = 38;
    this.viewModelLight.intensity = 5;
    this.spawnShellCasing();
    this.spawnSmoke();
    if (impactTarget) {
      this.spawnBulletImpact(
        new THREE.Vector3(impactTarget.x, impactTarget.y, impactTarget.z),
        impactTarget.surface
      );
    } else {
      this.spawnRaycastImpact();
    }
  }

  spawnRaycastImpact() {
    if (!this.mazeGroup) return;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hit = raycaster.intersectObjects(this.mazeGroup.children, true)
      .find((intersection) => intersection.distance > 0.4 && intersection.distance < 12);
    if (!hit) return;
    const surface = hit.object.userData.surfaceType ||
      (hit.object.material?.metalness > 0.4 ? "metal" : "plaster");
    this.spawnBulletImpact(hit.point, surface);
  }

  spawnBulletImpact(position, surface = "plaster") {
    const colors = surface === "flesh"
      ? ["#7d1720", "#4b1018", "#a42c2d"]
      : surface === "metal"
        ? ["#ffd27a", "#ff8c35", "#c5a27c"]
        : ["#b2a898", "#766d66", "#403b3b"];
    const particleCount = surface === "metal" ? 9 : 6;
    for (let index = 0; index < particleCount; index++) {
      const material = new THREE.MeshBasicMaterial({
        color: colors[index % colors.length],
        transparent: true,
        opacity: 0.92
      });
      const particle = new THREE.Mesh(this.effectParticleGeometry, material);
      particle.position.copy(position);
      particle.scale.setScalar(0.45 + Math.random() * 0.8);
      this.scene.add(particle);
      this.effectParticles.push({
        mesh: particle,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 2.4,
          0.4 + Math.random() * 2.8,
          (Math.random() - 0.5) * 2.4
        ),
        life: 0.16 + Math.random() * 0.22,
        maxLife: 0.38,
        kind: "impact"
      });
    }
  }

  spawnSmoke() {
    const origin = this.muzzleFlash.getWorldPosition(new THREE.Vector3());
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    for (let index = 0; index < 3; index++) {
      const material = new THREE.MeshBasicMaterial({
        color: "#494345",
        transparent: true,
        opacity: 0.24
      });
      const smoke = new THREE.Mesh(this.effectParticleGeometry, material);
      smoke.position.copy(origin).addScaledVector(forward, index * 0.08);
      smoke.scale.setScalar(0.75 + Math.random() * 0.65);
      this.scene.add(smoke);
      this.effectParticles.push({
        mesh: smoke,
        velocity: forward.clone().multiplyScalar(0.5 + Math.random() * 0.45)
          .add(new THREE.Vector3((Math.random() - 0.5) * 0.22, 0.35, (Math.random() - 0.5) * 0.22)),
        life: 0.42 + Math.random() * 0.3,
        maxLife: 0.72,
        kind: "smoke"
      });
    }
  }

  spawnShellCasing() {
    const casing = new THREE.Mesh(this.shellGeometry, this.shellMaterial);
    const origin = new THREE.Vector3(0.62, -0.29, -0.92);
    this.camera.localToWorld(origin);
    casing.position.copy(origin);
    casing.rotation.set(Math.random() * Math.PI, 0, Math.random() * Math.PI);
    this.scene.add(casing);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const velocity = right.multiplyScalar(1.3 + Math.random() * 0.7)
      .addScaledVector(up, 0.5 + Math.random() * 0.5)
      .addScaledVector(forward, 0.15);
    this.shellCasings.push({ mesh: casing, velocity, life: 4.5 });
  }

  updateTransientEffects(dt) {
    this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
    this.muzzleFlash.visible = this.muzzleFlashTimer > 0;
    this.muzzleLight.intensity = this.muzzleFlashTimer > 0
      ? 38 * this.muzzleFlashTimer / 0.055
      : 0;

    for (let index = this.effectParticles.length - 1; index >= 0; index--) {
      const particle = this.effectParticles[index];
      particle.life -= dt;
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.material.dispose();
        this.effectParticles.splice(index, 1);
        continue;
      }
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      if (particle.kind === "smoke") {
        particle.velocity.y += dt * 0.45;
        particle.mesh.scale.multiplyScalar(1 + dt * 1.1);
        particle.mesh.material.opacity = 0.24 * particle.life / particle.maxLife;
      } else {
        particle.velocity.y -= dt * 7;
        particle.mesh.material.opacity = particle.life / particle.maxLife;
      }
    }

    for (let index = this.shellCasings.length - 1; index >= 0; index--) {
      const casing = this.shellCasings[index];
      casing.life -= dt;
      if (casing.life <= 0) {
        this.scene.remove(casing.mesh);
        this.shellCasings.splice(index, 1);
        continue;
      }
      casing.velocity.y -= dt * 7.5;
      casing.mesh.position.addScaledVector(casing.velocity, dt);
      casing.mesh.rotation.x += dt * 12;
      casing.mesh.rotation.z += dt * 8;
      if (casing.mesh.position.y < 0.04) {
        casing.mesh.position.y = 0.04;
        casing.velocity.y = Math.abs(casing.velocity.y) * 0.24;
        casing.velocity.x *= 0.74;
        casing.velocity.z *= 0.74;
      }
    }
  }

  setPlayerHidden(hidden) {
    this.viewModel.visible = !hidden;
  }

  setFlashlightEnabled(enabled) {
    this.flashlight.visible = enabled;
    if (this.viewModelItemType === "flashlight" && this.viewModelItem) {
      this.viewModelItem.children.forEach((child) => {
        if (child.isMesh && child.material.emissiveIntensity !== undefined) {
          child.material.emissiveIntensity = enabled ? 2 : 0.25;
        }
      });
    }
  }

  syncEnemies(enemies) {
    for (const enemy of enemies) {
      let model = this.enemyMeshes.get(enemy);
      if (!model && this.enemyModelTemplate) {
        model = this.enemyModelTemplate.scene.clone(true);
        model.scale.setScalar(1);
        model.traverse((object) => {
          if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        this.scene.add(model);
        this.enemyMeshes.set(enemy, model);

        const mixer = new THREE.AnimationMixer(model);
        const walk = this.enemyModelTemplate.animations.find(
          (clip) => clip.name === "Walk"
        );
        const idle = this.enemyModelTemplate.animations.find(
          (clip) => clip.name === "Idle"
        );
        const action = mixer.clipAction(walk || idle);
        action?.play();
        this.enemyMixers.set(enemy, mixer);
        this.enemyActions.set(enemy, action);
      }

      if (model) {
        model.position.set(enemy.x, 0, enemy.y);
        model.rotation.y = -enemy.facing + Math.PI / 2;

        const mixer = this.enemyMixers.get(enemy);
        if (mixer) {
          const walk = this.enemyModelTemplate?.animations.find(
            (clip) => clip.name === "Walk"
          );
          const clip = walk;
          if (clip) {
            const activeAction = this.enemyActions.get(enemy);
            if (activeAction?.getClip() !== clip) {
              mixer.stopAllAction();
              const nextAction = mixer.clipAction(clip);
              nextAction.setEffectiveTimeScale(enemy.state === "CHASE" ? 1.75 : 1);
              nextAction.play();
              this.enemyActions.set(enemy, nextAction);
            } else {
              activeAction.setEffectiveTimeScale(enemy.state === "CHASE" ? 1.75 : 1);
            }
          }
        }
      }
    }
  }

  update(dt, enemies, movement = {}) {
    this.elapsed += dt;
    this.updateTransientEffects(dt);
    if (this.exitDoorLeaf) {
      this.exitDoorAngle +=
        (this.exitDoorTarget - this.exitDoorAngle) * (1 - Math.exp(-dt * 3));
      this.exitDoorLeaf.rotation.y = -this.exitDoorAngle;
    }
    const targetMovement = Math.max(0, Math.min(1, movement.intensity || 0));
    this.movementBlend +=
      (targetMovement - this.movementBlend) * (1 - Math.exp(-dt * 12));
    if (this.movementBlend > 0.01) {
      this.movementPhase += dt * (movement.sprinting ? 11.5 : 8.5);
    }

    const stride = this.movementPhase;
    const walkBob = Math.sin(stride * 2);
    const sprintScale = movement.sprinting ? 1.45 : 1;
    const bobAmount = this.movementBlend * sprintScale;
    this.viewModelRecoil = Math.max(0, this.viewModelRecoil - dt * 0.9);
    this.viewModel.position.set(
      0.42 + Math.sin(stride) * 0.025 * bobAmount,
      -0.42 + Math.abs(walkBob) * 0.018 * bobAmount +
        Math.sin(this.elapsed * 3.2) * 0.003,
      -0.78 + this.viewModelRecoil + Math.cos(stride) * 0.012 * bobAmount
    );
    this.viewModel.rotation.set(
      Math.cos(stride) * 0.025 * bobAmount,
      Math.sin(stride) * 0.018 * bobAmount,
      Math.sin(stride) * 0.045 * bobAmount
    );
    if (movement.reloading && this.weaponParts) {
      const progress = Math.max(0, Math.min(1, movement.reloadProgress || 0));
      const parts = this.weaponParts;
      if (progress < 0.2) {
        parts.magazine.visible = true;
        parts.magazine.position.y =
          parts.magazinePosition.y - 0.18 * progress / 0.2;
      } else if (progress < 0.56) {
        parts.magazine.visible = false;
      } else {
        parts.magazine.visible = true;
        parts.magazine.position.y =
          parts.magazinePosition.y - 0.18 * (1 - (progress - 0.56) / 0.44);
      }
      parts.slide.position.z =
        parts.slidePosition.z + Math.sin(progress * Math.PI) * 0.055;
      this.viewModel.position.y -= Math.sin(progress * Math.PI) * 0.085;
      this.viewModel.rotation.x += Math.sin(progress * Math.PI) * 0.08;
    } else {
      this.finishReload();
    }
    this.camera.position.y =
      this.cameraBaseY + walkBob * 0.018 * bobAmount;
    this.camera.position.x += (Math.random() - 0.5) * this.cameraKick * 0.025;
    this.camera.rotateX(this.cameraKick * 0.85);
    this.cameraKick = Math.max(0, this.cameraKick - dt * 0.28);
    this.camera.rotateZ(
      (movement.strafe || 0) * -0.018 * this.movementBlend
    );
    if (movement.flashlightOn) {
      const charge = Math.max(0, movement.flashlightCharge ?? 100);
      const lowBattery = charge < 20;
      const subtleVariation = 0.96 + Math.sin(this.elapsed * 2.4) * 0.035;
      let output = subtleVariation;
      if (lowBattery && !this.reducedFlashing) {
        const pulse = 0.58 + (Math.sin(this.elapsed * 18) + 1) * 0.2;
        output = Math.sin(this.elapsed * 6.5 + 0.7) < -0.83
          ? 0.08
          : pulse;
      }
      this.flashlight.visible = output > 0.12;
      this.flashlight.intensity = 70 * output;
    } else {
      this.flashlight.visible = false;
    }
    const targetFov = 78 + (movement.sprinting ? 2 : 0) * this.movementBlend;
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-dt * 5));
    this.camera.updateProjectionMatrix();
    this.viewModelLight.intensity = Math.max(0, this.viewModelLight.intensity - dt * 35);
    for (const mixer of this.enemyMixers.values()) {
      mixer.update(dt);
    }
    for (const lamp of this.mazeLights || []) {
      if (this.reducedFlashing) {
        lamp.light.intensity = lamp.baseIntensity * 0.9;
        lamp.fixtureMaterial.emissiveIntensity = 2.4 * 0.9;
        continue;
      }
      if (lamp.blinking) {
        const blinkPhase = (this.elapsed + lamp.phase) % lamp.blinkPeriod;
        const isOn = blinkPhase < lamp.blinkPeriod * 0.68;
        const intensity = isOn ? 1 : 0.035;
        lamp.light.intensity = lamp.baseIntensity * intensity;
        lamp.fixtureMaterial.emissiveIntensity = 2.4 * intensity;
        continue;
      }

      lamp.flickerTime = Math.max(0, lamp.flickerTime - dt);
      if (lamp.flickerTime === 0 && Math.random() < dt * 0.025) {
        lamp.flickerTime = 0.08 + Math.random() * 0.12;
      }

      const flicker = lamp.flickerTime > 0
        ? 0.18
        : 0.9 + Math.sin(this.elapsed * 1.7 + lamp.phase) * 0.1;
      lamp.light.intensity = lamp.baseIntensity * flicker;
      lamp.fixtureMaterial.emissiveIntensity = 2.4 * flicker;
    }
    if (this.flickerLight) {
      if (this.reducedFlashing) {
        this.flickerLight.intensity = 1.7;
        return;
      }
      const randomFlicker =
        Math.random() < 0.035 ? 0.15 : 1;
      this.flickerLight.intensity =
        (1.7 + Math.sin(this.elapsed * 4.2) * 0.22) *
        randomFlicker;
    }
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
