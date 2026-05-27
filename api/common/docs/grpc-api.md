# Upstat CommonServer gRPC API

This document describes the gRPC API exposed by `CommonServer`.

## Server

Local development address:

```text
localhost:8080
```

Proto source of truth:

```text
CommonServer/proto/user.proto
```

Frontend/client proto copy:

```text
App/proto/user.proto
```

When the backend proto changes, regenerate the Go server bindings from `CommonServer`:

```bash
make generate_grpc_code
```

## Environment

The backend requires:

```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB=Upstat
JWT_SECRET=replace-with-a-long-random-secret
GOOGLE_CLIENT_ID=replace-with-google-client-id.apps.googleusercontent.com
BASE_URL=http://localhost:3000
SMTP_USERNAME=
SMTP_PASSWORD=
```

`GOOGLE_CLIENT_ID` must match the Google OAuth client used by the frontend to obtain the Google ID token.

## Service

```proto
service UserService {
  rpc GetUser(GetUserRequest) returns (GetUserResponse);
  rpc GoogleAuth(GoogleAuthRequest) returns (GetUserResponse);
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);
  rpc UpdateUser(UpdateUserRequest) returns (UpdateUserResponse);
  rpc DeleteUser(DeleteUserRequest) returns (DeleteUserResponse);
  rpc GetAllUsers(Empty) returns (GetAllUsersResponse);
}
```

## Auth Model

The backend issues its own app JWT after successful password login or Google auth.

Frontend should store the returned `token` and send it on authenticated app requests once protected RPCs are added.

Current auth interceptor is permissive and does not yet reject unauthenticated requests.

## Google Auth

Use this when the frontend signs a user in with Google.

The frontend must send the Google **ID token**, not the Google access token.

Method:

```text
proto.UserService/GoogleAuth
```

Request:

```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

Success response:

```json
{
  "id": "665f0e3fdc43b6a01e985f9a",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "token": "app.jwt.token",
  "status": "success"
}
```

Behavior:

- Verifies the Google ID token signature.
- Verifies the token issuer is Google.
- Verifies the token audience equals `GOOGLE_CLIENT_ID`.
- Requires Google email verification.
- Finds the local user by email.
- Creates a local user if one does not already exist.
- Returns the app JWT in `token`.

Common errors:

```text
Unauthenticated: GOOGLE_CLIENT_ID is not configured
Unauthenticated: invalid google token audience
Unauthenticated: google account email is not verified
Unauthenticated: invalid google id token
```

## Create User

Use this for email/password signup.

Method:

```text
proto.UserService/CreateUser
```

Request:

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "password123"
}
```

Success response:

```json
{
  "data": "user created successfully",
  "status": "success"
}
```

Common errors:

```text
InvalidArgument: name, email, and password are required
AlreadyExists: email already exists
Internal: could not create user
```

## Get User

Use this for email/password login when `password` is provided.

Method:

```text
proto.UserService/GetUser
```

Request:

```json
{
  "email": "ada@example.com",
  "password": "password123"
}
```

Success response:

```json
{
  "id": "665f0e3fdc43b6a01e985f9a",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "token": "app.jwt.token",
  "status": "success"
}
```

Common errors:

```text
NotFound: user not found
Unauthenticated: invalid login credentials
```

## Get All Users

Method:

```text
proto.UserService/GetAllUsers
```

Request:

```json
{}
```

Success response:

```json
{
  "users": [
    {
      "id": "665f0e3fdc43b6a01e985f9a",
      "name": "Ada Lovelace",
      "email": "ada@example.com",
      "status": "success"
    }
  ]
}
```

## Update User

Method:

```text
proto.UserService/UpdateUser
```

Request:

```json
{
  "id": "665f0e3fdc43b6a01e985f9a",
  "name": "Ada Byron",
  "email": "ada@example.com",
  "password": "new-password123"
}
```

Success response:

```json
{
  "data": "user updated successfully",
  "status": "success"
}
```

Notes:

- `id` is required.
- `name`, `email`, and `password` are optional update fields.
- If `password` is provided, the backend hashes it before storing.

## Delete User

Method:

```text
proto.UserService/DeleteUser
```

Request:

```json
{
  "id": "665f0e3fdc43b6a01e985f9a"
}
```

Success response:

```json
{
  "data": "user deleted successfully",
  "status": "success"
}
```

## Testing With Insomnia

1. Start the backend:

```bash
cd CommonServer
go run main.go
```

2. Create a gRPC request in Insomnia.

3. Use server address:

```text
localhost:8080
```

4. Import or reference:

```text
CommonServer/proto/user.proto
```

5. Select:

```text
proto.UserService
```

6. Choose the RPC method and send the JSON request body.
