import * as d3 from 'd3';
import ColorContrastChecker from 'color-contrast-checker';
import rgbHex from 'rgb-hex';
import { rgbaToHsva, hsvaToRgba, approachColorValue } from './color.js';

/**
 * Compute a desired luminance given a given luminance and a desired contrast
 * ratio.
 */
export function findDesiredLuminance(luminance, contrast, lighter) {
  function computeLuminance() {
    if (lighter) {
      return (luminance + 0.05) * contrast - 0.05;
    }
    return (luminance + 0.05) / contrast - 0.05;
  }

  let desiredLuminance = computeLuminance();
  if (desiredLuminance < 0 || desiredLuminance > 1) {
    lighter = !lighter;
    desiredLuminance = computeLuminance();
  }
  return desiredLuminance;
}

function blendColors(fgRGBA, bgRGBA) {
  const alpha = fgRGBA[3];
  return [
    ((1 - alpha) * bgRGBA[0]) + (alpha * fgRGBA[0]),
    ((1 - alpha) * bgRGBA[1]) + (alpha * fgRGBA[1]),
    ((1 - alpha) * bgRGBA[2]) + (alpha * fgRGBA[2]),
  ];
}

function pathToArray(path) {
  const tokens = path.split(' ').filter(token => token.trim() !== '');
  const points = [];
  let i = 0;
  while (i < tokens.length) {
      if (tokens[i] === 'M' || tokens[i] === 'L') {
          const x = parseFloat(tokens[i + 1]);
          const y = parseFloat(tokens[i + 2]);
          points.push({ x, y });
          i += 3;
      } else {
          i++;
      }
  }
  return points;
}

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

function removeAlphaHex(color) {
 // Normalize the color by ensuring a '#' prefix for consistency
 if (!color.startsWith('#')) {
  color = `#${color}`;
  }

  // Remove the alpha channel if present
  if (color.length === 9) { // Full-length hex code with alpha (e.g., #RRGGBBAA)
    return color.slice(0, 7);
  } else if (color.length === 5) { // Shorthand hex code with alpha (e.g., #RGBA)
    return color.slice(0, 4);
  }

// Return the color if it does not include alpha
  return color;
}

function rgbToArray(rgbString) {
    return rgbString.match(/\d+/g).map(Number);
}

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

  return [r, g, b, 1];
};

export class SpectrumGraphBuilder {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.width = canvas.width;
    this.height = canvas.height;
    this.ccc = new ColorContrastChecker();
    this.fontColor = null;
  }

  initialize(fontSize, fontWeight, fontColor) {
    this.ccc.fontSize = fontSize;
    this.ccc.fontWeight = fontWeight;
    this.fontColor = normalizeColor(fontColor);
  }

  createBaseGradient() {
    const baseRGB = this.fontColor;
    const imageData = this.ctx.createImageData(this.width, this.height);
    const data = imageData.data;
    const {width, height} = this;
    
    const [h,s,v,a] = rgbaToHsva(baseRGB);
  
    for (let y= 0; y <= height; y++) {
      // Calculate vertical progress (0 to 1)
      const yProgress = y / height;
      const newV = 1-yProgress;

      for (let x = 0; x <= width; x++) {
        // Calculate horizontal progress (0 to 1)
        const xProgress = x / width;
        const newS = xProgress;
        
        // Calculate position in the imageData array (4 bytes per pixel: R,G,B,A)
        const index = (y * width + x) * 4;
        const color = hsvaToRgba([h,newS,newV,1]);
        // Set pixel values
        data[index] = color[0]*255;     // R
        data[index + 1] = color[1]*255; // G
        data[index + 2] = color[2]*255; // B
        data[index + 3] = 255;      // Alpha
      }
    }
  
    // Draw all pixels at once
    this.ctx.putImageData(imageData, 0, 0);
  };


  getPixelAt(x, y)  {
    const imageData = this.ctx.getImageData(x, y, 1, 1);
    const data = imageData.data;
    return [data[0], data[1], data[2], data[3]/255];
  };

   drawContrastLine(path, lineColor) {
    const { ctx } = this;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;

    ctx.beginPath();

    const points = pathToArray(path);
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.stroke();
  }

  getContrastRatioLine(targetRatio, backgroundColor) {
    const {width, height, ccc, fontColor: fgRGBA} = this;
    
    if (!fgRGBA || !backgroundColor || !targetRatio || !width || !height ) {
      return null;
    }

    const dS = 0.02;
    const H = 0;
    const S = 1;
    const V = 2;
    const A = 3;

    const bgRGBA = normalizeColor(backgroundColor);
    const bgSRGB = ccc.calculateSRGB({r:bgRGBA[0], g:bgRGBA[1], b:bgRGBA[2]});
    const bgSRGBAArr = Object.values(bgSRGB).concat(bgRGBA[3]??1);
    const bgLRGB = ccc.calculateLRGB({r:bgRGBA[0], g:bgRGBA[1], b:bgRGBA[2]});
    const bgLuminance = ccc.calculateLuminance(bgLRGB);
   
    const fgSRGB = ccc.calculateSRGB({r:fgRGBA[0], g:fgRGBA[1], b:fgRGBA[2]});
    const fgSRGBAArr = Object.values(fgSRGB).concat(fgRGBA[3]??1);    
    const fgHSVA = rgbaToHsva(fgSRGBAArr);   
   
    let blendedRGBA = blendColors(fgSRGBAArr, bgSRGBAArr);
    const blendedLRGB = ccc.calculateLRGB({r:blendedRGBA[0]*255, g:blendedRGBA[1]*255, b:blendedRGBA[2]*255});

    const fgLuminance = ccc.calculateLuminance(blendedLRGB);
   
    const fgIsLighter = fgLuminance > bgLuminance;
    const desiredLuminance = findDesiredLuminance(bgLuminance, targetRatio, fgIsLighter);
   
    let lastV = fgHSVA[V];
    let currentSlope = 0;
    const candidateHSVA = [fgHSVA[H], 0, 0, fgHSVA[A]??1];
   
    let pathBuilder = [];
    
    const candidateLuminance = (candidateHSVA) => {
      const candidateRGBA = hsvaToRgba(candidateHSVA);
      const blendedRGBA = blendColors(candidateRGBA, bgSRGBAArr);
      const blendedLRGB = ccc.calculateLRGB({r:blendedRGBA[0]*255, g:blendedRGBA[1]*255, b:blendedRGBA[2]*255});
      return ccc.calculateLuminance(blendedLRGB);
    };

    // Plot V for values of S such that the computed luminance approximates
    // `desiredLuminance`, until no suitable value for V can be found, or the
    // current value of S goes of out bounds.
    let s;
    for (s = 0; s < 1 + dS; s += dS) {
      s = Math.min(1, s);
      candidateHSVA[S] = s;

      // Extrapolate the approximate next value for `v` using the approximate
      // gradient of the curve.
      candidateHSVA[V] = lastV + currentSlope * dS;

      const v = approachColorValue(candidateHSVA, bgSRGBAArr, V, desiredLuminance, candidateLuminance);
      if (v === null) {
        break;
      }

      // Approximate the current gradient of the curve.
      currentSlope = s === 0 ? 0 : (v - lastV) / dS;
      lastV = v;

      pathBuilder.push(pathBuilder.length ? 'L' : 'M');
      pathBuilder.push((s * width).toFixed(2));
      pathBuilder.push(((1 - v) * height).toFixed(2));
    }

    // If no suitable V value for an in-bounds S value was found, find the value
    // of S such that V === 1 and add that to the path.
    if (s < 1 + dS) {
      s -= dS;
      candidateHSVA[V] = 1;
      s = approachColorValue(candidateHSVA, bgRGBA, S, desiredLuminance, candidateLuminance);
      if (s !== null) {
        pathBuilder = pathBuilder.concat(['L', (s * width).toFixed(2), '-0.1']);
      }
    }

    if (pathBuilder.length === 0) {
      return null;
    }

    return pathBuilder.join(' ');
  }

  reset() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}
