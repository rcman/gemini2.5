// js/inputHandler.js
import { toggleInventoryUI, showMessage } from './ui.js';

export class InputHandler {
    constructor(player, world) {
        this.player = player;
        this.world = world; // Need world to get interactable objects
        this.keysPressed = {}; // Store current key states

        // Binding `this` context for event listeners
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleMouseClick = this.handleMouseClick.bind(this); // For interaction

        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        document.addEventListener('click', this.handleMouseClick); // Listen for clicks
        // Add listeners for mouse movement if implementing free-look camera later
    }

    handleKeyDown(event) {
        const key = event.key.toLowerCase();
        this.keysPressed[key] = true;

        // Handle single press actions (like inventory toggle)
        if (key === 'i') {
            this.player.isInventoryOpen = !this.player.isInventoryOpen;
            toggleInventoryUI(this.player.inventory.getItems()); // Pass current items
        }

        // Handle Interaction Key (e.g., 'e')
        if (key === 'e') {
            this.player.interact(this.world.getInteractableObjects());
        }

         // Handle Placement Key ('p')
        if (key === 'p') {
             if (this.player.selectedPlacable) {
                 // Determine placement position (e.g., raycast to ground in front of player)
                 // For simplicity, place directly in front
                 const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.mesh.quaternion);
                 const placementPos = this.player.mesh.position.clone().add(forward.multiplyScalar(2)); // Place 2 units in front
                 placementPos.y = 0; // Place on ground level (adjust based on object later)

                 this.player.placeObject(placementPos, this.player.mesh.rotation);
             } else {
                 showMessage("Nothing selected to place. Select a placeable item first.");
                 // Could open a placement menu or cycle through placeable items in inventory
             }
        }

        // Placeholder Crafting Hotkeys (Example: Craft Rope with 'c')
        if (key === 'c') {
            if (this.player.inventory.hasItem('grass', 3)) { // Check resource directly for simplicity
                 this.player.attemptCraft('rope');
             } else {
                showMessage("Need 3 Grass Fiber to craft Rope.");
             }
        }

         // Placeholder Selection Hotkeys (Example: Select Campfire with '1')
         if (key === '1') {
             this.player.selectPlaceable('campfire');
         }
         if (key === '2') {
             this.player.selectPlaceable('crafting_table');
         }
          if (key === '3') {
             this.player.selectPlaceable('forge');
         }

        // Prevent default browser actions for game keys (like spacebar scrolling)
        if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', 'i', 'p', 'c'].includes(key)) {
           // event.preventDefault(); // Be careful with this, might block text input if you add chat etc.
        }
    }

    handleKeyUp(event) {
        this.keysPressed[event.key.toLowerCase()] = false;
    }

    handleMouseClick(event) {
        // Basic interaction on click (can be alternative or supplement to 'E' key)
        // Could differentiate left/right click for different actions (gather/attack)
         if (event.button === 0) { // Left mouse button
             console.log("Left click detected");
             // this.player.interact(this.world.getInteractableObjects()); // Example: interact on click
             // Or could be used for attacking: this.player.attack();
         }
    }

    // Method to get current state of keys for continuous actions like movement
    getKeysPressed() {
        return this.keysPressed;
    }

    dispose() {
        // Remove event listeners when game stops or object is destroyed
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        document.removeEventListener('click', this.handleMouseClick);
    }
}
