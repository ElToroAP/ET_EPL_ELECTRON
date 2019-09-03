/* eslint-disable no-console */
"use strict";

// Other files
const ETEPL_PauseMilliseconds = require("./ETEPL_PauseMilliseconds");

let config;

module.exports = class ETEPL_Actions {
	fifo = [];
	clock = null;
	testPingData = { counter: 0 };

	constructor(_config) {
		if (!_config) throw new Error("Missing Parameters");

		config = _config;
		config.actions = this;
		config.actions.fifo = [];
	}

	add(action) {
		action.data.abort = null;
		action.data.readyToRemove = false;
		config.actions.fifo.push(action);
	}

	hasActions() {
		return this.fifo.length > 0;
	}

	closePage() {
		config.electron.mainHelper.loadPage(config.pages.trailhead, false);
	}

	reset() {
		config.actions.fifo = [];
		config.actions.closePage();
		// Reset testStep
		const electronJson = config.etEpl.readElectronJson();
		electronJson.testStep = 0;
		config.etEpl.writeElectronJson(electronJson);
		config.actions.add(new ETEPL_PauseMilliseconds(config, config.timer.reset.value)); // ET_TIME
	}

	handleMessage(message) {
		// Handle message from UI
		try {
			const currentAction = config.actions.fifo[0];
			config.logger.logs.addMessage(config.logger.levels.info, "Handle Message", `Message for ${currentAction.data.name}`);
			config.logger.logs.addMessage(config.logger.levels.data, "Handle Message", message);
			if (currentAction.handleMessage) currentAction.handleMessage(message);
		} catch (ex) {
			// Nothing, ignore it!
		}
	}

	tick() {
		try {
			this.testPing();

			if (config.electron.dialogOpen) {
				config.logger.logs.addMessage(config.logger.levels.trace, "Master Tick", `Skip action: ${action.data.name} (dialog open)`);
				config.logger.logs.addMessage(config.logger.levels.data, "Master Tick (Skip)", action.data);
			} else {
				const action = config.actions.fifo[0];
				config.logger.logs.addMessage(config.logger.levels.trace, "Master Tick", `Tick for ${action.data.name}`);
				config.logger.logs.addMessage(config.logger.levels.data, "Master Tick", action.data);

				if (action.data.readyToRemove) {
					// Waste one cycle, but better to do so than to miss a beat and get lost in time :-)
					config.logger.logs.addMessage(config.logger.levels.trace, "Master Tick", `Cycle wasted`);
					config.actions.fifo.shift();
				} else if (action.data.maxTime === -1) {
					// Can't be aborted, so just do it!
					config.logger.logs.addMessage(config.logger.levels.trace, "Master Tick", `Must perform action`);
					action.tick(action);
				} else if (!action.data.abort) {
					// Has not started, so do it now.
					config.logger.logs.addMessage(config.logger.levels.trace, "Master Tick", `Start action`);
					action.data.abort = config.etEpl.addMilliseconds(new Date(), action.data.maxTime);
					action.tick(action);
				} else if (new Date() < action.data.abort) {
					// I'll wait just a bit more...
					config.logger.logs.addMessage(
						config.logger.levels.trace,
						"Master Tick",
						`Waiting for ${action.data.name}. Aborting in ${config.etEpl.secondsRemaining(action.data.abort)} seconds`
					);
				} else if (new Date() > action.data.abort) {
					// Must kill it now!
					config.logger.logs.addMessage(
						config.logger.levels.error,
						"Master Tick",
						`ABORT "${action.data.name}" now! It expired at ${action.data.abort.toISOString()} (${action.data.abort.toLocaleTimeString()})`
					);
					config.actions.reset();
				} else {
					// WHY am I here?
					debugger;
				}
			}
		} catch (ex) {
			config.electron.mainHelper.handleCriticalError(ex);
		}
	}

	testPing() {
		// To turn it on, set the "config.debug.testPings" value in the debug file (-1: Disabled, #: How many cycles to wait).
		if (config.debug.testPings > 0) {
			if (config.electron.dialogOpen) {
				config.logger.logs.addMessage(config.logger.levels.trace, "Test Ping", `Skip action: Test Ping (dialog open)`);
			} else {
				this.testPingData.counter--;
				if (this.testPingData.counter <= 0) {
					this.testPingData.counter = config.debug.testPings;
					config.etEpl
						.requestWS(config.pages.ping, "POST", { eventId: "TEST_PING" })
						.then(response => {
							config.logger.logs.addMessage(config.logger.levels.trace, "Test Ping", `Reply => ${response.serverDTTM}`);
						})
						.catch(err => {
							config.logger.logs.addMessage(config.logger.levels.fatal, "Test Ping", `Error on Webservice callout`);
							config.electron.mainHelper.handleCriticalError(err);
						});
				} else {
					config.logger.logs.addMessage(config.logger.levels.trace, "Test Ping", `Skip ${this.testPingData.counter} of ${config.debug.testPings}`);
				}
			}
		} else {
			// Nothing!
		}
	}
};
