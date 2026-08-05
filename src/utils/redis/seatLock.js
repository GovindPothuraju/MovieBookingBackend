
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
const LOCK_TTL = 300;

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
          EX: LOCK_TTL
        }
      )

      if(!result){
        // Rollback previously locked seats
        if(lockedKeys.length > 0){
          await redisClient.del(...lockedKeys);
        }
        return {
          success: false,
          seat: seatLabel,
        };
      }
      lockedKeys.push(key);
    }
    // Store all locked seats for this user
    const bookingKey = `booking_lock:${userId}:${showId}`;
    await redisClient.set(
        bookingKey,
        JSON.stringify(seatLabels),
        {
            EX: LOCK_TTL,
        }
    );
    return {
      success: true,
    };
  }catch (err) {
    if (lockedKeys.length > 0) {
      await redisClient.del(...lockedKeys);
    }
    await redisClient.del(bookingKey);
    throw err;
  }
}
//Before creating a booking, verify that all the Redis locks still exist and belong to the logged-in user.
const verifySeatLocks = async ({ showId, userId }) => {
  /**But where do seatLabels come from? Remember, the frontend is no longer sending seats.So before verifying Redis, fetch the show and the user's locked seats. */
    
  const bookingKey = `booking_lock:${userId}:${showId}`;

  // Get locked seats for this user
  const lockedSeats = await redisClient.get(bookingKey);

  if (!lockedSeats) {
    return {
      success: false,
      status: 409,
      message: "Your seat lock has expired.",
    };
  }

  const seatLabels = JSON.parse(lockedSeats);

  // Verify every seat lock belongs to this user
  for (const seatLabel of seatLabels) {
    const seatKey = `seat_lock:${showId}:${seatLabel}`;

    const lockedUser = await redisClient.get(seatKey);

    if (!lockedUser) {
      return {
        success: false,
        status: 409,
        message: `Seat ${seatLabel} lock has expired.`,
      };
    }

    if (lockedUser !== userId.toString()) {
      return {
        success: false,
        status: 409,
        message: `Seat ${seatLabel} is locked by another user.`,
      };
    }
  }

  return {
    success: true,
    seatLabels,
  };
};

module.exports = {
  lockSeats,
  verifySeatLocks,
};