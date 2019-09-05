"use strict";

// System files
const fs = require("fs");
const path = require("path");
const { parse, stringify } = require("flatted/cjs"); // https://github.com/WebReflection/flatted#flatted

let config;

// config.logger.logs.addMessage(config.logger.levels.trace, METHOD, MESSAGE) : Promise<any>;
const Logger = {
	levels: {
		fatal: 8,
		error: 7,
		warn: 6,
		info: 5,
		debug: 4,
		trace: 3,
		stack: 2,
		data: 1
	},
	logs: null,
	folder: null,
	randomSuffix: null,
	Logger: class {
		file;

		constructor(_config) {
			if (!_config) throw new Error("Missing Parameters");

			config = _config;
			this.file = {
				id: 1,
				name: null,
				stream: null
			};

			// Clear old log files
			if (config.debug.removeOldLogs) {
				if (!fs.existsSync(config.logger.folder)) {
					fs.mkdirSync(config.logger.folder);
				}

				fs.readdir(config.logger.folder, (err, files) => {
					if (err) throw err;

					for (const file of files) {
						fs.unlink(path.join(config.logger.folder, file), err => {
							if (err) throw err;
						});
					}
				});
			}
			config.logger.randomSuffix = `.RAND${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}.`;
		}

		prepareLogs() {
			const that = this;

			return new Promise((resolve, reject) => {
				that.getFileStream().on("open", fd => {
					that.addMessage(config.logger.levels.trace, "Logger", "Initializing Logger");
					resolve();
				});
			});
		}

		addException(logLevel, name, ex, tooMany) {
			const that = this;
			if (!ex) throw new Error("Missing Parameters");
			if (tooMany) throw new Error("Too many Parameters");

			if (config.logger.levels[config.debug.mode] <= logLevel) {
				that._add(logLevel, name, that.getLineNumber(), ex.message);
			}
			if (config.logger.levels[config.debug.mode] <= config.logger.levels.trace.stack) {
				that._add(logLevel, name, that.getLineNumber(), ex.stack);
			}
		}

		addMessage(logLevel, name, message, tooMany) {
			const that = this;
			if (!message) throw new Error("Missing Parameters");
			if (tooMany) throw new Error("Too many Parameters");

			if (config.logger.levels[config.debug.mode] <= logLevel) {
				that._add(logLevel, name, that.getLineNumber(), message);
			}
		}

		_add(logLevel, name, lineNumber, message, tooMany) {
			const that = this;
			if (!message) throw new Error("Missing Parameters");
			if (tooMany) throw new Error("Too many Parameters");

			if (config.logger.levels[config.debug.mode] <= logLevel) {
				// Process Data
				const dttm = new Date();
				const data = {
					dttmUTC: dttm.toISOString(),
					dttmLocal: dttm.toLocaleTimeString(),
					name,
					lineNumber,
					logLevel,
					message: "PENDING..."
				};

				// Assign it
				if (typeof message === "string") {
					data.message = message;
				} else {
					try {
						data.message = JSON.stringify(message);
					} catch (ex) {
						data.message = `[JSON.stringify() failed] => ${stringify(message)}`;
					}
				}

				// Clean it
				data.message = data.message.replace(/\t/g, " ");
				data.message = data.message.replace(/\r/g, " ");
				data.message = data.message.replace(/\n/g, " ");
				data.message = data.message.replace(/  +/g, " ");

				// Test it
				if (data.message.indexOf("[object Object]") >= 0) {
					// Find who is producing this.
					// Keep this debugger! - WHY am I here?
					debugger;
				}

				// Write it
				let msg = "";
				msg += `${that.file.id++}\t`;
				msg += `${data.dttmUTC}\t`;
				msg += `${data.dttmLocal}\t`;
				msg += `${String(data.name).padEnd(20, " ")}\t`;
				msg += `${String(data.lineNumber).padEnd(30, " ")}\t`;
				msg += `${that.getLogLevelName(data.logLevel)}\t`;
				msg += `${data.message}\t`;
				that.getFileStream().write(`${msg}\n`);

				switch (data.logLevel) {
					case config.logger.levels.fatal:
					case config.logger.levels.error:
					case config.logger.levels.warn:
						console.error(msg);
						break;
					case config.logger.levels.info:
					case config.logger.levels.debug:
					case config.logger.levels.trace:
					default:
						console.log(msg);
						break;
				}
			}
		}

		// https://nodejs.org/dist/latest-v10.x/docs/api/fs.html#fs_fs_createwritestream_path_options
		getFileStream() {
			// Get file name which is based on a timestamp
			const fileName = this.getFileName();

			// Close previous stream if name changed
			if (this.file.name !== fileName) {
				if (this.file.stream) {
					this.file.stream.end();
					this.file.stream = null;
				}
			}

			if (this.file.stream) {
				// Return existing stream
				return this.file.stream;
			} else {
				// Create a new stream!
				this.file.stream = fs.createWriteStream(`${config.logger.folder}/${fileName}.tab`, { flags: "a" });

				// Write headers
				let msg = "";
				msg += `Id\t`;
				msg += `DTTM_UTC\t`;
				msg += `DTTM_Local\t`;
				msg += `Name\t`;
				msg += `Line_Number\t`;
				msg += `Log_Level\t`;
				msg += `Message\n`;
				this.file.stream.write(msg);
				this.file.name = fileName;

				return this.file.stream;
			}
		}

		getFileName() {
			let fileName = "";
			const now = new Date();

			fileName += `${now.getFullYear()}`;
			fileName += `${String(now.getMonth()).padStart(2, "0")}`;
			fileName += `${String(now.getDate()).padStart(2, "0")}`;
			// fileName += `${String(now.getHours()).padStart(2, "0")}`;
			// fileName += `${String(now.getMinutes()).padStart(2, "0")}`;
			fileName += config.logger.randomSuffix;

			return fileName;
		}

		getLineNumber() {
			let lineNumber;
			let stack = new Error("Stack Trace").stack;
			stack = stack.split("\n");
			while (stack[0] === "Error: Stack Trace" || RegExp(/Logger\./).test(stack[0])) {
				stack.shift();
			}

			lineNumber = stack[0];
			if (config.os.isWin) {
				lineNumber = lineNumber.substr(lineNumber.lastIndexOf("\\") + 1);
			} else {
				lineNumber = lineNumber.substr(lineNumber.lastIndexOf("/") + 1);
			}
			lineNumber = lineNumber.substr(0, lineNumber.length - 1);
			lineNumber = lineNumber.substr(0, lineNumber.lastIndexOf(":"));
			return lineNumber;
		}

		getLogLevelName(logLevel) {
			let logLevenName = "UNKNOWN";
			Object.keys(config.logger.levels).forEach(key => {
				if (config.logger.levels[key] === logLevel) {
					logLevenName = key;
				}
			});
			return logLevenName;
		}
	}
};

module.exports = Logger;
