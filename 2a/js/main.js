// Main game controller
class Game {
    constructor() {
        // Core game properties
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        this.deltaTime = 0;
        this.running = false;
        this.debugMode = false;
        
        // Game systems
        this.player = null;
        this.world = null;
        this.physics = null;
        this.items = null;
        this.inventory = null;
        this.crafting = null;
        this.animals = null;
        this.ui = null;
        
        // Game settings
        this.settings = {
            resourceAmount: 'medium',
            playerSpeed: 5,
            playerHeight: 1.8
        };
        
        // Initialization state
        this.initialized = false;
        this.loadingFailed = false;
        
        // Initialize game systems
        this.init();
    }
    
    init() {
        // Check if Three.js is available
        if (typeof THREE === 'undefined') {
            this.showError('Three.js library failed to load. Please check your internet connection and reload the page.');
            return;
        }
        
        // Try-catch to handle any initialization errors
        try {
            console.log('Initializing game...');
            
            // Setup event listeners for the start menu
            this.setupEventListeners();
            
            // Initialize asset loader
            this.initAssetLoader();
            
            // Start preloading assets
            this.preloadAssets();
        } catch (error) {
            this.showError(`Initialization error: ${error.message}`);
            console.error('Game initialization error:', error);
        }
    }
    
    setupEventListeners() {
        // Setup start menu listeners
        const startGameButton = document.getElementById('start-game');
        if (startGameButton) {
            startGameButton.addEventListener('click', () => this.startGame());
        } else {
            console.warn('Start game button not found in the DOM.');
        }
        
        const retryButton = document.getElementById('retry-button');
        if (retryButton) {
            retryButton.addEventListener('click', () => location.reload());
        }
        
        // Setup settings listeners
        const resourceAmount = document.getElementById('resource-amount');
        if (resourceAmount) {
            resourceAmount.addEventListener('change', (e) => {
                this.settings.resourceAmount = e.target.value;
            });
        }
        
        const playerSpeed = document.getElementById('player-speed');
        if (playerSpeed) {
            playerSpeed.addEventListener('input', (e) => {
                this.settings.playerSpeed = parseFloat(e.target.value);
            });
        }
        
        const playerHeight = document.getElementById('player-height');
        if (playerHeight) {
            playerHeight.addEventListener('input', (e) => {
                this.settings.playerHeight = parseFloat(e.target.value);
            });
        }
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Handle visibility change for pausing game when tab is not active
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onVisibilityHidden();
            } else {
                this.onVisibilityVisible();
            }
        });
    }
    
    onVisibilityHidden() {
        // Pause game or reduce updates when tab is not active
        if (this.running) {
            console.log('Game paused due to tab inactive');
            // We could pause the game loop here, but for now we'll just let it run slower
        }
    }
    
    onVisibilityVisible() {
        // Resume game when tab becomes active again
        if (this.running) {
            console.log('Game resumed');
            // Reset the clock to prevent large delta time after tab becomes active
            if (this.clock) {
                this.clock.getDelta(); // Clear accumulated delta time
            }
        }
    }
    
    initAssetLoader() {
        this.assetLoader = new AssetLoader();
        
        // Setup progress callback
        this.assetLoader.onProgress = (progress) => {
            const progressBar = document.querySelector('.progress');
            const loadingMessage = document.getElementById('loading-message');
            
            if (progressBar) {
                progressBar.style.width = `${progress * 100}%`;
            }
            
            if (loadingMessage) {
                loadingMessage.textContent = `Loading game assets... ${Math.floor(progress * 100)}%`;
            }
        };
    }
    
    preloadAssets() {
        console.log('Preloading assets...');
        
        // Add all necessary game assets to load
        this.assetLoader.addModel('tree', 'assets/models/tree.glb');
        this.assetLoader.addModel('rock', 'assets/models/rock.glb');
        this.assetLoader.addModel('barrel', 'assets/models/barrel.glb');
        this.assetLoader.addModel('building', 'assets/models/building.glb');
        this.assetLoader.addModel('grass', 'assets/models/grass.glb');
        this.assetLoader.addModel('deer', 'assets/models/deer.glb');
        this.assetLoader.addModel('rabbit', 'assets/models/rabbit.glb');
        this.assetLoader.addModel('axe', 'assets/models/axe.glb');
        this.assetLoader.addModel('pickaxe', 'assets/models/pickaxe.glb');
        this.assetLoader.addModel('knife', 'assets/models/knife.glb');
        this.assetLoader.addModel('canteen', 'assets/models/canteen.glb');
        
        this.assetLoader.addTexture('terrain', 'assets/textures/terrain.jpg');
        this.assetLoader.addTexture('water', 'assets/textures/water.jpg');
        this.assetLoader.addTexture('item_icons', 'assets/textures/item_icons.png');
        
        // Start loading and setup callback
        this.assetLoader.loadAll().then(() => {
            console.log('Assets loaded successfully!');
            this.setupSystems();
        }).catch(error => {
            console.warn('Some assets failed to load:', error);
            // Still attempt to setup systems with fallback assets
            this.setupSystems();
        });
    }
    
    setupSystems() {
        try {
            console.log('Setting up game systems...');
            
            // Create renderer with error handling
            this.setupRenderer();
            
            // Create scene
            this.scene = new THREE.Scene();
            
            // Create camera with proper aspect ratio
            this.setupCamera();
            
            // Initialize all game systems
            this.initializeGameSystems();
            
            // Everything is ready, show the start menu
            this.initialized = true;
            this.hideLoadingScreen();
            
            console.log('Game initialized successfully!');
        } catch (error) {
            this.showError(`Failed to setup game systems: ${error.message}`);
            console.error('Setup systems error:', error);
        }
    }
    
    setupRenderer() {
        try {
            // Create the renderer with antialiasing
            this.renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                powerPreference: 'high-performance' 
            });
            
            // Set renderer properties
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.setClearColor(0x87CEEB); // Sky blue
            
            // Add to DOM
            const gameContainer = document.getElementById('game-container');
            if (gameContainer) {
                gameContainer.appendChild(this.renderer.domElement);
            } else {
                document.body.appendChild(this.renderer.domElement);
                console.warn('Game container not found, appending renderer to body.');
            }
        } catch (error) {
            throw new Error(`WebGL renderer creation failed: ${error.message}`);
        }
    }
    
    setupCamera() {
        // Create camera with proper aspect ratio
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    }
    
    initializeGameSystems() {
        // Initialize systems in the right order with proper references
        this.physics = new Physics();
        this.world = new World(this.scene, this.physics, this.assetLoader);
        this.items = new ItemManager(this.assetLoader);
        this.inventory = new Inventory(this.items);
        this.crafting = new CraftingSystem(this.inventory, this.items);
        this.player = new Player(this.camera, this.scene, this.physics, this.settings);
        this.animals = new AnimalManager(this.scene, this.world, this.physics, this.assetLoader);
        this.ui = new UI(this.inventory, this.crafting, this.player);
        
        // Set cross-references between systems
        this.player.setInventory(this.inventory);
        this.player.setWorld(this.world);
        this.ui.setGame(this);
        this.animals.world = this.world; // Ensure animals have world reference
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }
    
    startGame() {
        if (this.running || !this.initialized) return;
        
        console.log('Starting game...');
        
        try {
            // Apply settings to player
            this.player.applySettings(this.settings);
            
            // Generate world based on settings
            this.world.generate(this.settings.resourceAmount);
            
            // Setup initial inventory
            this.setupInitialInventory();
            
            // Spawn animals
            this.animals.spawnAnimals();
            
            // Hide start menu
            const startMenu = document.getElementById('start-menu');
            if (startMenu) {
                startMenu.style.display = 'none';
            }
            
            // Initialize UI
            this.ui.initialize();
            
            // Start player controls
            this.player.initControls();
            
            // Start game loop
            this.running = true;
            this.animate();
            
            console.log('Game started successfully!');
        } catch (error) {
            this.showError(`Failed to start game: ${error.message}`);
            console.error('Game start error:', error);
        }
    }
    
    setupInitialInventory() {
        // Add essential starting equipment
        this.inventory.addItem('axe', 1);
        this.inventory.addItem('pickaxe', 1);
        this.inventory.addItem('knife', 1);
        this.inventory.addItem('canteen', 1);
        
        // Add resources based on selected difficulty
        const resourceMultiplier = {
            'low': 1,
            'medium': 3,
            'high': 10
        }[this.settings.resourceAmount] || 3; // Default to medium if invalid
        
        this.inventory.addItem('wood', 5 * resourceMultiplier);
        this.inventory.addItem('stone', 5 * resourceMultiplier);
        
        // Add food and water based on difficulty
        if (resourceMultiplier > 1) {
            this.inventory.addItem('cooked_meat', resourceMultiplier);
        }
    }
    
    animate() {
        if (!this.running) return;
        
        // Request next frame
        requestAnimationFrame(() => this.animate());
        
        try {
            // Calculate delta time with max value to prevent large jumps
            this.deltaTime = Math.min(0.1, this.clock.getDelta());
            
            // Update all game systems
            this.updateGameSystems();
            
            // Render the scene
            this.renderer.render(this.scene, this.camera);
        } catch (error) {
            console.error('Animation loop error:', error);
            // Don't stop the game loop for non-critical errors
        }
    }
    
    updateGameSystems() {
        // Update systems in the correct order
        this.physics.update(this.deltaTime);
        this.player.update(this.deltaTime);
        this.world.update(this.deltaTime);
        this.animals.update(this.deltaTime, this.player);
        this.ui.update();
    }
    
    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        
        // Update camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    showError(message) {
        console.error('GAME ERROR:', message);
        
        // Show error screen in UI
        const errorScreen = document.getElementById('error-screen');
        const errorMessage = document.getElementById('error-message');
        
        if (errorScreen) {
            errorScreen.classList.remove('hidden');
        }
        
        if (errorMessage) {
            errorMessage.textContent = message;
        }
        
        this.loadingFailed = true;
    }
}

// Initialize the game when the window loads
window.addEventListener('load', () => {
    console.log('Window loaded, initializing game...');
    try {
        window.game = new Game();
    } catch (error) {
        console.error('Critical error initializing game:', error);
        // Show a basic error message if the game class failed to initialize
        alert('Failed to initialize game. Please check the console for errors and try again.');
    }
});