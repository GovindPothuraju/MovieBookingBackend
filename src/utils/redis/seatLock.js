
const redisClient = require('../../config/redis');

/* Algorithm
  Try locking every seat.
  Keep track of successful locks.
  If any lock fails:
  delete previously acquired locks
  return failure.
  Otherwise return success. 

  SET key value NX EX 300
  NX → Set only if the key doesn't already exist.
  EX 300 → Automatically expire after 5 minutes.
*/

/**
 * Lock multiple seats atomically.
 * Rolls back previously acquired locks if any lock fails.
 */

const lockSeats = async ({showId,seatLabels , userId}) =>{
  const lockedKeys = [];
  try{
    for(const seatLabel of seatLabels){
      const key = `seat_lock:${showId}:${seatLabel}`;

      const result = await redisClient.set(
        key,
        userId.toString(),
        {
          NX: true,
          EX: 300
        }
      )

      if(!result){
        // Rollback previously locked seats
        if(lockedKeys.length > 0){
          await redisClient.del(lockedKeys);
        }
        return {
          success: false,
          seat: seatLabel,
        };
      }
      lockedKeys.push(key);
    }
    return {
      success: true,
    };
  }catch (err) {
    if (lockedKeys.length > 0) {
      await redisClient.del(lockedKeys);
    }

    throw err;
  }
}
module.exports = {lockSeats};