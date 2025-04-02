// js/player.js

// Using PointerLockControls for first-person view
import { PointerLockControls } from './PointerLockControls.js'; // Adjust path if needed

const Player = {
    camera: null,
    controls: null,
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    canJump: false,
    isOnObject: false, // For basic ground detection

    speed: 5.0, // Default, can be overridden by settings
    height: 1.8, // Default, can be overridden by settings
    jumpHeight: 8.0,
    gravity: 30.0,

    raycaster: new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10), // For ground check & interaction
    interactionDistance: 2.5, // How close to interact

    prevTime: performance.now(),

    init(camera, scene, domElement, settings) {
        this.camera = camera;
        this.speed = settings.playerSpeed || this.speed;
        this.height = settings.playerHeight || this.height;

        this.controls = new PointerLockControls(this.camera, domElement);
        scene.add(this.controls.getObject()); // Add camera pivot to scene

        this.camera.position.y = this.height; // Set initial camera height

        this.setupEventListeners(domElement);
        Utils.logMessage("Player initialized.");
    },

    setupEventListeners(domElement) {
        const blocker = document.getElementById('blocker');
        const instructions = document.getElementById('instructions');

        // Pointer Lock API
        instructions.addEventListener('click', () => {
             if (Game.isReady) this.controls.lock();
        });

        this.controls.addEventListener('lock', () => {
            instructions.style.display = 'none';
            blocker.style.display = 'none';
            Game.isPaused = false;
            this.prevTime = performance.now(); // Reset timer on focus gain
        });

        this.controls.addEventListener('unlock', () => {
            // Only show blocker if inventory isn't open
            if (!UI.inventoryVisible) {
                 blocker.style.display = 'flex';
                 instructions.style.display = '';
                 Game.isPaused = true;
            }
        });

        // Keyboard Controls
        const onKeyDown = (event) => {
            if (!this.controls.isLocked) return; // Only move if pointer is locked

            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = true; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = true; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = true; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = true; break;
                case 'Space': if (this.canJump) this.velocity.y += this.jumpHeight; this.canJump = false; break;
            }
        };

        const onKeyUp = (event) => {
            // No isLocked check here, want to stop moving even if lock is lost suddenly
             switch (event.code) {
                case 'ArrowUp':
                case 'KeyW': this.moveForward = false; break;
                case 'ArrowLeft':
                case 'KeyA': this.moveLeft = false; break;
                case 'ArrowDown':
                case 'KeyS': this.moveBackward = false; break;
                case 'ArrowRight':
                case 'KeyD': this.moveRight = false; break;
            }
        };

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        // Interaction (Mouse Click)
         domElement.addEventListener('mousedown', (event) => {
             if (this.controls.isLocked && event.button === 0) { // Left click
                 this.interact();
             }
         });
    },

    update(deltaTime, collidableObjects) {
        if (!this.controls.isLocked) return; // Don't update movement if paused/menu open

        const time = performance.now();
        // Recalculate delta here if needed, or trust the value passed in
        // const delta = ( time - this.prevTime ) / 1000;

        // Reset velocity influencing factors
        this.velocity.x -= this.velocity.x * 10.0 * deltaTime; // Damping/friction
        this.velocity.z -= this.velocity.z * 10.0 * deltaTime;

        // Apply gravity
        this.velocity.y -= this.gravity * deltaTime;

        // Get movement direction based on camera look direction
        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize(); // Ensure consistent speed in all directions

        // Apply movement force
        if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * this.speed * 10.0 * deltaTime;
        if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * this.speed * 10.0 * deltaTime;

         // --- Collision Detection ---
         this.isOnObject = false; // Reset ground check flag

         // 1. Vertical Collision (Ground Check)
         this.raycaster.ray.origin.copy(this.controls.getObject().position);
         this.raycaster.ray.origin.y -= this.height; // Raycast from feet
         this.raycaster.far = 0.2; // Short ray down

         const intersectionsY = this.raycaster.intersectObjects(collidableObjects, false); // Don't check children recursively for ground yet

         if (intersectionsY.length > 0) {
             const distance = intersectionsY[0].distance;
             if (distance < 0.1) { // Threshold for being "on" ground
                 this.isOnObject = true;
                 this.canJump = true;
                 this.velocity.y = Math.max(0, this.velocity.y); // Stop falling

                 // Optional: Snap to ground precisely if slightly above/below
                 // this.controls.getObject().position.y -= (distance - 0.01); // Adjust position slightly

             }
         }

        // 2. Horizontal Collision (Simplified - Check Movement Vector)
        // More robust collision needs checking bounding boxes or multiple rays
        const currentPos = this.controls.getObject().position;
        const intendedMove = new THREE.Vector3(
             this.velocity.x * deltaTime,
             0, // Only check XZ plane for wall collisions for now
             this.velocity.z * deltaTime
         );

         // Get world direction of intended movement
         const worldVelocity = intendedMove.clone().applyEuler(this.controls.getObject().rotation); // Incorrect for PointerLockControls camera setup
         // For PointerLock, velocity is already relative to world axes but controlled by local input directions
         const worldIntendedMove = new THREE.Vector3(this.velocity.x * deltaTime, 0, this.velocity.z * deltaTime);

        // Raycast slightly ahead in X and Z directions based on velocity sign
        let collisionX = false;
        let collisionZ = false;
        const horizontalRayLength = 0.5; // How far ahead to check

        if (Math.abs(this.velocity.x) > 0.1) { // Only check if moving horizontally significantly
            this.raycaster.ray.origin.copy(currentPos);
            this.raycaster.ray.origin.y -= this.height / 2; // Check from player center height
            this.raycaster.ray.direction.set(Math.sign(this.velocity.x), 0, 0);
            this.raycaster.far = horizontalRayLength;
            const intersectsX = this.raycaster.intersectObjects(collidableObjects, true); // Check recursively now
            if (intersectsX.length > 0 && intersectsX[0].distance < horizontalRayLength * 0.9) {
                 collisionX = true;
            }
        }
         if (Math.abs(this.velocity.z) > 0.1) {
             this.raycaster.ray.origin.copy(currentPos);
             this.raycaster.ray.origin.y -= this.height / 2;
            this.raycaster.ray.direction.set(0, 0, Math.sign(this.velocity.z));
             this.raycaster.far = horizontalRayLength;
             const intersectsZ = this.raycaster.intersectObjects(collidableObjects, true);
              if (intersectsZ.length > 0 && intersectsZ[0].distance < horizontalRayLength * 0.9) {
                 collisionZ = true;
            }
         }

        // Apply movement, stopping if collision detected
         if (!collisionX) {
             this.controls.moveRight(-this.velocity.x * deltaTime); // moveRight is relative X movement
         } else {
             this.velocity.x = 0; // Stop horizontal movement in X if collision
         }
         if (!collisionZ) {
              this.controls.moveForward(-this.velocity.z * deltaTime); // moveForward is relative Z movement
         } else {
             this.velocity.z = 0; // Stop horizontal movement in Z if collision
         }


        // Apply vertical movement (after horizontal adjustments)
        this.controls.getObject().position.y += (this.velocity.y * deltaTime);


        // Prevent falling through floor if gravity is too high / delta too large
        if (this.controls.getObject().position.y < this.height) {
            if (this.isOnObject) { // Snap back up if on ground but somehow sunk
                 this.controls.getObject().position.y = this.height;
            } else { // Fell off something
                // If still falling but hit absolute minimum y=0 (ground plane)
                 if (this.controls.getObject().position.y < 0.1) {
                     this.velocity.y = 0;
                     this.controls.getObject().position.y = 0.1; // Set to min ground level
                     this.canJump = true;
                      this.isOnObject = true; // Technically on ground plane
                 }
             }
        }

        // Update previous time for next frame's delta calculation
        // this.prevTime = time; // Use the passed deltaTime instead
    },

    interact() {
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera); // Ray from center of screen
        this.raycaster.far = this.interactionDistance;

        const intersects = this.raycaster.intersectObjects(World.interactableObjects, true); // Check recursively

        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            const userData = intersectedObject.userData;

            if (!userData || !userData.type) {
                console.log("Interacted with object, but no user data:", intersectedObject);
                return; // Interacted with something without interaction logic
            }


            Utils.logMessage(`Interacting with: ${userData.type}`);

            switch (userData.type) {
                case 'tree':
                    this.hitResourceNode(intersectedObject, 'axe');
                    break;
                case 'rock':
                     this.hitResourceNode(intersectedObject, 'pickaxe');
                    break;
                 case 'grass':
                     // Harvest grass - no tool needed, just click
                     Utils.logMessage(`Harvested ${userData.amount} ${userData.resource}`);
                     Inventory.addItem(userData.resource, userData.amount);
                     World.removeObject(intersectedObject); // Remove the grass patch
                     break;
                case 'scrap':
                     // Collect scrap - no tool needed
                     Utils.logMessage(`Collected ${userData.amount} ${userData.resource}`);
                     Inventory.addItem(userData.resource, userData.amount);
                     World.removeObject(intersectedObject);
                     break;
                case 'animal':
                    this.attackAnimal(intersectedObject, 'knife'); // Or selected weapon
                    break;
                case 'container':
                    this.searchContainer(intersectedObject);
                    break;
                // Add cases for campfire, forge, water source etc.
                 case 'water':
                     // Example: Fill canteen if holding it and looking at water
                     const selected = Inventory.getSelectedItem();
                     if (selected && selected.item === 'canteen') {
                         // Simple fill - replace with dirty water item later maybe
                         Utils.logMessage("Filled canteen with dirty water.");
                         // Need logic to handle filling/emptying items
                         // For now, maybe just log it.
                     } else {
                          Utils.logMessage("Need a canteen to collect water.");
                     }
                     break;
            }
        }
    },

    hitResourceNode(nodeObject, requiredTool) {
        const selectedItem = Inventory.getSelectedItem();
        const userData = nodeObject.userData;

        if (!selectedItem || selectedItem.item !== requiredTool) {
            Utils.logMessage(`Need a ${requiredTool} to gather from ${userData.type}.`);
            return;
        }

        // Simple damage model
        userData.health -= 25; // Damage per hit
        Utils.logMessage(`Hit ${userData.type}, health: ${userData.health}`);

        if (userData.health <= 0) {
             Utils.logMessage(`${userData.type} depleted! Got ${userData.amount} ${userData.resource}.`);
             Inventory.addItem(userData.resource, userData.amount);
             // Remove the object from the world
             World.removeObject(nodeObject);
        } else {
             // Optional: Play a hit sound or visual effect
        }
    },

     attackAnimal(animalObject, weapon) {
         const selectedItem = Inventory.getSelectedItem();
         const userData = animalObject.userData;

         // Basic check if selected item is a weapon (knife, axe could work too)
         const allowedWeapons = ['knife', 'axe']; // Add more later
         if (!selectedItem || !allowedWeapons.includes(selectedItem.item)) {
             Utils.logMessage(`Need a weapon to attack the ${userData.animalType}.`);
             return;
         }

         // Simple damage based on weapon (placeholder values)
         let damage = 10;
         if (selectedItem.item === 'knife') damage = 15;
         if (selectedItem.item === 'axe') damage = 20;

         userData.health -= damage;
         Utils.logMessage(`Attacked ${userData.animalType}, health: ${userData.health}`);

         // Basic AI reaction: Fleeing (implement state change in World.updateAnimals)
         // userData.aiState = 'fleeing';
         // userData.fleeFrom = this.controls.getObject().position; // Flee from player pos

         if (userData.health <= 0) {
             Utils.logMessage(`${userData.animalType} killed!`);
             // Drop loot
             if (userData.drops) {
                 userData.drops.forEach(drop => {
                     const quantity = Utils.getRandomInt(drop.min, drop.max);
                     if (quantity > 0) {
                         Inventory.addItem(drop.item, quantity);
                         Utils.logMessage(`+ ${quantity} ${drop.item}`);
                     }
                 });
             }
             // Remove the animal object
             World.removeObject(animalObject);
         } else {
             // Play hit sound/effect
         }
     },

    searchContainer(containerObject) {
        const userData = containerObject.userData;

        if (userData.searched) {
            Utils.logMessage(`${userData.containerType} is empty.`);
            return;
        }

        Utils.logMessage(`Searching ${userData.containerType}...`);
        if (userData.loot && userData.loot.length > 0) {
            userData.loot.forEach(item => {
                Inventory.addItem(item.item, item.quantity);
                Utils.logMessage(`+ ${item.quantity} ${item.item}`);
            });
            userData.loot = []; // Empty the container
        } else {
             Utils.logMessage(`...it's empty.`);
        }

        userData.searched = true;
        // Optional: Change container appearance slightly (e.g., open lid)
    },

     getPosition() {
         return this.controls.getObject().position;
     }
};

// Make globally accessible
window.Player = Player;