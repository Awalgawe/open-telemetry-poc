import Redis from "ioredis";

export default new Redis({
  host: "redis",
  port: 6379,
});
