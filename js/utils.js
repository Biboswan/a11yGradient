import * as d3 from 'd3';
import ColorContrastChecker from 'color-contrast-checker';
import rgbHex from 'rgb-hex';

const smoothCurve = (points) => {
  const line = d3.line()
    .x(d => d.x)
    .y(d => d.y)
    .curve(d3.curveCatmullRom.alpha(0.5)); // Adjust alpha for smoothness
  
  return line(points);
};

function normalizeColor(baseColor) {
  // Convert 'rgb(x, y, z)' to an array
  if (typeof baseColor === 'string' && baseColor.startsWith('rgb')) {
      return rgbToArray(baseColor);
  }
  // Convert hex to RGB array
  if (typeof baseColor === 'string') {
      return hexToRGBArray(baseColor);
  }
  // If already an array, return as is
  return baseColor;
}

function normalizeColorToHex(color) {
  if (typeof color === 'string' && color.startsWith('rgb')) {
    return rgbHex(color);
  }

  if (Array.isArray(color)) {
    return rgbHex(...color);
  }

  return color;
}

function rgbToArray(rgbString) {
    return rgbString.match(/\d+/g).map(Number);
}

/**
 * Combines a base color with white and black amounts to create gradient colors
 * @param {string|number[]} baseColor - Hex string or RGB array
 * @param {number} whiteAmount - Amount of white to mix (0-1)
 * @param {number} blackAmount - Amount of black to mix (0-1)
 * @returns {number[]} Final RGB color values
 */
const combineColors = (baseColor, whiteAmount, blackAmount) => {
  // 1. Normalize input color to RGB array
  console.log('baseColor',baseColor);
  const rgb = normalizeColor(baseColor);
  console.log('rgb',rgb);

  // 2. Mix with white (adding white increases each channel)
  const withWhite = rgb.map(channel => {
    // Calculate how far this channel is from white (255)
    const distanceToWhite = 255 - channel;
    // Add a percentage of that distance based on whiteAmount
    return channel + (distanceToWhite * whiteAmount);
  });
  
  // 3. Mix with black (multiplying by (1-blackAmount) decreases each channel)
  const final = withWhite.map(channel => 
    // Multiply by inverse of blackAmount (darker = closer to 0)
    Math.round(channel * (1 - blackAmount))
  );
  
  // 4. Ensure values stay within 0-255 range
  return final.map(channel => 
    Math.min(255, Math.max(0, channel))
  );
};

// Helper function to convert hex to RGB
const hexToRGBArray = (hex) => {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Handle shorthand hex (#FFF)
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  // Convert to RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return [r, g, b];
};

/**
 * Performs a binary search to find a value where the provided function equals zero
 * @param {number} min - Minimum search value
 * @param {number} max - Maximum search value
 * @param {Function} testFn - Function that returns positive/negative based on test position
 * @param {number} precision - How close to zero we need to get (default 0.01)
 * @param {number} maxIterations - Maximum iterations to prevent infinite loops
 * @returns {number} - The position where testFn ≈ 0
 */
const binarySearch = (min, max, testFn, precision = 0.01, maxIterations = 50) => {
  let iterations = 0;
  let low = min;
  let high = max;
  let bestMid = null;
  let bestResult = Infinity;
  
  while (low <= high && iterations < maxIterations) {
    const mid = Math.floor((low + high) / 2);
    const result = testFn(mid);
    
    // Update best result if this is closer to target
    if (Math.abs(result) < Math.abs(bestResult)) {
      bestMid = mid;
      bestResult = result;
    }
    
    // Check if we're close enough to target
    if (Math.abs(result) < precision) {
      return mid; // Found acceptable match
    }
    
    if (result < 0) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
    
    iterations++;
  }
  
  // If we found a best approximation, return it
  if (bestMid !== null) {
    return bestMid;
  }
  
  // If no good approximation found, return the last valid position
  return Math.max(min, Math.min(max, Math.floor((low + high) / 2)));
};

export class SpectrumGraphBuilder {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.width = canvas.width;
    this.height = canvas.height;
    this.ccc = new ColorContrastChecker();
  }

  setFontSize(fontSize) {
    this.ccc.fontSize = fontSize;
  }

  createBaseGradient(baseColor) {
    const imageData = this.ctx.createImageData(this.width, this.height);
    const data = imageData.data;
    const {width, height} = this;
    
    // Normalize the base color first
    const baseRGB = normalizeColor(baseColor);
    
    for (let y = 0; y < height; y++) {
      // Calculate vertical progress (0 to 1)
      const yProgress = y / height;
      
      for (let x = 0; x < width; x++) {
        // Calculate horizontal progress (0 to 1)
        const xProgress = x / width;
        
        // Start with the base color
        let color = [...baseRGB];
        
        // First apply white blend (horizontal)
        color = color.map(channel => {
          const distanceToWhite = 255 - channel;
          return Math.round(channel + (distanceToWhite * (1-xProgress)));
        });
        
        // Then apply black blend (vertical)
        color = color.map(channel => 
          Math.round(channel * (1 - yProgress))
        );
        
        // Calculate position in the imageData array (4 bytes per pixel: R,G,B,A)
        const index = (y * width + x) * 4;
        
        // Set pixel values
        data[index] = color[0];     // R
        data[index + 1] = color[1]; // G
        data[index + 2] = color[2]; // B
        data[index + 3] = 255;      // Alpha
      }
    }
  
    // Draw all pixels at once
    this.ctx.putImageData(imageData, 0, 0);
  };

  getPixelAt(x, y)  {
    const imageData = this.ctx.getImageData(x, y, 1, 1);
    const data = imageData.data;
    return [data[0], data[1], data[2]];
  };

  getContrastLines(backgroundColor) {
    return {
      aa: this.getContrastLine(4.5, backgroundColor),  // AA standard
      aaa: this.getContrastLine(7.0, backgroundColor)  // AAA standard
    };
  }

  getContrastLine = (targetRatio, backgroundColor) => {
    const points = [];
    const {ccc, width, height} = this;
    const backgroundColorHex = normalizeColorToHex(backgroundColor);
    const l2 = ccc.hexToLuminance(backgroundColorHex);
    console.log(backgroundColorHex);
   
    for (let x = 0; x < width; x++) {
      // Find y position where contrast ratio = target
      let y = binarySearch(0, height, (testY) => {
        const pixelColor = this.getPixelAt(x, testY);
        const pixelColorHex = normalizeColorToHex(pixelColor);
        const l1 = ccc.hexToLuminance(pixelColorHex);
        const ratio = ccc.getContrastRatio(l1, l2);
        console.log(pixelColorHex);
        console.log(ratio);
        return ratio - targetRatio;
      });
      points.push({x, y});
    }
    return smoothCurve(points); // Apply bezier smoothing
  }

  drawContrastLine(line, color) {
    const {ctx} = this;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.strokeStyle = color;
            
    // Draw the line through all points
    ctx.moveTo(line[0].x, line[0].y);

    for (let i = 1; i < line.length; i++) {
      ctx.lineTo(line[i].x, line[i].y);
    }

    ctx.stroke();
  }

  reset() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}
