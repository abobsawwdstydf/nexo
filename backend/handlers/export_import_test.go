package handlers

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"testing"
)

// encryptExportEntry/decryptExportEntry — roundtrip + tamper detection.
func TestExportEntryCryptoRoundtrip(t *testing.T) {
	key := deriveExportKey("correct horse battery", []byte("0123456789abcdef"))

	plain := []byte(`{"hello":"world","n":42}`)
	iv, sealed, err := encryptExportEntry(key, plain)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}
	if len(iv) != 12 {
		t.Fatalf("iv size = %d, want 12", len(iv))
	}

	got, err := decryptExportEntry(key, iv, sealed)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if !bytes.Equal(got, plain) {
		t.Fatalf("roundtrip mismatch: %s", got)
	}

	// Wrong key must fail.
	badKey := deriveExportKey("wrong password!!!", []byte("0123456789abcdef"))
	if _, err := decryptExportEntry(badKey, iv, sealed); err == nil {
		t.Fatal("decrypt with wrong key succeeded")
	}
	// Tampered ciphertext must fail (GCM auth).
	sealed[0] ^= 0xFF
	if _, err := decryptExportEntry(key, iv, sealed); err == nil {
		t.Fatal("decrypt of tampered ciphertext succeeded")
	}
}

// Different password/salt -> different key.
func TestDeriveExportKeyDeterministic(t *testing.T) {
	k1 := deriveExportKey("password-12345678", []byte("salt1"))
	k2 := deriveExportKey("password-12345678", []byte("salt2"))
	k3 := deriveExportKey("password-12345679", []byte("salt1"))
	if bytes.Equal(k1, k2) {
		t.Fatal("keys equal for different salts")
	}
	if bytes.Equal(k1, k3) {
		t.Fatal("keys equal for different passwords")
	}
	if len(k1) != 32 {
		t.Fatalf("key len = %d, want 32", len(k1))
	}
}

// Full archive shape test: built the way ExportAccountZip builds it,
// then decrypted the way ImportAccountZip decrypts it.
func TestExportArchiveShape(t *testing.T) {
	password := "super-secret-123"
	salt := []byte("0123456789abcdef")
	key := deriveExportKey(password, salt)

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	meta := exportArchiveMeta{Version: 1, ExportedAt: "2026-08-12T00:00:00Z",
		User: exportMetaUser{ID: "u1", Username: "alice", DisplayName: "Alice"}}
	msg := exportMessagesJSON{Chats: []exportChatJSON{{ChatID: "c1", Type: "personal", Name: "Chat",
		Messages: []exportMessageJSON{{ID: "m1", Content: "hi", Type: "text", CreatedAt: "2026-08-12T00:00:00Z", SenderID: "u1"}}}}}

	structure := exportStructureJSON{Version: 1, Salt: base64.StdEncoding.EncodeToString(salt), Entries: []exportStructureEntry{}}
	for _, pair := range []struct{ name string; v interface{} }{
		{"meta.json", meta}, {"messages.json", msg},
	} {
		raw, _ := json.Marshal(pair.v)
		iv, sealed, err := encryptExportEntry(key, raw)
		if err != nil {
			t.Fatalf("encrypt %s: %v", pair.name, err)
		}
		fh := &zip.FileHeader{Name: pair.name, Method: zip.Store}
		fw, _ := zw.CreateHeader(fh)
		fw.Write(append(append([]byte{}, iv...), sealed...))
		structure.Entries = append(structure.Entries, exportStructureEntry{Name: pair.name, IV: base64.StdEncoding.EncodeToString(iv), Size: len(iv) + len(sealed)})
	}
	sfh := &zip.FileHeader{Name: "structure.json", Method: zip.Store}
	sfw, _ := zw.CreateHeader(sfh)
	raw, _ := json.Marshal(structure)
	sfw.Write(raw)
	zw.Close()

	// ── Import side (same helpers as ImportAccountZip) ──
	zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatalf("zip read: %v", err)
	}
	var st exportStructureJSON
	if err := readZipJSON(zr, "structure.json", &st); err != nil {
		t.Fatalf("structure: %v", err)
	}
	if st.Version != 1 {
		t.Fatalf("version = %d, want 1", st.Version)
	}
	salt2, _ := base64.StdEncoding.DecodeString(st.Salt)
	key2 := deriveExportKey(password, salt2)

	zipByName := map[string]*zip.File{}
	for _, f := range zr.File {
		zipByName[f.Name] = f
	}
	for _, e := range st.Entries {
		zf := zipByName[e.Name]
		if zf == nil {
			t.Fatalf("entry %s missing", e.Name)
		}
		rc, _ := zf.Open()
		payload := make([]byte, e.Size)
		rc.Read(payload)
		rc.Close()
		iv, _ := base64.StdEncoding.DecodeString(e.IV)
		plain, err := decryptExportEntry(key2, iv, payload[12:])
		if err != nil {
			t.Fatalf("decrypt %s: %v", e.Name, err)
		}
		if e.Name == "meta.json" {
			var m exportArchiveMeta
			if err := json.Unmarshal(plain, &m); err != nil || m.User.Username != "alice" {
				t.Fatalf("meta mismatch: %v %s", err, plain)
			}
		}
		if e.Name == "messages.json" {
			var m exportMessagesJSON
			if err := json.Unmarshal(plain, &m); err != nil || len(m.Chats) != 1 || m.Chats[0].Messages[0].Content != "hi" {
				t.Fatalf("messages mismatch: %v", err)
			}
		}
	}

	// Wrong password must fail on first decrypt.
	badKey := deriveExportKey("nope-nope-nope", salt2)
	if _, err := decryptExportEntry(badKey, []byte("0123456789ab"), []byte("x")); err == nil {
		t.Fatal("decrypt with wrong key succeeded")
	}
}

func TestMediaFilenameFromURL(t *testing.T) {
	cases := map[string]string{
		"/uploads/abc.png":     "abc.png",
		"/uploads/":            "",
		"/uploads/../evil.png": "",
		"uploads/abc.png":      "",
		"https://x/y.png":      "",
		"/uploads/a/b.png":     "",
	}
	for in, want := range cases {
		if got := mediaFilenameFromURL(in); got != want {
			t.Fatalf("mediaFilenameFromURL(%q) = %q, want %q", in, got, want)
		}
	}
}