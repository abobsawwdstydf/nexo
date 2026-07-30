package helpers

import (
    "strconv"
    "github.com/gofiber/fiber/v2"
)

type PaginationParams struct {
    Page     int `json:"page"`
    PageSize int `json:"pageSize"`
    Offset   int `json:"offset"`
}

type PaginatedResponse struct {
    Items    interface{} `json:"items"`
    Total    int64       `json:"total"`
    Page     int         `json:"page"`
    PageSize int         `json:"pageSize"`
    HasMore  bool        `json:"hasMore"`
}

func ParsePagination(c *fiber.Ctx, defaultSize, maxSize int) PaginationParams {
    page, _ := strconv.Atoi(c.Query("page", "1"))
    pageSize, _ := strconv.Atoi(c.Query("pageSize", strconv.Itoa(defaultSize)))
    if page < 1 {
        page = 1
    }
    if pageSize < 1 || pageSize > maxSize {
        pageSize = defaultSize
    }
    return PaginationParams{
        Page:     page,
        PageSize: pageSize,
        Offset:   (page - 1) * pageSize,
    }
}

func NewPaginatedResponse(items interface{}, total int64, params PaginationParams) PaginatedResponse {
    return PaginatedResponse{
        Items:    items,
        Total:    total,
        Page:     params.Page,
        PageSize: params.PageSize,
        HasMore:  int64(params.Offset+params.PageSize) < total,
    }
}
