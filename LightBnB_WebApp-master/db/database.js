const properties = require("./json/properties.json");
const users = require("./json/users.json");

const { Pool } = require('pg');

const pool = new Pool({
  user: 'vagrant',
  password: '123',
  host: 'localhost',
  database: 'lightbnb'
});

/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function (email) {
  let userEmail = email.toLowerCase();
  return pool.query(`
  SELECT * FROM users
  WHERE users.email = $1
  ;`, [userEmail])
  .then(res =>  res.rows[0])
  .catch((err) => {
    console.error('query error', err.stack)
  })
};
exports.getUserWithEmail = getUserWithEmail;

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function (id) {
  return pool.query(`
  SELECT * FROM users
  WHERE users.id = $1
  ;`, [id])
  .then(res => res.rows[0])
  .catch((err) => {
    console.error('query error', err.stack)
  })
};
exports.getUserWithId = getUserWithId;

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function (user) {
  return pool.query(`
  INSERT INTO users (name, email, password)
  VALUES ($1, $2, $3)
  RETURNING *; 
  ;`, [user.name, user.email, user.password]) 
  //Database Query
  .then(res =>  res.rows[0])
  .catch((err) => {
    console.error('query error', err.stack)
  })
};

exports.addUser = addUser;

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function(guest_id, limit = 20) {
  return pool.query(`
  SELECT reservations.*, properties.*, AVG(property_reviews.rating) AS average_rating
  FROM property_reviews
  JOIN properties ON property_reviews.property_id = properties.id
  JOIN reservations ON property_reviews.property_id = reservations.property_id 
  WHERE reservations.guest_id = $1
  AND reservations.end_date < now()::date
  GROUP BY properties.id, reservations.id
  ORDER BY reservations.start_date
  LIMIT $2;`, [guest_id, limit])
  .then(res => res.rows)
  .catch((err) => {
    console.error('query error', err.stack);
  })
};
exports.getAllReservations = getAllReservations;

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function(options, limit = 10) {

  const queryParams = [];
  let queryString = `
  SELECT properties.*, AVG(property_reviews.rating) AS average_rating
  FROM properties
  JOIN property_reviews ON properties.id = property_reviews.property_id
  `;

  // Check if a city has been passed in as an option
  if (options.city){
    queryParams.push(`%${options.city}%`);
    queryString +=  `WHERE city LIKE $${queryParams.length}`;


  // select the properties for the owner
  if (options.owner_id) {
    queryParams.push(options.owner_id);
    queryString += (queryParams.length ? `AND ` : 'WHERE ');
    queryString += `properties.owner_id = $${queryParams.length} `;
  }

  // price range search
  if (options.minimum_price_per_night) {
    queryParams.push(options.minimum_price_per_night * 100);
    queryString += (queryParams.length ? `AND ` : 'WHERE ');
    queryString += `properties.cost_per_night >= $${queryParams.length} ` ;
  }

  if (options.maximum_price_per_night) {
    queryParams.push(options.maximum_price_per_night * 100);
    queryString += (queryParams.length ? `AND ` : 'WHERE ');
    queryString += `properties.cost_per_night <= $${queryParams.length} ` ;
  }

  queryString += `GROUP BY properties.id `

  // return ratings only above the rating given by user
  if (options.minimum_rating) {
    queryParams.push(options.minimum_rating);
    queryString += `
  HAVING AVG(property_reviews.rating) >= $${queryParams.length} `;
  }

  queryParams.push(limit);
  queryString += `
  ORDER BY cost_per_night
  LIMIT $${queryParams.length};
  `;

  console.log(queryString, queryParams);

  // run the query with the user input variables
  return pool.query(queryString, queryParams)
  .then(res => res.rows)
  .catch((err) => {
    console.error('query error', err.stack);
  });
}
exports.getAllProperties = getAllProperties;

/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function (property) {
  const values = [
    property.owner_id,
    property.title,
    property.description,
    property.thumbnail_photo_url,
    property.cover_photo_url,
    property.cost_per_night * 100,
    property.street,
    property.city,
    property.province,
    property.post_code,
    property.country,
    property.parking_spaces,
    property.number_of_bathrooms,
    property.number_of_bedrooms
  ]
  return pool.query(`
  INSERT INTO properties (owner_id, title, description, thumbnail_photo_url, cover_photo_url, cost_per_night, street, city, province, post_code, country, parking_spaces, number_of_bathrooms, number_of_bedrooms)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  RETURNING *;
  `, values)
  .then(res => res.rows[0])
  .catch ((err) => console.log("query error", err.stack))
};

module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};