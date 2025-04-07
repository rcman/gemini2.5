// js/crafting.js
const Crafting = {
    recipes: CONSTANTS.RECIPES, // Get recipes from constants

    init: function() {
        console.log("Crafting System Initialized");
    },

    getRecipe: function(itemName) {
       // Find recipe by the item it produces (the key in CONSTANTS.RECIPES)
       if(this.recipes[itemName]){
            // Basic items might not have a name property, use the key
           return { name: itemName, ingredients: this.recipes[itemName] };
       }
       // Search deeper if recipes have more data later
       return null;
    },

    canCraft: function(itemName) {
        const recipe = this.recipes[itemName];
        if (!recipe) return false; // No recipe found

        return Inventory.hasItems(recipe);
    },

    attemptCraft: function(itemName) {
        const recipe = this.recipes[itemName];
        const recipeData = this.getRecipe(itemName); // For getting the display name

        if (!recipe) {
            Game.UIManager.logMessage(`Cannot craft ${itemName}: Recipe unknown.`);
            console.warn(`Recipe not found for ${itemName}`);
            return false;
        }

        if (this.canCraft(itemName)) {
            // Consume ingredients
            for (const ingredientId in recipe) {
                Inventory.removeItem(ingredientId, recipe[ingredientId]);
            }
            // Add crafted item
            Inventory.addItem(itemName, 1); // Assuming recipes craft 1 item
            Game.UIManager.logMessage(`Crafted ${recipeData?.name || itemName}!`);
            console.log(`Crafted ${itemName}`);
            return true;
        } else {
            Game.UIManager.logMessage(`Cannot craft ${recipeData?.name || itemName}: Missing ingredients.`);
            console.log(`Failed to craft ${itemName}, missing ingredients.`);
            return false;
        }
    }

    // Add functions for different crafting stations (Workbench, Forge, etc.) later
};

window.Crafting = Crafting;