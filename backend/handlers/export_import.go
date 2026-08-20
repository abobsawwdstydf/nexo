package handlers

import (
	"archive/zip"
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"nexo/logging"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/pbkdf2"
	"gorm.io/gorm"

	"nexo/db"
	"nexo/helpers"
	"nexo/models"
)

// ─── Limits ────────────────────────────────────────────────────────────────

const (
	// exportZipMaxMessages — максимум сообщений в одном экспорте (50 000).
	exportZipMaxMessages = 50000
	// exportZipMaxMediaBytes — суммарный объём медиа в экспорте (500 MB).
	exportZipMaxMediaBytes = 500 * 1024 * 1024
	// exportZipMaxTotalBytes — максимальный размер ZIP в памяти (500 MB).
	exportZipMaxTotalBytes = 500 * 1024 * 1024
	// importZipMaxBytes — максимальный размер загружаемого архива (50 MB).
	// Не 200 MB: транспортный лимит всего приложения — 55 MB (BodyLimit +
	// RequestSizeLimit в main.go), превысить его без ослабления защиты
	// всех остальных эндпоинтов нельзя.
	importZipMaxBytes = 50 * 1024 * 1024
	// importZipMaxMessages — максимум сообщений за один импорт.
	importZipMaxMessages = 50000

	pbkdf2Iterations = 210000
	aesKeyBytes      = 32
)

// allowedMediaExt — расширения медиафайлов, допустимые при импорте архива.
// Всё остальное (html, svg, js, exe и т.п.) в uploads/ не пишется.
var allowedMediaExt = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true,
	".webp": true, ".heic": true, ".heif": true, ".avif": true,
	".mp4": true, ".webm": true, ".mov": true, ".mkv": true,
	".mp3": true, ".ogg": true, ".wav": true, ".m4a": true,
	".opus": true, ".aac": true, ".flac": true, ".3gp": true,
}

// ─── Формат архива ─────────────────────────────────────────────────────────

// structure.json (единственный файл архива в открытом виде):
// {version, salt, entries: [{name, iv, size}]}
// Каждый остальной файл внутри ZIP: iv(12 байт) || AES-256-GCM ciphertext.
type exportStructureEntry struct {
	Name string `json:"name"`
	IV   string `json:"iv"` // base64
	Size int    `json:"size"`
}

type exportStructureJSON struct {
	Version int                    `json:"version"`
	Salt    string                 `json:"salt"` // base64
	Entries []exportStructureEntry `json:"entries"`
}

type exportMetaUser struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
}

// meta.json (зашифрован): {version, exportedAt, user, truncated, truncatedMedia}
type exportArchiveMeta struct {
	Version        int            `json:"version"`
	ExportedAt     string         `json:"exportedAt"`
	User           exportMetaUser `json:"user"`
	Truncated      bool           `json:"truncated"`
	TruncatedMedia bool           `json:"truncatedMedia"`
}

// messages.json (зашифрован): {chats: [{chatId, type, name, messages: [...]}]}
type exportMediaJSON struct {
	URL  string `json:"url"`
	Type string `json:"type"`
	Size int    `json:"size"`
}

type exportReactionJSON struct {
	Emoji string `json:"emoji"`
}

type exportMessageJSON struct {
	ID            string              `json:"id"`
	ChatID        string              `json:"chatId"`
	SenderID      string              `json:"senderId"`
	Content       string              `json:"content"`
	Type          string              `json:"type"`
	CreatedAt     string              `json:"createdAt"`
	ReplyToID     string              `json:"replyToId,omitempty"`
	ForwardedFrom string              `json:"forwardedFrom,omitempty"`
	IsEdited      bool                `json:"isEdited,omitempty"`
	IsDeleted     bool                `json:"isDeleted,omitempty"`
	VideoURL      string              `json:"videoUrl,omitempty"`
	Duration      int                 `json:"duration,omitempty"`
	Thumbnail     string              `json:"thumbnail,omitempty"`
	IsEncrypted   bool                `json:"isEncrypted,omitempty"`
	EncryptedContent string           `json:"encryptedContent,omitempty"`
	EncryptedIV     string            `json:"encryptedIv,omitempty"`
	SelfDestructTimer int             `json:"selfDestructTimer,omitempty"`
	Media         []exportMediaJSON   `json:"media"`
	Reactions     []exportReactionJSON `json:"reactions"`
}

type exportChatJSON struct {
	ChatID   string              `json:"chatId"`
	Type     string              `json:"type"`
	Name     string              `json:"name"`
	Messages []exportMessageJSON `json:"messages"`
}

type exportMessagesJSON struct {
	Chats []exportChatJSON `json:"chats"`
}

// ─── Шифрование ────────────────────────────────────────────────────────────

func deriveExportKey(password string, salt []byte) []byte {
	return pbkdf2.Key([]byte(password), salt, pbkdf2Iterations, aesKeyBytes, sha256.New)
}

func encryptExportEntry(key, plain []byte) (iv, sealed []byte, err error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}
	iv = make([]byte, gcm.NonceSize())
	if _, err := rand.Read(iv); err != nil {
		return nil, nil, err
	}
	sealed = gcm.Seal(nil, iv, plain, nil)
	return iv, sealed, nil
}

func decryptExportEntry(key, iv, sealed []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return gcm.Open(nil, iv, sealed, nil)
}

// ─── Помощники ─────────────────────────────────────────────────────────────

// mediaFilenameFromURL вытаскивает имя файла из URL вида "/uploads/<file>".
func mediaFilenameFromURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if !strings.HasPrefix(raw, "/uploads/") {
		return ""
	}
	name := strings.TrimPrefix(raw, "/uploads/")
	name = strings.TrimSpace(name)
	if name == "" || strings.Contains(name, "/") || strings.Contains(name, "\\") || strings.Contains(name, "..") {
		return ""
	}
	return name
}

func parseExportTime(raw string) time.Time {
	if raw == "" {
		return time.Time{}
	}
	if t, err := time.Parse(time.RFC3339Nano, raw); err == nil {
		return t
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t
	}
	return time.Time{}
}

// readZipJSON распаковывает файл из ZIP и парсит JSON.
func readZipJSON(zr *zip.Reader, name string, out interface{}) error {
	for _, f := range zr.File {
		if f.Name != name {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		defer rc.Close()
		dec := json.NewDecoder(io.LimitReader(rc, 512*1024*1024))
		return dec.Decode(out)
	}
	return fmt.Errorf("file %s not found in archive", name)
}

// ─── POST /api/account/export2 ─────────────────────────────────────────────

func ExportAccountZip(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil || len(req.Password) < 8 {
		return c.Status(400).JSON(fiber.Map{"error": "Пароль должен содержать минимум 8 символов"})
	}

	// Rate limit: максимум 2 экспорта на 10 минут.
	if !checkRateLimit("export2:"+userID, 2, 10*time.Minute) {
		return c.Status(429).JSON(fiber.Map{"error": "Слишком много запросов экспорта. Попробуйте позже."})
	}

	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// 1. Чаты, где пользователь участник.
	var memberChatIDs []string
	db.GetDB().Model(&models.ChatMember{}).
		Where("user_id = ?", userID).
		Pluck("chat_id", &memberChatIDs)

	chatInfo := make(map[string]models.Chat)
	var chatOrder []string
	if len(memberChatIDs) > 0 {
		var chats []models.Chat
		db.GetDB().Select("id", "type", "name").
			Where("id IN ?", memberChatIDs).
			Order("updated_at DESC").
			Find(&chats)
		for _, ch := range chats {
			chatInfo[ch.ID] = ch
			chatOrder = append(chatOrder, ch.ID)
		}
	}

	// 2. Сообщения пользователя (со связями), максимум 50 000.
	var messages []models.Message
	err := db.GetDB().
		Preload("Sender", func(d *gorm.DB) *gorm.DB {
			return d.Select("id", "username", "display_name")
		}).
		Preload("Media").
		Preload("Reactions").
		Where("sender_id = ?", userID).
		Order("created_at ASC").
		Limit(exportZipMaxMessages + 1).
		Find(&messages).Error
	if err != nil {
		logging.Log.Error("[EXPORT] messages query failed", "user_id", userID, "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Не удалось собрать сообщения"})
	}

	truncated := len(messages) > exportZipMaxMessages
	if truncated {
		messages = messages[:exportZipMaxMessages]
	}

	// 3. Формируем messages.json и список медиафайлов.
	exported := exportMessagesJSON{Chats: []exportChatJSON{}}
	byChat := make(map[string]*exportChatJSON)
	appendMessage := func(m models.Message) {
		chat, ok := chatInfo[m.ChatID]
		if !ok {
			chat = models.Chat{ID: m.ChatID}
		}
		ec, ok := byChat[m.ChatID]
		if !ok {
			ec = &exportChatJSON{ChatID: m.ChatID, Type: chat.Type, Name: chat.Name, Messages: []exportMessageJSON{}}
			byChat[m.ChatID] = ec
			exported.Chats = append(exported.Chats, *ec) // placeholder; обновим ниже
		}
		em := exportMessageJSON{
			ID:               m.ID,
			ChatID:           m.ChatID,
			SenderID:         m.SenderID,
			Content:          m.Content,
			Type:             m.Type,
			CreatedAt:        m.CreatedAt.UTC().Format(time.RFC3339),
			ReplyToID:        m.ReplyToID,
			ForwardedFrom:    m.ForwardedFromID,
			IsEdited:         m.IsEdited,
			IsDeleted:        m.IsDeleted,
			VideoURL:         m.VideoURL,
			Duration:         m.Duration,
			Thumbnail:        m.Thumbnail,
			IsEncrypted:      m.IsEncrypted,
			EncryptedContent: m.EncryptedContent,
			EncryptedIV:      m.EncryptedIV,
			SelfDestructTimer: m.SelfDestructTimer,
			Media:            []exportMediaJSON{},
			Reactions:        []exportReactionJSON{},
		}
		for _, md := range m.Media {
			em.Media = append(em.Media, exportMediaJSON{URL: md.URL, Type: md.Type, Size: md.Size})
		}
		for _, r := range m.Reactions {
			em.Reactions = append(em.Reactions, exportReactionJSON{Emoji: r.Emoji})
		}
		byChat[m.ChatID].Messages = append(byChat[m.ChatID].Messages, em)
	}

	for _, m := range messages {
		appendMessage(m)
	}
	// Обновляем плейсхолдеры реальными значениями.
	exported.Chats = exported.Chats[:0]
	for _, id := range chatOrder {
		if ec, ok := byChat[id]; ok {
			exported.Chats = append(exported.Chats, *ec)
		}
	}
	for _, ec := range byChat {
		already := false
		for _, e := range exported.Chats {
			if e.ChatID == ec.ChatID {
				already = true
				break
			}
		}
		if !already {
			exported.Chats = append(exported.Chats, *ec)
		}
	}

	// 4. Медиафайлы: уникальные файлы из /uploads/ в пределах 500 MB.
	seenFiles := make(map[string]bool)
	type mediaFile struct {
		name string
		size int64
	}
	var mediaFiles []mediaFile
	var mediaTotal int64
	truncatedMedia := false
	for _, m := range messages {
		urls := []string{m.VideoURL, m.Thumbnail}
		for _, md := range m.Media {
			urls = append(urls, md.URL)
		}
		for _, u := range urls {
			fn := mediaFilenameFromURL(u)
			if fn == "" || seenFiles[fn] {
				continue
			}
			seenFiles[fn] = true
			info, err := os.Stat(filepath.Join(UploadDir(), fn))
			if err != nil || info.IsDir() {
				continue
			}
			if mediaTotal+info.Size() > exportZipMaxMediaBytes {
				truncatedMedia = true
				continue
			}
			mediaTotal += info.Size()
			mediaFiles = append(mediaFiles, mediaFile{name: fn, size: info.Size()})
		}
	}

	// 5. Собираем ZIP: AES-256-GCM поверх каждого entry.
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Ошибка шифрования"})
	}
	key := deriveExportKey(req.Password, salt)

	var zipBuf bytes.Buffer
	zw := zip.NewWriter(&zipBuf)
	structure := exportStructureJSON{Version: 1, Salt: base64.StdEncoding.EncodeToString(salt), Entries: []exportStructureEntry{}}

	addEntry := func(name string, plain []byte) error {
		iv, sealed, err := encryptExportEntry(key, plain)
		if err != nil {
			return err
		}
		payload := make([]byte, 0, len(iv)+len(sealed))
		payload = append(payload, iv...)
		payload = append(payload, sealed...)
		fh := &zip.FileHeader{Name: name, Method: zip.Store}
		fw, err := zw.CreateHeader(fh)
		if err != nil {
			return err
		}
		if _, err := fw.Write(payload); err != nil {
			return err
		}
		structure.Entries = append(structure.Entries, exportStructureEntry{
			Name: name,
			IV:   base64.StdEncoding.EncodeToString(iv),
			Size: len(payload),
		})
		return nil
	}

	meta := exportArchiveMeta{
		Version:        1,
		ExportedAt:     time.Now().UTC().Format(time.RFC3339),
		User:           exportMetaUser{ID: user.ID, Username: user.Username, DisplayName: user.DisplayName},
		Truncated:      truncated,
		TruncatedMedia: truncatedMedia,
	}
	metaJSON, err := json.Marshal(meta)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Ошибка формирования метаданных"})
	}
	messagesJSON, err := json.Marshal(exported)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Ошибка формирования сообщений"})
	}

	if err := addEntry("meta.json", metaJSON); err != nil {
		logging.Log.Warn("[EXPORT] meta entry error", "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Ошибка создания архива"})
	}
	if err := addEntry("messages.json", messagesJSON); err != nil {
		logging.Log.Warn("[EXPORT] messages entry error", "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Ошибка создания архива"})
	}
	for _, mf := range mediaFiles {
		data, err := os.ReadFile(filepath.Join(UploadDir(), mf.name))
		if err != nil {
			continue
		}
		if err := addEntry("media/"+mf.name, data); err != nil {
			logging.Log.Warn("[EXPORT] media entry error", "name", mf.name, "err", err)
			return c.Status(500).JSON(fiber.Map{"error": "Ошибка создания архива"})
		}
	}

	// structure.json пишется последним — к этому моменту известны все entry.
	structureJSON, err := json.Marshal(structure)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Ошибка формирования структуры"})
	}
	sfh := &zip.FileHeader{Name: "structure.json", Method: zip.Store}
	sfw, err := zw.CreateHeader(sfh)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Ошибка создания архива"})
	}
	if _, err := sfw.Write(structureJSON); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Ошибка создания архива"})
	}
	if err := zw.Close(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Ошибка создания архива"})
	}

	if zipBuf.Len() > exportZipMaxTotalBytes {
		return c.Status(413).JSON(fiber.Map{"error": "Слишком много данных для экспорта"})
	}

	filename := fmt.Sprintf("nexo-export-%s.zip", time.Now().Format("2006-01-02"))
	c.Set("Content-Type", "application/zip")
	c.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	return c.Send(zipBuf.Bytes())
}

// ─── POST /api/account/import ──────────────────────────────────────────────

func ImportAccountZip(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	// Rate limit: максимум 5 импортов на 15 минут.
	if !checkRateLimit("import:"+userID, 5, 15*time.Minute) {
		return c.Status(429).JSON(fiber.Map{"error": "Слишком много запросов импорта. Попробуйте позже."})
	}

	// Контроль размера ещё до чтения тела (защита от гигантских Content-Length).
	if cl := c.Get("Content-Length"); cl != "" {
		if n, err := strconv.ParseInt(cl, 10, 64); err == nil && n > importZipMaxBytes+2*1024*1024 {
			return c.Status(413).JSON(fiber.Map{"error": "Архив слишком большой (максимум 50 MB)"})
		}
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Файл не передан (поле file)"})
	}
	if fileHeader.Size > importZipMaxBytes {
		return c.Status(413).JSON(fiber.Map{"error": "Архив слишком большой (максимум 50 MB)"})
	}
	password := c.FormValue("password")
	if len(password) < 8 {
		return c.Status(400).JSON(fiber.Map{"error": "Пароль должен содержать минимум 8 символов"})
	}

	src, err := fileHeader.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Не удалось открыть файл"})
	}
	defer src.Close()
	zipBytes, err := io.ReadAll(io.LimitReader(src, importZipMaxBytes+1))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Не удалось прочитать архив"})
	}
	if int64(len(zipBytes)) > importZipMaxBytes {
		return c.Status(413).JSON(fiber.Map{"error": "Архив слишком большой (максимум 50 MB)"})
	}

	zr, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Неверный ZIP-архив"})
	}

	// structure.json — единственный открытый файл: соль + индексы entry.
	var structure exportStructureJSON
	if err := readZipJSON(zr, "structure.json", &structure); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Неверный формат архива: нет structure.json"})
	}
	if structure.Version != 1 {
		return c.Status(400).JSON(fiber.Map{"error": "Неподдерживаемая версия архива"})
	}
	salt, err := base64.StdEncoding.DecodeString(structure.Salt)
	if err != nil || len(salt) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Неверный формат архива: повреждён salt"})
	}
	key := deriveExportKey(password, salt)

	entriesByName := make(map[string]exportStructureEntry, len(structure.Entries))
	zipByName := make(map[string]*zip.File, len(zr.File))
	for _, e := range structure.Entries {
		entriesByName[e.Name] = e
	}
	for _, f := range zr.File {
		zipByName[f.Name] = f
	}

	decryptEntry := func(name string) ([]byte, error) {
		entry, ok := entriesByName[name]
		if !ok {
			return nil, fmt.Errorf("entry %s missing in structure.json", name)
		}
		zf, ok := zipByName[name]
		if !ok {
			return nil, fmt.Errorf("entry %s missing in archive", name)
		}
		rc, err := zf.Open()
		if err != nil {
			return nil, err
		}
		defer rc.Close()
		payload, err := io.ReadAll(io.LimitReader(rc, int64(entry.Size)))
		if err != nil {
			return nil, err
		}
		if len(payload) < 12 {
			return nil, fmt.Errorf("entry %s too short", name)
		}
		iv, err := base64.StdEncoding.DecodeString(entry.IV)
		if err != nil || len(iv) != 12 {
			return nil, fmt.Errorf("entry %s bad iv", name)
		}
		return decryptExportEntry(key, iv, payload[12:])
	}

	var meta exportArchiveMeta
	metaRaw, err := decryptEntry("meta.json")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Неверный пароль или повреждённый архив"})
	}
	if err := json.Unmarshal(metaRaw, &meta); err != nil || meta.Version != 1 {
		return c.Status(400).JSON(fiber.Map{"error": "Неверный формат архива: повреждён meta.json"})
	}

	messagesRaw, err := decryptEntry("messages.json")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Неверный пароль или повреждённый архив"})
	}
	var archive exportMessagesJSON
	if err := json.Unmarshal(messagesRaw, &archive); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Неверный формат архива: повреждён messages.json"})
	}

	// Подсчёт сообщений — лимит 50 000 за раз.
	totalInArchive := 0
	for _, ch := range archive.Chats {
		totalInArchive += len(ch.Messages)
	}
	if totalInArchive > importZipMaxMessages {
		return c.Status(400).JSON(fiber.Map{"error": "Слишком много сообщений в архиве (максимум 50 000)"})
	}

	// Члены чатов: импортируем только в те, где пользователь участник.
	memberSet := make(map[string]bool)
	var memberships []models.ChatMember
	db.GetDB().Where("user_id = ?", userID).Find(&memberships)
	for _, m := range memberships {
		memberSet[m.ChatID] = true
	}

	// Медиафайлы из архива (media/<file>), ключ — имя файла.
	mediaInArchive := make(map[string][]byte)
	for _, e := range structure.Entries {
		if !strings.HasPrefix(e.Name, "media/") {
			continue
		}
		base := strings.TrimPrefix(e.Name, "media/")
		if base == "" || strings.Contains(base, "/") || strings.Contains(base, "\\") || strings.Contains(base, "..") {
			continue
		}
		data, err := decryptEntry(e.Name)
		if err != nil {
			logging.Log.Warn("[IMPORT] skip media", "user_id", userID, "entry", e.Name, "err", err)
			continue
		}
		mediaInArchive[base] = data
	}

	type resultCounters struct {
		importedMessages int
		skippedMessages  int
		importedMedia    int
		mediaUnavailable int
	}
	counters := resultCounters{}

	tx := db.GetDB().Begin()
	if tx.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Не удалось начать импорт"})
	}
	committed := false
	defer func() {
		if !committed {
			tx.Rollback()
		}
	}()

	// В архиве media-файлы могут быть переиспользованы несколькими
	// сообщениями: сохраняем новый URL один раз на имя файла.
	savedMediaURL := make(map[string]string)

	for _, ch := range archive.Chats {
		if !memberSet[ch.ChatID] {
			counters.skippedMessages += len(ch.Messages)
			logging.Log.Warn("[IMPORT] chat skipped, not a member", "user_id", userID, "chat_id", ch.ChatID, "messages", len(ch.Messages))
			continue
		}
		for _, mj := range ch.Messages {
			// Безопасность: импортируем только собственные сообщения.
			if mj.SenderID != "" && mj.SenderID != userID {
				counters.skippedMessages++
				continue
			}

			msg := models.Message{
				ID:                helpers.GenerateID(),
				ChatID:            ch.ChatID,
				SenderID:          userID,
				Content:           mj.Content,
				Type:              mj.Type,
				ReplyToID:         mj.ReplyToID,
				ForwardedFromID:   mj.ForwardedFrom,
				IsEdited:          mj.IsEdited,
				IsDeleted:         mj.IsDeleted,
				VideoURL:          mj.VideoURL,
				Duration:          mj.Duration,
				Thumbnail:         mj.Thumbnail,
				IsEncrypted:       mj.IsEncrypted,
				EncryptedContent:  mj.EncryptedContent,
				EncryptedIV:       mj.EncryptedIV,
				SelfDestructTimer: mj.SelfDestructTimer,
				CreatedAt:         parseExportTime(mj.CreatedAt),
				Media:             []models.Media{},
			}
			if msg.Type == "" {
				msg.Type = "text"
			}
			if msg.CreatedAt.IsZero() {
				msg.CreatedAt = time.Now()
			}

            for _, mdj := range mj.Media {
                media := models.Media{
                    ID:   helpers.GenerateID(),
                    Type: mdj.Type,
                    Size: mdj.Size,
                }
                if mdj.URL == "" {
                    continue
                }
                fn := mediaFilenameFromURL(mdj.URL)
                if fn != "" {
                    // Already saved during this import - reuse URL.
                    if newURL, ok := savedMediaURL[fn]; ok {
                        media.URL = newURL
                        continue
                    }
if data, ok := mediaInArchive[fn]; ok {
						ext := strings.ToLower(filepath.Ext(fn))
						// Whitelist расширений: архив с иным содержимым
						// (например .html/.svg с вредоносным скриптом) не пишем.
						if !allowedMediaExt[ext] {
							counters.mediaUnavailable++
							continue
						}
						newName := helpers.GenerateID() + ext
                        dest := filepath.Join(UploadDir(), newName)
                        if err := os.WriteFile(dest, data, 0644); err != nil {
                            logging.Log.Error("[IMPORT] failed to write media", "user_id", userID, "name", newName, "err", err)
                            counters.mediaUnavailable++
                            continue
                        }
                        media.URL = "/uploads/" + newName
                        savedMediaURL[fn] = media.URL
                        counters.importedMedia++
                        continue
                    }
                }
                // File not in archive - keep original URL (will break).
                media.URL = mdj.URL
                counters.mediaUnavailable++
            }

			if err := tx.Create(&msg).Error; err != nil {
				logging.Log.Error("[IMPORT] create message failed", "user_id", userID, "err", err)
				return c.Status(500).JSON(fiber.Map{"error": "Ошибка записи сообщения"})
			}
			counters.importedMessages++
		}
	}

	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		committed = true
		return c.Status(500).JSON(fiber.Map{"error": "Ошибка сохранения импорта"})
	}
	committed = true

	return c.JSON(fiber.Map{
		"ok":               true,
		"importedMessages": counters.importedMessages,
		"skippedMessages":  counters.skippedMessages,
		"importedMedia":    counters.importedMedia,
		"mediaUnavailable": counters.mediaUnavailable,
	})
}
