"use strict";

/* Linter overrides */
/* eslint-disable no-console */
/* eslint-disable no-undef */

// ElectronJS Library
const electron = require("electron");
const Tray = electron.Tray;
const Menu = electron.Menu;
const dialog = electron.dialog;
const ipcMain = electron.ipcMain;
const nativeImage = electron.nativeImage;
const BrowserWindow = electron.BrowserWindow;

// Other libraries
const ETEPL_Client = require("./ETEpl/ETEPL_Client");
const Config = require("./ETEpl/config");

// Other static variables
let config;

module.exports = class ELMainHelper {
	constructor(app) {
		const that = this;

		// Create config settings
		config = new Config();
		config.initializeConfig(__dirname).then(() => {
			config.finishSettingConfig(__dirname);

			// Initialize Electron app
			config.electron = {};
			config.electron.app = app;
			config.electron.mainHelper = that;
			config.electron.dialogOpen = false;
			config.electron.preventQuit = config.debug.preventQuit;

			// Create UI
			config.electron.mainHelper.createWindow();
			config.electron.mainHelper.createTray();

			ipcMain.on("startApp", () => {
				config.electron.preventQuit = config.debug.preventQuit;
			});

			// ipcMain.on("quitApp", () => {
			// 	config.electron.preventQuit = false;
			// 	config.electron.app.quit();
			// });

			ipcMain.on("toMain", (event, message) => {
				// Message from UI received
				config.actions.handleMessage(message);
				if (message.callBackId) {
					event.sender.send("fromMain", message);
				}
			});

			config.electron.mainWindow.webContents.on("devtools-opened", () => {
				// Do not loose focus when devtools open
				setImmediate(function() {
					config.electron.mainWindow.focus();
				});
			});

			if (config.etEpl) {
				config.electron.mainHelper.handleCriticalError("There should only be one instance of this class");
			}
			config.etEpl = new ETEPL_Client(config);
		});
	}

	createWindow() {
		// Main window
		config.electron.mainWindow = new BrowserWindow({
			x: 0,
			y: 0,
			width: 800,
			height: 600,
			webPreferences: {
				// Prevents renderer process code from not running when window is hidden
				backgroundThrottling: false,
				nodeIntegration: true
			},

			minimizable: true,
			fullscreenable: false, // Mac OSX would use a new Desktop
			skipTaskbar: true
		});
		config.electron.mainHelper.loadPage(config.pages.trailhead, false);
		config.electron.mainHelper.showHideWindow(false);

		// Events
		config.electron.mainWindow.on("close", event => {
			config.electron.mainHelper.onMainWindowClose(event);
		});

		config.electron.mainWindow.on("closed", () => {
			config.electron.mainHelper.onMainWindowClosed();
		});

		config.electron.mainWindow.webContents.on("did-navigate", config.electron.mainHelper.onDidNavigate);
	}

	createTray() {
		const trayIcon = nativeImage.createFromPath(config.local.icon);
		config.electron.tray = new Tray(trayIcon);
		config.electron.tray.setToolTip("Trailhead Internet Tester");

		config.electron.tray.on("click", () => {
			const isVisible = config.electron.mainWindow.isVisible();
			if (isVisible) {
				config.electron.mainHelper.showHideWindow(false);
			} else {
				config.electron.mainHelper.loadPage(config.pages.trailhead);
			}
		});

		config.electron.tray.on("right-click", () => {
			config.electron.trayMenu = Menu.buildFromTemplate(config.electron.mainHelper.createTrayMenu());
			config.electron.tray.popUpContextMenu(config.electron.trayMenu);
		});
	}

	createTrayMenu() {
		const trayMenu = [];

		// Trailhead Home
		trayMenu.push({
			label: "Trailhead Home",
			click: (/* menuItem, browserWindow, event */) => {
				config.electron.mainHelper.loadPage(config.pages.trailhead);
			}
		});

		// Webassessor
		trayMenu.push({
			label: "Webassessor",
			click: (/* menuItem, browserWindow, event */) => {
				config.electron.mainHelper.loadPage(config.pages.webassessorPage);
			}
		});

		// Setup Page
		trayMenu.push({
			label: "Setup Page",
			submenu: [
				{
					label: "Open",
					click: () => {
						config.electron.mainHelper.loadPage(config.local.setup);
					}
				},
				{
					label: "Ping",
					click: () => {
						config.electron.mainWindow.webContents.send("ping", { data: "Hello World" });
					}
				}
			]
		});

		// Demo Page
		trayMenu.push({
			label: "Demo Page",
			click: () => {
				config.electron.mainHelper.loadPage(config.local.demo);
			}
		});

		// Chrome Developer tools
		if (config.debug.openDevTools) {
			trayMenu.push({
				label: "Developer Tools",
				click: () => {
					config.electron.mainWindow.webContents.openDevTools();
				}
			});
		}

		// Check speed
		trayMenu.push({
			label: "Check speed",
			click: (/* menuItem, browserWindow, event */) => {
				dialog.showErrorBox(`Not Implemented yet`, `Need to implement this!`);
			}
		});

		// Quit
		trayMenu.push({
			label: "Quit",
			submenu: [
				{
					label: "Quit",
					click: () => {
						config.electron.app.quit();
					}
				},
				{
					label: "Force Quit",
					click: () => {
						config.electron.preventQuit = false;
						config.electron.app.quit();
					}
				}
			]
		});

		return trayMenu;
	}

	loadPage(newUrl, isShow = true) {
		return new Promise((resolve, reject) => {
			config.electron.mainHelper.showHideWindow(isShow);
			if (config.electron.url === newUrl) {
				resolve(newUrl);
			} else {
				if (!config.load) config.load = {};
				config.load[newUrl] = { resolve, reject };
				config.electron.mainWindow.loadURL(newUrl);
			}
		});
	}

	onDidNavigate(event, newUrl, httpResponseCode, httpStatusText) {
		config.logger.logs.addMessage(config.logger.levels.info, "Navigated", `Page loaded: [HTTP ${httpResponseCode}: ${httpStatusText}] ${newUrl}`);
		config.electron.url = newUrl;

		if (config.debug.openDevTools) {
			config.electron.mainWindow.webContents.openDevTools();
		}

		const p = config.load[newUrl];
		if (p && p.resolve) {
			delete config.load[newUrl];
			p.resolve(newUrl);
		} else {
			config.actions.handleMessage({ type: "PageLoad", newUrl });
		}
	}

	showHideWindow(isShow) {
		if (config.os.isMac) {
			const osxDock = config.electron.app.dock;
			if (isShow) {
				if (!osxDock.isVisible()) osxDock.show();
			} else {
				if (osxDock.isVisible()) osxDock.hide();
			}
		}

		if (isShow) {
			config.electron.mainWindow.show();
			config.electron.mainWindow.maximize();
			config.electron.mainWindow.focus();
			config.electron.mainWindow.setPosition(0, 0);
			config.electron.mainWindow.setFullScreen(true);
			config.electron.mainWindow.setAlwaysOnTop(true);
			// config.electron.mainWindow.setKiosk(true);
		} else {
			config.electron.mainWindow.hide();
			config.electron.mainWindow.setFullScreen(false);
			config.electron.mainWindow.setAlwaysOnTop(false);
			// config.electron.mainWindow.setKiosk(false);
			// config.electron.mainWindow.minimize();
		}
	}

	onMainWindowClose(event) {
		if (config.electron.preventQuit) {
			event.preventDefault();
			config.electron.mainHelper.showHideWindow(false);
		}
	}

	onMainWindowClosed() {
		if (config.electron.preventQuit) {
			dialog.showMessageBoxSync(config.electron.mainWindow, {
				type: "error",
				buttons: ["OK"],
				title: `CLosing?`,
				message: `The window can't be closed!`
			});
			config.electron.mainHelper.handleCriticalError("You should not close the window");
		} else {
			// // Emitted when the window is closed.
			config.electron.mainWindow = null;
		}
	}

	// config.electron.mainHelper.handleCriticalError(ex | "msg")
	handleCriticalError(msg) {
		if (msg.message && msg.stack) {
			config.logger.logs.addException(config.logger.levels.fatal, "ERROR", msg);
			config.electron.mainHelper.handleCriticalError_ShowMsgBox(`${msg.message} @ ${msg.stack}`);
		} else {
			let stack = "<STACK TRACE GOES HERE>";
			try {
				throw new Error("Stack Trace");
			} catch (ex) {
				stack = ex.stack.split("\n");
				while (stack[0] === "Error: Stack Trace" || RegExp(/ELMainHelper\.(|_)handleCritical/).test(stack[0])) {
					stack.shift();
				}
			}
			config.logger.logs.addMessage(config.logger.levels.fatal, "ERROR", msg);
			config.logger.logs.addMessage(config.logger.levels.stack, "ERROR", `${stack}`);
			config.electron.mainHelper.handleCriticalError_ShowMsgBox(`${ex} @ ${stack}`);
		}
	}

	handleCriticalError_ShowMsgBox(msg) {
		// Do not interrupt students!
		if (config.debug.interruptWithDialog) {
			config.electron.dialogOpen = true;
			dialog.showErrorBox(`Critical Error`, msg);
			config.electron.dialogOpen = false;
		} else {
			debugger;
		}
	}
};
