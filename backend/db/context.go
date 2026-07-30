package db

import (
    "context"
    "gorm.io/gorm"
)

type contextKey string
const dbKey contextKey = "db"

func WithDB(ctx context.Context, tx *gorm.DB) context.Context {
    return context.WithValue(ctx, dbKey, tx)
}

func FromContext(ctx context.Context) *gorm.DB {
    if tx, ok := ctx.Value(dbKey).(*gorm.DB); ok {
        return tx
    }
    return GetDB()
}
