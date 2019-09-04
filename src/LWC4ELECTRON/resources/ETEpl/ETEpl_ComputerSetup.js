/* eslint-disable no-console */
"use strict";

let config;

module.exports = class ETEPL_ComputerSetup {
	data;
	setupData;

	constructor(_config, setupData) {
		if (!setupData) throw new Error("Missing Parameters");

		config = _config;
		this.data = {
			name: "ETEPL_ComputerSetup",
			maxTime: Math.max(config.timer.callout.value, config.timer.pageLoad.value) // ET_TIME
		};
		this.setupData = setupData;
		config.logger.logs.addMessage(config.logger.levels.info, "Computer Setup", `Accion Added`);
		config.logger.logs.addMessage(config.logger.levels.data, "Computer Setup", this.data);
	}

	handleMessage(message) {
		switch (message.type) {
			case "setup-getData":
				const formTimeout = config.timer.user.value; // ET_TIME
				this.data.abort = config.etEpl.addMilliseconds(new Date(), formTimeout);

				message.data = {
					formTimeout,
					setupData: this.setupData
				};
				break;
			case "setup-setData":
				config.electron.mainHelper.showHideWindow(false);
				const electronJson = this.updateElectronJson(message);
				this.registerComputer(electronJson);

				break;
			default:
				break;
		}
	}

	tick() {
		config.logger.logs.addMessage(config.logger.levels.info, "Computer Setup", "Tick");
		config.logger.logs.addMessage(config.logger.levels.data, "Computer Setup", this.data);

		// Update setupData
		const electronJson = config.etEpl.readElectronJson();
		this.setupData.roomId = electronJson.roomId;
		this.setupData.computerNumber = electronJson.computerNumber;

		if ((this.setupData.resetStrength >= 1 && this.setupData.resetStrength <= 2) || isNaN(this.setupData.computerNumber) || this.setupData.roomId.length !== 18) {
			// Ask for data
			config.logger.logs.addMessage(config.logger.levels.info, "Computer Setup", `Opening the Setup form`);
			config.electron.mainHelper
				.loadPage(config.local.setup)
				.then(newUrl => {
					config.logger.logs.addMessage(config.logger.levels.info, "Computer Setup", `Page Loaded: [${newUrl}]`);
				})
				.catch(err => {
					config.logger.logs.addMessage(config.logger.levels.error, "Computer Setup", `Failed to load page: ${config.local.setup}`);
					config.electron.mainHelper.handleCriticalError(err);
					config.actions.reset();
				});
		} else if (electronJson.computerId) {
			// Computer has been registered.
			that.data.readyToRemove = true;
		} else {
			// Ping the server again
			config.logger.logs.addMessage(config.logger.levels.info, "Computer Setup", `Pinging the server again`);
			this.registerComputer(electronJson);
		}
	}

	updateElectronJson(message) {
		const electronJson = config.etEpl.readElectronJson();
		electronJson.roomId = message.data.roomId;
		electronJson.roomName = message.data.roomName;
		electronJson.computerNumber = message.data.computerNumber;
		if (config.debug.useFakeIPAddress) {
			electronJson.IPAddress = `${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
		}
		config.etEpl.writeElectronJson(electronJson);
		return electronJson;
	}

	registerComputer(electronJson) {
		const that = this;
		config.logger.logs.addMessage(config.logger.levels.info, "Computer Setup", "Call server");
		config.etEpl
			.requestWS(config.pages.register, "POST", electronJson)
			.then(response => {
				config.actions.closePage();
				config.logger.logs.addMessage(config.logger.levels.info, "Computer Setup", "Back from server");

				electronJson = config.etEpl.readElectronJson();
				Object.entries(response.output).forEach((item, index) => {
					electronJson[item[0]] = item[1];
				});
				config.etEpl.writeElectronJson(electronJson);

				that.data.readyToRemove = true;
			})
			.catch(err => {
				config.logger.logs.addMessage(config.logger.levels.fatal, "Computer Setup", `Error on Webservice callout`);
				config.electron.mainHelper.handleCriticalError(err);
				config.actions.reset();
			});
	}
};
