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

        this.Engine.init();
        this.Input.init(); // Input before modules using it
        this.Resources.init(); // Resources before Crafting/Inventory use definitions
        this.Crafting.init(); // Crafting depends on Constants/Resources

        this.Inventory.init(); // Initialize Inventory structure first
        // *** ADD STARTING ITEMS HERE ***
        console.log("Adding starting resources...");
        this.Inventory.addItem('wood', 100);
        this.Inventory.addItem('stone', 100);
        this.Inventory.addItem('fiber', 100);
        // *** END ADD STARTING ITEMS ***

        this.Interaction.init(); // Interaction system
        this.Player.init(this.Engine.camera); // Player uses Inventory, Interaction, Engine Camera
        this.AI.init(); // AI system
        this.World.init(); // World uses AI, Resources, Engine Scene
        this.Building.init(); // Building uses Inventory, Constants, Input, World etc.
        this.UIManager.init(); // UI uses Inventory, Player stats etc.
        this.UIManager.setupBuildMenuButtons(); // Link build menu buttons AFTER UI and Building are ready

        // Note: Initial UI update for inventory is handled within the Inventory.addItem calls via updateUI/updateQuickBarUI

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
        // Player.update should handle resetting mouse movement deltas now
        Input.resetMouseWheelDelta(); // Reset wheel delta each frame

        // --- Render Scene ---
        this.Engine.render(); // Draw the scene from the camera's perspective
    }
};

// Start the game once the DOM is ready and all scripts are loaded
window.addEventListener('DOMContentLoaded', () => {
    Game.init();
});