// js/inventory.js

const Inventory = {
    quickBarSize: 8,
    inventorySize: 24,
    quickBar: [],       // Array of { item: 'itemName', quantity: number } or null
    inventory: [],      // Array of { item: 'itemName', quantity: number } or null
    selectedQuickSlot: 0,

    init(resourceMultiplier = 1) {
        this.quickBar = Array(this.quickBarSize).fill(null);
        this.inventory = Array(this.inventorySize).fill(null);

        // Starting items
        this.addItem('axe', 1 * resourceMultiplier);
        this.addItem('pickaxe', 1 * resourceMultiplier);
        this.addItem('knife', 1 * resourceMultiplier);
        this.addItem('canteen', 1 * resourceMultiplier); // Add canteen

        Utils.logMessage("Inventory initialized.");
        UI.updateInventory(); // Update UI after init
    },

    // --- Item Management ---

    /** Adds an item, trying quick bar first, then inventory. Stacks if possible. */
    addItem(itemName, quantity = 1) {
        if (quantity <= 0) return false;

        let remainingQuantity = quantity;

        // 1. Try stacking in Quick Bar
        remainingQuantity = this._tryStackItem(itemName, remainingQuantity, this.quickBar);
        if (remainingQuantity <= 0) { UI.updateInventory(); return true; }

        // 2. Try stacking in Inventory
        remainingQuantity = this._tryStackItem(itemName, remainingQuantity, this.inventory);
        if (remainingQuantity <= 0) { UI.updateInventory(); return true; }

        // 3. Try adding to empty Quick Bar slot
        remainingQuantity = this._tryAddToEmptySlot(itemName, remainingQuantity, this.quickBar);
        if (remainingQuantity <= 0) { UI.updateInventory(); return true; }

        // 4. Try adding to empty Inventory slot
        remainingQuantity = this._tryAddToEmptySlot(itemName, remainingQuantity, this.inventory);
        if (remainingQuantity <= 0) { UI.updateInventory(); return true; }

        // If still remaining quantity, inventory is full
        if (remainingQuantity > 0) {
            Utils.logMessage(`Inventory full. Could not add ${remainingQuantity} ${itemName}.`);
            // Optionally add back the items that *did* fit before this point if it was partial
            UI.updateInventory();
            return false;
        }

        return true; // Should have returned earlier if successful
    },

    _tryStackItem(itemName, quantity, storage) {
        for (let i = 0; i < storage.length; i++) {
            const slot = storage[i];
            // Basic stacking (no max stack size implemented here, add later if needed)
            if (slot && slot.item === itemName) {
                slot.quantity += quantity;
                return 0; // All items stacked
            }
        }
        return quantity; // No stacking occurred
    },

    _tryAddToEmptySlot(itemName, quantity, storage) {
        for (let i = 0; i < storage.length; i++) {
            if (storage[i] === null) {
                storage[i] = { item: itemName, quantity: quantity };
                return 0; // All items added
            }
        }
        return quantity; // No empty slot found
    },

    /** Removes items, checking both quick bar and inventory. */
    removeItem(itemName, quantity = 1) {
        let needed = quantity;

        // Remove from quick bar first
        needed = this._removeItemFromStorage(itemName, needed, this.quickBar);
        if (needed <= 0) { UI.updateInventory(); return true; }

        // Remove from inventory
        needed = this._removeItemFromStorage(itemName, needed, this.inventory);
        if (needed <= 0) { UI.updateInventory(); return true; }

        // If needed > 0, not enough items were found
        console.warn(`Could not find enough ${itemName} to remove. Still need ${needed}.`);
        // TODO: Potentially revert removals if total wasn't met? (More complex)
        UI.updateInventory();
        return false;
    },

    _removeItemFromStorage(itemName, quantity, storage) {
        let needed = quantity;
        // Iterate backwards to safely remove/nullify slots
        for (let i = storage.length - 1; i >= 0; i--) {
            const slot = storage[i];
            if (slot && slot.item === itemName) {
                if (slot.quantity > needed) {
                    slot.quantity -= needed;
                    needed = 0;
                    break; // Found enough
                } else {
                    needed -= slot.quantity;
                    storage[i] = null; // Remove the stack
                }
            }
            if (needed <= 0) break;
        }
        return needed; // Return remaining needed quantity
    },

    /** Counts total quantity of an item across both inventories. */
    countItem(itemName) {
        let total = 0;
        this.quickBar.forEach(slot => {
            if (slot && slot.item === itemName) total += slot.quantity;
        });
        this.inventory.forEach(slot => {
            if (slot && slot.item === itemName) total += slot.quantity;
        });
        return total;
    },

    /** Checks if the player has at least a certain quantity of an item. */
    hasItem(itemName, quantity = 1) {
        return this.countItem(itemName) >= quantity;
    },

    /** Moves an item stack between inventory/quickbar or within the same. */
    moveItem(fromSource, fromIndex, toSource, toIndex) {
        const sourceStorage = fromSource === 'quick' ? this.quickBar : this.inventory;
        const targetStorage = toSource === 'quick' ? this.quickBar : this.inventory;

        if (fromIndex < 0 || fromIndex >= sourceStorage.length ||
            toIndex < 0 || toIndex >= targetStorage.length) {
            console.error("Invalid move index.");
            return;
        }

        const itemToMove = sourceStorage[fromIndex];
        const itemAtTarget = targetStorage[toIndex];

        if (!itemToMove) return; // Nothing to move

        // Simple swap if target is empty or different item
        if (!itemAtTarget || itemAtTarget.item !== itemToMove.item) {
             // Swap directly
             targetStorage[toIndex] = itemToMove;
             sourceStorage[fromIndex] = itemAtTarget; // Put target's item back (or null)
        }
        // If same item, try to stack
        else if (itemAtTarget.item === itemToMove.item) {
            // Basic stacking: just add quantities (add max stack size logic here if needed)
            itemAtTarget.quantity += itemToMove.quantity;
            sourceStorage[fromIndex] = null; // Clear original slot
        }

        UI.updateInventory();
    },

     // --- Quick Bar Specific ---
     setSelectedQuickSlot(index) {
        if (index >= 0 && index < this.quickBarSize) {
            this.selectedQuickSlot = index;
            UI.updateInventory(); // Update UI to show selection
            Utils.logMessage(`Selected: ${this.getSelectedItem()?.item || 'Empty Slot'}`);
        }
    },

    getSelectedItem() {
        return this.quickBar[this.selectedQuickSlot];
    },

    cycleSelectedQuickSlot(direction) {
        this.selectedQuickSlot += direction;
        if (this.selectedQuickSlot < 0) {
            this.selectedQuickSlot = this.quickBarSize - 1;
        } else if (this.selectedQuickSlot >= this.quickBarSize) {
            this.selectedQuickSlot = 0;
        }
        this.setSelectedQuickSlot(this.selectedQuickSlot); // Update UI
    }
};

// Make globally accessible
window.Inventory = Inventory;