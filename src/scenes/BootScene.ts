import * as THREE from 'three';

export class BootScene {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    public container: HTMLElement;

    constructor(container: HTMLElement) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f172a);
        this.scene.fog = new THREE.FogExp2(0x0f172a, 0.035);

        // Setup Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
        this.camera.position.set(0, 8.5, 7.5);
        this.camera.lookAt(0, 0, 0);

        // Setup WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        this.container.appendChild(this.renderer.domElement);

        this.setupLighting();
        this.handleResize();
    }

    private setupLighting(): void {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xfff5ea, 1.2);
        dirLight.position.set(5, 12, 6);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 25;
        dirLight.shadow.camera.left = -6;
        dirLight.shadow.camera.right = 6;
        dirLight.shadow.camera.top = 6;
        dirLight.shadow.camera.bottom = -6;
        dirLight.shadow.bias = -0.0005;
        this.scene.add(dirLight);

        const rimLight = new THREE.DirectionalLight(0x7e22ce, 0.6);
        rimLight.position.set(-5, -2, -5);
        this.scene.add(rimLight);
    }

    public handleResize(): void {
        window.addEventListener('resize', () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        });
    }

    public render(): void {
        this.renderer.render(this.scene, this.camera);
    }
}
