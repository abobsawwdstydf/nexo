package db

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// ─── Configuration ──────────────────────────────────────────────────────────

type CloudflareConfig struct {
	AccountID   string
	APIToken    string
	D1DatabaseID string
	KVNamespaceID string
	R2AccountID  string
	R2AccessKey  string
	R2SecretKey  string
	R2BucketName string
	R2PublicURL  string
}

var CF CloudflareConfig

func InitCloudflare() {
	CF = CloudflareConfig{
		AccountID:    os.Getenv("CLOUDFLARE_ACCOUNT_ID"),
		APIToken:     os.Getenv("CLOUDFLARE_API_TOKEN"),
		D1DatabaseID: os.Getenv("CLOUDFLARE_D1_DATABASE_ID"),
		KVNamespaceID: os.Getenv("CLOUDFLARE_KV_NAMESPACE_ID"),
		R2AccountID:  os.Getenv("CLOUDFLARE_R2_ACCOUNT_ID"),
		R2AccessKey:  os.Getenv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
		R2SecretKey:  os.Getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
		R2BucketName: os.Getenv("CLOUDFLARE_R2_BUCKET_NAME"),
		R2PublicURL:  os.Getenv("CLOUDFLARE_R2_PUBLIC_URL"),
	}

	if CF.AccountID != "" && CF.D1DatabaseID != "" {
		log.Println("Cloudflare D1: configured")
	}
	if CF.AccountID != "" && CF.KVNamespaceID != "" {
		log.Println("Cloudflare KV: configured")
	}
	if CF.R2AccountID != "" && CF.R2BucketName != "" {
		log.Println("Cloudflare R2: configured")
	}
}

func IsD1Enabled() bool {
	return CF.AccountID != "" && CF.D1DatabaseID != "" && CF.APIToken != ""
}

func IsKVEnabled() bool {
	return CF.AccountID != "" && CF.KVNamespaceID != "" && CF.APIToken != ""
}

func IsR2Enabled() bool {
	return CF.R2AccountID != "" && CF.R2BucketName != "" && CF.R2AccessKey != ""
}

// ─── D1 Client ──────────────────────────────────────────────────────────────

type D1QueryRequest struct {
	SQL    string   `json:"sql"`
	Params []string `json:"params,omitempty"`
}

type D1BatchRequest struct {
	Batch []D1QueryRequest `json:"batch"`
}

type D1Result struct {
	Success  bool            `json:"success"`
	Errors   []D1Error       `json:"errors"`
	Result   []D1ResultMeta  `json:"result"`
}

type D1Error struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type D1ResultMeta struct {
	Success   bool         `json:"success"`
	Results   []D1Row      `json:"results"`
	Meta      D1Meta       `json:"meta"`
	Changes   int64        `json:"changes"`
	LastRowID int64        `json:"last_row_id"`
}

type D1Row map[string]interface{}

type D1Meta struct {
	Duration  float64 `json:"duration"`
	Changes   int64   `json:"changes"`
	LastRowID int64   `json:"last_row_id"`
	RowsRead  int64   `json:"rows_read"`
	RowsWritten int64 `json:"rows_written"`
}

type D1BatchResult struct {
	Success bool           `json:"success"`
	Result  []D1ResultMeta `json:"result"`
}

func d1Request(endpoint string, body interface{}) ([]byte, error) {
	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/%s",
		CF.AccountID, CF.D1DatabaseID, endpoint)

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+CF.APIToken)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("d1 request failed: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("d1 api error (status %d): %s", resp.StatusCode, string(data))
	}

	return data, nil
}

// D1Exec executes a SQL statement (INSERT, UPDATE, DELETE, CREATE)
func D1Exec(sql string, params ...string) error {
	if !IsD1Enabled() {
		return fmt.Errorf("d1 not configured")
	}

	_, err := d1Request("raw", D1QueryRequest{
		SQL:    sql,
		Params: params,
	})
	return err
}

// D1Query executes a SQL query and returns rows
func D1Query(sql string, params ...string) ([]D1Row, error) {
	if !IsD1Enabled() {
		return nil, fmt.Errorf("d1 not configured")
	}

	data, err := d1Request("query", D1QueryRequest{
		SQL:    sql,
		Params: params,
	})
	if err != nil {
		return nil, err
	}

	var result D1Result
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("unmarshal result: %w", err)
	}

	if !result.Success {
		if len(result.Errors) > 0 {
			return nil, fmt.Errorf("d1 error: %s", result.Errors[0].Message)
		}
		return nil, fmt.Errorf("d1 query failed")
	}

	if len(result.Result) > 0 {
		return result.Result[0].Results, nil
	}

	return nil, nil
}

// D1Batch executes multiple SQL statements in a batch
func D1Batch(queries []D1QueryRequest) error {
	if !IsD1Enabled() {
		return fmt.Errorf("d1 not configured")
	}

	data, err := d1Request("batch", D1BatchRequest{Batch: queries})
	if err != nil {
		return err
	}

	var result D1BatchResult
	if err := json.Unmarshal(data, &result); err != nil {
		return fmt.Errorf("unmarshal result: %w", err)
	}

	if !result.Success {
		return fmt.Errorf("d1 batch failed")
	}

	return nil
}

// ─── KV Client ──────────────────────────────────────────────────────────────

func kvURL(key string) string {
	return fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/storage/kv/namespaces/%s/values/%s",
		CF.AccountID, CF.KVNamespaceID, key)
}

// KVGet retrieves a value from KV
func KVGet(key string) (string, error) {
	if !IsKVEnabled() {
		return "", fmt.Errorf("kv not configured")
	}

	req, err := http.NewRequest("GET", kvURL(key), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+CF.APIToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("kv get failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return "", nil // key not found
	}

	if resp.StatusCode != 200 {
		data, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("kv get error (status %d): %s", resp.StatusCode, string(data))
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	// KV values are base64 encoded
	decoded, err := base64.StdEncoding.DecodeString(string(data))
	if err != nil {
		// If not base64, return raw
		return string(data), nil
	}

	return string(decoded), nil
}

// KVPut stores a value in KV with optional TTL in seconds
func KVPut(key string, value string, ttlSeconds int) error {
	if !IsKVEnabled() {
		return fmt.Errorf("kv not configured")
	}

	encoded := base64.StdEncoding.EncodeToString([]byte(value))

	req, err := http.NewRequest("PUT", kvURL(key), strings.NewReader(encoded))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+CF.APIToken)
	req.Header.Set("Content-Type", "text/plain")

	if ttlSeconds > 0 {
		expiration := time.Now().Add(time.Duration(ttlSeconds) * time.Second).Unix()
		req.Header.Set("Expiration", strconv.FormatInt(expiration, 10))
		req.Header.Set("Expiration-TTL", strconv.Itoa(ttlSeconds))
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("kv put failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		data, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("kv put error (status %d): %s", resp.StatusCode, string(data))
	}

	return nil
}

// KVDelete removes a key from KV
func KVDelete(key string) error {
	if !IsKVEnabled() {
		return fmt.Errorf("kv not configured")
	}

	req, err := http.NewRequest("DELETE", kvURL(key), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+CF.APIToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("kv delete failed: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

// ─── R2 Client (S3-compatible) ──────────────────────────────────────────────

// R2PutObject uploads an object to R2
func R2PutObject(key string, data []byte, contentType string) error {
	if !IsR2Enabled() {
		return fmt.Errorf("r2 not configured")
	}

	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com/%s/%s",
		CF.R2AccountID, CF.R2BucketName, key)

	req, err := http.NewRequest("PUT", endpoint, bytes.NewReader(data))
	if err != nil {
		return err
	}

	// AWS Signature V4 for R2
	date := time.Now().UTC().Format("20060102T150405Z")
	dateShort := time.Now().UTC().Format("20060102")

	req.Header.Set("Host", fmt.Sprintf("%s.r2.cloudflarestorage.com", CF.R2AccountID))
	req.Header.Set("Date", date)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD")

	// Create canonical request for signing
	signedHeaders := "content-type;host;x-amz-content-sha256;x-amz-date"
	canonicalRequest := fmt.Sprintf("PUT\n/%s/%s\n\n%s\n%s\n%s",
		CF.R2BucketName, key,
		signedHeaders+"\n",
		hashSHA256(data),
		date)

	// String to sign
	credentialScope := fmt.Sprintf("%s/%s/s3/aws4_request", dateShort, CF.R2AccountID)
	stringToSign := fmt.Sprintf("AWS4-HMAC-SHA256\n%s\n%s\n%s",
		date, credentialScope, hashSHA256([]byte(canonicalRequest)))

	// Signing key
	signingKey := hmacSHA256(
		hmacSHA256(
			hmacSHA256(
				hmacSHA256([]byte("AWS4"+CF.R2SecretKey), []byte(dateShort)),
				[]byte(CF.R2AccountID),
			),
			[]byte("s3"),
		),
		[]byte("aws4_request"),
	)

	signature := fmt.Sprintf("%x", hmacSHA256(signingKey, []byte(stringToSign)))

	authHeader := fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		CF.R2AccessKey, credentialScope, signedHeaders, signature)
	req.Header.Set("Authorization", authHeader)

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("r2 upload failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("r2 upload error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// R2GetURL returns the public URL for an R2 object
func R2GetURL(key string) string {
	if CF.R2PublicURL != "" {
		return strings.TrimRight(CF.R2PublicURL, "/") + "/" + key
	}
	return fmt.Sprintf("https://%s.r2.cloudflarestorage.com/%s/%s",
		CF.R2AccountID, CF.R2BucketName, key)
}

// R2DeleteObject removes an object from R2
func R2DeleteObject(key string) error {
	if !IsR2Enabled() {
		return fmt.Errorf("r2 not configured")
	}

	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com/%s/%s",
		CF.R2AccountID, CF.R2BucketName, key)

	req, err := http.NewRequest("DELETE", endpoint, nil)
	if err != nil {
		return err
	}

	date := time.Now().UTC().Format("20060102T150405Z")
	dateShort := time.Now().UTC().Format("20060102")

	req.Header.Set("Host", fmt.Sprintf("%s.r2.cloudflarestorage.com", CF.R2AccountID))
	req.Header.Set("Date", date)
	req.Header.Set("X-Amz-Content-Sha256", "UNSIGNED-PAYLOAD")

	signedHeaders := "host;x-amz-content-sha256;x-amz-date"
	canonicalRequest := fmt.Sprintf("DELETE\n/%s/%s\n\n%s\n%s",
		CF.R2BucketName, key,
		signedHeaders+"\n",
		"UNSIGNED-PAYLOAD")

	credentialScope := fmt.Sprintf("%s/%s/s3/aws4_request", dateShort, CF.R2AccountID)
	stringToSign := fmt.Sprintf("AWS4-HMAC-SHA256\n%s\n%s\n%s",
		date, credentialScope, hashSHA256([]byte(canonicalRequest)))

	signingKey := hmacSHA256(
		hmacSHA256(
			hmacSHA256(
				hmacSHA256([]byte("AWS4"+CF.R2SecretKey), []byte(dateShort)),
				[]byte(CF.R2AccountID),
			),
			[]byte("s3"),
		),
		[]byte("aws4_request"),
	)

	signature := fmt.Sprintf("%x", hmacSHA256(signingKey, []byte(stringToSign)))

	authHeader := fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		CF.R2AccessKey, credentialScope, signedHeaders, signature)
	req.Header.Set("Authorization", authHeader)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("r2 delete failed: %w", err)
	}
	defer resp.Body.Close()

	return nil
}

// ─── Helpers ────────────────────────────────────────────────────────────────

func hashSHA256(data []byte) string {
	h := sha256.Sum256(data)
	return fmt.Sprintf("%x", h)
}

func hmacSHA256(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}
