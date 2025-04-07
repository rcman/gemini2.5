// js/ui.js
const UIManager = {
    healthValueElement: null,
    hungerValueElement: null,
    staminaValueElement: null,
    messageLogElement: null,
    buildMenuElement: null,
    inventoryMenuElement: null,
    inventoryListElement: null,
    quickBarElement: null,
    quickSlotElements: [],
    messageTimeout: null,
    selectedQuickSlotIndex: -1, // Track highlighted quick slot
    selectedInventoryItemElement: null, // Track highlighted inventory item

    init: function() {
        this.healthValueElement = document.getElementById('health-value');
        this.hungerValueElement = document.getElementById('hunger-value');
        this.staminaValueElement = document.getElementById('stamina-value');
        this.messageLogElement = document.getElementById('message-log');
        this.buildMenuElement = document.getElementById('build-menu');
        this.inventoryMenuElement = document.getElementById('inventory-menu');
        this.inventoryListElement = document.getElementById('inventory-list');
        this.quickBarElement = document.getElementById('quick-bar');
        this.quickSlotElements = this.quickBarElement ? this.quickBarElement.querySelectorAll('.quick-slot') : [];

        // Add quick bar event listeners
        if (this.quickSlotElements.length > 0) {
            this.quickSlotElements.forEach((slot, index) => {
                // RIGHT CLICK: Move item to inventory (Context Menu)
                slot.addEventListener('contextmenu', (event) => {
                    event.preventDefault();
                    if (this.isMenuOpen() || !Input.isPointerLocked) { // Allow if menu open or pointer unlocked
                         if(Building.isPlacing && Building.currentItemInfo?.source === 'quickbar' && Building.currentItemInfo?.slotIndex === index) {
                             Building.cancelPlacement(); // Cancel placement if right-clicking selected slot
                         }
                        Inventory.moveItemToInventory(index);
                        this.clearSelectionHighlights(); // Clear selection after moving
                    }
                });

                // LEFT CLICK: Select item for placement OR use item
                slot.addEventListener('click', (event) => {
                    // Interaction allowed only when pointer locked OR if inventory isn't open (prevent clicking through)
                    const allowInteraction = Input.isPointerLocked || !(this.inventoryMenuElement && this.inventoryMenuElement.style.display !== 'none');

                    if (allowInteraction) {
                        const itemData = Inventory.quickBarItems[index];
                        if (itemData && CONSTANTS.BUILDABLES[itemData.itemId]) { // Is it placeable?
                            const isCurrentlySelected = this.selectedQuickSlotIndex === index && Building.isPlacing;
                            if (isCurrentlySelected) {
                                Building.cancelPlacement(); // Toggle off placement
                            } else {
                                if (Building.isPlacing) Building.cancelPlacement(); // Cancel previous placement
                                Building.startPlacement({ itemId: itemData.itemId, source: 'quickbar', slotIndex: index });
                                this.highlightQuickSlot(index); // Highlight visually
                            }
                        } else if (itemData) {
                             // Item is not buildable - use/equip logic here later
                             console.log(`Selected non-placeable item in quick slot ${index}: ${itemData.itemId}`);
                             if (Building.isPlacing) Building.cancelPlacement(); // Ensure placement mode is off
                             this.highlightQuickSlot(index); // Highlight non-placeable selection too
                             // TODO: Player.equipItem(index) or Player.useItem(index)
                        } else {
                             // Clicked empty slot
                             if (Building.isPlacing) Building.cancelPlacement(); // Cancel placement if empty slot clicked
                             this.clearSelectionHighlights();
                        }
                    }
                });
            });
        } else { console.warn("Could not find quick bar slots for UI initialization."); }

        console.log("UI Manager Initialized");
        // Note: setupBuildMenuButtons is called from main.js after Building is initialized
    },

    updateStat: function(statName, value) {
        const element = this[`${statName}ValueElement`];
        if (element && element.textContent != value) element.textContent = value;
    },

    logMessage: function(message, duration = 3000) {
        if (this.messageLogElement) {
            this.messageLogElement.textContent = message;
            if (this.messageTimeout) clearTimeout(this.messageTimeout);
            this.messageTimeout = setTimeout(() => {
                 if(this.messageLogElement.textContent === message) this.messageLogElement.textContent = "";
            }, duration);
        }
        console.log("UI Log:", message);
    },

    toggleBuildMenu: function() {
         if (!this.buildMenuElement) return;
        const isOpen = this.buildMenuElement.style.display !== 'none';
        if (isOpen) {
            this.buildMenuElement.style.display = 'none';
        } else {
            if (this.inventoryMenuElement && this.inventoryMenuElement.style.display !== 'none') this.inventoryMenuElement.style.display = 'none';
            this.buildMenuElement.style.display = 'block';
        }
    },

     toggleInventoryMenu: function() {
         if (!this.inventoryMenuElement) return;
        const isOpen = this.inventoryMenuElement.style.display !== 'none';
        if (isOpen) {
            this.inventoryMenuElement.style.display = 'none';
            // If closing inventory while an inventory item was selected for placement, cancel placement
            if (Building.isPlacing && Building.currentItemInfo?.source === 'inventory') {
                 Building.cancelPlacement();
            }
        } else {
             if (this.buildMenuElement && this.buildMenuElement.style.display !== 'none') this.buildMenuElement.style.display = 'none';
            Inventory.updateUI(); // Refresh inventory list when opening
            this.inventoryMenuElement.style.display = 'block';
        }
    },

    isMenuOpen: function() {
         return (this.buildMenuElement && this.buildMenuElement.style.display !== 'none') ||
               (this.inventoryMenuElement && this.inventoryMenuElement.style.display !== 'none');
    },

    // --- Inventory & Quick Bar Rendering ---

    updateInventoryList: function(items) {
        if (!this.inventoryListElement) return;
        this.inventoryListElement.innerHTML = ''; // Clear

        if (Object.keys(items).length === 0) { this.inventoryListElement.innerHTML = '<li>Empty</li>'; }
        else {
            for (const itemId in items) {
                 // Use combined data source lookup
                 const itemData = CONSTANTS.BUILDABLES[itemId] || Resources.getResourceData(itemId) || Crafting.getRecipe(itemId);
                 const name = itemData?.name || itemId; // Fallback to itemId if no name found
                 const quantity = items[itemId];
                 const isPlaceable = !!CONSTANTS.BUILDABLES[itemId]; // Check if it's in the buildables list

                 const listItem = document.createElement('li');
                 listItem.textContent = `${name}: ${quantity}`;
                 listItem.dataset.itemId = itemId;
                 listItem.classList.remove('selected'); // Ensure not selected by default

                 if (isPlaceable) {
                      listItem.style.cursor = 'pointer';
                      listItem.title = 'Click to select for placement';

                     // Re-apply highlight if this item is the selected one
                     if (this.selectedInventoryItemElement && this.selectedInventoryItemElement.dataset.itemId === itemId) {
                          listItem.classList.add('selected');
                          // Update reference in case list order changed (safer)
                          this.selectedInventoryItemElement = listItem;
                     }

                     // Click listener to SELECT item for placement FROM inventory
                     listItem.addEventListener('click', (event) => {
                         // Only allow selection when inventory menu is visible
                         if (this.inventoryMenuElement && this.inventoryMenuElement.style.display !== 'none') {
                             const clickedItemId = event.target.dataset.itemId;
                             if (clickedItemId) {
                                 const isCurrentlySelected = this.selectedInventoryItemElement === listItem && Building.isPlacing;
                                 if (isCurrentlySelected) {
                                     Building.cancelPlacement(); // Toggle off placement
                                 } else {
                                      if (Building.isPlacing) Building.cancelPlacement(); // Cancel previous placement
                                     Building.startPlacement({ itemId: clickedItemId, source: 'inventory' });
                                     this.highlightInventoryItem(listItem); // Highlight visually
                                     // Optional: Close inventory after selection?
                                     // this.toggleInventoryMenu();
                                 }
                             }
                         }
                     });
                 } else {
                      // Non-placeable item styling
                      listItem.style.cursor = 'default';
                      // Optional: Add specific class for non-placeables
                      // listItem.classList.add('non-placeable');
                 }

                 this.inventoryListElement.appendChild(listItem);
            }
        }
    },

    updateQuickBar: function(quickBarItems) {
        if (!this.quickBarElement || this.quickSlotElements.length === 0) return;
        this.quickSlotElements.forEach((slot, index) => {
            const item = quickBarItems[index];
            slot.innerHTML = ''; // Clear previous content
            slot.classList.remove('selected'); // Remove selection highlight by default
            slot.title = ''; // Clear tooltip

            if (item) {
                 const itemData = CONSTANTS.BUILDABLES[item.itemId] || Resources.getResourceData(item.itemId) || Crafting.getRecipe(item.itemId);
                 const name = itemData?.name || item.itemId;
                 const isPlaceable = !!CONSTANTS.BUILDABLES[item.itemId];

                 const nameSpan = document.createElement('span');
                 nameSpan.className = 'item-name';
                 nameSpan.textContent = name.substring(0, 8);
                 slot.appendChild(nameSpan);
                 if (item.quantity > 1) {
                    const quantitySpan = document.createElement('span');
                    quantitySpan.className = 'item-quantity';
                    quantitySpan.textContent = item.quantity;
                    slot.appendChild(quantitySpan);
                 }
                 slot.dataset.itemId = item.itemId;

                 // Re-apply highlight if this slot is the selected one
                 if (index === this.selectedQuickSlotIndex) {
                     slot.classList.add('selected');
                 }
                 // Add tooltip
                 if (isPlaceable) {
                     slot.title = `Left Click: Select to Place\nRight Click: Move to Inventory`;
                 } else {
                     slot.title = `Left Click: Select/Use\nRight Click: Move to Inventory`;
                 }

            } else {
                 delete slot.dataset.itemId; // Remove itemId if slot is empty
            }
        });
    },

    // --- Selection Highlighting ---
    highlightQuickSlot: function(index) {
        this.clearSelectionHighlights(); // Clear previous highlights
        if (index >= 0 && index < this.quickSlotElements.length) {
            this.quickSlotElements[index].classList.add('selected');
            this.selectedQuickSlotIndex = index;
        }
    },

    highlightInventoryItem: function(listItemElement) {
        this.clearSelectionHighlights(); // Clear previous highlights
        if (listItemElement) {
            listItemElement.classList.add('selected'); // Use CSS for '.selected' style
            this.selectedInventoryItemElement = listItemElement;
        }
    },

    clearSelectionHighlights: function() {
        if (this.selectedQuickSlotIndex !== -1 && this.selectedQuickSlotIndex < this.quickSlotElements.length) {
            this.quickSlotElements[this.selectedQuickSlotIndex].classList.remove('selected');
        }
        if (this.selectedInventoryItemElement) {
            // Check if element still exists before removing class (safer if list refreshed)
            if (document.body.contains(this.selectedInventoryItemElement)) {
                this.selectedInventoryItemElement.classList.remove('selected');
            }
        }
        this.selectedQuickSlotIndex = -1;
        this.selectedInventoryItemElement = null;
    },

    // --- Setup Build Menu Buttons ---
    // Called from Game.init after Building is initialized.
    setupBuildMenuButtons: function() {
        const buildMenu = document.getElementById('build-menu');
        if (!buildMenu) {
             console.error("Build menu element not found!");
             return;
        }
        // Use data-build-id attribute on buttons
        const buttons = buildMenu.querySelectorAll('button[data-build-id]');
        buttons.forEach(button => {
            const itemId = button.dataset.buildId;
            if (itemId) {
                // Ensure onclick is properly assigned
                button.onclick = () => {
                     console.log(`Crafting attempt button clicked for: ${itemId}`);
                     Building.craftBuildable(itemId);
                };
            } else {
                 console.warn("Build menu button found without data-build-id:", button.textContent);
            }
        });
    }
};

window.UIManager = UIManager;