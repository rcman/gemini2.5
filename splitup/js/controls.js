// js/controls.js
// Sets up PointerLockControls and manages lock/unlock events

import { toggleCraftingMenu } from './ui.js'; // To ensure crafting menu closes on lock

// --- State ---
let controls = null;

// --- Setup ---
export function setupControls(camera, domElement) {
    // Check if PointerLockControls loaded correctly (it attaches to THREE)
    if (typeof THREE.PointerLockControls === 'undefined') {
        console.error("FATAL: THREE.PointerLockControls not found. Controls will not work. Was the script loaded?");
        document.getElementById("loading-error").textContent = "ERROR: PointerLockControls script failed to load. Controls disabled.";
        document.getElementById("blocker").style.display = 'block'; // Keep blocker visible
        document.getElementById("instructions").style.display = 'flex';
        return null; // Return null to indicate failure
    }

    controls = new THREE.PointerLockControls(camera, domElement);

    // Event listeners for locking/unlocking the cursor
    const blocker = document.getElementById('blocker');
    const instructions = document.getElementById('instructions');
    const craftingUI = document.getElementById('crafting-ui');

    instructions.addEventListener('click', () => {
        controls.lock();
    });

    controls.addEventListener('lock', () => {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
        // Ensure crafting menu is closed when pointer lock is engaged
        if (craftingUI && craftingUI.style.display === 'block') {
             craftingUI.style.display = 'none';
        }
    });

    controls.addEventListener('unlock', () => {
        // Don't show blocker/instructions immediately if crafting menu is open
        if (!craftingUI || craftingUI.style.display !== 'block') {
             blocker.style.display = 'block';
             instructions.style.display = 'flex';
        }
    });

    return controls; // Return the initialized controls object
}

// --- Accessor ---
// Allow other modules to get the controls object if needed (e.g., for isLocked checks)
export function getControls() {
    return controls;
}