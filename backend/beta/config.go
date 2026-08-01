package beta

import (
	"os"
	"time"
)

var (
	StartTime    time.Time
	DurationDays int
	EndTime      time.Time
	IsActive     bool
	ContactTG    string
	ContactTT    string
)

func Init() {
	ContactTG = "@haker_one"
	ContactTT = "@nexo.su"

	startStr := os.Getenv("BETA_START")
	if startStr == "" {
		startStr = "2026-08-06T03:00:00Z"
	}
	start, err := time.Parse(time.RFC3339, startStr)
	if err != nil {
		start = time.Date(2026, 8, 6, 3, 0, 0, 0, time.UTC)
	}
	StartTime = start

	duration := os.Getenv("BETA_DURATION_DAYS")
	if duration == "" {
		duration = "7"
	}
	days := 7
	if d, err := time.ParseDuration(duration + "d"); err == nil {
		days = int(d.Hours() / 24)
	}
	DurationDays = days
	EndTime = StartTime.AddDate(0, 0, days)

	now := time.Now()
	IsActive = now.After(StartTime) && now.Before(EndTime)
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
