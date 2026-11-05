# Local secrets

Docker Compose mounts each value in this directory as a separate file under
`/run/secrets` inside the relevant container.

Create the local files before starting the stack:

- `django_secret_key.txt`
- `postgres_password.txt`

The real `*.txt` files are ignored by Git. The `*.example.txt` files document
the expected format and must never contain production credentials.

Docker Compose secrets protect values from being placed in container
environment variables, but the source files are not encrypted at rest. Keep
filesystem permissions appropriately restricted and use a production secret
manager outside local development.

