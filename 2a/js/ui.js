// UI controller to handle in-game interface elements
class UI {
    constructor(inventory, crafting, player) {
        this.inventory = inventory;
        this.crafting = crafting;
        this.player = player;
        this.game = null;
        
        // UI element references
        this.quickBarElement = document.getElementById('quick-bar');
        this.inventoryGridElement = document.getElementById('player-inventory');
        this.quickBarInventoryElement = document.getElementById('quick-bar-inventory');
        this.craftingRecipesElement = document.getElementById('crafting-recipes');
        this.actionTextElement = document.getElementById('action-text');
        
        // HUD elements
        this.healthFillElement = document.getElementById('health-fill');
        this.hungerFillElement = document.getElementById('hunger-fill');
        this.thirstFillElement = document.getElementById('thirst-fill');
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    setGame(game) {
        this.game = game;
    }
    
    initialize() {
        // Set inventory change callback
        this.inventory.onInventoryChanged = () => this.updateInventoryUI();
        
        // Initial UI update
        this.updateInventoryUI();
        this.updateHUD();
        
        // Show/hide inventory on TAB key
        document.getElementById('close-inventory').addEventListener('click', () => {
            document.getElementById('inventory-screen').classList.add('hidden');
            if (this.player.controls) {
                this.player.controls.lock();
            }
        });
        
        // Toggle crafting menu
        document.getElementById('crafting-button').addEventListener('click', () => {
            const craftingMenu = document.getElementById('crafting-menu');
            if (craftingMenu.classList.contains('hidden')) {
                craftingMenu.classList.remove('hidden');
                this.updateCraftingUI();
            } else {
                craftingMenu.classList.add('hidden');
            }
        });
    }
    
    setupEventListeners() {
        // Quick bar slot selection
        document.addEventListener('keydown', (event) => {
            if (event.code.startsWith('Digit') && !isNaN(parseInt(event.code.slice(-1)))) {
                const slotNum = parseInt(event.code.slice(-1)) - 1;
                if (slotNum >= 0 && slotNum < 8) {
                    this.selectQuickSlot(slotNum);
                }
            }
        });
    }
    
    update() {
        // Update HUD elements
        this.updateHUD();
        
        // Show action text for interactable objects
        this.updateActionText();
    }
    
    updateHUD() {
        // Update health, hunger, and thirst bars
        if (this.player) {
            const health = this.player.health;
            const hunger = this.player.hunger;
            const thirst = this.player.thirst;
            
            this.healthFillElement.style.width = `${health}%`;
            this.hungerFillElement.style.width = `${hunger}%`;
            this.thirstFillElement.style.width = `${thirst}%`;
            
            // Change colors based on levels
            if (health < 25) {
                this.healthFillElement.style.backgroundColor = '#FF0000'; // Red when low
            } else if (health < 50) {
                this.healthFillElement.style.backgroundColor = '#FFA500'; // Orange when medium
            } else {
                this.healthFillElement.style.backgroundColor = '#e74c3c'; // Default red
            }
            
            if (hunger < 25) {
                this.hungerFillElement.style.backgroundColor = '#FF0000'; // Red when low
            } else {
                this.hungerFillElement.style.backgroundColor = '#f39c12'; // Default orange
            }
            
            if (thirst < 25) {
                this.thirstFillElement.style.backgroundColor = '#FF0000'; // Red when low
            } else {
                this.thirstFillElement.style.backgroundColor = '#3498db'; // Default blue
            }
        }
    }
    
    updateActionText() {
        if (!this.player) return;
        
        if (this.player.interactableObject) {
            const interactable = this.player.interactableObject;
            
            let actionText = '';
            
            switch (interactable.userData.type) {
                case 'tree':
                    actionText = 'Press E to chop tree';
                    break;
                case 'rock':
                    actionText = 'Press E to mine rock';
                    break;
                case 'barrel':
                case 'container':
                    if (interactable.userData.searched) {
                        actionText = 'Container already searched';
                    } else {
                        actionText = 'Press E to search';
                    }
                    break;
                case 'water':
                    actionText = 'Press E to collect water';
                    break;
                case 'grass':
                    actionText = 'Press E to harvest grass';
                    break;
                case 'animal':
                    actionText = 'Press E to hunt';
                    break;
                case 'scrap':
                    actionText = 'Press E to collect scrap metal';
                    break;
                case 'campfire':
                    actionText = 'Press E to use campfire';
                    break;
                case 'crafting_table':
                    actionText = 'Press E to use crafting table';
                    break;
                case 'forge':
                    actionText = 'Press E to use forge';
                    break;
            }
            
            this.showActionText(actionText);
        } else {
            this.hideActionText();
        }
    }
    
    showActionText(text) {
        this.actionTextElement.textContent = text;
        this.actionTextElement.style.opacity = '1';
    }
    
    hideActionText() {
        this.actionTextElement.style.opacity = '0';
    }
    
    updateInventoryUI() {
        // Update quick bar
        this.updateQuickBar();
        
        // Update inventory grid when inventory screen is open
        if (!document.getElementById('inventory-screen').classList.contains('hidden')) {
            this.updateInventoryGrid();
            this.updateQuickBarInventory();
            
            // Update crafting UI if it's visible
            if (!document.getElementById('crafting-menu').classList.contains('hidden')) {
                this.updateCraftingUI();
            }
        }
    }
    
    updateQuickBar() {
        // Clear existing slots
        this.quickBarElement.innerHTML = '';
        
        // Create slots
        for (let i = 0; i < this.inventory.quickSlots.length; i++) {
            const slot = document.createElement('div');
            slot.className = 'quick-slot';
            
            if (i === this.player.selectedSlot) {
                slot.classList.add('selected');
            }
            
            const item = this.inventory.quickSlots[i];
            
            if (item) {
                const itemElement = this.createItemElement(item);
                slot.appendChild(itemElement);
            }
            
            // Add slot number
            const slotNumber = document.createElement('div');
            slotNumber.className = 'slot-number';
            slotNumber.textContent = (i + 1).toString();
            slot.appendChild(slotNumber);
            
            this.quickBarElement.appendChild(slot);
        }
    }
    
    updateInventoryGrid() {
        // Clear existing slots
        this.inventoryGridElement.innerHTML = '';
        
        // Create slots
        for (let i = 0; i < this.inventory.slots.length; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.slotIndex = i;
            slot.dataset.slotType = 'inventory';
            
            const item = this.inventory.slots[i];
            
            if (item) {
                const itemElement = this.createItemElement(item);
                slot.appendChild(itemElement);
            }
            
            // Add event listeners for drag and drop
            this.addSlotEventListeners(slot);
            
            this.inventoryGridElement.appendChild(slot);
        }
    }
    
    updateQuickBarInventory() {
        // Clear existing slots
        this.quickBarInventoryElement.innerHTML = '';
        
        // Create slots
        for (let i = 0; i < this.inventory.quickSlots.length; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.slotIndex = i;
            slot.dataset.slotType = 'quickbar';
            
            if (i === this.player.selectedSlot) {
                slot.classList.add('selected');
            }
            
            const item = this.inventory.quickSlots[i];
            
            if (item) {
                const itemElement = this.createItemElement(item);
                slot.appendChild(itemElement);
            }
            
            // Add event listeners for drag and drop
            this.addSlotEventListeners(slot);
            
            // Add slot number
            const slotNumber = document.createElement('div');
            slotNumber.className = 'slot-number';
            slotNumber.textContent = (i + 1).toString();
            slot.appendChild(slotNumber);
            
            this.quickBarInventoryElement.appendChild(slot);
        }
    }
    
    updateCraftingUI() {
        // Clear existing recipes
        this.craftingRecipesElement.innerHTML = '';
        
        // Refresh craftable items list
        const recipes = this.crafting.getAllRecipes();
        
        // Create recipe elements
        for (const recipe of recipes) {
            const recipeElement = document.createElement('div');
            recipeElement.className = 'crafting-item';
            
            if (!recipe.canCraft) {
                recipeElement.classList.add('unavailable');
            }
            
            // Item icon
            const item = this.inventory.itemManager.getItem(recipe.itemId);
            const itemIcon = document.createElement('div');
            itemIcon.className = 'item-icon';
            
            // Set background position for sprite sheet
            const iconInfo = this.inventory.itemManager.getItemTexture(item);
            itemIcon.style.backgroundPosition = 
                `-${iconInfo.col * 32}px -${iconInfo.row * 32}px`;
            
            recipeElement.appendChild(itemIcon);
            
            // Item name
            const itemName = document.createElement('div');
            itemName.className = 'crafting-item-name';
            itemName.textContent = recipe.name;
            recipeElement.appendChild(itemName);
            
            // Tooltip with recipe details
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            
            let tooltipContent = `<strong>${recipe.name}</strong><br>Requires:<br>`;
            
            for (const ingredient of recipe.recipe) {
                const available = this.inventory.countItem(ingredient.itemId);
                const hasEnough = available >= ingredient.amount;
                
                tooltipContent += `<span class="${hasEnough ? 'has-enough' : 'not-enough'}">
                    ${ingredient.name} x${ingredient.amount} (${available} available)
                </span><br>`;
            }
            
            tooltip.innerHTML = tooltipContent;
            recipeElement.appendChild(tooltip);
            
            // Craft button
            if (recipe.canCraft) {
                recipeElement.addEventListener('click', () => {
                    this.crafting.craftItem(recipe.itemId);
                    this.updateInventoryUI();
                });
            }
            
            this.craftingRecipesElement.appendChild(recipeElement);
        }
    }
    
    createItemElement(item) {
        const itemElement = document.createElement('div');
        itemElement.className = 'item';
        itemElement.dataset.itemId = item.id;
        
        // Item icon
        const itemIcon = document.createElement('div');
        itemIcon.className = 'item-icon';
        
        // Set background position for sprite sheet
        const iconInfo = this.inventory.itemManager.getItemTexture(item);
        itemIcon.style.backgroundPosition = 
            `-${iconInfo.col * 32}px -${iconInfo.row * 32}px`;
        
        itemElement.appendChild(itemIcon);
        
        // Item count for stackable items
        if (item.stackable && item.count > 1) {
            const itemCount = document.createElement('div');
            itemCount.className = 'item-count';
            itemCount.textContent = item.count.toString();
            itemElement.appendChild(itemCount);
        }
        
        // Tooltip with item details
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.innerHTML = `
            <strong>${item.name}</strong><br>
            ${item.description}
        `;
        
        // Add durability to tooltip for tools
        if (item.durability !== null && item.durability !== undefined) {
            const durabilityPercent = Math.round((item.durability / 100) * 100);
            tooltip.innerHTML += `<br>Durability: ${durabilityPercent}%`;
        }
        
        itemElement.appendChild(tooltip);
        
        return itemElement;
    }
    
    addSlotEventListeners(slot) {
        // Variables to track drag and drop
        let draggedItem = null;
        let draggedItemSlot = null;
        
        // Mouse down to start drag
        slot.addEventListener('mousedown', (event) => {
            // Only handle left click with shift held down
            if (event.button === 0 && event.shiftKey) {
                const itemElement = slot.querySelector('.item');
                
                if (itemElement) {
                    draggedItem = itemElement;
                    draggedItemSlot = slot;
                    
                    // Create visual feedback
                    slot.classList.add('dragging');
                    
                    // Prevent default browser drag behavior
                    event.preventDefault();
                }
            }
        });
        
        // Mouse up to end drag
        document.addEventListener('mouseup', (event) => {
            if (draggedItem && draggedItemSlot) {
                // Remove visual feedback
                draggedItemSlot.classList.remove('dragging');
                
                // Get the slot under the mouse
                const targetSlot = this.getSlotUnderMouse(event);
                
                if (targetSlot && targetSlot !== draggedItemSlot) {
                    // Move item between slots
                    this.moveItemBetweenSlots(draggedItemSlot, targetSlot);
                }
                
                // Reset drag state
                draggedItem = null;
                draggedItemSlot = null;
            }
        });
    }
    
    getSlotUnderMouse(event) {
        // Get all elements under the mouse
        const elements = document.elementsFromPoint(event.clientX, event.clientY);
        
        // Find the first element that is an inventory slot
        for (const element of elements) {
            if (element.classList.contains('inventory-slot')) {
                return element;
            }
        }
        
        return null;
    }
    
    moveItemBetweenSlots(sourceSlot, targetSlot) {
        // Get slot information
        const sourceType = sourceSlot.dataset.slotType;
        const sourceIndex = parseInt(sourceSlot.dataset.slotIndex);
        
        const targetType = targetSlot.dataset.slotType;
        const targetIndex = parseInt(targetSlot.dataset.slotIndex);
        
        // Move item in inventory
        this.inventory.moveItem(sourceType, sourceIndex, targetType, targetIndex);
        
        // Update UI
        this.updateInventoryUI();
    }
    
    selectQuickSlot(slotIndex) {
        // Update player's selected slot
        this.player.selectedSlot = slotIndex;
        
        // Update UI
        this.updateQuickBar();
        
        // Also update quick bar in inventory screen if open
        if (!document.getElementById('inventory-screen').classList.contains('hidden')) {
            this.updateQuickBarInventory();
        }
    }
}