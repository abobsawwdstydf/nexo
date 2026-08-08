package beta

import (
	"os"
	"strconv"
	"time"
)

var (
	StartTime time.Time
	EndTime   time.Time
	ContactTG string
	ContactTT string
)

func Init() {
	ContactTG = "@haker_one"
	ContactTT = "@nexo.su"

	startStr := os.Getenv("BETA_START")
	if startStr == "" {
		startStr = "2026-08-10T03:00:00Z"
	}
	start, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		start = time.Date(2026, 8, 10, 3, 0, 0, 0, time.UTC)
	}
	StartTime = start

	duration := os.Getenv("BETA_DURATION_DAYS")
	if duration == "" {
		duration = "7"
	}
	days := 7
	if d, err := strconv.Atoi(duration); err == nil && d > 0 {
		days = d
	}
	EndTime = StartTime.AddDate(0, 0, days)
}

func IsBetaActive() bool {
	now := time.Now()
	return now.After(StartTime) && now.Before(EndTime)
}

func IsBetaEnded() bool {
	return time.Now().After(EndTime)
}

func BetaEndedManually() bool {
	return os.Getenv("BETA_ENDED") == "true"
}
