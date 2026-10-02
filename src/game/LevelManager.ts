import { GemType, LevelDefinition } from '../utils/GameConstants';

export class LevelManager {
    private static seededRandom(seed: number): () => number {
        let s = seed;
        return () => {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };
    }

    static getLevel(levelNumber: number): LevelDefinition {
        const lvl = Math.max(1, Math.min(60, levelNumber));
        const random = this.seededRandom(lvl * 777 + 13);

        let rows = 6;
        let cols = 6;
        let maxMoves = 20;
        let availableGems: GemType[] = ['ruby', 'sapphire', 'emerald'];
        let specialCount = 0;

        if (lvl <= 15) {
            // Easy (1-15)
            rows = 6;
            cols = 6;
            maxMoves = 22 - Math.floor(lvl / 3);
            availableGems = lvl <= 5 ? ['ruby', 'sapphire', 'emerald'] : ['ruby', 'sapphire', 'emerald', 'topaz'];
        } else if (lvl <= 35) {
            // Medium (16-35)
            rows = 7;
            cols = 7;
            maxMoves = 20 - Math.floor((lvl - 15) / 4);
            availableGems = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst'];
            specialCount = 1 + Math.floor(random() * 2);
        } else {
            // Hard (36-60)
            rows = 8;
            cols = 8;
            maxMoves = 18 - Math.floor((lvl - 35) / 5);
            availableGems = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'crown'];
            specialCount = 2 + Math.floor(random() * 3);
        }

        // Build target goals
        const goals = [
            { targetType: availableGems[0], requiredCount: 8 + Math.floor(lvl * 0.8), currentCount: 0 },
            { targetType: availableGems[1], requiredCount: 6 + Math.floor(lvl * 0.6), currentCount: 0 }
        ];

        if (availableGems.includes('crown') && lvl >= 20) {
            goals.push({ targetType: 'crown', requiredCount: 3 + Math.floor((lvl - 20) / 10), currentCount: 0 });
        }

        return {
            levelNumber: lvl,
            gridRows: rows,
            gridCols: cols,
            maxMoves,
            availableGems,
            goals,
            specialCount
        };
    }
}
