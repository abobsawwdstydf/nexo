package handlers

import (
	"time"

	"nexo/beta"

	"github.com/gofiber/fiber/v2"
)

type BetaStatus struct {
	Active         bool   `json:"active"`
	Ended          bool   `json:"ended"`
	StartTime      string `json:"startTime"`
	EndTime        string `json:"endTime"`
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

	daysLeft := 0
	if active {
		daysLeft = int(beta.EndTime.Sub(now).Hours() / 24)
		if daysLeft < 0 {
			daysLeft = 0
		}
	}

	status := BetaStatus{
		Active:    active,
		Ended:     ended,
		StartTime: beta.StartTime.Format(time.RFC3339),
		EndTime:   beta.EndTime.Format(time.RFC3339),
		DaysLeft:  daysLeft,
		ContactTG: beta.ContactTG,
		ContactTT: beta.ContactTT,
		Message:   "Это бета-версия. Если вы нашли баг, пишите мне в тг " + beta.ContactTG + " или в тиктоке " + beta.ContactTT,
	}

	if ended {
		status.BlockedMessage = "Бета закончена, ждите официального релиза"
	}

	return c.JSON(status)
}
