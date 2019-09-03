/* eslint-disable no-console */
"use strict";

// System files
const electron = require("electron");
const net = electron.net;
const fs = require("fs");
const url = require("url");

// Other files
const ETEPL_PauseCycles = require("./ETEPL_PauseCycles");
const ETEPL_ComputerSetup = require("./ETEPL_ComputerSetup");
const ETEPL_Handshake = require("./ETEPL_Handshake");
const ETEPL_Actions = require("./ETEPL_Actions");
const ETEPL_PauseMilliseconds = require("./ETEPL_PauseMilliseconds");

let config;

module.exports = class ETEPL_Client {
	constructor(_config) {
		config = _config;
		config.etEpl = this;
		// Actions
		config.actions = new ETEPL_Actions(config);
		config.actions.add(new ETEPL_PauseCycles(config, 5));
		// Start...
		this._startClock();

		// Reset testStep
		const electronJson = config.etEpl.readElectronJson();
		electronJson.testStep = 0;
		config.etEpl.writeElectronJson(electronJson);
	}

	_startClock() {
		config.logger.logs.addMessage(config.logger.levels.info, "Start Clock", `Starting master clock. Interval: ${(config.timer.master.value / 1000).toFixed(2)} seconds`); // ET_TIME

		// Schedule future ticks
		// eslint-disable-next-line @lwc/lwc/no-async-operation
		config.actions.clock = setInterval(() => {
			if (config.actions.hasActions()) {
				config.actions.tick();
			} else {
				config.logger.logs.addMessage(config.logger.levels.info, "New Hanshake", `Nothing to do, so let's handshake!`);
				// config.PrintConfig(config, "Handshake");
				config.actions.add(new ETEPL_Handshake(config));
			}
		}, config.timer.master.value); // ET_TIME
	}

	requestWS(reqUrl, method, inputData) {
		// https://electronjs.org/docs/api/net
		// https://electronjs.org/docs/api/client-request
		return new Promise((resolve, reject) => {
			let outputData = "";
			inputData = JSON.stringify(inputData);

			const clientReq = url.parse(reqUrl);
			clientReq.method = method;

			const reqWS = net.request(clientReq);
			if (method === "POST") {
				reqWS.setHeader("Content-Type", "application/json");
				config.logger.logs.addMessage(config.logger.levels.trace, "Web Service", `POST: ${clientReq.path}`);
				config.logger.logs.addMessage(config.logger.levels.data, "Web Service", inputData);
				reqWS.write(inputData);
			} else {
				config.logger.logs.addMessage(config.logger.levels.trace, "Web Service", `GET: ${clientReq.path}`);
			}
			reqWS.on("response", resWS => {
				resWS.setEncoding("utf8");
				resWS.on("data", chunk => {
					outputData += chunk;
				});
				resWS.on("end", () => {
					config.logger.logs.addMessage(config.logger.levels.trace, "Web Service", "Back from server");
					config.logger.logs.addMessage(config.logger.levels.data, "Web Service", outputData);
					let output;
					try {
						output = JSON.parse(outputData);
					} catch (ex) {
						config.electron.mainHelper.handleCriticalError(ex);
						config.logger.logs.addMessage(config.logger.levels.info, "Web Service", `Error converting Output data to JSON`);
						output = { outputData };
					}
					output.statusCode = resWS.statusCode;
					if (resWS.statusCode === 200) {
						resolve(output);
					} else {
						reject(output);
					}
				});
			});
			reqWS.on("error", e => {
				reject(e);
			});
			reqWS.end();
		});
	}

	secondsRemaining(dttm) {
		const now = new Date();
		const msNow = now.getTime();
		const msFuture = dttm.getTime();
		const secDiff = ((msFuture - msNow) / 1000).toFixed(2);
		return secDiff;
	}

	addMilliseconds(dttm, milliseconds) {
		dttm = new Date(dttm);
		dttm.setMilliseconds(dttm.getMilliseconds() + milliseconds);
		return dttm;
	}

	readElectronJson() {
		let electronJson;

		try {
			electronJson = JSON.parse(fs.readFileSync(config.local.electronJson));
		} catch (ex) {
			config.electron.mainHelper.handleCriticalError(ex);
			config.logger.logs.addException(config.logger.levels.fatal, "Read File", ex);
			electronJson = {};
		}
		return electronJson;
	}

	writeElectronJson(data) {
		try {
			fs.writeFileSync(config.local.electronJson, JSON.stringify(data, null, 2));
		} catch (ex) {
			config.electron.mainHelper.handleCriticalError(ex);
			config.logger.logs.addException(config.logger.levels.fatal, "write File", ex);
		}
	}
};
