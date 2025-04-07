// js/main.js

// Use a global object to hold game state/modules if not using ES6 modules
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
        this.Resources.init(); // Load resource defs
        this.Inventory.init(); // Init inventory before crafting/player
        this.Crafting.init();
        this.Interaction.init();
        this.Player.init(this.Engine.camera); // Player needs camera ref
        this.AI.init(); // AI before World if World spawns AI immediately
        this.World.init();   // World spawns ground, resources, static objects
        this.Building.init();
        this.UIManager.init(); // UI last, might read initial values

        console.log("Game Initialization Complete. Starting Loop.");
        this.gameLoop(); // Start the loop
    },

    gameLoop: function() {
        // Bind 'this' to ensure Game object context within requestAnimationFrame
        requestAnimationFrame(this.gameLoop.bind(this));

        const deltaTime = this.Engine.clock.getDelta();

        // Update Systems
        // Pass necessary data between systems
        this.Player.update(deltaTime, this.World.objects); // Player needs delta and colliders
        this.AI.update(deltaTime, this.Player.getPosition()); // AI needs player position
        this.World.update(deltaTime); // Update world dynamics (if any)

         // Update Building System ghost placement if active
         if (this.Building.isBuilding) {
             this.Building.update(this.Engine.camera, this.World.ground);
         }


        // Render Scene
        this.Engine.render();
    }
};

// Start the game once the DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    Game.init();
});