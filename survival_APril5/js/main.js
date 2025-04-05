// js/main.js
import * as THREE from './libs/three.min.js';
import { setupScene } from './sceneSetup.js';
import { Player } from './player.js';
import { World } from './world.js';
import { InputHandler } from './inputHandler.js';
// import { updateUI } from './ui.js'; // Import if UI needs frequent updates in game loop

class Game {
    constructor() {
        this.clock = new THREE.Clock();
        this.init();
    }

    init() {
        // Basic Setup
        const { scene, camera, renderer } = setupScene('game-container');
        if (!scene) return; // Stop if setup failed
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        // World
        this.world = new World(this.scene);

        // Player
        this.player = new Player(this.scene, this.camera); // Pass camera for control

        // Input
        this.inputHandler = new InputHandler(this.player, this.world);

        // Start the animation loop
        this.animate();
    }

    animate() {
        // Request next frame
        requestAnimationFrame(() => this.animate()); // Use arrow function to keep 'this' context

        // Calculate delta time for frame-rate independent movement
        const deltaTime = this.clock.getDelta();

        // Update game components
        this.player.update(deltaTime, this.inputHandler.getKeysPressed(), this.world.getInteractableObjects());
        // Update world (e.g., animal animations, dynamic events - TBD)
        // this.world.update(deltaTime);

        // Update UI elements if needed (e.g., health bar, hunger - TBD)
        // updateUI(this.player);

        // Render the scene
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game when the script loads
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});
