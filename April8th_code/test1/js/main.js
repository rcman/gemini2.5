// js/main.js
class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.player = null;
        this.world = null;
        this.inputHandler = null;
        this.uiManager = null;
        this.inventoryManager = null;
        this.craftingSystem = null;
        this.buildingSystem = null;
        this.cameraController = null;
        this.clock = new THREE.Clock();
        this.isPaused = false;

        this.init();
        this.animate();
    }

    init() {
        // --- Renderer ---
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('gameCanvas'),
            antialias: true // Enable anti-aliasing
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio); // Adjust for high DPI screens
        this.renderer.shadowMap.enabled = true; // Enable shadows
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

        // --- Scene ---
        this.scene = new THREE.Scene();

        // --- Camera ---
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 10); // Initial camera position (will be controlled)

        // --- Lighting ---
        const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6); // Soft ambient light
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Sun light
        directionalLight.position.set(30, 50, 20);
        directionalLight.castShadow = true;
        // Configure shadow properties for performance/quality
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 150;
        directionalLight.shadow.camera.left = -this.worldSize / 2 || -100;
        directionalLight.shadow.camera.right = this.worldSize / 2 || 100;
        directionalLight.shadow.camera.top = this.worldSize / 2 || 100;
        directionalLight.shadow.camera.bottom = -this.worldSize / 2 || -100;
        this.scene.add(directionalLight);
        this.scene.add(directionalLight.target); // Add target for directional light if needed

         // --- Game Systems Initialization (Order matters!) ---
         this.inputHandler = new InputHandler(this);
         this.inventoryManager = new InventoryManager(this); // Needs access to game for UI updates
         this.uiManager = new UIManager(this);             // Needs access to game and inventory
         this.craftingSystem = new CraftingSystem(this);
         this.buildingSystem = new BuildingSystem(this);
         this.world = new World(this);                     // Needs scene, buildingSystem?
         this.player = new Player(this);                   // Needs scene, game access (camera, inventory)
         this.cameraController = new ThirdPersonCamera(this.camera, this.player.mesh); // Needs camera and player mesh
          this.player.cameraController = this.cameraController; // Give player access to camera controller


         // --- World Generation ---
         this.world.generate(); // Spawn ground, resources, initial AI


        // --- Initial Setup ---
        this.inventoryManager.addStarterItems();
        this.uiManager.updateQuickBar(); // Ensure quick bar displays starter items
        this.uiManager.updateInventory(); // Update inventory display if needed initially

        // --- Event Listeners ---
        window.addEventListener('resize', () => this.onWindowResize());

         // Lock pointer on canvas click (optional, good for FPS/TPS)
         const canvas = document.getElementById('gameCanvas');
         canvas.addEventListener('click', () => {
            if (!this.isPaused && !document.pointerLockElement) { // Only lock if not paused and not already locked
                 canvas.requestPointerLock().catch(err => console.error("Pointer lock failed:", err));
             }
         });

         // Handle pointer lock changes
         document.addEventListener('pointerlockchange', () => this.handlePointerLockChange(), false);


         console.log("Game Initialized");
    }

     handlePointerLockChange() {
         const canvas = document.getElementById('gameCanvas');
         if (document.pointerLockElement === canvas) {
             console.log('Pointer locked');
             // Maybe hide cursor here if not done by browser
         } else {
             console.log('Pointer unlocked');
             // If the game relies on pointer lock, maybe pause it?
              // Only pause if we didn't unlock intentionally via UI
             if (!this.uiManager.isInventoryOpen && !this.uiManager.isBuildMenuOpen && !this.uiManager.isWorkbenchOpen && !this.uiManager.isForgeOpen) {
                 // this.setPaused(true); // Option: Pause if lock is lost unexpectedly
             }
         }
     }


    setPaused(paused) {
        if (this.isPaused === paused) return; // No change

        this.isPaused = paused;
        this.clock.getDelta(); // Clear delta time jump when pausing/unpausing

        if (this.isPaused) {
             console.log("Game Paused");
             // Unlock pointer if locked
             if (document.pointerLockElement) {
                 document.exitPointerLock();
             }
             // Show cursor
              document.body.style.cursor = 'default';
        } else {
            console.log("Game Resumed");
            // Try to lock pointer again if appropriate
            const canvas = document.getElementById('gameCanvas');
             if (!this.uiManager.isMouseOverUI(this.inputHandler.mouse.x, this.inputHandler.mouse.y)) { // Don't lock if mouse is over UI
                 // canvas.requestPointerLock(); // Re-request lock on resume if desired
             }
             // Hide cursor if pointer lock active? (Often handled by browser)
              if (document.pointerLockElement) {
                 document.body.style.cursor = 'none';
             }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate()); // Loop

        const deltaTime = this.clock.getDelta();

        // --- Update Logic ---
        // Handle Input Actions (Toggles, etc.)
        this.handleGlobalInput();

        if (!this.isPaused) {
             // Update game systems that run when not paused
             this.player.update(deltaTime, this.inputHandler);
             this.world.update(deltaTime); // Update AI, world animations etc.
             this.cameraController.update(deltaTime, this.inputHandler);

            // Update Building Preview if active
            if (this.buildingSystem.isBuilding) {
                 this.buildingSystem.update(this.camera, this.inputHandler.mouse);
            }

        } else {
            // Update systems that might run while paused (e.g., UI animations?)
        }


        // Reset input actions that should only trigger once per frame
        this.inputHandler.resetActions();

        // --- Rendering ---
        this.renderer.render(this.scene, this.camera);
    }

     handleGlobalInput() {
         // --- UI Toggles ---
         if (this.inputHandler.actions.inventory) {
             // If a crafting menu is open, 'I' might close it instead, or do nothing
             if(this.uiManager.isWorkbenchOpen) { /* Do nothing or close workbench? */ }
             else if(this.uiManager.isForgeOpen) { /* Do nothing or close forge? */ }
             else {
                 this.uiManager.toggleInventory();
             }
             this.inputHandler.actions.inventory = false; // Consume action
         }
         if (this.inputHandler.actions.buildMenu) {
              // Close inventory/crafting if opening build menu?
              if(this.uiManager.isInventoryOpen) this.uiManager.toggleInventory();
              if(this.uiManager.isWorkbenchOpen) this.craftingSystem.closeWorkbench();
              if(this.uiManager.isForgeOpen) this.craftingSystem.closeForge();

              this.uiManager.toggleBuildMenu();
              this.inputHandler.actions.buildMenu = false; // Consume action
         }

        // Handle E key for interaction OR closing menus
         if (this.inputHandler.actions.interact) {
             if (this.uiManager.isWorkbenchOpen) {
                this.craftingSystem.closeWorkbench();
             } else if (this.uiManager.isForgeOpen) {
                 this.craftingSystem.closeForge();
             } else if (this.player.interactionTarget) {
                 // Player interaction handled in player.update() based on this flag
             }
              // Note: player update will consume this action if interaction happens
              // We might need to consume it here if a menu was closed
             // this.inputHandler.actions.interact = false;
         }


         // --- Quick Bar Selection --- (Example: Number keys)
         for (let i = 1; i <= 8; i++) {
             if (this.inputHandler.keys[i.toString()]) {
                 this.inventoryManager.selectQuickBarSlot(i - 1); // 0-indexed
             }
         }
         // Example: Mouse Wheel for Quick Bar (if not used for build rotation/zoom)
         // if(this.inputHandler.actions.rotateBuild !== 0 && !this.buildingSystem.isBuilding) {
         //    this.inventoryManager.cycleQuickBarSlot(-this.inputHandler.actions.rotateBuild);
         // }


         // --- Building Actions ---
         if (this.buildingSystem.isBuilding) {
             if(this.inputHandler.actions.attack) { // Left click to place
                 this.buildingSystem.placeItem();
                 this.inputHandler.actions.attack = false; // Consume
             }
             if(this.inputHandler.actions.rotateBuild !== 0) { // Mouse wheel to rotate
                 this.buildingSystem.rotate(this.inputHandler.actions.rotateBuild);
                 // Don't consume rotate action here, camera or quickbar might use it too if not building
             }
              if(this.inputHandler.mouse.right) { // Right click to cancel/exit?
                   this.buildingSystem.exitBuildMode();
                  // Consume right click? inputHandler.mouse.right = false; ?
              }
         }

          // --- ESC key for pausing / closing menus ---
          if (this.inputHandler.keys['escape']) {
              if (this.buildingSystem.isBuilding) this.buildingSystem.exitBuildMode();
              else if (this.uiManager.isInventoryOpen) this.uiManager.toggleInventory();
              else if (this.uiManager.isBuildMenuOpen) this.uiManager.toggleBuildMenu();
              else if (this.uiManager.isWorkbenchOpen) this.craftingSystem.closeWorkbench();
              else if (this.uiManager.isForgeOpen) this.craftingSystem.closeForge();
              else this.setPaused(!this.isPaused); // Toggle pause if no menus are open

              this.inputHandler.keys['escape'] = false; // Consume escape press
          }


     }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// --- Start the Game ---
window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
});
