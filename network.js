const { exec } = require("child_process");

const arpExtractor = /\? \(([\d.]+)\) at ([0-9a-f:]{1,2}(?::[0-9a-f]{1,2}){5})/gi;

/**
 * Uses arp to look up the IP address for a list of MAC addresses.
 * @param {String[]} macAddresses Mac address to convert to IP. 
 */
function findIpAddresses(macAddresses = []) {
	const upperCasedMacs = macAddresses.map(m => m.toUpperCase());
	return new Promise((resolve, reject) => {
		// Arp lookup for all MAC addresses.
		exec("arp -an", (error, stdout, stderr) => {
			if (error) {
				return reject(error);
			}
			if (stderr) {
				return reject(new Error(stderr));
			}
			// Parse the output.
			const lines = stdout.split("\n");
			const results = {};
			for (const line of lines) {
				// Example line: ? (192.168.1.2) at 00:11:22:33:44:55 [ether] on en0
				const match = arpExtractor.exec(line);
				if (!match) continue;
				const [, ip, mac] = match;
				if (upperCasedMacs.includes(mac.toUpperCase())) {
					results[mac.toUpperCase()] = ip;
				}
			}
			resolve(results);
		});
	});
}

module.exports = { findIpAddresses };
