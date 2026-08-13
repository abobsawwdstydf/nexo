package models

import "time"

type User struct {
	ID              string     `json:"id" gorm:"primaryKey"`
	Username        string     `json:"username" gorm:"uniqueIndex;size:64"`
	DisplayName     string     `json:"displayName" gorm:"size:128"`
	Email           string     `json:"email" gorm:"uniqueIndex;size:256"`
	EmailVerified   bool       `json:"emailVerified" gorm:"default:false"`
	Avatar          string     `json:"avatar"`
	Bio             string     `json:"bio"`
	IsOnline        bool       `json:"isOnline" gorm:"default:false"`
	IsVerified       bool       `json:"isVerified" gorm:"default:false"`
	VerifiedBadgeUrl string     `json:"verifiedBadgeUrl"`
	VerifiedBadgeType string    `json:"verifiedBadgeType"`
	IsPremium        bool       `json:"isPremium" gorm:"default:false"`
	IsBanned        bool       `json:"isBanned" gorm:"default:false"`
	BanReason       string     `json:"banReason"`
	IsAdmin         bool       `json:"isAdmin" gorm:"default:false"`
	PremiumUntil    *time.Time `json:"premiumUntil"`
	PremiumBadgeUrl string     `json:"premiumBadgeUrl"`
	Subscribers     int        `json:"subscribersCount" gorm:"default:0"`
	IsVerifiedByBot bool       `json:"isVerifiedByBot" gorm:"default:false"`
	LastSeen        time.Time  `json:"lastSeen" gorm:"autoCreateTime"`
	CreatedAt       time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt       time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`

	// Signal Protocol
	IdentityKey    string `json:"identityKey"`
	SignedPreKey   string `json:"signedPreKey"`
	OneTimePreKeys string `json:"oneTimePreKeys"`

	// Settings
	NotifyAll        bool `json:"notifyAll" gorm:"default:true"`
	NotifyMessages   bool `json:"notifyMessages" gorm:"default:true"`
	NotifyCalls      bool `json:"notifyCalls" gorm:"default:true"`
	NotifyFriends    bool `json:"notifyFriends" gorm:"default:true"`
	TwoFactorEnabled bool `json:"twoFactorEnabled" gorm:"default:false"`

	// TOTP 2FA
	TotpSecret        string `json:"-" gorm:"default:''"`          // base32 secret (never serialized)
	TotpRecoveryCodes string `json:"-" gorm:"type:text"`           // JSON array of sha256(recovery code) hexes
	TotpEnabledAt     *time.Time `json:"totpEnabledAt"`

	// DND (Do Not Disturb)
	DNDUntil   *time.Time `json:"dndUntil"`
	DNDMessage string     `json:"dndMessage" gorm:"size:256"`

	// Mood Status
	MoodStatus    string     `json:"moodStatus" gorm:"size:64"` // emoji or text status
	MoodExpiresAt *time.Time `json:"moodExpiresAt"`

	// Privacy
	WhoCanMessage     string `json:"whoCanMessage" gorm:"size:32;default:everyone"`
	WhoCanCall        string `json:"whoCanCall" gorm:"size:32;default:everyone"`
	WhoCanSeeProfile  string `json:"whoCanSeeProfile" gorm:"size:32;default:everyone"`
	ShowLastSeen      bool   `json:"showLastSeen" gorm:"default:true"`
	AllowGroupInvites bool   `json:"allowGroupInvites" gorm:"default:true"`

	// Appearance
	NameColor    string `json:"nameColor"`
	NameGradient string `json:"nameGradient"`

	// Relationships
	FriendshipsSent     []Friendship `gorm:"foreignKey:UserID"`
	FriendshipsReceived []Friendship `gorm:"foreignKey:FriendID"`
	ChatMembers         []ChatMember `gorm:"foreignKey:UserID"`
}

type Chat struct {
	ID               string    `json:"id" gorm:"primaryKey"`
	Type             string    `json:"type" gorm:"size:32;default:personal"`
	Name             string    `json:"name" gorm:"size:128"`
	Username         string    `json:"username" gorm:"uniqueIndex;size:64"`
	Avatar           string    `json:"avatar"`
	Description      string    `json:"description"`
	IsVerified       bool      `json:"isVerified" gorm:"default:false"`
	IsSecret         bool      `json:"isSecret" gorm:"default:false"`
	IsE2E            bool      `json:"isE2E" gorm:"default:false"`
	SubscribersCount int       `json:"subscribersCount" gorm:"default:0"`
	CanMembersPost   bool      `json:"canMembersPost" gorm:"default:true"`
	CanMembersInvite bool      `json:"canMembersInvite" gorm:"default:true"`
	SlowModeInterval int       `json:"slowModeInterval" gorm:"default:0"`
	WelcomeMessage   string    `json:"welcomeMessage"`
	Rules            string    `json:"rules"`
	CustomIcon       string    `json:"customIcon"`
	CustomColor      string    `json:"customColor"`
	CustomBackground string    `json:"customBackground"`
	LinkedChatID     string    `json:"linkedChatId"`
	LinkedMessageID  string    `json:"linkedMessageId"`
	CreatedAt        time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt        time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Members  []ChatMember `gorm:"foreignKey:ChatID"`
	Messages []Message    `gorm:"foreignKey:ChatID"`
}

type ChatMember struct {
	ID            string     `json:"id" gorm:"primaryKey"`
	ChatID        string     `json:"chatId" gorm:"index"`
	UserID        string     `json:"userId" gorm:"index"`
	Role          string     `json:"role" gorm:"size:32;default:member"`
	JoinedAt      time.Time  `json:"joinedAt" gorm:"autoCreateTime"`
	IsMuted       bool       `json:"isMuted" gorm:"default:false"`
	IsArchived    bool       `json:"isArchived" gorm:"default:false"`
	IsPinned      bool       `json:"isPinned" gorm:"default:false"`
	ClearedAt     *time.Time `json:"clearedAt"`
	LastMessageAt *time.Time `json:"lastMessageAt"`

	Chat Chat `json:"chat" gorm:"foreignKey:ChatID"`
	User User `json:"user" gorm:"foreignKey:UserID"`
}

func (ChatMember) TableName() string { return "chat_members" }

// InviteLink вЂ” СЃСЃС‹Р»РєР°-РїСЂРёРіР»Р°С€РµРЅРёРµ РІ С‡Р°С‚ (РєР°РЅР°Р»/РіСЂСѓРїРїСѓ)
type InviteLink struct {
	ID        string     `json:"id" gorm:"primaryKey"`
	ChatID    string     `json:"chatId" gorm:"index"`
	Code      string     `json:"code" gorm:"uniqueIndex"`
	CreatedBy string     `json:"createdBy"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
	MaxUses   int        `json:"maxUses" gorm:"default:0"` // 0 = Р±РµР· Р»РёРјРёС‚Р°
	Uses      int        `json:"uses" gorm:"default:0"`
	Active    bool       `json:"active" gorm:"default:true"`
	CreatedAt time.Time  `json:"createdAt" gorm:"autoCreateTime"`
}

func (InviteLink) TableName() string { return "invite_links" }

type Message struct {
	ID                string     `json:"id" gorm:"primaryKey"`
	ChatID            string     `json:"chatId" gorm:"index:idx_chat_created"`
	SenderID          string     `json:"senderId" gorm:"index"`
	Content           string     `json:"content"`
	Type              string     `json:"type" gorm:"size:32;default:text"`
	ReplyToID         string     `json:"replyToId"`
	ForwardedFromID   string     `json:"forwardedFromId"`
	IsEdited          bool       `json:"isEdited" gorm:"default:false"`
	IsDeleted         bool       `json:"isDeleted" gorm:"default:false"`
	ScheduledAt       *time.Time `json:"scheduledAt"`
	CreatedAt         time.Time  `json:"createdAt" gorm:"autoCreateTime;index:idx_chat_created"`
	UpdatedAt         time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`
	EditedAt          *time.Time `json:"editedAt"`
	VideoURL          string     `json:"videoUrl"`
	Duration          int        `json:"duration"`
	Thumbnail         string     `json:"thumbnail"`
	IsEncrypted       bool       `json:"isEncrypted" gorm:"default:false"`
	EncryptedContent  string     `json:"encryptedContent"`
	EncryptedIV       string     `json:"encryptedIv"`
	SenderKeyID       string     `json:"senderKeyId"`
	ThreadID          string     `json:"threadId"`
	SelfDestructTimer int        `json:"selfDestructTimer"`
	SelfDestructAt    *time.Time `json:"selfDestructAt"`
	CanForward        bool       `json:"canForward" gorm:"default:true"`
	CanScreenshot     bool       `json:"canScreenshot" gorm:"default:true"`
	ReplyMarkup       string     `json:"-" gorm:"type:text"` // inline-РєР»Р°РІРёР°С‚СѓСЂР° (JSON, Bot API)

	Sender        User          `json:"sender" gorm:"foreignKey:SenderID"`
	Chat          Chat          `json:"-" gorm:"foreignKey:ChatID"`
	ReplyTo       *Message      `json:"replyTo,omitempty" gorm:"foreignKey:ReplyToID"`
	ForwardedFrom *User         `json:"forwardedFrom,omitempty" gorm:"foreignKey:ForwardedFromID"`
	Media         []Media       `json:"media" gorm:"foreignKey:MessageID"`
	Reactions     []Reaction    `json:"reactions" gorm:"foreignKey:MessageID"`
	ReadBy        []ReadReceipt `json:"readBy" gorm:"foreignKey:MessageID"`
}

// AIMessage stores РќРµРєСЃРѕ AI chat history per user (server-side persistence).
type AIMessage struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index:idx_ai_messages_user_created"`
	Role      string    `json:"role" gorm:"size:16"` // user | assistant
	Content   string    `json:"content" gorm:"type:text"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime;index:idx_ai_messages_user_created"`
}

func (AIMessage) TableName() string { return "ai_messages" }

type Media struct {
	ID        string  `json:"id" gorm:"primaryKey"`
	MessageID string  `json:"messageId" gorm:"index"`
	Type      string  `json:"type" gorm:"size:32"`
	URL       string  `json:"url"`
	Filename  string  `json:"filename"`
	Thumbnail string  `json:"thumbnail"`
	Size      int     `json:"size"`
	Duration  float64 `json:"duration"`
	Width     int     `json:"width"`
	Height    int     `json:"height"`
	Order     int     `json:"order" gorm:"default:0"`

	ConvertedURL   string `json:"convertedUrl"`
	OriginalFormat string `json:"originalFormat"`

	Message Message `json:"-" gorm:"foreignKey:MessageID"`
}

type Reaction struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	MessageID string    `json:"messageId" gorm:"index"`
	UserID    string    `json:"userId" gorm:"index"`
	Emoji     string    `json:"emoji" gorm:"size:16"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Message Message `json:"-" gorm:"foreignKey:MessageID"`
	User    User    `json:"user" gorm:"foreignKey:UserID"`
}

type ReadReceipt struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	MessageID string    `json:"messageId" gorm:"index;uniqueIndex:idx_read_receipts_message_user"`
	UserID    string    `json:"userId" gorm:"index;uniqueIndex:idx_read_receipts_message_user"`
	ReadAt    time.Time `json:"readAt" gorm:"autoCreateTime"`

	Message Message `json:"-" gorm:"foreignKey:MessageID"`
	User    User    `json:"-" gorm:"foreignKey:UserID"`
}

type Story struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	UserID         string    `json:"userId" gorm:"index"`
	Type           string    `json:"type" gorm:"size:32;default:text"`
	MediaURL       string    `json:"mediaUrl"`
	Content        string    `json:"content"`
	BgColor        string    `json:"bgColor"`
	IsEncrypted      bool      `json:"isEncrypted,omitempty" gorm:"default:false"`
	EncryptedContent string    `json:"encryptedContent,omitempty"`
	EncryptedIV      string    `json:"encryptedIv,omitempty"`
	MyWrappedKey     string    `json:"myWrappedKey,omitempty" gorm:"-"`
	IsHighlight    bool      `json:"isHighlight" gorm:"default:false"`
	HighlightTitle string    `json:"highlightTitle"`
	HighlightCover string    `json:"highlightCover"`
	CreatedAt      time.Time `json:"createdAt" gorm:"autoCreateTime"`
	ExpiresAt      time.Time `json:"expiresAt" gorm:"index"`

	User      User            `json:"user" gorm:"foreignKey:UserID"`
	Views     []StoryView     `json:"views" gorm:"foreignKey:StoryID"`
	Reactions []StoryReaction `json:"reactions" gorm:"foreignKey:StoryID"`
}

// StoryKeyWrap вЂ” РѕР±С‘СЂРЅСѓС‚С‹Р№ РєР»СЋС‡ СЃРµРєСЂРµС‚РЅРѕР№ РёСЃС‚РѕСЂРёРё (РєР»РёРµРЅС‚ РѕР±РѕСЂР°С‡РёРІР°РµС‚ РєР»СЋС‡
// K РґР»СЏ РєР°Р¶РґРѕРіРѕ Р·СЂРёС‚РµР»СЏ ECDH-СЃРµРєСЂРµС‚РѕРј; СЃРµСЂРІРµСЂ С…СЂР°РЅРёС‚ С‚РѕР»СЊРєРѕ wrapped-РІРµСЂСЃРёРё)
type StoryKeyWrap struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	StoryID    string    `json:"storyId" gorm:"index;uniqueIndex:idx_story_key_wrap_story_user"`
	UserID     string    `json:"userId" gorm:"index;uniqueIndex:idx_story_key_wrap_story_user"`
	WrappedKey string    `json:"wrappedKey" gorm:"type:text"`
	CreatedAt  time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Story Story `json:"-" gorm:"foreignKey:StoryID"`
	User  User  `json:"-" gorm:"foreignKey:UserID"`
}
type StoryView struct {
	ID       string    `json:"id" gorm:"primaryKey"`
	StoryID  string    `json:"storyId" gorm:"index"`
	UserID   string    `json:"userId" gorm:"index"`
	ViewedAt time.Time `json:"viewedAt" gorm:"autoCreateTime"`

	Story Story `json:"-" gorm:"foreignKey:StoryID"`
	User  User  `json:"user" gorm:"foreignKey:UserID"`
}

type StoryReaction struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	StoryID   string    `json:"storyId" gorm:"index"`
	UserID    string    `json:"userId" gorm:"index"`
	Emoji     string    `json:"emoji" gorm:"size:16"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Story Story `json:"-" gorm:"foreignKey:StoryID"`
}

type Friendship struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index"`
	FriendID  string    `json:"friendId" gorm:"index"`
	Status    string    `json:"status" gorm:"size:32;default:pending"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	User   User `json:"user" gorm:"foreignKey:UserID"`
	Friend User `json:"friend" gorm:"foreignKey:FriendID"`
}

type CallLog struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	CallerID  string    `json:"callerId" gorm:"index"`
	CalleeID  string    `json:"calleeId" gorm:"index"`
	ChatID    string    `json:"chatId"`
	Type      string    `json:"type" gorm:"size:32;default:voice"`
	Status    string    `json:"status" gorm:"size:32;default:completed"`
	Duration  float64   `json:"duration"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Caller User  `json:"caller" gorm:"foreignKey:CallerID"`
	Callee *User `json:"callee,omitempty" gorm:"foreignKey:CalleeID"`
}

type TypingIndicator struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	ChatID    string    `json:"chatId" gorm:"index"`
	UserID    string    `json:"userId"`
	StartedAt time.Time `json:"startedAt" gorm:"autoCreateTime"`
	ExpiresAt time.Time `json:"expiresAt" gorm:"index"`

	Chat Chat `json:"-" gorm:"foreignKey:ChatID"`
	User User `json:"-" gorm:"foreignKey:UserID"`
}

type StickerPack struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatorID   string    `json:"creatorId" gorm:"index"`
	Thumbnail   string    `json:"thumbnail"`
	Type        string    `json:"type" gorm:"size:16;default:sticker"` // sticker | emoji
	IsPublic    bool      `json:"isPublic" gorm:"default:true"`
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Stickers []Sticker `json:"stickers" gorm:"foreignKey:PackID"`
}

type Sticker struct {
	ID       string `json:"id" gorm:"primaryKey"`
	PackID   string `json:"packId" gorm:"index"`
	Emoji    string `json:"emoji" gorm:"size:16"`
	FileURL  string `json:"fileUrl"`
	FileSize int    `json:"fileSize"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Order    int    `json:"order" gorm:"default:0"`

	Pack StickerPack `json:"-" gorm:"foreignKey:PackID"`
}

type Bookmark struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index"`
	MessageID string    `json:"messageId"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User    User    `json:"-" gorm:"foreignKey:UserID"`
	Message Message `json:"message" gorm:"foreignKey:MessageID"`
}

type BlockedUser struct {
	ID            string    `json:"id" gorm:"primaryKey"`
	UserID        string    `json:"userId" gorm:"index"`
	BlockedUserID string    `json:"blockedUserId" gorm:"index"`
	CreatedAt     time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User        User `json:"-" gorm:"foreignKey:UserID"`
	BlockedUser User `json:"blockedUser" gorm:"foreignKey:BlockedUserID"`
}

type UserDevice struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	UserID       string    `json:"userId" gorm:"index"`
	DeviceID     string    `json:"deviceId" gorm:"uniqueIndex;size:128"`
	DeviceName   string    `json:"deviceName" gorm:"size:128"`
	DeviceType   string    `json:"deviceType" gorm:"size:32"`
	Platform     string    `json:"platform" gorm:"size:32"`
	IPAddress    string    `json:"ipAddress" gorm:"size:45"`
	IdentityKey  string    `json:"identityKey"`
	SignedPreKey string    `json:"signedPreKey"`
	LastActive   time.Time `json:"lastActive" gorm:"autoCreateTime"`
	CreatedAt    time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

type VerificationRequest struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index"`
	Provider  string    `json:"provider" gorm:"size:32"`               // "telegram" or "max"
	Token     string    `json:"token" gorm:"size:128"`                 // verification token
	Code      string    `json:"code" gorm:"size:16"`                   // numeric code user enters
	Status    string    `json:"status" gorm:"size:32;default:pending"` // pending, confirmed, expired
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	ExpiresAt time.Time `json:"expiresAt"`

	User User `json:"user" gorm:"foreignKey:UserID"`
}

type Payment struct {
	ID            string    `json:"id" gorm:"primaryKey"`
	UserID        string    `json:"userId" gorm:"index"`
	YooKassaID    string    `json:"yooKassaId" gorm:"uniqueIndex;size:128"`
	Amount        int       `json:"amount"` // in rubles
	Currency      string    `json:"currency" gorm:"size:3;default:RUB"`
	Type          string    `json:"type" gorm:"size:32"`                   // "premium", "premium_gift"
	Status        string    `json:"status" gorm:"size:32;default:pending"` // pending, succeeded, canceled
	GiftToUserID  string    `json:"giftToUserId"`                          // for gifts
	PremiumMonths int       `json:"premiumMonths"`
	Metadata      string    `json:"metadata"` // JSON metadata
	PromoCode     string    `json:"promoCode,omitempty"`
	CreatedAt     time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt     time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	User       User  `json:"user" gorm:"foreignKey:UserID"`
	GiftToUser *User `json:"giftToUser,omitempty" gorm:"foreignKey:GiftToUserID"`
}

// PromoCode вЂ” РєСѓРїРѕРЅ РЅР° Р·РЅРёР¶РєСѓ РґР»СЏ РїСЂРµРјС–СѓРјСѓ
type PromoCode struct {
	ID              string     `json:"id" gorm:"primaryKey"`
	Code            string     `json:"code" gorm:"uniqueIndex;size:64"`
	DiscountPercent int        `json:"discountPercent"` // 1-99
	MaxUses         int        `json:"maxUses"`
	UsedCount       int        `json:"usedCount"`
	Active          bool       `json:"active" gorm:"default:true"`
	ExpiresAt       *time.Time `json:"expiresAt,omitempty"`
	CreatedAt       time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt       time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`
}

type BotHealthCheck struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Provider  string    `json:"provider" gorm:"size:32;uniqueIndex"` // "telegram" or "max"
	IsHealthy bool      `json:"isHealthy" gorm:"default:false"`
	LastCheck time.Time `json:"lastCheck"`
	Error     string    `json:"error"`
}

type WallPost struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	AuthorID       string    `json:"authorId" gorm:"index"`
	Content        string    `json:"content"`
	ViewsCount     int       `json:"viewsCount" gorm:"default:0"`
	OriginalPostID string    `json:"originalPostId"`
	CreatedAt      time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt      time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Author    User               `json:"author" gorm:"foreignKey:AuthorID"`
	Media     []WallPostMedia    `json:"media" gorm:"foreignKey:PostID"`
	Reactions []WallPostReaction `json:"reactions" gorm:"foreignKey:PostID"`
	Comments  []WallPostComment  `json:"comments" gorm:"foreignKey:PostID"`
}

type WallPostMedia struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	PostID    string    `json:"postId" gorm:"index"`
	Type      string    `json:"type" gorm:"size:32"`
	URL       string    `json:"url"`
	Thumbnail string    `json:"thumbnail"`
	Duration  float64   `json:"duration"`
	Size      int       `json:"size"`
	Order     int       `json:"order" gorm:"default:0"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Post WallPost `json:"-" gorm:"foreignKey:PostID"`
}

type WallPostReaction struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	PostID    string    `json:"postId" gorm:"index"`
	UserID    string    `json:"userId" gorm:"index"`
	Emoji     string    `json:"emoji" gorm:"size:16"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Post WallPost `json:"-" gorm:"foreignKey:PostID"`
}

type WallPostComment struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	PostID    string    `json:"postId" gorm:"index"`
	AuthorID  string    `json:"authorId" gorm:"index"`
	ParentID  string    `json:"parentId"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Post    WallPost          `json:"-" gorm:"foreignKey:PostID"`
	Author  User              `json:"author" gorm:"foreignKey:AuthorID"`
	Replies []WallPostComment `json:"replies,omitempty" gorm:"foreignKey:ParentID"`
}

// CSRFToken stores CSRF tokens in the database for resilience across restarts.
type CSRFToken struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Token     string    `json:"token" gorm:"uniqueIndex;size:64"`
	SessionID string    `json:"sessionId" gorm:"size:64"`
	ExpiresAt time.Time `json:"expiresAt" gorm:"index"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
}

// AuditLogEntry stores security audit events in the database for persistence.
type AuditLogEntry struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Timestamp time.Time `json:"timestamp" gorm:"autoCreateTime"`
	UserID    string    `json:"userId" gorm:"size:64;index"`
	Action    string    `json:"action" gorm:"size:128"`
	IP        string    `json:"ip" gorm:"size:45"`
	UserAgent string    `json:"userAgent" gorm:"size:256"`
	Success   bool      `json:"success"`
	Details   string    `json:"details" gorm:"size:512"`
}
type RegisterRequest struct {
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Email       string `json:"email"`
	Bio         string `json:"bio"`
}

type VerifyRequest struct {
	Provider string `json:"provider"` // "telegram" or "max"
}

type VerifyConfirmRequest struct {
	Provider string `json:"provider"`
	Code     string `json:"code"`
}

type CreatePaymentRequest struct {
	Type          string `json:"type"` // "premium" or "premium_gift"
	PremiumMonths int    `json:"premiumMonths"`
	GiftToUserID  string `json:"giftToUserId,omitempty"`
	PromoCode     string `json:"promoCode,omitempty"`
}

type PaymentCallbackRequest struct {
	Status string `json:"status"`
}

type BotHealthStatus struct {
	Telegram *BotProviderStatus `json:"telegram"`
	Max      *BotProviderStatus `json:"max"`
}

type BotProviderStatus struct {
	Available bool   `json:"available"`
	Healthy   bool   `json:"healthy"`
	Error     string `json:"error,omitempty"`
}

type LoginSendCodeRequest struct {
	Email string `json:"email"`
}

type LoginConfirmRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type AuthResponse struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	User         User   `json:"user"`
}

type LoginCodeResponse struct {
	RequiresCode bool   `json:"requiresCode"`
	ExpiresAt    string `json:"expiresAt,omitempty"`
}

type SendMessageRequest struct {
	Content          string `json:"content"`
	Type             string `json:"type"`
	ReplyToID        string `json:"replyToId"`
	ForwardedFromID  string `json:"forwardedFromId"`
	IsEncrypted      bool   `json:"isEncrypted"`
	EncryptedContent string `json:"encryptedContent"`
	EncryptedIV      string `json:"encryptedIv"`
	SelfDestructTimer int   `json:"selfDestructTimer"` // seconds, 0 = no timer
}

type CreateChatRequest struct {
	Type           string   `json:"type"`
	Name           string   `json:"name"`
	Username       string   `json:"username"`
	Description    string   `json:"description"`
	MemberIDs      []string `json:"memberIds"`
	IsSecret       bool     `json:"isSecret"`
	IsE2E          bool     `json:"isE2E"`
	WelcomeMessage string   `json:"welcomeMessage"`
}

type UpdateProfileRequest struct {
	DisplayName  *string `json:"displayName"`
	Bio          *string `json:"bio"`
	Avatar       *string `json:"avatar"`
	NameColor    *string `json:"nameColor"`
	NameGradient *string `json:"nameGradient"`
	Username     *string `json:"username"`
}

type EmailVerification struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	Email     string    `json:"email" gorm:"index;size:256"`
	Code      string    `json:"-" gorm:"size:8"`
	Status    string    `json:"status" gorm:"size:32;default:pending"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	ExpiresAt time.Time `json:"expiresAt"`
}

type SendEmailCodeRequest struct {
	Email string `json:"email"`
}

type ConfirmEmailCodeRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

// в”Ђв”Ђв”Ђ Bot API Models в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type Bot struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name" gorm:"size:128"`
	Username    string    `json:"username" gorm:"uniqueIndex;size:64"`
	Token       string    `json:"-" gorm:"uniqueIndex;size:256"`
	OwnerID     string    `json:"ownerId" gorm:"index"`
	Description string    `json:"description"`
	Avatar      string    `json:"avatar"`
	WebhookURL  string    `json:"webhookUrl"`
	IsActive    bool      `json:"isActive" gorm:"default:true"`
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Commands      []BotCommand      `json:"commands" gorm:"foreignKey:BotID"`
	Installations []BotInstallation `json:"installations" gorm:"foreignKey:BotID"`
}

type BotCommand struct {
	ID          string `json:"id" gorm:"primaryKey"`
	BotID       string `json:"botId" gorm:"index"`
	Command     string `json:"command" gorm:"size:64"`
	Description string `json:"description"`
	Response    string `json:"response"`
	HandlerURL  string `json:"handlerUrl"`
	IsActive    bool   `json:"isActive" gorm:"default:true"`

	Bot Bot `json:"-" gorm:"foreignKey:BotID"`
}

type BotInstallation struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	BotID       string    `json:"botId" gorm:"index"`
	ChatID      string    `json:"chatId" gorm:"index"`
	InstalledBy string    `json:"installedBy"`
	IsActive    bool      `json:"isActive" gorm:"default:true"`
	InstalledAt time.Time `json:"installedAt" gorm:"autoCreateTime"`

	Bot Bot `json:"-" gorm:"foreignKey:BotID"`
}

// BotUpdate вЂ” РѕС‡РµСЂРµРґСЊ Р°РїРґРµР№С‚РѕРІ РґР»СЏ Р±РѕС‚Р° (Telegram Bot API: getUpdates / webhook)
type BotUpdate struct {
	ID        uint      `json:"-" gorm:"primaryKey;autoIncrement"` // = update_id
	BotID     string    `json:"-" gorm:"index;size:64"`
	Payload   string    `json:"-" gorm:"type:text"` // JSON Р°РїРґРµР№С‚Р° РІ С„РѕСЂРјР°С‚Рµ Telegram
	CreatedAt time.Time `json:"-" gorm:"autoCreateTime"`
}

// BotMessageSeq вЂ” РјР°РїРїРёРЅРі РЅР°С€РµРіРѕ СЃС‚СЂРѕРєРѕРІРѕРіРѕ message ID РЅР° С‡РёСЃР»РѕРІРѕР№ message_id (Telegram)
type BotMessageSeq struct {
	ID        uint      `json:"-" gorm:"primaryKey;autoIncrement"` // = message_id РІ Bot API
	BotID     string    `json:"-" gorm:"index;size:64"`
	ChatID    string    `json:"-" gorm:"index;size:64"`
	MessageID string    `json:"-" gorm:"index;size:64"` // РЅР°С€ СЃС‚СЂРѕРєРѕРІС‹Р№ ID
	CreatedAt time.Time `json:"-" gorm:"autoCreateTime"`
}

// BotChatState вЂ” СЃРѕСЃС‚РѕСЏРЅРёРµ С‡Р°С‚Р° Р±РѕС‚Р° (reply-РєР»Р°РІРёР°С‚СѓСЂР° Рё С‚.Рї.)
type BotChatState struct {
	ID          string    `json:"-" gorm:"primaryKey"`
	BotID       string    `json:"-" gorm:"index;size:64"`
	ChatID      string    `json:"-" gorm:"index;size:64"`
	ReplyMarkup string    `json:"-" gorm:"type:text"` // reply-РєР»Р°РІРёР°С‚СѓСЂР° JSON РёР»Рё ""
	UpdatedAt   time.Time `json:"-" gorm:"autoUpdateTime"`
}

// UsernameAlias вЂ” РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Р№ СЋР·РµСЂРЅРµР№Рј РґР»СЏ premium (user/chat/bot)
type UsernameAlias struct {
	ID         string    `json:"-" gorm:"primaryKey"`
	SubjectType string   `json:"subjectType" gorm:"size:16"` // "user", "chat", "bot"
	SubjectID  string    `json:"subjectId" gorm:"index;size:64"`
	Alias      string    `json:"alias" gorm:"uniqueIndex:idx_alias_subject;size:64"`
	IsValid    bool      `json:"isValid" gorm:"default:true"`
	CreatedAt  time.Time `json:"-" gorm:"autoCreateTime"`
}

// в”Ђв”Ђв”Ђ Search History в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type SearchHistory struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	UserID      string    `json:"userId" gorm:"index"`
	Query       string    `json:"query"`
	Type        string    `json:"type" gorm:"size:32"`
	ResultCount int       `json:"resultCount"`
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
}

// в”Ђв”Ђв”Ђ Moderation в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type ModerationLog struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	ChatID    string    `json:"chatId" gorm:"index"`
	TargetID  string    `json:"targetId" gorm:"index"`
	ActorID   string    `json:"actorId" gorm:"index"`
	Action    string    `json:"action" gorm:"size:32"`
	Reason    string    `json:"reason"`
	Duration  int       `json:"duration"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
}

// в”Ђв”Ђв”Ђ API Request Types for Bots в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type CreateBotRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Avatar      string `json:"avatar"`
	WebhookURL  string `json:"webhookUrl"`
}

type UpdateBotRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Avatar      string `json:"avatar"`
	WebhookURL  string `json:"webhookUrl"`
	IsActive    *bool  `json:"isActive"`
}

type AddBotCommandRequest struct {
	Command     string `json:"command"`
	Description string `json:"description"`
	Response    string `json:"response"`
	HandlerURL  string `json:"handlerUrl"`
}

type BotSendMessageRequest struct {
	ChatID  string `json:"chatId"`
	Content string `json:"content"`
	Type    string `json:"type"`
}

type SetWebhookRequest struct {
	URL string `json:"url"`
}

type PrivacySettingsRequest struct {
	WhoCanMessage     string `json:"whoCanMessage"`
	WhoCanCall        string `json:"whoCanCall"`
	WhoCanSeeProfile  string `json:"whoCanSeeProfile"`
	ShowLastSeen      *bool  `json:"showLastSeen"`
	AllowGroupInvites *bool  `json:"allowGroupInvites"`
}

type BanUserRequest struct {
	TargetID string `json:"targetId"`
	Reason   string `json:"reason"`
	Duration int    `json:"duration"` // minutes, 0 = permanent
}

type MuteUserRequest struct {
	TargetID string `json:"targetId"`
	Duration int    `json:"duration"` // minutes, 0 = default 1 hour
}

type KickUserRequest struct {
	TargetID string `json:"targetId"`
}

type SlowModeRequest struct {
	Interval int `json:"interval"` // seconds, 0 = off
}

// в”Ђв”Ђв”Ђ Feature 1: Smart Folders в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type SmartFolder struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index"`
	Name      string    `json:"name" gorm:"size:128"`
	Icon      string    `json:"icon" gorm:"size:32"`
	Color     string    `json:"color" gorm:"size:16"`
	Order     int       `json:"order" gorm:"default:0"`
	Rules     string    `json:"rules" gorm:"type:text"` // JSON: [{"type":"unread"},{"type":"mentions"},{"type":"media","value":"photo"},{"type":"keyword","value":"deploy"}]
	IsActive  bool      `json:"isActive" gorm:"default:true"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ Feature 2: Shared Notes (Chat Notes) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type ChatNote struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	ChatID    string    `json:"chatId" gorm:"index"`
	UserID    string    `json:"userId" gorm:"index"`
	Content   string    `json:"content" gorm:"type:text"`
	Pinned    bool      `json:"pinned" gorm:"default:false"`
	Order     int       `json:"order" gorm:"default:0"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Chat Chat `json:"-" gorm:"foreignKey:ChatID"`
	User User `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ Feature 3: Link Collector в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type CollectedLink struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	ChatID      string    `json:"chatId" gorm:"index"`
	MessageID   string    `json:"messageId" gorm:"index"`
	UserID      string    `json:"userId" gorm:"index"`
	URL         string    `json:"url" gorm:"size:2048"`
	Title       string    `json:"title" gorm:"size:512"`
	Description string    `json:"description" gorm:"size:1024"`
	ImageURL    string    `json:"imageUrl" gorm:"size:2048"`
	Domain      string    `json:"domain" gorm:"size:256;index"`
	Category    string    `json:"category" gorm:"size:32;default:other"` // link, image, video, document, other
	IsSaved     bool      `json:"isSaved" gorm:"default:false"`
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Chat    Chat    `json:"-" gorm:"foreignKey:ChatID"`
	Message Message `json:"-" gorm:"foreignKey:MessageID"`
	User    User    `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ Feature 4: Voice Rooms в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type VoiceRoom struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	ChatID      string    `json:"chatId" gorm:"index"`
	Name        string    `json:"name" gorm:"size:128"`
	Description string    `json:"description" gorm:"size:512"`
	CreatorID   string    `json:"creatorId" gorm:"index"`
	IsActive    bool      `json:"isActive" gorm:"default:true"`
	MaxUsers    int       `json:"maxUsers" gorm:"default:50"`
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Chat         Chat                   `json:"-" gorm:"foreignKey:ChatID"`
	Creator      User                   `json:"creator" gorm:"foreignKey:CreatorID"`
	Participants []VoiceRoomParticipant `json:"participants" gorm:"foreignKey:RoomID"`
}

type VoiceRoomParticipant struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	RoomID     string    `json:"roomId" gorm:"index"`
	UserID     string    `json:"userId" gorm:"index"`
	IsMuted    bool      `json:"isMuted" gorm:"default:false"`
	IsDeaf     bool      `json:"isDeaf" gorm:"default:false"`
	IsSpeaking bool      `json:"isSpeaking" gorm:"default:false"`
	JoinedAt   time.Time `json:"joinedAt" gorm:"autoCreateTime"`

	Room VoiceRoom `json:"-" gorm:"foreignKey:RoomID"`
	User User      `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ Feature 5: Anonymous Chats в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type AnonymousChat struct {
	ID           string     `json:"id" gorm:"primaryKey"`
	User1ID      string     `json:"user1Id" gorm:"index"`
	User2ID      string     `json:"user2Id" gorm:"index"`
	User1Alias   string     `json:"user1Alias" gorm:"size:64"` // СЃР»СѓС‡Р°Р№РЅС‹Р№ РЅРёРєРЅРµР№Рј
	User2Alias   string     `json:"user2Alias" gorm:"size:64"`
	IsConnected  bool       `json:"isConnected" gorm:"default:false"`
	Topic        string     `json:"topic" gorm:"size:128"`
	StartedAt    time.Time  `json:"startedAt" gorm:"autoCreateTime"`
	EndedAt      *time.Time `json:"endedAt"`
	Rating       int        `json:"rating" gorm:"default:0"` // -1, 0, 1
	MessageCount int        `json:"messageCount" gorm:"default:0"`

	User1 User `json:"-" gorm:"foreignKey:User1ID"`
	User2 User `json:"-" gorm:"foreignKey:User2ID"`
}

// в”Ђв”Ђв”Ђ Feature 6: Gamification в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type UserXP struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	UserID     string    `json:"userId" gorm:"uniqueIndex"`
	TotalXP    int       `json:"totalXP" gorm:"default:0"`
	Level      int       `json:"level" gorm:"default:1"`
	Streak     int       `json:"streak" gorm:"default:0"` // РґРЅРё РїРѕРґСЂСЏРґ
	LastActive time.Time `json:"lastActive" gorm:"autoCreateTime"`
	CreatedAt  time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt  time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

type Achievement struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name" gorm:"uniqueIndex;size:128"`
	Title       string    `json:"title" gorm:"size:256"`
	Description string    `json:"description" gorm:"size:512"`
	Icon        string    `json:"icon" gorm:"size:32"`
	Category    string    `json:"category" gorm:"size:32"` // social, messaging, media, special
	RequiredXP  int       `json:"requiredXP" gorm:"default:0"`
	IsHidden    bool      `json:"isHidden" gorm:"default:false"`
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
}

type UserAchievement struct {
	ID            string     `json:"id" gorm:"primaryKey"`
	UserID        string     `json:"userId" gorm:"index"`
	AchievementID string     `json:"achievementId" gorm:"index"`
	Progress      int        `json:"progress" gorm:"default:0"`
	UnlockedAt    *time.Time `json:"unlockedAt"`
	CreatedAt     time.Time  `json:"createdAt" gorm:"autoCreateTime"`

	User        User        `json:"-" gorm:"foreignKey:UserID"`
	Achievement Achievement `json:"-" gorm:"foreignKey:AchievementID"`
}

type XPLog struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index"`
	Amount    int       `json:"amount"`
	Reason    string    `json:"reason" gorm:"size:64"` // message_sent, message_received, voice_call, achievement
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ Feature 7: E2E Encryption Key Exchange в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type E2EKeyBundle struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	UserID         string    `json:"userId" gorm:"index;uniqueIndex:idx_e2e_user_device"`
	DeviceID       string    `json:"deviceId" gorm:"size:128;uniqueIndex:idx_e2e_user_device"`
	IdentityKey    string    `json:"identityKey"`
	SignedPreKey   string    `json:"signedPreKey"`
	SignedKeySig   string    `json:"signedKeySig"`
	OneTimePreKeys string    `json:"oneTimePreKeys" gorm:"type:text"` // JSON array
	UploadedAt     time.Time `json:"uploadedAt" gorm:"autoCreateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

type E2ESession struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	ChatID       string    `json:"chatId" gorm:"index"`
	User1ID      string    `json:"user1Id" gorm:"index"`
	User2ID      string    `json:"user2Id" gorm:"index"`
	SharedSecret string    `json:"sharedSecret"` // base64 shared secret
	IsActive     bool      `json:"isActive" gorm:"default:true"`
	CreatedAt    time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt    time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Chat  Chat `json:"-" gorm:"foreignKey:ChatID"`
	User1 User `json:"-" gorm:"foreignKey:User1ID"`
	User2 User `json:"-" gorm:"foreignKey:User2ID"`
}

// E2EGroupKey вЂ” РѕР±С‘СЂРЅСѓС‚С‹Р№ РіСЂСѓРїРїРѕРІРѕР№ РєР»СЋС‡ E2E. РЎРµСЂРІРµСЂ РЅРµ Р·РЅР°РµС‚ РїСЂРёРІР°С‚РЅС‹С…
// РєР»СЋС‡РµР№: РєР»РёРµРЅС‚ СЃР°Рј РіРµРЅРµСЂРёСЂСѓРµС‚ РіСЂСѓРїРїРѕРІРѕР№ РєР»СЋС‡, РѕР±РѕСЂР°С‡РёРІР°РµС‚ РµРіРѕ РґР»СЏ РєР°Р¶РґРѕРіРѕ
// СѓС‡Р°СЃС‚РЅРёРєР° (ECDH shared secret + AES-GCM) Рё РїСЂРёСЃС‹Р»Р°РµС‚ СЃРµСЂРІРµСЂСѓ РЅР° С…СЂР°РЅРµРЅРёРµ.
type E2EGroupKey struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	ChatID     string    `json:"chatId" gorm:"index;uniqueIndex:idx_e2e_group_key_chat_user"`
	UserID     string    `json:"userId" gorm:"index;uniqueIndex:idx_e2e_group_key_chat_user"`
	WrappedKey string    `json:"wrappedKey" gorm:"type:text"`
	CreatedBy  string    `json:"createdBy" gorm:"index"` // РёРЅРёС†РёР°С‚РѕСЂ СЃРѕР·РґР°РЅРёСЏ/СЂРѕС‚Р°С†РёРё РіСЂСѓРїРїРѕРІРѕР№ СЃРµСЃСЃРёРё
	CreatedAt  time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt  time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Chat Chat `json:"-" gorm:"foreignKey:ChatID"`
	User User `json:"-" gorm:"foreignKey:UserID"`
}
// в”Ђв”Ђв”Ђ Feature 8: AI Commands в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type AICommandLog struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	UserID     string    `json:"userId" gorm:"index"`
	ChatID     string    `json:"chatId" gorm:"index"`
	MessageID  string    `json:"messageId"`
	Command    string    `json:"command" gorm:"size:64"` // РЅРµРєСЃРѕ-РёРё
	Prompt     string    `json:"prompt" gorm:"type:text"`
	Response   string    `json:"response" gorm:"type:text"`
	Model      string    `json:"model" gorm:"size:64"`
	TokensUsed int       `json:"tokensUsed" gorm:"default:0"`
	Duration   int       `json:"duration" gorm:"default:0"` // ms
	CreatedAt  time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User    User    `json:"-" gorm:"foreignKey:UserID"`
	Chat    Chat    `json:"-" gorm:"foreignKey:ChatID"`
	Message Message `json:"-" gorm:"foreignKey:MessageID"`
}

// в”Ђв”Ђв”Ђ Feature 10: Backend Hooks в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type WebhookConfig struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index"`
	URL       string    `json:"url" gorm:"size:2048"`
	Events    string    `json:"events" gorm:"type:text"` // JSON array: ["message.created","member.joined"]
	Secret    string    `json:"secret" gorm:"size:256"`
	IsActive  bool      `json:"isActive" gorm:"default:true"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

type WebhookDelivery struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	WebhookID    string    `json:"webhookId" gorm:"index"`
	Event        string    `json:"event" gorm:"size:64"`
	Payload      string    `json:"payload" gorm:"type:text"`
	StatusCode   int       `json:"statusCode"`
	ResponseBody string    `json:"responseBody" gorm:"type:text"`
	Success      bool      `json:"success"`
	CreatedAt    time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Webhook WebhookConfig `json:"-" gorm:"foreignKey:WebhookID"`
}

// в”Ђв”Ђв”Ђ Feature 9: AuthPage Types в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type AuthPageConfig struct {
	BackgroundURL  string `json:"backgroundUrl"`
	AccentColor    string `json:"accentColor"`
	ShowAnimations bool   `json:"showAnimations"`
}

// в”Ђв”Ђв”Ђ API Request Types for new features в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type CreateSmartFolderRequest struct {
	Name  string `json:"name"`
	Icon  string `json:"icon"`
	Color string `json:"color"`
	Rules string `json:"rules"` // JSON array of rules
}

type CreateChatNoteRequest struct {
	Content string `json:"content"`
}

type CreateAnonymousChatRequest struct {
	Topic string `json:"topic"`
}

type RateAnonymousChatRequest struct {
	ChatID string `json:"chatId"`
	Rating int    `json:"rating"` // -1, 0, 1
}

type SendAICommandRequest struct {
	ChatID  string `json:"chatId"`
	Prompt  string `json:"prompt"`
	Command string `json:"command"` // default: "РЅРµРєСЃРѕ-РёРё"
}

type CreateWebhookRequest struct {
	URL    string `json:"url"`
	Events string `json:"events"` // JSON array
}

type VoiceRoomActionRequest struct {
	RoomID string `json:"roomId"`
}

// в”Ђв”Ђв”Ђ Feature: Self-Destruct on Read в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type SelfDestructRead struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	MessageID string    `json:"messageId" gorm:"index"`
	UserID    string    `json:"userId" gorm:"index"`
	ReadAt    time.Time `json:"readAt" gorm:"autoCreateTime"`

	Message Message `json:"-" gorm:"foreignKey:MessageID"`
	User    User    `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ Feature: Chat Snooze (Quiet Hours) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type ChatSnooze struct {
	ID        string     `json:"id" gorm:"primaryKey"`
	ChatID    string     `json:"chatId" gorm:"index"`
	UserID    string     `json:"userId" gorm:"index"`
	ExpiresAt *time.Time `json:"expiresAt"`
	CreatedAt time.Time  `json:"createdAt" gorm:"autoCreateTime"`

	Chat Chat `json:"-" gorm:"foreignKey:ChatID"`
	User User `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ Feature: Chat Reminders в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type ChatReminder struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index"`
	ChatID    string    `json:"chatId" gorm:"index"`
	MessageID string    `json:"messageId" gorm:"index"`
	RemindAt  time.Time `json:"remindAt" gorm:"index"`
	IsSent    bool      `json:"isSent" gorm:"default:false"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User    User    `json:"-" gorm:"foreignKey:UserID"`
	Chat    Chat    `json:"-" gorm:"foreignKey:ChatID"`
	Message Message `json:"-" gorm:"foreignKey:MessageID"`
}

// в”Ђв”Ђв”Ђ Feature: Contact Color Tags в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type ContactTag struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index"`   // owner
	TargetID  string    `json:"targetId" gorm:"index"` // tagged user
	Label     string    `json:"label" gorm:"size:32"`  // e.g. "work", "family"
	Color     string    `json:"color" gorm:"size:16"`  // hex color
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User   User `json:"-" gorm:"foreignKey:UserID"`
	Target User `json:"target" gorm:"foreignKey:TargetID"`
}

// в”Ђв”Ђв”Ђ Feature: Public Interest Rooms в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type PublicRoom struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	ChatID       string    `json:"chatId" gorm:"uniqueIndex"`
	Name         string    `json:"name" gorm:"size:128"`
	Description  string    `json:"description" gorm:"size:512"`
	Category     string    `json:"category" gorm:"size:64"` // gaming, music, tech, etc.
	Icon         string    `json:"icon" gorm:"size:32"`
	MembersCount int       `json:"membersCount" gorm:"default:0"`
	IsFeatured   bool      `json:"isFeatured" gorm:"default:false"`
	CreatedAt    time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt    time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Chat Chat `json:"chat" gorm:"foreignKey:ChatID"`
}

// в”Ђв”Ђв”Ђ Feature: Screenshot Detection в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type ScreenshotLog struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	ChatID    string    `json:"chatId" gorm:"index"`
	UserID    string    `json:"userId" gorm:"index"`    // who took screenshot
	MessageID string    `json:"messageId" gorm:"index"` // what was screenshotted
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Chat    Chat    `json:"-" gorm:"foreignKey:ChatID"`
	User    User    `json:"-" gorm:"foreignKey:UserID"`
	Message Message `json:"-" gorm:"foreignKey:MessageID"`
}

// в”Ђв”Ђв”Ђ API Request Types for new features в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type SetMoodRequest struct {
	MoodStatus string `json:"moodStatus"` // emoji or text
}

type SnoozeRequest struct {
	Minutes int `json:"minutes"` // how long to snooze
}

type CreateReminderRequest struct {
	MessageID string `json:"messageId"`
	RemindAt  string `json:"remindAt"` // ISO 8601
}

type CreateContactTagRequest struct {
	TargetID string `json:"targetId"`
	Label    string `json:"label"`
	Color    string `json:"color"`
}

type CreatePublicRoomRequest struct {
	ChatID      string `json:"chatId"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Icon        string `json:"icon"`
}

type ScreenshotNotifyRequest struct {
	ChatID    string `json:"chatId"`
	MessageID string `json:"messageId"`
}

// в”Ђв”Ђв”Ђ Cloud Storage в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type CloudFile struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index"`
	Filename  string    `json:"filename"`
	URL       string    `json:"url"`
	Size      int64     `json:"size"`
	Type      string    `json:"type" gorm:"size:32"` // image, video, audio, document, other
	MimeType  string    `json:"mimeType" gorm:"size:128"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ AI Browsing в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type AIBrowseTask struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	UserID      string    `json:"userId" gorm:"index"`
	ChatID      string    `json:"chatId" gorm:"index"`
	Query       string    `json:"query" gorm:"type:text"`
	Status      string    `json:"status" gorm:"size:32;default:pending"` // pending, running, completed, failed
	Result      string    `json:"result" gorm:"type:text"`               // JSON result
	Sources     string    `json:"sources" gorm:"type:text"`              // JSON array of URLs
	Error       string    `json:"error"`
	PagesViewed int       `json:"pagesViewed" gorm:"default:0"`
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
	Chat Chat `json:"-" gorm:"foreignKey:ChatID"`
}

type AIBrowseRequest struct {
	Query   string `json:"query"`
	ChatID  string `json:"chatId"`
	Context string `json:"context"`
}

// в”Ђв”Ђв”Ђ AI Translation в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type TranslationLog struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	UserID       string    `json:"userId" gorm:"index"`
	MessageID    string    `json:"messageId" gorm:"index"`
	SourceLang   string    `json:"sourceLang" gorm:"size:8"`
	TargetLang   string    `json:"targetLang" gorm:"size:8"`
	OriginalText string    `json:"originalText" gorm:"type:text"`
	Translated   string    `json:"translated" gorm:"type:text"`
	CreatedAt    time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User    User    `json:"-" gorm:"foreignKey:UserID"`
	Message Message `json:"-" gorm:"foreignKey:MessageID"`
}

type TranslateRequest struct {
	MessageID  string `json:"messageId"`
	Text       string `json:"text"`
	TargetLang string `json:"targetLang"`
}

// в”Ђв”Ђв”Ђ AI Moderation в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type ModerationAction struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	ChatID    string    `json:"chatId" gorm:"index"`
	MessageID string    `json:"messageId" gorm:"index"`
	UserID    string    `json:"userId" gorm:"index"`
	Verdict   string    `json:"verdict" gorm:"size:32"` // safe, spam, toxic, nsfw
	Score     float64   `json:"score"`
	Reason    string    `json:"reason" gorm:"type:text"`
	Action    string    `json:"action" gorm:"size:32"` // none, warn, mute, delete
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Chat    Chat    `json:"-" gorm:"foreignKey:ChatID"`
	Message Message `json:"-" gorm:"foreignKey:MessageID"`
	User    User    `json:"-" gorm:"foreignKey:UserID"`
}

type ModerationConfig struct {
	ID             string  `json:"id" gorm:"primaryKey"`
	ChatID         string  `json:"chatId" gorm:"uniqueIndex"`
	AutoModEnabled bool    `json:"autoModEnabled" gorm:"default:false"`
	SpamThreshold  float64 `json:"spamThreshold" gorm:"default:0.8"`
	ToxicThreshold float64 `json:"toxicThreshold" gorm:"default:0.7"`
	NSFWThreshold  float64 `json:"nsfwThreshold" gorm:"default:0.9"`
	Action         string  `json:"action" gorm:"size:32;default:warn"` // warn, mute, delete
	WhitelistUsers string  `json:"whitelistUsers" gorm:"type:text"`    // JSON array of user IDs

	Chat Chat `json:"-" gorm:"foreignKey:ChatID"`
}

type AutoReplyConfig struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	UserID      string    `json:"userId" gorm:"uniqueIndex"`
	IsEnabled   bool      `json:"isEnabled" gorm:"default:false"`
	Persona     string    `json:"persona" gorm:"type:text"`     // AI persona description
	MaxReplies  int       `json:"maxReplies" gorm:"default:10"` // per hour
	ReplyDelay  int       `json:"replyDelay" gorm:"default:30"` // seconds
	ActiveChats string    `json:"activeChats" gorm:"type:text"` // JSON array of chat IDs
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ Voice Assistant в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type VoiceCommand struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	UserID     string    `json:"userId" gorm:"index"`
	Command    string    `json:"command" gorm:"size:64"`
	Transcript string    `json:"transcript" gorm:"type:text"`
	Response   string    `json:"response" gorm:"type:text"`
	Executed   bool      `json:"executed" gorm:"default:false"`
	CreatedAt  time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ Voice Room Activities в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type VoiceRoomActivity struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	RoomID    string    `json:"roomId" gorm:"index"`
	Type      string    `json:"type" gorm:"size:32"` // watch_party, game, music
	URL       string    `json:"url"`
	Title     string    `json:"title"`
	IsActive  bool      `json:"isActive" gorm:"default:true"`
	StartedBy string    `json:"startedBy"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Room VoiceRoom `json:"-" gorm:"foreignKey:RoomID"`
}

// в”Ђв”Ђв”Ђ Collaborative Whiteboard в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type Whiteboard struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	ChatID    string    `json:"chatId" gorm:"index"`
	Name      string    `json:"name" gorm:"size:128"`
	CreatorID string    `json:"creatorId"`
	Data      string    `json:"data" gorm:"type:text"` // JSON: canvas elements
	Version   int       `json:"version" gorm:"default:1"`
	IsPublic  bool      `json:"isPublic" gorm:"default:false"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Chat    Chat `json:"-" gorm:"foreignKey:ChatID"`
	Creator User `json:"creator" gorm:"foreignKey:CreatorID"`
}

type WhiteboardEdit struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	WhiteboardID string    `json:"whiteboardId" gorm:"index"`
	UserID       string    `json:"userId" gorm:"index"`
	Operation    string    `json:"operation" gorm:"type:text"` // JSON: {type, path, value, position}
	Version      int       `json:"version"`
	CreatedAt    time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Whiteboard Whiteboard `json:"-" gorm:"foreignKey:WhiteboardID"`
	User       User       `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ Scheduled Messages (extended) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type ScheduledMessage struct {
	ID         string     `json:"id" gorm:"primaryKey"`
	UserID     string     `json:"userId" gorm:"index"`
	ChatID     string     `json:"chatId" gorm:"index"`
	Content    string     `json:"content" gorm:"type:text"`
	Type       string     `json:"type" gorm:"size:32;default:text"`
	MediaURL   string     `json:"mediaUrl"`
	ScheduleAt time.Time  `json:"scheduleAt" gorm:"index"`
	Repeat     string     `json:"repeat" gorm:"size:32"` // none, daily, weekly, monthly
	RepeatEnd  *time.Time `json:"repeatEnd"`
	IsSent     bool       `json:"isSent" gorm:"default:false"`
	CreatedAt  time.Time  `json:"createdAt" gorm:"autoCreateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
	Chat Chat `json:"-" gorm:"foreignKey:ChatID"`
}

type CreateScheduledMessageRequest struct {
	ChatID     string `json:"chatId"`
	Content    string `json:"content"`
	Type       string `json:"type"`
	MediaURL   string `json:"mediaUrl"`
	ScheduleAt string `json:"scheduleAt"` // ISO 8601
	Repeat     string `json:"repeat"`
	RepeatEnd  string `json:"repeatEnd"`
}

// в”Ђв”Ђв”Ђ Chat Themes в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type ChatTheme struct {
	ID              string    `json:"id" gorm:"primaryKey"`
	ChatID          string    `json:"chatId" gorm:"index"`
	UserID          string    `json:"userId" gorm:"index"`
	BackgroundImage string    `json:"backgroundImage"`
	BackgroundColor string    `json:"backgroundColor"`
	BubbleColor     string    `json:"bubbleColor"`
	BubbleTextColor string    `json:"bubbleTextColor"`
	AccentColor     string    `json:"accentColor"`
	CreatedAt       time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Chat Chat `json:"-" gorm:"foreignKey:ChatID"`
	User User `json:"-" gorm:"foreignKey:UserID"`
}

type SetChatThemeRequest struct {
	BackgroundImage string `json:"backgroundImage"`
	BackgroundColor string `json:"backgroundColor"`
	BubbleColor     string `json:"bubbleColor"`
	BubbleTextColor string `json:"bubbleTextColor"`
	AccentColor     string `json:"accentColor"`
}

// в”Ђв”Ђв”Ђ Kanban Board в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type KanbanBoard struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	ChatID    string    `json:"chatId" gorm:"index"`
	Name      string    `json:"name" gorm:"size:128"`
	CreatorID string    `json:"creatorId"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	Chat    Chat           `json:"-" gorm:"foreignKey:ChatID"`
	Columns []KanbanColumn `json:"columns" gorm:"foreignKey:BoardID"`
}

type KanbanColumn struct {
	ID      string `json:"id" gorm:"primaryKey"`
	BoardID string `json:"boardId" gorm:"index"`
	Name    string `json:"name" gorm:"size:64"`
	Order   int    `json:"order" gorm:"default:0"`
	Color   string `json:"color" gorm:"size:16"`

	Board KanbanBoard  `json:"-" gorm:"foreignKey:BoardID"`
	Tasks []KanbanTask `json:"tasks" gorm:"foreignKey:ColumnID"`
}

type KanbanTask struct {
	ID          string     `json:"id" gorm:"primaryKey"`
	ColumnID    string     `json:"columnId" gorm:"index"`
	BoardID     string     `json:"boardId" gorm:"index"`
	Title       string     `json:"title" gorm:"size:256"`
	Description string     `json:"description" gorm:"type:text"`
	AssigneeID  string     `json:"assigneeId"`
	Priority    string     `json:"priority" gorm:"size:16;default:medium"` // low, medium, high, urgent
	Deadline    *time.Time `json:"deadline"`
	Order       int        `json:"order" gorm:"default:0"`
	Labels      string     `json:"labels" gorm:"type:text"` // JSON array
	CreatedAt   time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt   time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`

	Column   KanbanColumn `json:"-" gorm:"foreignKey:ColumnID"`
	Assignee *User        `json:"assignee,omitempty" gorm:"foreignKey:AssigneeID"`
}

type CreateKanbanBoardRequest struct {
	Name string `json:"name"`
}

type CreateKanbanTaskRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	AssigneeID  string `json:"assigneeId"`
	Priority    string `json:"priority"`
	Deadline    string `json:"deadline"`
}

// в”Ђв”Ђв”Ђ Message Bookmarks в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type MessageBookmark struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index"`
	MessageID string    `json:"messageId" gorm:"index"`
	ChatID    string    `json:"chatId" gorm:"index"`
	Note      string    `json:"note" gorm:"type:text"`
	Tags      string    `json:"tags" gorm:"type:text"` // JSON array
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User    User    `json:"-" gorm:"foreignKey:UserID"`
	Message Message `json:"-" gorm:"foreignKey:MessageID"`
	Chat    Chat    `json:"-" gorm:"foreignKey:ChatID"`
}

type CreateBookmarkRequest struct {
	MessageID string `json:"messageId"`
	Note      string `json:"note"`
	Tags      string `json:"tags"`
}

// в”Ђв”Ђв”Ђ Message Templates в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type MessageTemplate struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	UserID     string    `json:"userId" gorm:"index"`
	Name       string    `json:"name" gorm:"size:64"`
	Content    string    `json:"content" gorm:"type:text"`
	Shortcut   string    `json:"shortcut" gorm:"size:32"` // e.g., "/ty" -> "РЎРїР°СЃРёР±Рѕ!"
	Category   string    `json:"category" gorm:"size:32"` // greeting, response, signature
	UsageCount int       `json:"usageCount" gorm:"default:0"`
	CreatedAt  time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt  time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

type CreateTemplateRequest struct {
	Name     string `json:"name"`
	Content  string `json:"content"`
	Shortcut string `json:"shortcut"`
	Category string `json:"category"`
}

// в”Ђв”Ђв”Ђ AI Smart Reminders в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type SmartReminder struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	UserID      string    `json:"userId" gorm:"index"`
	ChatID      string    `json:"chatId" gorm:"index"`
	MessageID   string    `json:"messageId" gorm:"index"`
	TriggerText string    `json:"triggerText" gorm:"type:text"` // AI-detected trigger
	RemindAt    time.Time `json:"remindAt" gorm:"index"`
	IsCompleted bool      `json:"isCompleted" gorm:"default:false"`
	CreatedBy   string    `json:"createdBy" gorm:"size:32"` // user, ai
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User    User    `json:"-" gorm:"foreignKey:UserID"`
	Chat    Chat    `json:"-" gorm:"foreignKey:ChatID"`
	Message Message `json:"-" gorm:"foreignKey:MessageID"`
}

// в”Ђв”Ђв”Ђ Calendar Events в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type CalendarEvent struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	UserID      string    `json:"userId" gorm:"index"`
	ChatID      string    `json:"chatId" gorm:"index"`
	Title       string    `json:"title" gorm:"size:256"`
	Description string    `json:"description" gorm:"type:text"`
	Location    string    `json:"location"`
	StartTime   time.Time `json:"startTime" gorm:"index"`
	EndTime     time.Time `json:"endTime"`
	IsAllDay    bool      `json:"isAllDay" gorm:"default:false"`
	Reminder    int       `json:"reminder" gorm:"default:15"` // minutes before
	Recurrence  string    `json:"recurrence" gorm:"size:32"`  // none, daily, weekly, monthly, yearly
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
	Chat Chat `json:"-" gorm:"foreignKey:ChatID"`
}

type CalendarEventInvite struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	EventID   string    `json:"eventId" gorm:"index"`
	UserID    string    `json:"userId" gorm:"index"`
	Status    string    `json:"status" gorm:"size:32;default:pending"` // pending, accepted, declined
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Event CalendarEvent `json:"-" gorm:"foreignKey:EventID"`
	User  User          `json:"-" gorm:"foreignKey:UserID"`
}

type CreateEventRequest struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Location    string   `json:"location"`
	StartTime   string   `json:"startTime"`
	EndTime     string   `json:"endTime"`
	IsAllDay    bool     `json:"isAllDay"`
	Reminder    int      `json:"reminder"`
	Recurrence  string   `json:"recurrence"`
	InviteIDs   []string `json:"inviteIds"`
}

// в”Ђв”Ђв”Ђ Photo Albums в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type PhotoAlbum struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	UserID      string    `json:"userId" gorm:"index"`
	Name        string    `json:"name" gorm:"size:128"`
	Description string    `json:"description"`
	CoverURL    string    `json:"coverUrl"`
	IsPublic    bool      `json:"isPublic" gorm:"default:false"`
	CreatedAt   time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	User   User             `json:"-" gorm:"foreignKey:UserID"`
	Photos []PhotoAlbumItem `json:"photos" gorm:"foreignKey:AlbumID"`
}

type PhotoAlbumItem struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	AlbumID   string    `json:"albumId" gorm:"index"`
	MediaID   string    `json:"mediaId"`
	Caption   string    `json:"caption"`
	Order     int       `json:"order" gorm:"default:0"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	Album PhotoAlbum `json:"-" gorm:"foreignKey:AlbumID"`
}

// в”Ђв”Ђв”Ђ Screen Recording в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type ScreenRecording struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	UserID    string    `json:"userId" gorm:"index"`
	ChatID    string    `json:"chatId" gorm:"index"`
	URL       string    `json:"url"`
	Duration  float64   `json:"duration"`
	Size      int64     `json:"size"`
	Thumbnail string    `json:"thumbnail"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
	Chat Chat `json:"-" gorm:"foreignKey:ChatID"`
}

// в”Ђв”Ђв”Ђ Encrypted File Vault в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type VaultFile struct {
	ID            string    `json:"id" gorm:"primaryKey"`
	UserID        string    `json:"userId" gorm:"index"`
	Filename      string    `json:"filename"`
	EncryptedURL  string    `json:"encryptedUrl"`
	EncryptionKey string    `json:"-"` // encrypted key
	Size          int64     `json:"size"`
	MimeType      string    `json:"mimeType"`
	Checksum      string    `json:"checksum"` // SHA-256
	CreatedAt     time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ Anonymous Incognito Chats в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type IncognitoChat struct {
	ID           string     `json:"id" gorm:"primaryKey"`
	CreatorID    string     `json:"creatorId" gorm:"index"`
	InviteCode   string     `json:"inviteCode" gorm:"uniqueIndex;size:32"`
	IsEncrypted  bool       `json:"isEncrypted" gorm:"default:false"`
	MaxMembers   int        `json:"maxMembers" gorm:"default:10"`
	MessageCount int        `json:"messageCount" gorm:"default:0"`
	ExpiresAt    *time.Time `json:"expiresAt"`
	CreatedAt    time.Time  `json:"createdAt" gorm:"autoCreateTime"`

	Creator User              `json:"creator" gorm:"foreignKey:CreatorID"`
	Members []IncognitoMember `json:"members" gorm:"foreignKey:ChatID"`
}

type IncognitoMember struct {
	ID       string    `json:"id" gorm:"primaryKey"`
	ChatID   string    `json:"chatId" gorm:"index"`
	UserID   string    `json:"userId" gorm:"index"`
	Alias    string    `json:"alias" gorm:"size:64"` // random alias
	JoinedAt time.Time `json:"joinedAt" gorm:"autoCreateTime"`

	Chat IncognitoChat `json:"-" gorm:"foreignKey:ChatID"`
	User User          `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ Device Management в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type UserSession struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	UserID     string    `json:"userId" gorm:"index"`
	DeviceID   string    `json:"deviceId" gorm:"size:128"`
	DeviceName string    `json:"deviceName" gorm:"size:128"`
	DeviceType string    `json:"deviceType" gorm:"size:32"` // web, android, ios, desktop
	Platform   string    `json:"platform" gorm:"size:32"`
	Browser    string    `json:"browser" gorm:"size:64"`
	IPAddress  string    `json:"ipAddress" gorm:"size:45"`
	Location   string    `json:"location" gorm:"size:128"`
	IsActive   bool      `json:"isActive" gorm:"default:true"`
	LastActive time.Time `json:"lastActive" gorm:"autoCreateTime"`
	CreatedAt  time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ Privacy Audit в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type PrivacyAudit struct {
	ID         string    `json:"id" gorm:"primaryKey"`
	UserID     string    `json:"userId" gorm:"index"`
	Category   string    `json:"category" gorm:"size:32"` // profile, messages, calls, data
	Issue      string    `json:"issue" gorm:"size:256"`
	Severity   string    `json:"severity" gorm:"size:16"` // low, medium, high, critical
	Suggestion string    `json:"suggestion" gorm:"type:text"`
	IsFixed    bool      `json:"isFixed" gorm:"default:false"`
	CreatedAt  time.Time `json:"createdAt" gorm:"autoCreateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

// в”Ђв”Ђв”Ђ Dead Man's Switch в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type DeadManSwitch struct {
	ID              string     `json:"id" gorm:"primaryKey"`
	UserID          string     `json:"userId" gorm:"uniqueIndex"`
	IsEnabled       bool       `json:"isEnabled" gorm:"default:false"`
	InactivityDays  int        `json:"inactivityDays" gorm:"default:30"` // days without activity
	LastCheckIn     time.Time  `json:"lastCheckIn" gorm:"autoCreateTime"`
	MessageTemplate string     `json:"messageTemplate" gorm:"type:text"` // message to send
	RecipientIDs    string     `json:"recipientIds" gorm:"type:text"`    // JSON array
	IsTriggered     bool       `json:"isTriggered" gorm:"default:false"`
	TriggeredAt     *time.Time `json:"triggeredAt"`
	CreatedAt       time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt       time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`

	User User `json:"-" gorm:"foreignKey:UserID"`
}

type DeadManSwitchRecipient struct {
	ID       string    `json:"id" gorm:"primaryKey"`
	SwitchID string    `json:"switchId" gorm:"index"`
	UserID   string    `json:"userId" gorm:"index"`
	SentAt   time.Time `json:"sentAt"`

	Switch DeadManSwitch `json:"-" gorm:"foreignKey:SwitchID"`
	User   User          `json:"-" gorm:"foreignKey:UserID"`
}

// RefreshTokenBlacklist stores blacklisted refresh token hashes (survives restarts)
type RefreshTokenBlacklist struct {
	ID        string    `json:"id" gorm:"primaryKey"`
	TokenHash string    `json:"tokenHash" gorm:"uniqueIndex;size:64"`
	ExpiresAt time.Time `json:"expiresAt" gorm:"index"`
}

// PushSubscription stores a Web Push subscription endpoint for a device.
type PushSubscription struct {
	ID           string    `json:"id" gorm:"primaryKey"`
	UserID       string    `json:"userId" gorm:"index"`
	Endpoint     string    `json:"endpoint" gorm:"size:512"`
	P256DH       string    `json:"p256dh" gorm:"size:256"`
	Auth         string    `json:"auth" gorm:"size:256"`
	UserAgent    string    `json:"userAgent" gorm:"size:256"`
	CreatedAt    time.Time `json:"createdAt" gorm:"autoCreateTime"`
	LastUsedAt   time.Time `json:"lastUsedAt" gorm:"autoUpdateTime"`
}
