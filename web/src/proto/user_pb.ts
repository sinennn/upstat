import {
  readFields,
  serializeBinary,
  UpstatMessage,
  type FieldSpec,
} from "./upstat-message";

/**
 * Hand-maintained mirror of `src/proto/user.proto` + `src/proto/insight.proto`
 * (which in turn mirror `api/common/internal/proto`). RPC/message/field
 * numbering must stay in sync with the Go proto contracts.
 */

/* ------------------------------ UserService ------------------------------ */

export class GetUserRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "string" },
  ];
  spec(): FieldSpec[] {
    return GetUserRequest.SPEC;
  }
  getEmail(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setEmail(v: string): GetUserRequest {
    this["setField"](1, v);
    return this;
  }
  getPassword(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  setPassword(v: string): GetUserRequest {
    this["setField"](2, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): GetUserRequest {
    const m = new GetUserRequest();
    readFields(m, GetUserRequest.SPEC, bytes);
    return m;
  }
}

export class GetUserResponse extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "string" },
    { n: 3, k: "string" },
    { n: 4, k: "string" },
    { n: 5, k: "string" },
    { n: 6, k: "string" },
  ];
  spec(): FieldSpec[] {
    return GetUserResponse.SPEC;
  }
  getId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setId(v: string): GetUserResponse {
    this["setField"](1, v);
    return this;
  }
  getName(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  setName(v: string): GetUserResponse {
    this["setField"](2, v);
    return this;
  }
  getEmail(): string {
    return (this["field"](3) as string | undefined) ?? "";
  }
  setEmail(v: string): GetUserResponse {
    this["setField"](3, v);
    return this;
  }
  getToken(): string {
    return (this["field"](4) as string | undefined) ?? "";
  }
  setToken(v: string): GetUserResponse {
    this["setField"](4, v);
    return this;
  }
  getStatus(): string {
    return (this["field"](5) as string | undefined) ?? "";
  }
  setStatus(v: string): GetUserResponse {
    this["setField"](5, v);
    return this;
  }
  getData(): string {
    return (this["field"](6) as string | undefined) ?? "";
  }
  setData(v: string): GetUserResponse {
    this["setField"](6, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): GetUserResponse {
    const m = new GetUserResponse();
    readFields(m, GetUserResponse.SPEC, bytes);
    return m;
  }
}

export class GoogleAuthRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [{ n: 1, k: "string" }];
  spec(): FieldSpec[] {
    return GoogleAuthRequest.SPEC;
  }
  getIdToken(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setIdToken(v: string): GoogleAuthRequest {
    this["setField"](1, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): GoogleAuthRequest {
    const m = new GoogleAuthRequest();
    readFields(m, GoogleAuthRequest.SPEC, bytes);
    return m;
  }
}

export class CreateUserRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "string" },
    { n: 3, k: "string" },
  ];
  spec(): FieldSpec[] {
    return CreateUserRequest.SPEC;
  }
  getName(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setName(v: string): CreateUserRequest {
    this["setField"](1, v);
    return this;
  }
  getEmail(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  setEmail(v: string): CreateUserRequest {
    this["setField"](2, v);
    return this;
  }
  getPassword(): string {
    return (this["field"](3) as string | undefined) ?? "";
  }
  setPassword(v: string): CreateUserRequest {
    this["setField"](3, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): CreateUserRequest {
    const m = new CreateUserRequest();
    readFields(m, CreateUserRequest.SPEC, bytes);
    return m;
  }
}

export class CreateUserResponse extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "string" },
  ];
  spec(): FieldSpec[] {
    return CreateUserResponse.SPEC;
  }
  getData(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setData(v: string): CreateUserResponse {
    this["setField"](1, v);
    return this;
  }
  getStatus(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  setStatus(v: string): CreateUserResponse {
    this["setField"](2, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): CreateUserResponse {
    const m = new CreateUserResponse();
    readFields(m, CreateUserResponse.SPEC, bytes);
    return m;
  }
}

export class UpdateUserRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "string" },
    { n: 3, k: "string" },
    { n: 4, k: "string" },
  ];
  spec(): FieldSpec[] {
    return UpdateUserRequest.SPEC;
  }
  getId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setId(v: string): UpdateUserRequest {
    this["setField"](1, v);
    return this;
  }
  getName(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  setName(v: string): UpdateUserRequest {
    this["setField"](2, v);
    return this;
  }
  getEmail(): string {
    return (this["field"](3) as string | undefined) ?? "";
  }
  setEmail(v: string): UpdateUserRequest {
    this["setField"](3, v);
    return this;
  }
  getPassword(): string {
    return (this["field"](4) as string | undefined) ?? "";
  }
  setPassword(v: string): UpdateUserRequest {
    this["setField"](4, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): UpdateUserRequest {
    const m = new UpdateUserRequest();
    readFields(m, UpdateUserRequest.SPEC, bytes);
    return m;
  }
}

export class UpdateUserResponse extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "string" },
  ];
  spec(): FieldSpec[] {
    return UpdateUserResponse.SPEC;
  }
  getData(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setData(v: string): UpdateUserResponse {
    this["setField"](1, v);
    return this;
  }
  getStatus(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  setStatus(v: string): UpdateUserResponse {
    this["setField"](2, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): UpdateUserResponse {
    const m = new UpdateUserResponse();
    readFields(m, UpdateUserResponse.SPEC, bytes);
    return m;
  }
}

export class DeleteUserRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
  ];
  spec(): FieldSpec[] {
    return DeleteUserRequest.SPEC;
  }
  getId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setId(v: string): DeleteUserRequest {
    this["setField"](1, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): DeleteUserRequest {
    const m = new DeleteUserRequest();
    readFields(m, DeleteUserRequest.SPEC, bytes);
    return m;
  }
}

export class DeleteUserResponse extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "string" },
  ];
  spec(): FieldSpec[] {
    return DeleteUserResponse.SPEC;
  }
  getData(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setData(v: string): DeleteUserResponse {
    this["setField"](1, v);
    return this;
  }
  getStatus(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  setStatus(v: string): DeleteUserResponse {
    this["setField"](2, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): DeleteUserResponse {
    const m = new DeleteUserResponse();
    readFields(m, DeleteUserResponse.SPEC, bytes);
    return m;
  }
}

export class Empty extends UpstatMessage {
  static SPEC: FieldSpec[] = [];
  spec(): FieldSpec[] {
    return Empty.SPEC;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): Empty {
    const m = new Empty();
    readFields(m, Empty.SPEC, bytes);
    return m;
  }
}

export class GetAllUsersResponse extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "repeated_message", MessageType: GetUserResponse, spec: GetUserResponse.SPEC },
  ];
  spec(): FieldSpec[] {
    return GetAllUsersResponse.SPEC;
  }
  getUsersList(): GetUserResponse[] {
    return (this["field"](1) as GetUserResponse[] | undefined) ?? [];
  }
  addUsers(v: GetUserResponse): GetAllUsersResponse {
    const arr = this["field"](1) as GetUserResponse[] | undefined;
    const next = arr ?? [];
    next.push(v);
    this["setField"](1, next);
    return this;
  }
  clearUsersList(): GetAllUsersResponse {
    this["setField"](1, []);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): GetAllUsersResponse {
    const m = new GetAllUsersResponse();
    readFields(m, GetAllUsersResponse.SPEC, bytes);
    return m;
  }
}

/* ----------------------------- MonitorService ---------------------------- */

export class Monitor extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "string" },
    { n: 3, k: "string" },
    { n: 4, k: "string" },
    { n: 5, k: "string" },
    { n: 6, k: "string" },
    { n: 7, k: "string" },
    { n: 8, k: "bool" },
    { n: 9, k: "string" },
    { n: 10, k: "int32" },
    { n: 11, k: "int32" },
    { n: 12, k: "int32" },
    { n: 13, k: "int32" },
    { n: 14, k: "string" },
    { n: 15, k: "int64" },
    { n: 16, k: "int32" },
    { n: 17, k: "bool" },
  ];
  spec(): FieldSpec[] {
    return Monitor.SPEC;
  }
  getId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setId(v: string): Monitor {
    this["setField"](1, v);
    return this;
  }
  getOwnerId(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  setOwnerId(v: string): Monitor {
    this["setField"](2, v);
    return this;
  }
  getName(): string {
    return (this["field"](3) as string | undefined) ?? "";
  }
  setName(v: string): Monitor {
    this["setField"](3, v);
    return this;
  }
  getType(): string {
    return (this["field"](4) as string | undefined) ?? "";
  }
  setType(v: string): Monitor {
    this["setField"](4, v);
    return this;
  }
  getTarget(): string {
    return (this["field"](5) as string | undefined) ?? "";
  }
  setTarget(v: string): Monitor {
    this["setField"](5, v);
    return this;
  }
  getCreatedAt(): string {
    return (this["field"](6) as string | undefined) ?? "";
  }
  getUpdatedAt(): string {
    return (this["field"](7) as string | undefined) ?? "";
  }
  getActive(): boolean {
    return (this["field"](8) as boolean | undefined) ?? false;
  }
  setActive(v: boolean): Monitor {
    this["setField"](8, v);
    return this;
  }
  getStatus(): string {
    return (this["field"](9) as string | undefined) ?? "";
  }
  setStatus(v: string): Monitor {
    this["setField"](9, v);
    return this;
  }
  getIntervalSeconds(): number {
    return (this["field"](10) as number | undefined) ?? 0;
  }
  getTimeoutSeconds(): number {
    return (this["field"](11) as number | undefined) ?? 0;
  }
  getFailureThreshold(): number {
    return (this["field"](12) as number | undefined) ?? 0;
  }
  getConsecutiveFailures(): number {
    return (this["field"](13) as number | undefined) ?? 0;
  }
  getLastCheckedAt(): string {
    return (this["field"](14) as string | undefined) ?? "";
  }
  getLastResponseTimeMs(): number {
    return (this["field"](15) as number | undefined) ?? 0;
  }
  getLastStatusCode(): number {
    return (this["field"](16) as number | undefined) ?? 0;
  }
  getMuted(): boolean {
    return (this["field"](17) as boolean | undefined) ?? false;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): Monitor {
    const m = new Monitor();
    readFields(m, Monitor.SPEC, bytes);
    return m;
  }
}

/** Note: proto field #2 on MonitorResponse is `string Status`. */
export class MonitorResponse extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "message", MessageType: Monitor, spec: Monitor.SPEC },
    { n: 2, k: "string" },
  ];
  spec(): FieldSpec[] {
    return MonitorResponse.SPEC;
  }
  getMonitor(): Monitor | undefined {
    return this["field"](1) as Monitor | undefined;
  }
  setMonitor(v: Monitor): MonitorResponse {
    this["setField"](1, v);
    return this;
  }
  getStatus(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  setStatus(v: string): MonitorResponse {
    this["setField"](2, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): MonitorResponse {
    const m = new MonitorResponse();
    readFields(m, MonitorResponse.SPEC, bytes);
    return m;
  }
}

export class CreateMonitorRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "string" },
    { n: 3, k: "string" },
    { n: 4, k: "int32" },
    { n: 5, k: "int32" },
    { n: 6, k: "int32" },
  ];
  spec(): FieldSpec[] {
    return CreateMonitorRequest.SPEC;
  }
  getName(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setName(v: string): CreateMonitorRequest {
    this["setField"](1, v);
    return this;
  }
  getType(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  setType(v: string): CreateMonitorRequest {
    this["setField"](2, v);
    return this;
  }
  getTarget(): string {
    return (this["field"](3) as string | undefined) ?? "";
  }
  setTarget(v: string): CreateMonitorRequest {
    this["setField"](3, v);
    return this;
  }
  getIntervalSeconds(): number {
    return (this["field"](4) as number | undefined) ?? 0;
  }
  setIntervalSeconds(v: number): CreateMonitorRequest {
    this["setField"](4, v);
    return this;
  }
  getTimeoutSeconds(): number {
    return (this["field"](5) as number | undefined) ?? 0;
  }
  setTimeoutSeconds(v: number): CreateMonitorRequest {
    this["setField"](5, v);
    return this;
  }
  getFailureThreshold(): number {
    return (this["field"](6) as number | undefined) ?? 0;
  }
  setFailureThreshold(v: number): CreateMonitorRequest {
    this["setField"](6, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): CreateMonitorRequest {
    const m = new CreateMonitorRequest();
    readFields(m, CreateMonitorRequest.SPEC, bytes);
    return m;
  }
}

/** proto3 optional scalars (active/muted/interval/etc.) — 0/unset = omitted. */
export class UpdateMonitorRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "string" },
    { n: 3, k: "string" },
    { n: 4, k: "string" },
    { n: 5, k: "bool" },
    { n: 6, k: "bool" },
    { n: 7, k: "int32" },
    { n: 8, k: "int32" },
    { n: 9, k: "int32" },
  ];
  spec(): FieldSpec[] {
    return UpdateMonitorRequest.SPEC;
  }
  getId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setId(v: string): UpdateMonitorRequest {
    this["setField"](1, v);
    return this;
  }
  getName(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  setName(v: string): UpdateMonitorRequest {
    this["setField"](2, v);
    return this;
  }
  getType(): string {
    return (this["field"](3) as string | undefined) ?? "";
  }
  setType(v: string): UpdateMonitorRequest {
    this["setField"](3, v);
    return this;
  }
  getTarget(): string {
    return (this["field"](4) as string | undefined) ?? "";
  }
  setTarget(v: string): UpdateMonitorRequest {
    this["setField"](4, v);
    return this;
  }
  /** Optional bool: undefined when not set. */
  getActive(): boolean | undefined {
    return this["field"](5) as boolean | undefined;
  }
  setActive(v: boolean): UpdateMonitorRequest {
    this["setField"](5, v);
    return this;
  }
  getMuted(): boolean | undefined {
    return this["field"](6) as boolean | undefined;
  }
  setMuted(v: boolean): UpdateMonitorRequest {
    this["setField"](6, v);
    return this;
  }
  getIntervalSeconds(): number | undefined {
    return this["field"](7) as number | undefined;
  }
  setIntervalSeconds(v: number): UpdateMonitorRequest {
    this["setField"](7, v);
    return this;
  }
  getTimeoutSeconds(): number | undefined {
    return this["field"](8) as number | undefined;
  }
  setTimeoutSeconds(v: number): UpdateMonitorRequest {
    this["setField"](8, v);
    return this;
  }
  getFailureThreshold(): number | undefined {
    return this["field"](9) as number | undefined;
  }
  setFailureThreshold(v: number): UpdateMonitorRequest {
    this["setField"](9, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): UpdateMonitorRequest {
    const m = new UpdateMonitorRequest();
    readFields(m, UpdateMonitorRequest.SPEC, bytes);
    return m;
  }
}

export class GetMonitorRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [{ n: 1, k: "string" }];
  spec(): FieldSpec[] {
    return GetMonitorRequest.SPEC;
  }
  getId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setId(v: string): GetMonitorRequest {
    this["setField"](1, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): GetMonitorRequest {
    const m = new GetMonitorRequest();
    readFields(m, GetMonitorRequest.SPEC, bytes);
    return m;
  }
}

export class DeleteMonitorRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [{ n: 1, k: "string" }];
  spec(): FieldSpec[] {
    return DeleteMonitorRequest.SPEC;
  }
  getId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setId(v: string): DeleteMonitorRequest {
    this["setField"](1, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): DeleteMonitorRequest {
    const m = new DeleteMonitorRequest();
    readFields(m, DeleteMonitorRequest.SPEC, bytes);
    return m;
  }
}

export class DeleteMonitorResponse extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "string" },
  ];
  spec(): FieldSpec[] {
    return DeleteMonitorResponse.SPEC;
  }
  getData(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  getStatus(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): DeleteMonitorResponse {
    const m = new DeleteMonitorResponse();
    readFields(m, DeleteMonitorResponse.SPEC, bytes);
    return m;
  }
}

export class ListMonitorsRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [];
  spec(): FieldSpec[] {
    return ListMonitorsRequest.SPEC;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): ListMonitorsRequest {
    const m = new ListMonitorsRequest();
    readFields(m, ListMonitorsRequest.SPEC, bytes);
    return m;
  }
}

export class ListMonitorsResponse extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "repeated_message", MessageType: Monitor, spec: Monitor.SPEC },
  ];
  spec(): FieldSpec[] {
    return ListMonitorsResponse.SPEC;
  }
  getMonitorsList(): Monitor[] {
    return (this["field"](1) as Monitor[] | undefined) ?? [];
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): ListMonitorsResponse {
    const m = new ListMonitorsResponse();
    readFields(m, ListMonitorsResponse.SPEC, bytes);
    return m;
  }
}

export class GetStatusPageRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "string" },
  ];
  spec(): FieldSpec[] {
    return GetStatusPageRequest.SPEC;
  }
  getOwnerId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setOwnerId(v: string): GetStatusPageRequest {
    this["setField"](1, v);
    return this;
  }
  getSlug(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  setSlug(v: string): GetStatusPageRequest {
    this["setField"](2, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): GetStatusPageRequest {
    const m = new GetStatusPageRequest();
    readFields(m, GetStatusPageRequest.SPEC, bytes);
    return m;
  }
}

export class Incident extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "string" },
    { n: 3, k: "string" },
    { n: 4, k: "string" },
    { n: 5, k: "string" },
    { n: 6, k: "string" },
    { n: 7, k: "string" },
    { n: 8, k: "int64" },
  ];
  spec(): FieldSpec[] {
    return Incident.SPEC;
  }
  getId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setId(v: string): Incident {
    this["setField"](1, v);
    return this;
  }
  getMonitorId(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  getTitle(): string {
    return (this["field"](3) as string | undefined) ?? "";
  }
  getFailureReason(): string {
    return (this["field"](4) as string | undefined) ?? "";
  }
  getStatus(): string {
    return (this["field"](5) as string | undefined) ?? "";
  }
  getStartedAt(): string {
    return (this["field"](6) as string | undefined) ?? "";
  }
  getResolvedAt(): string {
    return (this["field"](7) as string | undefined) ?? "";
  }
  getDurationSeconds(): number {
    return (this["field"](8) as number | undefined) ?? 0;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): Incident {
    const m = new Incident();
    readFields(m, Incident.SPEC, bytes);
    return m;
  }
}

export class MonitorUptimeDay extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "bool" },
    { n: 2, k: "string" },
    { n: 3, k: "double" },
    { n: 4, k: "int64" },
  ];
  spec(): FieldSpec[] {
    return MonitorUptimeDay.SPEC;
  }
  getHasData(): boolean {
    return (this["field"](1) as boolean | undefined) ?? false;
  }
  getDate(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  getUptimePct(): number {
    return (this["field"](3) as number | undefined) ?? 0;
  }
  getDownMinutes(): number {
    return (this["field"](4) as number | undefined) ?? 0;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): MonitorUptimeDay {
    const m = new MonitorUptimeDay();
    readFields(m, MonitorUptimeDay.SPEC, bytes);
    return m;
  }
}

/** One status-page component row (proto field parity with
 *  `StatusPageComponent` in `src/proto/user.proto`). */
export class StatusPageComponent extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" }, // monitor_id
    { n: 2, k: "string" }, // name
    { n: 3, k: "string" }, // status
    { n: 4, k: "bool" }, //   has_uptime
    { n: 5, k: "double" }, // uptime_pct
    { n: 6, k: "int64" }, //  last_response_time_ms
    { n: 7, k: "repeated_message", MessageType: MonitorUptimeDay, spec: MonitorUptimeDay.SPEC },
    { n: 8, k: "int64" }, //  p95_ms
    { n: 9, k: "string" }, // last_check_at
  ];
  spec(): FieldSpec[] {
    return StatusPageComponent.SPEC;
  }
  getMonitorId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  getName(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  getStatus(): string {
    return (this["field"](3) as string | undefined) ?? "";
  }
  getHasUptime(): boolean {
    return (this["field"](4) as boolean | undefined) ?? false;
  }
  getUptimePct(): number {
    return (this["field"](5) as number | undefined) ?? 0;
  }
  getLastResponseTimeMs(): number {
    return (this["field"](6) as number | undefined) ?? 0;
  }
  getDaysList(): MonitorUptimeDay[] {
    return (this["field"](7) as MonitorUptimeDay[] | undefined) ?? [];
  }
  getP95Ms(): number {
    return (this["field"](8) as number | undefined) ?? 0;
  }
  getLastCheckAt(): string {
    return (this["field"](9) as string | undefined) ?? "";
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): StatusPageComponent {
    const m = new StatusPageComponent();
    readFields(m, StatusPageComponent.SPEC, bytes);
    return m;
  }
}

export class GetStatusPageResponse extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "repeated_message", MessageType: Monitor, spec: Monitor.SPEC },
    { n: 2, k: "repeated_message", MessageType: Incident, spec: Incident.SPEC },
    { n: 3, k: "repeated_message", MessageType: Incident, spec: Incident.SPEC },
    { n: 4, k: "double" },
    { n: 5, k: "int64" },
    { n: 6, k: "int64" },
    { n: 7, k: "string" },
    { n: 8, k: "repeated_message", MessageType: StatusPageComponent, spec: StatusPageComponent.SPEC },
  ];
  spec(): FieldSpec[] {
    return GetStatusPageResponse.SPEC;
  }
  getMonitorsList(): Monitor[] {
    return (this["field"](1) as Monitor[] | undefined) ?? [];
  }
  getActiveIncidentsList(): Incident[] {
    return (this["field"](2) as Incident[] | undefined) ?? [];
  }
  getHistoricalIncidentsList(): Incident[] {
    return (this["field"](3) as Incident[] | undefined) ?? [];
  }
  getUptimePercentage(): number {
    return (this["field"](4) as number | undefined) ?? 0;
  }
  getTotalChecks(): number {
    return (this["field"](5) as number | undefined) ?? 0;
  }
  getSuccessfulChecks(): number {
    return (this["field"](6) as number | undefined) ?? 0;
  }
  /** Page name from the StatusPage document (falls back to slug). */
  getPageName(): string {
    return (this["field"](7) as string | undefined) ?? "";
  }
  getComponentsList(): StatusPageComponent[] {
    return (this["field"](8) as StatusPageComponent[] | undefined) ?? [];
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): GetStatusPageResponse {
    const m = new GetStatusPageResponse();
    readFields(m, GetStatusPageResponse.SPEC, bytes);
    return m;
  }
}

export class MonitorCheck extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "bool" },
    { n: 3, k: "int32" },
    { n: 4, k: "int32" },
    { n: 5, k: "string" },
  ];
  spec(): FieldSpec[] {
    return MonitorCheck.SPEC;
  }
  getMonitorId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  getSuccess(): boolean {
    return (this["field"](2) as boolean | undefined) ?? false;
  }
  getResponseTime(): number {
    return (this["field"](3) as number | undefined) ?? 0;
  }
  getStatusCode(): number {
    return (this["field"](4) as number | undefined) ?? 0;
  }
  getCheckedAt(): string {
    return (this["field"](5) as string | undefined) ?? "";
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): MonitorCheck {
    const m = new MonitorCheck();
    readFields(m, MonitorCheck.SPEC, bytes);
    return m;
  }
}

export class GetRecentChecksRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "int32" },
  ];
  spec(): FieldSpec[] {
    return GetRecentChecksRequest.SPEC;
  }
  getMonitorId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setMonitorId(v: string): GetRecentChecksRequest {
    this["setField"](1, v);
    return this;
  }
  getLimit(): number {
    return (this["field"](2) as number | undefined) ?? 0;
  }
  setLimit(v: number): GetRecentChecksRequest {
    this["setField"](2, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): GetRecentChecksRequest {
    const m = new GetRecentChecksRequest();
    readFields(m, GetRecentChecksRequest.SPEC, bytes);
    return m;
  }
}

export class GetRecentChecksResponse extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "repeated_message", MessageType: MonitorCheck, spec: MonitorCheck.SPEC },
  ];
  spec(): FieldSpec[] {
    return GetRecentChecksResponse.SPEC;
  }
  getChecksList(): MonitorCheck[] {
    return (this["field"](1) as MonitorCheck[] | undefined) ?? [];
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): GetRecentChecksResponse {
    const m = new GetRecentChecksResponse();
    readFields(m, GetRecentChecksResponse.SPEC, bytes);
    return m;
  }
}

export class GetMonitorHistoryRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "int32" },
    { n: 3, k: "int32" },
  ];
  spec(): FieldSpec[] {
    return GetMonitorHistoryRequest.SPEC;
  }
  getMonitorId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setMonitorId(v: string): GetMonitorHistoryRequest {
    this["setField"](1, v);
    return this;
  }
  getDays(): number {
    return (this["field"](2) as number | undefined) ?? 0;
  }
  setDays(v: number): GetMonitorHistoryRequest {
    this["setField"](2, v);
    return this;
  }
  getLimit(): number {
    return (this["field"](3) as number | undefined) ?? 0;
  }
  setLimit(v: number): GetMonitorHistoryRequest {
    this["setField"](3, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): GetMonitorHistoryRequest {
    const m = new GetMonitorHistoryRequest();
    readFields(m, GetMonitorHistoryRequest.SPEC, bytes);
    return m;
  }
}

export class GetMonitorHistoryResponse extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "repeated_message", MessageType: MonitorCheck, spec: MonitorCheck.SPEC },
    { n: 2, k: "repeated_message", MessageType: MonitorUptimeDay, spec: MonitorUptimeDay.SPEC },
    { n: 3, k: "double" },
    { n: 4, k: "bool" },
  ];
  spec(): FieldSpec[] {
    return GetMonitorHistoryResponse.SPEC;
  }
  getRecentChecksList(): MonitorCheck[] {
    return (this["field"](1) as MonitorCheck[] | undefined) ?? [];
  }
  getDaysList(): MonitorUptimeDay[] {
    return (this["field"](2) as MonitorUptimeDay[] | undefined) ?? [];
  }
  getOverallUptimePct(): number {
    return (this["field"](3) as number | undefined) ?? 0;
  }
  getHasUptime(): boolean {
    return (this["field"](4) as boolean | undefined) ?? false;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): GetMonitorHistoryResponse {
    const m = new GetMonitorHistoryResponse();
    readFields(m, GetMonitorHistoryResponse.SPEC, bytes);
    return m;
  }
}

export class ListIncidentsRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [{ n: 1, k: "string" }];
  spec(): FieldSpec[] {
    return ListIncidentsRequest.SPEC;
  }
  getMonitorId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setMonitorId(v: string): ListIncidentsRequest {
    this["setField"](1, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): ListIncidentsRequest {
    const m = new ListIncidentsRequest();
    readFields(m, ListIncidentsRequest.SPEC, bytes);
    return m;
  }
}

export class ListIncidentsResponse extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "repeated_message", MessageType: Incident, spec: Incident.SPEC },
  ];
  spec(): FieldSpec[] {
    return ListIncidentsResponse.SPEC;
  }
  getIncidentsList(): Incident[] {
    return (this["field"](1) as Incident[] | undefined) ?? [];
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): ListIncidentsResponse {
    const m = new ListIncidentsResponse();
    readFields(m, ListIncidentsResponse.SPEC, bytes);
    return m;
  }
}

/* ------------------------------ Insight ------------------------------ */

export class GetMonitorInsightRequest extends UpstatMessage {
  static SPEC: FieldSpec[] = [{ n: 1, k: "string" }];
  spec(): FieldSpec[] {
    return GetMonitorInsightRequest.SPEC;
  }
  getMonitorId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  setMonitorId(v: string): GetMonitorInsightRequest {
    this["setField"](1, v);
    return this;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): GetMonitorInsightRequest {
    const m = new GetMonitorInsightRequest();
    readFields(m, GetMonitorInsightRequest.SPEC, bytes);
    return m;
  }
}

export class MonitorInsight extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "string" },
    { n: 2, k: "string" },
    { n: 3, k: "int32" },
    { n: 4, k: "bool" },
    { n: 5, k: "string" },
    { n: 6, k: "string" },
    { n: 7, k: "string" },
    { n: 8, k: "string" },
    { n: 9, k: "string" },
  ];
  spec(): FieldSpec[] {
    return MonitorInsight.SPEC;
  }
  getMonitorId(): string {
    return (this["field"](1) as string | undefined) ?? "";
  }
  getMonitorName(): string {
    return (this["field"](2) as string | undefined) ?? "";
  }
  getRiskScore(): number {
    return (this["field"](3) as number | undefined) ?? 0;
  }
  getAnomalyDetected(): boolean {
    return (this["field"](4) as boolean | undefined) ?? false;
  }
  getSeverity(): string {
    return (this["field"](5) as string | undefined) ?? "";
  }
  getSummary(): string {
    return (this["field"](6) as string | undefined) ?? "";
  }
  getRecommendedAction(): string {
    return (this["field"](7) as string | undefined) ?? "";
  }
  getHumanReadable(): string {
    return (this["field"](8) as string | undefined) ?? "";
  }
  getGeneratedAt(): string {
    return (this["field"](9) as string | undefined) ?? "";
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): MonitorInsight {
    const m = new MonitorInsight();
    readFields(m, MonitorInsight.SPEC, bytes);
    return m;
  }
}

export class GetMonitorInsightResponse extends UpstatMessage {
  static SPEC: FieldSpec[] = [
    { n: 1, k: "message", MessageType: MonitorInsight, spec: MonitorInsight.SPEC },
  ];
  spec(): FieldSpec[] {
    return GetMonitorInsightResponse.SPEC;
  }
  getInsight(): MonitorInsight | undefined {
    return this["field"](1) as MonitorInsight | undefined;
  }
  serializeBinary(): Uint8Array {
    return serializeBinary(this);
  }
  static deserializeBinary(bytes: Uint8Array): GetMonitorInsightResponse {
    const m = new GetMonitorInsightResponse();
    readFields(m, GetMonitorInsightResponse.SPEC, bytes);
    return m;
  }
}

