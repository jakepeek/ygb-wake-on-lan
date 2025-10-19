const express = require('express');
const path = require('node:path');
const app = express();

module.exports = function main (apis) {

	// Endpoint to get the currently configured bays.
	app.get('/api/bays', async (req, res) => {
		const bays = await apis.getBays();
		res.json(bays);
	});

	// Endpoint to update the configured bays.
	app.put('/api/bays', express.json(), async (req, res) => {
		const newBays = req.body;
		// Set the bays.
		await apis.setBays(newBays);
		// Re get them.
		const bays = await apis.getBays();
		// Return the new list.
		res.json(bays);
	});

	// Endpoint to get the current bay states.
	app.get('/api/bay-states', async (req, res) => {
		const bayStates = await apis.getBayStates();
		res.json(bayStates);
	});

	// Basic health check endpoint.
	app.get('/api/health', (req, res) => {
		res.status(200).send('WOL server running.');
	});

	// Serve from the public folder for anything from "/".
	app.use('/', express.static(path.join(__dirname, "public")));

	return app;

};