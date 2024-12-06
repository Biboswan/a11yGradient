import { messageTypes, getPortName } from './common.js';

const { UPDATE_SHOULD_RUN_CONTRAST } = messageTypes;

class PortManager {
    constructor() {
        this.ports = new Map();
        this.windows = new Map();
        this.messageListener = this.handleMessage.bind(this);
        this.portMessageHandlers = new Map();
    }

    addPort(port) {
        const { name } = port;
        this.ports.set(name, port);
        port.onDisconnect.addListener(() => this.handleDisconnect(port));
        port.onMessage.addListener((msg) => this.handlePortMessage(msg, port));
    }

    handleDisconnect(port) {
        const { name } = port;
        this.ports.delete(name);
        this.windows.delete(name);
        port.onMessage.removeListener(this.handlePortMessage);
    }

    // message from devtools 
    async handlePortMessage(message, port) {
        try {
            const { type, value } = message;
            const { name } = port;
            const tabId = parseInt(name.split(':')[1]);

            if (!tabId) {
                throw new Error('Invalid tab ID');
            }

            switch (type) {
                case UPDATE_SHOULD_RUN_CONTRAST:
                    if (value) {
                        await this.captureAndSendTab(tabId, name);
                    } else {
                        await chrome.tabs.sendMessage(tabId, message);
                    }
                    break;
                default:
                    await chrome.tabs.sendMessage(tabId, message);
            }
        } catch (error) {
            console.error('Port message handling failed:', error);
        }
    }

    async captureAndSendTab(tabId, portName) {
        try {
            await chrome.tabs.sendMessage(tabId, {
                type: UPDATE_SHOULD_RUN_CONTRAST,
            });

            const windowId = this.windows.get(portName);
            if (!windowId) {
                throw new Error('Window ID not found');
            }

            const dataUri = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
            if (!dataUri) {
                throw new Error('Failed to capture tab');
            }

            await chrome.tabs.sendMessage(tabId, {
                type: UPDATE_SHOULD_RUN_CONTRAST,
                image: dataUri
            });
        } catch (error) {
            console.error('Tab capture failed:', error);
        }
    }

    // passing message from client to devtools
    async handleMessage(message, sender) {
        try {
            if (!sender?.tab?.id) {
                throw new Error('Invalid sender');
            }

            const portName = getPortName(sender.tab.id);
            this.windows.set(portName, sender.tab.windowId);

            const port = this.ports.get(portName);
            if (port) {
                port.postMessage(message);
            }
        } catch (error) {
            console.error('Message handling failed:', error);
        }
    }

    initialize() {
        chrome.runtime.onConnect.addListener(port => this.addPort(port));
        chrome.runtime.onMessage.addListener((msg, sender) => this.handleMessage(msg, sender));
        chrome.runtime.onSuspend.addListener(() => this.cleanup());
    }

    cleanup() {
        for (const [name, port] of this.ports) {
            this.handleDisconnect(port);
        }
        this.ports.clear();
        this.windows.clear();
        this.portMessageHandlers.clear();
    }
}

const portManager = new PortManager();
portManager.initialize();