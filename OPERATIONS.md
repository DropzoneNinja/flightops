To make a user an admin, update the database:

UPDATE users SET is_admin = true WHERE email = 'user@example.com';
The user will need to log in again to get a new JWT token with the updated admin status.
