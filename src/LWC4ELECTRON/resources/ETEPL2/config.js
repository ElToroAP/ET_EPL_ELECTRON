/* eslint-disable no-console */
"use strict";

// System files
const fs = require("fs");
const os = require("os");

// Other files
const Logger = require("./Logger");

// eslint-disable-next-line no-undef
module.exports = class Config {
	actions = null;
	debug = null;
	electron = null;
	etEpl = null;
	load = null;
	local = null;
	logger = null;
	os = null;
	pages = null;
	timer = null;

	initializeConfig(rootFolder) {
		const config = this; // This is to get an easy reference to this, and code can be reused without modifying it :-)

		// Which OS?
		config.whichOS(config);

		// Initialize Config
		console.log(`Root Folder: ${rootFolder}`);
		const core = config.readFile(rootFolder, "coreConfig");
		config.local = {};
		config.pages = core.pages;
		config.timer = core.timer;

		// Initialize Debug
		config.debug = config.readFile(rootFolder, "debugConfig");
		config.debug.removeOldLogs = core.removeOldLogs;
		config.debug.interruptWithDialog = core.interruptWithDialog;
		if (config.debug.mode) config.debug.mode = config.debug.mode.toLowerCase();
		if (!config.debug.mode) config.debug.mode = "fatal";

		// Initialize logger
		config.logger = Logger;
		config.logger.folder = `${rootFolder}/logs`;
		config.logger.logs = new config.logger.Logger(config);
		if (!config.logger.levels[config.debug.mode]) config.debug.mode = "fatal";
		return config.logger.logs.prepareLogs();
	}

	finishSettingConfig(rootFolder) {
		const config = this; // This is to get an easy reference to this, and code can be reused without modifying it :-)

		config.PrintConfig(config, "Before");

		// Pages
		config.pages.ping = `${config.pages.pingServer}/handshake`;
		config.pages.register = `${config.pages.pingServer}/register`;
		config.pages.sampleFile = `${config.pages.pingServer}/sampleFile`; // Exam during tests

		// Local Files
		config.local.demo = `file://${rootFolder}/demo.html`;
		config.local.blank = `file://${rootFolder}/blank.html`;
		config.local.bye = `file://${rootFolder}/bye.html`;
		config.local.setup = `file://${rootFolder}/setup.html`;
		config.local.electronJson = `${rootFolder}/data/electron.json`;
		config.local.icon = `${rootFolder}/icons/TrailheadBgNone32.png`;

		// Timer
		config.setTimers(config, config.timer);

		// Debug
		if (!config.debug.openDevTools) config.debug.openDevTools = false;
		if (!("preventQuit" in config.debug)) config.debug.preventQuit = true; // False for testing. True for production!

		config.PrintConfig(config, "After");
	}

	readFile(rootFolder, fileName) {
		let fileContents;

		try {
			const path = `${rootFolder}/data/${fileName}.json`;
			fileContents = JSON.parse(fs.readFileSync(path));
			console.log(`Read file: ${path}`);
		} catch (ex) {
			fileContents = {};
		}
		return fileContents;
	}

	setTimers(config, timers) {
		Object.keys(timers).forEach(key => {
			timers[key].value = config.getMillisecondsFromPattern(config, key, timers[key].pattern);
		});
		config.timer = timers;
	}

	getMillisecondsFromPattern(config, name, pattern) {
		let ms = 0;

		ms += pattern[0] * 60 * 1000; // minutes
		ms += pattern[1] * 1000; // seconds
		ms += pattern[2] * 1; // milliseconds

		config.logger.logs.addMessage(config.logger.levels.debug, "Timers", `${name}: ${pattern[0]} minutes, ${pattern[1]} seconds, ${pattern[2]} milliseconds => ${(ms / 1000).toFixed(2)}`);
		return ms;
	}

	whichOS(config) {
		const platformNames = {
			aix: "AIX",
			android: "ANDROID",
			darwin: "MAC",
			linux: "LINUX",
			openbsd: "OPENBSD",
			sunos: "SUN",
			win32: "WINDOWS"
		};

		// Which OS?
		const OS = {};
		OS.current = platformNames[os.platform()];
		OS.isWin = OS.current === platformNames.win32;
		OS.isMac = OS.current === platformNames.darwin;
		console.log(`OS: [${os.platform()}] => ${OS.current}. Mac? [${OS.isMac}]. Win? [${OS.isWin}]`);
		config.os = OS;
	}

	PrintConfig(config, label) {
		Object.keys(config).forEach(key => {
			if (key !== "logger") {
				if (config[key]) {
					config.logger.logs.addMessage(config.logger.levels.trace, `Config`, key);
					config.logger.logs.addMessage(config.logger.levels.data, `Config`, config[key]);
				}
			}
		});
	}
};
