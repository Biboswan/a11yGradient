import ColorContrastChecker from 'color-contrast-checker';
import { rgbaToHsva, hsvaToRgba, approachColorValue, rgbaToHsla } from './color.js';

// Calculate distance from point to line segment
function distanceToLineSegment(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) param = dot / lenSq;
  
  let xx, yy;
  
  if (param < 0) {
      xx = x1;
      yy = y1;
  } else if (param > 1) {
      xx = x2;
      yy = y2;
  } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
  }
  
  const dx = px - xx;
  const dy = py - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}

// Format different types of values
function formatValue(value) {
  if (value instanceof Date) {
      return value.toLocaleString();
  }
  if (Array.isArray(value)) {
      return value.join(', ');
  }
  if (typeof value === 'object') {
      return JSON.stringify(value);
  }
  return String(value);
}

// Format key
function formatKey(key) {
  return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
}

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

function rgbToArray(rgbString) {
    return rgbString.match(/\d+/g).map(Number);
}

// Helper function to convert hex to RGB
function hexToRGBArray(hex) {
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

    this.lineRegistry = {};
    this.nextLineId = 0;

    // Get tooltip elements
    this.tooltip = document.getElementById('canvas-tooltip');
    this.tooltipContent = this.tooltip.querySelector('.canvas-tooltip__content');
    this.accessibleDescriptionArea = document.getElementById('canvas-accessible-description');

    // Bind event listeners
    this.handleCanvasClick = this.handleCanvasClick.bind(this);
    //this.handleKeyboardInteraction = this.handleKeyboardInteraction.bind(this);
    
    this.canvas.addEventListener('click', this.handleCanvasClick);
    // this.canvas.addEventListener('keydown', this.handleKeyboardInteraction);
    // this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    // this.canvas.addEventListener('mouseout', this.hideTooltip.bind(this));
  }

  initialize(fontSize, fontWeight, fontColor) {
    this.ccc.fontSize = fontSize;
    this.ccc.fontWeight = fontWeight;
    this.fontColor = normalizeColor(fontColor);
  }

  /**
   * @param {{ pageX: number; pageY: number; }} event
   * @param {{ [s: string]: any; } | ArrayLike<any>} data
   */
  showTooltip(event, data) {
    // Clear previous content
    this.tooltipContent.innerHTML = '';

    // Convert line data to tooltip items
    Object.entries(data)
        .filter(([key]) => key !== 'path') // Exclude path data
        .forEach(([key, value]) => {
            if (key !== 'accessibleId') {
                const itemElement = document.createElement('div');
                itemElement.className = 'canvas-tooltip__item';
                
                const labelElement = document.createElement('strong');
                labelElement.textContent = `${formatKey(key)}: `;
                
                const valueContainer = document.createElement('div');
                const valueElement = document.createElement('div');
                const rgbaColor = normalizeColor(value);
                console.log('rgbaColor', rgbaColor);
                valueElement.textContent = `rgba(${rgbaColor[0]}, ${rgbaColor[1]}, ${rgbaColor[2]}, ${rgbaColor[3]})`;

                const colorElement = document.createElement('div');
                colorElement.className = 'canvas-tooltip__color';
                colorElement.style.backgroundColor = `rgba(${rgbaColor[0]}, ${rgbaColor[1]}, ${rgbaColor[2]}, ${rgbaColor[3]})`;
                
                valueContainer.appendChild(valueElement);
                valueContainer.appendChild(colorElement);
                itemElement.appendChild(labelElement);
                itemElement.appendChild(valueContainer);
                this.tooltipContent.appendChild(itemElement);
            }
        });

    // Position and show tooltip
    this.tooltip.style.left = `${event.pageX + 10}px`;
    this.tooltip.style.top = `${event.pageY + 10}px`;
    this.tooltip.classList.add('is-visible');
    this.tooltip.setAttribute('aria-hidden', 'false');
  }

  // Hide tooltip
  hideTooltip() {
    this.tooltip.classList.remove('is-visible');
    this.tooltip.setAttribute('aria-hidden', 'true');
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

  drawContrastLine(path, lineColor, dataAttributes) {
    if (!path) {
      return;
    }

    const { ctx } = this;
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;

    ctx.beginPath();

    const points = pathToArray(path);
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.stroke();

    const lineId = this.nextLineId++;
    this.lineRegistry[lineId] = {
          path: points,
          color: lineColor,
          ...dataAttributes
    }
      return lineId;
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


  isPointNearLine(x, y, lineId, threshold = 5) {
    const line = this.lineRegistry[lineId];
    if (!line) return false;
    
    const points = line.path;
    for (let i = 0; i < points.length - 1; i++) {
        const dist = distanceToLineSegment(
            x, y,
            points[i].x, points[i].y,
            points[i+1].x, points[i+1].y
        );
        if (dist <= threshold) return true;
    }
    return false;
  }

  // Handle canvas click events
  handleCanvasClick(event) {
      // Get canvas-relative coordinates
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Find clicked lines
      const clickedLines = Object.entries(this.lineRegistry)
          .filter(([lineId, line]) => 
              this.isPointNearLine(x, y, lineId)
          );

      const fontColor = this.getPixelAt(x, y);
      // Trigger click handler for each clicked line
      clickedLines.forEach(([lineId, line]) => {
          console.log('line',line);
      });

      this.showTooltip(event, {
        color: fontColor,
        backgroundColor: clickedLines.length > 0 ? clickedLines[0][1].bgColor : undefined
      });
  }

  reset() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.lineRegistry = {};
    this.nextLineId = 0;
    this.hideTooltip();
  }
}