const redisClient = require("../../config/redis");

const LOCK_TTL = 300;

// Lock seats one by one and rollback already locked seats if one fails.
const lockSeats = async ({ showId, seatLabels, userId }) => {
  const lockedKeys = [];
  const bookingKey = `booking_lock:${userId}:${showId}`;

  if (!showId || !userId) {
    return {
      success: false,
      message: "Show ID and user ID are required.",
    };
  }

  if (!Array.isArray(seatLabels) || seatLabels.length === 0) {
    return {
      success: false,
      message: "At least one seat is required.",
    };
  }

  const uniqueSeatLabels = [...new Set(seatLabels)];

  try {
    for (const seatLabel of uniqueSeatLabels) {
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
          message: `Seat ${seatLabel} was just selected by another user.`,
        };
      }

      lockedKeys.push(key);
    }

    await redisClient.set(
      bookingKey,
      JSON.stringify(uniqueSeatLabels),
      {
        EX: LOCK_TTL,
      }
    );

    return {
      success: true,
      seatLabels: uniqueSeatLabels,
      expiresIn: LOCK_TTL,
    };
  } catch (err) {
    console.error("Redis seat lock error:", err);

    if (lockedKeys.length > 0) {
      await redisClient.del(...lockedKeys);
    }

    await redisClient.del(bookingKey);

    throw err;
  }
};

// Verify that all locked seats still exist and belong to the user.
const verifySeatLocks = async ({ showId, userId }) => {
  if (!showId || !userId) {
    return {
      success: false,
      status: 400,
      message: "Show ID and user ID are required.",
    };
  }

  const bookingKey = `booking_lock:${userId}:${showId}`;

  try {
    const lockedSeats = await redisClient.get(
      bookingKey
    );

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
      await redisClient.del(bookingKey);

      return {
        success: false,
        status: 409,
        message: "Invalid seat lock. Please select seats again.",
      };
    }

    if (
      !Array.isArray(seatLabels) ||
      seatLabels.length === 0
    ) {
      await redisClient.del(bookingKey);

      return {
        success: false,
        status: 409,
        message: "No seats are currently locked.",
      };
    }

    for (const seatLabel of seatLabels) {
      const seatKey = `seat_lock:${showId}:${seatLabel}`;

      const lockedUser = await redisClient.get(
        seatKey
      );

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
  } catch (err) {
    console.error(
      "Redis seat verification error:",
      err
    );

    throw err;
  }
};

// Release only seats owned by the current user.
const releaseSeatLocks = async ({
  showId,
  seatLabels,
  userId,
}) => {
  if (!showId || !userId) {
    return {
      success: false,
      released: 0,
      message: "Show ID and user ID are required.",
    };
  }

  if (
    !Array.isArray(seatLabels) ||
    seatLabels.length === 0
  ) {
    return {
      success: false,
      released: 0,
      message: "At least one seat is required.",
    };
  }

  const uniqueSeatLabels = [
    ...new Set(seatLabels),
  ];

  const releasedKeys = [];

  try {
    for (const seatLabel of uniqueSeatLabels) {
      const key = `seat_lock:${showId}:${seatLabel}`;

      const lockedUser = await redisClient.get(key);

      if (lockedUser === userId.toString()) {
        await redisClient.del(key);
        releasedKeys.push(key);
      }
    }

    const bookingKey = `booking_lock:${userId}:${showId}`;

    await redisClient.del(bookingKey);

    return {
      success: true,
      released: releasedKeys.length,
    };
  } catch (err) {
    console.error(
      "Redis seat release error:",
      err
    );

    throw err;
  }
};

module.exports = {
  lockSeats,
  verifySeatLocks,
  releaseSeatLocks,
  LOCK_TTL,
};