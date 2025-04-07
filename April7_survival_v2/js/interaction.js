// js/interaction.js
const Interaction = {
    raycaster: null,
    intersectedObject: null, // The object currently looked at (should be the main interactable Group/Mesh)
    promptElement: null,

    init: function() {
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = CONSTANTS.INTERACTION_RANGE; // Use constant for range
        this.promptElement = document.getElementById('interaction-prompt');
        if (!this.promptElement) {
             console.error("Interaction prompt element not found in HTML!");
        }
        console.log("Interaction System Initialized");
    },

    update: function(camera, interactables) { // interactables is an array of potential targets (Meshes OR Groups)
        if (!camera || !interactables || interactables.length === 0) {
             // Ensure we hide prompt if there are no interactables or no camera
             if (this.intersectedObject) {
                 this.intersectedObject = null;
                 this.hidePrompt();
             }
             return;
        }

        // Cast ray from camera center
        this.raycaster.setFromCamera({ x: 0, y: 0 }, camera); // Ray from center of screen

        // *** Recursive Raycasting ENABLED ***
        // This allows the raycaster to check children of objects in the interactables list
        // (e.g., the meshes inside a tree group)
        const intersects = this.raycaster.intersectObjects(interactables, true); // true for recursive

        let foundInteractableObject = null; // Store the interactable Group/Mesh we find

        if (intersects.length > 0) {
            // Iterate through the hits. The first object hit might be a sub-part (like foliage).
            // We need to find the actual parent object that was added to the 'interactables' list
            // and has the interaction data in its userData.
            for (let i = 0; i < intersects.length; i++) {
                let hitObject = intersects[i].object; // This is the actual Mesh that was hit (e.g., trunk, foliage)

                // Traverse up the parent chain from the hit mesh to find the object
                // that has the interactable flag and associated data.
                let potentialInteractable = hitObject;
                while (potentialInteractable) {
                    // Check if this object (or one of its parents) has the interactable flag set in its userData
                    if (potentialInteractable.userData?.interactable) {
                        // We found the main interactable object (e.g., the Tree Group or a standalone Rock Mesh)!
                        foundInteractableObject = potentialInteractable;
                        break; // Stop searching upwards for this particular hit
                    }
                    // Move up to the parent object
                    potentialInteractable = potentialInteractable.parent;
                }

                // If we found the interactable parent for this hit, we don't need to check further hits
                if (foundInteractableObject) {
                    break; // Stop checking other intersection points (intersects[i+1], etc.)
                }
            }
        }

        // Now, update the interaction state based on whether we found an interactable parent object.
        if (foundInteractableObject) {
             // We are looking at a valid interactable object.
             if (foundInteractableObject !== this.intersectedObject) {
                 // It's a NEW interactable object we weren't looking at before.
                 this.intersectedObject = foundInteractableObject;
                 // Show the prompt defined in the object's userData.
                 this.showPrompt(foundInteractableObject.userData.prompt || `Interact with ${foundInteractableObject.name || 'object'}`);
             }
             // If foundInteractableObject === this.intersectedObject, we are still looking at the same thing, so do nothing.
        } else {
            // We are not looking at any valid interactable object OR we looked away.
            if (this.intersectedObject) {
                // We *were* looking at something, but now we're not. Clear the state.
                this.intersectedObject = null;
                this.hidePrompt();
            }
             // If !foundInteractableObject and !this.intersectedObject, do nothing (already clear).
        }
    },

    // Function to perform the interaction when the key is pressed
    interact: function() {
        // Check if we are currently looking at a valid interactable object
        // and if that object has an onInteract function defined in its userData.
        if (this.intersectedObject && this.intersectedObject.userData?.interactable && typeof this.intersectedObject.userData.onInteract === 'function') {
            // Call the interaction function stored on the object's userData.
            // Pass the intersectedObject itself (which could be a Group or Mesh) to the function.
            this.intersectedObject.userData.onInteract(this.intersectedObject);
        } else {
            // Log if interaction is attempted without a valid target.
             // console.log("Nothing valid to interact with."); // Optional: Reduce console spam
        }
    },

    // Helper function to display the interaction prompt UI element
    showPrompt: function(text) {
        if (this.promptElement) {
            this.promptElement.textContent = text;
            this.promptElement.style.display = 'block';
        }
    },

    // Helper function to hide the interaction prompt UI element
    hidePrompt: function() {
        if (this.promptElement) {
            this.promptElement.style.display = 'none';
        }
    }
};

// Make Interaction globally accessible
window.Interaction = Interaction;