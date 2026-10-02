import * as THREE from 'three';
import { ROYAL_COLORS } from '../utils/GameConstants';

export class MenuScene {
    private scene: THREE.Scene;
    public showcaseGroup: THREE.Group = new THREE.Group();

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.createShowcaseMeshes();
    }

    private createShowcaseMeshes(): void {
        // 3D Crown Showcase
        const crownGeo = new THREE.CylinderGeometry(0.8, 0.4, 1.0, 8);
        const crownMat = new THREE.MeshStandardMaterial({
            color: ROYAL_COLORS.crown,
            metalness: 0.85,
            roughness: 0.2
        });
        const crownMesh = new THREE.Mesh(crownGeo, crownMat);
        crownMesh.position.set(0, 0.5, 0);
        this.showcaseGroup.add(crownMesh);

        // Orbiting Jewels
        const rubyGeo = new THREE.OctahedronGeometry(0.5, 0);
        const rubyMat = new THREE.MeshStandardMaterial({ color: ROYAL_COLORS.ruby, roughness: 0.2 });
        const rubyMesh = new THREE.Mesh(rubyGeo, rubyMat);
        rubyMesh.position.set(-2, 0.5, 1);
        this.showcaseGroup.add(rubyMesh);

        const sapphireGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
        const sapphireMat = new THREE.MeshStandardMaterial({ color: ROYAL_COLORS.sapphire, roughness: 0.2 });
        const sapphireMesh = new THREE.Mesh(sapphireGeo, sapphireMat);
        sapphireMesh.position.set(2, 0.5, 1);
        this.showcaseGroup.add(sapphireMesh);

        this.showcaseGroup.position.set(0, 0, 0);
        this.scene.add(this.showcaseGroup);
    }

    public update(): void {
        if (this.showcaseGroup.visible) {
            this.showcaseGroup.rotation.y += 0.01;
        }
    }

    public show(): void {
        this.showcaseGroup.visible = true;
    }

    public hide(): void {
        this.showcaseGroup.visible = false;
    }
}
