// js/config.js
// Stores global constants and configuration settings

// --- Debugging ---
export const DEBUG = true;

// --- World Settings ---
export const worldScale = 200;
export const STARTING_INVENTORY = { 'wood': 10, 'stone': 5, 'axe': 1, 'pickaxe': 1 };

// --- Player Settings ---
export const playerHeight = 1.8;
export const playerRadius = 0.5; // Currently unused, but good to keep

// --- Interaction & Building ---
export const MAX_TOOLBAR_SLOTS = 9;
export const PLACEMENT_GRID_SIZE = 2;
export const PLACEMENT_REACH = 8;
export const INTERACTION_REACH = 5;

// --- Building Dimensions (depend on PLACEMENT_GRID_SIZE) ---
export const foundationW = PLACEMENT_GRID_SIZE * 2;
export const foundationH = 0.5;
export const foundationD = PLACEMENT_GRID_SIZE * 2;

export const wallW = foundationW;
export const wallH = 3;
export const wallD = 0.3;

export const doorW = 1.5;
export const doorH = wallH * 0.9;
export const doorD = 0.2;

export const roofW = foundationW;
export const roofH = 0.3;
export const roofD = foundationD;