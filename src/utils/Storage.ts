const STORAGE_KEYS = {
    HIGHEST_LEVEL: 'royal_puzzle_highest_level',
    LEVEL_STARS: 'royal_puzzle_stars_',
    LEVEL_SCORE: 'royal_puzzle_score_',
    SOUND_ENABLED: 'royal_puzzle_sound',
    COMPLETED_COUNT: 'royal_puzzle_completed_count'
};

export class Storage {
    static getHighestUnlockedLevel(): number {
        const val = localStorage.getItem(STORAGE_KEYS.HIGHEST_LEVEL);
        return val ? parseInt(val, 10) : 1;
    }

    static setHighestUnlockedLevel(level: number): void {
        const current = this.getHighestUnlockedLevel();
        if (level > current) {
            localStorage.setItem(STORAGE_KEYS.HIGHEST_LEVEL, level.toString());
        }
    }

    static getLevelStars(level: number): number {
        const val = localStorage.getItem(STORAGE_KEYS.LEVEL_STARS + level);
        return val ? parseInt(val, 10) : 0;
    }

    static setLevelStars(level: number, stars: number): void {
        const current = this.getLevelStars(level);
        if (stars > current) {
            localStorage.setItem(STORAGE_KEYS.LEVEL_STARS + level, stars.toString());
        }
    }

    static getLevelHighScore(level: number): number {
        const val = localStorage.getItem(STORAGE_KEYS.LEVEL_SCORE + level);
        return val ? parseInt(val, 10) : 0;
    }

    static setLevelHighScore(level: number, score: number): void {
        const current = this.getLevelHighScore(level);
        if (score > current) {
            localStorage.setItem(STORAGE_KEYS.LEVEL_SCORE + level, score.toString());
        }
    }

    static isSoundEnabled(): boolean {
        const val = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
        return val !== null ? val === 'true' : true;
    }

    static setSoundEnabled(enabled: boolean): void {
        localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, enabled.toString());
    }

    static toggleSound(): boolean {
        const nextState = !this.isSoundEnabled();
        this.setSoundEnabled(nextState);
        return nextState;
    }

    static saveLevelProgress(level: number, stars: number, score: number): void {
        this.setLevelStars(level, stars);
        this.setLevelHighScore(level, score);
        this.setHighestUnlockedLevel(level + 1);
        this.incrementCompletedLevelsCount();
    }

    static getCompletedLevelsCount(): number {
        const val = localStorage.getItem(STORAGE_KEYS.COMPLETED_COUNT);
        return val ? parseInt(val, 10) : 0;
    }

    static incrementCompletedLevelsCount(): number {
        const count = this.getCompletedLevelsCount() + 1;
        localStorage.setItem(STORAGE_KEYS.COMPLETED_COUNT, count.toString());
        return count;
    }
}
