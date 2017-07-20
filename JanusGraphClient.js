'use strict';

const rp = require('request-promise');

class JanusGraphClient {

    /**
     * Creates a new instance of GraphClient.
     * @param {String} url - 
     * @param {String} username - 
	 * @param {String} password - 
     */
    constructor(url, username, password) {
    	this.url = url;
    	this.username = username;
    	this.password = password;
    	this.authHeader = 'Basic '+ new Buffer(this.username + ":" + this.password).toString("base64");
    }

    getPostOptions(body) {
    	let options = {
			method: 'POST',
			uri: this.url,
			headers: {
				"Authorization": this.authHeader,
				"Content-Type": "application/json"
			},
			json: true,
			body: body
		};
    	return options;
	}

	graphExists(id) {
    	console.log(`Checking if graph exists with id '${id}'...`);
		const body = {
			gremlin: `def graph=ConfiguredGraphFactory.open("${id}");0;`
		};
		return rp(this.getPostOptions(body))
			.then((responseBody) => {
				return Promise.resolve(responseBody.status && responseBody.status.code && responseBody.status.code == 200);
			})
			.catch(() => {
				return Promise.resolve(false);
			});
	}

	getOrCreateGraph(id) {
		console.log(`Getting or creating graph with id '${id}'...`);
		return this.graphExists(id)
			.then((exists) => {
				if (exists) {
					console.log('Graph already exists.');
					return Promise.resolve(true);
				}
				else {
					console.log('Graph does not exist. Creating new graph...');
					const body = {
						gremlin: `def graph=ConfiguredGraphFactory.create("${id}");0;`
					};
					return rp(this.getPostOptions(body))
						.then((responseBody) => {
							return Promise.resolve(responseBody.status && responseBody.status.code && responseBody.status.code == 200);
						});
				}
			});
	}

	setGraphId(id) {
    	this.graphId = id;
	}

	runGremlinQuery(gremlinQuery) {
		let gremlin = `def graph=ConfiguredGraphFactory.open("${this.graphId}");`;
		gremlin +=  gremlinQuery;
		return rp(this.getPostOptions({'gremlin': gremlin}))
			.then((responseBody) => {
				if (responseBody.status && responseBody.status.code && responseBody.status.code == 200) {
					return Promise.resolve(responseBody);
				}
				else {
					return Promise.reject(new Error('Invalid status returned from server.'));
				}
			});
	}

	createVertex(vertex) {
		let gremlinQuery = `graph.addVertex(T.label, "${vertex.label}"`;
		for (let property in vertex) {
			if (vertex.hasOwnProperty(property) && property != 'label') {
				let value = vertex[property];
				if (this.isStringValue(value)) {
					gremlinQuery += `, "${property}", "${this.escapeStringValue(value)}"`
				}
				else {
					gremlinQuery += `, "${property}", ${value}`
				}
				
			}
		}
		gremlinQuery += ');';
		return this.runGremlinQuery(gremlinQuery)
			.then((response) => {
				if (response.result && response.result.data && response.result.data.length > 0) {
					return Promise.resolve(response.result.data[0]);
				}
				else {
					return Promise.resolve(null);
				}
			});
	}

	createEdge(label, outV, inV, properties) {
		let gremlinQuery = 'def g = graph.traversal();';
		gremlinQuery += `def outV = g.V(${outV}).next();`;
		gremlinQuery += `def inV = g.V(${inV}).next();`;
		gremlinQuery += `outV.addEdge("${label}", inV`;
		for (let property in properties) {
			if (properties.hasOwnProperty(property)) {
				let value = properties[property];
				if (this.isStringValue(value)) {
					gremlinQuery += `, "${property}", "${this.escapeStringValue(value)}"`
				}
				else {
					gremlinQuery += `, "${property}", ${value}`
				}
			}
		}
		gremlinQuery += ');';
		return this.runGremlinQuery(gremlinQuery)
			.then((response) => {
				if (response.result && response.result.data && response.result.data.length > 0) {
					return Promise.resolve(response.result.data[0]);
				}
				else {
					return Promise.resolve(null);
				}
			});
	}

	updateEdge(id, properties) {
		let gremlinQuery = 'def g = graph.traversal();';
		gremlinQuery += `g.E("${id}")`;
		for (let property in properties) {
			if (properties.hasOwnProperty(property)) {
				let value = properties[property];
				if (this.isStringValue(value)) {
					gremlinQuery += `.property("${property}", "${this.escapeStringValue(value)}")`
				}
				else {
					gremlinQuery += `.property("${property}", ${value})`
				}
			}
		}
		gremlinQuery += ';';
		return this.runGremlinQuery(gremlinQuery);
	}
	
	isStringValue(value) {
    	return Object.prototype.toString.call(value) == '[object String]';
	}

	escapeStringValue(value) {
		// first escape escaped double quotes, then all double quotes
		value = value.replace(new RegExp('\\\\\"', 'g'), '\\\\\"');
		value = value.replace(new RegExp('\"', 'g'), '\\\"');
		// escape dollar signs
		return value.replace(new RegExp('\\$', 'g'), '\\\$');
	}

	// // Backwards-Compatible with nodejs-graph
	//
	// gremlin(traversal, callback) {
	// 	return this.runGremlinQuery(traversal)
	// 		.then((responseBody) => {
	// 			callback(null, responseBody);
	// 		})
	// 		.catch((err) => {
	// 			callback(err, null);
	// 		});
	// }
	//
	// vertices() {
	// 	const client = this;
	// 	return {
	// 		create: function(keyPairs, callback) {
	// 			client.createVertex(keyPairs)
	// 				.then((responseBody) => {
	// 					callback(null, responseBody);
	// 				})
	// 				.catch((err) => {
	// 					callback(err, null);
	// 				});
	// 		}
	// 	}
	// }
	//
	// edges() {
	// 	const client = this;
	// 	return {
	// 		create: function (label, outV, inV, properties, callback) {
	// 			client.createEdge(label, outV, inV, properties)
	// 				.then((responseBody) => {
	// 					callback(null, responseBody);
	// 				})
	// 				.catch((err) => {
	// 					callback(err, null);
	// 				});
	// 		},
	//
	// 		update: function (id, keyPairs, callback) {
	// 			client.updateEdge(id, keyPairs["properties"])
	// 				.then((responseBody) => {
	// 					callback(null, responseBody);
	// 				})
	// 				.catch((err) => {
	// 					callback(err, null);
	// 				});
	// 		}
	// 	}
	// }
}

module.exports = JanusGraphClient;