/* eslint-disable no-console */
"use strict";

let config;

module.exports = class ETEPL_PauseMilliseconds {
	data;

	constructor(_config, milliseconds) {
		if (!milliseconds) throw new Error("Missing Parameters");

		config = _config;
		this.data = {
			name: "ETEPL_PauseMilliseconds",
			dttm: null,
			milliseconds,
			maxTime: -1
		};
		config.logger.logs.addMessage(config.logger.levels.debug, "Pause Milliseconds", `Accion Added`);
		config.logger.logs.addMessage(config.logger.levels.info, "Pause Milliseconds", `Pause for ${(this.data.milliseconds / 1000).toFixed(2)} seconds`);
		config.logger.logs.addMessage(config.logger.levels.data, "Pause Milliseconds", this.data);
	}

	tick() {
		config.logger.logs.addMessage(config.logger.levels.debug, "Pause Milliseconds", "Tick");
		config.logger.logs.addMessage(config.logger.levels.data, "Pause Milliseconds", this.data);

		const now = new Date();
		if (!this.data.dttm) {
			// Set the time to stop
			this.data.dttm = config.etEpl.addMilliseconds(now, this.data.milliseconds); // ET_TIME

			let msg = `Sleeping until ${this.data.dttm.toLocaleTimeString()} (${config.etEpl.secondsRemaining(this.data.dttm)} seconds)`;
			config.logger.logs.addMessage(config.logger.levels.info, "Pause Milliseconds", msg);
		}

		if (now < this.data.dttm) {
			let msg = `ZZZ until ${this.data.dttm.toISOString()} -- ${config.etEpl.secondsRemaining(this.data.dttm)} seconds)`;
			config.logger.logs.addMessage(config.logger.levels.trace, "Pause Milliseconds", msg);
		} else {
			config.logger.logs.addMessage(config.logger.levels.info, "Pause Milliseconds", `Remove it`);
			this.data.readyToRemove = true;
		}
	}
};
