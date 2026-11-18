import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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
    this.renderer.toneMappingExposure = 0.8;

    this.scene.add(new THREE.AmbientLight("#8a8299", 0.12));

    this.flashlight = new THREE.SpotLight(
      "#dbe3ff",
      70,
      18,
      Math.PI / 3.25,
      0.72,
      1.25
    );
    this.flashlight.position.set(0, 0, 0);
    this.flashlight.target.position.set(0, 0, -1);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.camera.near = 0.1;
    this.flashlight.shadow.camera.far = 12;
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);
    this.scene.add(this.camera);

    this.enemyMeshes = new Map();
    this.enemyModels = new Map();
    this.enemyMixers = new Map();
    this.enemyActions = new Map();
    this.enemyModelTemplate = null;
    this.enemyModelLoading = null;
    this.loadEnemyModel();
    this.keyMeshes = new Map();
    this.elapsed = 0;

    window.addEventListener("resize", () => this.resize());
  }

  buildMaze(level) {
    if (this.mazeGroup) this.scene.remove(this.mazeGroup);
    this.mazeGroup = new THREE.Group();
    this.scene.add(this.mazeGroup);

    const wallGeometry = new THREE.BoxGeometry(1, 3, 1);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: "#252330",
      roughness: 0.96,
      metalness: 0.02
    });

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
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        if (level.map[y][x] !== 1) continue;
        matrix.makeTranslation(x + 0.5, 1.5, y + 0.5);
        walls.setMatrixAt(wallIndex++, matrix);
      }
    }
    walls.instanceMatrix.needsUpdate = true;
    this.mazeGroup.add(walls);

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

    this.createFlickerLight();
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
        "/models/aswang.gltf",
        (gltf) => {
          this.enemyModelTemplate = gltf;
          resolve(gltf);
        },
        undefined,
        reject
      );
    });
  }

  syncPlayer(player) {
    this.camera.position.set(player.x, 1.6, player.y);
    this.camera.lookAt(
      player.x + player.dirX,
      1.6,
      player.y + player.dirY
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

  syncEnemies(enemies) {
    for (const enemy of enemies) {
      let model = this.enemyMeshes.get(enemy);
      if (!model && this.enemyModelTemplate) {
        model = this.enemyModelTemplate.scene.clone(true);
        model.scale.setScalar(0.72);
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
          const roar = this.enemyModelTemplate?.animations.find(
            (clip) => clip.name === "Roar"
          );
          const clip = enemy.state === "CHASE" ? roar || walk : walk;
          if (clip) {
            const activeAction = this.enemyActions.get(enemy);
            if (activeAction?.getClip() !== clip) {
              mixer.stopAllAction();
              const nextAction = mixer.clipAction(clip);
              nextAction.play();
              this.enemyActions.set(enemy, nextAction);
            }
          }
        }
      }
    }
  }

  update(dt, enemies) {
    this.elapsed += dt;
    for (const mixer of this.enemyMixers.values()) {
      mixer.update(dt);
    }
    if (this.flickerLight) {
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
