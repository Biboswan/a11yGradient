import { messageTypes, getPortName } from './common.js';

const {
    PANEL_INIT,
    PANEL_REGISTER_FRAME,
    UPDATE_SELECTED_ELEMENT,
    SET_COLOR_CONTRAST,
    UPDATE_CONTRAST_COLOR,
    SET_MARKER_GAP,
    UPDATE_SHOULD_RUN_CONTRAST,
    UPDATE_MARKER_HOVERED,
} = messageTypes;

let port, tabId;
let selectionChangedListeners = new Set();
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

chrome.devtools.panels.create(
    'A11y Gradient',
    '../assets/logo/icon16.png',
    'html/devtools.html',
    onPanelCreate
);

// Cache DOM elements
const elements = {
    bgColor: document.querySelector('#hovered-bgColor'),
    cr: document.querySelector('#hovered-contrast-ratio'),
    hoverAA: document.querySelector('#hovered-aa'),
    hoverAAA: document.querySelector('#hovered-aaa'),
    markerInput: document.querySelector('.marker-input'),
    colorContrastRadio: document.querySelector('#color-contrast-radioContainer'),
    resetButton: document.querySelector('.reset'),
    playButton: document.querySelector('.play')
};

async function getCurrentTab() {
    const queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    const [tab] = await chrome.tabs.query(queryOptions);

    return tab;
}

function cleanupPort() {
    if (port) {
        port.onMessage.removeListener(handlePortMessage);
        port.disconnect();
        port = null;
    }
}

function handlePortMessage(msg) {
    switch (msg.type) {
        case PANEL_REGISTER_FRAME: {
            const onSelectionChanged = () => setSelectedElement(msg.url);
            chrome.devtools.panels.elements.onSelectionChanged.addListener(onSelectionChanged);
            selectionChangedListeners.add(onSelectionChanged);
            setSelectedElement(msg.url);
            break;
        }

        case UPDATE_SELECTED_ELEMENT: {
            const { selectedElement, color } = msg;
            updateElementSelected(selectedElement);
            updateContrastColor(color);
            break;
        }

        case UPDATE_CONTRAST_COLOR: {
            const { color } = msg;
            updateContrastColor(color);
            break;
        }

        case UPDATE_MARKER_HOVERED: {
            const { hex, WCAG_AA, WCAG_AAA, contrastRatio } = msg;
            updateMarkerHovered(hex, WCAG_AA, WCAG_AAA, contrastRatio);
        }
    }
}

function connectPort() {
    port = chrome.runtime.connect({ name: getPortName(tabId) });
    
    port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error('Port disconnected permanently');
            return;
        }
        reconnectAttempts++;
        setTimeout(connectPort, 1000 * reconnectAttempts); // Exponential backoff
    });

    port.onMessage.addListener(handlePortMessage);

    // Announce to content.js that they should register with their frame urls.
    port.postMessage({ type: PANEL_INIT });
}

async function onPanelCreate() {
    cleanupPort();
    
    tabId = (await getCurrentTab())?.id;
    if (!tabId) {
        console.error('No active tab found');
        return;
    }

    connectPort();
}

function updateMarkerHovered(hex, WCAG_AA, WCAG_AAA, contrastRatio) {
    elements.bgColor.style.backgroundColor = `#${hex}`;
    elements.cr.innerText = contrastRatio;
    elements.hoverAA.innerHTML = `<img src="${chrome.runtime.getURL('assets/icons/' + (WCAG_AA ? 'check.svg' : 'times.svg'))}"/>`;
    elements.hoverAAA.innerHTML = `<img src="${chrome.runtime.getURL('assets/icons/' + (WCAG_AAA ? 'check.svg' : 'times.svg'))}"/>`;
}

function updateElementSelected(node) {
    const elementDetails = document.querySelector('.element-selected');
    const closingTagIndex = node.indexOf('>');
    elementDetails.querySelector('summary').innerText = node.substr(0, closingTagIndex + 1);
    elementDetails.querySelector('p').innerText = node.substring(closingTagIndex + 1);
}

function updateContrastColor(color) {
    const container = document.querySelector('.contrast-color-display-container');
    const displayBox = document.querySelector('#contrast-color-display');
    const displayBoxLabel = document.querySelector('#contrast-color-display-label');
    displayBox.style.backgroundColor = color;
    displayBoxLabel.innerText = color;
    container.style.display = 'flex';
}

function handleChangeContrastAgainst(e) {
    port.postMessage({ type: SET_COLOR_CONTRAST, value: e.target.value });
}

function handleReset(e) {
    elements.bgColor.style.backgroundColor = 'transparent';
    elements.cr.innerHTML = '';
    elements.hoverAA.innerHTML = '';
    elements.hoverAAA.innerHTML = '';
    port.postMessage({ type: UPDATE_SHOULD_RUN_CONTRAST, value: false });
}

function handlePlay(e) {
    port.postMessage({ type: UPDATE_SHOULD_RUN_CONTRAST, value: true });
}

function handleMarker(e) {
    const { value } = e.target;

    port.postMessage({ type: SET_MARKER_GAP, value });
}

function setSelectedElement(url) {
    chrome.devtools.inspectedWindow.eval(
        'setSelectedElement($0)',
        {
            useContentScriptContext: true,
            frameURL: url,
        },
        (err, info) => {
            err && console.error('err', err);
            info && console.log('info', info);
        }
    );
}

// Cleanup function to remove all listeners
function cleanup() {
    cleanupPort();
    selectionChangedListeners.forEach(listener => {
        chrome.devtools.panels.elements.onSelectionChanged.removeListener(listener);
    });
    selectionChangedListeners.clear();
    
    elements.markerInput?.removeEventListener('change', handleMarker);
    elements.colorContrastRadio?.removeEventListener('change', handleChangeContrastAgainst);
    elements.resetButton?.removeEventListener('click', handleReset);
    elements.playButton?.removeEventListener('click', handlePlay);

    elements = null;
    tabId = null;
}

window.addEventListener('unload', cleanup);

window.addEventListener('DOMContentLoaded', () => {
    elements.markerInput?.addEventListener('change', handleMarker);
    elements.colorContrastRadio?.addEventListener('change', handleChangeContrastAgainst);
    elements.resetButton?.addEventListener('click', handleReset);
    elements.playButton?.addEventListener('click', handlePlay);
});
