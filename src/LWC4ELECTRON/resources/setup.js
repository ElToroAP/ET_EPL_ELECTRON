"use strict";

const myTimer = {
	clock: null
};

function loadData(data) {
	if (data.event) {
		document.getElementById("EventName").innerHTML = data.event.name;
	}

	if (data.rooms) {
		let opt;

		const roomsPicklist = document.getElementById("RoomsPicklist");
		opt = document.createElement("option");
		opt.value = "";
		opt.innerHTML = "Which room?";
		roomsPicklist.appendChild(opt);
		data.rooms.forEach(room => {
			opt = document.createElement("option");
			opt.value = room.sfid;
			opt.innerHTML = room.name;
			roomsPicklist.appendChild(opt);
		});
		if (data.roomId) roomsPicklist.value = data.roomId;
	}

	if (data.computerNumber) {
		document.getElementById("ComputerNumber").value = data.computerNumber;
	}
}

function RoomNumberKeyUp(event) {
	if (event.keyCode === 13) {
		document.getElementById("RegisterComputer").click();
	}
}

function RegisterComputerClick() {
	const roomId = document.getElementById("RoomsPicklist").value;
	const computerNumber = document.getElementById("ComputerNumber").value;

	if (roomId && computerNumber && Math.floor(computerNumber)) {
		toMain({
			type: "setup-setData",
			data: {
				roomId,
				computerNumber
			}
		});
	} else {
		alert("Please enter the information required");
	}
}

toMain({
	type: "setup-getData",
	callback: message => {
		loadData(message.data.setupData);

		if (myTimer.clock) clearInterval(myTimer.clock);
		myTimer.formTimeout = message.data.formTimeout;
		myTimer.expires = addMilliseconds(new Date(), message.data.formTimeout);
		myTimer.clock = setInterval(() => {
			myTimer.secondsRemaining = secondsRemaining(myTimer.expires);
			if (myTimer.secondsRemaining <= 0) myTimer.secondsRemaining = 0;
			const minutes = Math.floor(myTimer.secondsRemaining / 60);
			const seconds = `${Math.floor(myTimer.secondsRemaining - minutes * 60)}`;
			document.getElementById("Expires").innerHTML = `${minutes} : ${seconds.padStart(2, "0")}`;
		}, 250);
	}
});
