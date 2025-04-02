// Item manager to handle all game items
class ItemManager {
    constructor(assetLoader) {
        this.assetLoader = assetLoader;
        this.items = this.defineItems();
    }
    
    defineItems() {
        // Define all game items and their properties
        return {
            // Tools
            'axe': {
                id: 'axe',
                name: 'Axe',
                description: 'Used to chop trees for wood',
                type: 'tool',
                icon: 0, // Index in the item icons sprite sheet
                stackable: false,
                equippable: true,
                durability: 100,
                craftable: true,
                recipe: {
                    'wood': 3,
                    'stone': 1
                }
            },
            'pickaxe': {
                id: 'pickaxe',
                name: 'Pickaxe',
                description: 'Used to mine rocks for stone',
                type: 'tool',
                icon: 1,
                stackable: false,
                equippable: true,
                durability: 100,
                craftable: true,
                recipe: {
                    'wood': 2,
                    'stone': 3
                }
            },
            'knife': {
                id: 'knife',
                name: 'Knife',
                description: 'Used for skinning animals and other tasks',
                type: 'tool',
                icon: 2,
                stackable: false,
                equippable: true,
                durability: 50,
                craftable: true,
                recipe: {
                    'stone': 1,
                    'wood': 1
                }
            },
            'canteen': {
                id: 'canteen',
                name: 'Canteen',
                description: 'Used to carry water',
                type: 'tool',
                icon: 3,
                stackable: false,
                equippable: true,
                durability: null, // Doesn't degrade
                craftable: true,
                recipe: {
                    'scrap_metal': 2
                }
            },
            
            // Resources
            'wood': {
                id: 'wood',
                name: 'Wood',
                description: 'Basic building material',
                type: 'resource',
                icon: 4,
                stackable: true,
                maxStack: 50,
                equippable: false
            },
            'stone': {
                id: 'stone',
                name: 'Stone',
                description: 'Used for crafting tools and buildings',
                type: 'resource',
                icon: 5,
                stackable: true,
                maxStack: 50,
                equippable: false
            },
            'scrap_metal': {
                id: 'scrap_metal',
                name: 'Scrap Metal',
                description: 'Metal salvaged from debris',
                type: 'resource',
                icon: 6,
                stackable: true,
                maxStack: 30,
                equippable: false
            },
            'nails': {
                id: 'nails',
                name: 'Nails',
                description: 'Used for construction',
                type: 'resource',
                icon: 7,
                stackable: true,
                maxStack: 100,
                equippable: false,
                craftable: true,
                recipe: {
                    'scrap_metal': 1
                }
            },
            'rope': {
                id: 'rope',
                name: 'Rope',
                description: 'Used for crafting and building',
                type: 'resource',
                icon: 8,
                stackable: true,
                maxStack: 20,
                equippable: false,
                craftable: true,
                recipe: {
                    'grass': 5
                }
            },
            'grass': {
                id: 'grass',
                name: 'Grass',
                description: 'Can be crafted into rope',
                type: 'resource',
                icon: 9,
                stackable: true,
                maxStack: 50,
                equippable: false
            },
            'meat': {
                id: 'meat',
                name: 'Raw Meat',
                description: 'Must be cooked before eating',
                type: 'food',
                icon: 10,
                stackable: true,
                maxStack: 10,
                equippable: false,
                foodValue: 0, // Raw meat doesn't restore hunger
                cookable: true,
                cookedItem: 'cooked_meat'
            },
            'cooked_meat': {
                id: 'cooked_meat',
                name: 'Cooked Meat',
                description: 'Restores hunger',
                type: 'food',
                icon: 11,
                stackable: true,
                maxStack: 10,
                equippable: false,
                foodValue: 30, // Restores 30 hunger points
                cookable: false
            },
            'leather': {
                id: 'leather',
                name: 'Leather',
                description: 'Used for crafting clothing and equipment',
                type: 'resource',
                icon: 12,
                stackable: true,
                maxStack: 20,
                equippable: false
            },
            'fat': {
                id: 'fat',
                name: 'Animal Fat',
                description: 'Can be used for crafting',
                type: 'resource',
                icon: 13,
                stackable: true,
                maxStack: 10,
                equippable: false
            },
            
            // Placeables
            'campfire': {
                id: 'campfire',
                name: 'Campfire',
                description: 'Used for cooking and purifying water',
                type: 'placeable',
                icon: 14,
                stackable: true,
                maxStack: 5,
                equippable: false,
                placeable: true,
                craftable: true,
                recipe: {
                    'wood': 10,
                    'stone': 5
                }
            },
            'crafting_table': {
                id: 'crafting_table',
                name: 'Crafting Table',
                description: 'Allows crafting advanced items',
                type: 'placeable',
                icon: 15,
                stackable: false,
                equippable: false,
                placeable: true,
                craftable: true,
                recipe: {
                    'wood': 15,
                    'nails': 10
                }
            },
            'forge': {
                id: 'forge',
                name: 'Forge',
                description: 'Used to refine metals',
                type: 'placeable',
                icon: 16,
                stackable: false,
                equippable: false,
                placeable: true,
                craftable: true,
                recipe: {
                    'stone': 20,
                    'scrap_metal': 10,
                    'wood': 5
                }
            }
        };
    }
    
    getItem(itemId) {
        // Return a copy of the item definition
        if (!this.items[itemId]) {
            console.warn(`Item ${itemId} not found`);
            return null;
        }
        
        return { ...this.items[itemId] };
    }
    
    getItemTexture(item) {
        // Get texture coordinates for item icon from sprite sheet
        const itemIconsPerRow = 8;
        const iconIndex = item.icon || 0;
        
        const row = Math.floor(iconIndex / itemIconsPerRow);
        const col = iconIndex % itemIconsPerRow;
        
        return {
            row,
            col,
            size: 1 / itemIconsPerRow
        };
    }
    
    getItemModel(itemId) {
        // Get 3D model for item if available
        if (this.assetLoader.getModel(itemId)) {
            return this.assetLoader.getModel(itemId);
        }
        
        // Return null if no model found
        return null;
    }
    
    isItemCraftable(itemId) {
        const item = this.getItem(itemId);
        return item && item.craftable === true;
    }
    
    getRecipe(itemId) {
        const item = this.getItem(itemId);
        return item && item.recipe ? item.recipe : null;
    }
    
    getCraftableItems() {
        // Return a list of all craftable items
        return Object.values(this.items).filter(item => item.craftable);
    }
    
    canStackItems(item) {
        return item && item.stackable;
    }
    
    getMaxStackSize(item) {
        return item && item.stackable ? (item.maxStack || 99) : 1;
    }
}