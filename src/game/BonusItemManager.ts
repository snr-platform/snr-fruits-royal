// ============================================================
// ROYAL GEMS - Bonus Item Manager
// Controls activation of all 10 Bonus Items in active gameplay
// ============================================================

import { EconomyManager, BONUS_ITEM_DEFINITIONS } from '../utils/EconomyManager';

export class BonusItemManager {
    private static activatedThisAttempt: boolean = false;

    public static resetLevelAttempt(): void {
        this.activatedThisAttempt = false;
    }

    public static isActivatedThisAttempt(): boolean {
        return this.activatedThisAttempt;
    }

    public static async activateBonus(id: number, gs: any): Promise<{ success: boolean; message: string }> {
        if (this.activatedThisAttempt) {
            return { success: false, message: "⚠️ Only 1 bonus item allowed per attempt!" };
        }

        if (EconomyManager.getBonusQty(id) <= 0) {
            return { success: false, message: "❌ You don't own this bonus item!" };
        }

        if (gs.busy || gs.gameOver || gs.levelComplete || gs.paused) {
            return { success: false, message: "⚠️ Game is busy or paused!" };
        }

        const def = BONUS_ITEM_DEFINITIONS[id];
        if (!def) return { success: false, message: "Invalid bonus item!" };

        // Consume item
        if (!EconomyManager.consumeBonusItem(id)) {
            return { success: false, message: "Failed to consume bonus item." };
        }

        this.activatedThisAttempt = true;

        // Apply bonus effect
        switch (id) {
            case 1: // 🎯 Extra Move (+15s time)
                gs.levelTimer += 15;
                gs.levelTimerTotal += 15;
                gs.burst(gs.canvas.width / 2, gs.canvas.height / 2, '#38bdf8');
                break;

            case 2: // ⭐ Star Boost (+5000 pts)
                gs.score += 5000;
                gs.burst(gs.canvas.width / 2, gs.canvas.height / 2, '#ffd700');
                break;

            case 3: // 💎 Gem Magnet (clears most frequent color)
            case 9: { // 🌈 Rainbow (clears 1 color)
                const counts: Record<number, number> = {};
                for (let r = 0; r < gs.rows; r++) {
                    for (let c = 0; c < gs.cols; c++) {
                        const gem = gs.grid[r][c]?.gem;
                        if (gem !== null && gem !== undefined && gs.grid[r][c].active && gs.grid[r][c].obstacle === 'none') {
                            counts[gem] = (counts[gem] || 0) + 1;
                        }
                    }
                }
                const sortedGems = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a]);
                if (sortedGems.length > 0) {
                    const targetGem = sortedGems[0];
                    for (let r = 0; r < gs.rows; r++) {
                        for (let c = 0; c < gs.cols; c++) {
                            if (gs.grid[r][c]?.gem === targetGem) {
                                gs.explodeCell(r, c, targetGem);
                            }
                        }
                    }
                }
                break;
            }

            case 4: // 🔄 Shuffle
                await gs.checkAndShuffle();
                break;

            case 5: { // 🎁 Mystery Box (random coins or bonus)
                const rewardType = Math.random() > 0.5 ? 'coins' : 'bonus';
                if (rewardType === 'coins') {
                    const coins = Math.floor(Math.random() * 150) + 50; // 50-200 coins
                    EconomyManager.addCoins(coins);
                    return { success: true, message: `🎁 Mystery Box gave 💰 +${coins} Coins!` };
                } else {
                    const randBonusId = Math.floor(Math.random() * 10) + 1;
                    EconomyManager.addBonusItem(randBonusId, 1);
                    const bDef = BONUS_ITEM_DEFINITIONS[randBonusId];
                    return { success: true, message: `🎁 Mystery Box gave 🎁 1x ${bDef.name}!` };
                }
            }

            case 6: { // ⚡ Lightning (Cross blast)
                const midR = Math.floor(gs.rows / 2);
                const midC = Math.floor(gs.cols / 2);
                const cellsToFlash: [number, number][] = [];
                for (let c = 0; c < gs.cols; c++) {
                    gs.explodeCell(midR, c);
                    cellsToFlash.push([midR, c]);
                }
                for (let r = 0; r < gs.rows; r++) {
                    gs.explodeCell(r, midC);
                    cellsToFlash.push([r, midC]);
                }
                gs.flashLightning(cellsToFlash);
                break;
            }

            case 7: // ❄️ Freeze (+10s freeze time)
                gs.levelTimer += 10;
                gs.burst(gs.canvas.width / 2, gs.canvas.height / 2, '#06b6d4');
                break;

            case 8: // 🔨 Hammer (Smash all obstacles on board)
                for (let r = 0; r < gs.rows; r++) {
                    for (let c = 0; c < gs.cols; c++) {
                        const cell = gs.grid[r][c];
                        if (cell && cell.active && cell.obstacle !== 'none') {
                            cell.obstacle = 'none';
                            cell.iceHp = 0;
                            cell.chainHp = 0;
                            cell.marbleHp = 0;
                            gs.burst(cell.x, cell.y, '#f97316');
                        }
                    }
                }
                break;

            case 10: // 👑 Crown (+1000 pts & collect treasure)
                gs.score += 1000;
                gs.collectGoal('treasure');
                gs.burst(gs.canvas.width / 2, gs.canvas.height / 2, '#fcd34d');
                break;
        }

        return { success: true, message: `✨ ${def.name} Activated!` };
    }
}
