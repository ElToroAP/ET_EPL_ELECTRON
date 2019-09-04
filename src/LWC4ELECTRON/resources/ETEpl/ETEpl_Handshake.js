/* eslint-disable no-console */
"use strict";

// Other files
const ETEPL_PauseMilliseconds = require("./ETEPL_PauseMilliseconds");
const ETEPL_ComputerSetup = require("./ETEPL_ComputerSetup");
const ETEPL_ComputerLogin = require("./ETEPL_ComputerLogin");

let config;

module.exports = class ETEPL_Handshake {
	data;

	constructor(_config) {
		if (!_config) throw new Error("Missing Parameters");

		config = _config;
		this.data = {
			name: "ETEPL_Handshake",
			maxTime: config.timer.callout.value // ET_TIME
		};
		config.logger.logs.addMessage(config.logger.levels.info, "Handshake", `Accion Added`);
		config.logger.logs.addMessage(config.logger.levels.data, "Handshake", this.data);
	}

	tick() {
		const that = this;
		let electronJson = config.etEpl.readElectronJson();

		config.logger.logs.addMessage(config.logger.levels.debug, "Handshake", "Tick");
		config.logger.logs.addMessage(config.logger.levels.data, "Handshake", this.data);
		config.logger.logs.addMessage(config.logger.levels.info, "Handshake", "Call server");

		config.etEpl
			.requestWS(config.pages.ping, "POST", electronJson)
			.then(response => {
				config.logger.logs.addMessage(config.logger.levels.info, "Handshake", `Back from server. Action: ${response.output.action}`);
				// if (response.TMP) {
				// 	config.logger.logs.addMessage(config.logger.levels.fatal, "Handshake", "Debug is being produced by server, show it!");
				// 	config.logger.logs.addMessage(config.logger.levels.fatal, "Handshake (INPUT)", response.input);
				// 	config.logger.logs.addMessage(config.logger.levels.fatal, "Handshake (OUTPUT)", response.output);
				// 	config.logger.logs.addMessage(config.logger.levels.fatal, "Handshake (TMP)", response.TMP);
				// 	console.dir(response);
				// }
				config.setTimers(config, response.timers);
				switch (response.output.action) {
					case "ABORT":
						// Critical error, application must be killed.
						config.logger.logs.addMessage(config.logger.levels.fatal, "Handshake", "Quiting Application");
						config.logger.logs.addMessage(config.logger.levels.data, "Handshake", response.output.message);
						config.electron.preventQuit = false;
						config.electron.app.quit();
						break;
					case "SAVE":
						config.logger.logs.addMessage(config.logger.levels.info, "Handshake", "SAVE requested by server");
						config.logger.logs.addMessage(config.logger.levels.data, "Handshake", response.output.file);
						config.etEpl.writeElectronJson(response.output.file);
						config.actions.add(new ETEPL_PauseMilliseconds(config, config.timer.breathe.value)); // ET_TIME
						that.data.readyToRemove = true;
						break;
					case "RESET":
						// In the next cycle, perform a handhake with the electron.json file provided by the server
						config.logger.logs.addMessage(config.logger.levels.info, "Handshake", "RESET requested by server");
						config.logger.logs.addMessage(config.logger.levels.data, "Handshake", response.output.file);
						config.etEpl.writeElectronJson(response.output.file);
						config.actions.add(new ETEPL_PauseMilliseconds(config, config.timer.breathe.value)); // ET_TIME
						that.data.readyToRemove = true;
						break;
					case "SETUP":
						config.logger.logs.addMessage(config.logger.levels.info, "Handshake", "SETUP requested by server");
						if (electronJson.resetStrength > 0) {
							config.actions.add(new ETEPL_ComputerSetup(config, { ...response.output, ...electronJson }));
						} else {
							if (electronJson.computerId) {
								config.logger.logs.addMessage(config.logger.levels.info, "Handshake", `SETUP skippped because I have ComputerId=${electronJson.computerId}`);
								electronJson.forceReset = null;
								config.etEpl.writeElectronJson(electronJson);
							} else {
								config.logger.logs.addMessage(config.logger.levels.info, "Handshake", "SETUP will be performed");
								config.actions.add(new ETEPL_PauseMilliseconds(config, config.timer.breathe.value)); // ET_TIME
								config.actions.add(new ETEPL_ComputerSetup(config, response.output));
							}
						}
						that.data.readyToRemove = true;
						break;
					case "LOGIN":
						config.logger.logs.addMessage(config.logger.levels.info, "Handshake", "LOGIN requested by server");
						config.actions.add(new ETEPL_PauseMilliseconds(config, config.timer.breathe.value)); // ET_TIME
						config.actions.add(new ETEPL_ComputerLogin(config, response.output));
						that.data.readyToRemove = true;
						break;
					case "SLEEP":
						config.logger.logs.addMessage(config.logger.levels.info, "Handshake", "SLEEP requested by server");
						let ms = config.getMillisecondsFromPattern(config, "Handshake", JSON.parse(response.output.pattern));
						config.actions.add(new ETEPL_PauseMilliseconds(config, ms)); // ET_TIME
						that.data.readyToRemove = true;
						break;
					default:
						break;
				}
			})
			.catch(err => {
				config.logger.logs.addMessage(config.logger.levels.fatal, "Handshake", `Error on Webservice callout`);
				config.electron.mainHelper.handleCriticalError(err);
				config.actions.reset();
			});
	}
};
