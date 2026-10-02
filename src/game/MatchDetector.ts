import { GridItemData, SpecialItemType } from '../utils/GameConstants';

export interface MatchResult {
    matchedIds: Set<string>;
    specialSpawns: { row: number; col: number; specialType: SpecialItemType; gemType: any }[];
    matchedTypesCount: Map<string, number>;
    scoreGained: number;
}

export class MatchDetector {
    static findMatches(grid: (GridItemData | null)[][]): MatchResult {
        const rows = grid.length;
        const cols = grid[0].length;
        const matchedIds = new Set<string>();
        const specialSpawns: { row: number; col: number; specialType: SpecialItemType; gemType: any }[] = [];
        const matchedTypesCount = new Map<string, number>();

        // 1. Horizontal Scan
        for (let r = 0; r < rows; r++) {
            let matchLen = 1;
            for (let c = 0; c < cols; c++) {
                const current = grid[r][c];
                const next = c < cols - 1 ? grid[r][c + 1] : null;

                if (current && next && current.type === next.type && current.special === 'none' && next.special === 'none') {
                    matchLen++;
                } else {
                    if (matchLen >= 3) {
                        for (let k = c - matchLen + 1; k <= c; k++) {
                            const item = grid[r][k];
                            if (item) {
                                matchedIds.add(item.id);
                                matchedTypesCount.set(item.type, (matchedTypesCount.get(item.type) || 0) + 1);
                            }
                        }

                        // Spawn Special Booster on 4 or 5 match
                        const centerCol = c - Math.floor(matchLen / 2);
                        const gemType = grid[r][centerCol]!.type;
                        if (matchLen === 4) {
                            specialSpawns.push({ row: r, col: centerCol, specialType: 'rocket_h', gemType });
                        } else if (matchLen >= 5) {
                            specialSpawns.push({ row: r, col: centerCol, specialType: 'color_bomb', gemType });
                        }
                    }
                    matchLen = 1;
                }
            }
        }

        // 2. Vertical Scan
        for (let c = 0; c < cols; c++) {
            let matchLen = 1;
            for (let r = 0; r < rows; r++) {
                const current = grid[r][c];
                const next = r < rows - 1 ? grid[r + 1][c] : null;

                if (current && next && current.type === next.type && current.special === 'none' && next.special === 'none') {
                    matchLen++;
                } else {
                    if (matchLen >= 3) {
                        for (let k = r - matchLen + 1; k <= r; k++) {
                            const item = grid[k][c];
                            if (item) {
                                matchedIds.add(item.id);
                                matchedTypesCount.set(item.type, (matchedTypesCount.get(item.type) || 0) + 1);
                            }
                        }

                        const centerRow = r - Math.floor(matchLen / 2);
                        const gemType = grid[centerRow][c]!.type;
                        if (matchLen === 4) {
                            specialSpawns.push({ row: centerRow, col: c, specialType: 'rocket_v', gemType });
                        } else if (matchLen >= 5) {
                            specialSpawns.push({ row: centerRow, col: c, specialType: 'color_bomb', gemType });
                        }
                    }
                    matchLen = 1;
                }
            }
        }

        const scoreGained = matchedIds.size * 50 + specialSpawns.length * 150;

        return {
            matchedIds,
            specialSpawns,
            matchedTypesCount,
            scoreGained
        };
    }
}
