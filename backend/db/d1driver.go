package db

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"io"
	"log"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/migrator"
	"gorm.io/gorm/schema"
)

func init() {
	sql.Register("d1", &D1Driver{})
}

// ─── Driver ────────────────────────────────────────────────────────────────

type D1Driver struct{}

func (d *D1Driver) Open(name string) (driver.Conn, error) {
	return &D1Conn{}, nil
}

// ─── Connection ────────────────────────────────────────────────────────────

type D1Conn struct{}

func (c *D1Conn) Begin() (driver.Tx, error) {
	return &D1Tx{}, nil
}

func (c *D1Conn) Close() error { return nil }

func (c *D1Conn) Prepare(query string) (driver.Stmt, error) {
	return &D1Stmt{query: query}, nil
}

func (c *D1Conn) ExecContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	params := namedToParams(args)
	data, err := d1RequestRaw("raw", query, params)
	if err != nil {
		return nil, err
	}

	var resp D1RawResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal raw response: %w", err)
	}
	if !resp.Success {
		if len(resp.Errors) > 0 {
			return nil, fmt.Errorf("d1 error: %s", resp.Errors[0].Message)
		}
		return nil, fmt.Errorf("d1 exec failed")
	}

	lastID := int64(0)
	rowsAffected := int64(0)
	if len(resp.Result) > 0 {
		lastID = resp.Result[0].Meta.LastRowID
		rowsAffected = resp.Result[0].Meta.Changes
	}

	return &D1DriverResult{lastID: lastID, rowsAffected: rowsAffected}, nil
}

func (c *D1Conn) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	params := namedToParams(args)
	data, err := d1RequestRaw("query", query, params)
	if err != nil {
		return nil, err
	}

	var resp D1QueryResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal query response: %w", err)
	}
	if !resp.Success {
		if len(resp.Errors) > 0 {
			return nil, fmt.Errorf("d1 error: %s", resp.Errors[0].Message)
		}
		return nil, fmt.Errorf("d1 query failed")
	}

	var cols []string
	var rows [][]interface{}

	if len(resp.Result) > 0 {
		first := resp.Result[0]
		cols = first.Columns
		rows = make([][]interface{}, len(first.Values))
		for i, row := range first.Values {
			rows[i] = row
		}
	}

	return &D1Rows{columns: cols, rows: rows, pos: 0}, nil
}

func (c *D1Conn) BeginTx(ctx context.Context, opts driver.TxOptions) (driver.Tx, error) {
	return &D1Tx{}, nil
}

func (c *D1Conn) PrepareContext(ctx context.Context, query string) (driver.Stmt, error) {
	return &D1Stmt{query: query}, nil
}

func (c *D1Conn) PingContext(ctx context.Context) error {
	if !IsD1Enabled() {
		return fmt.Errorf("d1 not configured")
	}
	return nil
}

// ─── Statement (D1 has no prepared statements — pass-through) ──────────────

type D1Stmt struct {
	query string
}

func (s *D1Stmt) Close() error                                    { return nil }
func (s *D1Stmt) NumInput() int                                   { return -1 }
func (s *D1Stmt) Exec(args []driver.Value) (driver.Result, error) { return nil, fmt.Errorf("d1: use ExecContext") }
func (s *D1Stmt) Query(args []driver.Value) (driver.Rows, error)  { return nil, fmt.Errorf("d1: use QueryContext") }

// ─── Result ────────────────────────────────────────────────────────────────

type D1DriverResult struct {
	lastID       int64
	rowsAffected int64
}

func (r *D1DriverResult) LastInsertId() (int64, error)  { return r.lastID, nil }
func (r *D1DriverResult) RowsAffected() (int64, error) { return r.rowsAffected, nil }

// ─── Rows ──────────────────────────────────────────────────────────────────

type D1Rows struct {
	columns []string
	rows    [][]interface{}
	pos     int
}

func (r *D1Rows) Columns() []string { return r.columns }
func (r *D1Rows) Close() error      { return nil }
func (r *D1Rows) Next(dest []driver.Value) error {
	if r.pos >= len(r.rows) {
		return io.EOF
	}
	row := r.rows[r.pos]
	r.pos++
	for i, v := range row {
		dest[i] = v
	}
	return nil
}

// ─── Transaction (no-op — D1 HTTP API doesn't support real transactions) ────
// WARNING: D1 does not support multi-statement transactions via its HTTP API.
// This means concurrent writes may interleave. For critical operations,
// consider using D1's batch API or restructuring code to be idempotent.
type D1Tx struct{}

func (t *D1Tx) Commit() error {
	log.Println("WARNING: D1 Commit() is a no-op — D1 HTTP API does not support transactions")
	return nil
}

func (t *D1Tx) Rollback() error {
	log.Println("WARNING: D1 Rollback() is a no-op — D1 HTTP API does not support transactions")
	return nil
}

// ─── Connector ─────────────────────────────────────────────────────────────

type D1Connector struct{}

func (c *D1Connector) Connect(ctx context.Context) (driver.Conn, error) {
	return &D1Conn{}, nil
}

func (c *D1Connector) Driver() driver.Driver { return &D1Driver{} }

// ─── Helpers ───────────────────────────────────────────────────────────────

func namedToParams(args []driver.NamedValue) []string {
	params := make([]string, len(args))
	for i, a := range args {
		params[i] = fmt.Sprintf("%v", a.Value)
	}
	return params
}

func d1RequestRaw(endpoint, query string, params []string) ([]byte, error) {
	if !IsD1Enabled() {
		return nil, fmt.Errorf("d1 not configured")
	}
	return d1Request(endpoint, D1QueryRequest{SQL: query, Params: params})
}

// ─── Response types ────────────────────────────────────────────────────────

type D1RawResponse struct {
	Success bool            `json:"success"`
	Errors  []D1Error       `json:"errors"`
	Result  []D1ResultMeta  `json:"result"`
}

type D1QueryResponse struct {
	Success bool               `json:"success"`
	Errors  []D1Error          `json:"errors"`
	Result  []D1QueryResult    `json:"result"`
}

type D1QueryResult struct {
	Columns      []string        `json:"columns"`
	ColumnsTypes []D1ColType     `json:"columns_types"`
	Values       [][]interface{} `json:"values"`
	Meta         D1Meta          `json:"meta"`
}

type D1ColType struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// ─── Interface checks ──────────────────────────────────────────────────────

var _ driver.Driver = (*D1Driver)(nil)
var _ driver.Conn = (*D1Conn)(nil)
var _ driver.ConnBeginTx = (*D1Conn)(nil)
var _ driver.Connector = (*D1Connector)(nil)

// ─── D1 GORM Dialector ─────────────────────────────────────────────────────

// D1Open returns a gorm.Dialector that routes all SQL through the D1 HTTP API.
func D1Open() gorm.Dialector { return D1Dialector{} }

type D1Dialector struct{}

func (d D1Dialector) Name() string { return "d1" }

func (d D1Dialector) Initialize(db *gorm.DB) error {
	sqldb, err := sql.Open("d1", "")
	if err != nil {
		return fmt.Errorf("d1 sql.Open: %w", err)
	}
	db.ConnPool = sqldb
	return nil
}

func (d D1Dialector) Migrator(db *gorm.DB) gorm.Migrator {
	return &D1Migrator{Migrator: migrator.Migrator{Config: migrator.Config{DB: db, Dialector: d}}}
}

// D1Migrator wraps GORM's default migrator but no-ops the operations
// that D1's HTTP API doesn't support (CurrentDatabase, schema introspection).
// Tables are expected to already exist; schema changes go through D1 migrations.
type D1Migrator struct {
	migrator.Migrator
}

// AutoMigrate is a no-op for D1 — tables already exist via D1 migrations.
// D1's HTTP API doesn't support the DDL/introspection that GORM's AutoMigrate relies on.
func (m *D1Migrator) AutoMigrate(values ...interface{}) error {
	return nil
}

// D1 is SQLite-based — return SQLite-compatible type strings.
func (d D1Dialector) DataTypeOf(field *schema.Field) string {
	switch field.DataType {
	case schema.Bool:
		return "boolean"
	case schema.Int, schema.Uint:
		if field.Size <= 8 {
			return "tinyint"
		} else if field.Size <= 16 {
			return "smallint"
		} else if field.Size <= 32 {
			return "integer"
		}
		return "integer"
	case schema.Float:
		return "real"
	case schema.String:
		if field.Size > 0 && field.Size <= 255 {
			return fmt.Sprintf("varchar(%d)", field.Size)
		}
		return "text"
	case schema.Bytes:
		return "blob"
	case schema.Time:
		return "datetime"
	default:
		return "text"
	}
}

func (d D1Dialector) DefaultValueOf(field *schema.Field) clause.Expression {
	if field.HasDefaultValue {
		switch field.DefaultValue {
		case "now()":
			return clause.Expr{SQL: "CURRENT_TIMESTAMP"}
		case "uuid()":
			return clause.Expr{SQL: "lower(hex(randomblob(16)))"}
		}
	}
	return clause.Expr{}
}

func (d D1Dialector) BindVarTo(writer clause.Writer, stmt *gorm.Statement, v interface{}) {
	writer.WriteByte('?')
}

func (d D1Dialector) QuoteTo(writer clause.Writer, str string) {
	writer.WriteByte('`')
	writer.WriteString(str)
	writer.WriteByte('`')
}

func (d D1Dialector) Explain(sql string, vars ...interface{}) string {
	return fmt.Sprintf(sql, vars...)
}

var _ gorm.Dialector = D1Dialector{}
