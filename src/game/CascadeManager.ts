import { GemType, GridItemData } from '../utils/GameConstants';
import { ParticleSystem } from '../utils/ParticleSystem';
import { GridManager } from './GridManager';
import { MatchDetector } from './MatchDetector';
import { SpecialItemManager } from './SpecialItemManager';

export class CascadeManager {
    static async processCascade(
        gridManager: GridManager,
        particleSystem: ParticleSystem,
        availableGems: GemType[],
        onMatchCallback?: (matchedCountMap: Map<string, number>, totalCleared: number) => void
    ): Promise<number> {
        let totalScore = 0;
        let hasMatches = true;

        while (hasMatches) {
            // 1. Detect matches
            const matchResult = MatchDetector.findMatches(gridManager.gridData);
            if (matchResult.matchedIds.size === 0) {
                hasMatches = false;
                break;
            }

            totalScore += matchResult.scoreGained;

            if (onMatchCallback) {
                onMatchCallback(matchResult.matchedTypesCount, matchResult.matchedIds.size);
            }

            // Check for special item activations among matched items
            const allClearedIds = new Set<string>(matchResult.matchedIds);
            matchResult.matchedIds.forEach((id) => {
                for (let r = 0; r < gridManager.rows; r++) {
                    for (let c = 0; c < gridManager.cols; c++) {
                        const item = gridManager.gridData[r][c];
                        if (item && item.id === id && item.special !== 'none') {
                            const specCleared = SpecialItemManager.activateSpecialItem(item, gridManager, particleSystem);
                            specCleared.forEach((sId) => allClearedIds.add(sId));
                        }
                    }
                }
            });

            // 2. Remove matched items from grid and spawn particle burst
            for (let r = 0; r < gridManager.rows; r++) {
                for (let c = 0; c < gridManager.cols; c++) {
                    const item = gridManager.gridData[r][c];
                    if (item && allClearedIds.has(item.id)) {
                        const worldPos = gridManager.gridToWorld(r, c);
                        particleSystem.createMatchBurst(worldPos, 0xffffff);
                        gridManager.removeItem(item.id);
                        gridManager.gridData[r][c] = null;
                    }
                }
            }

            // 3. Apply Gravity (Drop items down)
            for (let c = 0; c < gridManager.cols; c++) {
                let emptyRow = gridManager.rows - 1;
                for (let r = gridManager.rows - 1; r >= 0; r--) {
                    if (gridManager.gridData[r][c] !== null) {
                        if (r !== emptyRow) {
                            const item = gridManager.gridData[r][c]!;
                            item.row = emptyRow;
                            item.targetRow = emptyRow;
                            gridManager.gridData[emptyRow][c] = item;
                            gridManager.gridData[r][c] = null;
                        }
                        emptyRow--;
                    }
                }
            }

            // 4. Refill empty cells at top
            for (let r = 0; r < gridManager.rows; r++) {
                for (let c = 0; c < gridManager.cols; c++) {
                    if (gridManager.gridData[r][c] === null) {
                        const gemType = availableGems[Math.floor(Math.random() * availableGems.length)];
                        const newItem: GridItemData = {
                            id: `gem_${r}_${c}_${Math.random().toString(36).substring(2, 7)}`,
                            type: gemType,
                            special: 'none',
                            row: r,
                            col: c,
                            targetRow: r,
                            targetCol: c
                        };

                        gridManager.gridData[r][c] = newItem;
                        const group = gridManager.spawnItemMesh(newItem);
                        // Spawn higher up for fall animation
                        group.position.y += 3;
                    }
                }
            }

            // Brief delay for visual drop animation
            await new Promise((resolve) => setTimeout(resolve, 250));
        }

        return totalScore;
    }
}
