// js/interaction.js
const Interaction = {
    raycaster: null,
    intersectedObject: null, // The object currently looked at
    promptElement: null,

    init: function() {
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = CONSTANTS.INTERACTION_RANGE;
        this.promptElement = document.getElementById('interaction-prompt');
        console.log("Interaction System Initialized");
    },

    update: function(camera, interactables) { // interactables is an array of Meshes
        if (!camera || !interactables) return;

        // Cast ray from camera center
        this.raycaster.setFromCamera({ x: 0, y: 0 }, camera); // Ray from center of screen

        const intersects = this.raycaster.intersectObjects(interactables, false); // Don't check children recursively unless needed

        let foundInteractable = false;
        if (intersects.length > 0) {
            const firstHit = intersects[0].object;
            // Check if the object has interaction data (you'll add this in world.js)
            if (firstHit.userData && firstHit.userData.interactable) {
                 this.intersectedObject = firstHit;
                 this.showPrompt(firstHit.userData.prompt || `Interact with ${firstHit.name || 'object'}`);
                 foundInteractable = true;
            }
        }

        if (!foundInteractable) {
             this.intersectedObject = null;
             this.hidePrompt();
        }
    },

    interact: function() {
        if (this.intersectedObject && this.intersectedObject.userData.onInteract) {
            // Call the interaction function defined on the object's userData
            this.intersectedObject.userData.onInteract(this.intersectedObject);
            // Potentially hide prompt immediately after interaction?
            // this.intersectedObject = null;
            // this.hidePrompt();
        } else {
             console.log("Nothing to interact with.");
        }
    },

    showPrompt: function(text) {
        if (this.promptElement) {
            this.promptElement.textContent = text;
            this.promptElement.style.display = 'block';
        }
    },

    hidePrompt: function() {
        if (this.promptElement) {
            this.promptElement.style.display = 'none';
        }
    }
};

window.Interaction = Interaction;