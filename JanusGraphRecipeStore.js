'use strict';

class JanusGraphRecipeStore {

    /**
     * Creates a new instance of JanusGraphRecipeStore.
     * @param {Object} graphClient - The instance of the JanusGraphClient to use
     * @param {String} graphId - The id of the graph to use
     */
    constructor(graphClient, graphId) {
        this.graphClient = graphClient;
        this.graphId = graphId;
    }

    /**
     * Creates and initializes the Graph and Graph schema.
     * @returns {Promise.<TResult>}
     */
    init() {
        return this.graphClient.getOrCreateGraph(this.graphId)
            .then(() => {
                this.graphClient.setGraphId(this.graphId);
                return Promise.resolve();
            });
    }

    // User

    /**
     * Adds a new user to Graph if a user with the specified ID does not already exist.
     * @param userId - The ID of the user (typically the ID returned from Slack)
     * @returns {Promise.<TResult>}
     */
    addUser(userId) {
        let userVertex = {label: 'person'};
        userVertex['name'] = userId;
        return this.addVertexIfNotExists(userVertex, 'name')
            .then((vertex) => {
                return Promise.resolve(vertex);
            });
    }

    // Ingredients

    /**
     * Gets the unique name for the ingredient to be stored in Graph.
     * @param ingredientsStr - The ingredient or comma-separated list of ingredients specified by the user
     * @returns {string}
     */
    getUniqueIngredientsName(ingredientsStr) {
        let ingredients = ingredientsStr.trim().toLowerCase().split(',');
        for (let i = 0; i < ingredients.length; i++) {
            ingredients[i] = ingredients[i].trim();
        }
        ingredients.sort();
        return ingredients.join(',');
    }

    /**
     * Finds the ingredient based on the specified ingredientsStr in Graph.
     * @param ingredientsStr - The ingredient or comma-separated list of ingredients specified by the user
     * @returns {Promise.<TResult>}
     */
    findIngredient(ingredientsStr) {
        return this.findVertex('ingredient', 'name', this.getUniqueIngredientsName(ingredientsStr));
    }

    /**
     * Adds a new ingredient to Graph if an ingredient based on the specified ingredientsStr does not already exist.
     * @param ingredientsStr - The ingredient or comma-separated list of ingredients specified by the user
     * @param matchingRecipes - The recipes that match the specified ingredientsStr
     * @param userVertex - The existing Graph vertex for the user
     * @returns {Promise.<TResult>}
     */
    addIngredient(ingredientsStr, matchingRecipes, userVertex) {
        let ingredientVertex = {label: 'ingredient'};
        ingredientVertex['name'] = this.getUniqueIngredientsName(ingredientsStr);
        ingredientVertex['detail'] = JSON.stringify(matchingRecipes).replace(/'/g, '\\\'');
        return this.addVertexIfNotExists(ingredientVertex, 'name')
            .then((vertex) => {
                return this.recordIngredientRequestForUser(vertex, userVertex)
                    .then(() => {
                        return Promise.resolve(vertex);
                    });
            });
    }

    /**
     * Creates or updates an edge between the specified user and ingredient.
     * Stores the number of times the ingredient has been accessed by the user in the edge.
     * @param ingredientVertex - The existing Graph vertex for the ingredient
     * @param userVertex - The existing Graph vertex for the user
     * @returns {Promise.<TResult>}
     */
    recordIngredientRequestForUser(ingredientVertex, userVertex) {
        let edge = {
            label: 'selects',
            outV: userVertex.id,
            inV: ingredientVertex.id,
            properties: {'count': 1}
        };
        return this.addUpdateEdge(edge);
    }

    // Cuisine

    /**
     * Gets the unique name for the cuisine to be stored in Graph.
     * @param cuisine - The cuisine specified by the user
     * @returns {string}
     */
    getUniqueCuisineName(cuisine) {
        return cuisine.trim().toLowerCase();
    }

    /**
     * Finds the cuisine with the specified name in Graph.
     * @param cuisine - The cuisine specified by the user
     * @returns {Promise.<TResult>}
     */
    findCuisine(cuisine) {
        return this.findVertex('cuisine', 'name', this.getUniqueCuisineName(cuisine));
    }

    /**
     * Adds a new cuisine to Graph if a cuisine with the specified name does not already exist.
     * @param cuisine - The cuisine specified by the user
     * @param matchingRecipes - The recipes that match the specified cuisine
     * @param userVertex - The existing Graph vertex for the user
     * @returns {Promise.<TResult>}
     */
    addCuisine(cuisine, matchingRecipes, userVertex) {
        let cuisineVertex = {label: 'cuisine'};
        cuisineVertex['name'] = this.getUniqueCuisineName(cuisine);
        cuisineVertex['detail'] = JSON.stringify(matchingRecipes).replace(/'/g, '\\\'');
        return this.addVertexIfNotExists(cuisineVertex, 'name')
            .then((vertex) => {
                return this.recordCuisineRequestForUser(vertex, userVertex)
                    .then(() => {
                        return Promise.resolve(vertex);
                    });
            });
    }

    /**
     * Creates or updates an edge between the specified user and cuisine.
     * Stores the number of times the cuisine has been accessed by the user in the edge.
     * @param cuisineVertex - The existing Graph vertex for the cuisine
     * @param userVertex - The existing Graph vertex for the user
     * @returns {Promise.<TResult>}
     */
    recordCuisineRequestForUser(cuisineVertex, userVertex) {
        let edge = {
            label: 'selects',
            outV: userVertex.id,
            inV: cuisineVertex.id,
            properties: {'count': 1}
        };
        return this.addUpdateEdge(edge);
    }

    // Recipe

    /**
     * Gets the unique name for the recipe to be stored in Graph.
     * @param recipeId - The ID of the recipe (typically the ID of the recipe returned from Spoonacular)
     * @returns {string}
     */
    getUniqueRecipeName(recipeId) {
        return `${recipeId}`.trim().toLowerCase();
    }

    /**
     * Finds the recipe with the specified ID in Graph.
     * @param recipeId - The ID of the recipe (typically the ID of the recipe returned from Spoonacular)
     * @returns {Promise.<TResult>}
     */
    findRecipe(recipeId) {
        return this.findVertex('recipe', 'name', this.getUniqueRecipeName(recipeId));
    }

    /**
     * Adds a new recipe to Graph if a recipe with the specified name does not already exist.
     * @param recipeId - The ID of the recipe (typically the ID of the recipe returned from Spoonacular)
     * @param recipeTitle - The title of the recipe
     * @param recipeDetail - The detailed instructions for making the recipe
     * @param ingredientCuisineVertex - The existing Graph vertex for either the ingredient or cuisine selected before the recipe
     * @param userVertex - The existing Graph vertex for the user
     * @returns {Promise.<TResult>}
     */
    addRecipe(recipeId, recipeTitle, recipeDetail, ingredientCuisineVertex, userVertex) {
        let recipeVertex = {label: 'recipe'};
        recipeVertex['name'] = this.getUniqueRecipeName(recipeId);
        recipeVertex['title'] = recipeTitle.trim().replace(/'/g, '\\\'');
        recipeVertex['detail'] = recipeDetail.replace(/'/g, '\\\'').replace(/\n/g, '\\\\n');
        return this.addVertexIfNotExists(recipeVertex, 'name')
            .then((vertex) => {
                // add one edge from the ingredient/cuisine to the recipe
                recipeVertex = vertex;
                return this.recordRecipeRequestForUser(recipeVertex, ingredientCuisineVertex, userVertex);
            })
            .then(() => {
                return Promise.resolve(recipeVertex);
            });
    }

    /**
     * Finds the user's favorite recipes in Graph.
     * @param userVertex - The existing Graph vertex for the user
     * @param count - The max number of recipes to return
     * @returns {Promise.<TResult>}
     */
    findFavoriteRecipesForUser(userVertex, count) {
        let query = `g.V().hasLabel("person").has("name", "${userVertex.properties['name'][0]['value']}").outE().order().by("count", decr).inV().hasLabel("recipe").limit(${count})`;
        return this.graphClient.runGremlinQuery(`def g = graph.traversal(); ${query}`)
            .then((response) => {
                if (response.result && response.result.data && response.result.data.length > 0) {
                    let recipes = [];
                    let recipeVertices = response.result.data;
                    for (let recipeVertex of recipeVertices) {
                        let recipe = {
                            id: recipeVertex.properties.name[0].value,
                            title: recipeVertex.properties.title[0].value,
                        }
                        recipes.push(recipe);
                    }
					return Promise.resolve(recipes);
                }
                else {
                    return Promise.resolve([]);
                }
            });
    }

    /**
     * Finds popular recipes using the specified ingredient.
     * @param ingredientsStr - The ingredient or comma-separated list of ingredients specified by the user
     * @param userVertex - The Graph vertex for the user requesting recommended recipes
     * @param count - The max number of recipes to return
     * @returns {Promise.<TResult>}
     */
    findRecommendedRecipesForIngredient(ingredientsStr, userVertex, count) {
        ingredientsStr = this.getUniqueIngredientsName(ingredientsStr);
        let query = `g.V().hasLabel("ingredient").has("name","${ingredientsStr}")`;
        query += `.in("has")`;
        query += `.inE().has("count",gt(1)).order().by("count", decr)`;
        query += `.outV().hasLabel("person").has("name",neq("${userVertex.properties.name[0].value}"))`;
        query += `.path()`;
        return this.getRecommendedRecipes(query, count);
    }

    /**
     * Finds popular recipes using the specified cuisine.
     * @param cuisine - The cuisine specified by the user
     * @param userVertex - The Graph vertex for the user requesting recommended recipes
     * @param count - The max number of recipes to return
     * @returns {Promise.<TResult>}
     */
    findRecommendedRecipesForCuisine(cuisine, userVertex, count) {
        cuisine = this.getUniqueCuisineName(cuisine);
        let query = `g.V().hasLabel("cuisine").has("name","${cuisine}")`;
        query += `.in("has")`;
        query += `.inE().has("count",gt(1)).order().by("count", decr)`;
        query += `.outV().hasLabel("person").has("name",neq("${userVertex.properties.name[0].value}"))`;
        query += `.path()`;
        return this.getRecommendedRecipes(query, count);
    }

    getRecommendedRecipes(query, count) {
        return this.graphClient.runGremlinQuery(`def g = graph.traversal(); ${query}`)
            .then((response) => {
                if (response.result && response.result.data && response.result.data.length > 0) {
                    let recipes = [];
                    let recipeHash = {};
                    let paths = response.result.data;
                    for (let path of paths) {
                        let recipeVertex = path.objects[1];
                        let recipeId = recipeVertex.properties.name[0].value;
                        let recipe = recipeHash[recipeId];
                        if (! recipe) {
                            if (recipes.length >= count) {
                                continue;
                            }
                            recipe = {
                                id: recipeId,
                                title: recipeVertex.properties.title[0].value,
                                recommendedUserCount: 1
                            };
                            recipes.push(recipe);
                            recipeHash[recipeId] = recipe;
                        }
                        else {
                            recipe.recommendedUserCount += 1;
                        }
                    }
                    return Promise.resolve(recipes);
                }
                else {
					return Promise.resolve([]);
                }
            });
    }

    /**
     * Creates or updates an edge between the specified user and recipe.
     * Stores the number of times the recipe has been accessed by the user in the edge.
     * Creates or updates an edge between the specified ingredient/cuisine (if not None) and recipe.
     * Stores the number of times the recipe has been accessed by the ingredient/cuisine in the edge.
     * @param recipeVertex - The existing Graph vertex for the recipe
     * @param ingredientCuisineVertex - The existing Graph vertex for either the ingredient or cuisine selected before the recipe
     * @param userVertex - The existing Graph vertex for the user
     * @returns {Promise.<TResult>}
     */
    recordRecipeRequestForUser(recipeVertex, ingredientCuisineVertex, userVertex) {
        // add one edge from the user to the recipe (this will let us find a user's favorite recipes, etc)
        let edge = {
            label: 'selects',
            outV: userVertex.id,
            inV: recipeVertex.id,
            properties: {'count': 1}
        };
        return this.addUpdateEdge(edge)
            .then(() => {
                if (ingredientCuisineVertex) {
                    // add one edge from the ingredient/cuisine to the recipe
                    let edge = {
                        label: 'selects',
                        outV: ingredientCuisineVertex.id,
                        inV: recipeVertex.id,
                        properties: {'count': 1}
                    };
                    return this.addUpdateEdge(edge)
                        .then(() => {
                            edge = {
                                label: 'has',
                                outV: recipeVertex.id,
                                inV: ingredientCuisineVertex.id
                            };
                            return this.addEdgeIfNotExists(edge)
                        });
                }
                else {
                    return Promise.resolve(null);
                }
            });
    }

    // Graph Helper Methods

    /**
     * Finds a vertex based on the specified label, propertyName, and propertyValue.
     * @param label - The label value of the vertex stored in Graph
     * @param propertyName - The property name to search for
     * @param propertyValue - The value that should match for the specified property name
     * @returns {Promise.<TResult>}
     */
    findVertex(label, propertyName, propertyValue) {
        let query = `g.V().hasLabel("${label}").has("${propertyName}", "${propertyValue}")`;
        return this.graphClient.runGremlinQuery(`def g = graph.traversal(); ${query}`)
            .then((response) => {
				if (response.result && response.result.data && response.result.data.length > 0) {
					return Promise.resolve(response.result.data[0]);
				}
				else {
					return Promise.resolve(null);
				}
            });
    }

    /**
     * Adds a new vertex to Graph if a vertex with the same value for uniquePropertyName does not exist.
     * @param vertex - The vertex to add
     * @param uniquePropertyName - The name of the property used to search for an existing vertex (the value will be extracted from the vertex provided)
     * @returns {Promise.<TResult>}
     */
    addVertexIfNotExists(vertex, uniquePropertyName) {
        let propertyValue = `${vertex[uniquePropertyName]}`;
        let query = `g.V().hasLabel("${vertex.label}").has("${uniquePropertyName}", "${propertyValue}")`;
        return this.graphClient.runGremlinQuery(`def g = graph.traversal(); ${query}`)
            .then((response) =>  {
                if (response.result && response.result.data && response.result.data.length > 0) {
                    console.log(`Returning ${vertex.label} vertex where ${uniquePropertyName}=${propertyValue}`);
                    return Promise.resolve(response.result.data[0]);
                }
                else {
                    console.log(`Creating ${vertex.label} vertex where ${uniquePropertyName}=${propertyValue}`);
                    return this.graphClient.createVertex(vertex);
                }
            });
    }

    /**
     * Adds a new edge to Graph if an edge with the same out_v and in_v does not exist.
     * @param edge - The edge to add
     * @returns {Promise}
     */
    addEdgeIfNotExists(edge) {
        let query = `g.V(${edge.outV}).outE().inV().hasId(${edge.inV}).path()`;
        return this.graphClient.runGremlinQuery(`def g = graph.traversal(); ${query}`)
            .then((response) => {
				if (response.result && response.result.data && response.result.data.length > 0) {
					console.log(`Edge from ${edge.outV} to ${edge.inV} exists.`);
					return Promise.resolve(response.result.data[0]);
				}
				else {
					console.log(`Creating edge from ${edge.outV} to ${edge.inV}`);
					return this.graphClient.createEdge(edge.label, edge.outV, edge.inV, edge.properties);
				}
			});
    }

    /**
     * Adds a new edge to Graph if an edge with the same out_v and in_v does not exist.
     * Increments the count property on the edge.
     * @param edge - The edge to add
     * @returns {Promise}
     */
    addUpdateEdge(edge) {
        let query = `g.V(${edge.outV}).outE().inV().hasId(${edge.inV}).path()`;
        return this.graphClient.runGremlinQuery(`def g = graph.traversal(); ${query}`)
            .then((response) => {
                if (response.result && response.result.data && response.result.data.length > 0) {
                    console.log(`Edge from ${edge.outV} to ${edge.inV} exists.`);
                    edge = response.result.data[0].objects[1];
                    let count = 0;
                    if (!edge.properties) {
                        edge.properties = {};
                    }
                    if (edge.properties.count) {
                        count = edge.properties.count;
                    }
                    edge.properties['count'] = count + 1;
                    return this.graphClient.updateEdge(edge.id, edge.properties);
                }
                else {
                    console.log(`Creating edge from ${edge.outV} to ${edge.inV}`);
                    return this.graphClient.createEdge(edge.label, edge.outV, edge.inV, edge.properties);
                }
            });
    }
}

module.exports = JanusGraphRecipeStore;