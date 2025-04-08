// js/crafting.js
class CraftingSystem {
    constructor(game) {
        this.game = game;
        this.recipes = {
            // Basic
            wood_planks: { ingredients: { wood: 2 }, produces: { itemId: 'wood_planks', quantity: 4 }, station: 'player' },
            rope: { ingredients: { fiber: 3 }, produces: { itemId: 'rope', quantity: 1 }, station: 'player' },
            campfire: { ingredients: { wood: 5, stone: 8 }, produces: { itemId: 'campfire', quantity: 1 }, station: 'player' }, // Example placeable
            bandage: { ingredients: { fiber: 2 /*, medical_herb: 1 */ }, produces: { itemId: 'bandage', quantity: 1 }, station: 'player' },

            // Workbench
            nails: { ingredients: { iron_ingot: 1 }, produces: { itemId: 'nails', quantity: 10 }, station: 'workbench' },
            axe: { ingredients: { wood: 3, iron_ingot: 2, rope: 1 }, produces: { itemId: 'axe', quantity: 1 }, station: 'workbench' },
            pickaxe: { ingredients: { wood: 3, iron_ingot: 3, rope: 1 }, produces: { itemId: 'pickaxe', quantity: 1 }, station: 'workbench' },
            // ...bows, arrows, lockpicks, ammo, building parts

            // Forge (Smelting) - Special case, maybe handle differently
            iron_ingot: { ingredients: { iron_ore: 2 /*, fuel? */ }, produces: { itemId: 'iron_ingot', quantity: 1 }, station: 'forge' },
            copper_ingot: { ingredients: { copper_ore: 2 }, produces: { itemId: 'copper_ingot', quantity: 1 }, station: 'forge' },
            zinc_ingot: { ingredients: { zinc_ore: 2 }, produces: { itemId: 'zinc_ingot', quantity: 1 }, station: 'forge' },
        };
    }

    getAvailableRecipes(stationType = 'player') {
        const available = [];
        for (const recipeId in this.recipes) {
            const recipe = this.recipes[recipeId];
            if (recipe.station === stationType && this.canCraft(recipeId)) {
                available.push(recipeId);
            }
        }
        return available;
    }

    canCraft(recipeId) {
        const recipe = this.recipes[recipeId];
        if (!recipe) return false;

        for (const itemId in recipe.ingredients) {
            const requiredQty = recipe.ingredients[itemId];
            if (!this.game.inventoryManager.has(itemId, requiredQty)) {
                return false; // Missing ingredient
            }
        }
        return true; // Has all ingredients
    }

    craft(recipeId, stationType = 'player') {
        const recipe = this.recipes[recipeId];
        if (!recipe || recipe.station !== stationType) {
            console.log("Cannot craft: Invalid recipe or wrong station");
            return false;
        }

        if (!this.canCraft(recipeId)) {
            console.log("Cannot craft: Missing ingredients for", recipeId);
            return false; // Re-check just in case
        }

        // Consume ingredients
        for (const itemId in recipe.ingredients) {
            const requiredQty = recipe.ingredients[itemId];
            this.game.inventoryManager.remove(itemId, requiredQty);
        }

        // Add crafted item(s)
        const producedItem = recipe.produces;
        this.game.inventoryManager.add(producedItem.itemId, producedItem.quantity);

        console.log(`Crafted ${producedItem.quantity}x ${producedItem.itemId}`);
        // Update UI after crafting
        this.game.uiManager.updateInventory();
        this.game.uiManager.updateQuickBar();
        // Potentially update the crafting menu UI if it's open
        // this.game.uiManager.updateCraftingMenu(stationType);
        return true;
    }

    // --- Specific Station Logic ---

    openWorkbench() {
        // TODO: Populate and show the workbench UI
        console.log("Opening Workbench Menu");
        this.game.uiManager.showWorkbenchMenu(this.getAvailableRecipes('workbench'));
    }

    closeWorkbench() {
         this.game.uiManager.hideWorkbenchMenu();
    }

    openForge() {
        // TODO: Populate and show the forge UI (might need specific input/output slots)
        console.log("Opening Forge Menu");
        this.game.uiManager.showForgeMenu(this.getAvailableRecipes('forge'));
    }

     closeForge() {
         this.game.uiManager.hideForgeMenu();
    }
}
