// js/player.js
import * as THREE from './libs/three.min.js';
import { Inventory } from './inventory.js';
import { ITEMS, getItemDef } from './itemSystem.js';
import { showMessage } from './ui.js';
import { craftItem, canCraft } from './crafting.js'; // Import crafting functions

export class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera; // Reference to the main camera
        this.speed = 5; // Units per second
        this.rotationSpeed = Math.PI / 2; // Radians per second
        this.height = 1.8; // Player height
        this.radius = 0.4; // Player radius

        // Player object (using a capsule for better representation)
        const geometry = new THREE.CapsuleGeometry(this.radius, this.height - (2 * this.radius), 4, 16); // Capsule geometry
        const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(0, this.height / 2, 5); // Start position, lifted slightly
        this.mesh.castShadow = true;
        this.mesh.name = "Player"; // Identify player object
        scene.add(this.mesh);

        // Movement state
        this.moveState = { forward: 0, backward: 0, left: 0, right: 0, up: 0, down: 0 }; // Added up/down for potential jump/crouch
        this.velocity = new THREE.Vector3();
        this.canJump = true; // Basic jump flag

        // Inventory
        this.inventory = new Inventory(25); // 25 slots
        this.initializeStarterItems();

        // Player state
        this.isInventoryOpen = false;
        this.selectedPlacable = null; // e.g., 'crafting_table' when selected to place

        // Camera Offset (for third-person view)
        this.cameraOffset = new THREE.Vector3(0, 3, 6); // Behind and slightly above

        // Raycaster for interaction
        this.raycaster = new THREE.Raycaster();
        this.interactionDistance = 3; // Max distance to interact
    }

    initializeStarterItems() {
        this.inventory.addItem('axe', 1);
        this.inventory.addItem('pickaxe', 1);
        this.inventory.addItem('knife', 1);
        this.inventory.addItem('canteen', 1);
    }

    update(deltaTime, keysPressed, worldObjects) {
        this.handleMovement(deltaTime, keysPressed);
        this.updateCamera();
        // Interaction check could happen here or triggered by input handler
        // this.checkForInteraction(worldObjects); // Placeholder for proximity checks etc.
    }

    handleMovement(deltaTime, keysPressed) {
        const moveSpeed = this.speed * deltaTime;
        const rotateSpeed = this.rotationSpeed * deltaTime;

        // Rotation (Tank Controls Example - Rotate Left/Right)
        if (keysPressed['a'] || keysPressed['ArrowLeft']) {
            this.mesh.rotateY(rotateSpeed);
        }
        if (keysPressed['d'] || keysPressed['ArrowRight']) {
            this.mesh.rotateY(-rotateSpeed);
        }

        // Movement Direction (Relative to Player's Facing Direction)
        const moveDirection = new THREE.Vector3();
        if (keysPressed['w'] || keysPressed['ArrowUp']) {
            moveDirection.z -= 1;
        }
        if (keysPressed['s'] || keysPressed['ArrowDown']) {
            moveDirection.z += 1;
        }
        // Strafe could be added with Q/E if desired

        // Normalize diagonal movement and apply rotation
        if (moveDirection.lengthSq() > 0) {
            moveDirection.normalize().applyQuaternion(this.mesh.quaternion);
            this.mesh.position.addScaledVector(moveDirection, moveSpeed);
        }

        // Simple Ground Collision (Keep player above y=0) - Replace with physics later
        if (this.mesh.position.y < this.height / 2) {
            this.mesh.position.y = this.height / 2;
            this.velocity.y = 0;
            this.canJump = true; // Can jump again when on ground
        }

        // TODO: Implement Jumping (Space bar)
        // if (keysPressed[' '] && this.canJump) { this.velocity.y = 5; this.canJump = false; }

        // Apply gravity (simplified) - Physics engine handles this better
        // this.velocity.y -= 9.8 * deltaTime;
        // this.mesh.position.addScaledVector(this.velocity, deltaTime);
    }

    updateCamera() {
        // Calculate desired camera position based on player's position and rotation
        const offset = this.cameraOffset.clone().applyQuaternion(this.mesh.quaternion);
        const desiredPosition = this.mesh.position.clone().add(offset);

        // TODO: Add raycasting from player to camera to check for obstructions (walls etc.)
        // If obstructed, move camera closer to player

        // Smoothly interpolate camera position (lerp)
        this.camera.position.lerp(desiredPosition, 0.1); // Adjust lerp factor for smoothness

        // Make camera look at the player's approximate head position
        const lookAtPosition = this.mesh.position.clone().add(new THREE.Vector3(0, this.height * 0.75, 0)); // Look slightly above feet
        this.camera.lookAt(lookAtPosition);
    }

    // Action: Gather resources
    gather(targetObject) {
        if (!targetObject || !targetObject.userData || !targetObject.userData.resourceType) {
            showMessage("Cannot gather from that.");
            return;
        }

        const resourceType = targetObject.userData.resourceType;
        let toolNeeded = null;
        let baseYield = 1;

        switch (resourceType) {
            case 'wood':
                toolNeeded = 'axe';
                baseYield = 3;
                break;
            case 'stone':
                toolNeeded = 'pickaxe';
                baseYield = 2;
                break;
            case 'grass':
                 // No tool needed, maybe knife gives bonus?
                 baseYield = 1;
                 break;
             case 'scrap_metal': // Loose scrap
                  baseYield = 1;
                  break;
             case 'animal': // Requires Knife after kill
                 if (this.inventory.hasItem('knife')) {
                     this.inventory.addItem('meat', 1 + Math.floor(Math.random() * 2)); // 1-2 meat
                     this.inventory.addItem('leather', 1);
                     this.inventory.addItem('fat', Math.random() < 0.5 ? 1 : 0); // 50% chance fat
                     showMessage(`Butchered ${targetObject.userData.name || 'animal'}`);
                     // Remove animal corpse from world
                     this.scene.remove(targetObject);
                     // TODO: Remove from worldObjects array too
                 } else {
                     showMessage("Need a Knife to butcher.");
                 }
                 return; // Handled separately
            // Add cases for barrels, buildings (search action)
            default:
                showMessage("Cannot gather " + resourceType);
                return;
        }

        let yieldAmount = baseYield;
        // Check if correct tool is equipped or in inventory (simplified check)
        if (toolNeeded && this.inventory.hasItem(toolNeeded)) {
            const toolDef = getItemDef(toolNeeded);
            yieldAmount *= (toolDef.gatherBonus?.[resourceType] || 1); // Apply tool bonus
            showMessage(`Gathered ${resourceType} with ${toolDef.name}`);
        } else if (toolNeeded) {
            showMessage(`Need a ${getItemDef(toolNeeded)?.name} for more efficient gathering.`);
            yieldAmount = 1; // Base yield if tool needed but not present
        } else {
             showMessage(`Gathered ${resourceType}`);
        }


        if (this.inventory.addItem(resourceType, Math.round(yieldAmount))) {
             // Optional: Degrade or remove the resource node after gathering
             targetObject.userData.health = (targetObject.userData.health || 10) - yieldAmount;
             if(targetObject.userData.health <= 0) {
                showMessage(`${targetObject.userData.name || resourceType} depleted.`);
                this.scene.remove(targetObject);
                // TODO: Remove from worldObjects array
             }
        }
    }

    // Action: Search container (barrel, building)
    search(targetObject) {
        if (!targetObject || !targetObject.userData || !targetObject.userData.lootTable) {
             showMessage("Nothing to search here.");
             return;
        }
        console.log(`Searching ${targetObject.userData.name || 'container'}...`);
        showMessage(`Searching ${targetObject.userData.name || 'container'}...`);

        // *** Placeholder Loot Logic ***
        // In a real game, use the lootTable defined in world.js
        const possibleLoot = ['wood', 'stone', 'scrap_metal', 'feathers', 'nails', 'leather', 'rope', 'arrows', 'ammo_pistol', 'pistol'];
        const numItems = Math.floor(Math.random() * 3) + 1; // 1 to 3 items

        let foundSomething = false;
        for (let i = 0; i < numItems; i++) {
            if (Math.random() < 0.6) { // 60% chance to find an item per slot
                const randomItemId = possibleLoot[Math.floor(Math.random() * possibleLoot.length)];
                const itemDef = getItemDef(randomItemId);
                let quantity = 1;
                if (itemDef.stackable) {
                    quantity = Math.floor(Math.random() * (itemDef.stackSize / 5)) + 1; // Find small amounts
                     quantity = Math.min(quantity, itemDef.stackSize); // Clamp
                }

                if (this.inventory.addItem(randomItemId, quantity)) {
                    showMessage(`Found ${itemDef.name} (${quantity})`);
                    foundSomething = true;
                } else {
                    showMessage(`Found ${itemDef.name} but inventory is full!`);
                    // Item remains in container / dropped?
                }
            }
        }

        if (!foundSomething) {
            showMessage("Found nothing useful.");
        }

        // Optional: Make container searchable only once
        // targetObject.userData.lootTable = null; // Mark as searched
        // Or change its appearance
    }

    // Action: Try to craft something (e.g., triggered by a key)
    attemptCraft(itemId) {
        craftItem(itemId, this.inventory);
    }


    // Action: Initiate placing an object
    selectPlaceable(itemId) {
        const itemDef = getItemDef(itemId);
        if (itemDef && itemDef.type === 'placeable' && this.inventory.hasItem(itemId)) {
            this.selectedPlacable = itemId;
            showMessage(`Selected ${itemDef.name}. Press 'P' to place.`);
            // TODO: Show a ghost object in front of the player
        } else {
            showMessage(`Cannot select ${itemId} to place.`);
            this.selectedPlacable = null;
        }
    }

    // Action: Place the selected object
    placeObject(position, rotation) {
         if (!this.selectedPlacable) return;

         const itemId = this.selectedPlacable;
         const itemDef = getItemDef(itemId);

         // 1. Check if player still has the item
         if (!this.inventory.hasItem(itemId)) {
             showMessage(`Cannot place ${itemDef.name}, item missing.`);
             this.selectedPlacable = null;
             return;
         }

         // 2. TODO: Check placement validity (collision, ground angle, proximity to other objects)
         const isValidPlacement = true; // Placeholder

         if (isValidPlacement) {
             // 3. Consume the item from inventory
             if (this.inventory.removeItem(itemId, 1)) {
                 // 4. Create the object in the world
                 console.log(`Placing ${itemDef.name} at`, position);
                 // This function should be in world.js or main.js to add the actual 3D object
                 // world.spawnPlacedObject(itemId, position, rotation);
                 showMessage(`Placed ${itemDef.name}.`);
                 this.selectedPlacable = null; // Clear selection
                 // TODO: Hide ghost object
             } else {
                 // Should not happen if check passed, but safety
                 showMessage(`Error placing ${itemDef.name}.`);
                 this.selectedPlacable = null;
             }
         } else {
             showMessage("Cannot place object here.");
             // Keep selection active, maybe provide visual feedback why placement failed
         }
    }

    // Perform raycast interaction
    interact(worldObjects) {
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera); // Ray from center of screen
        const intersects = this.raycaster.intersectObjects(worldObjects, false); // Check against world objects

        if (intersects.length > 0) {
            const closestHit = intersects[0];
            if (closestHit.distance <= this.interactionDistance) {
                const targetObject = closestHit.object;
                console.log("Interacting with:", targetObject.userData.name || targetObject.name);

                // Determine action based on object type
                if (targetObject.userData.resourceType) {
                    this.gather(targetObject);
                } else if (targetObject.userData.isContainer) {
                    this.search(targetObject);
                } else if (targetObject.userData.isAnimal && targetObject.userData.isDead) { // Check if dead animal
                     this.gather(targetObject); // Use gather with knife for butchering
                }
                // Add cases for interacting with placed objects (Forge, Crafting Table)
                // else if (targetObject.userData.itemId === 'forge') { openForgeUI(); }

                 else {
                    showMessage("Nothing to do with that.");
                }
                return; // Stop after first interaction
            }
        }
        showMessage("Nothing in range.");
    }
}
