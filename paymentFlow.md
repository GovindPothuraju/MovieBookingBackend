User
 │
 │ Select Seats
 │
 ▼
POST /bookings/lock
 │
 │
 ├── Validate seats
 ├── Check DB bookings
 ├── Lock seats in Redis (5 mins)
 └── Return success
 │
 ▼
Frontend
 │
 │ POST /payments/create-order
 ▼
Backend
 │
 ├── Verify Redis locks
 ├── Calculate amount on server
 ├── Create Razorpay Order
 ├── Save Payment(PENDING)
 └── Return order_id
 │
 ▼
Frontend
 │
 │ Razorpay Checkout Opens
 ▼
Razorpay
 │
 ├── Success
 ├── Failure
 └── User closes popup
 │
 ▼
Webhook (MOST IMPORTANT)
 │
 ├── Verify Razorpay Signature
 ├── payment.captured ?
 │
 ├── YES
 │     │
 │     ├── Begin Mongo Transaction
 │     ├── Verify Redis lock still exists
 │     ├── Verify booking doesn't already exist
 │     ├── Create Booking
 │     ├── Update Show
 │     ├── Update Payment SUCCESS
 │     ├── Generate QR Ticket
 │     ├── Send Email
 │     ├── Delete Redis Locks
 │     └── Commit
 │
 └── FAILED
       │
       ├── Update Payment FAILED
       ├── Delete Redis Locks
       └── Exit