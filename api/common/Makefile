# Regenerate Go protobuf/gRPC stubs (requires protoc + protoc-gen-go{,-grpc}).
# -I internal/proto makes the `import "insight.proto"` in user.proto resolvable;
# outputs to internal/proto so `paths=source_relative` lands next to sources.
generate_grpc_code:
	PATH="$$PATH:$$(go env GOPATH)/bin" protoc -I internal/proto --go_out=internal/proto --go_opt=paths=source_relative \
		--go-grpc_out=internal/proto --go-grpc_opt=paths=source_relative \
		internal/proto/user.proto internal/proto/insight.proto
