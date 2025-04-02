// Inventory class to manage player's items
class Inventory {
    constructor(itemManager) {
        this.itemManager = itemManager;
        
        // Inventory slots (main inventory)
        this.slots = new Array(32).fill(null);
        
        // Quick bar slots (hot bar)
        this.quickSlots = new Array(8).fill(null);
        
        // Selected quick slot
        this.selectedSlot = 0;
        
        // Event callbacks
        this.onInventoryChanged = null;
    }
    
    // Add an item to the inventory
    addItem(itemId, count = 1) {
        const item = this.itemManager.getItem(itemId);
        if (!item) {
            console.warn(`Item ${itemId} not found`);
            return false;
        }
        
        let remainingCount = count;
        
        // First check if we can stack with existing items
        if (item.stackable) {
            // Check quick bar first
            for (let i = 0; i < this.quickSlots.length && remainingCount > 0; i++) {
                if (this.quickSlots[i] && this.quickSlots[i].id === itemId) {
                    const maxStack = this.itemManager.getMaxStackSize(item);
                    const currentCount = this.quickSlots[i].count || 1;
                    const spaceLeft = maxStack - currentCount;
                    
                    if (spaceLeft > 0) {
                        const amountToAdd = Math.min(spaceLeft, remainingCount);
                        this.quickSlots[i].count = currentCount + amountToAdd;
                        remainingCount -= amountToAdd;
                    }
                }
            }
            
            // Then check main inventory
            for (let i = 0; i < this.slots.length && remainingCount > 0; i++) {
                if (this.slots[i] && this.slots[i].id === itemId) {
                    const maxStack = this.itemManager.getMaxStackSize(item);
                    const currentCount = this.slots[i].count || 1;
                    const spaceLeft = maxStack - currentCount;
                    
                    if (spaceLeft > 0) {
                        const amountToAdd = Math.min(spaceLeft, remainingCount);
                        this.slots[i].count = currentCount + amountToAdd;
                        remainingCount -= amountToAdd;
                    }
                }
            }
        }
        
        // If we still have items to add, find empty slots
        while (remainingCount > 0) {
            // First try to add to quick bar if there's space
            const quickEmptySlot = this.findEmptyQuickSlot();
            if (quickEmptySlot !== -1) {
                const newItem = this.itemManager.getItem(itemId);
                if (newItem.stackable) {
                    const maxStack = this.itemManager.getMaxStackSize(newItem);
                    const amountToAdd = Math.min(maxStack, remainingCount);
                    newItem.count = amountToAdd;
                    this.quickSlots[quickEmptySlot] = newItem;
                    remainingCount -= amountToAdd;
                } else {
                    this.quickSlots[quickEmptySlot] = newItem;
                    remainingCount--;
                }
                continue;
            }
            
            // Then try main inventory
            const emptySlot = this.findEmptySlot();
            if (emptySlot !== -1) {
                const newItem = this.itemManager.getItem(itemId);
                if (newItem.stackable) {
                    const maxStack = this.itemManager.getMaxStackSize(newItem);
                    const amountToAdd = Math.min(maxStack, remainingCount);
                    newItem.count = amountToAdd;
                    this.slots[emptySlot] = newItem;
                    remainingCount -= amountToAdd;
                } else {
                    this.slots[emptySlot] = newItem;
                    remainingCount--;
                }
                continue;
            }
            
            // If we get here, inventory is full
            console.warn('Inventory full, unable to add more items');
            break;
        }
        
        // Notify about inventory change
        if (this.onInventoryChanged) {
            this.onInventoryChanged();
        }
        
        return remainingCount === 0;
    }
    
    // Remove items from inventory
    removeItem(itemId, count = 1) {
        let remainingToRemove = count;
        
        // First check quick bar
        for (let i = 0; i < this.quickSlots.length && remainingToRemove > 0; i++) {
            if (this.quickSlots[i] && this.quickSlots[i].id === itemId) {
                const currentCount = this.quickSlots[i].count || 1;
                
                if (currentCount <= remainingToRemove) {
                    // Remove the entire stack
                    remainingToRemove -= currentCount;
                    this.quickSlots[i] = null;
                } else {
                    // Remove part of the stack
                    this.quickSlots[i].count = currentCount - remainingToRemove;
                    remainingToRemove = 0;
                }
            }
        }
        
        // Then check main inventory
        for (let i = 0; i < this.slots.length && remainingToRemove > 0; i++) {
            if (this.slots[i] && this.slots[i].id === itemId) {
                const currentCount = this.slots[i].count || 1;
                
                if (currentCount <= remainingToRemove) {
                    // Remove the entire stack
                    remainingToRemove -= currentCount;
                    this.slots[i] = null;
                } else {
                    // Remove part of the stack
                    this.slots[i].count = currentCount - remainingToRemove;
                    remainingToRemove = 0;
                }
            }
        }
        
        // Notify about inventory change
        if (this.onInventoryChanged) {
            this.onInventoryChanged();
        }
        
        return remainingToRemove === 0;
    }
    
    // Move an item between inventory and quick bar
    moveItem(sourceType, sourceIndex, destinationType, destinationIndex) {
        let sourceArray = sourceType === 'inventory' ? this.slots : this.quickSlots;
        let destArray = destinationType === 'inventory' ? this.slots : this.quickSlots;
        
        // Check if indices are valid
        if (sourceIndex < 0 || sourceIndex >= sourceArray.length ||
            destinationIndex < 0 || destinationIndex >= destArray.length) {
            console.warn('Invalid source or destination index');
            return false;
        }
        
        // Get source item
        const sourceItem = sourceArray[sourceIndex];
        if (!sourceItem) {
            console.warn('No item in source slot');
            return false;
        }
        
        // Get destination item
        const destItem = destArray[destinationIndex];
        
        // If destination is empty, just move the item
        if (!destItem) {
            destArray[destinationIndex] = sourceItem;
            sourceArray[sourceIndex] = null;
        }
        // If the items are the same and stackable, try to stack them
        else if (destItem.id === sourceItem.id && this.itemManager.canStackItems(destItem)) {
            const maxStack = this.itemManager.getMaxStackSize(destItem);
            const sourceCount = sourceItem.count || 1;
            const destCount = destItem.count || 1;
            
            // Check if there's room in the destination stack
            if (destCount < maxStack) {
                const spaceLeft = maxStack - destCount;
                
                if (sourceCount <= spaceLeft) {
                    // All items fit in destination
                    destItem.count = destCount + sourceCount;
                    sourceArray[sourceIndex] = null;
                } else {
                    // Only part of the items fit
                    destItem.count = maxStack;
                    sourceItem.count = sourceCount - spaceLeft;
                }
            } else {
                // Destination stack is full, swap items
                destArray[destinationIndex] = sourceItem;
                sourceArray[sourceIndex] = destItem;
            }
        }
        // Otherwise swap the items
        else {
            destArray[destinationIndex] = sourceItem;
            sourceArray[sourceIndex] = destItem;
        }
        
        // Notify about inventory change
        if (this.onInventoryChanged) {
            this.onInventoryChanged();
        }
        
        return true;
    }
    
    // Get active item from quick bar
    getActiveItem(slot = null) {
        const activeSlot = slot !== null ? slot : this.selectedSlot;
        return this.quickSlots[activeSlot];
    }
    
    // Find an empty slot in the main inventory
    findEmptySlot() {
        for (let i = 0; i < this.slots.length; i++) {
            if (!this.slots[i]) {
                return i;
            }
        }
        return -1;
    }
    
    // Find an empty slot in the quick bar
    findEmptyQuickSlot() {
        for (let i = 0; i < this.quickSlots.length; i++) {
            if (!this.quickSlots[i]) {
                return i;
            }
        }
        return -1;
    }
    
    // Check if the inventory has an item
    hasItem(itemId) {
        // Check quick bar
        for (const item of this.quickSlots) {
            if (item && item.id === itemId) {
                return true;
            }
        }
        
        // Check main inventory
        for (const item of this.slots) {
            if (item && item.id === itemId) {
                return true;
            }
        }
        
        return false;
    }
    
    // Get the first item found with the given ID
    getItem(itemId) {
        // Check quick bar
        for (const item of this.quickSlots) {
            if (item && item.id === itemId) {
                return item;
            }
        }
        
        // Check main inventory
        for (const item of this.slots) {
            if (item && item.id === itemId) {
                return item;
            }
        }
        
        return null;
    }
    
    // Count the total amount of an item across all inventory slots
    countItem(itemId) {
        let count = 0;
        
        // Count in quick bar
        for (const item of this.quickSlots) {
            if (item && item.id === itemId) {
                count += item.count || 1;
            }
        }
        
        // Count in main inventory
        for (const item of this.slots) {
            if (item && item.id === itemId) {
                count += item.count || 1;
            }
        }
        
        return count;
    }
    
    // Check if player has enough resources for crafting
    hasResources(recipe) {
        for (const [itemId, amount] of Object.entries(recipe)) {
            const available = this.countItem(itemId);
            if (available < amount) {
                return false;
            }
        }
        
        return true;
    }
    
    // Consume resources for crafting
    consumeResources(recipe) {
        // First check if we have enough resources
        if (!this.hasResources(recipe)) {
            return false;
        }
        
        // Then consume the resources
        for (const [itemId, amount] of Object.entries(recipe)) {
            this.removeItem(itemId, amount);
        }
        
        return true;
    }
    
    // Clear the inventory
    clear() {
        this.slots = new Array(32).fill(null);
        this.quickSlots = new Array(8).fill(null);
        
        // Notify about inventory change
        if (this.onInventoryChanged) {
            this.onInventoryChanged();
        }
    }
}