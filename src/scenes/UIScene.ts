import { UIManager } from '../ui/UIManager';

export class UIScene {
    public uiManager: UIManager;

    constructor(uiManager: UIManager) {
        this.uiManager = uiManager;
    }

    public showMenu(): void {
        this.uiManager.showMenuScreen();
    }

    public showGameplay(): void {
        this.uiManager.hideMenuScreen();
        this.uiManager.hud.show();
    }
}
