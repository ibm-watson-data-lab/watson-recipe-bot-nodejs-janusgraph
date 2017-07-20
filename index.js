'use strict';

const dotenv = require('dotenv');
const JanusGraphClient = require('./JanusGraphClient');
const JanusGraphRecipeStore = require('./JanusGraphRecipeStore');
const SnsClient = require('./SnsClient');
const SousChef = require('./SousChef');

// load from .env
dotenv.config();

// create graph client
let config;
if (process.env.VCAP_SERVICES) {
	let vcapServices = JSON.parse(process.env.VCAP_SERVICES);
	let graphService = 'IBM Graph';
	if (vcapServices[graphService] && vcapServices[graphService].length > 0) {
		config = vcapServices[graphService][0];
	}
}
let graphClient = new JanusGraphClient(
	process.env.JANUSGRAPH_URL,
	process.env.JANUSGRAPH_USERNAME,
	process.env.JANUSGRAPH_PASSWORD
);

const snsClient = new SnsClient(
    process.env.SNS_API_URL,
	process.env.SNS_API_KEY
);

const sousChef = new SousChef(
	new JanusGraphRecipeStore(graphClient, process.env.GRAPH_ID),
	process.env.SLACK_BOT_TOKEN,
	process.env.SPOONACULAR_KEY,
	process.env.CONVERSATION_USERNAME,
	process.env.CONVERSATION_PASSWORD,
	process.env.CONVERSATION_WORKSPACE_ID,
    snsClient
);
sousChef.run();