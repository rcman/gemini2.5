// js/input.js
const Input = {
    keys: {},
    mouse: {
        x: 0,
        y: 0,
        sensitivity: CONSTANTS.MOUSE_SENSITIVITY || 0.002, // Use constant if defined
        left: false,
        right: false,
        wheelDelta: 0 // NEW: Store wheel scroll direction (+1 or -1)
    },
    isPointerLocked: false,

    init: function() {
        document.addEventListener('keydown', (event) => this.keys[event.key.toLowerCase()] = true);
        document.addEventListener('keyup', (event) => this.keys[event.key.toLowerCase()] = false);

        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mousedown', this.onMouseDown.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));

        // --- NEW: Add Wheel Listener ---
        document.addEventListener('wheel', this.onMouseWheel.bind(this), { passive: false }); // passive:false allows preventDefault

        // Pointer Lock API
        document.addEventListener('click', () => {
            // Only request lock if not already locked and no menus are open
            if (!this.isPointerLocked && !Game.UIManager.isMenuOpen()) {
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
        }
    },

    onMouseDown: function(event) {
        // Only register clicks if pointer is locked (prevents clicking menus accidentally triggering game actions)
        if (this.isPointerLocked) {
             if (event.button === 0) this.mouse.left = true; // Left click
             if (event.button === 2) this.mouse.right = true; // Right click
        }
    },

    onMouseUp: function(event) {
        // Always reset mouse state on up, regardless of lock state (safer)
        if (event.button === 0) this.mouse.left = false;
        if (event.button === 2) this.mouse.right = false;
    },

    // --- NEW: Wheel Handler ---
    onMouseWheel: function(event) {
        // Only process wheel input for rotation if pointer is locked AND currently placing
        if (this.isPointerLocked && Building.isPlacing) {
            event.preventDefault(); // Prevent page scrolling
            // Store the direction (+1 for down/forward, -1 for up/backward)
            // Normalize deltaY in case browsers return different magnitudes
            this.mouse.wheelDelta = Math.sign(event.deltaY);
            // console.log("Wheel Delta:", this.mouse.wheelDelta); // Debug log
        }
        // Allow default scrolling if pointer isn't locked or not placing
    },
    // --- End NEW Wheel Handler ---

    onPointerLockChange: function() {
        if (document.pointerLockElement === document.body ||
            document.mozPointerLockElement === document.body || // Firefox
            document.webkitPointerLockElement === document.body) { // Chrome/Safari/Opera
            this.isPointerLocked = true;
            console.log('Pointer Locked');
        } else {
            this.isPointerLocked = false;
            this.mouse.x = 0; // Reset movement deltas when lock is lost
            this.mouse.y = 0;
            // Ensure mouse buttons are also reset if lock is lost unexpectedly
            this.mouse.left = false;
            this.mouse.right = false;
            console.log('Pointer Unlocked');
             // If losing lock while placing, Player.update handles cancellation if menu opens
        }
    },

    // Call this each frame after processing mouse movement deltas
    resetMouseDeltas: function() {
        this.mouse.x = 0;
        this.mouse.y = 0;
    },

    // --- NEW: Reset Wheel Delta ---
    // Call this each frame after processing wheel input
    resetMouseWheelDelta: function() {
        this.mouse.wheelDelta = 0;
    }
    // --- End NEW Reset ---
};

// Make Input globally accessible
window.Input = Input;