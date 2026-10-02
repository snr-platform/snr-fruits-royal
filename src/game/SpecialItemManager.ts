import { ParticleSystem } from '../utils/ParticleSystem';
import { GridItemData, SpecialItemType } from '../utils/GameConstants';
import { GridManager } from './GridManager';

export class SpecialItemManager {
    static activateSpecialItem(
        item: GridItemData,
        gridManager: GridManager,
        particleSystem: ParticleSystem
    ): Set<string> {
        const clearedIds = new Set<string>();
        const rows = gridManager.rows;
        const cols = gridManager.cols;

        const worldPos = gridManager.gridToWorld(item.row, item.col);

        if (item.special === 'rocket_h') {
            // Clear entire row
            particleSystem.createRocketTrail(worldPos, true);
            for (let c = 0; c < cols; c++) {
                const target = gridManager.gridData[item.row][c];
                if (target) clearedIds.add(target.id);
            }
        } else if (item.special === 'rocket_v') {
            // Clear entire column
            particleSystem.createRocketTrail(worldPos, false);
            for (let r = 0; r < rows; r++) {
                const target = gridManager.gridData[r][item.col];
                if (target) clearedIds.add(target.id);
            }
        } else if (item.special === 'tnt') {
            // 3x3 Radius Explosion
            particleSystem.createExplosion(worldPos);
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const r = item.row + dr;
                    const c = item.col + dc;
                    if (r >= 0 && r < rows && c >= 0 && c < cols) {
                        const target = gridManager.gridData[r][c];
                        if (target) clearedIds.add(target.id);
                    }
                }
            }
        } else if (item.special === 'color_bomb') {
            // Clear all items of same type
            particleSystem.createExplosion(worldPos);
            const targetType = item.type;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const target = gridManager.gridData[r][c];
                    if (target && (target.type === targetType || target.special !== 'none')) {
                        clearedIds.add(target.id);
                    }
                }
            }
        }

        return clearedIds;
    }
}
