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
        this.Input.init();
        this.Resources.init();

        // --- UI Manager BEFORE modules that use it ---
        this.UIManager.init();

        // --- Game Logic Systems ---
        this.Crafting.init();
        this.Inventory.init(); // Inventory initialized HERE
        this.Interaction.init();

        // --- Player & World ---
        this.Player.init(this.Engine.camera);
        this.AI.init();
        this.World.init();

        // --- Building System ---
        this.Building.init();

        // --- Setup Connections & Starting State ---
        this.UIManager.setupBuildMenuButtons();

        // *** ADD STARTING INVENTORY ITEMS HERE ***
        console.log("Adding starting resources...");
        this.Inventory.addItem('wood', 100); // Added to main inventory
        this.Inventory.addItem('stone', 100); // Added to main inventory
        this.Inventory.addItem('fiber', 100); // Added to main inventory
        this.Inventory.addItem('foundation', 5); // Added to main inventory
        this.Inventory.addItem('wall', 10); // Added to main inventory
        this.Inventory.addItem('wall_doorway', 2); // Added to main inventory
        this.Inventory.addItem('wall_window', 2); // Added to main inventory
        this.Inventory.addItem('door', 2); // Added to main inventory
        // *** END STARTING INVENTORY ITEMS ***

        // *** ADD STARTING QUICK BAR ITEMS ***
        console.log("Adding starting quick bar items...");
        this.Inventory.addToQuickBar({ itemId: 'axe', quantity: 1 }, 0);     // Axe in Slot 1 (index 0)
        this.Inventory.addToQuickBar({ itemId: 'pickaxe', quantity: 1 }, 1); // Pickaxe in Slot 2 (index 1)
        this.Inventory.addToQuickBar({ itemId: 'knife', quantity: 1 }, 2);    // Knife in Slot 3 (index 2)
        this.Inventory.addToQuickBar({ itemId: 'canteen', quantity: 1 }, 3);  // Canteen in Slot 4 (index 3)
        // *** END STARTING QUICK BAR ITEMS ***

        console.log("Game Initialization Complete. Starting Loop.");
        this.gameLoop(); // Start the main game loop
    },

    gameLoop: function() {
        // Bind 'this' to ensure Game object context within requestAnimationFrame
        requestAnimationFrame(this.gameLoop.bind(this));

        const deltaTime = this.Engine.clock.getDelta(); // Get time elapsed since last frame

        // --- Update Systems ---
        this.Player.update(deltaTime, this.World.objects);
        this.AI.update(deltaTime, this.Player.getPosition());
        this.World.update(deltaTime);

        // Update Building System ghost placement IF active
        if (Building.isPlacing) {
            Building.updatePlacementGhost(this.Engine.camera, this.World.ground);
        }

        // --- Reset Inputs AFTER updates ---
        Input.resetMouseWheelDelta();

        // --- Render Scene ---
        this.Engine.render();
    }
};

// Start the game once the DOM is ready and all scripts are loaded
window.addEventListener('DOMContentLoaded', () => {
    if (typeof THREE === 'undefined') {
        console.error("THREE.js library not loaded!");
        return;
    }
    if (typeof CONSTANTS === 'undefined') {
        console.error("CONSTANTS script not loaded or executed before main.js!");
        return;
    }
    Game.init();
});