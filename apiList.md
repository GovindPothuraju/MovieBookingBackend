# QuickMovie Backend API Documentation

The QuickMovie Backend is a RESTful API built with Node.js and Express, providing a robust admin-focused movie ticket booking management system.

**Base URL**: `http://localhost:3000/api/admin`

---

## 🔐 Authentication

Most endpoints are protected and require a `Bearer` token in the `Authorization` header.

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/auth/register` | `POST` | Public | Register a new admin account |
| `/auth/login` | `POST` | Public | Login and receive JWT in cookies/headers |
| `/auth/logout` | `POST` | Protected | Invalidate session |
| `/auth/change-password` | `PATCH` | Protected | Change current admin password | | ( not completed)

---

## 🎭 Theaters

Manage theaters and their associated screens.

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/theaters` | `GET` | Protected | List all theaters | 
 -- GET /theaters
| `/theaters` | `POST` | Protected | Create a new theater |
-- POST /theaters
| `/theaters/:id` | `GET` | Protected | Get theater details by ID |
-- GET /theaters/:id
| `/theaters/:id` | `PATCH` | Protected | Update theater details |
-- PATCH /theaters/:id
| `/theaters/:id` | `DELETE` | Protected | Delete a theater |
-- DELETE /theaters/:id
| `/theaters/:theaterId/screens` | `GET` | Protected | Get all screens for a specific theater |
-- GET /theaters/:theaterId/screens
| `/theaters/:theaterId/screens` | `POST` | Protected | Add a new screen to a theater |
-- POST /theaters/:theaterId/screens

---

## 📺 Screens & Seats

Manage screens and generate seat layouts.

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/screens/:id` | `PATCH` | Protected | Update screen details |
| `/screens/:id` | `DELETE` | Protected | Delete a screen |
| `/screens/:id/seats` | `GET` | Protected | Get all seats for a screen |
| `/screens/:id/seats/generate` | `POST` | Protected | Generate seat layout for a screen |

### Seat Generation Body
```json
{
  "rows": ["A", "B", "C"],
  "cols": 10,
  "categories": {
    "A": "VIP",
    "B": "Gold",
    "C": "Silver"
  }
}
```

---

## 🎬 Movies

Full CRUD operations for movie management.

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/movies` | `GET` | Protected | List all movies |
| `/movies` | `POST` | Protected | Add a new movie |
| `/movies/:id` | `GET` | Protected | Get movie details by ID |
| `/movies/:id` | `PATCH` | Protected | Update movie details |
| `/movies/:id` | `DELETE` | Protected | Remove a movie |

---

## 📅 Shows

Schedule and manage movie shows.

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/shows` | `GET` | Protected | List all scheduled shows |
| `/shows` | `POST` | Protected | Schedule a new show |
| `/shows/:id` | `GET` | Protected | Get show details by ID |
| `/shows/:id` | `PATCH` | Protected | Update show details (price map, status) |

---

## 💰 Pricing

Manage pricing configurations.

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/pricing` | `GET` | Protected | Get all pricing models |
| `/pricing` | `POST` | Protected | Create a pricing entry |
| `/pricing/:id` | `PATCH` | Protected | Update pricing details |
| `/pricing/:id` | `DELETE` | Protected | Remove a pricing entry |

---

## 🎟️ Bookings

Monitor and manage user bookings.

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/bookings` | `GET` | Protected | List all bookings |
| `/bookings/:id` | `GET` | Protected | Get booking details |
| `/bookings/:id/cancel` | `PATCH` | Protected | Cancel a booking |

---

## 📊 Analytics & Logs

System-wide analytics and audit trail.

| Endpoint | Method | Auth | Description |
| :--- | :--- | :--- | :--- |
| `/analytics/overview` | `GET` | Protected | Get system summary (theaters, movies, etc.) |
| `/analytics/revenue` | `GET` | Protected | Get revenue analytics |
| `/audit-logs` | `GET` | Protected | View user/admin action history |

---

## 🚀 Error Handling

Errors follow a standard format:
```json
{
  "success": false,
  "message": "Detailed error message"
}
```
