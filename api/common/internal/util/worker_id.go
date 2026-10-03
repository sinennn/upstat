package util

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
)

// NewWorkerID makes a label for attributing lease ownership in logs/storage.
// It is not an identity other workers need to know about — losing it on
// restart is harmless, which is what keeps callers stateless.
func NewWorkerID() string {
	host, err := os.Hostname()
	if err != nil || host == "" {
		host = "worker"
	}

	suffix := make([]byte, 4)
	if _, err := rand.Read(suffix); err != nil {
		return fmt.Sprintf("%s-%d", host, os.Getpid())
	}

	return fmt.Sprintf("%s-%d-%s", host, os.Getpid(), hex.EncodeToString(suffix))
}
