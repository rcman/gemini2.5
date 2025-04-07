// js/input.js
const Input = {
    keys: {},
    mouse: { x: 0, y: 0, sensitivity: 0.002, left: false, right: false },
    isPointerLocked: false,

    init: function() {
        document.addEventListener('keydown', (event) => this.keys[event.key.toLowerCase()] = true);
        document.addEventListener('keyup', (event) => this.keys[event.key.toLowerCase()] = false);

        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));

        // Pointer Lock API for camera control
        document.addEventListener('click', () => {
            if (!this.isPointerLocked && !Game.UIManager.isMenuOpen()) { // Only lock if menus are closed
                 document.body.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this), false);
        document.addEventListener('mozpointerlockchange', this.onPointerLockChange.bind(this), false); // Firefox
        document.addEventListener('webkitpointerlockchange', this.onPointerLockChange.bind(this), false); // Chrome/Safari/Opera

        console.log("Input Initialized");
    },

    isKeyDown: function(key) {
        return this.keys[key.toLowerCase()] === true;
    },

    onMouseMove: function(event) {
        if (this.isPointerLocked) {
            this.mouse.x = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            this.mouse.y = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
            // Player rotation logic will use these deltas in player.js
        }
    },

    onMouseDown: function(event) {
        if (this.isPointerLocked) {
             if (event.button === 0) this.mouse.left = true; // Left click
             if (event.button === 2) this.mouse.right = true; // Right click
        }
    },

    onMouseUp: function(event) {
        if (this.isPointerLocked) {
            if (event.button === 0) this.mouse.left = false;
            if (event.button === 2) this.mouse.right = false;
        }
    },

    onPointerLockChange: function() {
        if (document.pointerLockElement === document.body ||
            document.mozPointerLockElement === document.body || // Firefox
            document.webkitPointerLockElement === document.body) { // Chrome/Safari/Opera
            this.isPointerLocked = true;
            console.log('Pointer Locked');
        } else {
            this.isPointerLocked = false;
            // Reset mouse deltas when unlocking to avoid jumps
            this.mouse.x = 0;
            this.mouse.y = 0;
            console.log('Pointer Unlocked');
            // Optionally open a pause menu here
        }
    },

    // Call this each frame after processing mouse movement
    resetMouseDeltas: function() {
        this.mouse.x = 0;
        this.mouse.y = 0;
    }
};

// Make Input globally accessible
window.Input = Input;