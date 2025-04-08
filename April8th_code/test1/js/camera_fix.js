// js/camera.js - Fixed rotation sensitivity
class ThirdPersonCamera {
    constructor(camera, target) {
        this.camera = camera;
        this.target = target; // The player mesh

        this.currentPosition = new THREE.Vector3();
        this.currentLookat = new THREE.Vector3();

        this.distance = 5.0; // Distance from target
        this.minDistance = 2.0;
        this.maxDistance = 10.0;
        this.heightOffset = 1.8; // How high above the target's center
        this.rotationSensitivity = 0.003; // FIXED: Reduced sensitivity since we use raw movement values
        this.zoomSensitivity = 0.1; // Keep this relatively small

        this.phi = Math.PI / 3; // Vertical angle (0 = top down, PI/2 = level)
        this.theta = 0; // Horizontal angle
    }

    update(deltaTime, input) {
        // Ensure we don't update if deltaTime is excessively large (e.g., after pause/lag spike)
        if (deltaTime > 0.1) deltaTime = 0.1; // Clamp delta time

        // Get mouse movement delta for this frame
        const mouseDeltaX = input.mouse.movementX || 0;
        const mouseDeltaY = input.mouse.movementY || 0;

        // FIXED: Use raw mouse movement for smoother camera control
        // No need to scale by deltaTime since mouseDelta already represents movement during this frame
        this.theta -= mouseDeltaX * this.rotationSensitivity;
        this.phi -= mouseDeltaY * this.rotationSensitivity;

        // Clamp vertical angle (phi) to prevent flipping
        this.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, this.phi));

        // Handle zoom (mouse wheel action) - using rotateBuild action is fine here
        const zoomDelta = input.actions.rotateBuild || 0; // Get the zoom action value for this frame
        this.distance -= zoomDelta * this.distance * this.zoomSensitivity; // Make zoom speed relative to current distance
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));

        // Calculate camera position based on angles and distance
        // Ensure target exists before accessing position
        if (!this.target) return;
        const targetPosition = this.target.position.clone();
        targetPosition.y += this.heightOffset; // Look slightly above the player's feet

        const offsetX = this.distance * Math.sin(this.phi) * Math.sin(this.theta);
        const offsetY = this.distance * Math.cos(this.phi);
        const offsetZ = this.distance * Math.sin(this.phi) * Math.cos(this.theta);

        const desiredPosition = targetPosition.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));

        // Smoothly move to desired position (lerp)
        const lerpFactor = Math.min(1, 15 * deltaTime); // Ensure lerp factor doesn't exceed 1
        this.currentPosition.lerp(desiredPosition, lerpFactor); // Adjust lerp factor for smoothness

        this.camera.position.copy(this.currentPosition);
        this.camera.lookAt(targetPosition); // Always look at the target position

        // Store the look-at point if needed elsewhere
        this.currentLookat.copy(targetPosition);
    }

    // Needed to orient player movement relative to camera
    getForwardVector() {
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0; // Project onto XZ plane
        forward.normalize();
        return forward;
    }

    getRightVector() {
        const right = new THREE.Vector3();
        // Get vector pointing straight down camera's view
        this.camera.getWorldDirection(right);
        // Cross product with camera's up vector (usually (0,1,0)) to get the right vector
        // Make sure camera.up is correctly set (usually default is fine)
        right.cross(this.camera.up); // Get right vector (camera's local X)
        right.y = 0; // Project onto XZ plane
        right.normalize();
        return right;
    }
}