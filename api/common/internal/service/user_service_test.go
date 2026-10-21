package service

import (
	"errors"
	"testing"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	pb "github.com/cuesoftinc/upstat/api/common/internal/proto"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// stubUsers is an in-memory UserRepository keyed by email.
type stubUsers struct {
	byEmail map[string]*model.User
	updated []string
	deleted []string
}

func (s *stubUsers) GetUser(email string) (*model.User, error) {
	if u, ok := s.byEmail[email]; ok {
		return u, nil
	}
	return nil, errors.New("not found")
}
func (s *stubUsers) GetUserByID(id string) (*model.User, error) {
	for _, u := range s.byEmail {
		if u.Id.Hex() == id {
			return u, nil
		}
	}
	return nil, errors.New("not found")
}
func (s *stubUsers) GetUsers() ([]*model.User, error) { return nil, nil }
func (s *stubUsers) CreateUser(model.User) (*mongo.InsertOneResult, error) {
	return &mongo.InsertOneResult{}, nil
}
func (s *stubUsers) UpdateUser(id string, _ model.User) (*mongo.UpdateResult, error) {
	s.updated = append(s.updated, id)
	return &mongo.UpdateResult{}, nil
}
func (s *stubUsers) DeleteUser(id string) (*mongo.DeleteResult, error) {
	s.deleted = append(s.deleted, id)
	return &mongo.DeleteResult{}, nil
}

func TestAccountRPCs_OnlyOnYourOwnAccount(t *testing.T) {
	me := primitive.NewObjectID().Hex()
	victim := primitive.NewObjectID().Hex()
	users := &stubUsers{byEmail: map[string]*model.User{}}
	srv := &UserServiceServer{userRepo: users}
	ctx := authedContext(t, me, "me@example.com")

	_, err := srv.UpdateUser(ctx, &pb.UpdateUserRequest{Id: victim, Name: "pwned"})
	if status.Code(err) != codes.PermissionDenied {
		t.Fatalf("UpdateUser on another account: want PermissionDenied, got %v", err)
	}
	_, err = srv.DeleteUser(ctx, &pb.DeleteUserRequest{Id: victim})
	if status.Code(err) != codes.PermissionDenied {
		t.Fatalf("DeleteUser on another account: want PermissionDenied, got %v", err)
	}
	if len(users.updated)+len(users.deleted) != 0 {
		t.Fatalf("repository was touched: updated=%v deleted=%v", users.updated, users.deleted)
	}

	if _, err := srv.UpdateUser(ctx, &pb.UpdateUserRequest{Id: me, Name: "Me"}); err != nil {
		t.Fatalf("UpdateUser on own account: %v", err)
	}
	if _, err := srv.DeleteUser(ctx, &pb.DeleteUserRequest{Id: me}); err != nil {
		t.Fatalf("DeleteUser on own account: %v", err)
	}
}

func TestUpdateUser_RejectsAnotherAccountsEmail(t *testing.T) {
	me := primitive.NewObjectID()
	other := primitive.NewObjectID()
	users := &stubUsers{byEmail: map[string]*model.User{
		"me@example.com":    {Id: me, Email: "me@example.com"},
		"taken@example.com": {Id: other, Email: "taken@example.com"},
	}}
	srv := &UserServiceServer{userRepo: users}
	ctx := authedContext(t, me.Hex(), "me@example.com")

	_, err := srv.UpdateUser(ctx, &pb.UpdateUserRequest{Id: me.Hex(), Email: "taken@example.com"})
	if status.Code(err) != codes.AlreadyExists {
		t.Fatalf("want AlreadyExists, got %v", err)
	}
	// re-saving your own current email is not a conflict
	if _, err := srv.UpdateUser(ctx, &pb.UpdateUserRequest{Id: me.Hex(), Email: "me@example.com"}); err != nil {
		t.Fatalf("own email: %v", err)
	}
}
