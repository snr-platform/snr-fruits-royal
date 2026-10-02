import * as THREE from 'three';
import { GemType, GridItemData, GridPos, ROYAL_COLORS, SpecialItemType } from '../utils/GameConstants';

export class GridManager {
    public scene: THREE.Scene;
    public gridGroup: THREE.Group = new THREE.Group();
    public itemMeshes: Map<string, THREE.Group> = new Map();
    public gridData: (GridItemData | null)[][] = [];

    public rows: number = 6;
    public cols: number = 6;
    public tileSize: number = 1.1;

    private selectionMesh: THREE.Mesh | null = null;
    private selectedPos: GridPos | null = null;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.scene.add(this.gridGroup);
        this.setupSelectionMesh();
    }

    private setupSelectionMesh(): void {
        const geo = new THREE.RingGeometry(0.5, 0.58, 32);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
            color: ROYAL_COLORS.topaz,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0
        });
        this.selectionMesh = new THREE.Mesh(geo, mat);
        this.gridGroup.add(this.selectionMesh);
    }

    public initGrid(rows: number, cols: number, availableGems: GemType[]): void {
        this.clearGrid();
        this.rows = rows;
        this.cols = cols;
        this.gridData = Array.from({ length: rows }, () => Array(cols).fill(null));

        this.createGridBasePlate();

        // Populate grid ensuring NO initial 3-in-a-row matches!
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let type: GemType;
                do {
                    type = availableGems[Math.floor(Math.random() * availableGems.length)];
                } while (
                    (r >= 2 && this.gridData[r - 1][c]?.type === type && this.gridData[r - 2][c]?.type === type) ||
                    (c >= 2 && this.gridData[r][c - 1]?.type === type && this.gridData[r][c - 2]?.type === type)
                );

                const item: GridItemData = {
                    id: `gem_${r}_${c}_${Math.random().toString(36).substring(2, 7)}`,
                    type,
                    special: 'none',
                    row: r,
                    col: c,
                    targetRow: r,
                    targetCol: c
                };

                this.gridData[r][c] = item;
                this.spawnItemMesh(item);
            }
        }
    }

    private createGridBasePlate(): void {
        const width = this.cols * this.tileSize;
        const height = this.rows * this.tileSize;

        // Base Board
        const baseGeo = new THREE.BoxGeometry(width + 0.4, 0.3, height + 0.4);
        const baseMat = new THREE.MeshStandardMaterial({
            color: ROYAL_COLORS.gridTile,
            roughness: 0.4,
            metalness: 0.6
        });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.set(0, -0.2, 0);
        baseMesh.receiveShadow = true;
        this.gridGroup.add(baseMesh);

        // Individual Cell Outlines
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const pos = this.gridToWorld(r, c);
                const tileGeo = new THREE.BoxGeometry(this.tileSize * 0.94, 0.05, this.tileSize * 0.94);
                const tileMat = new THREE.MeshStandardMaterial({
                    color: (r + c) % 2 === 0 ? 0x1e293b : 0x0f172a,
                    roughness: 0.5
                });
                const tileMesh = new THREE.Mesh(tileGeo, tileMat);
                tileMesh.position.set(pos.x, -0.02, pos.z);
                tileMesh.receiveShadow = true;
                this.gridGroup.add(tileMesh);
            }
        }
    }

    public gridToWorld(row: number, col: number): THREE.Vector3 {
        const offsetX = -((this.cols - 1) * this.tileSize) / 2;
        const offsetZ = -((this.rows - 1) * this.tileSize) / 2;
        return new THREE.Vector3(offsetX + col * this.tileSize, 0.3, offsetZ + row * this.tileSize);
    }

    public spawnItemMesh(item: GridItemData): THREE.Group {
        const group = new THREE.Group();
        group.name = item.id;

        let geometry: THREE.BufferGeometry;
        let colorHex = ROYAL_COLORS[item.type] || 0xffffff;

        // Build 3D Shape
        if (item.special === 'rocket_h' || item.special === 'rocket_v') {
            geometry = new THREE.ConeGeometry(0.35, 0.8, 16);
            colorHex = ROYAL_COLORS.rocket;
        } else if (item.special === 'tnt') {
            geometry = new THREE.BoxGeometry(0.7, 0.7, 0.7);
            colorHex = ROYAL_COLORS.tnt;
        } else if (item.special === 'color_bomb') {
            geometry = new THREE.IcosahedronGeometry(0.42, 1);
            colorHex = ROYAL_COLORS.colorBomb;
        } else {
            switch (item.type) {
                case 'ruby':
                    geometry = new THREE.OctahedronGeometry(0.45, 0);
                    break;
                case 'sapphire':
                    geometry = new THREE.BoxGeometry(0.68, 0.68, 0.68);
                    break;
                case 'emerald':
                    geometry = new THREE.CylinderGeometry(0.38, 0.38, 0.7, 6);
                    break;
                case 'topaz':
                    geometry = new THREE.SphereGeometry(0.42, 24, 24);
                    break;
                case 'amethyst':
                    geometry = new THREE.DodecahedronGeometry(0.4, 0);
                    break;
                case 'crown':
                    geometry = new THREE.CylinderGeometry(0.45, 0.25, 0.6, 8);
                    colorHex = ROYAL_COLORS.crown;
                    break;
                default:
                    geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
            }
        }

        const material = new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.25,
            metalness: item.type === 'crown' ? 0.8 : 0.4
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { id: item.id, row: item.row, col: item.col };
        group.add(mesh);

        // Decorative Special Indicator Ring
        if (item.special !== 'none') {
            const ringGeo = new THREE.TorusGeometry(0.42, 0.05, 12, 24);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotateX(Math.PI / 2);
            group.add(ringMesh);
        }

        const worldPos = this.gridToWorld(item.row, item.col);
        group.position.copy(worldPos);

        this.scene.add(group);
        this.itemMeshes.set(item.id, group);
        return group;
    }

    public setSelectedCell(pos: GridPos | null): void {
        this.selectedPos = pos;
        if (this.selectionMesh) {
            if (pos) {
                const worldPos = this.gridToWorld(pos.row, pos.col);
                this.selectionMesh.position.set(worldPos.x, 0.05, worldPos.z);
                (this.selectionMesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
            } else {
                (this.selectionMesh.material as THREE.MeshBasicMaterial).opacity = 0;
            }
        }
    }

    public swapItems(pos1: GridPos, pos2: GridPos): void {
        const item1 = this.gridData[pos1.row][pos1.col];
        const item2 = this.gridData[pos2.row][pos2.col];

        if (!item1 || !item2) return;

        // Swap data
        item1.row = pos2.row;
        item1.col = pos2.col;
        item1.targetRow = pos2.row;
        item1.targetCol = pos2.col;

        item2.row = pos1.row;
        item2.col = pos1.col;
        item2.targetRow = pos1.row;
        item2.targetCol = pos1.col;

        this.gridData[pos1.row][pos1.col] = item2;
        this.gridData[pos2.row][pos2.col] = item1;

        // Update 3D Positions
        const group1 = this.itemMeshes.get(item1.id);
        const group2 = this.itemMeshes.get(item2.id);

        if (group1) group1.position.copy(this.gridToWorld(pos2.row, pos2.col));
        if (group2) group2.position.copy(this.gridToWorld(pos1.row, pos1.col));
    }

    public removeItem(id: string): void {
        const group = this.itemMeshes.get(id);
        if (group) {
            this.scene.remove(group);
            group.children.forEach((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach((m) => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.itemMeshes.delete(id);
        }
    }

    public updateMeshPositions(): void {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const item = this.gridData[r][c];
                if (item) {
                    const group = this.itemMeshes.get(item.id);
                    if (group) {
                        const targetPos = this.gridToWorld(r, c);
                        group.position.lerp(targetPos, 0.35);
                    }
                }
            }
        }
    }

    public clearGrid(): void {
        this.itemMeshes.forEach((group) => this.scene.remove(group));
        this.itemMeshes.clear();
        this.gridData = [];

        while (this.gridGroup.children.length > 0) {
            const child = this.gridGroup.children[0];
            this.gridGroup.remove(child);
        }
        this.setupSelectionMesh();
    }
}
