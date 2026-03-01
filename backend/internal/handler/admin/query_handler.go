package admin

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/response"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/gin-gonic/gin"
)

// QueryHandler handles readonly SQL query execution for admin and user roles.
type QueryHandler struct {
	db *sql.DB
}

// NewQueryHandler creates a new QueryHandler.
func NewQueryHandler(db *sql.DB) *QueryHandler {
	return &QueryHandler{db: db}
}

// ExecuteQueryRequest is the request body for SQL query execution.
type ExecuteQueryRequest struct {
	SQL       string `json:"sql" binding:"required"`
	TimeoutMs int    `json:"timeout_ms"` // default 5000, max 30000
}

// ExecuteQueryResponse is the response body for SQL query execution.
type ExecuteQueryResponse struct {
	Columns    []string         `json:"columns"`
	Rows       []map[string]any `json:"rows"`
	RowCount   int              `json:"row_count"`
	DurationMs int64            `json:"duration_ms"`
}

// adminAllowedTables is the whitelist of tables accessible by admin.
var adminAllowedTables = map[string]bool{
	"usage_logs":                 true,
	"users":                      true,
	"api_keys":                   true,
	"accounts":                   true,
	"groups":                     true,
	"user_subscriptions":         true,
	"settings":                   true,
	"redeem_codes":               true,
	"promo_codes":                true,
	"proxies":                    true,
	"announcements":              true,
	"account_groups":             true,
	"user_allowed_groups":        true,
	"promo_code_usages":          true,
	"announcement_reads":         true,
	"user_attribute_definitions": true,
	"user_attribute_values":      true,
	"sora_accounts":              true,
	"ops_alert_rules":            true,
	"ops_alert_events":           true,
	"dashboard_aggregations":     true,
}

// userAllowedTables is the whitelist of tables accessible by regular users.
var userAllowedTables = map[string]bool{
	"usage_logs":         true,
	"api_keys":           true,
	"user_subscriptions": true,
}

// selectOnlyPattern matches SELECT statements (case-insensitive).
var selectOnlyPattern = regexp.MustCompile(`(?i)^\s*(SELECT|WITH)\s`)

// dangerousPattern detects dangerous SQL keywords.
var dangerousPattern = regexp.MustCompile(`(?i)\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE|INTO)\b`)

// tableRefPattern extracts table names from SQL (FROM and JOIN clauses).
var tableRefPattern = regexp.MustCompile(`(?i)(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)`)

// ExecuteAdmin handles POST /admin/query — admin can query all allowed tables.
func (h *QueryHandler) ExecuteAdmin(c *gin.Context) {
	var req ExecuteQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if err := validateSQL(req.SQL, adminAllowedTables); err != nil {
		response.Error(c, http.StatusForbidden, err.Error())
		return
	}

	result, err := h.executeQuery(c.Request.Context(), req.SQL, resolveTimeout(req.TimeoutMs), "", 0)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Query execution failed: "+err.Error())
		return
	}

	response.Success(c, result)
}

// ExecuteUser handles POST /user/query — user can only query own data via RLS.
func (h *QueryHandler) ExecuteUser(c *gin.Context) {
	subject, ok := middleware.GetAuthSubjectFromContext(c)
	if !ok {
		response.Unauthorized(c, "Authentication required")
		return
	}

	role, _ := middleware.GetUserRoleFromContext(c)

	var req ExecuteQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	allowedTables := userAllowedTables
	if role == "admin" {
		allowedTables = adminAllowedTables
	}

	if err := validateSQL(req.SQL, allowedTables); err != nil {
		response.Error(c, http.StatusForbidden, err.Error())
		return
	}

	result, err := h.executeQuery(c.Request.Context(), req.SQL, resolveTimeout(req.TimeoutMs), role, subject.UserID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Query execution failed: "+err.Error())
		return
	}

	response.Success(c, result)
}

// validateSQL checks that the SQL is a SELECT-only query referencing only allowed tables.
func validateSQL(query string, allowedTables map[string]bool) error {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return fmt.Errorf("empty SQL query")
	}

	if !selectOnlyPattern.MatchString(trimmed) {
		return fmt.Errorf("only SELECT queries are allowed")
	}

	if dangerousPattern.MatchString(trimmed) {
		return fmt.Errorf("query contains forbidden keywords")
	}

	// Extract and validate table references
	matches := tableRefPattern.FindAllStringSubmatch(trimmed, -1)
	for _, match := range matches {
		tableName := strings.ToLower(match[1])
		if !allowedTables[tableName] {
			return fmt.Errorf("table %q is not allowed", tableName)
		}
	}

	return nil
}

// resolveTimeout returns a valid timeout duration from the request.
func resolveTimeout(timeoutMs int) time.Duration {
	if timeoutMs <= 0 {
		return 5 * time.Second
	}
	if timeoutMs > 30000 {
		return 30 * time.Second
	}
	return time.Duration(timeoutMs) * time.Millisecond
}

// executeQuery runs a readonly SQL query with timeout, optional RLS, and row limit.
func (h *QueryHandler) executeQuery(ctx context.Context, query string, timeout time.Duration, role string, userID int64) (*ExecuteQueryResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	start := time.Now()

	tx, err := h.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck

	// Set RLS context for non-admin users
	if role != "" && role != "admin" && userID > 0 {
		if _, err := tx.ExecContext(ctx, fmt.Sprintf("SET LOCAL app.user_id = '%d'", userID)); err != nil {
			return nil, fmt.Errorf("failed to set RLS context: %w", err)
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf("SET LOCAL app.role = '%s'", role)); err != nil {
			return nil, fmt.Errorf("failed to set RLS role: %w", err)
		}
	}

	// Enforce LIMIT if not present
	if !regexp.MustCompile(`(?i)\bLIMIT\b`).MatchString(query) {
		query = query + " LIMIT 1000"
	}

	rows, err := tx.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query error: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	var results []map[string]any
	for rows.Next() {
		values := make([]any, len(columns))
		valuePtrs := make([]any, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		row := make(map[string]any, len(columns))
		for i, col := range columns {
			val := values[i]
			// Convert []byte to string for readability
			if b, ok := val.([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = val
			}
		}
		results = append(results, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	if results == nil {
		results = []map[string]any{}
	}

	return &ExecuteQueryResponse{
		Columns:    columns,
		Rows:       results,
		RowCount:   len(results),
		DurationMs: time.Since(start).Milliseconds(),
	}, nil
}
