const net = require("net");

function sendPJLink(ip, command, { port = 4352, timeout = 3000 } = {}) {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection({ host: ip, port, timeout });
		let bannerSeen = false;

		socket.setEncoding("utf8");

		socket.on("data", (chunk) => {
			const data = chunk.trim();

			// First packet should be the PJLink banner.
			if (!bannerSeen) {
				bannerSeen = true;
				if (!data.startsWith("PJLINK 0")) {
					socket.end();
					return reject(new Error(`Unexpected PJLink banner from ${ip}: "${data}" (auth likely enabled)`));
				}
				socket.write(command + "\r");
				return;
			}

			// After sending, projector replies like: "%1POWR=OK" or "ERR3"
			if (/=OK$/i.test(data)) {
				socket.end();
				return resolve(data);
			}
			if (/=ERR\d+$/i.test(data)) {
				socket.end();
				return reject(new Error(`PJLink error from ${ip}: ${data}`));
			}

			// Some models send extra state lines; resolve on anything non-empty after write.
			if (data.length) {
				socket.end();
				return resolve(data);
			}
		});

		socket.on("timeout", () => {
			socket.destroy();
			reject(new Error(`Timeout talking to ${ip}:${port}`));
		});
		socket.on("error", reject);
		socket.on("end", () => { /* no-op */ });
	});
}

// Convenience functions
function powerOnProjector(ip, opts) {
	return sendPJLink(ip, "%1POWR 1", opts);
}

function powerOffProjector(ip, opts) {
	return sendPJLink(ip, "%1POWR 0", opts);
}

module.exports = { 
	sendPJLink, 
	powerOnProjector, 
	powerOffProjector 
};
