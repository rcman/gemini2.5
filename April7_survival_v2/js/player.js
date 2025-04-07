// js/player.js
const Player = {
    mesh: null,
    camera: null,
    velocity: new THREE.Vector3(),
    onGround: false,
    health: 100,
    hunger: 100,
    stamina: 100,
    maxStamina: 100,
    staminaRegenRate: 5,
    sprintDrainRate: 10,
    hungerDrainRate: 0.1,
    lookSpeed: CONSTANTS.MOUSE_SENSITIVITY || 0.002,
    canJump: true,
    pitchObject: null,
    yawObject: null,
    selectedPlacementInfo: null, // Stores { itemId, source, slotIndex? } when placing

    init: function(camera) {
        this.camera = camera;
        const playerHeight = 1.8;
        const playerRadius = 0.4;
        const geometry = new THREE.BoxGeometry(playerRadius * 2, playerHeight, playerRadius * 2);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, visible: false });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(0, playerHeight / 2 + 5, 5);

        this.pitchObject = new THREE.Object3D();
        this.pitchObject.add(this.camera);
        this.yawObject = this.mesh;
        this.yawObject.add(this.pitchObject);
        this.camera.position.set(0, playerHeight * 0.4, 0);
        Engine.scene.add(this.yawObject);

        console.log("Player Initialized");
        this.updateStatsUI();
    },

    update: function(deltaTime, worldColliders) {
        const speed = CONSTANTS.PLAYER_SPEED;
        const sprintMultiplier = CONSTANTS.PLAYER_SPRINT_MULTIPLIER;
        const gravity = CONSTANTS.GRAVITY;

        // --- Camera Rotation ---
        if (Input.isPointerLocked) {
            this.yawObject.rotation.y -= Input.mouse.x * this.lookSpeed;
            this.pitchObject.rotation.x -= Input.mouse.y * this.lookSpeed;
            this.pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitchObject.rotation.x));
        }
        Input.resetMouseDeltas();

        // --- Movement ---
        let moveForward = 0;
        let moveRight = 0;
        if (Input.isKeyDown('w') && Input.isPointerLocked) moveForward += 1;
        if (Input.isKeyDown('s') && Input.isPointerLocked) moveForward -= 1;
        if (Input.isKeyDown('a') && Input.isPointerLocked) moveRight -= 1;
        if (Input.isKeyDown('d') && Input.isPointerLocked) moveRight += 1;

        let currentSpeed = speed;
        let isSprinting = false;
        if (Input.isKeyDown('shift') && Input.isPointerLocked && this.stamina > 0 && moveForward > 0) {
            currentSpeed *= sprintMultiplier;
            isSprinting = true;
            this.stamina -= this.sprintDrainRate * deltaTime;
            if (this.stamina < 0) this.stamina = 0;
        }

        const moveDirection = new THREE.Vector3(moveRight, 0, moveForward);
        moveDirection.normalize().applyEuler(new THREE.Euler(0, this.yawObject.rotation.y, 0, 'YXZ'));

        if (moveForward !== 0 || moveRight !== 0) {
            this.velocity.x = moveDirection.x * currentSpeed;
            this.velocity.z = moveDirection.z * currentSpeed;
        } else {
            this.velocity.x *= (1 - 10 * deltaTime); // Damping
            this.velocity.z *= (1 - 10 * deltaTime);
        }

        // --- Jumping & Gravity ---
        const groundCheckDist = 1.0; // Raycast distance slightly more than half height
        const raycaster = new THREE.Raycaster(this.mesh.position, new THREE.Vector3(0, -1, 0), 0, groundCheckDist);
        const groundIntersects = raycaster.intersectObjects([World.ground, ...World.objects], false); // Check ground and world objects
        this.onGround = groundIntersects.length > 0 && groundIntersects[0].distance < groundCheckDist; // Check distance too

        if (this.onGround) {
             this.velocity.y = Math.max(0, this.velocity.y); // Stop downward velocity but allow upward from jump
             this.canJump = true;
        } else {
             this.velocity.y += gravity * deltaTime;
             this.canJump = false; // Cannot jump mid-air
        }

        if (Input.isKeyDown(' ') && Input.isPointerLocked && this.canJump && this.onGround && this.stamina >= 5) {
            this.velocity.y = CONSTANTS.PLAYER_JUMP_FORCE;
            this.stamina -= 5;
            this.canJump = false;
            this.onGround = false;
        }

        // --- Apply Velocity & Basic Collision ---
        this.mesh.position.x += this.velocity.x * deltaTime;
        this.mesh.position.y += this.velocity.y * deltaTime;
        this.mesh.position.z += this.velocity.z * deltaTime;

        // Basic ground collision (prevent falling through floor)
        const playerHalfHeight = 0.9;
         if (this.mesh.position.y < playerHalfHeight) {
              this.mesh.position.y = playerHalfHeight;
              this.velocity.y = Math.max(0, this.velocity.y); // Stop falling
              this.onGround = true; // Force ground state if sunk below
              this.canJump = true;
         }
        // TODO: Add horizontal collision detection/response


        // --- Stats Update ---
        if (!isSprinting && this.stamina < this.maxStamina) {
            this.stamina += this.staminaRegenRate * deltaTime;
            this.stamina = Math.min(this.stamina, this.maxStamina);
        }
        this.hunger -= this.hungerDrainRate * deltaTime;
        if (this.hunger < 0) this.hunger = 0;
        if (this.hunger <= 0) { /* Penalties? this.changeHealth(-0.05 * deltaTime); */ }
        this.updateStatsUI();


        // --- Placement Mode Logic ---
        if (Building.isPlacing) {
            // Update ghost position handled by main loop now
            // Handle Placement Input (Left Click) - only if pointer locked
            if (Input.isPointerLocked && Input.mouse.left) {
                Building.placeSelectedItem(); // Attempt to place the object
                Input.mouse.left = false; // Consume click
            }
            // Handle Placement Cancellation (Right Click) - only if pointer locked
            if (Input.isPointerLocked && Input.mouse.right) {
                Building.cancelPlacement();
                Input.mouse.right = false; // Consume click
            }
            // Handle Rotation Input (R key) - checked inside Building.updatePlacementGhost now
            // if(Input.keys['r'] && Input.isPointerLocked) { ... } moved

        } else {
             // --- Interaction Check (only if NOT placing) ---
             if (Input.isPointerLocked) {
                 Interaction.update(this.camera, Game.World?.interactables || []);
             } else {
                 Interaction.hidePrompt(); // Hide prompt if menus are open/pointer unlocked
             }

             // Handle Interaction Input ('E') - Only if pointer locked and NOT placing
             if (Input.keys['e'] && Input.isPointerLocked) {
                 Interaction.interact();
                 Input.keys['e'] = false; // Consume the key press
             }

             // Normal Left Click Action (Attack/Use Tool - Placeholder)
             if (Input.isPointerLocked && Input.mouse.left) {
                  console.log("Player Left Click (Attack/Use Action)"); // Replace with actual logic
                  // Example: this.useEquippedItem();
                  Input.mouse.left = false; // Consume click
             }
        }


        // --- Menu Toggles ---
        if (Input.keys['b']) {
            if (Building.isPlacing) Building.cancelPlacement();
            Game.UIManager.toggleBuildMenu();
            Input.keys['b'] = false;
            if (Game.UIManager.isMenuOpen() && Input.isPointerLocked) document.exitPointerLock();
        }
        if (Input.keys['i']) {
            if (Building.isPlacing) Building.cancelPlacement();
            Game.UIManager.toggleInventoryMenu();
            Input.keys['i'] = false;
            if (Game.UIManager.isMenuOpen() && Input.isPointerLocked) document.exitPointerLock();
        }

        // Reset mouse button states if pointer isn't locked
        if (!Input.isPointerLocked) {
            Input.mouse.left = false;
            Input.mouse.right = false;
            // If player unlocks pointer while placing, cancel placement
            if (Building.isPlacing) {
                Building.cancelPlacement();
            }
        }
    },

    // Called by Building system or UI to clear selection state
    clearSelection: function() {
        this.selectedPlacementInfo = null;
        // Potentially clear equipped item state too if needed
    },

    updateStatsUI: function() {
        Game.UIManager.updateStat('health', Math.floor(this.health));
        Game.UIManager.updateStat('hunger', Math.floor(this.hunger));
        Game.UIManager.updateStat('stamina', Math.floor(this.stamina));
    },

    changeHealth: function(amount) {
        this.health += amount;
        this.health = Math.max(0, Math.min(100, this.health));
        this.updateStatsUI();
        if (this.health <= 0) this.die();
    },

    changeHunger: function(amount) {
        this.hunger += amount;
        this.hunger = Math.max(0, Math.min(100, this.hunger));
        this.updateStatsUI();
    },

    die: function() {
        console.log("Player Died!");
        // Ensure placement is cancelled BEFORE clearing inventory
        Building.cancelPlacement();
        // Reset stats & position
        this.mesh.position.set(0, 5, 5);
        this.velocity.set(0, 0, 0);
        this.health = 100;
        this.hunger = 100;
        this.stamina = 100;
        // Clear inventory & selection
        Inventory.items = {};
        Inventory.quickBarItems.fill(null);
        this.selectedPlacementInfo = null;
        // Update UI
        Inventory.updateUI();
        Inventory.updateQuickBarUI();
        this.updateStatsUI();
        Game.UIManager.logMessage("You have died!");
    },

    getPosition: function() {
        return this.mesh.position.clone();
    }
};

window.Player = Player;