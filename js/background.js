import { messageTypes, getPortName } from './common.js';

const { UPDATE_SHOULD_RUN_CONTRAST } = messageTypes;

const portName2Port = new Map();
const portName2Window = new Map();

async function doCaptureForTab(tabId, winId) {
    const dataUri = await chrome.tabs.captureVisibleTab(winId, { format: 'png' });
    chrome.tabs.sendMessage(tabId, { type: UPDATE_SHOULD_RUN_CONTRAST, image: dataUri });
}

async function handlePortMessages(message, port) {
    const { type } = message;
    const { name } = port;

    const tabId = parseInt(name.split(':')[1]);

    switch (type) {
        case UPDATE_SHOULD_RUN_CONTRAST:
            if (message.value) {
                //doing reset and clearing previous markers if any before taking new shot;
                await chrome.tabs.sendMessage(tabId, {
                    type: UPDATE_SHOULD_RUN_CONTRAST,
                });
                doCaptureForTab(tabId, portName2Window.get(name));
            } else {
                chrome.tabs.sendMessage(tabId, message);
            }
            break;
        default:
            chrome.tabs.sendMessage(tabId, message);
    }
}

function passMessagesFromDevtoolsToTab(port) {
    const { name } = port;
    portName2Port.set(name, port);
    port.onMessage.addListener((message, port) => handlePortMessages(message, port));

    // When a tab is closed, we should remove related listeners
    port.onDisconnect.addListener(function () {
        console.log('port disconnected!', name);
        portName2Port.delete(name);
        portName2Window.delete(name);
        if (portName2Port.size === 0) {
            chrome.runtime.onMessage.removeListener(sendMessagesToDevTools);
        }
    });
}

chrome.runtime.onConnect.addListener(passMessagesFromDevtoolsToTab);

function sendMessagesToDevTools(message, sender, sendResponse) {
    const portName = getPortName(sender.tab.id);
    console.log('portname', portName);
    portName2Window.set(portName, sender.tab.windowId);
    portName2Port.get(portName)?.postMessage(message);
}

// Pass content script messages back to devtools
chrome.runtime.onMessage.addListener(sendMessagesToDevTools);
