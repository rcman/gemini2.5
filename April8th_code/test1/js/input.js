// js/input.js
class InputHandler {
    constructor(game) {
        this.game = game;
        this.keys = {};
        this.mouse = { x: 0, y: 0, left: false, right: false, wheel: 0 };
        this.movement = { forward: 0, backward: 0, left: 0, right: 0 }; // More robust movement
        this.actions = { jump: false, interact: false, attack: false, buildMenu: false, inventory: false, rotateBuild: 0 };

        window.addEventListener('keydown', (e) => this.onKey(e.key.toLowerCase(), true));
        window.addEventListener('keyup', (e) => this.onKey(e.key.toLowerCase(), false));
        window.addEventListener('mousedown', (e) => this.onMouse(e.button, true));
        window.addEventListener('mouseup', (e) => this.onMouse(e.button, false));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('wheel', (e) => this.onMouseWheel(e));
        // Prevent context menu on right click
        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    onKey(key, isPressed) {
        this.keys[key] = isPressed;

        // Update movement states directly for smoother input
        switch (key) {
            case 'w': this.movement.forward = isPressed ? 1 : 0; break;
            case 's': this.movement.backward = isPressed ? 1 : 0; break;
            case 'a': this.movement.left = isPressed ? 1 : 0; break;
            case 'd': this.movement.right = isPressed ? 1 : 0; break;
            case ' ': this.actions.jump = isPressed; break; // Handle jump press/release if needed
            case 'e': if (isPressed) this.actions.interact = true; break; // Action on press
            case 'i': if (isPressed) this.actions.inventory = true; break; // Action on press
            case 'b': if (isPressed) this.actions.buildMenu = true; break; // Action on press
            // Add other key bindings (sprint, crouch, reload etc.)
        }
    }

    onMouse(button, isPressed) {
        if (button === 0) { // Left click
            this.mouse.left = isPressed;
            if (isPressed) this.actions.attack = true; // Primary action on press
        } else if (button === 2) { // Right click
            this.mouse.right = isPressed;
            // Secondary action / Aim / Build Remove? Check context in game logic
        }
    }

    onMouseMove(event) {
        // We often need delta movement for camera rotation
        this.mouse.movementX = event.movementX || 0;
        this.mouse.movementY = event.movementY || 0;
        // Store absolute position if needed for UI interactions
        this.mouse.x = event.clientX;
        this.mouse.y = event.clientY;
    }

     onMouseWheel(event) {
        // Positive deltaY = scroll down, negative = scroll up
        this.actions.rotateBuild = Math.sign(event.deltaY);
    }


    // Call this at the beginning of each game loop update
    resetActions() {
        this.actions.interact = false;
        this.actions.attack = false;
        this.actions.inventory = false;
        this.actions.buildMenu = false;
         this.actions.rotateBuild = 0; // Reset rotation after processing
        this.mouse.movementX = 0; // Reset delta movement
        this.mouse.movementY = 0;
    }

    getMovementVector() {
        // Return a vector based on current W/A/S/D state
        const forward = this.movement.forward - this.movement.backward;
        const strafe = this.movement.right - this.movement.left;
        return new THREE.Vector3(strafe, 0, -forward).normalize(); // Z is negative forward in Three.js
    }
}