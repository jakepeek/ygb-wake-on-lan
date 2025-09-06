require("dotenv").config();

module.exports = {
	/** Your Golf Booking API key. */
	API_KEY: process.env.API_KEY,
	/** The base URL for the Your Golf Booking API for your venue. */
	API_ROOT: process.env.API_ROOT,
	/** The number of minutes before a booking to launch the bay. */
	PRE_BOOKING_MINUTES: process.env.PRE_BOOKING_MINUTES ?
		parseInt(process.env.PRE_BOOKING_MINUTES, 10) : 15,
	/** The number of minutes after a booking to keep the bay on. */
	POST_BOOKING_MINUTES: process.env.POST_BOOKING_MINUTES ?
		parseInt(process.env.POST_BOOKING_MINUTES, 10) : 35,
	/** The interval in minutes to fetch bay data. */
	BAY_FETCH_INTERVAL_MINUTES: process.env.BAY_FETCH_INTERVAL_MINUTES ?
		parseInt(process.env.BAY_FETCH_INTERVAL_MINUTES, 10) : 15,
	/** The interval in minutes to fetch booking data. */
	BOOKING_FETCH_INTERVAL_MINUTES: process.env.BOOKING_FETCH_INTERVAL_MINUTES ?
		parseInt(process.env.BOOKING_FETCH_INTERVAL_MINUTES, 10) : 1
}
