// Utility functions for the game
class Utils {
    // Generate a random number between min and max (inclusive)
    static randomRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    // Clamp a value between min and max
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
    
    // Linear interpolation
    static lerp(a, b, t) {
        return a + t * (b - a);
    }
    
    // Convert degrees to radians
    static degToRad(degrees) {
        return degrees * Math.PI / 180;
    }
    
    // Convert radians to degrees
    static radToDeg(radians) {
        return radians * 180 / Math.PI;
    }
    
    // Calculate distance between two Vector3 points
    static distance(point1, point2) {
        return Math.sqrt(
            Math.pow(point2.x - point1.x, 2) +
            Math.pow(point2.y - point1.y, 2) +
            Math.pow(point2.z - point1.z, 2)
        );
    }
    
    // Calculate distance between two Vector2 points (ignoring y)
    static distance2D(point1, point2) {
        return Math.sqrt(
            Math.pow(point2.x - point1.x, 2) +
            Math.pow(point2.z - point1.z, 2)
        );
    }

    // Implementation of improved Perlin noise for terrain generation
    static noise(x, z) {
        // Define permutation table
        const permTable = new Array(512);
        const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,
                   140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,
                   247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,
                   57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,
                   74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,
                   60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,
                   65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,
                   200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,
                   52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,
                   207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,
                   119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,
                   129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,
                   218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,
                   81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,
                   184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,
                   222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
        
        // Fill permutation table
        for (let i = 0; i < 256; i++) {
            permTable[i] = p[i];
            permTable[i + 256] = p[i];
        }
        
        // Floor coordinates
        const X = Math.floor(x) & 255;
        const Z = Math.floor(z) & 255;
        
        // Relative coordinates within unit cube
        x -= Math.floor(x);
        z -= Math.floor(z);
        
        // Compute fade curves
        const u = this.fade(x);
        const v = this.fade(z);
        
        // Hash coordinates of the 4 corners
        const A = permTable[X] + Z;
        const AA = permTable[A];
        const AB = permTable[A + 1];
        const B = permTable[X + 1] + Z;
        const BA = permTable[B];
        const BB = permTable[B + 1];
        
        // Blend the 4 corners
        return this.lerp(
            this.lerp(this.grad(permTable[AA], x, 0, z), this.grad(permTable[BA], x - 1, 0, z), u),
            this.lerp(this.grad(permTable[AB], x, 0, z - 1), this.grad(permTable[BB], x - 1, 0, z - 1), u),
            v
        );
    }
    
    // Fade function for Perlin noise
    static fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    // Gradient function for Perlin noise
    static grad(hash, x, y, z) {
        // Convert lower 4 bits of hash code into 12 gradient directions
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
}