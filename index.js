require("dotenv").config();
const {
	API_KEY,
	API_ROOT,
	PRE_BOOKING_MINUTES,
	POST_BOOKING_MINUTES,
	BAY_FETCH_INTERVAL_MINUTES,
	BOOKING_FETCH_INTERVAL_MINUTES
} = require("./config");
const wol = require("wake_on_lan");
const axios = require("axios");
const moment = require("moment-timezone");
const { findIpAddresses } = require("./network");

// Global state for bay data and bay states.
let bayData, bayStates = {};

try {
	bayData = require("./bayData.json") || [];
} catch (error) {
	console.error("No bay data, or bad data:", error.message);
	process.exit(1);
}

console.log("\n");
console.log("********************************");
console.log("WOL manager starting...");
console.log("API Root:", API_ROOT);
console.log("********************************");
console.log("\n");
console.log("Bay mapping data:", bayData);
console.log("\n");

// Helper to wake a bay.
function wakeBay(mac) {
	console.log(`Waking bay with MAC ${mac}...`);
	return new Promise((resolve, reject) => {
		wol.wake(mac, function (error) {
			if (error) {
				console.error(`Failed to wake bay with MAC ${mac}:`, error.message);
				return reject(error);
			}
			console.log(`Wake packet sent to bay with MAC ${mac}.`);
			resolve();
		});
	});
}

// Store bays here once fetched.
let bays = [];

async function getBays(lookupIps = false) {
	try {
		console.log("Fetching bays from API...");
		const response = await axios.get(`${API_ROOT}/bays`, {
			headers: {
				"x-api-key": API_KEY
			}
		});
		console.log("Successfully fetched bays.");
		// We need to simplify the bays and find data for them.
		const mappedBays = [];
		for (const bay of response.data) {
			const bayInfo = bayData.find(b => b.ref === bay.ref);
			// Skip bays we don't have info for.
			if (!bayInfo) continue;
			// Map to simpler object.
			const mappedBay = {
				id: bay.id,
				ref: bay.ref,
				range: bay.range,
				mac: bayInfo.mac
			}
			// Done.
			mappedBays.push(mappedBay);
		}
		// If requested, look up IPs for MAC addresses.
		if (lookupIps) {
			const macs = mappedBays.map(b => b.mac);
			console.log("Looking up IP addresses for MACs:", macs);
			const macIpMap = await findIpAddresses(macs);
			// Add IPs to bays.
			for (const bay of mappedBays) {
				if (!macIpMap[bay.mac]) throw new Error(`Failed to find IP for MAC ${bay.mac}`);
				bay.ip = macIpMap[bay.mac];
			}
		}
		// Done.
		console.log("Bays fetched successfully:", mappedBays);
		console.log("\n");
		return mappedBays;
	} catch (error) {
		console.error('Error fetching bays:', error.message);
		return null;
	}
}

/**
 * Get bookings from the API.
 * @param {String|moment.Moment} from 
 * @param {String|moment.Moment} to 
 * @returns {Promise<Array>} Array of bookings.
 */
async function getBookings(from, to) {
	try {
		const response = await axios.get(`${API_ROOT}/bookings/public-admin`, {
			headers: {
				"x-api-key": API_KEY
			},
			params: {
				start_gte: moment(from).utc().format(),
				start_lte: moment(to).utc().format()
			}
		});
		// We only need bookings for bays we know about.
		const result = [];
		for (const booking of response.data) {
			// Skip block bookings.
			if (booking.isBlock) continue;
			// Skip non-bay bookings.
			if (booking.type !== "bay") continue;
			// Skip anything not confirmed or attended.
			if (booking.status !== "confirmed" && booking.status !== "attended") continue;
			// Find the bay for this booking.
			const bay = bays.find(b => b.id === booking.bayId);
			// Skip bookings for bays we don't know about.
			if (!bay) continue;
			// Add to result.
			result.push({
				id: booking.id,
				start: booking.start,
				end: booking.end,
				status: booking.status,
				bay,
			});
		}
		return result;
	} catch (error) {
		console.error('Error fetching bookings:', error.message);
		return null;
	}
}

/**
 * Calculate the state of each bay based on its bookings.
 * Returns an object with bay refs as keys and their state as values. Values will
 * be either true (active) or false (inactive).
 * @param {Array} bookings 
 * @returns {Promise<Object>} Bay states.
 */
async function calculateBayStates(bookings) {
	const now = moment();
	const bayStates = {};
	for (const bay of bays) {
		// Find bookings for this bay.
		const bayBookings = bookings.filter(b => b.bay.id === bay.id);
		// Default to inactive.
		let isActive = false;
		for (const booking of bayBookings) {
			const start = moment(booking.start);
			const end = moment(booking.end);
			// Check if we are within the booking time, or within the pre-booking window
			// and post-booking window.
			if (now.isBetween(
				start.clone().subtract(PRE_BOOKING_MINUTES, 'minutes'),
				end.clone().add(POST_BOOKING_MINUTES, 'minutes')
			)) {
				isActive = true;
				// No need to check further bookings for this bay.
				break;
			}
		}
		bayStates[bay.ref] = isActive;
	}
	return bayStates;
}

/**
 * Handle waking and sleeping bays based on their states.
 * @param {Object} previousStates
 * @param {Object} newStates
 * @returns {Promise<void>}
 */
async function handleBayStates(previousStates, newStates) {
	for (const bayRef in newStates) {
		const isActive = newStates[bayRef] === true;
		const wasActive = previousStates[bayRef] === true;
		// If the bay is active and was not active before, wake it.
		if (isActive && !wasActive) {
			const mac = bays.find(b => b.ref === bayRef)?.mac;
			if (mac) await wakeBay(mac);
			else console.error(`No MAC address found for bay ${bayRef}, cannot wake.`);
		}
		// If the bay is not active and was active before, sleep it.
		else if (!isActive && wasActive) {
			const mac = bays.find(b => b.ref === bayRef)?.mac;
			if (mac) await sleepBay(mac);
			else console.error(`No MAC address found for bay ${bayRef}, cannot sleep.`);
		}
	}
}

async function main() {

	// Load bays first - we need them to interpret bookings.
	bays = await getBays(true);
	if (!bays) {
		throw new Error("Failed to fetch bays on startup. Cannot continue.");
	}

	/**
	 * Periodically refresh bays, in case of changes.
	 * 
	 * We do this in the background, and just log an error if it fails,
	 * keeping the existing data.
	 */
	setInterval(async () => {
		const newBays = await getBays();
		if (newBays) {
			bays = newBays;
			console.log('Bays updated:', bays);
		} else {
			console.error("Failed to update bays on interval, keeping existing data.");
		}
	}, BAY_FETCH_INTERVAL_MINUTES * 60 * 1000);

	// Fetch bookings for the next few hours, looking back a few hours too.
	async function fetchAndHandleBookings() {
		const now = moment();
		const from = now.clone().subtract(2, 'hours').startOf('hour');
		const to = now.clone().add(6, 'hours').startOf('hour');
		console.log(`Fetching bookings from ${from.format("Do MMM HH:mm")} to ${to.format("Do MMM HH:mm")}...`);
		const bookings = await getBookings(from, to);
		// Exit if we failed to get bookings.
		if (!bookings) {
			console.error("Failed to fetch bookings.");
			return;
		}
		// Otherwise, work out bay states.
		console.log(`Fetched ${bookings.length} bookings:`, bookings.map(b => b.id), "\n");
		const newBayStates = await calculateBayStates(bookings);
		console.log("Calculating bay states...");
		console.log("Old bay states:", bayStates);
		console.log("New bay states:", newBayStates);
		// Handle any changes.
		try {
			await handleBayStates(bayStates, newBayStates);
			// Save new states.
			bayStates = newBayStates;
			console.log("Bay states handled successfully.\n");
		} catch (error) {
			console.error("Error handling bay states:", error.message);
		}
	}
	// Do this now, and then on an interval.
	await fetchAndHandleBookings();
	setInterval(fetchAndHandleBookings, 20000);
	// setInterval(fetchAndHandleBookings, BOOKING_FETCH_INTERVAL_MINUTES * 60 * 1000);
}

main();
