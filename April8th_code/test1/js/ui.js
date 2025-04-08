// js/ui.js
class UIManager {
    constructor(game) {
        this.game = game;

        // Get references to UI elements
        this.hud = {
            health: document.getElementById('health-value'),
            hunger: document.getElementById('hunger-value'),
            stamina: document.getElementById('stamina-value'),
        };
        this.inventoryPanel = document.getElementById('inventory-panel');
        this.inventoryGrid = document.getElementById('inventory-grid');
        this.closeInventoryBtn = document.getElementById('close-inventory-btn');

        this.quickBar = document.getElementById('quick-bar');
        this.quickBarSlots = []; // We'll store the slot elements here

        this.buildMenu = document.getElementById('build-menu');
        this.buildOptions = document.getElementById('build-options');
        this.closeBuildMenuBtn = document.getElementById('close-build-menu-btn');

        this.interactionPrompt = document.getElementById('interaction-prompt');

        this.workbenchMenu = document.getElementById('workbench-menu');
        this.forgeMenu = document.getElementById('forge-menu');


        this.isInventoryOpen = false;
        this.isBuildMenuOpen = false;
        this.isWorkbenchOpen = false;
        this.isForgeOpen = false;

        this.setupEventListeners();
        this.createQuickBarSlots(8); // Create 8 quick bar slots
        this.createInventorySlots(24); // Create 24 inventory slots
    }

    setupEventListeners() {
        // Inventory Toggle (handled by InputHandler now, but keep button functional)
        this.closeInventoryBtn.addEventListener('click', () => this.toggleInventory());

        // Quick Bar Right Click -> Move to Inventory
        this.quickBar.addEventListener('contextmenu', (event) => {
            event.preventDefault(); // Prevent default context menu
            const slotElement = event.target.closest('.quick-bar-slot');
            if (slotElement) {
                const index = parseInt(slotElement.dataset.index);
                 if (!isNaN(index)) {
                    console.log("Right clicked Quick Bar slot:", index);
                    this.game.inventoryManager.moveFromQuickBarToInventory(index);
                }
            }
        });

         // Build Menu Toggle
         this.closeBuildMenuBtn.addEventListener('click', () => this.toggleBuildMenu());

         // Build Option Selection
         this.buildOptions.addEventListener('click', (event) => {
             if (event.target.tagName === 'BUTTON' && event.target.dataset.item) {
                 const itemId = event.target.dataset.item;
                 console.log("Selected build item:", itemId);
                 this.game.buildingSystem.selectBuildItem(itemId);
                 // UI Manager doesn't need to close the menu here, building system does
             }
         });

         // Add listeners for workbench/forge close buttons if they have them
    }

    // --- HUD ---
    updateHUD(playerStats) {
        if (this.hud.health) this.hud.health.textContent = Math.round(playerStats.health);
        if (this.hud.hunger) this.hud.hunger.textContent = Math.round(playerStats.hunger);
        if (this.hud.stamina) this.hud.stamina.textContent = Math.round(playerStats.stamina);
    }

    // --- Inventory ---
    createInventorySlots(count) {
        this.inventoryGrid.innerHTML = ''; // Clear existing
        for (let i = 0; i < count; i++) {
            const slot = document.createElement('div');
            slot.classList.add('inventory-slot');
            slot.dataset.index = i;
            // Add drag/drop/click listeners later if needed
            this.inventoryGrid.appendChild(slot);
        }
    }

    toggleInventory() {
        this.isInventoryOpen = !this.isInventoryOpen;
        this.inventoryPanel.classList.toggle('hidden', !this.isInventoryOpen);
         this.game.setPaused(this.isInventoryOpen || this.isBuildMenuOpen || this.isWorkbenchOpen || this.isForgeOpen); // Pause game when UI is open

        if (this.isInventoryOpen) {
            this.updateInventory(); // Refresh inventory view when opened
        }
    }

    updateInventory() {
        if (!this.isInventoryOpen) return; // Only update if visible (performance)

        const slots = this.inventoryGrid.children;
        for (let i = 0; i < slots.length; i++) {
            const slotElement = slots[i];
            const item = this.game.inventoryManager.mainSlots[i];
            this.updateSlotElement(slotElement, item);
        }
    }

    // --- Quick Bar ---
    createQuickBarSlots(count) {
        this.quickBar.innerHTML = ''; // Clear existing
        this.quickBarSlots = [];
        for (let i = 0; i < count; i++) {
            const slot = document.createElement('div');
            slot.classList.add('quick-bar-slot');
            slot.dataset.index = i;
            this.quickBar.appendChild(slot);
            this.quickBarSlots.push(slot); // Store ref
        }
    }

    updateQuickBar() {
        for (let i = 0; i < this.quickBarSlots.length; i++) {
            const slotElement = this.quickBarSlots[i];
            const item = this.game.inventoryManager.quickBarSlots[i];
            this.updateSlotElement(slotElement, item);

            // Highlight selected slot
            if (i === this.game.inventoryManager.selectedQuickBarSlot) {
                slotElement.style.borderColor = 'yellow'; // Example highlight
                 slotElement.style.borderWidth = '2px';
            } else {
                 slotElement.style.borderColor = '#aaa';
                 slotElement.style.borderWidth = '1px';
            }
        }
    }

     // --- Build Menu ---
     toggleBuildMenu() {
         this.isBuildMenuOpen = !this.isBuildMenuOpen;
         this.buildMenu.classList.toggle('hidden', !this.isBuildMenuOpen);
         this.game.setPaused(this.isInventoryOpen || this.isBuildMenuOpen || this.isWorkbenchOpen || this.isForgeOpen);

         if(this.isBuildMenuOpen) {
            // Potentially update available build options based on inventory?
         } else {
            // If closing menu while in build preview mode, cancel build preview
            if (this.game.buildingSystem.isBuilding) {
                this.game.buildingSystem.exitBuildMode();
            }
         }
     }

     hideBuildMenu() {
         if (!this.isBuildMenuOpen) return;
         this.isBuildMenuOpen = false;
         this.buildMenu.classList.add('hidden');
         this.game.setPaused(this.isInventoryOpen || this.isBuildMenuOpen || this.isWorkbenchOpen || this.isForgeOpen);
     }


    // --- Crafting Menus ---
    showWorkbenchMenu(availableRecipes) {
        console.log("Workbench Recipes:", availableRecipes);
        // TODO: Populate the #workbench-menu content dynamically
        this.workbenchMenu.innerHTML = `<h2>Workbench</h2>`;
        availableRecipes.forEach(recipeId => {
            const recipe = this.game.craftingSystem.recipes[recipeId];
            const button = document.createElement('button');
            button.textContent = `Craft ${recipe.produces.quantity}x ${ITEMS[recipe.produces.itemId].name}`;
            // Add ingredient list display maybe?
            button.onclick = () => this.game.craftingSystem.craft(recipeId, 'workbench');
            this.workbenchMenu.appendChild(button);
        });
        const closeBtn = document.createElement('button');
        closeBtn.textContent = "Close (E)";
        closeBtn.onclick = () => this.game.craftingSystem.closeWorkbench(); // Use CraftingSystem to close
        this.workbenchMenu.appendChild(closeBtn);

        this.isWorkbenchOpen = true;
        this.workbenchMenu.classList.remove('hidden');
        this.game.setPaused(true);
    }

    hideWorkbenchMenu() {
        this.isWorkbenchOpen = false;
        this.workbenchMenu.classList.add('hidden');
        this.game.setPaused(this.isInventoryOpen || this.isBuildMenuOpen || this.isForgeOpen);
    }

    showForgeMenu(availableRecipes) {
         console.log("Forge Recipes:", availableRecipes);
         // TODO: Populate forge UI (likely different layout than workbench)
         this.forgeMenu.innerHTML = `<h2>Forge</h2><p>(Forge UI not implemented)</p>`;
         // Example smelting button
         availableRecipes.forEach(recipeId => {
             const recipe = this.game.craftingSystem.recipes[recipeId];
             const button = document.createElement('button');
             button.textContent = `Smelt ${ITEMS[recipe.produces.itemId].name}`;
             button.onclick = () => this.game.craftingSystem.craft(recipeId, 'forge');
             this.forgeMenu.appendChild(button);
         });

         const closeBtn = document.createElement('button');
         closeBtn.textContent = "Close (E)";
         closeBtn.onclick = () => this.game.craftingSystem.closeForge();
         this.forgeMenu.appendChild(closeBtn);


         this.isForgeOpen = true;
         this.forgeMenu.classList.remove('hidden');
         this.game.setPaused(true);
    }

     hideForgeMenu() {
        this.isForgeOpen = false;
        this.forgeMenu.classList.add('hidden');
        this.game.setPaused(this.isInventoryOpen || this.isBuildMenuOpen || this.isWorkbenchOpen);
    }


    // --- Interaction Prompt ---
    showInteractionPrompt(text = "Press E to interact") {
        this.interactionPrompt.textContent = text;
        this.interactionPrompt.classList.remove('hidden');
    }

    hideInteractionPrompt() {
        this.interactionPrompt.classList.add('hidden');
    }

    // --- Helper ---
    updateSlotElement(slotElement, item) {
        // Clear previous content
        slotElement.innerHTML = '';
        slotElement.title = ''; // Clear tooltip

        if (item) {
            const itemData = getItemData(item.itemId);
            // Basic text representation - replace with icons later!
            const nameSpan = document.createElement('span');
            nameSpan.textContent = itemData.name.substring(0, 3); // Short name/icon placeholder
            slotElement.appendChild(nameSpan);
             slotElement.title = `${itemData.name} (${item.quantity})`; // Tooltip

             // Add image if you have icons
             // const img = document.createElement('img');
             // img.src = `assets/icons/${item.itemId}.png`; // Example path
             // img.alt = itemData.name;
             // slotElement.appendChild(img);


            if (itemData.stackable && item.quantity > 1) {
                const countSpan = document.createElement('span');
                countSpan.classList.add('item-count');
                countSpan.textContent = item.quantity;
                slotElement.appendChild(countSpan);
            }
        }
    }

     isMouseOverUI(mouseX, mouseY) {
        if (this.isInventoryOpen && this.isElementUnderMouse(this.inventoryPanel, mouseX, mouseY)) return true;
        if (this.isBuildMenuOpen && this.isElementUnderMouse(this.buildMenu, mouseX, mouseY)) return true;
        if (this.isWorkbenchOpen && this.isElementUnderMouse(this.workbenchMenu, mouseX, mouseY)) return true;
        if (this.isForgeOpen && this.isElementUnderMouse(this.forgeMenu, mouseX, mouseY)) return true;
        // Check quickbar separately as it's always visible (but might be behind other menus)
        if (this.isElementUnderMouse(this.quickBar, mouseX, mouseY)) return true;

        return false;
     }

     isElementUnderMouse(element, mouseX, mouseY) {
        const rect = element.getBoundingClientRect();
        return (
            mouseX >= rect.left &&
            mouseX <= rect.right &&
            mouseY >= rect.top &&
            mouseY <= rect.bottom
        );
    }
}
