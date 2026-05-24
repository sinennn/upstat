package utils

import (
	"context"
	"google.golang.org/grpc"
)

func AuthenticateInterceptor(
	ctx context.Context,
	req any,
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (any, error) {
	return handler(ctx, req)
}
