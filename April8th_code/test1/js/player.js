// js/player.js
class Player {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;

        // Player Model (Placeholder Cube)
        const geometry = new THREE.BoxGeometry(0.8, 1.8, 0.8); // Approx human size
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(0, 0.9, 5); // Start position (Y adjusted for height)
        this.mesh.castShadow = true;
        this.mesh.userData.type = 'player'; // For identification
        this.scene.add(this.mesh);

        // Stats
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.maxHunger = 100;
        this.hunger = this.maxHunger;
        this.maxStamina = 100;
        this.stamina = this.maxStamina;

        // Movement Params
        this.moveSpeed = 4.0; // Meters per second
        this.runSpeed = 7.0;
        this.jumpForce = 6.0;
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.onGround = false;
        this.gravity = -15; // Acceleration due to gravity

         // State
        this.isSprinting = false;
        this.currentEquippedItem = null; // The mesh of the equipped tool/weapon
        this.interactionTarget = null; // Object the player is looking at and can interact with
        this.reachDistance = 3.0; // How far the player can interact/harvest

         // Actions Cooldowns
         this.actionCooldown = 0;
         this.harvestCooldown = 0.5; // Time between harvest actions
         this.attackCooldown = 0.8; // Time between attacks


         // Reference to camera controller for movement direction
         this.cameraController = game.cameraController;
    }

    update(deltaTime, input) {
        this.actionCooldown -= deltaTime;
        this.handleMovement(deltaTime, input);
        this.applyGravity(deltaTime);
        this.applyVelocity(deltaTime);
        this.checkGroundStatus(); // Simple ground check

        this.updateStats(deltaTime);
        this.checkForInteraction();
        this.handleActions(input);

         // Update HUD
         this.game.uiManager.updateHUD({
             health: this.health,
             hunger: this.hunger,
             stamina: this.stamina
         });
    }

    handleMovement(deltaTime, input) {
         if (this.game.isPaused) return; // No movement when paused

         // Sprinting (Hold Shift)
         this.isSprinting = input.keys['shift'] && this.stamina > 0 && this.onGround;
         const currentSpeed = this.isSprinting ? this.runSpeed : this.moveSpeed;

         // Get movement direction relative to camera
         const moveDirection = input.getMovementVector(); // Gets Vec3 from W/A/S/D

         if (moveDirection.lengthSq() > 0) { // Only calculate if there's input
             const forward = this.cameraController.getForwardVector();
             const right = this.cameraController.getRightVector();

             let desiredVelocity = new THREE.Vector3();
             desiredVelocity.addScaledVector(forward, -moveDirection.z); // W/S control forward/backward
             desiredVelocity.addScaledVector(right, moveDirection.x);    // A/D control left/right

             desiredVelocity.normalize().multiplyScalar(currentSpeed);

             this.velocity.x = desiredVelocity.x;
             this.velocity.z = desiredVelocity.z;

            // Rotate player model to face movement direction (optional)
            if (this.mesh) {
                const angle = Math.atan2(desiredVelocity.x, desiredVelocity.z);
                this.mesh.rotation.y = angle;
            }

             // Drain stamina while sprinting
             if (this.isSprinting) {
                 this.stamina -= 15 * deltaTime; // Adjust drain rate
                 if (this.stamina < 0) this.stamina = 0;
             }

         } else {
             // No movement input, decelerate horizontal velocity
             this.velocity.x *= Math.pow(0.1, deltaTime * 10); // Friction/damping
             this.velocity.z *= Math.pow(0.1, deltaTime * 10);
         }

          // Jump
          if (input.actions.jump && this.onGround && this.stamina >= 10) {
             this.velocity.y = this.jumpForce;
             this.onGround = false;
             this.stamina -= 10; // Stamina cost for jumping
              input.actions.jump = false; // Consume jump action
          }
    }

     applyGravity(deltaTime) {
        if (!this.onGround) {
            this.velocity.y += this.gravity * deltaTime;
        }
    }

     applyVelocity(deltaTime) {
        // Simple collision detection (move and check) - replace with physics engine later
        const moveStep = this.velocity.clone().multiplyScalar(deltaTime);
        const newPosition = this.mesh.position.clone().add(moveStep);

        // Basic floor collision
        if (newPosition.y < 0.9) { // Assuming ground is at y=0, player height 1.8
            newPosition.y = 0.9;
            this.velocity.y = 0;
            this.onGround = true;
        } else {
            //this.onGround = false; // Let checkGroundStatus handle this more robustly if needed
        }

        // TODO: Add collision checks against world objects (walls, trees, rocks)
        // Example: Check X movement, then Z movement separately to slide along walls

        this.mesh.position.copy(newPosition);
    }

    checkGroundStatus() {
         // More robust check using a short raycast downwards
         const down = new THREE.Vector3(0, -1, 0);
         const raycaster = new THREE.Raycaster(this.mesh.position, down, 0, 1.1); // Ray length slightly more than half height + buffer
         const intersects = raycaster.intersectObjects(this.game.world.getCollidableObjects(), false); // Check against world terrain/buildings

         if (intersects.length > 0) {
            this.onGround = true;
            // Snap to ground slightly if needed?
             // this.mesh.position.y = intersects[0].point.y + 0.9;
             // this.velocity.y = Math.max(0, this.velocity.y); // Stop downward velocity if hitting ground
         } else {
            this.onGround = false;
         }

         // Fallback simple check if raycast fails
          if (!this.onGround && this.mesh.position.y <= 0.9) {
             this.mesh.position.y = 0.9;
             this.velocity.y = 0;
             this.onGround = true;
         }
    }


    updateStats(deltaTime) {
         // Hunger drain
         const hungerDrainRate = this.isSprinting ? 0.5 : 0.2; // Faster drain when sprinting
         this.hunger -= hungerDrainRate * deltaTime;
         if (this.hunger < 0) this.hunger = 0;

         // Health drain if starving
         if (this.hunger <= 0) {
             this.takeDamage(0.5 * deltaTime); // Slow damage when starving
         }

         // Stamina Regen
         if (!this.isSprinting && this.stamina < this.maxStamina) {
             const staminaRegenRate = this.hunger > 50 ? 15 : 5; // Regen faster if not hungry
             this.stamina += staminaRegenRate * deltaTime;
             if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
         }

         // TODO: Add temperature, wetness effects etc.
    }

     checkForInteraction() {
        // Raycast forward from camera center to find interactable objects
        const raycaster = new THREE.Raycaster();
        // Use camera position and direction for raycasting from screen center
         raycaster.setFromCamera({ x: 0, y: 0 }, this.game.camera); // Ray from center of screen
         raycaster.far = this.reachDistance;

         const potentialTargets = this.game.world.getInteractableObjects(); // Get trees, rocks, placeables etc.
         const intersects = raycaster.intersectObjects(potentialTargets, false); // Non-recursive check

         this.interactionTarget = null; // Clear previous target
         this.game.uiManager.hideInteractionPrompt(); // Hide prompt by default

        if (intersects.length > 0) {
            const firstHit = intersects[0].object;
            // Check distance again just to be sure (ray might hit further than reach if 'far' is large)
            if(intersects[0].distance <= this.reachDistance) {
                this.interactionTarget = firstHit;
                 // Show appropriate prompt based on object type
                 const userData = firstHit.userData;
                 let promptText = "Press E to interact";
                 if(userData.resourceType) promptText = `Press E to harvest ${userData.resourceType}`;
                 if(userData.buildItemId === 'workbench') promptText = `Press E to use Workbench`;
                 if(userData.buildItemId === 'forge') promptText = `Press E to use Forge`;
                 // Add prompts for doors, loot crates, etc.
                 this.game.uiManager.showInteractionPrompt(promptText);
            }
        }
     }

     handleActions(input) {
          if (this.game.isPaused) return;

          // Interaction (E key)
          if (input.actions.interact && this.interactionTarget && this.actionCooldown <= 0) {
              this.interactWith(this.interactionTarget);
              this.actionCooldown = 0.2; // Small cooldown after interaction
               input.actions.interact = false; // Consume action
          }

          // Primary Action (Left Mouse) - Attack / Harvest
          if (input.actions.attack && this.actionCooldown <= 0) {
               this.primaryAction();
               this.actionCooldown = this.harvestCooldown; // Use harvest/attack cooldown
               input.actions.attack = false; // Consume action
          }

          // Secondary Action (Right Mouse) - Aim / Place / Remove Building
           if (input.mouse.right) { // Check if right mouse is held/pressed
                if (this.game.buildingSystem.isBuilding) {
                     // Cannot remove while placing - exit placement? Or handled elsewhere?
                } else {
                    // Try removing a building part
                    this.removeBuildingAction();
                }
           }

           // Handle quick bar selection/cycling (triggered by InventoryManager calling player.equipItem)
     }

     interactWith(target) {
         console.log("Interacting with:", target);
         const userData = target.userData;

         if (userData.resourceType) {
             this.harvest(target, userData.resourceType);
         } else if (userData.buildItemId === 'workbench') {
             this.game.craftingSystem.openWorkbench();
         } else if (userData.buildItemId === 'forge') {
             this.game.craftingSystem.openForge();
         }
         // Add other interaction types: opening doors, looting crates, talking to NPCs
     }

     primaryAction() {
          // 1. Check if aiming at something interactable (harvest/attack)
         if (this.interactionTarget) {
             const userData = this.interactionTarget.userData;
             if (userData.resourceType) {
                 this.harvest(this.interactionTarget, userData.resourceType);
                 return; // Don't attack if harvesting
             } else if (userData.type === 'ai_hostile' || userData.type === 'ai_animal') {
                  this.attack(this.interactionTarget);
                  return;
             }
             // Add other primary actions based on target type?
         }

         // 2. If not aiming at anything specific, perform generic attack/swing
         console.log("Swing/Attack Action");
          // Play animation, check for hits in front of player (sphere cast or cone check)
     }

     harvest(target, resourceType) {
         console.log("Harvesting", resourceType, "from", target);
         let requiredTool = null;
         let yieldAmount = 1;
         let itemYield = null;

         switch (resourceType) {
             case 'Wood': requiredTool = 'axe'; itemYield = 'wood'; yieldAmount = Utils.getRandomInt(1, 3); break;
             case 'Stone': requiredTool = 'pickaxe'; itemYield = 'stone'; yieldAmount = Utils.getRandomInt(1, 2); break;
             case 'Iron Ore': requiredTool = 'pickaxe'; itemYield = 'iron_ore'; yieldAmount = Utils.getRandomInt(1, 2); break;
             case 'Copper Ore': requiredTool = 'pickaxe'; itemYield = 'copper_ore'; yieldAmount = Utils.getRandomInt(1, 2); break;
             case 'Zinc Ore': requiredTool = 'pickaxe'; itemYield = 'zinc_ore'; yieldAmount = Utils.getRandomInt(1, 2); break;
             case 'Fiber': requiredTool = null; itemYield = 'fiber'; yieldAmount = Utils.getRandomInt(2, 4); break; // No tool needed for fiber
             case 'Blueberry': requiredTool = null; itemYield = 'blueberry'; yieldAmount = Utils.getRandomInt(3, 6); break;
             // Add cases for other resources (vegetables, medical plants)
             default: console.warn("Unknown resource type:", resourceType); return;
         }

         const equippedItemData = this.getSelectedToolData();

         // Check if correct tool is equipped (if one is required)
         if (requiredTool && (!equippedItemData || equippedItemData.id !== requiredTool)) {
             console.log("Need a", requiredTool, "to harvest this.");
             // Show UI feedback?
             return;
         }

          // Check target health/resource amount if applicable
          target.userData.health = (target.userData.health || 10) - 1; // Example: Node has health
          console.log("Target health:", target.userData.health);


          if (itemYield) {
             this.game.inventoryManager.add(itemYield, yieldAmount);
             console.log(`Harvested ${yieldAmount}x ${itemYield}`);
              // Play sound/effect
          }

         // Remove node if depleted
         if (target.userData.health <= 0) {
            console.log("Resource depleted:", target);
             this.game.world.removeObject(target); // Remove from world
             this.interactionTarget = null; // Clear interaction target
             this.game.uiManager.hideInteractionPrompt();
             // TODO: Respawn timer/logic?
         }
     }

     attack(target) {
         const equippedItemData = this.getSelectedToolData();
         let damage = 5; // Base fist damage

         if (equippedItemData && equippedItemData.type === 'tool') { // Or check for 'weapon' type later
             // Assign damage based on tool/weapon
             if(equippedItemData.id === 'knife') damage = 15;
             else if(equippedItemData.id === 'axe') damage = 12;
             else if(equippedItemData.id === 'pickaxe') damage = 10;
             // Add bows, guns etc.
         }

         console.log(`Attacking ${target.userData.type || 'target'} for ${damage} damage`);
          if (target.userData.aiController && typeof target.userData.aiController.takeDamage === 'function') {
             target.userData.aiController.takeDamage(damage);
         }
         // Play attack animation/sound
         this.actionCooldown = this.attackCooldown; // Set specific attack cooldown
     }


     removeBuildingAction() {
         // Raycast like interaction check, but specifically for built objects
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera({ x: 0, y: 0 }, this.game.camera);
          raycaster.far = this.reachDistance + 1.0; // Slightly longer reach for removal?

          const buildObjects = this.game.buildingSystem.placedObjects.map(p => p.mesh);
          const intersects = raycaster.intersectObjects(buildObjects, false);

          if (intersects.length > 0) {
              const objectToRemove = intersects[0].object;
               if(intersects[0].distance <= this.reachDistance) {
                   console.log("Right-click remove target:", objectToRemove.userData.buildItemId);
                   // TODO: Add confirmation or delay? Or just remove instantly?
                   this.game.buildingSystem.removeObject(objectToRemove);
               }
          }
     }


    takeDamage(amount) {
        this.health -= amount;
        console.log(`Player took ${amount} damage, health: ${this.health}`);
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
        // Play hurt sound/effect
    }

    heal(amount) {
        this.health += amount;
        if (this.health > this.maxHealth) this.health = this.maxHealth;
    }

    eat(foodItemId) {
        const foodData = getItemData(foodItemId);
        if (!foodData || foodData.type !== 'food') return;

        if (this.game.inventoryManager.has(foodItemId, 1)) {
             this.game.inventoryManager.remove(foodItemId, 1);
             this.hunger += foodData.hungerValue || 0;
             if (this.hunger > this.maxHunger) this.hunger = this.maxHunger;
              // Add health gain if applicable
             this.heal(foodData.healthValue || 0);
             console.log(`Ate ${foodData.name}, hunger: ${this.hunger}`);
        }
    }

    die() {
        console.error("Player Died!");
         this.game.setPaused(true); // Pause game on death
        // Show death screen, offer respawn/load options
        alert("You Died!");
        // Basic reload for now
        window.location.reload();
    }

     // Called by InventoryManager when quick bar selection changes
     equipItem(itemId) {
        console.log("Equipping:", itemId);
        // Remove previous item model from hand (if any)
        if (this.currentEquippedItem) {
             // Detach from player/camera or hide
             this.mesh.remove(this.currentEquippedItem); // Example: attach to player mesh
             this.currentEquippedItem = null;
        }

        if (!itemId) return; // Unequipped empty slot

         const itemData = getItemData(itemId);
         if (!itemData || (itemData.type !== 'tool' && itemData.type !== 'weapon')) {
            console.log("Cannot equip item type:", itemData?.type);
            return; // Can only equip tools/weapons for now
         }

         // Create a simple visual representation for the equipped item
         // TODO: Use actual models and attach points
         let geometry;
         const material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
         switch(itemId) {
            case 'axe': geometry = new THREE.BoxGeometry(0.1, 0.6, 0.3); material.color.set(0x888888); break;
            case 'pickaxe': geometry = new THREE.BoxGeometry(0.1, 0.7, 0.2); material.color.set(0xaaaaaa); break;
            case 'knife': geometry = new THREE.BoxGeometry(0.05, 0.4, 0.1); material.color.set(0xffffff); break;
            case 'canteen': geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8); material.color.set(0x0088ff); break;
            default: geometry = new THREE.BoxGeometry(0.2, 0.2, 0.4); // Generic placeholder
         }

         this.currentEquippedItem = new THREE.Mesh(geometry, material);
         // Position relative to player's hand (needs adjustment based on player model)
         this.currentEquippedItem.position.set(0.5, 0.5, 0.3); // Example offset
          this.currentEquippedItem.rotation.z = Math.PI / 4; // Example rotation
          this.mesh.add(this.currentEquippedItem); // Attach to player mesh

          // Set cooldown based on newly equipped item?
          this.actionCooldown = 0; // Reset cooldown on equip
     }

      getSelectedToolData() {
         const selectedItem = this.game.inventoryManager.getSelectedQuickBarItem();
         return selectedItem ? getItemData(selectedItem.itemId) : null;
     }
}
