// ============================================================
//  ROYAL GEMS – 2D Match-3 Game Engine
//  Face-forward canvas, real gem sprites, goals + obstacles
// ============================================================

import { EconomyManager } from './utils/EconomyManager';
import { EconomyUI } from './ui/EconomyUI';
import { BonusItemManager } from './game/BonusItemManager';
import { AdManager } from './ads/AdManager';

// ──────────────────────────────────────────────────────────────
// SOUNDS
// ──────────────────────────────────────────────────────────────
const SOUND_PATHS = {
    match3: '/SOUND/1.mp3',
    match4: '/SOUND/2.mp3',
    combo: '/SOUND/combo.mp3',
    levelPassed: '/SOUND/LEVEL-PASSED.mp3',
    gameOver: '/SOUND/game-over.mp3',
    startGame: '/SOUND/start-game.mp3',
} as const;

const SOUNDS: Partial<Record<keyof typeof SOUND_PATHS, HTMLAudioElement>> = {};

function playSound(type: keyof typeof SOUND_PATHS) {
    if (!SOUNDS[type]) {
        SOUNDS[type] = new Audio(SOUND_PATHS[type]);
    }
    const s = SOUNDS[type]!;
    s.currentTime = 0;
    try {
        s.play().catch(() => { }); // prevent uncaught promise errors if audio context blocked
    } catch (e) { }
}

// Level Background Music System (20 track files in /SOUND/level-sound/1.mp3 to 20.mp3)
const LEVEL_MUSIC_PATHS: string[] = Array.from({ length: 20 }, (_, i) => `/SOUND/level-sound/${i + 1}.mp3`);
let currentLevelBgmAudio: HTMLAudioElement | null = null;
let lastPlayedTrackIdx: number = -1;

function playLevelBgm() {
    stopLevelBgm();

    // 1. Random Selection (Never play same track twice in a row)
    let nextIdx: number;
    do {
        nextIdx = Math.floor(Math.random() * LEVEL_MUSIC_PATHS.length);
    } while (nextIdx === lastPlayedTrackIdx && LEVEL_MUSIC_PATHS.length > 1);

    lastPlayedTrackIdx = nextIdx;
    const trackPath = LEVEL_MUSIC_PATHS[nextIdx];

    try {
        const audio = new Audio(trackPath);
        audio.loop = true;  // 2. Looping continuously until level ends
        audio.volume = 0.5; // 5. Volume control at 50%
        audio.play().catch(() => { }); // 6. Fallback if audio fails to load or blocked
        currentLevelBgmAudio = audio;
    } catch (e) {
        // Fallback: continue game without music
    }
}

function stopLevelBgm() {
    if (currentLevelBgmAudio) {
        try {
            currentLevelBgmAudio.pause();
            currentLevelBgmAudio.currentTime = 0;
        } catch (e) { }
        currentLevelBgmAudio = null;
    }
}

// ──────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────
type GemId = number;  // maps to /src/icons/N.png

interface Cell {
    gem: GemId | null;      // null = empty during fall
    obstacle: 'none' | 'ice' | 'stone' | 'chain' | 'marble';   // tile overlay
    iceHp: number;          // 1 or 2 hits needed
    chainHp: number;
    marbleHp: number;       // 1 to 3 hits needed for marble
    special: 'none' | 'hbomb' | 'vbomb' | 'bomb' | 'disco' | 'crown' | 'key';  // boosters & treasures
    // animation state
    x: number; y: number;   // current pixel positions
    tx: number; ty: number; // target pixel positions
    scale: number;
    alpha: number;
    shake: number;
    selected: boolean;
    matched: boolean;
    active: boolean;
}

interface LevelDef {
    id: number;
    rows: number;
    cols: number;
    moves: number;
    gems: GemId[];        // which gem types appear
    goals: Goal[];
    obstacles: ObstacleDef[];
    bg: string;           // background image URL path
    timeLimit?: number;   // For survival/time-attack mode
    gridMask?: number[][]; // Custom grid shape: 1=active, 0=empty space
}

interface Goal {
    type: 'gem' | 'ice' | 'stone' | 'chain' | 'marble' | 'score' | 'treasure';
    gem?: GemId; // Only required if type === 'gem'
    required: number;
    collected: number;
}

interface ObstacleDef {
    row: number; col: number;
    type: 'ice' | 'stone' | 'chain' | 'marble';
    hp?: number;
}

// ──────────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────────
const ANIM_SPEED = 0.22;     // lerp factor
const DROP_SPEED = 0.28;
const CELL_PAD = 4;
const SCORE_PER_GEM = 60;
const SCORE_COMBO = 30;

// Curated bright solid colors for backgrounds
const SOLID_COLORS = [
    '#ffffff', // White
    '#f472b6', // Light Pink
    '#ef4444', // Red
    '#22c55e', // Green
    '#3bf6aeff', // Blue
    '#9c84d3ff', // Violet
    '#eab308', // Yellow
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#d946ef', // Fuchsia
    '#84cc16', // Lime
    '#10b981', // Emerald
    '#63c4f1b5', // Indigo
    '#d5f535ff', // Purple
];

// ──────────────────────────────────────────────────────────────
// LEVEL SHAPES (All 100 Levels)
// ──────────────────────────────────────────────────────────────
const LEVEL_SHAPES: Record<number, { shape: string; rows: number; cols: number }> = {
    // World 1: Levels 1-20 (Royal Garden)
    1: { shape: 'square', rows: 6, cols: 6 },
    2: { shape: 'square', rows: 6, cols: 6 },
    3: { shape: 'rectangle', rows: 6, cols: 8 },
    4: { shape: 'rectangle', rows: 8, cols: 6 },
    5: { shape: 'diamond', rows: 7, cols: 7 },
    6: { shape: 'square', rows: 7, cols: 7 },
    7: { shape: 'square', rows: 7, cols: 7 },
    8: { shape: 'rectangle', rows: 7, cols: 8 },
    9: { shape: 'rectangle', rows: 8, cols: 7 },
    10: { shape: 'diamond', rows: 8, cols: 8 },
    11: { shape: 'circle', rows: 7, cols: 7 },
    12: { shape: 'square', rows: 8, cols: 8 },
    13: { shape: 'square', rows: 8, cols: 8 },
    14: { shape: 'hexagon', rows: 7, cols: 7 },
    15: { shape: 'diamond', rows: 8, cols: 8 },
    16: { shape: 'square', rows: 8, cols: 8 },
    17: { shape: 'circle', rows: 8, cols: 8 },
    18: { shape: 'rectangle', rows: 8, cols: 8 },
    19: { shape: 'hexagon', rows: 8, cols: 8 },
    20: { shape: 'square', rows: 8, cols: 8 },

    // World 2: Levels 21-40 (Crystal Caves)
    21: { shape: 'square', rows: 7, cols: 7 },
    22: { shape: 'pentagon', rows: 7, cols: 7 },
    23: { shape: 'square', rows: 7, cols: 7 },
    24: { shape: 'hexagon', rows: 7, cols: 7 },
    25: { shape: 'square', rows: 8, cols: 8 },
    26: { shape: 'star', rows: 7, cols: 7 },
    27: { shape: 'square', rows: 8, cols: 8 },
    28: { shape: 'pentagon', rows: 8, cols: 8 },
    29: { shape: 'hexagon', rows: 8, cols: 8 },
    30: { shape: 'square', rows: 8, cols: 8 },
    31: { shape: 'diamond', rows: 8, cols: 8 },
    32: { shape: 'square', rows: 8, cols: 8 },
    33: { shape: 'star', rows: 8, cols: 8 },
    34: { shape: 'circle', rows: 8, cols: 8 },
    35: { shape: 'square', rows: 8, cols: 8 },
    36: { shape: 'hexagon', rows: 8, cols: 8 },
    37: { shape: 'pentagon', rows: 8, cols: 8 },
    38: { shape: 'square', rows: 8, cols: 8 },
    39: { shape: 'star', rows: 8, cols: 8 },
    40: { shape: 'square', rows: 8, cols: 8 },

    // World 3: Levels 41-60 (Fire Peaks)
    41: { shape: 'square', rows: 7, cols: 7 },
    42: { shape: 'triangle', rows: 7, cols: 7 },
    43: { shape: 'square', rows: 7, cols: 7 },
    44: { shape: 'arrow', rows: 7, cols: 7 },
    45: { shape: 'square', rows: 8, cols: 8 },
    46: { shape: 'lightning', rows: 7, cols: 7 },
    47: { shape: 'square', rows: 8, cols: 8 },
    48: { shape: 'triangle', rows: 8, cols: 8 },
    49: { shape: 'arrow', rows: 8, cols: 8 },
    50: { shape: 'square', rows: 8, cols: 8 },
    51: { shape: 'diamond', rows: 8, cols: 8 },
    52: { shape: 'square', rows: 8, cols: 8 },
    53: { shape: 'lightning', rows: 8, cols: 8 },
    54: { shape: 'circle', rows: 8, cols: 8 },
    55: { shape: 'square', rows: 8, cols: 8 },
    56: { shape: 'triangle', rows: 8, cols: 8 },
    57: { shape: 'arrow', rows: 8, cols: 8 },
    58: { shape: 'square', rows: 8, cols: 8 },
    59: { shape: 'lightning', rows: 8, cols: 8 },
    60: { shape: 'square', rows: 8, cols: 8 },

    // World 4: Levels 61-80 (Ocean Depths)
    61: { shape: 'square', rows: 7, cols: 7 },
    62: { shape: 'wave', rows: 7, cols: 7 },
    63: { shape: 'square', rows: 7, cols: 7 },
    64: { shape: 'circle', rows: 7, cols: 7 },
    65: { shape: 'square', rows: 8, cols: 8 },
    66: { shape: 'shell', rows: 7, cols: 7 },
    67: { shape: 'square', rows: 8, cols: 8 },
    68: { shape: 'wave', rows: 8, cols: 8 },
    69: { shape: 'circle', rows: 8, cols: 8 },
    70: { shape: 'square', rows: 8, cols: 8 },
    71: { shape: 'diamond', rows: 8, cols: 8 },
    72: { shape: 'square', rows: 8, cols: 8 },
    73: { shape: 'shell', rows: 8, cols: 8 },
    74: { shape: 'circle', rows: 8, cols: 8 },
    75: { shape: 'square', rows: 8, cols: 8 },
    76: { shape: 'wave', rows: 8, cols: 8 },
    77: { shape: 'square', rows: 8, cols: 8 },
    78: { shape: 'shell', rows: 8, cols: 8 },
    79: { shape: 'circle', rows: 8, cols: 8 },
    80: { shape: 'square', rows: 8, cols: 8 },

    // World 5: Levels 81-100 (Crown Palace)
    81: { shape: 'square', rows: 7, cols: 7 },
    82: { shape: 'crown', rows: 7, cols: 7 },
    83: { shape: 'square', rows: 7, cols: 7 },
    84: { shape: 'heart', rows: 7, cols: 7 },
    85: { shape: 'square', rows: 8, cols: 8 },
    86: { shape: 'shield', rows: 7, cols: 7 },
    87: { shape: 'square', rows: 8, cols: 8 },
    88: { shape: 'crown', rows: 8, cols: 8 },
    89: { shape: 'heart', rows: 8, cols: 8 },
    90: { shape: 'square', rows: 8, cols: 8 },
    91: { shape: 'diamond', rows: 8, cols: 8 },
    92: { shape: 'square', rows: 8, cols: 8 },
    93: { shape: 'shield', rows: 8, cols: 8 },
    94: { shape: 'crown', rows: 8, cols: 8 },
    95: { shape: 'square', rows: 8, cols: 8 },
    96: { shape: 'heart', rows: 8, cols: 8 },
    97: { shape: 'square', rows: 8, cols: 8 },
    98: { shape: 'shield', rows: 8, cols: 8 },
    99: { shape: 'crown', rows: 8, cols: 8 },
    100: { shape: 'square', rows: 8, cols: 8 },
};

function createShapeMask(shape: string, rows: number, cols: number): number[][] {
    const mask: number[][] = Array.from({ length: rows }, () => Array(cols).fill(1));
    const cr = (rows - 1) / 2;
    const cc = (cols - 1) / 2;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const nr = (r - cr) / (rows / 2);
            const nc = (c - cc) / (cols / 2);

            switch (shape) {
                case 'diamond':
                    if (Math.abs(nr) + Math.abs(nc) > 1.15) mask[r][c] = 0;
                    break;
                case 'circle':
                    if (nr * nr + nc * nc > 1.05) mask[r][c] = 0;
                    break;
                case 'triangle':
                    if (r < Math.floor(rows * 0.15) || Math.abs(c - cc) > (r + 1) * 0.6) mask[r][c] = 0;
                    break;
                case 'hexagon':
                    if (Math.abs(nr) + Math.abs(nc) > 1.35 || Math.abs(nc) > 0.9) mask[r][c] = 0;
                    break;
                case 'pentagon':
                    if (r === 0 && Math.abs(c - cc) > 1) mask[r][c] = 0;
                    if (r === 1 && Math.abs(c - cc) > 2) mask[r][c] = 0;
                    if (r === rows - 1 && (c === 0 || c === cols - 1)) mask[r][c] = 0;
                    break;
                case 'star':
                    const isCross = (Math.abs(r - Math.floor(cr)) <= 1) || (Math.abs(c - Math.floor(cc)) <= 1);
                    const isDiag = Math.abs(r - cr) === Math.abs(c - cc);
                    if (!isCross && !isDiag) mask[r][c] = 0;
                    break;
                case 'heart':
                    if (r === 0 && (c === 0 || c === Math.floor(cc) || c === cols - 1)) mask[r][c] = 0;
                    if (r >= rows - 2 && Math.abs(c - cc) > (rows - 1 - r)) mask[r][c] = 0;
                    break;
                case 'arrow':
                    if (r < Math.floor(rows / 2) && Math.abs(c - cc) > r + 1) mask[r][c] = 0;
                    if (r >= Math.floor(rows / 2) && Math.abs(c - cc) > 1) mask[r][c] = 0;
                    break;
                case 'lightning':
                    if (r < rows / 2 && c < Math.floor(cols / 2) - 1) mask[r][c] = 0;
                    if (r >= rows / 2 && c > Math.floor(cols / 2) + 1) mask[r][c] = 0;
                    break;
                case 'wave':
                    const waveC = Math.floor(cc + Math.sin(r * 0.8) * 1.8);
                    if (Math.abs(c - waveC) > 2) mask[r][c] = 0;
                    break;
                case 'shell':
                    if (r === 0 && (c < 1 || c > cols - 2)) mask[r][c] = 0;
                    if (r === rows - 1 && (c < 2 || c > cols - 3)) mask[r][c] = 0;
                    break;
                case 'crown':
                    if (r === 0 && (c % 2 === 1)) mask[r][c] = 0;
                    if (r === 1 && (c === 1 || c === cols - 2)) mask[r][c] = 0;
                    break;
                case 'shield':
                    if (r === 0 && (c === 0 || c === cols - 1)) mask[r][c] = 0;
                    if (r > rows / 2 && Math.abs(c - cc) > (rows - r)) mask[r][c] = 0;
                    break;
                case 'square':
                case 'rectangle':
                default:
                    break;
            }
        }
    }
    return mask;
}

export const WORLD_ICON_MAP: Record<number, number[]> = {
    1: [1, 3, 5, 7, 18, 21, 31, 34, 35, 52, 55, 60],        // 12 icons for World 1
    2: [2, 4, 8, 13, 15, 26, 28, 47, 54, 56, 59, 63],        // 12 icons for World 2
    3: [10, 16, 20, 22, 24, 27, 30, 33, 37, 39, 44, 51, 53], // 13 icons for World 3
    4: [6, 9, 11, 17, 19, 23, 25, 29, 48, 50, 58, 61, 62],   // 13 icons for World 4
    5: [12, 14, 32, 36, 38, 40, 41, 42, 43, 45, 46, 49, 57]  // 13 icons for World 5
};

// ──────────────────────────────────────────────────────────────
// LEVEL DEFINITIONS (100 levels across 5 worlds)
// ──────────────────────────────────────────────────────────────
function buildLevels(): LevelDef[] {
    const levels: LevelDef[] = [];

    for (let i = 1; i <= 100; i++) {
        const world = i <= 20 ? 0 : i <= 40 ? 1 : i <= 60 ? 2 : i <= 80 ? 3 : 4;
        const worldIdx = world + 1; // 1 to 5
        const diff = (i - 1) % 20;          // 0–19 within world
        const easy = diff < 7;
        const med = diff < 14;

        const shapeConfig = LEVEL_SHAPES[i] ?? { shape: 'square', rows: 7, cols: 7 };
        const rows = shapeConfig.rows;
        const cols = shapeConfig.cols;
        const moves = Math.max(10, 32 - Math.floor(diff * 1.1));

        // Generate custom grid shape mask
        const gridMask = createShapeMask(shapeConfig.shape, rows, cols);

        // Gem palette for this world
        const worldGems = WORLD_ICON_MAP[worldIdx] ?? [1, 3, 5, 7, 18, 21, 31, 34, 35, 52, 55, 60];
        const lRng = seeded(i * 1234 + 56);
        const shuffledGems = [...worldGems].sort(() => lRng() - 0.5);

        const gemCount = Math.min(shuffledGems.length, easy ? 5 : med ? 6 : 7);
        const gemPool = shuffledGems.slice(0, gemCount);

        // Goals
        const goalGems = gemPool.slice(0, easy ? 2 : med ? 3 : 4);
        const goalAmt = easy ? 12 + diff * 2 : med ? 18 + diff : 25 + diff;
        const goals: Goal[] = goalGems.map(g => ({ type: 'gem', gem: g, required: goalAmt, collected: 0 }));

        // Obstacles
        // Stone: only levels 50+ (very late game blocker)
        // Ice (glass): starts at level 10
        // Chain: starts at level 30
        // Marble: World 2 hard+
        const obstacles: ObstacleDef[] = [];
        const stoneCount = i >= 50 ? 2 + Math.floor((i - 50) / 3) : 0;
        const iceCount = i >= 10 ? (easy ? 1 : med ? 2 : 3 + diff - 14) : 0;
        const chainCount = i >= 30 ? (med ? 1 : 2) : 0;
        const marbleCount = world >= 1 && diff >= 10 ? 2 + Math.floor(diff / 4) : 0;

        // Optionally add obstacle goals (only require what we place)
        if (iceCount > 0 && Math.random() > 0.4) goals.push({ type: 'ice', required: iceCount, collected: 0 });
        if (stoneCount > 0 && Math.random() > 0.4) goals.push({ type: 'stone', required: stoneCount, collected: 0 });
        if (chainCount > 0 && Math.random() > 0.4) goals.push({ type: 'chain', required: chainCount, collected: 0 });
        if (marbleCount > 0 && Math.random() > 0.4) goals.push({ type: 'marble', required: marbleCount, collected: 0 });


        if (world === 2 && diff > 10) {
            goals.push({ type: 'treasure', required: 1, collected: 0 }); // drop crown!
        }

        const placed = new Set<string>();
        const rng = seeded(i * 997 + 7);
        const place = (n: number, type: ObstacleDef['type'], hp?: number) => {
            let tries = 0;
            while (n > 0 && tries < 200) {
                tries++;
                const r = Math.floor(rng() * rows);
                const c = Math.floor(rng() * cols);
                if (gridMask[r][c] === 0) continue; // Don't place on empty space
                const key = `${r},${c}`;
                if (!placed.has(key)) {
                    placed.add(key);
                    obstacles.push({ row: r, col: c, type, hp });
                    n--;
                }
            }
        };

        // ── World 1 (levels 1–20): Full-grid marble mechanic ──────────────
        // No gem goals. Every cell is covered by a marble stone (hp=1).
        // Win condition: break ALL marbles by matching gems on top of them.
        if (world === 0) {
            goals.length = 0; // clear gem goals
            let activeCells = 0;
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (gridMask[r][c] === 1) {
                        obstacles.push({ row: r, col: c, type: 'marble', hp: 1 });
                        activeCells++;
                    }
                }
            }
            goals.push({ type: 'marble', required: activeCells, collected: 0 });
        } else {
            // Standard obstacle placement for all other worlds
            place(stoneCount, 'stone');
            place(iceCount, 'ice', 2);
            place(chainCount, 'chain', 2);
            place(marbleCount, 'marble', 3);
        }

        // Assign a deterministic background color per level (seeded so same level = same bg)
        const bgRng = seeded(i * 4231 + 17);
        const bgIndex = Math.floor(bgRng() * SOLID_COLORS.length);

        levels.push({
            id: i, rows, cols, moves,
            gems: gemPool,
            goals,
            obstacles,
            bg: SOLID_COLORS[bgIndex],
            timeLimit: undefined,
            gridMask
        });
    }
    return levels;
}

function seeded(seed: number) {
    let s = seed;
    return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// ──────────────────────────────────────────────────────────────
// IMAGE LOADER
// ──────────────────────────────────────────────────────────────
const GEM_IMAGES: Map<number, HTMLImageElement> = new Map();

// Helper to generate a vibrant, high-res colored circle gem canvas image as a 100% reliable fallback
function createFallbackGemImage(id: number): HTMLImageElement {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext('2d')!;

    const palette = [
        '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
        '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#a855f7'
    ];
    const color = palette[(id - 1) % palette.length];

    const grad = ctx.createRadialGradient(42, 42, 10, 60, 60, 55);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, color);
    grad.addColorStop(1, '#0f051d');

    ctx.beginPath();
    ctx.arc(60, 60, 52, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(45, 45, 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fill();

    ctx.font = '900 36px Nunito, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(String(id), 60, 64);

    const img = new Image();
    img.src = canvas.toDataURL();
    return img;
}

const WORLD_GEM_IMAGES: Map<string, HTMLImageElement> = new Map(); // Key `${worldIdx}_${gemId}`
const loadedWorlds = new Set<number>();
const loadingWorldPromises = new Map<number, Promise<void>>();

function getGemImage(worldIdx: number, gemId: number): HTMLImageElement | undefined {
    return WORLD_GEM_IMAGES.get(`${worldIdx}_${gemId}`) || WORLD_GEM_IMAGES.get(`1_${gemId}`) || GEM_IMAGES.get(gemId);
}

async function loadWorldImages(worldIdx: number): Promise<void> {
    if (loadedWorlds.has(worldIdx)) return;
    if (loadingWorldPromises.has(worldIdx)) return loadingWorldPromises.get(worldIdx)!;

    const promise = (async () => {
        const iconIds = WORLD_ICON_MAP[worldIdx] || [];
        const proms: Promise<void>[] = [];

        for (const id of iconIds) {
            const key = `${worldIdx}_${id}`;
            if (WORLD_GEM_IMAGES.has(key)) continue;

            const p = new Promise<void>((res) => {
                const path = `/icons/world-${worldIdx}/${id}.png`;
                const img = new Image();
                img.onload = () => {
                    WORLD_GEM_IMAGES.set(key, img);
                    GEM_IMAGES.set(id, img);
                    res();
                };
                img.onerror = () => {
                    // Fallback canvas image if missing
                    const fallback = createFallbackGemImage(id);
                    WORLD_GEM_IMAGES.set(key, fallback);
                    if (!GEM_IMAGES.has(id)) GEM_IMAGES.set(id, fallback);
                    res();
                };
                img.src = path;
            });
            proms.push(p);
        }

        await Promise.all(proms);
        loadedWorlds.add(worldIdx);
        loadingWorldPromises.delete(worldIdx);
    })();

    loadingWorldPromises.set(worldIdx, promise);
    return promise;
}

function loadAllWorldImagesInBackground() {
    for (let w = 1; w <= 5; w++) {
        if (!loadedWorlds.has(w) && !loadingWorldPromises.has(w)) {
            loadWorldImages(w).catch(() => { });
        }
    }
}

// ──────────────────────────────────────────────────────────────
// STORAGE
// ──────────────────────────────────────────────────────────────
const SAVE_KEY = 'royal_gems_v2';
const MONEY_KEY = 'royal_gems_money';
interface SaveData { highestLevel: number; stars: number[]; scores: number[]; }

function loadSave(): SaveData {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (!Array.isArray(data.stars)) data.stars = [];
            if (!Array.isArray(data.scores)) data.scores = [];
            while (data.stars.length <= 100) data.stars.push(0);
            while (data.scores.length <= 100) data.scores.push(0);
            return data;
        }
    } catch { }
    return { highestLevel: 1, stars: Array(101).fill(0), scores: Array(101).fill(0) };
}

function writeSave(s: SaveData) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { }
}

function loadMoney(): number {
    return parseInt(localStorage.getItem(MONEY_KEY) ?? '0', 10);
}

function saveMoney(amount: number) {
    localStorage.setItem(MONEY_KEY, String(amount));
    const el = document.getElementById('money-val');
    if (el) el.textContent = String(amount);
}

function earnMoney(amount: number) {
    saveMoney(loadMoney() + amount);
}

// ──────────────────────────────────────────────────────────────
// GAME STATE
// ──────────────────────────────────────────────────────────────
class GameState {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    levels: LevelDef[];
    save: SaveData;

    currentLevel!: LevelDef;
    grid: Cell[][] = [];

    rows = 7; cols = 7;
    cellSize = 70;
    offsetX = 0; offsetY = 0;

    selected: [number, number] | null = null;
    busy = false;
    movesLeft = 20;
    score = 0;
    combo = 0;
    goals: Goal[] = [];
    survivalTimer: number = -1;
    eventCounter: number = 0;

    // Level countdown timer (seconds)
    levelTimer = 60;
    levelTimerTotal = 60;
    levelTimerRunning = false;
    paused = false;
    private _timerInterval: ReturnType<typeof setInterval> | null = null;

    // Particle & Lightning systems
    particles: Particle[] = [];
    lightnings: LightningEffect[] = [];

    initialDropPending = false;
    gameOver = false;
    levelComplete = false;

    rafId = 0;
    lastTime = 0;

    constructor(canvas: HTMLCanvasElement, levels: LevelDef[], save: SaveData) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.levels = levels;
        this.save = save;
    }

    startLevel(levelId: number) {
        const def = this.levels.find(l => l.id === levelId)!;
        this.currentLevel = def;
        this.rows = def.rows;
        this.cols = def.cols;
        this.movesLeft = def.moves;
        this.score = 0;
        this.combo = 0;
        this.gameOver = false;
        this.levelComplete = false;
        this.paused = false;
        this.selected = null;
        this.busy = false;
        this.particles = [];
        this.goals = def.goals.map(g => ({ ...g, collected: 0 }));
        this.survivalTimer = def.timeLimit ?? -1;
        this.eventCounter = 10;
        this.initialDropPending = true;

        // Per-level logical timer: 60s early, scales down slightly for harder levels
        this.levelTimer = Math.max(90, 180 - Math.floor(levelId / 5) * 5);
        this.levelTimerTotal = this.levelTimer;
        this.startLevelTimer();

        // Wait a frame for the 'hidden' class removal to reflow layout so clientWidth/clientHeight are accurate
        requestAnimationFrame(() => {
            this.resize();
            this.buildGrid(def);
            this.startLoop();
            const worldIdx = Math.floor((levelId - 1) / 20) + 1;
            updateGoalsUI(this.goals, GEM_IMAGES, worldIdx);
            updateHUD(this.levelTimer, this.score, levelId);

            // Double pass after DOM renders goals-bar height
            setTimeout(() => { this.resize(); }, 50);

            // Show current money
            const el = document.getElementById('money-val');
            if (el) el.textContent = String(loadMoney());
        });
    }

    startLevelTimer() {
        this.stopLevelTimer();
        const timerEl = document.getElementById('moves-val');
        const updateDisplay = () => {
            if (timerEl) timerEl.textContent = String(this.levelTimer);
            if (this.levelTimer <= 10 && timerEl) timerEl.style.color = '#ef4444';
            else if (timerEl) timerEl.style.color = 'white';

            // Update Graphical Time Bar
            const pct = this.levelTimerTotal > 0 ? this.levelTimer / this.levelTimerTotal : 1;
            const timeBar = document.getElementById('time-bar');
            if (timeBar) {
                timeBar.style.width = `${pct * 100}%`;
                if (pct < 0.25) {
                    timeBar.style.background = '#ef4444';
                } else if (pct < 0.50) {
                    timeBar.style.background = '#f59e0b';
                } else {
                    timeBar.style.background = 'linear-gradient(90deg, #10b981, #f59e0b)';
                }
            }
            const star2 = document.getElementById('star-marker-2');
            const star3 = document.getElementById('star-marker-3');
            if (star2) star2.style.color = pct >= 0.25 ? '#ffd700' : '#4b5563';
            if (star3) star3.style.color = pct >= 0.50 ? '#ffd700' : '#4b5563';
        };
        updateDisplay();
        this._timerInterval = setInterval(() => {
            if (this.paused || this.gameOver || this.levelComplete) return;
            this.levelTimer--;
            updateDisplay();
            if (this.levelTimer <= 0) {
                this.stopLevelTimer();
                this.handleTimeUp();
            }
        }, 1000);
    }

    stopLevelTimer() {
        if (this._timerInterval !== null) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }

    handleTimeUp() {
        if (this.levelComplete) return;
        this.gameOver = true;
        this.busy = true;
        EconomyManager.handleLevelDefeat(this.currentLevel.id);
        AdManager.hideBanner();
        playSound('gameOver');
        showModal('defeat');
    }

    togglePause() {
        if (this.levelComplete) return;
        this.paused = !this.paused;
        const btn = document.getElementById('btn-pause');
        if (this.paused) {
            if (btn) btn.textContent = '▶';
            showModal('pause');
            this.stopLoop();
        } else {
            if (btn) btn.textContent = '⏸';
            hideModal('pause');
            this.startLoop();
        }
    }

    buildGrid(def: LevelDef) {
        const rng = seeded(def.id * 3323 + 11);
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                const active = def.gridMask ? def.gridMask[r][c] === 1 : true;
                const obs = def.obstacles.find(o => o.row === r && o.col === c);
                let gem: GemId | null = null;
                if (active && (!obs || obs.type !== 'stone')) {
                    // pick gem that doesn't immediately match
                    gem = pickNoMatch(this.grid, r, c, def.gems, rng);
                }
                const { px, py } = this.cellPixel(r, c);
                this.grid[r][c] = {
                    gem,
                    obstacle: active ? (obs?.type ?? 'none') : 'none',
                    iceHp: active && obs?.type === 'ice' ? (obs.hp ?? 2) : 0,
                    chainHp: active && obs?.type === 'chain' ? (obs.hp ?? 2) : 0,
                    marbleHp: active && obs?.type === 'marble' ? (obs.hp ?? 3) : 0,
                    special: 'none',
                    x: px, y: py - this.rows * this.cellSize, // start above grid
                    tx: px, ty: py,
                    scale: 1, alpha: 1, shake: 0,
                    selected: false, matched: false,
                    active
                };
            }
        }
    }

    resize() {
        const wrap = document.getElementById('canvas-wrap');
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        const w = Math.min(rect.width || wrap.clientWidth || 360, 480);
        const h = rect.height || wrap.clientHeight || 350;

        const cols = Math.max(1, this.cols || 6);
        const rows = Math.max(1, this.rows || 6);

        // compute cell size to fit grid with padding both horizontally AND vertically
        const cellW = Math.floor((w - 20) / cols);
        const cellH = Math.floor((h - 20) / rows);
        this.cellSize = Math.max(16, Math.min(cellW, cellH, 80));

        this.canvas.width = this.cellSize * cols + 20;
        this.canvas.height = this.cellSize * rows + 20;
        this.offsetX = 10;
        this.offsetY = 10;

        // reposition existing cells
        if (this.grid) {
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (this.grid[r]?.[c]) {
                        const { px, py } = this.cellPixel(r, c);
                        const oldTx = this.grid[r][c].tx;
                        const oldTy = this.grid[r][c].ty;
                        this.grid[r][c].tx = px;
                        this.grid[r][c].ty = py;
                        // If cell was settled at old position, snap it to new position
                        if (Math.abs(this.grid[r][c].x - oldTx) < 2 && Math.abs(this.grid[r][c].y - oldTy) < 2) {
                            this.grid[r][c].x = px;
                            this.grid[r][c].y = py;
                        }
                    }
                }
            }
        }
    }

    cellPixel(r: number, c: number) {
        return {
            px: this.offsetX + c * this.cellSize + this.cellSize / 2,
            py: this.offsetY + r * this.cellSize + this.cellSize / 2,
        };
    }

    startLoop() {
        cancelAnimationFrame(this.rafId);
        this.lastTime = performance.now();
        const loop = (now: number) => {
            const dt = Math.min((now - this.lastTime) / 1000, 0.05);
            this.lastTime = now;
            this.update(dt);
            this.draw();
            this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
    }

    stopLoop() { cancelAnimationFrame(this.rafId); }

    // ──────────── UPDATE ────────────
    update(dt: number) {
        // 1. Animate cells
        let allSettled = true;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.grid[r][c];
                cell.x += (cell.tx - cell.x) * DROP_SPEED;
                cell.y += (cell.ty - cell.y) * DROP_SPEED;
                if (Math.abs(cell.tx - cell.x) > 1 || Math.abs(cell.ty - cell.y) > 1) allSettled = false;
                cell.scale += (1 - cell.scale) * ANIM_SPEED;
                if (cell.shake > 0) cell.shake -= dt * 8;
            }
        }
        // 2. Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;
            p.vy += 0.15 * dt * 60;
            p.life -= dt;
            p.alpha = Math.max(0, p.life / p.maxLife);
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        // 2.5 Lightnings
        for (let i = this.lightnings.length - 1; i >= 0; i--) {
            const l = this.lightnings[i];
            l.duration -= dt;
            l.alpha = Math.max(0, l.duration / l.maxDuration);
            if (l.duration <= 0) this.lightnings.splice(i, 1);
        }
        // 3. Survival
        if (!this.gameOver && !this.levelComplete && this.survivalTimer > 0) {
            this.survivalTimer -= dt;
            const el = document.getElementById('survival-timer');
            if (el) {
                el.classList.remove('hidden');
                el.textContent = `⏱ ${Math.ceil(this.survivalTimer)}s`;
                if (this.survivalTimer <= 10) el.classList.add('warning');
                else el.classList.remove('warning');
            }
            if (this.survivalTimer <= 0) {
                this.survivalTimer = 0;
                this.gameOver = true;
                document.getElementById('defeat-modal')?.classList.remove('hidden');
            }
        }

        // 4. After settle – run game logic
        if (allSettled && !this.busy && !this.gameOver && !this.levelComplete) {
            if (this.initialDropPending) {
                this.initialDropPending = false;
                this.checkAndShuffle();
            }
        }
    }

    // ──────────── DRAW ────────────
    draw() {
        const { ctx, rows, cols, cellSize } = this;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid background
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = this.grid[r][c];
                if (!cell.active) continue; // Skip rendering inactive spaces

                const { px, py } = this.cellPixel(r, c);
                const size = cellSize - CELL_PAD;
                const hs = size / 2;

                // Cell tile bg
                const cv = (r + c) % 2 === 0;
                ctx.fillStyle = cv ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)';
                roundRect(ctx, px - hs, py - hs, size, size, 10);
                ctx.fill();

                if (cell.obstacle === 'stone') {
                    drawStone(ctx, px, py, size);
                    continue;
                }

                // World 2: stone slab — draw BEHIND gem so icon is fully visible on top
                if (cell.obstacle === 'marble' && cell.marbleHp <= 1) {
                    ctx.save();
                    ctx.globalAlpha = 0.72;
                    ctx.fillStyle = '#b0a888';
                    roundRect(ctx, cell.x - size / 2, cell.y - size / 2, size, size, 10);
                    ctx.fill();
                    // Stone texture lines
                    ctx.globalAlpha = 0.35;
                    ctx.strokeStyle = '#7a6e55';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(cell.x - size * 0.28, cell.y - size * 0.08);
                    ctx.lineTo(cell.x + size * 0.28, cell.y + size * 0.12);
                    ctx.moveTo(cell.x - size * 0.1, cell.y - size * 0.28);
                    ctx.lineTo(cell.x + size * 0.08, cell.y + size * 0.28);
                    ctx.stroke();
                    // Stone border
                    ctx.globalAlpha = 0.55;
                    ctx.strokeStyle = '#e0d8c0';
                    ctx.lineWidth = 2;
                    roundRect(ctx, cell.x - size / 2, cell.y - size / 2, size, size, 10);
                    ctx.stroke();
                    ctx.restore();
                }

                // Draw gem sprite
                if (cell.gem !== null) {
                    ctx.save();
                    ctx.globalAlpha = cell.alpha;
                    const s = size * cell.scale;
                    const worldIdx = Math.floor((this.currentLevel.id - 1) / 20) + 1;
                    const img = getGemImage(worldIdx, cell.gem);

                    // shake offset
                    const sx = cell.shake > 0 ? Math.sin(cell.shake * 25) * 3 : 0;

                    if (img) {
                        ctx.drawImage(img, cell.x - s / 2 + sx, cell.y - s / 2, s, s);
                    } else {
                        // fallback colored circle
                        const colorArr = ['#f59e0b', '#a855f7', '#3b82f6', '#06b6d4', '#22c55e', '#ec4899', '#ef4444', '#ffd700', '#f97316', '#14b8a6', '#8b5cf6', '#e11d48'];
                        ctx.fillStyle = colorArr[cell.gem % colorArr.length] ?? '#aaa';
                        ctx.beginPath();
                        ctx.arc(cell.x + sx, cell.y, s / 2 - 2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                }

                // Selection highlight
                if (cell.selected) {
                    ctx.save();
                    ctx.strokeStyle = '#ffd700';
                    ctx.lineWidth = 3;
                    ctx.shadowColor = '#ffd700';
                    ctx.shadowBlur = 20;
                    const s = (cellSize - CELL_PAD) / 2;
                    ctx.beginPath();
                    ctx.arc(cell.x, cell.y, s * 0.9, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }

                // Special marker
                if (cell.special !== 'none') {
                    drawSpecialMarker(ctx, cell.x, cell.y, cell.special, cellSize * 0.3);
                }

                // Ice (Glass) overlay — gem is visible beneath
                if (cell.obstacle === 'ice') {
                    ctx.save();
                    const s = (cellSize - CELL_PAD) / 2;
                    if (cell.iceHp === 2) {
                        // Intact glass: clear blue gloss
                        ctx.globalAlpha = 0.55;
                        ctx.fillStyle = '#b8e4ff';
                        roundRect(ctx, cell.x - s, cell.y - s, s * 2, s * 2, 10);
                        ctx.fill();
                        // shiny highlight stripe
                        ctx.globalAlpha = 0.35;
                        ctx.fillStyle = 'rgba(255,255,255,0.9)';
                        ctx.beginPath();
                        ctx.ellipse(cell.x - s * 0.25, cell.y - s * 0.3, s * 0.4, s * 0.15, -0.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.globalAlpha = 1;
                        ctx.strokeStyle = 'rgba(180,230,255,0.9)';
                        ctx.lineWidth = 2;
                        roundRect(ctx, cell.x - s, cell.y - s, s * 2, s * 2, 10);
                        ctx.stroke();
                    } else {
                        // Cracked glass: first hit — lighter with crack lines
                        ctx.globalAlpha = 0.35;
                        ctx.fillStyle = '#c8eeff';
                        roundRect(ctx, cell.x - s, cell.y - s, s * 2, s * 2, 10);
                        ctx.fill();
                        ctx.globalAlpha = 0.7;
                        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
                        ctx.lineWidth = 1.5;
                        roundRect(ctx, cell.x - s, cell.y - s, s * 2, s * 2, 10);
                        ctx.stroke();
                        // Crack lines
                        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(cell.x, cell.y - s * 0.5);
                        ctx.lineTo(cell.x + s * 0.4, cell.y + s * 0.3);
                        ctx.moveTo(cell.x + s * 0.1, cell.y - s * 0.1);
                        ctx.lineTo(cell.x - s * 0.5, cell.y + s * 0.4);
                        ctx.stroke();
                    }
                    ctx.restore();
                }

                // Chain overlay
                if (cell.obstacle === 'chain') {
                    drawChain(ctx, cell.x, cell.y, cellSize * 0.85);
                }

                // Marble overlay — only for hp>1 (round ball drawn OVER the gem; hp=1 drawn before gem above)
                if (cell.obstacle === 'marble' && cell.marbleHp > 1) {
                    ctx.save();
                    const hpRatio = cell.marbleHp / 3;
                    ctx.globalAlpha = 0.5 + hpRatio * 0.5;
                    ctx.fillStyle = '#e8e8ed';
                    ctx.beginPath();
                    ctx.arc(cell.x, cell.y, size * 0.45, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = '#ffffff';
                    ctx.stroke();
                    // Marble veins
                    ctx.strokeStyle = `rgba(100, 100, 150, ${hpRatio * 0.5})`;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(cell.x - size * 0.2, cell.y - size * 0.2);
                    ctx.bezierCurveTo(cell.x, cell.y - size * 0.3, cell.x + size * 0.2, cell.y, cell.x + size * 0.3, cell.y + size * 0.1);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }

        // Particles
        for (const p of this.particles) {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Lightnings
        for (const l of this.lightnings) {
            ctx.save();
            ctx.globalAlpha = l.alpha;
            ctx.strokeStyle = l.color;
            ctx.lineWidth = l.width;
            ctx.shadowColor = l.color;
            ctx.shadowBlur = 15;
            ctx.beginPath();
            if (l.points.length > 0) {
                ctx.moveTo(l.points[0].x, l.points[0].y);
                for (let i = 1; i < l.points.length; i++) {
                    ctx.lineTo(l.points[i].x, l.points[i].y);
                }
            } else {
                ctx.moveTo(l.x1, l.y1);
                ctx.lineTo(l.x2, l.y2);
            }
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = l.width * 0.4;
            ctx.shadowBlur = 0;
            ctx.stroke();
            ctx.restore();
        }
    }

    // Drag-to-swap state
    dragStartCell: [number, number] | null = null;
    dragStartPos: [number, number] | null = null;
    isDragging: boolean = false;

    // ──────────── INPUT ────────────
    handlePointerDown(canvasX: number, canvasY: number) {
        if (this.busy || this.gameOver || this.levelComplete) return;

        const col = Math.floor((canvasX - this.offsetX) / this.cellSize);
        const row = Math.floor((canvasY - this.offsetY) / this.cellSize);
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;

        const cell = this.grid[row][col];
        if (!cell || !cell.active || cell.obstacle === 'stone' || cell.gem === null) return;

        this.dragStartCell = [row, col];
        this.dragStartPos = [canvasX, canvasY];
        this.isDragging = false;
        if (this.selected) {
            this.grid[this.selected[0]][this.selected[1]].selected = false;
        }
        cell.selected = true;
        this.selected = [row, col];
    }

    handlePointerMove(canvasX: number, canvasY: number) {
        if (!this.dragStartCell || !this.dragStartPos || this.busy || this.gameOver || this.levelComplete) return;

        const [sr, sc] = this.dragStartCell;
        const [startX, startY] = this.dragStartPos;

        const dx = canvasX - startX;
        const dy = canvasY - startY;
        const dist = Math.hypot(dx, dy);

        // Swipe / drag distance threshold
        if (dist > 18) {
            this.isDragging = true;
            let tr = sr;
            let tc = sc;

            if (Math.abs(dx) > Math.abs(dy)) {
                tc = sc + (dx > 0 ? 1 : -1);
            } else {
                tr = sr + (dy > 0 ? 1 : -1);
            }

            if (tr >= 0 && tr < this.rows && tc >= 0 && tc < this.cols) {
                const targetCell = this.grid[tr][tc];
                if (targetCell && targetCell.active && targetCell.obstacle !== 'stone' && targetCell.gem !== null) {
                    if (this.selected) {
                        this.grid[this.selected[0]][this.selected[1]].selected = false;
                    }
                    this.selected = null;
                    this.dragStartCell = null;
                    this.dragStartPos = null;
                    this.trySwap(sr, sc, tr, tc);
                }
            }
        }
    }

    handlePointerUp() {
        if (this.dragStartCell && !this.isDragging) {
            const [sr, sc] = this.dragStartCell;
            this._handleGridClick(sr, sc);
        } else if (this.dragStartCell) {
            const [sr, sc] = this.dragStartCell;
            if (this.grid[sr] && this.grid[sr][sc]) {
                this.grid[sr][sc].selected = false;
            }
            this.selected = null;
        }
        this.dragStartCell = null;
        this.dragStartPos = null;
        this.isDragging = false;
    }

    handleTap(canvasX: number, canvasY: number) {
        if (this.busy || this.gameOver || this.levelComplete) return;

        const col = Math.floor((canvasX - this.offsetX) / this.cellSize);
        const row = Math.floor((canvasY - this.offsetY) / this.cellSize);
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
        this._handleGridClick(row, col);
    }

    _handleGridClick(r: number, c: number) {
        if (this.busy || this.gameOver || this.levelComplete) return;
        const cell = this.grid[r][c];

        if (!cell.active || cell.obstacle === 'stone') return;
        if (cell.gem === null) return;

        if (!this.selected) {
            cell.selected = true;
            this.selected = [r, c];
        } else {
            const [sr, sc] = this.selected;
            this.grid[sr][sc].selected = false;
            if (sr === r && sc === c) {
                this.selected = null;
                return;
            }
            // Check adjacency
            const dr = Math.abs(r - sr);
            const dc = Math.abs(c - sc);
            if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
                this.selected = null;
                this.trySwap(sr, sc, r, c);
            } else {
                // Re-select new cell
                cell.selected = true;
                this.selected = [r, c];
            }
        }
    }



    collectGoal(type: Goal['type'], gem?: GemId) {
        if (this.levelComplete) return;
        const goal = this.goals.find(g => g.type === type && (type !== 'gem' || g.gem === gem));
        if (goal && goal.collected < goal.required) goal.collected++;
    }

    // explodeCell - matchGem: if provided, ice obstacle only damaged when its gem matches matchGem
    explodeCell(r: number, c: number, matchGem?: GemId) {
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return;
        const cell = this.grid[r][c];

        if (cell.alpha === 0 && cell.gem === null && cell.obstacle === 'none') return;
        const savedGem = cell.gem;

        // Damage adjacent obstacles
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                const adj = this.grid[nr][nc];
                if (adj.obstacle === 'ice' && adj.iceHp > 0) {
                    // Glass only breaks when hit by the same gem type it contains
                    if (matchGem === undefined || adj.gem === matchGem) {
                        adj.iceHp--;
                        if (adj.iceHp <= 0) { adj.obstacle = 'none'; this.collectGoal('ice'); }
                    }
                } else if (adj.obstacle === 'chain' && adj.chainHp > 0) {
                    adj.chainHp--;
                    if (adj.chainHp <= 0) { adj.obstacle = 'none'; this.collectGoal('chain'); }
                } else if (adj.obstacle === 'marble' && adj.marbleHp > 1) {
                    // Only damage adjacent marbles that have hp>1 (World 2 hp=1 slabs break only when directly matched)
                    adj.marbleHp--;
                    if (adj.marbleHp <= 0) { adj.obstacle = 'none'; this.collectGoal('marble'); }
                }
            }
        }

        // Break own obstacle
        if (cell.obstacle === 'ice') {
            // Ice cell only breaks if hit by the right gem type
            if (matchGem === undefined || cell.gem === matchGem) {
                cell.iceHp--;
                if (cell.iceHp <= 0) { cell.obstacle = 'none'; this.collectGoal('ice'); }
            }
            // Ice cells don't vanish as gems — the gem stays frozen until fully broken
            return;
        } else if (cell.obstacle === 'chain') {
            cell.chainHp = 0; cell.obstacle = 'none'; this.collectGoal('chain');
        } else if (cell.obstacle === 'stone') {
            cell.obstacle = 'none'; this.collectGoal('stone');
        } else if (cell.obstacle === 'marble') {
            cell.marbleHp = 0; cell.obstacle = 'none'; this.collectGoal('marble');
        }

        if (cell.gem) {
            this.collectGoal('gem', cell.gem);
            this.score += SCORE_PER_GEM + this.combo * SCORE_COMBO;
            const colorArr = ['#f59e0b', '#a855f7', '#3b82f6', '#06b6d4', '#22c55e', '#ec4899', '#ef4444', '#ffd700', '#f97316', '#14b8a6', '#8b5cf6', '#e11d48'];
            this.burst(cell.x, cell.y, colorArr[cell.gem % colorArr.length]);
        }

        const special = cell.special;
        cell.gem = null;
        cell.special = 'none';
        cell.alpha = 0;
        cell.scale = 0;
        cell.selected = false;

        // Cascade explosions
        if (special === 'hbomb') {
            for (let i = 0; i < this.cols; i++) if (i !== c) this.explodeCell(r, i, savedGem ?? undefined);
        } else if (special === 'vbomb') {
            for (let i = 0; i < this.rows; i++) if (i !== r) this.explodeCell(i, c, savedGem ?? undefined);
        } else if (special === 'bomb') {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr !== 0 || dc !== 0) this.explodeCell(r + dr, c + dc, savedGem ?? undefined);
                }
            }
        } else if (special === 'disco') {
            const arr = [...this.currentLevel.gems];
            if (arr.length > 0) {
                const tg = arr[Math.floor(Math.random() * arr.length)];
                for (let ir = 0; ir < this.rows; ir++) {
                    for (let ic = 0; ic < this.cols; ic++) {
                        if (this.grid[ir][ic].gem === tg) this.explodeCell(ir, ic, tg);
                    }
                }
            }
        } else if (special === 'crown') {
            this.collectGoal('treasure');
        } else if (special === 'key') {
            this.collectGoal('treasure');
        }
    }

    async trySwap(r1: number, c1: number, r2: number, c2: number) {
        this.busy = true;
        this.doSwap(r1, c1, r2, c2);
        await waitSettle(this, 250);

        const aObj = this.grid[r1][c1];
        const bObj = this.grid[r2][c2];

        // Trigger special swaps if disco or double-special
        let forcedExplode = false;
        if (aObj.special === 'disco' && bObj.gem) {
            const tg = bObj.gem;
            for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].gem === tg) this.explodeCell(r, c, tg);
            }
            this.explodeCell(r1, c1, tg);
            forcedExplode = true;
        } else if (bObj.special === 'disco' && aObj.gem) {
            const tg = aObj.gem;
            for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c].gem === tg) this.explodeCell(r, c, tg);
            }
            this.explodeCell(r2, c2, tg);
            forcedExplode = true;
        } else if (aObj.special !== 'none' || bObj.special !== 'none') {
            // Trigger combinations
            if (aObj.special !== 'none' && bObj.special !== 'none') {
                if (aObj.special === 'disco' && bObj.special === 'disco') {
                    // Board clear
                    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) this.explodeCell(r, c, this.grid[r][c].gem ?? undefined);
                } else if ((aObj.special === 'disco' && (bObj.special === 'vbomb' || bObj.special === 'hbomb' || bObj.special === 'bomb')) ||
                    (bObj.special === 'disco' && (aObj.special === 'vbomb' || aObj.special === 'hbomb' || aObj.special === 'bomb'))) {
                    // Transform color into rockets
                    const targetColor = aObj.special === 'disco' ? (bObj.gem ?? this.currentLevel.gems[0]) : (aObj.gem ?? this.currentLevel.gems[0]);
                    for (let r = 0; r < this.rows; r++) {
                        for (let c = 0; c < this.cols; c++) {
                            if (this.grid[r][c].gem === targetColor) {
                                this.grid[r][c].special = Math.random() > 0.5 ? 'hbomb' : 'vbomb';
                                this.explodeCell(r, c, targetColor);
                            }
                        }
                    }
                } else {
                    // Default double special handling
                    this.explodeCell(r1, c1, aObj.gem ?? undefined);
                    this.explodeCell(r2, c2, bObj.gem ?? undefined);
                }
                forcedExplode = true;
            }
        }

        const matches = findMatches(this.grid, this.rows, this.cols);

        if (forcedExplode || matches.length > 0) {
            this.movesLeft--;
            this.combo = 0;
            this.eventCounter--;
            if (matches.length > 0) await this.processMatches(matches);
            else {
                updateHUD(this.levelTimer, this.score, this.currentLevel.id);
                updateGoalsUI(this.goals, GEM_IMAGES);
                await waitSettle(this, 180);
                await this.dropAndFill();
                await waitSettle(this, 250);
                const cm = findMatches(this.grid, this.rows, this.cols);
                if (cm.length > 0) await this.processMatches(cm);
            }

            if (this.eventCounter <= 0 && this.movesLeft > 2 && !this.levelComplete && !this.gameOver) {
                await this.triggerRandomEvent();
                this.eventCounter = 10;
            }

            await this.checkEnd();
        } else {
            // Reverse swap
            this.doSwap(r1, c1, r2, c2);
            this.grid[r1][c1].shake = 1;
            this.grid[r2][c2].shake = 1;
            await waitSettle(this, 250);
        }
        this.busy = false;
    }

    async triggerRandomEvent() {
        const events = ['gem_rain', 'color_surge'];
        const e = events[Math.floor(Math.random() * events.length)];

        const banner = document.getElementById('event-banner');
        if (banner) {
            banner.textContent = e === 'gem_rain' ? '💎 GEM RAIN!' : '🌊 COLOR SURGE!';
            banner.classList.add('show');
            setTimeout(() => banner.classList.remove('show'), 2000);
        }
        await waitSettle(this, 500);

        if (e === 'gem_rain') {
            let dropped = 0;
            for (let i = 0; i < 30 && dropped < 3; i++) {
                const r = Math.floor(Math.random() * this.rows);
                const c = Math.floor(Math.random() * this.cols);
                const cell = this.grid[r][c];
                if (cell.gem !== null && cell.special === 'none' && cell.obstacle === 'none') {
                    cell.special = Math.random() > 0.5 ? 'hbomb' : 'vbomb';
                    cell.shake = 1;
                    dropped++;
                }
            }
        } else if (e === 'color_surge') {
            const arr = [...this.currentLevel.gems];
            if (arr.length > 0) {
                const tg = arr[Math.floor(Math.random() * arr.length)];
                for (let ir = 0; ir < this.rows; ir++) {
                    for (let ic = 0; ic < this.cols; ic++) {
                        if (this.grid[ir][ic].gem === tg && this.grid[ir][ic].obstacle === 'none') {
                            this.explodeCell(ir, ic);
                        }
                    }
                }
            }
        }

        await waitSettle(this, 300);
        await this.dropAndFill();
        await waitSettle(this, 250);
        const cm = findMatches(this.grid, this.rows, this.cols);
        if (cm.length > 0) await this.processMatches(cm);
    }

    doSwap(r1: number, c1: number, r2: number, c2: number) {
        const a = this.grid[r1][c1];
        const b = this.grid[r2][c2];
        // swap data
        [a.gem, b.gem] = [b.gem, a.gem];
        [a.special, b.special] = [b.special, a.special];
        // animate to each other's positions
        const { px: apx, py: apy } = this.cellPixel(r1, c1);
        const { px: bpx, py: bpy } = this.cellPixel(r2, c2);
        a.tx = apx; a.ty = apy;
        b.tx = bpx; b.ty = bpy;
        // snap x/y to OLD position (swap)
        a.x = bpx; a.y = bpy;
        b.x = apx; b.y = apy;
    }

    async processMatches(matches: MatchGroup[]) {
        this.combo++;

        let playMatch4 = false;
        let playMatch3 = false;

        // Process each match group directly with row/col blasts
        let hasCombo = false;
        for (const m of matches) {
            if (m.cells.length >= 5) {
                // 5+ match: explode the entire row AND entire column through the midpoint
                hasCombo = true;
                for (const [r, c] of m.cells) this.explodeCell(r, c, m.gem);
                const [mr, mc] = m.cells[Math.floor(m.cells.length / 2)];
                for (let i = 0; i < this.rows; i++) this.explodeCell(i, mc);
                for (let i = 0; i < this.cols; i++) this.explodeCell(mr, i);

                // Flash: cross pattern
                this.flashLightning([
                    ...Array.from({ length: this.rows }, (_, i): [number, number] => [i, mc]),
                    ...Array.from({ length: this.cols }, (_, i): [number, number] => [mr, i]),
                ]);
            } else if (m.cells.length === 4) {
                // 4 match: explode matched cells then blast the entire row or column
                hasCombo = true;
                for (const [r, c] of m.cells) this.explodeCell(r, c, m.gem);
                const [mr, mc] = m.cells[0];
                if (m.dir === 'h') {
                    for (let i = 0; i < this.cols; i++) this.explodeCell(mr, i);
                    this.flashLightning(Array.from({ length: this.cols }, (_, i): [number, number] => [mr, i]));
                } else {
                    for (let i = 0; i < this.rows; i++) this.explodeCell(i, mc);
                    this.flashLightning(Array.from({ length: this.rows }, (_, i): [number, number] => [i, mc]));
                }
            } else {
                // 3 match: normal
                playMatch3 = true;
                for (const [r, c] of m.cells) this.explodeCell(r, c, m.gem);
            }
        }

        if (hasCombo) { playSound('combo'); playMatch4 = true; }
        if (playMatch4) playSound('match4');
        else if (playMatch3) playSound('match3');

        updateHUD(this.levelTimer, this.score, this.currentLevel.id);
        updateGoalsUI(this.goals, GEM_IMAGES);
        if (this.combo >= 2) showCombo(this.combo);

        await waitSettle(this, 180);
        await this.dropAndFill();
        await waitSettle(this, 250);

        const cascadeMatches = findMatches(this.grid, this.rows, this.cols);
        if (cascadeMatches.length > 0) {
            await this.processMatches(cascadeMatches);
        } else {
            this.combo = 0;
            this.busy = false;
            await this.checkAndShuffle();
        }
    }

    async checkAndShuffle() {
        if (this.gameOver || this.levelComplete) return;

        let attempts = 0;
        while (!hasValidMoves(this.grid, this.rows, this.cols) && attempts < 10) {
            attempts++;
            this.busy = true;
            toast('No moves left! Shuffling...');
            await waitSettle(this, 800);

            const activeCells: Cell[] = [];
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const cell = this.grid[r][c];
                    if (cell.active && cell.obstacle !== 'stone' && cell.gem !== null) {
                        activeCells.push(cell);
                    }
                }
            }

            const gems = activeCells.map(c => ({ gem: c.gem, special: c.special }));
            let shuffles = 0;
            do {
                gems.sort(() => Math.random() - 0.5);
                activeCells.forEach((c, i) => {
                    c.gem = gems[i].gem;
                    c.special = gems[i].special;
                });
                shuffles++;
            } while (findMatches(this.grid, this.rows, this.cols).length > 0 && shuffles < 50);

            // Pop animation
            activeCells.forEach(c => { c.scale = 0.1; c.alpha = 0.5; });
            await waitSettle(this, 300);
            activeCells.forEach(c => { c.scale = 1; c.alpha = 1; });
            await waitSettle(this, 300);
        }
        this.busy = false;
    }

    async dropAndFill() {
        // Drop gems down column by column
        for (let c = 0; c < this.cols; c++) {
            let empty = this.rows - 1;
            for (let r = this.rows - 1; r >= 0; r--) {
                const cell = this.grid[r][c];
                // Treasure collection
                if (r === this.rows - 1 && cell.gem !== null && (cell.special === 'crown' || cell.special === 'key')) {
                    cell.gem = null;
                    cell.special = 'none';
                    cell.alpha = 0;
                    this.collectGoal('treasure');
                    this.score += 500;
                    this.burst(cell.x, cell.y, '#ffd700');
                }

                if (!cell.active) continue;
                if (cell.obstacle === 'stone') {
                    empty = r - 1;
                    continue;
                }

                if (cell.gem !== null) {
                    // Ensure 'empty' points to a valid target slot
                    while (empty > r && (!this.grid[empty][c].active || this.grid[empty][c].obstacle === 'stone')) {
                        empty--;
                    }
                    if (empty > r) {
                        this.grid[empty][c].gem = cell.gem;
                        this.grid[empty][c].special = cell.special;
                        this.grid[empty][c].alpha = 1;
                        this.grid[empty][c].scale = 1;
                        // animate from old position
                        const { px: ox, py: oy } = this.cellPixel(r, c);
                        this.grid[empty][c].x = ox;
                        this.grid[empty][c].y = oy;

                        cell.gem = null;
                        cell.alpha = 0;
                        cell.special = 'none';
                    }
                    empty--;
                }
            }

            // Fill empty active spaces with new gems
            let dropCount = 1;
            for (let r = this.rows - 1; r >= 0; r--) {
                const cell = this.grid[r][c];
                if (cell.active && cell.obstacle !== 'stone' && cell.gem === null) {
                    const gem = pickRandom(this.currentLevel.gems);
                    cell.gem = gem;

                    // 1% chance for treasure in survival mode or hard levels
                    if ((this.survivalTimer > 0 || this.currentLevel.id > 30) && Math.random() < 0.01) {
                        cell.special = Math.random() > 0.5 ? 'crown' : 'key';
                    } else {
                        cell.special = 'none';
                    }

                    cell.alpha = 1;
                    cell.scale = 0.5;
                    const { px, py } = this.cellPixel(r, c);
                    cell.x = px;
                    cell.y = py - dropCount * this.cellSize;
                    cell.tx = px;
                    cell.ty = py;
                    dropCount++;
                }
            }
        }
        // Reset all targets
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const { px, py } = this.cellPixel(r, c);
                this.grid[r][c].tx = px;
                this.grid[r][c].ty = py;
                if (this.grid[r][c].scale < 0.9) this.grid[r][c].scale = 0.5;
            }
        }
    }

    async checkEnd() {
        // Guard: prevent double-firing during cascades
        if (this.levelComplete || this.gameOver) return;

        // Sync score goal first (before either done-check)
        const scoreGoal = this.goals.find(g => g.type === 'score');
        if (scoreGoal) scoreGoal.collected = this.score;

        // Check all goals
        const done = this.goals.every(g => g.collected >= g.required);
        if (done) {
            this.levelComplete = true;
            this.animateLevelComplete();
        }
        // No moves limit under pure timed mode
    }

    animateLevelComplete() {
        this.stopLevelTimer();
        AdManager.hideBanner();
        playSound('levelPassed');
        // Big burst
        for (let i = 0; i < 60; i++) {
            setTimeout(() => {
                const x = this.canvas.width * Math.random();
                const y = this.canvas.height * Math.random();
                this.burst(x, y, pickRandom(['#ffd700', '#ff6b6b', '#4ecdc4', '#a29bfe', '#fd79a8']));
            }, i * 30);
        }
        setTimeout(async () => {
            const stars = computeStars(this.levelTimer, this.levelTimerTotal);
            const isFirstTime = !this.save.stars[this.currentLevel.id];

            const winResult = EconomyManager.handleLevelWin(this.currentLevel.id, stars, isFirstTime);
            toast(`🎉 LEVEL CLEAR! 💰 +${winResult.coinsEarned} Coins${winResult.livesEarned > 0 ? ` | ❤️ +${winResult.livesEarned} Life` : ''}`);

            // save
            if (stars > (this.save.stars[this.currentLevel.id] ?? 0)) {
                this.save.stars[this.currentLevel.id] = stars;
            }
            if (this.score > (this.save.scores[this.currentLevel.id] ?? 0)) {
                this.save.scores[this.currentLevel.id] = this.score;
            }
            if (this.currentLevel.id >= this.save.highestLevel) {
                this.save.highestLevel = Math.min(100, this.currentLevel.id + 1);
            }
            writeSave(this.save);

            // Conservative Interstitial Ad policy:
            // 1. NO ads for first 3 levels
            // 2. 30% chance after level > 3 win, OR 100% after world completion (level % 20 === 0)
            if (this.currentLevel.id > 3) {
                const isWorldComplete = this.currentLevel.id % 20 === 0;
                if (isWorldComplete || Math.random() < 0.30) {
                    await AdManager.showInterstitial();
                }
            }

            if (this.currentLevel.id === 100) {
                showModal('cup');
            } else {
                showVictoryModal(this.currentLevel.id, this.score, stars);
            }
        }, 1600);
    }

    burst(x: number, y: number, color: string) {
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.4;
            const speed = 1.5 + Math.random() * 2.5;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                r: 3 + Math.random() * 4,
                color,
                life: 0.6 + Math.random() * 0.4,
                maxLife: 1,
                alpha: 1,
            });
        }
    }

    flashLightning(cells: [number, number][]) {
        const uniqueRows = new Set<number>();
        const uniqueCols = new Set<number>();
        for (const [r, c] of cells) {
            uniqueRows.add(r);
            uniqueCols.add(c);
        }

        const makeZigzag = (x1: number, y1: number, x2: number, y2: number): { x: number, y: number }[] => {
            const pts: { x: number, y: number }[] = [{ x: x1, y: y1 }];
            const dx = x2 - x1;
            const dy = y2 - y1;
            const dist = Math.hypot(dx, dy);
            const segments = Math.max(5, Math.floor(dist / 20));

            for (let i = 1; i < segments; i++) {
                const t = i / segments;
                const baseX = x1 + dx * t;
                const baseY = y1 + dy * t;
                const perpX = -dy / dist;
                const perpY = dx / dist;
                const offset = (Math.random() - 0.5) * 12;
                pts.push({
                    x: baseX + perpX * offset,
                    y: baseY + perpY * offset
                });
            }
            pts.push({ x: x2, y: y2 });
            return pts;
        };

        if (uniqueRows.size < this.rows) {
            for (const r of uniqueRows) {
                const py = this.offsetY + r * this.cellSize + this.cellSize / 2;
                const x1 = this.offsetX;
                const x2 = this.offsetX + this.cols * this.cellSize;
                this.lightnings.push({
                    x1, y1: py, x2, y2: py,
                    width: 6,
                    alpha: 1,
                    duration: 0.35,
                    maxDuration: 0.35,
                    color: '#00d2ff',
                    points: makeZigzag(x1, py, x2, py)
                });
            }
        }

        if (uniqueCols.size < this.cols) {
            for (const c of uniqueCols) {
                const px = this.offsetX + c * this.cellSize + this.cellSize / 2;
                const y1 = this.offsetY;
                const y2 = this.offsetY + this.rows * this.cellSize;
                this.lightnings.push({
                    x1: px, y1, x2: px, y2,
                    width: 6,
                    alpha: 1,
                    duration: 0.35,
                    maxDuration: 0.35,
                    color: '#e74cff',
                    points: makeZigzag(px, y1, px, y2)
                });
            }
        }
    }
}

// ──────────────────────────────────────────────────────────────
// PARTICLE
// ──────────────────────────────────────────────────────────────
interface Particle {
    x: number; y: number;
    vx: number; vy: number;
    r: number;
    color: string;
    life: number; maxLife: number;
    alpha: number;
}

interface LightningEffect {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    alpha: number;
    duration: number;
    maxDuration: number;
    color: string;
    points: { x: number; y: number }[];
}

// ──────────────────────────────────────────────────────────────
// MATCH DETECTION
// ──────────────────────────────────────────────────────────────
interface MatchGroup { cells: [number, number][]; dir: 'h' | 'v'; gem: GemId; }

function findMatches(grid: Cell[][], rows: number, cols: number): MatchGroup[] {
    const matched: MatchGroup[] = [];

    // Horizontal
    for (let r = 0; r < rows; r++) {
        let run = 1;
        for (let c = 1; c <= cols; c++) {
            const cur = grid[r][c - 1];
            const next = c < cols ? grid[r][c] : null;
            if (next && next.gem && cur.gem && next.gem === cur.gem && cur.obstacle !== 'stone') {
                run++;
            } else {
                if (run >= 3) {
                    const cells: [number, number][] = [];
                    for (let k = c - run; k < c; k++) cells.push([r, k]);
                    matched.push({ cells, dir: 'h', gem: cur.gem! });
                }
                run = 1;
            }
        }
    }

    // Vertical
    for (let c = 0; c < cols; c++) {
        let run = 1;
        for (let r = 1; r <= rows; r++) {
            const cur = grid[r - 1][c];
            const next = r < rows ? grid[r][c] : null;
            if (next && next.gem && cur.gem && next.gem === cur.gem && cur.obstacle !== 'stone') {
                run++;
            } else {
                if (run >= 3) {
                    const cells: [number, number][] = [];
                    for (let k = r - run; k < r; k++) cells.push([k, c]);
                    matched.push({ cells, dir: 'v', gem: cur.gem! });
                }
                run = 1;
            }
        }
    }

    return matched;
}

function hasValidMoves(grid: Cell[][], rows: number, cols: number): boolean {
    const swapAndCheck = (r1: number, c1: number, r2: number, c2: number) => {
        const h1 = grid[r1][c1];
        const h2 = grid[r2][c2];
        if (!h1.active || !h2.active || h1.obstacle === 'stone' || h2.obstacle === 'stone' || h1.iceHp === 2 || h2.iceHp === 2) return false;
        if (!h1.gem || !h2.gem) return false;

        // Special combinations are always valid moves
        if (h1.special === 'disco' || h2.special === 'disco') return true;
        if (h1.special !== 'none' && h2.special !== 'none') return true;

        // Swap temporarily
        const tmpSpecial = h1.special;
        const tmpGem = h1.gem;
        h1.gem = h2.gem;
        h1.special = h2.special;
        h2.gem = tmpGem;
        h2.special = tmpSpecial;

        let match = false;
        const matches = findMatches(grid, rows, cols);
        if (matches.length > 0) match = true;

        // Swap back
        h2.gem = h1.gem;
        h2.special = h1.special;
        h1.gem = tmpGem;
        h1.special = tmpSpecial;

        return match;
    };

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (c + 1 < cols && swapAndCheck(r, c, r, c + 1)) return true;
            if (r + 1 < rows && swapAndCheck(r, c, r + 1, c)) return true;
        }
    }
    return false;
}

// ──────────────────────────────────────────────────────────────
// DRAWING HELPERS
// ──────────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawStone(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
    const hs = size / 2;
    const grad = ctx.createRadialGradient(cx - hs * 0.2, cy - hs * 0.2, 2, cx, cy, hs * 0.9);
    grad.addColorStop(0, '#6b7280');
    grad.addColorStop(1, '#374151');
    roundRect(ctx, cx - hs, cy - hs, size, size, 10);
    ctx.fillStyle = grad;
    ctx.fill();
    // cracks
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 10); ctx.lineTo(cx + 5, cy + 3);
    ctx.moveTo(cx + 2, cy - 5); ctx.lineTo(cx - 5, cy + 12);
    ctx.stroke();
    // highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    roundRect(ctx, cx - hs + 2, cy - hs + 2, size - 4, size - 4, 8);
    ctx.stroke();
}

function drawChain(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
    const r = size / 2;
    // Chain links pattern
    ctx.save();
    ctx.strokeStyle = '#c0a060';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#8b6914';
    ctx.shadowBlur = 4;
    for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(cx + i * 8, cy + i * 6, 7, 5, Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

function drawSpecialMarker(ctx: CanvasRenderingContext2D, cx: number, cy: number, type: string, r: number) {
    if (type === 'crown') {
        ctx.save();
        ctx.font = `${Math.floor(r * 2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👑', cx, cy);
        ctx.restore();
        return;
    }
    if (type === 'key') {
        ctx.save();
        ctx.font = `${Math.floor(r * 2)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔑', cx, cy);
        ctx.restore();
        return;
    }

    ctx.save();
    ctx.fillStyle = type === 'disco' ? '#e74cff' : type === 'hbomb' ? '#3498ff' : type === 'bomb' ? '#ff3366' : '#ff9f43';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
}

// ──────────────────────────────────────────────────────────────
// UTILS
// ──────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function pickNoMatch(grid: Cell[][], r: number, c: number, gems: GemId[], rng: () => number): GemId {
    let tries = 0;
    while (tries++ < 20) {
        const gem = gems[Math.floor(rng() * gems.length)];
        if (r >= 2 && grid[r - 1][c]?.gem === gem && grid[r - 2][c]?.gem === gem) continue;
        if (c >= 2 && grid[r][c - 1]?.gem === gem && grid[r][c - 2]?.gem === gem) continue;
        return gem;
    }
    return gems[0];
}

function waitSettle(gs: GameState, ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

function computeStars(remainingTime: number, totalTime: number): number {
    const pct = remainingTime / totalTime;
    if (pct >= 0.50) return 3;
    if (pct >= 0.25) return 2;
    return 1;
}

// ──────────────────────────────────────────────────────────────
// UI FUNCTIONS
// ──────────────────────────────────────────────────────────────
function updateHUD(timeVal: number, score: number, levelId: number) {
    const mv = document.getElementById('moves-val');
    const sv = document.getElementById('score-val');
    const lb = document.getElementById('level-badge');
    const gameScreen = document.getElementById('game-screen');

    if (mv) {
        mv.textContent = String(timeVal);
        mv.style.color = timeVal <= 10 ? '#ef4444' : 'white';
    }
    if (sv) sv.textContent = score.toLocaleString();
    if (lb) lb.textContent = `LEVEL ${levelId}`;

    if (gameScreen) {
        if (timeVal <= 5 && timeVal > 0) {
            gameScreen.classList.remove('time-warning-pulse');
            gameScreen.classList.add('time-critical-pulse');
        } else if (timeVal <= 10 && timeVal > 0) {
            gameScreen.classList.remove('time-critical-pulse');
            gameScreen.classList.add('time-warning-pulse');
            if (timeVal === 10) {
                toast('⏰ HURRY! 10 Seconds Remaining!');
            }
        } else {
            gameScreen.classList.remove('time-warning-pulse');
            gameScreen.classList.remove('time-critical-pulse');
        }
    }
}

function updateGoalsUI(goals: Goal[], images: Map<number, HTMLImageElement>, worldIdx: number = 1) {
    const bar = document.getElementById('goals-bar');
    if (!bar) return;
    bar.innerHTML = goals.map(g => {
        const done = g.collected >= g.required;
        let html = '';
        if (g.type === 'gem' && g.gem !== undefined) {
            const img = getGemImage(worldIdx, g.gem);
            const src = img ? img.src : '';
            const colorArr = ['#f59e0b', '#a855f7', '#3b82f6', '#06b6d4', '#22c55e', '#ec4899', '#ef4444', '#ffd700', '#f97316', '#14b8a6', '#8b5cf6', '#e11d48'];
            const fallbackColor = colorArr[g.gem % colorArr.length];
            html = src ? `<img src="${src}" alt="">` : `<span style="width:34px;height:34px;display:block;background:${fallbackColor};border-radius:8px;"></span>`;
        } else {
            const sym: Record<string, string> = { 'ice': '🧊', 'stone': '🪨', 'chain': '⛓️', 'marble': '⚪', 'score': '⭐', 'treasure': '👑' };
            const icon = sym[g.type] ?? '🎯';

            if (g.type === 'score') {
                html = `<span style="font-size:18px;width:100%;display:inline-block;text-align:center;font-weight:900;">${g.required.toLocaleString()}</span>`;
            } else {
                html = `<span style="font-size:24px;width:34px;display:inline-block;text-align:center;line-height:34px;">${icon}</span>`;
            }
        }

        let label = `${g.collected}/${g.required}`;
        if (g.type === 'score') label = ''; // score displayed in icon html

        return `
      <div class="goal-chip ${done ? 'completed' : ''}">
        ${html}
        ${label ? `<span class="goal-text">${label}</span>` : ''}
      </div>`;
    }).join('');
}

function showVictoryModal(levelId: number, score: number, stars: number) {
    const modal = document.getElementById('victory-modal')!;
    const sv = document.getElementById('victory-score')!;
    const sub = document.getElementById('victory-sub')!;
    const starsRow = document.getElementById('stars-row')!;

    sv.textContent = score.toLocaleString();
    sub.textContent = stars === 3 ? '⚡ Perfect Clear!' : stars === 2 ? '🎯 Great Job!' : '👏 Level Clear!';

    const starEls = starsRow.querySelectorAll('.star-anim');
    starEls.forEach((el, i) => {
        el.classList.remove('show');
        setTimeout(() => { if (i < stars) el.classList.add('show'); }, 300 + i * 250);
    });

    modal.classList.remove('hidden');
}

function showModal(type: 'defeat' | 'victory' | 'pause' | 'cup') {
    document.getElementById(`${type}-modal`)!.classList.remove('hidden');
}

function hideModal(type: 'defeat' | 'victory' | 'pause' | 'cup') {
    document.getElementById(`${type}-modal`)!.classList.add('hidden');
}

function showCombo(n: number) {
    const el = document.getElementById('combo-display')!;
    el.textContent = `${n}x COMBO!`;
    el.classList.remove('burst');
    void el.offsetWidth; // reflow
    el.classList.add('burst');
}

function toast(msg: string) {
    const el = document.getElementById('toast')!;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
}

// ──────────────────────────────────────────────────────────────
// MENU BUILDER
// ──────────────────────────────────────────────────────────────
// MENU BUILDER (5-World Page Navigation System)
// ──────────────────────────────────────────────────────────────
interface WorldInfo {
    id: number;
    title: string;
    bgImage: string;
    startLevel: number;
    endLevel: number;
}

const WORLDS: WorldInfo[] = [
    { id: 1, title: '🏰 World 1 — Royal Garden', bgImage: '/icons/sections/World-1.JPG', startLevel: 1, endLevel: 20 },
    { id: 2, title: '🌌 World 2 — Crystal Caves', bgImage: '/icons/sections/World-2.JPG', startLevel: 21, endLevel: 40 },
    { id: 3, title: '🔥 World 3 — Fire Peaks', bgImage: '/icons/sections/World-3.JPG', startLevel: 41, endLevel: 60 },
    { id: 4, title: '🌊 World 4 — Ocean Depths', bgImage: '/icons/sections/World-4.JPG', startLevel: 61, endLevel: 80 },
    { id: 5, title: '👑 World 5 — Crown Palace', bgImage: '/icons/sections/World-5.JPG', startLevel: 81, endLevel: 100 }
];

// 20 Node coordinates per world (calibrated precisely to yellow stone path from bottom gate y:92% to top castle gate y:2%)
const WORLD1_NODE_COORDS: { x: number; y: number }[] = [
    { x: 51, y: 89 }, // Level 1
    { x: 61, y: 85 }, // Level 2
    { x: 62, y: 79 }, // Level 3
    { x: 52, y: 77 }, // Level 4
    { x: 40, y: 74 }, // Level 5
    { x: 41, y: 67 }, // Level 6
    { x: 54, y: 65 }, // Level 7
    { x: 68, y: 63 }, // Level 8
    { x: 67, y: 56 }, // Level 9
    { x: 56, y: 52 }, // Level 10
    { x: 42, y: 51 }, // Level 11
    { x: 32, y: 46 }, // Level 12
    { x: 44, y: 42 }, // Level 13
    { x: 56, y: 39 }, // Level 14
    { x: 66, y: 35 }, // Level 15
    { x: 56, y: 31 }, // Level 16
    { x: 42, y: 29 }, // Level 17
    { x: 50, y: 25 }, // Level 18
    { x: 57, y: 21 }, // Level 19
    { x: 51, y: 16 }, // Level 20
];

const WORLD2_NODE_COORDS: { x: number; y: number }[] = [
    { x: 86, y: 94 }, // Level 21
    { x: 82, y: 88 }, // Level 22
    { x: 73, y: 83 }, // Level 23
    { x: 62, y: 83 }, // Level 24
    { x: 50, y: 85 }, // Level 25
    { x: 39, y: 84 }, // Level 26
    { x: 36, y: 77 }, // Level 27
    { x: 45, y: 72 }, // Level 28
    { x: 59, y: 69 }, // Level 29
    { x: 71, y: 65 }, // Level 30
    { x: 79, y: 59 }, // Level 31
    { x: 69, y: 54 }, // Level 32
    { x: 55, y: 56 }, // Level 33
    { x: 38, y: 56 }, // Level 34
    { x: 40, y: 48 }, // Level 35
    { x: 57, y: 45 }, // Level 36
    { x: 69, y: 38 }, // Level 37
    { x: 50, y: 35 }, // Level 38
    { x: 46, y: 28 }, // Level 39
    { x: 50, y: 19 }, // Level 40
];
const WORLD3_NODE_COORDS: { x: number; y: number }[] = [
    { x: 85, y: 86 }, // Level 41
    { x: 78, y: 78 }, // Level 42
    { x: 66, y: 75 }, // Level 43
    { x: 52, y: 78 }, // Level 44
    { x: 36, y: 77 }, // Level 45
    { x: 38, y: 68 }, // Level 46
    { x: 52, y: 65 }, // Level 47
    { x: 64, y: 62 }, // Level 48
    { x: 76, y: 58 }, // Level 49
    { x: 75, y: 50 }, // Level 50
    { x: 58, y: 50 }, // Level 51
    { x: 43, y: 52 }, // Level 52
    { x: 39, y: 45 }, // Level 53
    { x: 53, y: 42 }, // Level 54
    { x: 67, y: 39 }, // Level 55
    { x: 61, y: 32 }, // Level 56
    { x: 47, y: 32 }, // Level 57
    { x: 39, y: 28 }, // Level 58
    { x: 51, y: 25 }, // Level 59
    { x: 50, y: 18 }, // Level 60
];

const WORLD4_NODE_COORDS: { x: number; y: number }[] = [
    { x: 86, y: 86 }, // Level 61
    { x: 81, y: 80 }, // Level 62
    { x: 69, y: 76 }, // Level 63
    { x: 53, y: 78 }, // Level 64
    { x: 37, y: 77 }, // Level 65
    { x: 39, y: 69 }, // Level 66
    { x: 53, y: 65 }, // Level 67
    { x: 65, y: 62 }, // Level 68
    { x: 78, y: 57 }, // Level 69
    { x: 71, y: 49 }, // Level 70
    { x: 57, y: 51 }, // Level 71
    { x: 42, y: 52 }, // Level 72
    { x: 37, y: 45 }, // Level 73
    { x: 48, y: 43 }, // Level 74
    { x: 61, y: 41 }, // Level 75
    { x: 69, y: 37 }, // Level 76
    { x: 61, y: 32 }, // Level 77
    { x: 42, y: 32 }, // Level 78
    { x: 46, y: 26 }, // Level 79
    { x: 51, y: 18 }, // Level 80
];

const WORLD5_NODE_COORDS: { x: number; y: number }[] = [
    { x: 85, y: 85 }, // Level 81
    { x: 79, y: 79 }, // Level 82
    { x: 67, y: 76 }, // Level 83
    { x: 53, y: 78 }, // Level 84
    { x: 40, y: 78 }, // Level 85
    { x: 35, y: 72 }, // Level 86
    { x: 46, y: 66 }, // Level 87
    { x: 60, y: 63 }, // Level 88
    { x: 73, y: 60 }, // Level 89
    { x: 79, y: 54 }, // Level 90
    { x: 69, y: 49 }, // Level 91
    { x: 55, y: 51 }, // Level 92
    { x: 40, y: 51 }, // Level 93
    { x: 43, y: 44 }, // Level 94
    { x: 56, y: 42 }, // Level 95
    { x: 68, y: 38 }, // Level 96
    { x: 61, y: 33 }, // Level 97
    { x: 48, y: 32 }, // Level 98
    { x: 44, y: 26 }, // Level 99
    { x: 50, y: 17 }, // Level 100
];

const NODE_POSITIONS = {
    world1: WORLD1_NODE_COORDS,
    world2: WORLD2_NODE_COORDS,
    world3: WORLD3_NODE_COORDS,
    world4: WORLD4_NODE_COORDS,
    world5: WORLD5_NODE_COORDS,
};

const NAV_POSITIONS = {
    nextButton: {
        world1: { x: 50, y: 4 },
        world2: { x: 50, y: 4 },
        world3: { x: 50, y: 4 },
        world4: { x: 50, y: 4 },
        world5: { x: 50, y: 4 },
    },
    prevButton: {
        world2: { x: 50, y: 95 },
        world3: { x: 50, y: 95 },
        world4: { x: 50, y: 95 },
        world5: { x: 50, y: 95 },
    }
};

function buildMenu(levels: LevelDef[], save: SaveData, onStart: (id: number) => void) {
    // Gem preview row
    const preview = document.getElementById('menu-gems-preview');
    if (preview) {
        preview.innerHTML = '';
        [2, 5, 6, 7, 3].forEach(id => {
            const img = GEM_IMAGES.get(id);
            if (img) {
                const el = document.createElement('img');
                el.src = img.src;
                preview.appendChild(el);
            }
        });
    }

    // Default active world page is the world of highest unlocked level
    let activeWorldIdx = Math.min(4, Math.max(0, Math.floor((save.highestLevel - 1) / 20)));

    const titleEl = document.getElementById('world-title-display');
    const dotsEl = document.getElementById('world-dots');
    const cardEl = document.getElementById('world-card');
    const nodesLayer = document.getElementById('world-nodes-layer');
    const svgEl = document.getElementById('world-svg-path');
    const btnNext = document.getElementById('btn-next-world');
    const nextTextEl = document.getElementById('next-btn-text');
    const btnPrev = document.getElementById('btn-prev-world');

    if (!cardEl || !nodesLayer) return;
    const targetCard = cardEl;
    const targetNodes = nodesLayer;

    function renderWorld(worldIdx: number) {
        activeWorldIdx = Math.min(4, Math.max(0, worldIdx));
        const world = WORLDS[activeWorldIdx];

        // 1. Header Title
        if (titleEl) titleEl.textContent = world.title;

        // 2. Dots
        if (dotsEl) {
            dotsEl.innerHTML = '';
            WORLDS.forEach((w, idx) => {
                const dot = document.createElement('div');
                dot.className = `world-dot ${idx === activeWorldIdx ? 'active' : ''}`;
                dot.title = w.title;
                dot.onclick = () => renderWorld(idx);
                dotsEl.appendChild(dot);
            });
        }

        // 3. Background Image
        targetCard.style.backgroundImage = `url('${world.bgImage}')`;

        // Check if all 20 levels in the current world are completed
        const isWorldComplete = save.highestLevel > world.endLevel ||
            (save.highestLevel === world.endLevel && (save.stars[world.endLevel] ?? 0) > 0);

        // 4. Nav Buttons
        // Next button (Top of path near gate - ONLY VISIBLE ONCE ALL 20 LEVELS ARE COMPLETED)
        if (btnNext) {
            btnNext.onclick = null;
            if (isWorldComplete) {
                if (activeWorldIdx < 4) {
                    btnNext.classList.remove('hidden');
                    if (nextTextEl) nextTextEl.textContent = 'NEXT WORLD →';
                    btnNext.onclick = () => renderWorld(activeWorldIdx + 1);
                } else {
                    // World 5 victory celebration when all 100 levels are completed
                    btnNext.classList.remove('hidden');
                    if (nextTextEl) nextTextEl.textContent = '🏆 YOU WIN!';
                    btnNext.onclick = () => {
                        const cupModal = document.getElementById('cup-modal');
                        if (cupModal) cupModal.classList.remove('hidden');
                    };
                }
            } else {
                btnNext.classList.add('hidden');
            }
        }

        // Prev button (Bottom of path - visible on Worlds 2-5)
        if (btnPrev) {
            btnPrev.onclick = null;
            if (activeWorldIdx > 0) {
                btnPrev.classList.remove('hidden');
                btnPrev.onclick = () => renderWorld(activeWorldIdx - 1);
            } else {
                btnPrev.classList.add('hidden');
            }
        }

        // 5. Render 20 Nodes
        targetNodes.innerHTML = '';
        const coordsKey = `world${activeWorldIdx + 1}` as keyof typeof NODE_POSITIONS;
        const coords = NODE_POSITIONS[coordsKey] || WORLD1_NODE_COORDS;

        for (let i = 0; i < 20; i++) {
            const levelId = world.startLevel + i;
            const coord = coords[i] || WORLD1_NODE_COORDS[i];
            const unlocked = levelId <= save.highestLevel;
            const isCurrent = levelId === save.highestLevel;
            const stars = save.stars[levelId] ?? 0;

            const btn = document.createElement('button');
            btn.className = `map-node-btn ${unlocked ? (isCurrent ? 'current' : 'unlocked') : 'locked'}`;
            btn.style.left = `${coord.x}%`;
            btn.style.top = `${coord.y}%`;

            if (unlocked) {
                btn.innerHTML = `
                    <span class="node-num">${levelId}</span>
                    <span class="node-stars">
                        ${[0, 1, 2].map(s => `<span class="${s < stars ? 'star-filled' : 'star-empty'}">★</span>`).join('')}
                    </span>
                `;
                btn.onclick = () => onStart(levelId);
            } else {
                btn.innerHTML = `
                    <span class="node-num">${levelId}</span>
                    <span class="node-lock">🔒</span>
                `;
            }

            targetNodes.appendChild(btn);
        }

        // 6. Draw SVG Path between nodes
        requestAnimationFrame(() => {
            if (!svgEl) return;
            const cardRect = targetCard.getBoundingClientRect();
            if (cardRect.width === 0 || cardRect.height === 0) return;

            const nodeBtns = targetNodes.querySelectorAll<HTMLElement>('.map-node-btn');
            const pts: { x: number; y: number }[] = [];
            nodeBtns.forEach(b => {
                const r = b.getBoundingClientRect();
                pts.push({
                    x: r.left - cardRect.left + r.width / 2,
                    y: r.top - cardRect.top + r.height / 2
                });
            });

            if (pts.length < 2) return;

            svgEl.innerHTML = '';
            let d = `M ${pts[0].x} ${pts[0].y}`;
            for (let k = 1; k < pts.length; k++) {
                const prev = pts[k - 1];
                const curr = pts[k];
                const my = (prev.y + curr.y) / 2;
                d += ` C ${prev.x} ${my}, ${curr.x} ${my}, ${curr.x} ${curr.y}`;
            }

            const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathEl.setAttribute('d', d);
            pathEl.setAttribute('fill', 'none');
            pathEl.setAttribute('stroke', 'rgba(255, 215, 0, 0.45)');
            pathEl.setAttribute('stroke-width', '4');
            pathEl.setAttribute('stroke-linecap', 'round');
            pathEl.setAttribute('stroke-dasharray', '8 6');
            svgEl.appendChild(pathEl);
        });

        // 7. Auto-scroll container to active node
        setTimeout(() => {
            const currentBtn = targetNodes.querySelector<HTMLElement>('.map-node-btn.current') ||
                targetNodes.querySelector<HTMLElement>('.map-node-btn.unlocked');
            if (currentBtn) {
                currentBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 120);
    }

    // Touch swipe support for switching worlds
    let touchStartX = 0;
    let touchStartY = 0;
    targetCard.ontouchstart = (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    };
    targetCard.ontouchend = (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0 && activeWorldIdx < 4) {
                renderWorld(activeWorldIdx + 1);
            } else if (dx > 0 && activeWorldIdx > 0) {
                renderWorld(activeWorldIdx - 1);
            }
        }
    };

    // Initial render
    renderWorld(activeWorldIdx);
}

// ──────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────
async function main() {
    const save = loadSave();
    const levels = buildLevels();

    // Preload active world without blocking initial menu startup
    const activeWorld = Math.floor((save.highestLevel - 1) / 20) + 1;
    loadWorldImages(activeWorld).then(() => {
        loadAllWorldImagesInBackground();
    }).catch(() => { });

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const gs = new GameState(canvas, levels, save);
    window.addEventListener('resize', () => gs.resize());

    // Initialize Economy & Monetization UI
    EconomyUI.init();
    EconomyUI.setGameState(gs);

    let activeLevel = 1;

    // ─── Screen switching ───
    function showScreen(id: 'start-screen' | 'menu-screen' | 'game-screen') {
        ['start-screen', 'menu-screen', 'game-screen'].forEach(s => {
            const el = document.getElementById(s);
            if (el) el.classList.toggle('hidden', s !== id);
        });

        // Hide top global economy bar during active gameplay so it NEVER covers the grid board!
        const econBar = document.getElementById('global-economy-bar');
        if (econBar) {
            econBar.style.display = id === 'game-screen' ? 'none' : 'flex';
        }

        if (id === 'game-screen') {
            // Stop start-game music when inside a level
            const audio = SOUNDS['startGame'];
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
            playLevelBgm();
        } else {
            // Stop level music when on start screen or level map menu
            stopLevelBgm();
            AdManager.hideBanner();
            if (id === 'menu-screen') {
                playSound('startGame');
            }
        }
    }

    // ─── Start level ───
    async function startLevel(id: number) {
        // Check Lives & Daily Free Attempts
        if (!EconomyManager.canStartLevel()) {
            toast('❌ No lives left! Watch an ad or buy lives to continue.');
            EconomyUI.showModal('lives-modal');
            return;
        }

        const worldIdx = Math.floor((id - 1) / 20) + 1;
        if (!loadedWorlds.has(worldIdx)) {
            await loadWorldImages(worldIdx);
        }

        // Consume life or free attempt
        EconomyManager.consumeLevelAttempt();
        BonusItemManager.resetLevelAttempt();

        activeLevel = id;
        gs.stopLoop();
        showScreen('game-screen');

        // Show banner ad during gameplay
        AdManager.showBanner();

        // Anti-frustration failure tracking & pity hints
        const failures = EconomyManager.getLevelFailures(id);
        if (failures >= 10) {
            toast('🌟 Pity Boost! +10 Extra Seconds Added!');
        } else if (failures >= 5) {
            toast('💡 Hint: Target frozen cells and chains first!');
        }

        // Update in-game 10 bonus gems bar
        EconomyUI.updateInGameBonusBar();

        // Set 100 level background image
        const localLevelNum = ((id - 1) % 20) + 1;      // 1 to 20
        const bgUrl = `/icons/background/world-${worldIdx}/${localLevelNum}.jpg`;

        const bgLayer = document.getElementById('bg-layer')!;
        const img = new Image();
        img.onload = () => {
            bgLayer.style.backgroundImage = `url('${bgUrl}')`;
            bgLayer.style.backgroundSize = 'cover';
            bgLayer.style.backgroundPosition = 'center';
            bgLayer.style.backgroundRepeat = 'no-repeat';
            bgLayer.style.opacity = '1';
        };
        img.onerror = () => {
            // Fallback color if background image fails
            const def = levels.find(l => l.id === id);
            bgLayer.style.backgroundImage = 'none';
            bgLayer.style.backgroundColor = def ? def.bg : '#0a0118';
            bgLayer.style.opacity = '1';
        };
        img.src = bgUrl;

        // Reset time warning vignette
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen) {
            gameScreen.classList.remove('time-warning-pulse');
            gameScreen.classList.remove('time-critical-pulse');
        }

        // Tutorial check for Level 1
        const tutorialOverlay = document.getElementById('tutorial-overlay');
        const skipBtn = document.getElementById('btn-skip-tutorial');
        const tutVideo = document.getElementById('tutorial-video') as HTMLVideoElement | null;

        const dismissTutorial = () => {
            if (tutorialOverlay && !tutorialOverlay.classList.contains('hidden')) {
                tutorialOverlay.classList.add('hidden');
                if (tutVideo) tutVideo.pause();
                localStorage.setItem('royal_gems_tutorial_done', 'true');
            }
        };

        if (id === 1 && !localStorage.getItem('royal_gems_tutorial_done')) {
            if (tutorialOverlay) tutorialOverlay.classList.remove('hidden');
            if (tutVideo) {
                tutVideo.currentTime = 0;
                tutVideo.play().catch(() => { });
            }
        } else {
            if (tutorialOverlay) tutorialOverlay.classList.add('hidden');
            if (tutVideo) tutVideo.pause();
        }

        if (tutorialOverlay) {
            tutorialOverlay.onclick = dismissTutorial;
        }
        if (skipBtn) {
            skipBtn.onclick = (e) => {
                e.stopPropagation();
                dismissTutorial();
            };
        }

        gs.startLevel(id);

        if (failures >= 10) {
            gs.levelTimer += 10;
            gs.levelTimerTotal += 10;
        }
    }

    // ─── Menu ───
    buildMenu(levels, save, startLevel);
    showScreen('start-screen');

    // Start Game button handler on landing screen
    const btnStartGame = document.getElementById('btn-start-game');
    if (btnStartGame) {
        const handleStartClick = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            playSound('startGame');
            showScreen('menu-screen');
        };
        btnStartGame.onclick = handleStartClick;
    }

    // First interaction bypass for browser autoplay policies
    const playStartSoundBypass = () => {
        playSound('startGame');
        document.removeEventListener('click', playStartSoundBypass);
        document.removeEventListener('touchend', playStartSoundBypass);
    };
    document.addEventListener('click', playStartSoundBypass);
    document.addEventListener('touchend', playStartSoundBypass);

    // ─── Canvas Input (Drag & Tap) ───
    function getCanvasPos(e: MouseEvent | TouchEvent): [number, number] {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        let cx: number, cy: number;
        if (e instanceof MouseEvent) {
            cx = (e.clientX - rect.left) * scaleX;
            cy = (e.clientY - rect.top) * scaleY;
        } else if (e.touches && e.touches.length > 0) {
            cx = (e.touches[0].clientX - rect.left) * scaleX;
            cy = (e.touches[0].clientY - rect.top) * scaleY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            cx = (e.changedTouches[0].clientX - rect.left) * scaleX;
            cy = (e.changedTouches[0].clientY - rect.top) * scaleY;
        } else {
            cx = 0; cy = 0;
        }
        return [cx, cy];
    }

    let isPointerActive = false;

    canvas.addEventListener('mousedown', (e) => {
        isPointerActive = true;
        const [x, y] = getCanvasPos(e);
        gs.handlePointerDown(x, y);
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isPointerActive) return;
        const [x, y] = getCanvasPos(e);
        gs.handlePointerMove(x, y);
    });

    window.addEventListener('mouseup', () => {
        if (isPointerActive) {
            isPointerActive = false;
            gs.handlePointerUp();
        }
    });

    canvas.addEventListener('touchstart', (e) => {
        isPointerActive = true;
        const [x, y] = getCanvasPos(e);
        gs.handlePointerDown(x, y);
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        if (!isPointerActive) return;
        const [x, y] = getCanvasPos(e);
        gs.handlePointerMove(x, y);
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
        if (isPointerActive) {
            isPointerActive = false;
            gs.handlePointerUp();
        }
    });

    // ─── Resize ───
    window.addEventListener('resize', () => {
        if (!document.getElementById('game-screen')!.classList.contains('hidden')) {
            gs.resize();
        }
    });

    // ─── HUD buttons ───
    document.getElementById('btn-menu')!.onclick = () => {
        gs.stopLoop();
        hideModal('victory');
        hideModal('defeat');
        showScreen('menu-screen');
    };
    document.getElementById('btn-restart')!.onclick = () => {
        hideModal('defeat');
        gs.stopLoop();
        startLevel(activeLevel);
    };

    // ─── Victory modal ───
    document.getElementById('btn-next-level')!.onclick = () => {
        hideModal('victory');
        const next = Math.min(100, activeLevel + 1);
        startLevel(next);
    };
    document.getElementById('btn-back-menu-win')!.onclick = () => {
        hideModal('victory');
        gs.stopLoop();
        showScreen('menu-screen');
        // Rebuild menu to show stars updates
        buildMenu(levels, save, startLevel);
    };

    // ─── Defeat modal ───
    document.getElementById('btn-retry')!.onclick = () => {
        hideModal('defeat');
        gs.stopLoop();
        startLevel(activeLevel);
    };
    document.getElementById('btn-back-menu-lose')!.onclick = () => {
        hideModal('defeat');
        gs.stopLoop();
        gs.stopLevelTimer();
        showScreen('menu-screen');
    };
    document.getElementById('btn-continue-money')!.onclick = () => {
        const money = loadMoney();
        if (money < 50) {
            toast('❌ Not enough money! Earn $50 by completing levels.');
            return;
        }
        saveMoney(money - 50);
        toast('💰 -$50 — Keep going!');
        hideModal('defeat');
        // Stop menu music since we're staying in-game
        const menuAudio = SOUNDS['startGame'];
        if (menuAudio) { menuAudio.pause(); menuAudio.currentTime = 0; }
        // Add 30 more seconds and resume
        gs.levelTimer = 30;
        gs.gameOver = false;
        gs.busy = false;
        gs.startLevelTimer();
        gs.startLoop();
    };

    // ─── Pause button ───
    document.getElementById('btn-pause')!.onclick = () => gs.togglePause();

    // ─── Pause modal resume ───
    document.getElementById('btn-resume')!.onclick = () => gs.togglePause();
    document.getElementById('btn-back-menu-pause')!.onclick = () => {
        hideModal('pause');
        gs.stopLoop();
        gs.stopLevelTimer();
        gs.paused = false;
        const btn = document.getElementById('btn-pause');
        if (btn) btn.textContent = '⏸';
        showScreen('menu-screen');
        // Rebuild menu to show stars updates
        buildMenu(levels, save, startLevel);
    };

    // ─── Grand Cup Modal ───
    document.getElementById('btn-cup-close')!.onclick = () => {
        hideModal('cup');
        gs.stopLoop();
        gs.stopLevelTimer();
        showScreen('menu-screen');
        buildMenu(levels, save, startLevel);
    };
}

main();
