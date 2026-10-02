export type GemType = 'ruby' | 'sapphire' | 'emerald' | 'topaz' | 'amethyst' | 'crown';
export type SpecialItemType = 'none' | 'rocket_h' | 'rocket_v' | 'tnt' | 'color_bomb';

export interface GridPos {
    row: number;
    col: number;
}

export interface GridItemData {
    id: string;
    type: GemType;
    special: SpecialItemType;
    row: number;
    col: number;
    targetRow: number;
    targetCol: number;
}

export interface LevelGoal {
    targetType: GemType;
    requiredCount: number;
    currentCount: number;
}

export interface LevelDefinition {
    levelNumber: number;
    gridRows: number;
    gridCols: number;
    maxMoves: number;
    availableGems: GemType[];
    goals: LevelGoal[];
    specialCount: number;
}

export const ROYAL_COLORS = {
    ruby: 0xef4444,       // Crimson Red
    sapphire: 0x3b82f6,   // Royal Blue
    emerald: 0x10b981,    // Bright Green
    topaz: 0xf59e0b,      // Amber Gold
    amethyst: 0x9333ea,   // Deep Purple
    crown: 0xfcd34d,      // Golden Yellow
    rocket: 0x38bdf8,     // Sky Blue
    tnt: 0xf97316,        // Explosive Orange
    colorBomb: 0xec4899,  // Magenta Orb
    gridTile: 0x1e293b,   // Slate Dark
    highlight: 0xf59e0b
};
