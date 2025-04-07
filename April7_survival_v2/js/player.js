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
        const isPlacing = Building.isPlacing; // Cache placement state
        const isMenuOpen = Game.UIManager.isMenuOpen(); // Cache menu state
        const canControlCamera = Input.isPointerLocked; // Camera moves whenever locked
        // Player movement/actions are allowed ONLY if pointer locked AND not placing AND no menu open
        const canControlPlayer = Input.isPointerLocked && !isPlacing && !isMenuOpen;

        // --- Camera Rotation ---
        if (canControlCamera) {
            this.yawObject.rotation.y -= Input.mouse.x * this.lookSpeed;
            this.pitchObject.rotation.x -= Input.mouse.y * this.lookSpeed;
            this.pitchObject.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitchObject.rotation.x));
        }
        Input.resetMouseDeltas();

        // --- Handle Input based on State ---
        if (isPlacing) {
            // --- Placement Mode ---
            this.velocity.x = 0; // Disable movement (optional)
            this.velocity.z = 0;

             // Placement/Cancellation clicks (requires pointer lock)
             if (Input.isPointerLocked && Input.mouse.left) {
                 Building.placeSelectedItem();
                 Input.mouse.left = false; // Consume click
             }
             if (Input.isPointerLocked && Input.mouse.right) {
                 Building.cancelPlacement();
                 Input.mouse.right = false; // Consume click
             }
             // Rotation ('R' key) is handled inside Building.updatePlacementGhost

        } else if (isMenuOpen) {
            // --- Menu Mode ---
            this.velocity.x = 0;
            this.velocity.z = 0;
            Interaction.hidePrompt(); // Hide interaction prompt when menu is open

        } else {
            // --- Normal Gameplay Mode ---
            if (canControlPlayer) {
                // Player Movement (WASD)
                const speed = CONSTANTS.PLAYER_SPEED;
                const sprintMultiplier = CONSTANTS.PLAYER_SPRINT_MULTIPLIER;
                let moveForward = 0;
                let moveRight = 0;
                if (Input.isKeyDown('w')) moveForward += 1;
                if (Input.isKeyDown('s')) moveForward -= 1;
                if (Input.isKeyDown('a')) moveRight -= 1;
                if (Input.isKeyDown('d')) moveRight += 1;

                // Sprinting
                let currentSpeed = speed;
                let isSprinting = false;
                if (Input.isKeyDown('shift') && this.stamina > 0 && moveForward > 0) { // Can only sprint forward
                    currentSpeed *= sprintMultiplier;
                    isSprinting = true;
                    this.stamina -= this.sprintDrainRate * deltaTime;
                    if (this.stamina < 0) this.stamina = 0;
                } else if (this.stamina < this.maxStamina) { // Regenerate stamina if not sprinting
                     this.stamina += this.staminaRegenRate * deltaTime;
                     this.stamina = Math.min(this.stamina, this.maxStamina);
                }

                // Apply movement direction
                const moveDirection = new THREE.Vector3(moveRight, 0, moveForward);
                moveDirection.normalize().applyEuler(new THREE.Euler(0, this.yawObject.rotation.y, 0, 'YXZ'));

                if (moveForward !== 0 || moveRight !== 0) {
                    this.velocity.x = moveDirection.x * currentSpeed;
                    this.velocity.z = moveDirection.z * currentSpeed;
                } else {
                    this.velocity.x *= (1 - 10 * deltaTime); // Damping when no input
                    this.velocity.z *= (1 - 10 * deltaTime);
                }

                // Jumping
                // canJump is set by physics check, onGround derived from physics check
                if (Input.isKeyDown(' ') && this.canJump && this.onGround && this.stamina >= 5) {
                    this.velocity.y = CONSTANTS.PLAYER_JUMP_FORCE;
                    this.stamina -= 5; // Stamina cost for jumping
                    this.canJump = false; // Prevent mid-air jump spam
                    this.onGround = false; // Instantly leave ground state
                }

                // Interaction Check & Action ('E')
                Interaction.update(this.camera, Game.World?.interactables || []);
                if (Input.keys['e']) {
                   Interaction.interact();
                   Input.keys['e'] = false; // Consume key press
                }

                // Normal Attack/Use Action (Left Click)
                 if (Input.mouse.left) {
                      console.log("Player Left Click (Normal Mode)");
                      // TODO: Implement tool usage / attack based on selected quick bar slot
                      // Example: if (Game.UIManager.selectedQuickSlotIndex !== -1) { Inventory.useItem(Game.UIManager.selectedQuickSlotIndex); }
                      Input.mouse.left = false; // Consume click
                 }
                 // TODO: Add Right Click Action if needed (e.g., aiming)

            } else {
                 // Player cannot control movement (e.g., pointer not locked but no menu/placing)
                 // Still apply damping to slow down if moving
                 this.velocity.x *= (1 - 10 * deltaTime);
                 this.velocity.z *= (1 - 10 * deltaTime);
                 Interaction.hidePrompt(); // Don't show interaction prompt if not controlling
            }
        }


        // --- Physics & Stats (Apply regardless of mode, except velocity changes above) ---
        // Ground Check & Gravity (using raycast)
        const groundCheckDist = 1.0; // How far below the player center to check
        const playerFeetOffset = 0.9; // Approximate distance from player center to feet
        const rayOrigin = this.mesh.position.clone();
        rayOrigin.y += 0.1; // Start ray slightly above center to avoid starting inside floor?
        const raycaster = new THREE.Raycaster(rayOrigin, new THREE.Vector3(0, -1, 0), 0, groundCheckDist + 0.1);
        const colliders = [World.ground, ...World.objects.filter(o => o.geometry)]; // Check ground and world objects
        const groundIntersects = raycaster.intersectObjects(colliders, false);

        this.onGround = false; // Assume not on ground unless intersection found
        if (groundIntersects.length > 0) {
             // Check if the intersection is close enough to consider grounded
             const closestHit = groundIntersects[0];
             if (closestHit.distance <= groundCheckDist) {
                  this.onGround = true;
             }
        }

        if (this.onGround && this.velocity.y <= 0) { // Only stop/snap if moving down or still
             this.velocity.y = 0; // Stop vertical velocity
             this.canJump = true; // Allow jumping again
             // Optional snapping to ground surface - can cause jittering
             // const snapToY = groundIntersects[0].point.y + playerFeetOffset;
             // if (this.mesh.position.y < snapToY + 0.1) { // Only snap if below or slightly above
             //      this.mesh.position.y = snapToY;
             // }
        } else {
             // Apply gravity if not considered on ground
             this.velocity.y += CONSTANTS.GRAVITY * deltaTime;
             // Cannot jump if not on ground (prevents mid-air jump if space held)
             this.canJump = false;
        }

        // Apply Velocity
        // TODO: Implement proper collision detection before applying position change
        this.mesh.position.x += this.velocity.x * deltaTime;
        this.mesh.position.y += this.velocity.y * deltaTime;
        this.mesh.position.z += this.velocity.z * deltaTime;

        // Basic Ground Collision (prevent falling through floor - failsafe)
         const lowestPoint = 0.9; // Player mesh height / 2
         if (this.mesh.position.y < lowestPoint) {
              this.mesh.position.y = lowestPoint;
              if (this.velocity.y < 0) this.velocity.y = 0; // Stop downward velocity
              this.onGround = true;
              this.canJump = true;
         }

        // Hunger Drain
        this.hunger -= this.hungerDrainRate * deltaTime;
        if (this.hunger < 0) this.hunger = 0;
        if (this.hunger <= 0) { /* Apply penalties e.g., this.changeHealth(-0.05 * deltaTime); */ }
        this.updateStatsUI(); // Update UI stats display


        // --- Menu Toggles (Always check regardless of state) ---
        // Check 'B' key
        if (Input.keys['b']) {
            if (Building.isPlacing) Building.cancelPlacement(); // Cancel placement first
            Game.UIManager.toggleBuildMenu();
            Input.keys['b'] = false; // Consume key
            if (Game.UIManager.isMenuOpen() && Input.isPointerLocked) document.exitPointerLock();
        }
        // Check 'I' key
        if (Input.keys['i']) {
            if (Building.isPlacing) Building.cancelPlacement(); // Cancel placement first
            Game.UIManager.toggleInventoryMenu();
            Input.keys['i'] = false; // Consume key
            if (Game.UIManager.isMenuOpen() && Input.isPointerLocked) document.exitPointerLock();
        }

        // --- Pointer Lock Management (Refined Cancellation Logic) ---
        if (!Input.isPointerLocked) {
            // Reset mouse buttons to prevent accidental clicks when lock is regained
            Input.mouse.left = false;
            Input.mouse.right = false;

            // *** MODIFIED LOGIC HERE ***
            // Only cancel placement if the pointer is lost AND a menu is also open.
            // If the pointer is lost while aiming (e.g., Alt+Tab), stay in placement mode.
            // The player won't be able to *click* to place until they re-lock the pointer.
            if (Building.isPlacing && isMenuOpen) { // isMenuOpen was cached at the start of the frame
                 console.log("Pointer lost AND menu open, cancelling placement.");
                 Building.cancelPlacement();
            } else if (Building.isPlacing) {
                 // Log that we are staying in placement mode, but actions are disabled
                 // console.log("Pointer lost, but no menu open. Staying in placement mode (clicks disabled).");
            }
            // *** END OF MODIFIED LOGIC ***
        }
    },

    // Called by Building system or UI to clear selection state
    clearSelection: function() {
        this.selectedPlacementInfo = null;
        Game.UIManager.clearSelectionHighlights(); // Also clear UI highlights
    },

    // --- Other Methods ---
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
        Building.cancelPlacement(); // Ensure placement is cancelled
        this.mesh.position.set(0, 5, 5); // Reset position
        this.velocity.set(0, 0, 0);
        this.health = 100; // Reset stats
        this.hunger = 100;
        this.stamina = 100;
        Inventory.items = {}; // Clear inventory
        Inventory.quickBarItems.fill(null); // Clear quick bar
        this.clearSelection(); // Clear selection state
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