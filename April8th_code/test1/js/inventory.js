// js/inventory.js
class InventoryManager {
    constructor(game, mainSize = 24, quickBarSize = 8) {
        this.game = game;
        this.mainSlots = new Array(mainSize).fill(null); // { itemId: 'wood', quantity: 10 }
        this.quickBarSlots = new Array(quickBarSize).fill(null);
        this.selectedQuickBarSlot = 0; // Index of the selected slot
    }

    // Adds an item, trying to stack first
    add(itemId, quantity = 1) {
        const itemData = getItemData(itemId);
        if (!itemData) return false;

        let remaining = quantity;

        // 1. Try stacking in Quick Bar
        if (itemData.stackable) {
            remaining = this._tryStack(this.quickBarSlots, itemId, itemData.maxStack, remaining);
            if (remaining <= 0) { this.game.uiManager.updateQuickBar(); return true; }
        }
        // 2. Try stacking in Main Inventory
        if (itemData.stackable) {
            remaining = this._tryStack(this.mainSlots, itemId, itemData.maxStack, remaining);
            if (remaining <= 0) { this.game.uiManager.updateInventory(); return true; }
        }

        // 3. Find empty slot in Quick Bar (if fits)
        remaining = this._tryPlaceInEmpty(this.quickBarSlots, itemId, remaining);
         if (remaining <= 0) { this.game.uiManager.updateQuickBar(); return true; }

        // 4. Find empty slot in Main Inventory
         remaining = this._tryPlaceInEmpty(this.mainSlots, itemId, remaining);
         if (remaining <= 0) { this.game.uiManager.updateInventory(); return true; }


        console.warn("Inventory full, could not add", itemId, remaining);
        this.game.uiManager.updateInventory(); // Update UI even on partial add/fail
        this.game.uiManager.updateQuickBar();
        return remaining < quantity; // Return true if at least some were added
    }

    _tryStack(slots, itemId, maxStack, quantity) {
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            if (slot && slot.itemId === itemId && slot.quantity < maxStack) {
                const canAdd = maxStack - slot.quantity;
                const willAdd = Math.min(quantity, canAdd);
                slot.quantity += willAdd;
                quantity -= willAdd;
                if (quantity <= 0) return 0;
            }
        }
        return quantity; // Remaining quantity
    }

    _tryPlaceInEmpty(slots, itemId, quantity) {
         const itemData = getItemData(itemId);
         const takes = itemData.stackable ? Math.min(quantity, itemData.maxStack) : 1;

        for (let i = 0; i < slots.length; i++) {
            if (!slots[i]) {
                slots[i] = { itemId: itemId, quantity: takes };
                quantity -= takes;
                 if (!itemData.stackable || quantity <= 0) return 0; // Added non-stackable or all stackables

                 // If stackable and more remain, continue looking for next slot
                 if (itemData.stackable && quantity > 0) {
                    return this._tryPlaceInEmpty(slots, itemId, quantity); // Recurse (or loop) for next stack
                 }
            }
        }
        return quantity; // Remaining quantity
    }


    // Basic remove function (doesn't specify slot yet)
    remove(itemId, quantity = 1) {
        let needed = quantity;

        // 1. Remove from Quick Bar first
        needed = this._removeFromSlots(this.quickBarSlots, itemId, needed);
        if (needed <= 0) { this.game.uiManager.updateQuickBar(); return true; }

        // 2. Remove from Main Inventory
        needed = this._removeFromSlots(this.mainSlots, itemId, needed);
        if (needed <= 0) { this.game.uiManager.updateInventory(); return true; }

        console.warn("Could not remove enough", itemId, needed);
         this.game.uiManager.updateInventory(); // Update UI even on fail/partial
         this.game.uiManager.updateQuickBar();
        return needed < quantity; // True if some were removed
    }

     _removeFromSlots(slots, itemId, quantity) {
        for (let i = slots.length - 1; i >= 0; i--) { // Iterate backwards is often safer when removing
            const slot = slots[i];
            if (slot && slot.itemId === itemId) {
                const canRemove = slot.quantity;
                const willRemove = Math.min(quantity, canRemove);
                slot.quantity -= willRemove;
                quantity -= willRemove;

                if (slot.quantity <= 0) {
                    slots[i] = null; // Clear the slot
                }
                 if (quantity <= 0) return 0; // All removed
            }
        }
        return quantity; // Remaining needed
    }

    // --- Slot Specific Actions ---

    moveFromQuickBarToInventory(quickBarIndex) {
        if (quickBarIndex < 0 || quickBarIndex >= this.quickBarSlots.length || !this.quickBarSlots[quickBarIndex]) {
            return; // Invalid index or empty slot
        }

        const itemToMove = { ...this.quickBarSlots[quickBarIndex] }; // Copy item data
        this.quickBarSlots[quickBarIndex] = null; // Clear quick bar slot

        // Try adding the moved item to the main inventory
        const success = this.add(itemToMove.itemId, itemToMove.quantity);

        if (!success) {
             // Failed to add (inventory full?), put it back (simple rollback)
             this.quickBarSlots[quickBarIndex] = itemToMove;
             console.log("Inventory full, cannot move item from quick bar.");
        }

        this.game.uiManager.updateQuickBar();
        this.game.uiManager.updateInventory();
    }

    // Add moveToQuickBar, swapSlots etc. as needed

    has(itemId, quantity = 1) {
        let count = 0;
        for (const slot of [...this.mainSlots, ...this.quickBarSlots]) {
            if (slot && slot.itemId === itemId) {
                count += slot.quantity;
            }
        }
        return count >= quantity;
    }

    getQuickBarItem(index) {
        return this.quickBarSlots[index] ? this.quickBarSlots[index].itemId : null;
    }

    getSelectedQuickBarItem() {
         return this.quickBarSlots[this.selectedQuickBarSlot];
    }

    // Call this from InputHandler or Player when scroll wheel/number keys used
    selectQuickBarSlot(index) {
        if (index >= 0 && index < this.quickBarSlots.length) {
            this.selectedQuickBarSlot = index;
            this.game.uiManager.updateQuickBar(); // Highlight selected
            console.log("Selected QB slot:", index, this.getSelectedQuickBarItem()?.itemId);
             // Potentially trigger equip logic in player.js
             this.game.player.equipItem(this.getSelectedQuickBarItem()?.itemId);
        }
    }

    cycleQuickBarSlot(direction) {
        this.selectedQuickBarSlot += direction;
        if (this.selectedQuickBarSlot < 0) {
            this.selectedQuickBarSlot = this.quickBarSlots.length - 1;
        } else if (this.selectedQuickBarSlot >= this.quickBarSlots.length) {
            this.selectedQuickBarSlot = 0;
        }
        this.selectQuickBarSlot(this.selectedQuickBarSlot); // Update UI and equip
    }

    // Initial setup
    addStarterItems() {
        this.add('axe');
        this.add('pickaxe');
        this.add('knife');
        this.add('canteen');
        // Force UI update after adding starter items
        this.game.uiManager.updateInventory();
        this.game.uiManager.updateQuickBar();
    }
}
