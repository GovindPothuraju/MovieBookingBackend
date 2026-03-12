-- 🎬 Scalable Movie/Event Booking System – API Documentation

Base URL

/api/v1
🔐 AUTHENTICATION ROUTER

Handles user authentication and session management.

POST /auth/register → Register new user account
POST /auth/login → Login user and return JWT token
POST /auth/logout → Logout user (invalidate token/session)
POST /auth/refresh → Refresh JWT access token

Example:

POST /auth/register → Create new user (name, email, password, phone)
POST /auth/login → Authenticate user and generate JWT
POST /auth/logout → Remove session / blacklist token
POST /auth/refresh → Generate new access token using refresh token
👤 USER ROUTER

Handles user profile and account data.

GET /users/me → Get current logged-in user profile
PUT /users/me → Update profile details (name, phone, avatar)
DELETE /users/me → Delete user account
🎟 BOOKING HISTORY ROUTER
GET /users/me/bookings → Get all bookings of current user
GET /users/me/bookings/upcoming → Get upcoming bookings
GET /users/me/bookings/past → Get past bookings
🔎 SEARCH ROUTER

Handles event discovery and filtering (powered by Elasticsearch).

GET /search → Search events by name, location, or date
GET /search/trending → Get trending or popular events
GET /search/genres → Get available event genres
GET /search/cities → Get available cities for events

Example:

GET /search?q=spiderman&location=hyderabad&date=2026-04-20
🎬 EVENT ROUTER

Handles event metadata (movies, concerts, etc.).

GET /events → Get list of events (paginated)
GET /events/:eventId → Get detailed event information
GET /events/:eventId/showtimes → Get showtimes for an event
GET /events/trending → Get trending events
🏟 VENUE ROUTER

Handles venue information (theatres / concert halls).

GET /venues → Get all venues
GET /venues/:venueId → Get venue details
GET /venues/:venueId/showtimes → Get showtimes for a venue
⏰ SHOWTIME ROUTER

Handles showtime information for events.

GET /showtimes/:showId → Get showtime details
GET /showtimes/:showId/seats → Get seat map for a showtime
GET /showtimes/:showId/availability → Get seat availability summary

Example:

GET /showtimes/s123/seats → Fetch seat grid with seat status

Seat status types:

AVAILABLE
HELD
BOOKED
💺 SEAT ROUTER

Handles seat-level operations.

GET /seats/:showId → Get seats for showtime
GET /seats/:showId/available → Get available seats only
GET /seats/:showId/booked → Get booked seats
🪑 SEAT RESERVATION ROUTER

Handles temporary seat holds before booking confirmation.

POST /bookings/reserve → Reserve seats (create seat hold)
DELETE /bookings/reserve/:holdId → Release reserved seats
GET /bookings/reserve/:holdId → Get hold details

Example flow:

POST /bookings/reserve → User selects seats
System locks seats using Redis
Seat hold expires after 10–15 minutes
🎫 BOOKING ROUTER

Handles confirmed bookings.

POST /bookings/confirm → Confirm booking after payment
GET /bookings/:bookingId → Get booking details
DELETE /bookings/:bookingId → Cancel booking
GET /bookings/:bookingId/ticket → Get ticket with QR code
💳 PAYMENT ROUTER

Handles payment processing.

(Using Stripe or Razorpay)

POST /payments/create → Create payment intent
POST /payments/confirm → Confirm payment
POST /payments/refund → Initiate refund
POST /webhooks/payment → Payment gateway webhook
🛠 ADMIN ROUTER

Admin operations for managing events.

POST /admin/events → Create new event
PUT /admin/events/:eventId → Update event
DELETE /admin/events/:eventId → Delete event
Showtime Management
POST /admin/showtimes → Create showtime
PUT /admin/showtimes/:showId → Update showtime
DELETE /admin/showtimes/:showId → Delete showtime
Seat Management
POST /admin/showtimes/:showId/seats → Generate seats for showtime
PATCH /admin/showtimes/:showId/seats → Update seat layout