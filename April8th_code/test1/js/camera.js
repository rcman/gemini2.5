// js/camera.js
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
        this.rotationSensitivity = 0.005; // Mouse sensitivity for rotation
        this.zoomSensitivity = 0.1;

        this.phi = Math.PI / 3; // Vertical angle (0 = top down, PI/2 = level)
        this.theta = 0; // Horizontal angle

        this.input = { mouseX: 0, mouseY: 0, wheel: 0 }; // Store mouse delta and wheel
    }

    update(deltaTime, input) {
        // Accumulate mouse movement for rotation
        // Scale sensitivity by delta time if desired for frame rate independence
         this.theta -= input.mouse.movementX * this.rotationSensitivity;
         this.phi -= input.mouse.movementY * this.rotationSensitivity;

        // Clamp vertical angle (phi) to prevent flipping
        this.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, this.phi));

        // Handle zoom (mouse wheel)
        this.distance -= input.actions.rotateBuild * this.zoomSensitivity * 50; // Reuse rotateBuild for zoom temporarily
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));


        // Calculate camera position based on angles and distance
        const targetPosition = this.target.position.clone();
        targetPosition.y += this.heightOffset; // Look slightly above the player's feet

        const offsetX = this.distance * Math.sin(this.phi) * Math.sin(this.theta);
        const offsetY = this.distance * Math.cos(this.phi);
        const offsetZ = this.distance * Math.sin(this.phi) * Math.cos(this.theta);

        const desiredPosition = targetPosition.clone().add(new THREE.Vector3(offsetX, offsetY, offsetZ));

        // Basic collision detection (raycast from target towards camera position)
        // This is very basic and needs improvement (e.g., spherecast)
        // const rayDirection = desiredPosition.clone().sub(targetPosition).normalize();
        // const ray = new THREE.Raycaster(targetPosition, rayDirection, 0, this.distance);
        // const intersects = ray.intersectObjects(game.world.getCollidableObjects()); // Need a way to get potential colliders

        // if (intersects.length > 0) {
        //     // Hit something, move camera closer
        //     this.currentPosition.copy(intersects[0].point).lerp(targetPosition, 0.1); // Move slightly away from hit point
        // } else {
             // No collision, smoothly move to desired position (lerp)
             this.currentPosition.lerp(desiredPosition, 10 * deltaTime); // Adjust lerp factor for smoothness
        // }


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
        this.camera.getWorldDirection(right);
        right.cross(this.camera.up); // Get right vector (camera's local X)
        right.y = 0; // Project onto XZ plane
        right.normalize();
        return right;
    }
}
