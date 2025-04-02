// Ensure required Three.js classes are available or provide fallbacks
if (!THREE) {
    console.error('THREE is not defined. Make sure Three.js is properly loaded.');
}

// Add GLTFLoader if it doesn't exist
if (typeof THREE !== 'undefined' && typeof THREE.GLTFLoader === 'undefined') {
    console.warn('GLTFLoader not found. Using a dummy loader instead.');
    THREE.GLTFLoader = class {
        load(url, onLoad, onProgress, onError) {
            console.warn(`Dummy loading ${url}`);
            const dummyScene = new THREE.Scene();
            const dummyBox = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true })
            );
            dummyScene.add(dummyBox);
            
            const dummyData = {
                scene: dummyScene,
                animations: []
            };
            
            // Simulate async loading
            setTimeout(() => {
                if (onLoad) onLoad(dummyData);
            }, 100);
        }
    };
}

// Add missing Audio loader if needed
if (typeof THREE !== 'undefined' && typeof THREE.AudioLoader === 'undefined') {
    console.warn('AudioLoader not found. Using a dummy loader instead.');
    THREE.AudioLoader = class {
        load(url, onLoad, onProgress, onError) {
            console.warn(`Dummy loading ${url}`);
            
            // Create a dummy audio buffer
            const dummyBuffer = {};
            
            // Simulate async loading
            setTimeout(() => {
                if (onLoad) onLoad(dummyBuffer);
            }, 100);
        }
    };
}

// Asset loader class to manage all game assets
class AssetLoader {
    constructor() {
        this.models = {};
        this.textures = {};
        this.sounds = {};
        this.animations = {};
        
        // Initialize loaders
        this.initializeLoaders();
        
        this.toLoad = 0;
        this.loaded = 0;
        this.onProgress = null;
        this.loadingErrors = [];
    }
    
    initializeLoaders() {
        try {
            this.modelLoader = new THREE.GLTFLoader();
        } catch (error) {
            console.warn('Error creating GLTFLoader:', error);
            this.modelLoader = {
                load: (url, onLoad) => {
                    console.warn(`Dummy loading model ${url}`);
                    const dummyScene = new THREE.Scene();
                    const dummyBox = new THREE.Mesh(
                        new THREE.BoxGeometry(1, 1, 1),
                        new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true })
                    );
                    dummyScene.add(dummyBox);
                    setTimeout(() => onLoad({scene: dummyScene, animations: []}), 100);
                }
            };
        }
        
        try {
            this.textureLoader = new THREE.TextureLoader();
        } catch (error) {
            console.warn('Error creating TextureLoader:', error);
            this.textureLoader = {
                load: (url, onLoad) => {
                    console.warn(`Dummy loading texture ${url}`);
                    const canvas = document.createElement('canvas');
                    canvas.width = canvas.height = 64;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = 'magenta';
                    ctx.fillRect(0, 0, 64, 64);
                    setTimeout(() => onLoad(new THREE.CanvasTexture(canvas)), 100);
                }
            };
        }
        
        try {
            this.audioLoader = new THREE.AudioLoader();
        } catch (error) {
            console.warn('Error creating AudioLoader:', error);
            this.audioLoader = {
                load: (url, onLoad) => {
                    console.warn(`Dummy loading audio ${url}`);
                    setTimeout(() => onLoad({}), 100);
                }
            };
        }
    }
    
    // Add a 3D model to the load queue
    addModel(name, path) {
        this.models[name] = { path, loaded: false, data: null };
        this.toLoad++;
    }
    
    // Add a texture to the load queue
    addTexture(name, path) {
        this.textures[name] = { path, loaded: false, data: null };
        this.toLoad++;
    }
    
    // Add a sound to the load queue
    addSound(name, path) {
        this.sounds[name] = { path, loaded: false, data: null };
        this.toLoad++;
    }
    
    // Start loading all assets
    loadAll() {
        return new Promise((resolve, reject) => {
            if (this.toLoad === 0) {
                resolve();
                return;
            }
            
            // Load models
            for (const [name, model] of Object.entries(this.models)) {
                this.modelLoader.load(
                    model.path,
                    (gltf) => this.onModelLoaded(name, gltf, resolve, reject),
                    (xhr) => this.updateProgress(),
                    (error) => this.handleError(name, error, resolve, reject)
                );
            }
            
            // Load textures
            for (const [name, texture] of Object.entries(this.textures)) {
                this.textureLoader.load(
                    texture.path,
                    (tex) => this.onTextureLoaded(name, tex, resolve, reject),
                    (xhr) => this.updateProgress(),
                    (error) => this.handleError(name, error, resolve, reject)
                );
            }
            
            // Load sounds
            for (const [name, sound] of Object.entries(this.sounds)) {
                this.audioLoader.load(
                    sound.path,
                    (buffer) => this.onSoundLoaded(name, buffer, resolve, reject),
                    (xhr) => this.updateProgress(),
                    (error) => this.handleError(name, error, resolve, reject)
                );
            }
        });
    }
    
    // Handle loaded model callback
    onModelLoaded(name, gltf, resolve, reject) {
        try {
            this.models[name].data = gltf;
            this.models[name].loaded = true;
            
            // Extract animations if they exist
            if (gltf.animations && gltf.animations.length > 0) {
                this.animations[name] = gltf.animations;
            }
            
            this.loaded++;
            this.updateProgress();
            this.checkComplete(resolve);
        } catch (error) {
            console.error(`Error processing loaded model ${name}:`, error);
            this.handleError(name, error, resolve, reject);
        }
    }
    
    // Handle loaded texture callback
    onTextureLoaded(name, texture, resolve, reject) {
        try {
            this.textures[name].data = texture;
            this.textures[name].loaded = true;
            
            // Set texture properties
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            
            this.loaded++;
            this.updateProgress();
            this.checkComplete(resolve);
        } catch (error) {
            console.error(`Error processing loaded texture ${name}:`, error);
            this.handleError(name, error, resolve, reject);
        }
    }
    
    // Handle loaded sound callback
    onSoundLoaded(name, buffer, resolve, reject) {
        try {
            this.sounds[name].data = buffer;
            this.sounds[name].loaded = true;
            
            this.loaded++;
            this.updateProgress();
            this.checkComplete(resolve);
        } catch (error) {
            console.error(`Error processing loaded sound ${name}:`, error);
            this.handleError(name, error, resolve, reject);
        }
    }
    
    // Update loading progress
    updateProgress() {
        if (this.onProgress && this.toLoad > 0) {
            const progress = this.loaded / this.toLoad;
            this.onProgress(progress);
        }
    }
    
    // Check if all assets are loaded
    checkComplete(resolve) {
        if (this.loaded === this.toLoad) {
            if (this.loadingErrors.length > 0) {
                resolve({success: true, errors: this.loadingErrors});
            } else {
                resolve({success: true});
            }
        }
    }
    
    // Improved handleError method for more graceful error recovery
    handleError(name, error, resolve, reject) {
        console.error(`Error loading asset ${name}:`, error);
        this.loadingErrors.push({name, error: error.message || 'Unknown error'});
        
        // For models, create a dummy replacement
        if (this.models[name]) {
            console.log(`Creating fallback for model ${name}`);
            this.models[name].data = {
                scene: this.createDummyModel(),
                animations: []
            };
            this.models[name].loaded = true;
            this.loaded++;
            this.updateProgress();
        }
        
        // For textures, create a dummy replacement
        if (this.textures[name]) {
            console.log(`Creating fallback for texture ${name}`);
            const dummyCanvas = document.createElement('canvas');
            dummyCanvas.width = 64;
            dummyCanvas.height = 64;
            const ctx = dummyCanvas.getContext('2d');
            
            // Create a checkerboard pattern
            const squareSize = 16;
            for (let y = 0; y < dummyCanvas.height; y += squareSize) {
                for (let x = 0; x < dummyCanvas.width; x += squareSize) {
                    ctx.fillStyle = (x + y) % (squareSize * 2) === 0 ? '#FF00FF' : '#000000';
                    ctx.fillRect(x, y, squareSize, squareSize);
                }
            }
            
            // Draw error text
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.fillText('ERROR', 16, 32);
            
            const dummyTexture = new THREE.CanvasTexture(dummyCanvas);
            dummyTexture.wrapS = THREE.RepeatWrapping;
            dummyTexture.wrapT = THREE.RepeatWrapping;
            
            this.textures[name].data = dummyTexture;
            this.textures[name].loaded = true;
            this.loaded++;
            this.updateProgress();
        }
        
        // For sounds, create an empty buffer
        if (this.sounds[name]) {
            console.log(`Creating fallback for sound ${name}`);
            this.sounds[name].data = {}; // Empty object as fallback
            this.sounds[name].loaded = true;
            this.loaded++;
            this.updateProgress();
        }
        
        // Check if all assets are loaded (including fallbacks)
        this.checkComplete(resolve);
    }
    
    // Get a model by name
    getModel(name) {
        if (!this.models[name] || !this.models[name].loaded) {
            console.warn(`Model ${name} not found or not loaded`);
            return this.createDummyModel();
        }
        
        // Clone the model to avoid modifying the original
        try {
            const original = this.models[name].data.scene;
            return original.clone();
        } catch (error) {
            console.error(`Error cloning model ${name}:`, error);
            return this.createDummyModel();
        }
    }
    
    // Get a texture by name
    getTexture(name) {
        if (!this.textures[name] || !this.textures[name].loaded) {
            console.warn(`Texture ${name} not found or not loaded`);
            return this.createDummyTexture();
        }
        
        return this.textures[name].data;
    }
    
    // Get a sound by name
    getSound(name) {
        if (!this.sounds[name] || !this.sounds[name].loaded) {
            console.warn(`Sound ${name} not found or not loaded`);
            return null;
        }
        
        return this.sounds[name].data;
    }
    
    // Get animations for a model
    getAnimations(name) {
        if (!this.animations[name]) {
            console.warn(`Animations for ${name} not found or not loaded`);
            return [];
        }
        
        return this.animations[name];
    }
    
    // Create a dummy model for testing when assets are missing
    createDummyModel() {
        const group = new THREE.Group();
        
        // Create a visually distinct dummy model
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xff00ff, 
            wireframe: true 
        });
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);
        
        // Add a second object to make it more noticeable
        const sphereGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            wireframe: true
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.y = 1;
        group.add(sphere);
        
        return group;
    }
    
    // Create a dummy texture when assets are missing
    createDummyTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Create a grid pattern
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 128, 128);
        
        ctx.fillStyle = '#FF00FF';
        for (let y = 0; y < 128; y += 16) {
            for (let x = 0; x < 128; x += 16) {
                if ((x + y) % 32 === 0) {
                    ctx.fillRect(x, y, 16, 16);
                }
            }
        }
        
        // Add text to indicate it's a missing texture
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.fillText('MISSING', 32, 60);
        ctx.fillText('TEXTURE', 32, 80);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        return texture;
    }
    
    // Get the total count of assets
    getTotalAssetCount() {
        return this.toLoad;
    }
    
    // Get the count of loaded assets
    getLoadedAssetCount() {
        return this.loaded;
    }
    
    // Check if there were any loading errors
    hasLoadingErrors() {
        return this.loadingErrors.length > 0;
    }
    
    // Get the list of loading errors
    getLoadingErrors() {
        return this.loadingErrors;
    }
}