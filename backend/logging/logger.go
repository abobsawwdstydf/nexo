package logging

import (
	"log/slog"
	"os"
)

// Log is the shared structured JSON logger used across the backend
// (handlers, db, middleware, ws). Errors go through Log.Error with the
// error attached as "err"; informational output uses Log.Info.
var Log = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
	Level: slog.LevelInfo,
}))
