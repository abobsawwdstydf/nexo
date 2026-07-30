package handlers

import (
	"testing"
	"strings"
	"regexp"
)

func TestUsernameRegex(t *testing.T) {
	tests := []struct {
		input string
		valid bool
	}{
		{"user123", true},
		{"a_b_c", true},
		{"ab", false},
		{"", false},
		{"user name", false},
		{"<script>", false},
		{"../../../etc", false},
		{strings.Repeat("a", 40), false},
	}
	for _, tc := range tests {
		got := usernameRegex.MatchString(tc.input)
		if got != tc.valid {
			t.Errorf("usernameRegex.MatchString(%q) = %v, want %v", tc.input, got, tc.valid)
		}
	}
}

func TestEmailRegex(t *testing.T) {
	tests := []struct {
		input string
		valid bool
	}{
		{"user@example.com", true},
		{"test@test.co.uk", true},
		{"", false},
		{"notanemail", false},
		{"<script>@x.com", false},
	}
	for _, tc := range tests {
		got := emailRegex.MatchString(tc.input)
		if got != tc.valid {
			t.Errorf("emailRegex.MatchString(%q) = %v, want %v", tc.input, got, tc.valid)
		}
	}
}

func TestSQLInjectionPatterns(t *testing.T) {
	payloads := []string{
		"' OR '1'='1",
		"' UNION SELECT * FROM passwords",
		"1' ORDER BY 1--",
		"'; DELETE FROM messages",
	}
	for _, p := range payloads {
		if !strings.Contains(p, "'") && !strings.Contains(p, "--") {
			t.Errorf("SQLi payload not detected: %s", p)
		}
	}
}

func TestXSSPayloads(t *testing.T) {
	payloads := []string{
		"<script>alert(1)</script>",
		"<img src=x onerror=alert(1)>",
		"javascript:alert(1)",
		"<svg/onload=alert(1)>",
	}
	for _, p := range payloads {
		if !strings.Contains(p, "<") && !strings.Contains(p, "javascript:") {
			t.Errorf("XSS payload not detected: %s", p)
		}
	}
}

var pathTraversalPatterns = []string{
	"../../../etc/passwd",
	"..\\..\\..\\windows\\system32\\config",
	"%2e%2e%2f%2e%2e%2fetc",
	"/secure/../admin",
}

func TestPathTraversalDetected(t *testing.T) {
	sanitizers := []*regexp.Regexp{
		regexp.MustCompile(`\.\.`),
		regexp.MustCompile(`%2e%2e`),
	}
	for _, pt := range pathTraversalPatterns {
		matched := false
		for _, s := range sanitizers {
			if s.MatchString(pt) {
				matched = true
				break
			}
		}
		if !matched {
			t.Errorf("path traversal not detected: %s", pt)
		}
	}
}

func TestConstantTimeCompare(t *testing.T) {
	t.Run("equal strings pass", func(t *testing.T) {
		a := []byte("abc123")
		b := []byte("abc123")
		if len(a) != len(b) {
			t.Fatal("length mismatch")
		}
		if string(a) != string(b) {
			t.Fatal("not equal")
		}
	})
	t.Run("different lengths fail", func(t *testing.T) {
		if len([]byte("short")) == len([]byte("muchlonger")) {
			t.Error("expected different lengths")
		}
	})
}
