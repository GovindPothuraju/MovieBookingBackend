
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

const redisClient = require("../../config/redis");

const LOCK_TTL = 300;

const lockSeats = async ({ showId, seatLabels, userId }) => {
  const lockedKeys = [];
  const bookingKey = `booking_lock:${userId}:${showId}`;

  try {
    for (const seatLabel of seatLabels) {
      const key = `seat_lock:${showId}:${seatLabel}`;

      const result = await redisClient.set(
        key,
        userId.toString(),
        {
          NX: true,
          EX: LOCK_TTL,
        }
      );

      if (!result) {
        if (lockedKeys.length > 0) {
          await redisClient.del(...lockedKeys);
        }

        await redisClient.del(bookingKey);

        return {
          success: false,
          seat: seatLabel,
        };
      }

      lockedKeys.push(key);
    }

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
  } catch (err) {
    if (lockedKeys.length > 0) {
      await redisClient.del(...lockedKeys);
    }

    await redisClient.del(bookingKey);

    throw err;
  }
};

const verifySeatLocks = async ({ showId, userId }) => {
  const bookingKey = `booking_lock:${userId}:${showId}`;

  const lockedSeats = await redisClient.get(bookingKey);

  if (!lockedSeats) {
    return {
      success: false,
      status: 409,
      message: "Your seat lock has expired.",
    };
  }

  let seatLabels;

  try {
    seatLabels = JSON.parse(lockedSeats);
  } catch (err) {
    return {
      success: false,
      status: 409,
      message: "Invalid seat lock data.",
    };
  }

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

const releaseSeatLocks = async ({
  showId,
  seatLabels,
  userId,
}) => {
  const keysToDelete = [];

  for (const seatLabel of seatLabels) {
    const key = `seat_lock:${showId}:${seatLabel}`;

    const lockedUser = await redisClient.get(key);

    if (lockedUser === userId.toString()) {
      keysToDelete.push(key);
    }
  }

  if (keysToDelete.length > 0) {
    await redisClient.del(...keysToDelete);
  }

  const bookingKey = `booking_lock:${userId}:${showId}`;

  await redisClient.del(bookingKey);

  return {
    released: keysToDelete.length,
  };
};

module.exports = {
  lockSeats,
  verifySeatLocks,
  releaseSeatLocks,
  LOCK_TTL,
};