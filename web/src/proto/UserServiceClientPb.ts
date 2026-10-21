/**
 * @fileoverview gRPC-Web client stub for `proto.UserService`
 * (source: `src/proto/user.proto`, package `proto` — matches the Go backend).
 * Hand-maintained per `src/proto/upstat-message.ts`; the network boundary is
 * the models/repository layer, which alone calls into these.
 */

/* eslint-disable */
import * as grpcWeb from "grpc-web";

import * as user_pb from "./user_pb";

const PREFIX = "/proto.UserService";

/**
 * grpc-web 2.x exposes the promise-returning unary call as `unaryCall` at
 * runtime; its bundled typings still declare `thenableCall`, which does not
 * exist on the object (calling it throws). Type the real method here.
 */
interface UnaryClient {
  unaryCall<REQ, RESP>(
    method: string,
    request: REQ,
    metadata: grpcWeb.Metadata,
    descriptor: grpcWeb.MethodDescriptor<REQ, RESP>,
  ): Promise<RESP>;
}

function descriptor<REQ, RESP>(
  method: string,
  requestType: new () => REQ,
  responseType: { deserializeBinary(bytes: Uint8Array): RESP },
) {
  return new grpcWeb.MethodDescriptor(
    PREFIX + "/" + method,
    grpcWeb.MethodType.UNARY,
    requestType,
    responseType as unknown as new (...args: unknown[]) => RESP,
    (request: REQ) => (request as { serializeBinary(): Uint8Array }).serializeBinary(),
    (bytes: Uint8Array) => responseType.deserializeBinary(bytes),
  );
}

export class UserServiceClient {
  client_: UnaryClient;
  hostname_: string;

  constructor(hostname: string, _credentials?: null, _options?: null) {
    this.client_ = new grpcWeb.GrpcWebClientBase({
      format: "text",
    }) as unknown as UnaryClient;
    this.hostname_ = hostname.replace(/\/+$/, "");
  }

  getUser(
    request: user_pb.GetUserRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.GetUserResponse> {
    return this.client_.unaryCall(
      this.hostname_ + PREFIX + "/GetUser",
      request,
      metadata ?? {},
      descriptor("GetUser", user_pb.GetUserRequest, user_pb.GetUserResponse),
    );
  }

  googleAuth(
    request: user_pb.GoogleAuthRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.GetUserResponse> {
    return this.client_.unaryCall(
      this.hostname_ + PREFIX + "/GoogleAuth",
      request,
      metadata ?? {},
      descriptor("GoogleAuth", user_pb.GoogleAuthRequest, user_pb.GetUserResponse),
    );
  }

  createUser(
    request: user_pb.CreateUserRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.CreateUserResponse> {
    return this.client_.unaryCall(
      this.hostname_ + PREFIX + "/CreateUser",
      request,
      metadata ?? {},
      descriptor("CreateUser", user_pb.CreateUserRequest, user_pb.CreateUserResponse),
    );
  }

  updateUser(
    request: user_pb.UpdateUserRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.UpdateUserResponse> {
    return this.client_.unaryCall(
      this.hostname_ + PREFIX + "/UpdateUser",
      request,
      metadata ?? {},
      descriptor("UpdateUser", user_pb.UpdateUserRequest, user_pb.UpdateUserResponse),
    );
  }

  deleteUser(
    request: user_pb.DeleteUserRequest,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.DeleteUserResponse> {
    return this.client_.unaryCall(
      this.hostname_ + PREFIX + "/DeleteUser",
      request,
      metadata ?? {},
      descriptor("DeleteUser", user_pb.DeleteUserRequest, user_pb.DeleteUserResponse),
    );
  }

  getAllUsers(
    request: user_pb.Empty,
    metadata?: grpcWeb.Metadata,
  ): Promise<user_pb.GetAllUsersResponse> {
    return this.client_.unaryCall(
      this.hostname_ + PREFIX + "/GetAllUsers",
      request,
      metadata ?? {},
      descriptor("GetAllUsers", user_pb.Empty, user_pb.GetAllUsersResponse),
    );
  }
}
