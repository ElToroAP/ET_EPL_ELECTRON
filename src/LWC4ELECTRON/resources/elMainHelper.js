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
const session = electron.session;
const nativeImage = electron.nativeImage;
const BrowserWindow = electron.BrowserWindow;

// Other libraries
const ETEPL_Client = require("./ETEPL2/ETEPL_Client");
const Config = require("./ETEPL2/config");
const child_process = require("child_process");

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
			const appName = "Trailhead internet tester";
			const appIcon = nativeImage.createFromPath(config.local.icon);
			config.electron.mainHelper.createWindow(appName, appIcon);
			config.electron.mainHelper.createTray(appName, appIcon);

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

	createWindow(appName, appIcon) {
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
			icon: appIcon,
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
		session.defaultSession.on("will-download", config.electron.mainHelper.downloadfile);
	}

	createTray(appName, appIcon) {
		config.electron.tray = new Tray(appIcon);
		config.electron.tray.setToolTip(appName);

		config.electron.tray.on("click", () => {
			const isVisible = config.electron.mainWindow.isVisible();
			if (isVisible) {
				config.electron.mainHelper.showHideWindow(false);
			} else {
				let urlOnclick = config.electron.url ? config.electron.url : config.pages.trailhead;
				// For tests... urlOnclick = config.local.setup;
				config.electron.mainHelper.loadPage(urlOnclick);
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

		// Check speed
		trayMenu.push({
			label: "Check speed",
			click: (/* menuItem, browserWindow, event */) => {
				config.electron.mainHelper.loadPage("https://www.google.com/search?q=google+speed+test");
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

		if (config.debug.fullMenus) {
			// Download Test
			trayMenu.push({
				label: "Download Test",
				click: (/* menuItem, browserWindow, event */) => {
					config.electron.mainHelper.loadPage(config.pages.sampleFile);
				}
			});

			// Quit
			trayMenu.push({
				label: "Quit",
				click: () => {
					config.electron.preventQuit = false;
					config.electron.app.quit();
				}
			});
		}

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

	downloadfile(event, downloadItem, webContents) {
		// https://electronjs.org/docs/api/session
		// https://electronjs.org/docs/api/download-item
		downloadItem.on("done", (event, state) => {
			switch (state) {
				case "completed":
					// Execute
					let cmd = "";
					let examStarted = false;

					if (config.os.isMac) {
						cmd = `open ${downloadItem.getSavePath()}`;
					} else {
						cmd = `start ${downloadItem.getSavePath()}`;
					}

					while (!examStarted) {
						try {
							child_process.execSync(cmd);
							const electronJson = config.etEpl.readElectronJson();
							delete electronJson.forcedLogin;
							config.etEpl.writeElectronJson(electronJson);

							// EXAM HAS SARTED!!!
							examStarted = true;
						} catch (ex) {
							if (config.os.isMac) {
								// The exam is not for Mac :-)
								examStarted = true;
							} else {
								dialog.showErrorBox(`Critical Error`, `You must accept to run the exam!`);
							}
						}
					}
					config.electron.mainHelper.showHideWindow(false);
					break;
				case "cancelled":
					break;
				case "interrupted":
					break;
				default:
					break;
			}
		});
	}

	onDidNavigate(event, newUrl, httpResponseCode, httpStatusText) {
		// let isExam = false;
		// isExam = isExam || newUrl.substr(0, newUrl.indexOf("?") + 1) === "https://www.webassessor.com/hta.do?";
		// isExam = isExam || (newUrl.substr(0, 7) === "file://" && newUrl.substring(newUrl.lastIndexOf(".")) === ".hta");
		// if (isExam) {
		// 	// Execute
		// 	let cmd = "";
		// 	let examStarted = false;

		// 	if (config.os.isMac) {
		// 		cmd = `open ${newUrl}`;
		// 	} else {
		// 		cmd = `start ${newUrl}`;
		// 	}

		// 	while (!examStarted) {
		// 		try {
		// 			child_process.execSync(cmd);
		// 			// EXAM HAS SARTED!!!
		// 			examStarted = true;
		// 		} catch (ex) {
		// 			dialog.showErrorBox(`Critical Error`, `You must accept to run the exam!`);
		// 		}
		// 	}

		// 	// Go back to previous page
		// 	// setTimeout(() => {
		// 	config.electron.mainWindow.loadURL(config.electron.url);
		// 	// }, 250);
		// } else {
		config.logger.logs.addMessage(config.logger.levels.info, "Navigated", `Page loaded: [HTTP ${httpResponseCode}: ${httpStatusText}] ${newUrl}`);
		config.electron.url = newUrl;

		if (config.debug.openDevTools) {
			config.electron.mainWindow.webContents.openDevTools();
		}

		const p = config.load[newUrl];
		if (p && p.resolve) {
			delete config.load[newUrl];
			p.resolve(newUrl);
		}
		config.actions.handleMessage({ type: "PageLoad", newUrl });
		// }
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
			config.electron.mainWindow.setSkipTaskbar(false);
			setTimeout(() => {
				config.electron.mainWindow.setAlwaysOnTop(false);
			}, 250);
		} else {
			config.electron.mainWindow.hide();
			config.electron.mainWindow.setFullScreen(false);
			config.electron.mainWindow.setAlwaysOnTop(false);
			config.electron.mainWindow.setSkipTaskbar(true);
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
			config.electron.mainHelper.handleCriticalError_ShowMsgBox(`${msg} @ ${stack}`);
		}
	}

	handleCriticalError_ShowMsgBox(msg) {
		// Do not interrupt students!
		if (config.debug.interruptWithDialog) {
			config.electron.dialogOpen = true;
			dialog.showErrorBox(`Critical Error`, msg);
			config.electron.dialogOpen = false;
		} else {
			// Keep this debugger! - WHY am I here?
			debugger;
		}
	}
};
