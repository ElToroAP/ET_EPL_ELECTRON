/* eslint-disable no-console */
"use strict";

let config;

module.exports = class ETEPL_ShowHide {
	data;

	constructor(_config, showHideData) {
		if (!showHideData) throw new Error("Missing Parameters");

		// Initialize action
		config = _config;
		this.data = {
			name: "ETEPL_ShowHide",
			loaded: false,
			isShow: showHideData.isShow,
			newUrl: showHideData.newUrl,
			maxTime: config.timer.pageLoad.value // ET_TIME
		};

		// Report it
		config.logger.logs.addMessage(config.logger.levels.info, "Show/Hide", `Accion Added`);
		config.logger.logs.addMessage(config.logger.levels.data, "Show/Hide", this.data);
	}

	handleMessage(message) {
		this.data.readyToRemove = true;
	}

	tick() {
		config.logger.logs.addMessage(config.logger.levels.debug, "Show/Hide", "Tick");
		config.logger.logs.addMessage(config.logger.levels.data, "Show/Hide", this.data);

		if (!this.data.loaded) {
			if (this.data.isShow) {
				config.electron.mainHelper.loadPage(this.data.newUrl, true);
				this.data.loaded = true;
			} else {
				config.electron.mainHelper.loadPage(config.pages.trailhead, false);
			}
		}
	}
};
