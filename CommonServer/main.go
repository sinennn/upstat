package main

import (
	"github.com/CuesoftCloud/upstat/config"
	pb "github.com/CuesoftCloud/upstat/proto"
	"github.com/CuesoftCloud/upstat/services"
	"github.com/CuesoftCloud/upstat/utils"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
	"log"
	"net"
)

func main() {
	config.LoadEnv()

	db := config.NewDBHandler()

	listener, err := net.Listen("tcp", ":8080")
	if err != nil {
		log.Fatal("could not listen on :8080:", err)
	}

	server := grpc.NewServer(
		grpc.UnaryInterceptor(utils.AuthenticateInterceptor),
	)
	pb.RegisterUserServiceServer(server, services.NewUserServiceServer(db))
	reflection.Register(server)

	log.Println("gRPC server started on :8080")
	if err := server.Serve(listener); err != nil {
		log.Fatal("could not start gRPC server:", err)
	}
}
