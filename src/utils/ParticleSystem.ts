import * as THREE from 'three';
import { ROYAL_COLORS } from './GameConstants';

export class ParticleSystem {
    private scene: THREE.Scene;
    private particleGroup: THREE.Group = new THREE.Group();
    private activeSystems: { points: THREE.Points; velocities: THREE.Vector3[]; age: number; maxAge: number }[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.scene.add(this.particleGroup);
    }

    // 1. Gem Match Burst Effect
    public createMatchBurst(position: THREE.Vector3, colorHex: number): void {
        const count = 30;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const velocities: THREE.Vector3[] = [];

        const baseColor = new THREE.Color(colorHex);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;

            colors[i * 3] = baseColor.r;
            colors[i * 3 + 1] = baseColor.g;
            colors[i * 3 + 2] = baseColor.b;

            // Random explosion velocity vector
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.random() * Math.PI;
            const speed = Math.random() * 0.15 + 0.05;

            velocities.push(new THREE.Vector3(
                speed * Math.sin(theta) * Math.cos(phi),
                speed * Math.sin(theta) * Math.sin(phi),
                speed * Math.cos(theta)
            ));
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.22,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending
        });

        const points = new THREE.Points(geometry, material);
        this.particleGroup.add(points);
        this.activeSystems.push({ points, velocities, age: 0, maxAge: 0.8 });
    }

    // 2. TNT Blast Explosion Effect
    public createExplosion(position: THREE.Vector3): void {
        const count = 100;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const velocities: THREE.Vector3[] = [];

        const explosionPalette = [ROYAL_COLORS.tnt, ROYAL_COLORS.ruby, ROYAL_COLORS.topaz];

        for (let i = 0; i < count; i++) {
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;

            const c = new THREE.Color(explosionPalette[Math.floor(Math.random() * explosionPalette.length)]);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;

            const speed = Math.random() * 0.35 + 0.1;
            const dir = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 1.5 + 0.5,
                (Math.random() - 0.5) * 2
            ).normalize().multiplyScalar(speed);

            velocities.push(dir);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.35,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending
        });

        const points = new THREE.Points(geometry, material);
        this.particleGroup.add(points);
        this.activeSystems.push({ points, velocities, age: 0, maxAge: 1.2 });
    }

    // 3. Rocket Line Trail Effect
    public createRocketTrail(startPos: THREE.Vector3, isHorizontal: boolean): void {
        const count = 40;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const velocities: THREE.Vector3[] = [];

        const c = new THREE.Color(ROYAL_COLORS.rocket);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = startPos.x;
            positions[i * 3 + 1] = startPos.y;
            positions[i * 3 + 2] = startPos.z;

            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;

            const speed = (Math.random() - 0.5) * 0.4;
            const vx = isHorizontal ? speed : (Math.random() - 0.5) * 0.05;
            const vz = !isHorizontal ? speed : (Math.random() - 0.5) * 0.05;

            velocities.push(new THREE.Vector3(vx, 0.02, vz));
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 0.25,
            vertexColors: true,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending
        });

        const points = new THREE.Points(geometry, material);
        this.particleGroup.add(points);
        this.activeSystems.push({ points, velocities, age: 0, maxAge: 0.6 });
    }

    // Animation Update
    public update(deltaTime: number): void {
        for (let i = this.activeSystems.length - 1; i >= 0; i--) {
            const sys = this.activeSystems[i];
            sys.age += deltaTime;

            const posAttr = sys.points.geometry.attributes.position as THREE.BufferAttribute;
            const positions = posAttr.array as Float32Array;

            for (let j = 0; j < sys.velocities.length; j++) {
                positions[j * 3] += sys.velocities[j].x;
                positions[j * 3 + 1] += sys.velocities[j].y;
                positions[j * 3 + 2] += sys.velocities[j].z;

                // Apply slight gravity
                sys.velocities[j].y -= 0.002;
            }

            posAttr.needsUpdate = true;
            (sys.points.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - sys.age / sys.maxAge);

            if (sys.age >= sys.maxAge) {
                this.particleGroup.remove(sys.points);
                sys.points.geometry.dispose();
                (sys.points.material as THREE.Material).dispose();
                this.activeSystems.splice(i, 1);
            }
        }
    }

    public clear(): void {
        while (this.particleGroup.children.length > 0) {
            const child = this.particleGroup.children[0];
            this.particleGroup.remove(child);
        }
        this.activeSystems = [];
    }
}
