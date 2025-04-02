// js/main.js

const Game = {
    scene: null,
    camera: null,
    renderer: null,
    clock: new THREE.Clock(),
    isReady: false,
    isPaused: true, // Start paused until player clicks

    init() {
        // --- Essential: Check if Three.js is loaded ---
        if (typeof THREE === 'undefined') {
            console.error("THREE is not defined. Make sure three.min.js is loaded correctly.");
            const errorMsg = document.getElementById('threejs-error');
             const blocker = document.getElementById('blocker');
             const instructions = document.getElementById('instructions');
             const settingsDiv = document.getElementById('settings');
            if (errorMsg) errorMsg.style.display = 'block';
             if (blocker) blocker.style.display = 'flex'; // Show blocker with error
             if (instructions) instructions.style.display = ''; // Show instructions div
             if (settingsDiv) settingsDiv.style.display = 'none'; // Hide settings if error
            return; // Stop initialization
        }

        // Basic Scene Setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue background
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 150); // Add fog

        // Camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true; // Enable shadows
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

        const gameContainer = document.getElementById('game-container');
        if (!gameContainer) {
             console.error("Game container div not found!");
             return;
        }
        gameContainer.appendChild(this.renderer.domElement);


        // Initialize UI (but don't show inventory yet)
        UI.init();
        // Hide inventory initially
        UI.toggleInventory(false);


        // Event Listeners
        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        // Don't start game logic yet, wait for Start button click
        Utils.logMessage("Engine initialized. Waiting for settings...");

        // Show blocker with settings
        document.getElementById('blocker').style.display = 'flex';
        document.getElementById('instructions').style.display = '';
    },

    // Called when the Start Game button is clicked
    start(settings) {
         Utils.logMessage("Starting game with settings:", settings);

        // Initialize Inventory (with resource multiplier)
        Inventory.init(settings.resourceMultiplier);

        // Initialize World (needs scene)
        World.init(this.scene);

        // Initialize Player (needs camera, scene, renderer.domElement, settings)
        Player.init(this.camera, this.scene, this.renderer.domElement, settings);

        this.isReady = true;
        this.isPaused = true; // Start paused, player needs to click to lock pointer

         Utils.logMessage("Game ready. Click to play.");

        // Start the animation loop AFTER everything is initialized
        this.animate();
    },


    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    animate() {
        requestAnimationFrame(this.animate.bind(this)); // Loop

        const deltaTime = this.clock.getDelta();

        // Update game state only if not paused and ready
        if (this.isReady && !this.isPaused && Player.controls && Player.controls.isLocked) {

            // Update Player movement and collision
            Player.update(deltaTime, World.collidableObjects);

            // Update World elements (like animals)
            World.updateAnimals(deltaTime);

            // Update other game logic (hunger, thirst, day/night cycle - future)

        } else if (this.isReady && !this.isPaused && Player.controls && !Player.controls.isLocked && UI.inventoryVisible) {
             // Allow UI interaction (like crafting) even if pointer is not locked but inventory is open
             // No updates needed here currently, but placeholder for potential UI-specific logic
        }


        // Always render the scene
        this.renderer.render(this.scene, this.camera);
    }
};

// Initialize the game engine components when the script loads
Game.init();

// Make Game object accessible globally if needed for debugging or extensions
window.Game = Game;