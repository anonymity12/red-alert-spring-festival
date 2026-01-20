import * as THREE from 'three';
import { Entity, EntityType, PlayerSide } from './types';
import { TILE_SIZE, GRID_SIZE } from './constants';

export class GameRenderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private entityMeshes: Map<string, THREE.Mesh>;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  constructor(container: HTMLElement) {
    this.entityMeshes = new Map();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue

    // Create isometric camera
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = 1000;
    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      1,
      2000
    );

    // Position camera for isometric view
    this.camera.position.set(500, 500, 500);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Create ground grid
    this.createGround();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize(container));
  }

  private createGround() {
    // Create a simple grid for the game board
    const gridHelper = new THREE.GridHelper(
      GRID_SIZE * TILE_SIZE,
      GRID_SIZE,
      0x444444,
      0x888888
    );
    gridHelper.rotation.x = Math.PI / 2;
    this.scene.add(gridHelper);

    // Create ground plane
    const groundGeometry = new THREE.PlaneGeometry(
      GRID_SIZE * TILE_SIZE,
      GRID_SIZE * TILE_SIZE
    );
    const groundMaterial = new THREE.MeshLambertMaterial({
      color: 0x90ee90,
      side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private createEntityMesh(entity: Entity): THREE.Mesh {
    let geometry: THREE.BufferGeometry;
    let material: THREE.MeshLambertMaterial;

    // Different shapes and colors for different entity types
    switch (entity.type) {
      case EntityType.BASE:
        geometry = new THREE.BoxGeometry(80, 80, 80);
        material = new THREE.MeshLambertMaterial({
          color: entity.owner === PlayerSide.PLAYER1 ? 0xff0000 : 0x0000ff
        });
        break;

      case EntityType.TOWER:
        geometry = new THREE.CylinderGeometry(20, 30, 60, 8);
        material = new THREE.MeshLambertMaterial({
          color: entity.owner === PlayerSide.PLAYER1 ? 0xff6666 : 0x6666ff
        });
        break;

      case EntityType.BARRACKS:
        geometry = new THREE.BoxGeometry(60, 50, 60);
        material = new THREE.MeshLambertMaterial({
          color: entity.owner === PlayerSide.PLAYER1 ? 0xcc0000 : 0x0000cc
        });
        break;

      case EntityType.COLLECTOR:
        geometry = new THREE.SphereGeometry(15, 16, 16);
        material = new THREE.MeshLambertMaterial({
          color: entity.owner === PlayerSide.PLAYER1 ? 0xffaa00 : 0x00aaff
        });
        break;

      case EntityType.FIRECRACKER_SOLDIER:
        geometry = new THREE.ConeGeometry(10, 30, 8);
        material = new THREE.MeshLambertMaterial({
          color: entity.owner === PlayerSide.PLAYER1 ? 0xff4444 : 0x4444ff
        });
        break;

      case EntityType.NIAN_BEAST:
        geometry = new THREE.BoxGeometry(25, 35, 25);
        material = new THREE.MeshLambertMaterial({
          color: entity.owner === PlayerSide.PLAYER1 ? 0x990000 : 0x000099
        });
        break;

      case EntityType.RESOURCE:
        geometry = new THREE.OctahedronGeometry(20);
        material = new THREE.MeshLambertMaterial({
          color: 0xffd700 // Gold color for resources
        });
        break;

      default:
        geometry = new THREE.BoxGeometry(20, 20, 20);
        material = new THREE.MeshLambertMaterial({ color: 0x888888 });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.entityId = entity.id;

    return mesh;
  }

  updateEntities(entities: Map<string, Entity>) {
    // Remove meshes for deleted entities
    const currentIds = new Set(entities.keys());
    for (const [id, mesh] of this.entityMeshes) {
      if (!currentIds.has(id)) {
        this.scene.remove(mesh);
        this.entityMeshes.delete(id);
      }
    }

    // Update or create meshes for entities
    for (const [id, entity] of entities) {
      let mesh = this.entityMeshes.get(id);

      if (!mesh) {
        mesh = this.createEntityMesh(entity);
        this.scene.add(mesh);
        this.entityMeshes.set(id, mesh);
      }

      // Update position
      mesh.position.set(
        entity.position.x,
        entity.position.y + 20, // Lift entities above ground
        entity.position.z
      );

      // Update selection highlight
      if (entity.selected) {
        (mesh.material as THREE.MeshLambertMaterial).emissive.setHex(0x444444);
      } else {
        (mesh.material as THREE.MeshLambertMaterial).emissive.setHex(0x000000);
      }

      // Add health bar above entity
      this.updateHealthBar(entity, mesh);
    }
  }

  private updateHealthBar(entity: Entity, mesh: THREE.Mesh) {
    // Simple health indicator using a small plane above the entity
    const healthPercent = entity.health / entity.maxHealth;
    
    // Remove old health bar if exists
    const oldBar = mesh.children.find(child => child.userData.isHealthBar);
    if (oldBar) mesh.remove(oldBar);

    // Create new health bar
    const barGeometry = new THREE.PlaneGeometry(30, 3);
    const barMaterial = new THREE.MeshBasicMaterial({
      color: healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000
    });
    const healthBar = new THREE.Mesh(barGeometry, barMaterial);
    healthBar.userData.isHealthBar = true;
    healthBar.position.y = 40;
    healthBar.scale.x = healthPercent;
    healthBar.lookAt(this.camera.position);
    mesh.add(healthBar);
  }

  getEntityAtPosition(x: number, y: number, container: HTMLElement): string | null {
    // Convert screen coordinates to normalized device coordinates
    const rect = container.getBoundingClientRect();
    this.mouse.x = ((x - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((y - rect.top) / rect.height) * 2 + 1;

    // Update the raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Find intersections
    const meshes = Array.from(this.entityMeshes.values());
    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      return intersects[0].object.userData.entityId;
    }

    return null;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(container: HTMLElement) {
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = 1000;

    this.camera.left = (frustumSize * aspect) / -2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  dispose() {
    this.renderer.dispose();
    window.removeEventListener('resize', () => this.onWindowResize);
  }
}
