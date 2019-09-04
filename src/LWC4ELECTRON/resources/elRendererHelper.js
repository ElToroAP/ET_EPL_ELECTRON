"use strict";

/* Linter overrides */
/* eslint-disable no-console */
/* eslint-disable no-alert */
/* eslint-disable @lwc/lwc/no-inner-html */
/* eslint-disable @lwc/lwc/no-document-query */

const electron = require("electron");
const { ipcRenderer } = electron;

const evMap = {
	lastId: 1, // Can't start in zero :-)
	callbacks: {}
};

function toMain(message) {
	// alert("Going to Electron's Main");

	// Save the callback
	const callBackId = evMap.lastId++;
	if (evMap.callbacks[callBackId]) {
		throw new Error("Callback ID already used");
	}

	// Update message
	message.callBackId = callBackId;
	if (!message.data) message.data = {};
	evMap.callbacks[callBackId] = message.callback;

	// Call ipcMain
	ipcRenderer.send("toMain", message);
}

function addMilliseconds(dttm, milliseconds) {
	dttm = new Date(dttm);
	dttm.setMilliseconds(dttm.getMilliseconds() + milliseconds);
	return dttm;
}

function secondsRemaining(dttm) {
	const now = new Date();
	const msNow = now.getTime();
	const msFuture = dttm.getTime();
	const secDiff = ((msFuture - msNow) / 1000).toFixed(2);
	return secDiff;
}

ipcRenderer.on("fromMain", (event, message) => {
	// alert("Back from Electron's Main");

	// Get the callback
	const callBackId = message.callBackId;
	const callback = evMap.callbacks[callBackId];

	// Invoke it
	if (callback) {
		delete evMap.callbacks[callBackId];
		callback(message);
	}
});
