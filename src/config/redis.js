const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("connect", () => {
  console.log("Redis Started");
});

redisClient.on("error", (err) => {
  console.error("Redis Error:", err);
});

module.exports = redisClient;