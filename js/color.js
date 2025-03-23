/**
 * Color utility functions for gradient and contrast calculations
 */

/**
 * Convert RGB values to HSL color space
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {Array} [h, s, l] values
 */
export function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }

        h /= 6;
    }

    return [h, s, l];
}

/**
 * Convert HSL values to RGB color space
 * @param {number} h - Hue (0-1)
 * @param {number} s - Saturation (0-1)
 * @param {number} l - Lightness (0-1)
 * @returns {Array} [r, g, b] values (0-255)
 */
export function hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [
        Math.round(r * 255),
        Math.round(g * 255),
        Math.round(b * 255)
    ];
}

/**
 * Calculate relative luminance using WCAG algorithm
 * @param {Array} rgb - [r, g, b] values (0-255)
 * @returns {number} Luminance value
 */
export function calculateLuminance(rgb) {
    const [r, g, b] = rgb.map(val => {
        val = val / 255;
        return val <= 0.03928 
            ? val / 12.92 
            : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * @param {Array} color1 - First color [r, g, b]
 * @param {Array} color2 - Second color [r, g, b]
 * @returns {number} Contrast ratio
 */
export function calculateContrastRatio(color1, color2) {
    const l1 = calculateLuminance(color1);
    const l2 = calculateLuminance(color2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Blend two colors with alpha transparency
 * @param {Array} fgColor - Foreground color [r, g, b, a]
 * @param {Array} bgColor - Background color [r, g, b, a]
 * @returns {Array} Blended color [r, g, b, a]
 */
export function blendColors(fgColor, bgColor) {
    const alpha = fgColor[3];
    return [
        Math.round(((1 - alpha) * bgColor[0]) + (alpha * fgColor[0])),
        Math.round(((1 - alpha) * bgColor[1]) + (alpha * fgColor[1])),
        Math.round(((1 - alpha) * bgColor[2]) + (alpha * fgColor[2])),
        alpha + (bgColor[3] * (1 - alpha))
    ];
}

/**
 * Convert RGB array to hex string
 * @param {Array} rgb - RGB color array [r, g, b]
 * @returns {string} Hex color string
 */
export function rgbToHex(rgb) {
    return '#' + rgb.map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Check if a color meets WCAG contrast requirements
 * @param {number} ratio - Contrast ratio
 * @param {string} fontSize - Font size in pixels
 * @param {string} fontWeight - Font weight
 * @returns {Object} WCAG compliance status
 */
export function checkWCAGCompliance(ratio, fontSize, fontWeight) {
    const isLarge = isLargeFont(fontSize, fontWeight);
    return {
        AA: isLarge ? ratio >= 3.0 : ratio >= 4.5,
        AAA: isLarge ? ratio >= 4.5 : ratio >= 7.0
    };
}

/**
 * Determine if font is considered large by WCAG standards
 * @param {string} fontSize - Font size in pixels
 * @param {string} fontWeight - Font weight
 * @returns {boolean} Whether the font is considered large
 */
export function isLargeFont(fontSize, fontWeight) {
    const size = parseFloat(fontSize.replace('px', ''));
    const weight = parseInt(fontWeight, 10);
    const isBold = weight >= 700;
    const sizePt = size * 72 / 96; // Convert px to pt
    return isBold ? sizePt >= 14 : sizePt >= 18;
}

function rgbToHue([r, g, b]) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
  
    let h;
    if (min === max) {
      h = 0;
    } else if (r === max) {
      h = ((1 / 6 * (g - b) / diff) + 1) % 1;
    } else if (g === max) {
      h = (1 / 6 * (b - r) / diff) + 1 / 3;
    } else {
      h = (1 / 6 * (r - g) / diff) + 2 / 3;
    }
    return h;
  }

export function rgbaToHsla([r, g, b, a]) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const sum = max + min;
  
    const h = rgbToHue([r, g, b]);
    const l = 0.5 * sum;
  
    let s;
    if (l === 0) {
      s = 0;
    } else if (l === 1) {
      s = 0;
    } else if (l <= 0.5) {
      s = diff / sum;
    } else {
      s = diff / (2 - sum);
    }
  
    return [h, s, l, a];
}

export function hslaToHsva([h,s,l,a])  {
    s = s * (l < 0.5 ? l : 1 - l);
    return [h, s !== 0 ? 2 * s / (l + s) : 0, (l + s), a ?? 1];
}

export function rgbaToHsva([r, g, b, a]) {
    const [h,s,l] = rgbaToHsla([r, g, b, a]);
    return hslaToHsva([h,s,l,a]);
}

export function hsvaToRgba([h, s, v, a]) {
    // Handle edge case
    if (s === 0) {
      // If saturation is 0, the color is a shade of gray
      return [v, v, v, a ?? 1];
    }
  
    // Calculate the color component based on the sector of the color wheel
    const hue = h * 6; // Convert hue to [0,6)
    const i = Math.floor(hue); // Integer part of hue
    const f = hue - i; // Fractional part of hue
    
    const p = v * (1 - s);
    const q = v * (1 - (s * f));
    const t = v * (1 - (s * (1 - f)));
  
    let r, g, b;
    
    switch (i % 6) {
      case 0: [r, g, b] = [v, t, p]; break;
      case 1: [r, g, b] = [q, v, p]; break;
      case 2: [r, g, b] = [p, v, t]; break;
      case 3: [r, g, b] = [p, q, v]; break;
      case 4: [r, g, b] = [t, p, v]; break;
      case 5: [r, g, b] = [v, p, q]; break;
    }
  
    return [r, g, b, a ?? 1];
}


/**
 * Approach a value of the given component of `candidateHSVA` such that the
 * calculated luminance of `candidateHSVA` approximates `desiredLuminance`.
 */
export function approachColorValue(
    candidateHSVA, bgRGBA, index, desiredLuminance,
    candidateLuminance) {
  const epsilon = 0.0002;

  let x = candidateHSVA[index];
  let multiplier = 1;
  let dLuminance = candidateLuminance(candidateHSVA) - desiredLuminance;
  let previousSign = Math.sign(dLuminance);

  for (let guard = 100; guard; guard--) {
    if (Math.abs(dLuminance) < epsilon) {
      candidateHSVA[index] = x;
      return x;
    }

    const sign = Math.sign(dLuminance);
    if (sign !== previousSign) {
      // If `x` overshoots the correct value, halve the step size.
      multiplier /= 2;
      previousSign = sign;
    } else if (x < 0 || x > 1) {
      // If there is no overshoot and `x` is out of bounds, there is no
      // acceptable value for `x`.
      return null;
    }

    // Adjust `x` by a multiple of `dLuminance` to decrease step size as
    // the computed luminance converges on `desiredLuminance`.
    x += multiplier * (index === 2 ? -dLuminance : dLuminance);

    candidateHSVA[index] = x;

    dLuminance = candidateLuminance(candidateHSVA) - desiredLuminance;
  }

  return null;
}

