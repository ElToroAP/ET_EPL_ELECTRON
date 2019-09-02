// ElectronJS library
const electron = require("electron");
const app = electron.app;

// My library (written in LWC project)
const ELMainHelper = require("./LWC4ELECTRON/resources/elMainHelper");

app.on("ready", () => {
	// console.log(`*** *** PERF: Before constructor ${new Date()}`);
	new ELMainHelper(app);
	// console.log(`*** *** PERF: After constructor ${new Date()}`);
});

// console.log(`*** *** PERF: Main thread loaded ${new Date()}`);
