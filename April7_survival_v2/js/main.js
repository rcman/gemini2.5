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
        this.Input.init();
        this.Resources.init();
        this.Crafting.init(); // Crafting before Inventory uses its recipes
        this.Inventory.init();
        this.Interaction.init();
        this.Player.init(this.Engine.camera);
        this.AI.init();
        this.World.init();
        this.Building.init(); // Building before UI uses its functions
        this.UIManager.init();
        this.UIManager.setupBuildMenuButtons(); // <<< Link build menu buttons AFTER UI and Building are ready

        console.log("Game Initialization Complete. Starting Loop.");
        this.gameLoop(); // Start the loop
    },

    gameLoop: function() {
        // Bind 'this' to ensure Game object context within requestAnimationFrame
        requestAnimationFrame(this.gameLoop.bind(this));

        const deltaTime = this.Engine.clock.getDelta();

        // Update Systems
        this.Player.update(deltaTime, this.World.objects);
        this.AI.update(deltaTime, this.Player.getPosition());
        this.World.update(deltaTime); // Update world dynamics (if any)

         // Update Building System ghost placement IF active
         if (Building.isPlacing) { // <<< Use the new flag
             Building.updatePlacementGhost(this.Engine.camera, this.World.ground); // <<< Use the new function
         }

        // Render Scene
        this.Engine.render();
    }
};

// Start the game once the DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    Game.init();
});