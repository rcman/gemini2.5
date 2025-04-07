// js/player.js
const Player = {
    mesh: null,
    camera: null, // Reference to the main camera
    velocity: new THREE.Vector3(),
    onGround: false,
    health: 100,
    hunger: 100,
    stamina: 100,
    maxStamina: 100,
    staminaRegenRate: 5, // units per second
    sprintDrainRate: 10, // units per second
    hungerDrainRate: 0.1, // units per second
    lookSpeed: CONSTANTS.MOUSE_SENSITIVITY || 0.002, // Use constant or default
    canJump: true,

    // Camera control related
    pitchObject: null, // For up/down look
    yawObject: null,  // For left/right look (the player mesh itself)

    init: function(camera) {
        this.camera = camera;

        const playerHeight = 1.8;
        const playerRadius = 0.4;
        // More accurate capsule shape later, start with a box helper
        const geometry = new THREE.BoxGeometry(playerRadius * 2, playerHeight, playerRadius * 2);
        // Make player invisible or use a proper model later
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, visible: false });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(0, playerHeight / 2 + 5, 5); // Start slightly above ground

        // Set up camera hierarchy for FPS controls
        this.pitchObject = new THREE.Object3D();
        this.pitchObject.add(this.camera); // Add camera to pitch group

        this.yawObject = this.mesh; // Use the player mesh itself for yaw
        this.yawObject.add(this.pitchObject); // Add pitch group to yaw group (player mesh)

        // Set camera position relative to player center (eye level)
        this.camera.position.set(0, playerHeight * 0.4, 0); // Adjust y for eye level inside the invisible mesh

        Engine.scene.add(this.yawObject); // Add the player group to the scene

        console.log("Player Initialized");
        this.updateStatsUI(); // Initial UI update
    },

    update: function(deltaTime, worldColliders) {
        const speed = CONSTANTS.PLAYER_SPEED;
        const sprintMultiplier = CONSTANTS.PLAYER_SPRINT_MULTIPLIER;
        const gravity = CONSTANTS.GRAVITY;

        // --- Camera Rotation ---
        if (Input.isPointerLocked) {
             // Yaw (Left/Right) - Rotate the whole player object
             this.yawObject.rotation.y -= Input.mouse.x * this.lookSpeed;

             // Pitch (Up/Down) - Rotate the pitchObject
             this.pitchObject.rotation.x -= Input.mouse.y * this.lookSpeed;

             // Clamp pitch to prevent flipping over
             this.pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitchObject.rotation.x));
        }
        Input.resetMouseDeltas(); // Reset mouse movement deltas


        // --- Movement ---
        let moveForward = 0;
        let moveRight = 0;

        if (Input.isKeyDown('w') && Input.isPointerLocked) moveForward += 1; // Allow movement only if pointer locked
        if (Input.isKeyDown('s') && Input.isPointerLocked) moveForward -= 1;
        if (Input.isKeyDown('a') && Input.isPointerLocked) moveRight -= 1;
        if (Input.isKeyDown('d') && Input.isPointerLocked) moveRight += 1;

        let currentSpeed = speed;
        let isSprinting = false;
        // Allow sprinting only if pointer locked and moving forward
        if (Input.isKeyDown('shift') && Input.isPointerLocked && this.stamina > 0 && moveForward > 0) {
             currentSpeed *= sprintMultiplier;
             isSprinting = true;
             this.stamina -= this.sprintDrainRate * deltaTime;
             if (this.stamina < 0) this.stamina = 0;
        }

        // Calculate movement direction based on player's yaw rotation
        const moveDirection = new THREE.Vector3(moveRight, 0, moveForward);
        moveDirection.normalize(); // Ensure consistent speed regardless of diagonal movement
        moveDirection.applyEuler(new THREE.Euler(0, this.yawObject.rotation.y, 0, 'YXZ')); // Apply player's rotation

        // Apply movement velocity only if there's input
        if (moveForward !== 0 || moveRight !== 0) {
            this.velocity.x = moveDirection.x * currentSpeed;
            this.velocity.z = moveDirection.z * currentSpeed;
        } else {
            // Apply damping/friction if no movement input
            this.velocity.x *= (1 - 10 * deltaTime); // Adjust damping factor
            this.velocity.z *= (1 - 10 * deltaTime);
        }


        // --- Jumping & Gravity ---
        // Simple ground check (replace with raycasting later)
        const groundY = 0.9; // Player mesh height / 2
        // Basic ground check - replace with raycasting for uneven terrain
        if (this.mesh.position.y <= groundY && this.velocity.y <= 0) { // Only ground if moving down or still
            this.mesh.position.y = groundY;
            this.velocity.y = 0; // Stop falling velocity
            this.onGround = true;
            this.canJump = true; // Reset jump ability
        } else {
            this.onGround = false;
        }

        // Allow jumping only if pointer locked
        if (Input.isKeyDown(' ') && Input.isPointerLocked && this.canJump && this.onGround && this.stamina >= 5) {
            this.velocity.y = CONSTANTS.PLAYER_JUMP_FORCE;
            this.stamina -= 5;
            this.canJump = false; // Prevent double jump in air
            this.onGround = false;
        }

        // Apply gravity if not on ground
        if (!this.onGround) {
             this.velocity.y += gravity * deltaTime;
        }


        // --- Apply Velocity ---
        this.mesh.position.x += this.velocity.x * deltaTime;
        this.mesh.position.y += this.velocity.y * deltaTime;
        this.mesh.position.z += this.velocity.z * deltaTime;

        // --- Collision Detection (Very Basic Placeholder) ---
        // TODO: Implement proper collision with worldColliders (trees, rocks, buildings)


        // --- Stats Update ---
        if (!isSprinting && this.stamina < this.maxStamina) {
            this.stamina += this.staminaRegenRate * deltaTime;
            this.stamina = Math.min(this.stamina, this.maxStamina);
        }

        this.hunger -= this.hungerDrainRate * deltaTime;
        if (this.hunger < 0) this.hunger = 0;
        // TODO: Add effects for low hunger/stamina (e.g., health loss, reduced speed)

        if (this.hunger <= 0) {
            // Start taking health damage or other penalties
            // Example: this.changeHealth(-0.1 * deltaTime); // Slow health drain
        }


        // Update UI periodically (or check if values changed)
        this.updateStatsUI(); // Inefficient to call every frame, optimize later

        // --- Interaction Check ---
        // Only check interaction if pointer is locked (in game mode)
        if (Input.isPointerLocked) {
             Interaction.update(this.camera, Game.World?.interactables || []);
        } else {
            Interaction.hidePrompt(); // Hide prompt if menus are open/pointer unlocked
        }


        // Handle Interaction Input ('E') - Only if pointer locked
        if (Input.keys['e'] && Input.isPointerLocked) {
           Interaction.interact();
           Input.keys['e'] = false; // Consume the key press
        }

        // Handle Build Menu Toggle ('B')
        if (Input.keys['b']) {
            Game.UIManager.toggleBuildMenu();
            Input.keys['b'] = false; // Consume key press
            // Unlock pointer if opening menu
            if (Game.UIManager.isMenuOpen() && Input.isPointerLocked) {
                 document.exitPointerLock();
            }
             // Note: Re-locking should happen on click when menu is closed, handled by Input system
        }
         // Handle Inventory Menu Toggle ('I')
        if (Input.keys['i']) {
            Game.UIManager.toggleInventoryMenu();
            Input.keys['i'] = false; // Consume key press
             // Unlock pointer if opening menu
             if(Game.UIManager.isMenuOpen() && Input.isPointerLocked) {
                 document.exitPointerLock();
             }
              // Note: Re-locking should happen on click when menu is closed, handled by Input system
        }

        // Handle Building Placement/Cancellation (Mouse Clicks) - Only if pointer locked and building
        if (Input.isPointerLocked && Building.isBuilding) {
            if (Input.mouse.left) {
                Building.placeCurrentItem();
                Input.mouse.left = false; // Consume click
            }
            if (Input.mouse.right) {
                Building.exitBuildMode();
                Input.mouse.right = false; // Consume click
            }
        }
        // Reset mouse button states if pointer isn't locked (prevent accidental actions when clicking back in)
        if (!Input.isPointerLocked) {
            Input.mouse.left = false;
            Input.mouse.right = false;
        }


    },

    updateStatsUI: function() {
        Game.UIManager.updateStat('health', Math.floor(this.health));
        Game.UIManager.updateStat('hunger', Math.floor(this.hunger));
        Game.UIManager.updateStat('stamina', Math.floor(this.stamina));
    },

    // Function to be called by external events (e.g., eating, taking damage)
    changeHealth: function(amount) {
        this.health += amount;
        this.health = Math.max(0, Math.min(100, this.health)); // Clamp between 0 and 100
        this.updateStatsUI();
        if (this.health <= 0) {
            this.die();
        }
    },

    changeHunger: function(amount) {
        this.hunger += amount;
        this.hunger = Math.max(0, Math.min(100, this.hunger));
        this.updateStatsUI();
    },

    die: function() {
        console.log("Player Died!");
        Game.UIManager.logMessage("You have died!");
        // TODO: Implement respawn logic, game over screen, etc.
        // For now, maybe just reset position and stats
        this.mesh.position.set(0, 5, 5);
        this.health = 100;
        this.hunger = 100;
        this.stamina = 100;
        this.velocity.set(0,0,0);
        Inventory.items = {}; // Clear inventory on death (harsh!)
        Inventory.quickBarItems.fill(null); // Clear quick bar too
        Inventory.updateUI();
        Inventory.updateQuickBarUI();
        this.updateStatsUI();
    },

    getPosition: function() {
        return this.mesh.position.clone();
    }
};

window.Player = Player;