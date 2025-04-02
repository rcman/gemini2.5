// Crafting system to handle crafting game items
class CraftingSystem {
    constructor(inventory, itemManager) {
        this.inventory = inventory;
        this.itemManager = itemManager;
        this.craftableItems = [];
        
        // Initialize craftable items
        this.refreshCraftableItems();
    }
    
    // Get a list of currently craftable items based on available resources
    refreshCraftableItems() {
        this.craftableItems = [];
        
        // Get all craftable items from item manager
        const allCraftable = this.itemManager.getCraftableItems();
        
        // Check each item to see if it can be crafted with current resources
        for (const item of allCraftable) {
            const canCraft = this.inventory.hasResources(item.recipe);
            
            this.craftableItems.push({
                item: item,
                canCraft: canCraft
            });
        }
        
        return this.craftableItems;
    }
    
    // Craft an item
    craftItem(itemId) {
        const item = this.itemManager.getItem(itemId);
        
        // Check if item exists and is craftable
        if (!item || !item.craftable) {
            console.warn(`Item ${itemId} is not craftable`);
            return false;
        }
        
        // Check if we have enough resources
        if (!this.inventory.hasResources(item.recipe)) {
            console.warn(`Not enough resources to craft ${item.name}`);
            return false;
        }
        
        // Consume the resources
        const resourcesConsumed = this.inventory.consumeResources(item.recipe);
        
        if (!resourcesConsumed) {
            console.error('Failed to consume resources');
            return false;
        }
        
        // Add the crafted item to inventory
        const itemAdded = this.inventory.addItem(itemId, 1);
        
        if (!itemAdded) {
            console.error('Failed to add crafted item to inventory');
            return false;
        }
        
        // Refresh craftable items list
        this.refreshCraftableItems();
        
        console.log(`Successfully crafted ${item.name}`);
        return true;
    }
    
    // Get recipe for an item
    getRecipe(itemId) {
        return this.itemManager.getRecipe(itemId);
    }
    
    // Get formatted recipe as an array of {itemId, amount} objects
    getFormattedRecipe(itemId) {
        const recipe = this.getRecipe(itemId);
        
        if (!recipe) return [];
        
        const formattedRecipe = [];
        
        for (const [reqItemId, amount] of Object.entries(recipe)) {
            const reqItem = this.itemManager.getItem(reqItemId);
            
            formattedRecipe.push({
                itemId: reqItemId,
                name: reqItem ? reqItem.name : reqItemId,
                amount: amount
            });
        }
        
        return formattedRecipe;
    }
    
    // Get all available recipes
    getAllRecipes() {
        const recipes = [];
        
        for (const craftable of this.craftableItems) {
            const recipe = this.getFormattedRecipe(craftable.item.id);
            
            recipes.push({
                itemId: craftable.item.id,
                name: craftable.item.name,
                canCraft: craftable.canCraft,
                recipe: recipe
            });
        }
        
        return recipes;
    }
    
    // Calculate what resources are missing for a recipe
    getMissingResources(itemId) {
        const recipe = this.getRecipe(itemId);
        
        if (!recipe) return {};
        
        const missing = {};
        
        for (const [reqItemId, amount] of Object.entries(recipe)) {
            const available = this.inventory.countItem(reqItemId);
            
            if (available < amount) {
                missing[reqItemId] = amount - available;
            }
        }
        
        return missing;
    }
    
    // Determine if a recipe requires a crafting table
    requiresCraftingTable(itemId) {
        const item = this.itemManager.getItem(itemId);
        
        // For now, let's say items with more than 2 ingredients require a crafting table
        if (item && item.recipe) {
            return Object.keys(item.recipe).length > 2;
        }
        
        return false;
    }
    
    // Determine if a recipe requires a forge
    requiresForge(itemId) {
        const item = this.itemManager.getItem(itemId);
        
        // Items that use scrap metal require a forge
        if (item && item.recipe) {
            return Object.keys(item.recipe).includes('scrap_metal');
        }
        
        return false;
    }
    
    // Cook a food item on a campfire
    cookItem(itemId) {
        const item = this.itemManager.getItem(itemId);
        
        // Check if item exists and is cookable
        if (!item || !item.cookable) {
            console.warn(`Item ${itemId} is not cookable`);
            return false;
        }
        
        // Check if we have the item
        if (!this.inventory.hasItem(itemId)) {
            console.warn(`No ${item.name} in inventory to cook`);
            return false;
        }
        
        // Get the cooked version of the item
        const cookedItemId = item.cookedItem;
        
        if (!cookedItemId) {
            console.warn(`No cooked version defined for ${item.name}`);
            return false;
        }
        
        // Remove raw item and add cooked item
        const removed = this.inventory.removeItem(itemId, 1);
        
        if (!removed) {
            console.error('Failed to remove raw item from inventory');
            return false;
        }
        
        const added = this.inventory.addItem(cookedItemId, 1);
        
        if (!added) {
            console.error('Failed to add cooked item to inventory');
            // Try to restore the raw item
            this.inventory.addItem(itemId, 1);
            return false;
        }
        
        console.log(`Successfully cooked ${item.name} into ${this.itemManager.getItem(cookedItemId).name}`);
        return true;
    }
    
    // Purify water in a canteen
    purifyWater() {
        // Check if player has a canteen with unpurified water
        const canteen = this.inventory.getItem('canteen');
        
        if (!canteen) {
            console.warn('No canteen in inventory');
            return false;
        }
        
        if (!canteen.userData || !canteen.userData.waterFilled) {
            console.warn('Canteen does not contain water');
            return false;
        }
        
        if (canteen.userData.purified) {
            console.warn('Water is already purified');
            return false;
        }
        
        // Purify the water
        canteen.userData.purified = true;
        
        console.log('Successfully purified water in canteen');
        return true;
    }
}