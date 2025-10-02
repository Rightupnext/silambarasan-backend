// src/middleware/phonepeClient.js
const { StandardCheckoutClient, Env } = require("pg-sdk-node");

const clientId = process.env.PHONEPE_CLIENT_ID;
const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
const clientVersion = process.env.PHONEPE_CLIENT_VERSION || "1";
const env = process.env.PHONEPE_ENV === "PROD" ? Env.PRODUCTION : Env.SANDBOX;

// Create a single reusable client instance
const phonePeClient = StandardCheckoutClient.getInstance(
  clientId,
  clientSecret,
  clientVersion,
  env
);

module.exports = { phonePeClient };
