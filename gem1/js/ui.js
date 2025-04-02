// js/ui.js

const UI = {
    inventoryVisible: false,
    draggedItemInfo: null, // { source: 'quick'/'inventory', index: number }

    init() {
        this.setupInventoryUI();
        this.setupEventListeners();
        this.updateInventory(); // Initial draw
        Utils.logMessage("UI Initialized.");
    },

    setupInventoryUI() {
        const quickBar = document.getElementById('quick-bar');
        const inventoryGrid = document.getElementById('inventory-grid');
        const craftingList = document.getElementById('crafting-recipes');

        quickBar.innerHTML = '';
        inventoryGrid.innerHTML = '';
        craftingList.innerHTML = '';

        // Create quick bar slots
        for (let i = 0; i < Inventory.quickBarSize; i++) {
            const slot = this.createSlotElement('quick', i);
            quickBar.appendChild(slot);
        }

        // Create inventory slots
        for (let i = 0; i < Inventory.inventorySize; i++) {
            const slot = this.createSlotElement('inventory', i);
            inventoryGrid.appendChild(slot);
        }

         // Create crafting recipes list
        for (const itemName in Crafting.recipes) {
            const li = document.createElement('li');
            li.dataset.itemName = itemName;
            li.textContent = `Craft ${itemName}`; // Basic display
            li.addEventListener('click', () => {
                 if (Crafting.canCraft(itemName)) {
                     Crafting.craftItem(itemName);
                 } else {
                     Utils.logMessage("Not enough resources.");
                 }
            });
            craftingList.appendChild(li);
        }
    },

    createSlotElement(source, index) {
        const slot = document.createElement('div');
        slot.classList.add(source === 'quick' ? 'quick-slot' : 'inventory-slot');
        slot.dataset.source = source;
        slot.dataset.index = index;

        // Add drag-and-drop and click listeners
        slot.addEventListener('click', (event) => this.handleSlotClick(event, source, index));
        // Basic drag simulation via click
        // slot.addEventListener('mousedown', (event) => this.handleDragStart(event, source, index));
        // slot.addEventListener('mouseup', (event) => this.handleDrop(event, source, index));

        return slot;
    },

    setupEventListeners() {
        const inventoryElement = document.getElementById('inventory');
        const closeButton = document.getElementById('close-inventory');
        const blocker = document.getElementById('blocker');
        const startButton = document.getElementById('startButton');

        // Toggle Inventory
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Tab' && Game.isReady) { // Only allow if game is running
                event.preventDefault(); // Prevent tabbing out of the window
                this.toggleInventory();
            }
        });

        closeButton.addEventListener('click', () => this.toggleInventory(false));

        // Quick Slot Selection (Mouse Wheel) - Requires game focus
        document.addEventListener('wheel', (event) => {
             if (document.pointerLockElement === Game.renderer.domElement) {
                 const direction = event.deltaY > 0 ? 1 : -1;
                 Inventory.cycleSelectedQuickSlot(direction);
             }
        });
         // Quick Slot Selection (Number Keys)
         document.addEventListener('keydown', (event) => {
            if (document.pointerLockElement === Game.renderer.domElement && event.key >= '1' && event.key <= '9') {
                const index = parseInt(event.key) - 1;
                if (index < Inventory.quickBarSize) {
                    Inventory.setSelectedQuickSlot(index);
                }
            }
        });


        // Start Button
        startButton.addEventListener('click', () => {
            if (typeof THREE === 'undefined') {
                 document.getElementById('threejs-error').style.display = 'block';
                 blocker.style.display = 'flex'; // Keep blocker visible
                 return; // Stop if Three.js isn't loaded
             }

            const resourceMultiplier = parseInt(document.getElementById('startResources').value);
            const playerSpeed = parseFloat(document.getElementById('playerSpeed').value);
            const playerHeight = parseFloat(document.getElementById('playerHeight').value);

            Game.start({ resourceMultiplier, playerSpeed, playerHeight }); // Pass settings to game start
        });
    },

    toggleInventory(forceState) {
        const inventoryElement = document.getElementById('inventory');
        this.inventoryVisible = (forceState !== undefined) ? forceState : !this.inventoryVisible;

        if (this.inventoryVisible) {
            inventoryElement.classList.remove('hidden');
            document.exitPointerLock(); // Release mouse cursor
            this.updateInventory(); // Refresh inventory state when opened
            this.updateCraftingMenu(); // Refresh crafting states
        } else {
            inventoryElement.classList.add('hidden');
            // Re-lock pointer if game is running
             if (Game.isReady && !Game.isPaused) {
                 document.body.requestPointerLock();
             }
        }
    },

    updateInventory() {
        this.updateStorageUI(Inventory.quickBar, 'quick');
        this.updateStorageUI(Inventory.inventory, 'inventory');
        // Maybe update crafting too, as resources might have changed
        if(this.inventoryVisible) this.updateCraftingMenu();
    },

    updateStorageUI(storage, source) {
        const slots = document.querySelectorAll(`.${source}-slot`);
        slots.forEach((slot, index) => {
            const itemData = storage[index];
            slot.innerHTML = ''; // Clear previous content

            if (itemData) {
                // Add icon div (using background colors for now)
                 const icon = document.createElement('div');
                 icon.classList.add('item-icon', `item-${itemData.item.toLowerCase().replace(/\s+/g, '_')}`); // e.g., item-scrap_metal
                 slot.appendChild(icon);

                // Add Name (optional, maybe on hover?)
                const nameSpan = document.createElement('span');
                nameSpan.classList.add('slot-item-name');
                nameSpan.textContent = itemData.item;
                slot.appendChild(nameSpan);

                // Add Quantity
                const quantitySpan = document.createElement('span');
                quantitySpan.classList.add('slot-item-quantity');
                quantitySpan.textContent = itemData.quantity > 1 ? itemData.quantity : ''; // Hide '1'
                slot.appendChild(quantitySpan);

            }

            // Highlight selected quick slot
            if (source === 'quick') {
                if (index === Inventory.selectedQuickSlot) {
                    slot.classList.add('selected');
                } else {
                    slot.classList.remove('selected');
                }
            }
        });
    },

    updateCraftingMenu() {
        const recipeList = document.getElementById('crafting-recipes');
        recipeList.querySelectorAll('li').forEach(li => {
            const itemName = li.dataset.itemName;
            const recipe = Crafting.recipes[itemName];
            let title = `Craft ${itemName} (Req: `;
            let reqs = [];
             for (const res in recipe) {
                 reqs.push(`${recipe[res]} ${res}`);
             }
             title += reqs.join(', ') + ')';
             li.title = title; // Tooltip for requirements

            if (Crafting.canCraft(itemName)) {
                li.classList.add('craftable');
                li.classList.remove('not-craftable');
            } else {
                li.classList.add('not-craftable');
                li.classList.remove('craftable');
            }
        });
    },

    // --- Drag & Drop / Item Moving ---
    handleSlotClick(event, source, index) {
        if (this.inventoryVisible && event.shiftKey) { // SHIFT + Click for moving
            const targetSource = source === 'quick' ? 'inventory' : 'quick';
            // Find first empty slot in the target inventory
            const targetStorage = targetSource === 'quick' ? Inventory.quickBar : Inventory.inventory;
            let targetIndex = -1;
            for(let i = 0; i < targetStorage.length; i++) {
                if (!targetStorage[i]) {
                    targetIndex = i;
                    break;
                }
            }

            // If no empty slot, try stacking on existing same item in target
            if (targetIndex === -1) {
                const itemToMove = (source === 'quick' ? Inventory.quickBar : Inventory.inventory)[index];
                if(itemToMove) {
                    for(let i = 0; i < targetStorage.length; i++) {
                        if (targetStorage[i] && targetStorage[i].item === itemToMove.item) {
                            targetIndex = i; // Found a stack target
                            break;
                        }
                    }
                }
            }


            if (targetIndex !== -1) {
                Inventory.moveItem(source, index, targetSource, targetIndex);
            } else {
                Utils.logMessage(`Cannot move item: Target ${targetSource} is full or no matching stack.`);
            }
        }
        // Add simple click selection/action later if needed
    },

    // Basic drag simulation placeholders (more complex implementation needed for real drag/drop)
    // handleDragStart(event, source, index) {
    //     if (!this.inventoryVisible) return;
    //     const item = (source === 'quick' ? Inventory.quickBar : Inventory.inventory)[index];
    //     if (item) {
    //         this.draggedItemInfo = { source, index, itemData: item };
    //         event.dataTransfer.setData('text/plain', ''); // Necessary for Firefox
    //         // Add visual feedback for dragging
    //         event.target.style.opacity = '0.5';
    //     }
    // },
    // handleDrop(event, targetSource, targetIndex) {
    //     if (!this.inventoryVisible || !this.draggedItemInfo) return;
    //     event.preventDefault();

    //     const { source: fromSource, index: fromIndex } = this.draggedItemInfo;

    //     if (fromSource !== targetSource || fromIndex !== targetIndex) {
    //          Inventory.moveItem(fromSource, fromIndex, targetSource, targetIndex);
    //     }

    //      // Reset visual feedback
    //      const originalSlot = document.querySelector(`.${fromSource}-slot[data-index="${fromIndex}"]`);
    //      if(originalSlot) originalSlot.style.opacity = '1';

    //     this.draggedItemInfo = null; // Clear dragged item info
    // },
    // // Add dragover listener to slots to allow dropping
    // setupDragOverListener(slot) {
    //     slot.addEventListener('dragover', (event) => {
    //         if (this.draggedItemInfo) {
    //             event.preventDefault(); // Allow drop
    //         }
    //     });
    // }

};

// Make globally accessible
window.UI = UI;