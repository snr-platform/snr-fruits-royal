import * as THREE from 'three';
import { GridManager } from '../game/GridManager';
import { CascadeManager } from '../game/CascadeManager';
import { LevelManager } from '../game/LevelManager';
import { ParticleSystem } from '../utils/ParticleSystem';
import { GridPos, LevelDefinition, LevelGoal } from '../utils/GameConstants';
import { UIManager } from '../ui/UIManager';
import { Storage } from '../utils/Storage';
import { AdManager } from '../ads/AdManager';

export class GameScene {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private uiManager: UIManager;

    public gridManager: GridManager;
    public particleSystem: ParticleSystem;

    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();

    public currentLevelDef!: LevelDefinition;
    public movesCount: number = 0;
    public currentScore: number = 0;
    public isBusy: boolean = false;
    public selectedPos: GridPos | null = null;
    public active: boolean = false;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, uiManager: UIManager) {
        this.scene = scene;
        this.camera = camera;
        this.uiManager = uiManager;

        this.gridManager = new GridManager(this.scene);
        this.particleSystem = new ParticleSystem(this.scene);

        this.setupTouchInput();
    }

    public startLevel(levelNum: number): void {
        this.active = true;
        this.currentLevelDef = LevelManager.getLevel(levelNum);
        this.movesCount = 0;
        this.currentScore = 0;
        this.isBusy = false;
        this.selectedPos = null;

        this.gridManager.initGrid(
            this.currentLevelDef.gridRows,
            this.currentLevelDef.gridCols,
            this.currentLevelDef.availableGems
        );

        this.updateHUD();
        this.uiManager.hud.show();
    }

    private setupTouchInput(): void {
        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            if (!this.active || this.isBusy) return;

            let clientX = 0;
            let clientY = 0;
            if (event instanceof MouseEvent) {
                clientX = event.clientX;
                clientY = event.clientY;
            } else if (event.touches && event.touches.length > 0) {
                clientX = event.touches[0].clientX;
                clientY = event.touches[0].clientY;
            }

            this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children, true);

            for (const hit of intersects) {
                let parentGroup: THREE.Object3D | null = hit.object;
                while (parentGroup && parentGroup.parent && parentGroup.parent !== this.scene) {
                    if (parentGroup.userData && parentGroup.userData.row !== undefined) {
                        break;
                    }
                    parentGroup = parentGroup.parent;
                }

                if (parentGroup && parentGroup.userData && parentGroup.userData.row !== undefined) {
                    const row = parentGroup.userData.row as number;
                    const col = parentGroup.userData.col as number;
                    this.handleCellSelect({ row, col });
                    break;
                }
            }
        };

        window.addEventListener('click', onPointerDown);
        window.addEventListener('touchstart', onPointerDown, { passive: true });
    }

    private async handleCellSelect(pos: GridPos): Promise<void> {
        if (!this.selectedPos) {
            this.selectedPos = pos;
            this.gridManager.setSelectedCell(pos);
        } else {
            const prev = this.selectedPos;
            this.selectedPos = null;
            this.gridManager.setSelectedCell(null);

            // Check adjacency
            const dRow = Math.abs(pos.row - prev.row);
            const dCol = Math.abs(pos.col - prev.col);

            if ((dRow === 1 && dCol === 0) || (dRow === 0 && dCol === 1)) {
                await this.attemptSwap(prev, pos);
            } else {
                // Select new cell instead
                this.selectedPos = pos;
                this.gridManager.setSelectedCell(pos);
            }
        }
    }

    private async attemptSwap(pos1: GridPos, pos2: GridPos): Promise<void> {
        this.isBusy = true;
        this.gridManager.swapItems(pos1, pos2);

        // Process cascade matching
        const scoreGained = await CascadeManager.processCascade(
            this.gridManager,
            this.particleSystem,
            this.currentLevelDef.availableGems,
            (matchedMap) => {
                matchedMap.forEach((count, type) => {
                    const goal = this.currentLevelDef.goals.find((g: LevelGoal) => g.targetType === type);
                    if (goal) goal.currentCount = Math.min(goal.requiredCount, goal.currentCount + count);
                });
            }
        );

        if (scoreGained > 0) {
            this.movesCount++;
            this.currentScore += scoreGained;
            this.updateHUD();
            this.checkLevelEndConditions();
        } else {
            // Revert swap if no match produced
            await new Promise((resolve) => setTimeout(resolve, 200));
            this.gridManager.swapItems(pos1, pos2);
        }

        this.isBusy = false;
    }

    private checkLevelEndConditions(): void {
        const goalsCompleted = this.currentLevelDef.goals.every((g: LevelGoal) => g.currentCount >= g.requiredCount);

        if (goalsCompleted) {
            this.handleVictory();
        } else if (this.movesCount >= this.currentLevelDef.maxMoves) {
            this.handleDefeat();
        }
    }

    private handleVictory(): void {
        this.active = false;
        const stars = this.calculateStarRating();
        Storage.saveLevelProgress(this.currentLevelDef.levelNumber, stars, this.currentScore);

        // Show Interstitial Ad every 3 levels
        if (this.currentLevelDef.levelNumber % 3 === 0) {
            AdManager.showInterstitial();
        }

        this.uiManager.victoryModal.show(this.currentLevelDef.levelNumber, this.currentScore, stars, true);
    }

    private handleDefeat(): void {
        this.active = false;
        this.uiManager.defeatModal.show();
    }

    private calculateStarRating(): number {
        const movesLeft = this.currentLevelDef.maxMoves - this.movesCount;
        if (movesLeft >= 6) return 3;
        if (movesLeft >= 2) return 2;
        return 1;
    }

    public addExtraMoves(count: number = 5): void {
        this.currentLevelDef.maxMoves += count;
        this.updateHUD();
        this.active = true;
    }

    private updateHUD(): void {
        this.uiManager.hud.render(
            this.currentLevelDef.levelNumber,
            this.movesCount,
            this.currentLevelDef.maxMoves,
            this.currentScore,
            this.currentLevelDef.goals
        );
    }

    public update(delta: number): void {
        if (this.active) {
            this.gridManager.updateMeshPositions();
            this.particleSystem.update(delta);
        }
    }

    public stop(): void {
        this.active = false;
        this.gridManager.clearGrid();
    }
}
