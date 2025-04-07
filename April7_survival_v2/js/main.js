// js/main.js
const Game = {
    Engine: window.Engine,
    Input: window.Input,
    Player: window.Player,
    World: window.World,
    UIManager: window.UIManager,
    Interaction: window.Interaction,
    Inventory: window.Inventory,
    Crafting: window.Crafting,
    Building: window.Building,
    Resources: window.Resources,
    AI: window.AI,

    init: function() {
        console.log("Initializing Game...");

        // --- Core Systems First ---
        this.Engine.init();
        this.Input.init(); // Input needed early
        this.Resources.init(); // Resource definitions needed by others
        // Assuming CONSTANTS doesn't need an init, but added placeholder if it ever does
        // window.CONSTANTS?.init?.(); // Optional chaining in case CONSTANTS might get an init later

        // --- UI Manager BEFORE modules that use it ---
        this.UIManager.init(); // Initialize UI elements BEFORE Inventory/Player use them

        // --- Game Logic Systems ---
        this.Crafting.init();   // Depends on Constants/Resources
        this.Inventory.init();  // Depends on UI, Constants, Resources, Crafting
        this.Interaction.init(); // Interaction system

        // --- Player & World ---
        this.Player.init(this.Engine.camera); // Player uses many systems (Input, UI, Inventory, Interaction)
        this.AI.init();         // AI system (might use Player pos later)
        this.World.init();      // World uses AI, Resources, Interaction, adds objects

        // --- Building System ---
        this.Building.init();   // Building uses many systems (Input, UI, Inventory, World, Player)

        // --- Setup Connections & Starting State ---
        this.UIManager.setupBuildMenuButtons(); // Link build menu buttons AFTER UI and Building are ready

        // *** ADD STARTING ITEMS HERE ***
        // Now that Inventory AND UIManager are initialized, adding items will update the UI correctly.
        console.log("Adding starting resources...");
        this.Inventory.addItem('wood', 100);
        this.Inventory.addItem('stone', 100);
        this.Inventory.addItem('fiber', 100);
        // Add some buildable items for testing placement
        this.Inventory.addItem('foundation', 5);
        this.Inventory.addItem('wall', 10);
        this.Inventory.addItem('wall_doorway', 2);
        this.Inventory.addItem('wall_window', 2); // Added starting window walls
        this.Inventory.addItem('door', 2);
        // *** END ADD STARTING ITEMS ***

        // Player.init already calls updateStatsUI, so this is likely redundant
        // this.Player.updateStatsUI();

        console.log("Game Initialization Complete. Starting Loop.");
        this.gameLoop(); // Start the main game loop
    },

    gameLoop: function() {
        // Bind 'this' to ensure Game object context within requestAnimationFrame
        requestAnimationFrame(this.gameLoop.bind(this));

        const deltaTime = this.Engine.clock.getDelta(); // Get time elapsed since last frame

        // --- Update Systems ---
        // Order can matter here (e.g., update Player before AI uses Player position)
        this.Player.update(deltaTime, this.World.objects); // Player logic, movement, input handling
        this.AI.update(deltaTime, this.Player.getPosition()); // AI behavior
        this.World.update(deltaTime); // Update any dynamic world elements (none currently)

        // Update Building System ghost placement IF active
        if (Building.isPlacing) {
            Building.updatePlacementGhost(this.Engine.camera, this.World.ground); // Update ghost position/rotation/validity
        }

        // --- Reset Inputs AFTER updates ---
        // Player.update resets mouse movement deltas via Input.resetMouseDeltas() inside its logic
        Input.resetMouseWheelDelta(); // Reset wheel delta each frame

        // --- Render Scene ---
        this.Engine.render(); // Draw the scene from the camera's perspective
    }
};

// Start the game once the DOM is ready and all scripts are loaded
window.addEventListener('DOMContentLoaded', () => {
    // Ensure THREE is loaded (optional check, script order should handle this)
    if (typeof THREE === 'undefined') {
        console.error("THREE.js library not loaded!");
        return;
    }
    // Make sure CONSTANTS is available (it should be if script order is correct)
    if (typeof CONSTANTS === 'undefined') {
        console.error("CONSTANTS script not loaded or executed before main.js!");
        return;
    }
    Game.init();
});