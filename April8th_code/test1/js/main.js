// js/main.js
class Game {
    constructor() {
        // --- Core Components ---
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();

        // --- Game Systems ---
        this.world = null; // Initialized early now
        this.player = null;
        this.inputHandler = null;
        this.uiManager = null;
        this.inventoryManager = null;
        this.craftingSystem = null;
        this.buildingSystem = null;
        this.cameraController = null;
        this.aiEntities = []; // Keep track of AI controllers globally if needed? Or handled by World.

        // --- State ---
        this.isPaused = false;

        // --- Initialization ---
        this.init();
        this.animate();
    }

    init() {
        // --- Renderer ---
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('gameCanvas'),
            antialias: true // Enable anti-aliasing for smoother edges
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio); // Adjust for high DPI screens
        this.renderer.shadowMap.enabled = true; // Enable shadows
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows look nicer

        // --- Scene ---
        this.scene = new THREE.Scene();

        // --- Camera ---
        this.camera = new THREE.PerspectiveCamera(
            75, // Field of View (degrees)
            window.innerWidth / window.innerHeight, // Aspect Ratio
            0.1, // Near clipping plane
            1000 // Far clipping plane
        );
        // Set initial camera position - Controller will override this quickly
        this.camera.position.set(0, 5, 10);

        // --- Initialize World EARLY ---
        // Create the World instance now so its properties (like worldSize) are available
        // 'this' (the game instance) is passed so world can access scene, etc.
        this.world = new World(this); // <-- MOVED EARLIER

        // --- Lighting (Now can safely access this.world.worldSize) ---
        const ambientLight = new THREE.AmbientLight(
            0xcccccc, // Color of the light (light gray)
            0.6 // Intensity
        );
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // White light, strong intensity
        directionalLight.position.set(30, 50, 20); // Position the light source (acts like sun)
        directionalLight.castShadow = true; // Allow this light to cast shadows

        // Configure shadow properties for performance/quality trade-off
        directionalLight.shadow.mapSize.width = 2048; // Higher resolution shadows
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5; // How close shadows start
        directionalLight.shadow.camera.far = 150; // How far shadows render

        // Define the area covered by the directional light's shadows
        // Use the worldSize from the now-instantiated world object
        const shadowCamSize = this.world.worldSize / 1.5; // Adjust coverage area (smaller value = tighter focus)
        directionalLight.shadow.camera.left = -shadowCamSize;
        directionalLight.shadow.camera.right = shadowCamSize;
        directionalLight.shadow.camera.top = shadowCamSize;
        directionalLight.shadow.camera.bottom = -shadowCamSize;

        this.scene.add(directionalLight);
        // Optional: Add a target for the light if you want it to point somewhere specific
        // By default, it points towards (0,0,0) from its position.
        directionalLight.target.position.set(0, 0, 0);
        this.scene.add(directionalLight.target); // Important to add the target to the scene as well


        // --- Initialize Remaining Game Systems (Order can matter!) ---
        this.inputHandler = new InputHandler(this);
        this.inventoryManager = new InventoryManager(this); // Needs game access (e.g., for UI updates)
        this.uiManager = new UIManager(this); // Needs game access (player stats, inventory)
        this.craftingSystem = new CraftingSystem(this); // Needs game access (inventory)
        this.buildingSystem = new BuildingSystem(this); // Needs game access (scene, inventory)
        // this.world = new World(this); // Already initialized above
        this.player = new Player(this); // Needs game access (scene, world collision, input)
        this.cameraController = new ThirdPersonCamera(this.camera, this.player.mesh); // Needs camera + player mesh
        this.player.cameraController = this.cameraController; // Link camera controller to player for movement direction


        // --- World Generation ---
        // Now that all systems needing the world reference *could* potentially have it,
        // call the world's generate function to populate the scene.
        this.world.generate();


        // --- Initial Game Setup ---
        this.inventoryManager.addStarterItems(); // Give player initial gear
        this.uiManager.updateQuickBar(); // Refresh UI for quick bar
        this.uiManager.updateInventory(); // Refresh UI for inventory (though hidden)


        // --- Event Listeners ---
        // Handle browser window resizing
        window.addEventListener('resize', () => this.onWindowResize());

        // Handle Pointer Lock for mouse control (improves camera movement)
        const canvas = document.getElementById('gameCanvas');
        canvas.addEventListener('click', () => {
            // Request pointer lock only if game isn't paused and pointer isn't already locked
            if (!this.isPaused && document.pointerLockElement !== canvas) {
                canvas.requestPointerLock().catch(err => {
                    console.error("Pointer lock request failed. User interaction needed?", err);
                    // Browsers often require a direct user action (like click) to grant pointer lock.
                });
            }
        });

        // Listen for changes in pointer lock status (e.g., user pressing Esc)
        document.addEventListener('pointerlockchange', () => this.handlePointerLockChange(), false);


        console.log("Game Initialized Successfully");
    }

    // --- Core Game Loop ---
    animate() {
        // Request the next frame from the browser
        requestAnimationFrame(() => this.animate());

        // Calculate time elapsed since the last frame
        const deltaTime = this.clock.getDelta();

        // --- Input Handling ---
        // Process any input actions that trigger state changes (like opening menus)
        // Do this *before* updating game logic that might depend on that state.
        this.handleGlobalInput();

        // --- Update Game Logic (only if not paused) ---
        if (!this.isPaused) {
            this.player.update(deltaTime, this.inputHandler);
            this.world.update(deltaTime); // Updates AI, potentially other world systems
            this.cameraController.update(deltaTime, this.inputHandler);

            // Update building placement preview if the player is in build mode
            if (this.buildingSystem.isBuilding) {
                this.buildingSystem.update(this.camera, this.inputHandler.mouse);
            }
        } else {
            // Update things that might still happen while paused (e.g., UI animations)
            // Currently none needed here.
        }

        // --- Reset Input States ---
        // Reset one-time actions (like jump press, interact press) and delta movements
        // This prevents actions from repeating every frame if the key is held down (unless intended).
        this.inputHandler.resetActions();

        // --- Rendering ---
        // Render the scene from the perspective of the camera
        this.renderer.render(this.scene, this.camera);
    }

    // --- Input Processing ---
    handleGlobalInput() {
        // Check for Inventory Toggle ('I' key)
        if (this.inputHandler.actions.inventory) {
            // Prioritize closing other menus if they are open before toggling inventory
            if (this.uiManager.isWorkbenchOpen) { this.craftingSystem.closeWorkbench(); }
            else if (this.uiManager.isForgeOpen) { this.craftingSystem.closeForge(); }
            else if (this.uiManager.isBuildMenuOpen) { this.uiManager.toggleBuildMenu(); }
            else { this.uiManager.toggleInventory(); } // Otherwise, toggle the main inventory
            this.inputHandler.actions.inventory = false; // Consume the action
        }

        // Check for Build Menu Toggle ('B' key)
        if (this.inputHandler.actions.buildMenu) {
            // Close other conflicting menus before opening the build menu
            if (this.uiManager.isInventoryOpen) { this.uiManager.toggleInventory(); }
            if (this.uiManager.isWorkbenchOpen) { this.craftingSystem.closeWorkbench(); }
            if (this.uiManager.isForgeOpen) { this.craftingSystem.closeForge(); }
            this.uiManager.toggleBuildMenu(); // Toggle the build menu itself
            this.inputHandler.actions.buildMenu = false; // Consume the action
        }

        // Check for Interaction / Menu Close ('E' key)
        if (this.inputHandler.actions.interact) {
            let consumed = false;
            // If a specific menu is open, 'E' should close it
            if (this.uiManager.isWorkbenchOpen) { this.craftingSystem.closeWorkbench(); consumed = true; }
            else if (this.uiManager.isForgeOpen) { this.craftingSystem.closeForge(); consumed = true; }
            // If no menu is open, 'E' triggers player interaction (handled in player.update)
            // So, only consume the action here if we closed a menu.
            if (consumed) {
                this.inputHandler.actions.interact = false;
            }
            // Note: Player interaction logic in player.js should also check and potentially consume this action.
        }

        // Quick Bar Selection (Number keys 1-8)
        for (let i = 1; i <= 8; i++) {
            if (this.inputHandler.keys[i.toString()]) {
                this.inventoryManager.selectQuickBarSlot(i - 1); // 0-indexed slot
                // Optional: consume the key press if number keys aren't used for other things simultaneously
                // this.inputHandler.keys[i.toString()] = false;
            }
        }
         // Optional: Quick Bar Cycling (e.g., using mouse wheel when not building/zooming)
         // if (!this.buildingSystem.isBuilding && this.inputHandler.actions.rotateBuild !== 0) {
         //     this.inventoryManager.cycleQuickBarSlot(-this.inputHandler.actions.rotateBuild);
         // }


        // Building Mode Actions (only process if isBuilding is true)
        if (this.buildingSystem.isBuilding) {
            // Left Click: Place the current building item
            if (this.inputHandler.actions.attack) {
                this.buildingSystem.placeItem();
                this.inputHandler.actions.attack = false; // Consume the attack action
            }
            // Mouse Wheel: Rotate the building preview
            if (this.inputHandler.actions.rotateBuild !== 0) {
                this.buildingSystem.rotate(this.inputHandler.actions.rotateBuild);
                // Rotation value is reset in inputHandler.resetActions()
            }
            // Right Click: Cancel building mode
            if (this.inputHandler.mouse.right) {
                this.buildingSystem.exitBuildMode();
                // Optional: Consume right-click state if it shouldn't trigger other actions
                // this.inputHandler.mouse.right = false;
            }
        } else {
            // Actions when *not* in building mode
            // Right Click: Attempt to remove a placed building object
            if (this.inputHandler.mouse.right) {
                 // Trigger the removal check logic within the player class
                 this.player.removeBuildingAction();
                 // Optional: Consume right-click state after attempting removal
                 // this.inputHandler.mouse.right = false;
            }
        }

        // Escape Key: Pause game or close topmost UI element
        if (this.inputHandler.keys['escape']) {
            // Check UI layers in reverse order of opening priority
            if (this.buildingSystem.isBuilding) { this.buildingSystem.exitBuildMode(); }
            else if (this.uiManager.isInventoryOpen) { this.uiManager.toggleInventory(); }
            else if (this.uiManager.isBuildMenuOpen) { this.uiManager.toggleBuildMenu(); }
            else if (this.uiManager.isWorkbenchOpen) { this.craftingSystem.closeWorkbench(); }
            else if (this.uiManager.isForgeOpen) { this.craftingSystem.closeForge(); }
            else { this.setPaused(!this.isPaused); } // If no menus open, toggle pause

            this.inputHandler.keys['escape'] = false; // Consume the escape key press
        }
    }

    // --- Utility Methods ---

    // Handle window resize events
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix(); // Update camera projection based on new aspect ratio
        this.renderer.setSize(window.innerWidth, window.innerHeight); // Resize renderer canvas
    }

    // Handle changes in pointer lock state
    handlePointerLockChange() {
        const canvas = document.getElementById('gameCanvas');
        if (document.pointerLockElement === canvas) {
            console.log('Pointer locked');
            document.body.style.cursor = 'none'; // Hide system cursor
        } else {
            console.log('Pointer unlocked');
            document.body.style.cursor = 'default'; // Show system cursor
            // Optional: Automatically pause the game if pointer lock is lost unexpectedly
            // Check if unlock was intentional (e.g., opening UI) before pausing
             if (!this.uiManager.isInventoryOpen && !this.uiManager.isBuildMenuOpen && !this.uiManager.isWorkbenchOpen && !this.uiManager.isForgeOpen && !this.isPaused) {
                  console.log("Pointer lock lost unexpectedly, pausing game.");
                 // this.setPaused(true); // Uncomment to enable auto-pause on lock loss
             }
        }
    }

    // Set the pause state of the game
    setPaused(paused) {
        if (this.isPaused === paused) return; // No change needed

        this.isPaused = paused;
        this.clock.getDelta(); // Important: Reset delta time to avoid large jump on resume

        if (this.isPaused) {
            console.log("Game Paused");
            // Force pointer unlock if the game is paused
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
            document.body.style.cursor = 'default'; // Ensure cursor is visible when paused
        } else {
            console.log("Game Resumed");
            // Attempt to re-lock pointer only if no UI element needing cursor is open
             if (!this.uiManager.isInventoryOpen && !this.uiManager.isBuildMenuOpen && !this.uiManager.isWorkbenchOpen && !this.uiManager.isForgeOpen) {
                 const canvas = document.getElementById('gameCanvas');
                 // Optional: Automatically re-request pointer lock on resume. Can be annoying.
                 // canvas.requestPointerLock();
             }
             // Ensure cursor is hidden if pointer lock *is* active after resuming
             if (document.pointerLockElement) {
                 document.body.style.cursor = 'none';
             } else {
                 document.body.style.cursor = 'default';
             }
        }
    }
}

// --- Start the Game ---
// Wait for the DOM to be fully loaded before creating the Game instance
window.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded, starting game...");
    const game = new Game();
});