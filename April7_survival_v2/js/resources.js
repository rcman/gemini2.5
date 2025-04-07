// js/resources.js
const Resources = {
    definitions: CONSTANTS.RESOURCES, // Use definitions from constants

    // Example function - you might have more complex spawning logic
    getResourceData: function(resourceId) {
        for (const key in this.definitions) {
            if (this.definitions[key].id === resourceId) {
                return this.definitions[key];
            }
        }
        return null; // Not found
    },

    init: function() {
        console.log("Resource Definitions Loaded");
        // Potential: Initialize resource node managers or spawning systems here
    }
};

window.Resources = Resources;