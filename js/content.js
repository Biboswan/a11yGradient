import ColorContrastChecker from 'color-contrast-checker';
import rgbHex from 'rgb-hex';
import { messageTypes } from './common.js';

const COLOR_TRANSPARENT = ['rgba(0, 0, 0, 0)', 'transparent'];

let _selectedElement,
    contrastColor,
    _contrastData,
    _colorContrastType = 'text-color',
    _bgElement,
    _markerGap = 20,
    accessibilityBackgroundBoundary,
    pixelColorAtMarkerPoint,
    shouldRunContrast = 0;

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
//const dirtyImage = document.createElement('img');
const snapshot = document.createElement('img');
const link = document.createElement('link');
link.rel = 'stylesheet';
link.type = 'text/css';
link.href = chrome.runtime.getURL('css/content.css');
const box = document.createElement('div');
box.classList.add('a11y-gradient-box');

window.addEventListener('DOMContentLoaded', handleDOMContentLoaded);

// Have a adaptor pattern and hide the underlying contrast algorithm
const ccc = new ColorContrastChecker();

snapshot.onload = snapshotLoaded;

const {
    PANEL_INIT,
    PANEL_REGISTER_FRAME,
    UPDATE_SELECTED_ELEMENT,
    SET_COLOR_CONTRAST,
    UPDATE_CONTRAST_COLOR,
    SET_MARKER_GAP,
    UPDATE_SHOULD_RUN_CONTRAST,
    UPDATE_MARKER_HOVERED,
    UPDATE_CONTRAST_SPECTRUM_GRAPH
} = messageTypes;

const colorTypeToStyle = {
    'text-color': 'color',
    'text-border': '-webkit-text-stroke-color',
    'element-border': 'border-color',
};

// class AllyGradient extends HTMLElement {
//     constructor() {
//         super();

//         this.attachShadow({ mode: 'open' });
//         this.handleMouseOver = this.handleMouseOver.bind(this);

//         const gap = this.getAttribute(markerGap);
//         const box = document.createElement('div');
//         box.classList.add('a11y-gradient-box');
//         const { left, top, width, height } = JSON.parse(this.getAttribute('boxConfig'));
//         box.style.width = width + 'px';
//         box.style.height = height + 'px';
//         box.style.left = left + 'px';
//         box.style.top = top + 'px';
//         box.style.zIndex = Number.MAX_SAFE_INTEGER;

//         for (let y = 0; y <= height; y = y + gap) {
//             for (let x = 0; x <= width; x = x + gap) {
//                 const dot = document.createElement('dot');
//                 dot.classList.add('dot');
//                 dot.style.left = x + 'px';
//                 dot.style.top = y + 'px';
//                 dot.dataset.x = x;
//                 dot.dataset.y = y;
//                 box.appendChild(dot);
//             }
//         }

//         this.shadowRoot.append(style, box);
//     }

//     handleMouseOver(e) {
//         console.log('e', e.target);
//     }

//     connectedCallback() {
//         box.addEventListener('mouseover', this.handleMouseOver);
//     }

//     disconnectedCallback() {
//         const box = document.querySelector('.box');
//         box.removeEventListener('mouseover', this.handleMouseOver);
//     }
// }

function handleDOMContentLoaded() {
    const head = document.getElementsByTagName('HEAD')[0];
    head.appendChild(link);
    document.body.insertAdjacentElement('afterend', box);
}

//window.customElements.define('ally-gradient', AllyGradient);

function colorForElement(element, what) {
    let color = null;
    let w = element.ownerDocument.defaultView;
    while (element) {
        color = w.getComputedStyle(element).getPropertyValue(what);
        if (color && !COLOR_TRANSPARENT.includes(color)) {
            break;
        }
        element = element.parentElement;
    }
    return color;
}

//Find the nearest parent element which decides its background color or background-image
function findBgElement(element) {
    let color = null;
    let w = element.ownerDocument.defaultView;

    if (_colorContrastType === 'element-border') {
        element = element.parentElement;
    }

    while (element) {
        color = w.getComputedStyle(element).getPropertyValue('background-color');

        if (color && !COLOR_TRANSPARENT.includes(color)) {
            return element;
        }

        color = w.getComputedStyle(element).getPropertyValue('background-image');

        if (color !== 'none') {
            return element;
        }
        element = element.parentElement;
    }
    return null;
}

function createMessageForSelectedElement(element) {
    if (!element || element.nodeType !== 1) {
        return { type: UPDATE_SELECTED_ELEMENT, selectedElement: {} };
    }

    return {
        type: UPDATE_SELECTED_ELEMENT,
        selectedElement: element.outerHTML,
        color: contrastColor,
    };
}

function setSelectedElement(element) {
    if (!element) return;
    // If the selected element is the same, let handlers in other iframe contexts handle it instead.
    if (_selectedElement === undefined || element !== _selectedElement) {
        _selectedElement = element;
        contrastColor = colorForElement(_selectedElement, colorTypeToStyle[_colorContrastType]);
        chrome.runtime.sendMessage(createMessageForSelectedElement(element));
    }
}

function setColorContrastType(colorContrastType) {
    _colorContrastType = colorContrastType;
    if (!_selectedElement) return;

    switch (_colorContrastType) {
        case 'text-color':
            contrastColor = colorForElement(_selectedElement, colorTypeToStyle['text-color']);
            break;
        case 'text-border':
            contrastColor = colorForElement(
                _selectedElement,
                colorTypeToStyle['-webkit-text-stroke-color']
            );
            break;
        case 'element-border':
            contrastColor = colorForElement(_selectedElement, colorTypeToStyle['element-border']);
            break;
    }
}

function setMarkerGap(markerGap) {
    _markerGap = parseInt(markerGap);
}

function handleMouseOver(e) {
    const { dataset } = e.target;
    if ('x' in dataset) {
        const { x, y } = dataset;

        const { hex, WCAG_AA, WCAG_AAA, contrastRatio } = _contrastData[y / _markerGap][
            x / _markerGap
        ];
        chrome.runtime.sendMessage({
            type: UPDATE_MARKER_HOVERED,
            hex,
            WCAG_AA,
            WCAG_AAA,
            contrastRatio,
        });
    }
}

function createOverlap() {
    const { left, top, width, height } = _bgElement.getBoundingClientRect();
    // const elem = document.createElement('ally-gradient', {
    //     markerGap: _markerGap,
    //     boxConfig: JSON.stringify({ left, top, width, height }),
    // });
    // const shadowRoot = document.createElement('div');
    // shadowRoot.attachShadow({ mode: 'open' });
    box.addEventListener('mouseover', handleMouseOver, false);

    box.classList.remove('a11y-gradient-box-reset');
    box.style.width = width + 'px';
    box.style.height = height + 'px';
    box.style.left = left + 'px';
    box.style.top = top + 'px';

    const dots = [];

    for (let y = 0; y <= height; y = y + _markerGap) {
        for (let x = 0; x <= width; x = x + _markerGap) {
            const dot = document.createElement('dot');
            dot.classList.add('a11y-gradient-dot');
            dot.style.left = x + 'px';
            dot.style.top = y + 'px';
            dot.dataset.x = x;
            dot.dataset.y = y;
            dots.push(dot);
        }
    }
    box.append(...dots);
}

function findAccessibilityBackgroundBoundary(selectedElement, bgElement) {
    if (!selectedElement || !bgElement) return null;

    const textRect = selectedElement.getBoundingClientRect();
    const bgRect = bgElement.getBoundingClientRect();
    
    // Get text dimensions
    const textHeight = textRect.height;
    const textWidth = textRect.width;
    
    // Calculate boundary dimensions (2x text dimensions)
    const boundaryHeight = textHeight * 2;
    const boundaryWidth = textWidth * 2;
    
    // Calculate the centers
    const textVerticalCenter = textRect.top + (textHeight / 2);
    const textHorizontalCenter = textRect.left + (textWidth / 2);
    
    // Calculate boundaries, ensuring they stay within the background element
    const top = Math.max(bgRect.top, textVerticalCenter - boundaryHeight / 2);
    const bottom = Math.min(bgRect.bottom, textVerticalCenter + boundaryHeight / 2);
    const left = Math.max(bgRect.left, textHorizontalCenter - boundaryWidth / 2);
    const right = Math.min(bgRect.right, textHorizontalCenter + boundaryWidth / 2);
    
    // Create boundary points for all corners
    return {
        // Corner points
        topLeft: { x: left, y: top },
        topRight: { x: right, y: top },
        bottomLeft: { x: left, y: bottom },
        bottomRight: { x: right, y: bottom },
    };
}

//think of locking logic
function findColorContrastRatios(element) {
    const { left, top, width, height } = element.getBoundingClientRect();
    const pixelColorAtMarkerPoint = [];
    const contrastData = [];

    const w = _selectedElement?.ownerDocument.defaultView;
    const fontSizeStr = w.getComputedStyle(_selectedElement).getPropertyValue('font-size');
    const fontWeight = w.getComputedStyle(_selectedElement).getPropertyValue('font-weight');
    ccc.fontSize = fontSizeStr.substring(0, fontSizeStr.length - 2);
    ccc.fontWeight = fontWeight;

    const contrastColorHex = rgbHex(contrastColor);
    const l1 = ccc.hexToLuminance(`#${contrastColorHex.substring(0, 6)}`);

    for (let y = 0; y <= height; y = y + _markerGap) {
        contrastData.push([]);
        const yc = y + top;
        let lastIndex = contrastData.length - 1;
        for (let x = 0; x <= width; x = x + _markerGap) {
            const xc = x + left;
            const [r, g, b, a] = ctx.getImageData(xc, yc, 1, 1).data;
            const hex = rgbHex(r, g, b);
            const l2 = ccc.hexToLuminance(`#${hex}`);
            const contrastRatio = ccc.getContrastRatio(l1, l2);
            pixelColorAtMarkerPoint.push({x:xc,y:yc, color: hex, contrastRatio });
            const { WCAG_AA, WCAG_AAA } = ccc.verifyContrastRatio(contrastRatio);
            contrastData[lastIndex].push({ x: xc, y: yc, hex, WCAG_AA, WCAG_AAA, contrastRatio });
        }
    }

    return { contrastData, pixelColorAtMarkerPoint };
}

function snapshotLoaded() {
    canvas.height = innerHeight;
    canvas.width = innerWidth;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';

    // // const cctx = canvas.getContext('2d');
    // // cctx.drawImage(dirtyImage, 0, 0, 1, 1, 0, 0, 1, 1); // taint the canvas to prevent malicious website (or framework) from stealing screenshots while color pick runs. To verify, select the canvas element and $0.toDataURL() to see an exception
    // // cctx.drawImage(snapshot, 0, 0, innerWidth, innerHeight);

    ctx.drawImage(
        snapshot,
        0,
        0,
        snapshot.naturalWidth,
        snapshot.naturalHeight,
        0,
        0,
        innerWidth,
        innerHeight
    );

    updateMarkers();
    createOverlap();
    accessibilityBackgroundBoundary = findAccessibilityBackgroundBoundary(_selectedElement,_bgElement);

    chrome.runtime.sendMessage({
        type: UPDATE_CONTRAST_SPECTRUM_GRAPH,
        pixelColorAtMarkerPoint,
        accessibilityBackgroundBoundary,
        fontSize: ccc.fontSize,
        fontWeight: ccc.fontWeight
    });
}

function updateMarkers() {
    _bgElement =
        _colorContrastType !== 'element-border'
            ? findBgElement(_selectedElement)
            : findBgElement(_selectedElement.parentElement);

    const data  = findColorContrastRatios(_bgElement || _selectedElement.ownerDocument.body);
    pixelColorAtMarkerPoint = data.pixelColorAtMarkerPoint;
    _contrastData = data.contrastData;
}

function play(image) {
    shouldRunContrast = 1;
    snapshot.src = image;
}

function clearCanvas() {
    ctx.reset && ctx.reset();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function reset() {
    if (shouldRunContrast === 0) return;
    shouldRunContrast = 0;
    _contrastData = null;
    pixelColorAtMarkerPoint = null;
    accessibilityBackgroundBoundary = null;
    box.removeEventListener('mouseover', handleMouseOver, false);
    box.classList.add('a11y-gradient-box-reset');
    box.innerHTML = '';
    clearCanvas();
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    switch (message.type) {
        case PANEL_INIT:
            //dirtyImage.src = chrome.runtime.getURL('assets/close.png');
            chrome.runtime.sendMessage({ type: PANEL_REGISTER_FRAME, url: window.location.href });
            break;
        case SET_COLOR_CONTRAST:
            console.log('SET_COLOR_CONTRAST', message.value);
            setColorContrastType(message.value);
            chrome.runtime.sendMessage({ type: UPDATE_CONTRAST_COLOR, color: contrastColor });
            break;
        case SET_MARKER_GAP:
            setMarkerGap(message.value);
            break;
        case UPDATE_SHOULD_RUN_CONTRAST:
            const { image } = message;
            if (image) {
                play(image);
            } else {
                reset();
            }
            sendResponse({});
            break;
    }
});

/* 
Webpack changes the name of the function and also is scoped inside an IIFE.
Hence chrome.devtools.inspectedWindow in devtools was not able to call this function 
*/
window.setSelectedElement = setSelectedElement;
