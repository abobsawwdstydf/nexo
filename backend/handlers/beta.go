package handlers

import (
	"strings"
	"time"

	"nexo/beta"

	"github.com/gofiber/fiber/v2"
)

type BetaStatus struct {
	Active         bool   `json:"active"`
	Started        bool   `json:"started"`
	Ended          bool   `json:"ended"`
	StartTime      string `json:"startTime"`
	EndTime        string `json:"endTime"`
	ReleaseTime    string `json:"releaseTime"`
	ReleasePassed  bool   `json:"releasePassed"`
	DaysLeft       int    `json:"daysLeft"`
	ContactTG      string `json:"contactTg"`
	ContactTT      string `json:"contactTt"`
	Message        string `json:"message"`
	BlockedMessage string `json:"blockedMessage,omitempty"`
}

func GetBetaStatus(c *fiber.Ctx) error {
	now := time.Now()
	active := beta.IsBetaActive()
	ended := beta.IsBetaEnded() || beta.BetaEndedManually()
	started := now.After(beta.StartTime)

	daysLeft := 0
	if active {
		daysLeft = int(beta.EndTime.Sub(now).Hours() / 24)
		if daysLeft < 0 {
			daysLeft = 0
		}
	}

	status := BetaStatus{
		Active:        active,
		Started:       started,
		Ended:         ended,
		StartTime:     beta.StartTime.Format(time.RFC3339),
		EndTime:       beta.EndTime.Format(time.RFC3339),
		ReleaseTime:   beta.ReleaseTime.Format(time.RFC3339),
		ReleasePassed: beta.IsReleasePassed(),
		DaysLeft:      daysLeft,
		ContactTG:     beta.ContactTG,
		ContactTT:     beta.ContactTT,
		Message:       "Это бета-версия. Если вы нашли баг, пишите мне в тг " + beta.ContactTG + " или в тиктоке " + beta.ContactTT,
	}

	if ended {
		status.BlockedMessage = "Релиз Нексо — 25 августа в 6:00 (МСК)"
	} else if !started {
		status.BlockedMessage = beta.StartMessage
	}

	return c.JSON(status)
}

// BetaAccessAllowed — разрешён ли вход/действия с этим email до старта беты.
// После старта беты доступ открыт всем; до старта — только аккаунту раннего доступа.
func BetaAccessAllowed(email string) bool {
	if beta.IsBetaActive() {
		return true
	}
	return strings.EqualFold(strings.TrimSpace(email), beta.EarlyAccessEmail)
}
