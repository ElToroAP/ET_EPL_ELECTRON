/* eslint-disable no-console */
"use strict";

let config;

module.exports = class ETEPL_PauseCycles {
	data;

	constructor(_config, cycles) {
		if (!cycles) throw new Error("Missing Parameters");

		config = _config;
		this.data = {
			name: "ETEPL_PauseCycles",
			cycles,
			maxTime: -1
		};
		config.logger.logs.addMessage(config.logger.levels.debug, "Pause Cycles", `Accion Added`);
		config.logger.logs.addMessage(config.logger.levels.info, "Pause Cycles", `Pause for ${this.data.cycles} cycles`);
		config.logger.logs.addMessage(config.logger.levels.data, "Pause Cycles", this.data);
	}

	tick() {
		config.logger.logs.addMessage(config.logger.levels.debug, "Pause Cycles", "Tick");
		config.logger.logs.addMessage(config.logger.levels.data, "Pause Cycles", this.data);

		this.data.cycles--;
		if (this.data.cycles > 0) {
			config.logger.logs.addMessage(config.logger.levels.trace, "Pause Cycles", `ZZZ for ${this.data.cycles} cycles`);
		} else {
			config.logger.logs.addMessage(config.logger.levels.info, "Pause Cycles", `Done!`);
			this.data.readyToRemove = true;
		}
	}
};
