package helpers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"time"
)

// GenerateID creates a random hex ID. Falls back to a time-based hash if the
// OS RNG fails so critical flows never block on entropy exhaustion.
func GenerateID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		h := sha256.Sum256([]byte(strconv.FormatInt(time.Now().UnixNano(), 10)))
		return hex.EncodeToString(h[:16])
	}
	return hex.EncodeToString(b)
}
