const version = 7;
let _port;

const passMessagesFromDevtoolsToTab = port => {
    _port = port;
    console.log('port', port);
    const sendMessagesToActiveTab = message => {
        chrome.tabs.query(
            {
                currentWindow: true,
                active: true,
            },
            function (tabs) {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, message);
                }
            }
        );
    };

    port.onMessage.addListener(sendMessagesToActiveTab);

    // When a tab is closed, we should remove related listeners
    port.onDisconnect.addListener(function () {
        chrome.runtime.onMessage.removeListener(sendMessagesToDevTools);
    });
};

chrome.runtime.onConnect.addListener(passMessagesFromDevtoolsToTab);

const sendMessagesToDevTools = (message, sender) => {
    _port?.postMessage(message);
};

// Pass content script messages back to devtools
chrome.runtime.onMessage.addListener(sendMessagesToDevTools);
