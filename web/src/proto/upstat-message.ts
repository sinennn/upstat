/**
 * Minimal typed protobuf message layer for the gRPC-Web control-plane client.
 *
 * The repo's proto toolchain (protoc 3.x + protoc-gen-grpc-web) emits
 * Closure/goog-style JS that does not fit the Next.js module graph, so the
 * messages are hand-maintained here against `src/proto/user.proto` /
 * `src/proto/insight.proto` (the checked-in sources mirror
 * `api/common/internal/proto`). Wire format is standard protobuf — these
 * classes only need `serializeBinary()`/`deserializeBinary()` for the
 * `grpc-web` MethodDescriptor contract.
 *
 * Regenerate-from-proto remains the long-term answer; every field added to a
 * `.proto` service must be mirrored in the corresponding class SPEC below.
 */
import * as jspb from "google-protobuf";

export type MessageSpec = FieldSpec[];

export interface FieldSpec {
  /** proto field number */
  n: number;
  k: "string" | "int32" | "int64" | "double" | "bool" | "message" | "repeated_message";
  /** constructor for message/repeated_message kinds */
  MessageType?: new () => UpstatMessage;
  /** nested spec for message/repeated_message kinds */
  spec?: FieldSpec[];
}

/** Base message: plain field map accessed by proto field number. */
export abstract class UpstatMessage {
  protected f: Record<number, unknown> = {};

  protected field(n: number): unknown {
    return this.f[n];
  }

  protected setField(n: number, v: unknown): void {
    this.f[n] = v;
  }

  abstract spec(): MessageSpec;
}

function writeValue(writer: jspb.BinaryWriter, f: FieldSpec, v: unknown): void {
  switch (f.k) {
    case "string":
      writer.writeString(f.n, v as string);
      break;
    case "int32":
      writer.writeInt32(f.n, v as number);
      break;
    case "int64":
      writer.writeInt64(f.n, v as number);
      break;
    case "double":
      writer.writeDouble(f.n, v as number);
      break;
    case "bool":
      writer.writeBool(f.n, v as boolean);
      break;
    case "message":
      writer.writeMessage(f.n, v as UpstatMessage, (m, w) => writeFields(w, m, f.spec ?? []));
      break;
    case "repeated_message":
      // jspb types this against its own Message base; the callback only ever
      // receives the UpstatMessage instances we pass in.
      writer.writeRepeatedMessage(f.n, v as unknown as jspb.Message[], (m, w) =>
        writeFields(w, m as unknown as UpstatMessage, f.spec ?? []),
      );
      break;
  }
}

/** Serialize `msg` (schema) fields into `writer`. */
export function writeFields(
  writer: jspb.BinaryWriter,
  msg: UpstatMessage,
  spec: MessageSpec,
): void {
  for (const f of spec) {
    const v = msg["field"](f.n);
    if (v === undefined || v === null) continue;
    writeValue(writer, f, v);
  }
}

/** Decode `bytes` into `msg` using `spec`. */
export function readFields(msg: UpstatMessage, spec: MessageSpec, bytes: Uint8Array): void {
  const reader = new jspb.BinaryReader(bytes);
  readFromReader(reader, msg, spec);
}

function readFromReader(reader: jspb.BinaryReader, msg: UpstatMessage, spec: MessageSpec): void {
  const byNumber = new Map<number, FieldSpec>(spec.map((f) => [f.n, f]));

  while (reader.nextField()) {
    if (reader.isEndGroup()) break;
    const n = reader.getFieldNumber();
    const f = byNumber.get(n);
    if (!f) {
      reader.skipField();
      continue;
    }

    switch (f.k) {
      case "string":
        msg["setField"](n, reader.readString());
        break;
      case "int32":
        msg["setField"](n, reader.readInt32());
        break;
      case "int64":
        msg["setField"](n, Number(reader.readInt64String()));
        break;
      case "double":
        msg["setField"](n, reader.readDouble());
        break;
      case "bool":
        msg["setField"](n, reader.readBool());
        break;
      case "message": {
        const m = new (f.MessageType as new () => UpstatMessage)();
        reader.readMessage(m, (sub, r) => readFromReader(r, sub, f.spec ?? []));
        msg["setField"](n, m);
        break;
      }
      case "repeated_message": {
        const m = new (f.MessageType as new () => UpstatMessage)();
        reader.readMessage(m, (sub, r) => readFromReader(r, sub, f.spec ?? []));
        const arr = (msg["field"](n) as UpstatMessage[] | undefined) ?? [];
        arr.push(m);
        msg["setField"](n, arr);
        break;
      }
    }
  }
}

/** serialize helper for concrete messages. */
export function serializeBinary(msg: UpstatMessage): Uint8Array {
  const writer = new jspb.BinaryWriter();
  writeFields(writer, msg, msg.spec());
  return writer.getResultBuffer();
}

/**
 * Populates `msg` by proto field number — for code that must build response
 * messages (the TEST_MODE fake backend) without per-field setters.
 */
export function withFields<T extends UpstatMessage>(
  msg: T,
  fields: Record<number, unknown>,
): T {
  for (const [n, v] of Object.entries(fields)) {
    if (v !== undefined) msg["setField"](Number(n), v);
  }
  return msg;
}
